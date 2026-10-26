import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

import {
  buildIssueBranchName,
  collectLinkedBranchNames,
  deriveBranchType,
  deriveIssueTypeSlug,
  hostQualifiedRepo,
  isSquadIssue,
  resolveGhHost,
  slugifyBranchDescription,
} from './ensure-issue-branch.mjs';

const PRE_PUSH_HOOK_URL = new URL('../.husky/pre-push-validate.js', import.meta.url);

/**
 * Lädt genau die Branch-Namen-Regel, die der Husky-Pre-Push-Hook erzwingt, damit die
 * Assertions unten nicht vom Hook abweichen können.
 */
function loadPrePushBranchRule() {
  const source = readFileSync(PRE_PUSH_HOOK_URL, 'utf8');

  const validTypesMatch = source.match(/const validTypes = \[([\s\S]*?)\];/);
  assert.ok(validTypesMatch, 'pre-push hook should declare a validTypes list');
  const validTypes = [...validTypesMatch[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);

  const patternMatch = source.match(/const branchPattern = new RegExp\(\s*([\s\S]*?)\s*\);/);
  assert.ok(patternMatch, 'pre-push hook should declare a branchPattern');

  const buildPattern = new Function('validTypes', `return new RegExp(${patternMatch[1]});`);

  return { validTypes, branchPattern: buildPattern(validTypes) };
}

test('issue branch naming follows the conventional <type>/issue-<n>-<slug> convention', () => {
  assert.equal(
    buildIssueBranchName({ type: 'feat', issueId: 434, slug: 'feature' }),
    'feat/issue-434-feature'
  );
  assert.equal(
    buildIssueBranchName({ type: 'fix', issueId: 52, slug: 'bug' }),
    'fix/issue-52-bug'
  );
  assert.equal(
    buildIssueBranchName({ issueId: 81, slug: 'work-item' }),
    'feat/issue-81-work-item',
    'a missing type falls back to feat'
  );
});

test('issue branch naming never uses the rejected squad/ prefix', () => {
  assert.throws(
    () => buildIssueBranchName({ type: 'squad', issueId: 482, slug: 'feat' }),
    /Invalid branch type "squad"/,
    'squad is not a Conventional Branch Name type and is rejected by the pre-push hook'
  );

  const branchName = buildIssueBranchName({ issueId: 482, slug: 'dark-software-factory' });
  assert.ok(!branchName.startsWith('squad/'), `unexpected squad/ prefix in ${branchName}`);
});

test('issue branch names satisfy the husky pre-push branch rule', () => {
  const { validTypes, branchPattern } = loadPrePushBranchRule();

  const accepted = buildIssueBranchName({ issueId: 482, slug: 'Dark Software Factory' });
  assert.equal(accepted, 'feat/issue-482-dark-software-factory');
  assert.ok(branchPattern.test(accepted), `hook must accept ${accepted}`);
  assert.match(accepted, /^[a-z]+\/[a-z0-9._-]+$/);

  for (const type of validTypes) {
    const branchName = buildIssueBranchName({ type, issueId: 7, slug: 'validate-me' });
    assert.ok(branchPattern.test(branchName), `hook must accept ${branchName}`);
  }

  assert.ok(
    !branchPattern.test('squad/482-feat'),
    'the legacy squad/<n>-<type> shape must stay rejected by the hook'
  );
});

test('branch descriptions are normalized to kebab-case ASCII', () => {
  assert.equal(slugifyBranchDescription('  Änderung der Lieferanten-Prüfung '), 'anderung-der-lieferanten-prufung');
  assert.equal(slugifyBranchDescription('[BUG] Fix: login__validation!'), 'bug-fix-login-validation');
  assert.equal(slugifyBranchDescription('dark-software-factory'), 'dark-software-factory');
  assert.equal(slugifyBranchDescription('   '), '');
});

test('issue branch naming rejects unusable inputs', () => {
  assert.throws(
    () => buildIssueBranchName({ issueId: 482, slug: '   ' }),
    /Could not derive a branch description/
  );
  assert.throws(() => buildIssueBranchName({ issueId: 0, slug: 'x' }), /Invalid issue number/);
  assert.throws(() => buildIssueBranchName({ issueId: 'abc', slug: 'x' }), /Invalid issue number/);
});

test('type slug selection prefers known English type labels', () => {
  assert.equal(deriveIssueTypeSlug(['type:task', 'type:feature']), 'feature');
  assert.equal(deriveIssueTypeSlug(['priority:p1', 'type:docs']), 'docs');
  assert.equal(deriveIssueTypeSlug(['type:maintenance']), 'maintenance');
});

test('branch type selection maps issue type labels onto conventional branch types', () => {
  assert.equal(deriveBranchType(['squad', 'type:bug']), 'fix');
  assert.equal(deriveBranchType(['type:feature']), 'feat');
  assert.equal(deriveBranchType(['type:docs']), 'docs');
  assert.equal(deriveBranchType(['type:maintenance']), 'feat', 'unknown types fall back to feat');
  assert.equal(deriveBranchType([]), 'feat');
});

test('squad issue detection requires squad routing labels', () => {
  assert.equal(isSquadIssue(['type:feature', 'priority:p1']), false);
  assert.equal(isSquadIssue(['squad', 'type:feature']), true);
  assert.equal(isSquadIssue(['squad:bruce', 'type:feature']), true);
});

test('linked branch extraction ignores malformed nodes', () => {
  assert.deepEqual(
    collectLinkedBranchNames({
      linkedBranches: {
        nodes: [{ ref: { name: 'feat/issue-434-feature' } }, { ref: null }, null],
      },
    }),
    ['feat/issue-434-feature']
  );
});

test('gh host resolution derives a host from GITHUB_SERVER_URL', () => {
  assert.equal(
    resolveGhHost({ GITHUB_SERVER_URL: 'https://bmw.ghe.com' }),
    'bmw.ghe.com',
    'must strip protocol so the host is bare'
  );
  assert.equal(resolveGhHost({ GITHUB_SERVER_URL: 'https://github.com' }), 'github.com');
});

test('gh host resolution returns undefined when GITHUB_SERVER_URL is missing or malformed', () => {
  assert.equal(resolveGhHost({}), undefined);
  assert.equal(resolveGhHost({ GITHUB_SERVER_URL: 'not a url' }), undefined);
});

test('host-qualified repo matches the proven --repo "host/owner/repo" pattern from #575/#577', () => {
  assert.equal(
    hostQualifiedRepo('ExampleProject/ExampleProject', 'bmw.ghe.com'),
    'bmw.ghe.com/ExampleProject/ExampleProject'
  );
  assert.equal(
    hostQualifiedRepo('ExampleProject/ExampleProject', 'github.com'),
    'github.com/ExampleProject/ExampleProject'
  );
});

test('host-qualified repo falls back to the bare repository when no host is resolved', () => {
  assert.equal(
    hostQualifiedRepo('ExampleProject/ExampleProject', undefined),
    'ExampleProject/ExampleProject'
  );
});

describe('issue #434 regression coverage', () => {
  test('prefers known English type labels over unknown or non-ASCII type labels', () => {
    assert.equal(deriveIssueTypeSlug(['type:änderung', 'type:feature', 'priority:p1']), 'feature');
    assert.equal(deriveIssueTypeSlug(['type:überraschung', 'type:task', 'squad']), 'task');
  });

  test('branch naming stays canonical and ignores non-ASCII metadata noise', () => {
    const labels = [
      'squad',
      'type:feature',
      'priority:p0',
      'go:yes',
      'area:lieferanten-prüfung-äöü',
    ];

    const branchName = buildIssueBranchName({
      type: deriveBranchType(labels),
      issueId: 434,
      slug: 'feature',
    });
    assert.equal(branchName, 'feat/issue-434-feature');
    assert.ok(branchName.startsWith('feat/issue-434-'));
    assert.ok(!branchName.includes('ä'));
  });

  test('linked branches are surfaced for rerun no-op checks even with legacy names present', () => {
    assert.deepEqual(
      collectLinkedBranchNames({
        linkedBranches: {
          nodes: [
            { ref: { name: 'feat/issue-434-feature' } },
            { ref: { name: 'legacy/434-old-name' } },
            { ref: null },
            null,
          ],
        },
      }),
      ['feat/issue-434-feature', 'legacy/434-old-name']
    );
  });
});
