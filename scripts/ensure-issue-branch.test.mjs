import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  buildIssueBranchName,
  collectLinkedBranchNames,
  deriveIssueTypeSlug,
  hostQualifiedRepo,
  isSquadIssue,
  resolveGhHost,
} from './ensure-issue-branch.mjs';

test('issue branch naming uses the canonical squad/<number>-<english-slug> convention', () => {
  assert.equal(
    buildIssueBranchName({ issueNumber: 434, labels: ['squad', 'type:feature'] }),
    'squad/434-feature'
  );
  assert.equal(
    buildIssueBranchName({ issueNumber: 52, labels: ['squad', 'type:bug'] }),
    'squad/52-bug'
  );
  assert.equal(buildIssueBranchName({ issueNumber: 81, labels: ['squad'] }), 'squad/81-work-item');
});

test('type slug selection prefers known English type labels', () => {
  assert.equal(deriveIssueTypeSlug(['type:task', 'type:feature']), 'feature');
  assert.equal(deriveIssueTypeSlug(['priority:p1', 'type:docs']), 'docs');
  assert.equal(deriveIssueTypeSlug(['type:maintenance']), 'maintenance');
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
        nodes: [{ ref: { name: 'squad/434-feature' } }, { ref: null }, null],
      },
    }),
    ['squad/434-feature']
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

    assert.equal(buildIssueBranchName({ issueNumber: 434, labels }), 'squad/434-feature');
    assert.ok(buildIssueBranchName({ issueNumber: 434, labels }).startsWith('squad/434-'));
    assert.ok(!buildIssueBranchName({ issueNumber: 434, labels }).includes('ä'));
  });

  test('linked branches are surfaced for rerun no-op checks even with legacy names present', () => {
    assert.deepEqual(
      collectLinkedBranchNames({
        linkedBranches: {
          nodes: [
            { ref: { name: 'squad/434-feature' } },
            { ref: { name: 'legacy/434-old-name' } },
            { ref: null },
            null,
          ],
        },
      }),
      ['squad/434-feature', 'legacy/434-old-name']
    );
  });
});
