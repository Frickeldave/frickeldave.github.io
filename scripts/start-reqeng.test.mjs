import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  buildCanonicalRefName,
  buildCanonicalResourceName,
  buildCopilotArgs,
  parseIssueRefToken,
  resolveBranchContext,
  runReqEng,
  syncReusedWorktreeWithDev,
} from './start-reqeng.mjs';

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

test('parseIssueRefToken accepts canonical issue tokens case-insensitively', () => {
  assert.equal(parseIssueRefToken('IS_480'), 480);
  assert.equal(parseIssueRefToken('is-481'), 481);
  assert.equal(parseIssueRefToken('IS482'), 482);
});

test('parseIssueRefToken rejects bare numbers and PR refs', () => {
  assert.equal(parseIssueRefToken('480'), null);
  assert.equal(parseIssueRefToken('#480'), null);
  assert.equal(parseIssueRefToken('PR_480'), null);
});

test('buildCanonicalRefName returns issue-only canonical refs', () => {
  assert.equal(buildCanonicalRefName(480), 'IS_480');
});

test('buildCanonicalResourceName prefixes the repo name', () => {
  assert.equal(buildCanonicalResourceName('ExampleProject', 'IS_480'), 'ExampleProject_IS_480');
});

test('buildCopilotArgs omits the autopilot flag for reqeng', () => {
  assert.equal(buildCopilotArgs('prompt').includes('--autopilot'), false);
});

test('runReqEng resolves the issue, prepares the worktree, and launches the prepared work', async () => {
  const calls = [];
  const root = '/tmp/ExampleProject';
  const worktree = '/tmp/ExampleProject_IS_621';

  await runReqEng({
    argv: ['IS_621'],
    getMainCheckoutPathFn: () => {
      calls.push('root discovery');
      return root;
    },
    ensureProjectPropertyAccessFn: () => {
      calls.push('project access');
    },
    createInterfaceFn: () => {
      calls.push('create prompt');
      return { close: () => calls.push('close prompt') };
    },
    resolveIssueContextFn: (issueId) => {
      calls.push('GitHub issue');
      assert.equal(issueId, 621);
      return {
        issueId,
        requestedId: issueId,
        canonicalRefName: 'IS_621',
        issueTitle: 'Local guard',
        branchSlug: 'local-guard',
        labels: ['squad', 'type:feature'],
      };
    },
    promptAdditionalPromptFn: async () => {
      calls.push('additional prompt');
      return null;
    },
    assignIssueToCurrentHumanFn: () => {
      calls.push('assign issue');
    },
    prepareWorkContextFn: async (issueContext, repoRoot) => {
      calls.push('prepare worktree');
      assert.equal(repoRoot, root);
      assert.equal(issueContext.canonicalName, 'ExampleProject_IS_621');
      assert.equal(issueContext.tmuxSessionName, 'IS621');
      return { worktreeContext: { worktreePath: worktree } };
    },
    launchPreparedWorkFn: async (prepared, issueContext, prompt) => {
      calls.push('launch mocked');
      assert.equal(prepared.worktreeContext.worktreePath, worktree);
      assert.equal(issueContext.issueId, 621);
      assert.equal(issueContext.canonicalName, 'ExampleProject_IS_621');
      assert.match(prompt, /\.github\/prompts\/startreqeng\.prompt\.md/);
    },
  });

  assert.deepEqual(calls, [
    'project access',
    'root discovery',
    'create prompt',
    'GitHub issue',
    'additional prompt',
    'assign issue',
    'prepare worktree',
    'close prompt',
    'launch mocked',
  ]);
});

test('syncReusedWorktreeWithDev merges origin/dev into a clean, outdated worktree', () => {
  const root = mkdtempSync(join(tmpdir(), 'reqeng-sync-'));
  const git = (cwd, ...args) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd });
  const origin = join(root, 'origin');
  const clone = join(root, 'clone');
  git(root, 'init', '-q', '-b', 'dev', origin);
  writeFileSync(join(origin, 'a.txt'), '1');
  git(origin, 'add', '.');
  git(origin, 'commit', '-q', '-m', 'init');
  git(root, 'clone', '-q', origin, clone);
  git(clone, 'checkout', '-q', '-b', 'feature');
  writeFileSync(join(origin, 'b.txt'), 'new');
  git(origin, 'add', '.');
  git(origin, 'commit', '-q', '-m', 'second');

  syncReusedWorktreeWithDev(clone);

  assert.equal(readFileSync(join(clone, 'b.txt'), 'utf8'), 'new');
});

test('resolveBranchContext emits branch names the pre-push hook accepts', () => {
  const { validTypes, branchPattern } = loadPrePushBranchRule();
  const repoRoot = mkdtempSync(join(tmpdir(), 'reqeng-branch-'));

  const cases = [
    { labels: ['squad', 'type:bug'], branchType: 'fix' },
    { labels: ['type:feature'], branchType: 'feat' },
    { labels: ['type:docs'], branchType: 'docs' },
    { labels: ['type:maintenance'], branchType: 'feat' },
    { labels: [], branchType: 'feat' },
    { branchType: 'feat' },
  ];

  for (const { labels, branchType } of cases) {
    const issueContext = {
      issueId: 282,
      branchSlug: 'Gate__Active!!',
      ...(labels === undefined ? {} : { labels }),
    };

    const { branchName, baseBranch } = resolveBranchContext(issueContext, repoRoot);

    assert.equal(
      branchName,
      `${branchType}/issue-282-gate-active`,
      `labels ${JSON.stringify(labels ?? null)} should produce a ${branchType} branch`
    );
    assert.equal(branchName.startsWith('squad/'), false, 'squad/ is rejected by the hook');
    assert.ok(validTypes.includes(branchName.split('/')[0]), `${branchName} uses a valid type`);
    assert.ok(branchPattern.test(branchName), `pre-push hook must accept "${branchName}"`);
    assert.equal(typeof baseBranch, 'string');
  }
});

test('resolveBranchContext replaces legacy squad/ branch names for existing issues', () => {
  const repoRoot = mkdtempSync(join(tmpdir(), 'reqeng-branch-legacy-'));

  const { branchName } = resolveBranchContext(
    { issueId: 52, branchSlug: 'pagination-bug', labels: ['type:bug'] },
    repoRoot
  );

  assert.notEqual(branchName, 'squad/52-pagination-bug');
  assert.equal(branchName, 'fix/issue-52-pagination-bug');
});
