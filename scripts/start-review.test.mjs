import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

import { mockModule, testEach, vi } from './test-mock-support.mjs';

const spawn = vi.fn();
const spawnSync = vi.fn();
await mockModule('node:child_process', { spawn, spawnSync });

const existsSync = vi.fn();
const mkdirSync = vi.fn();
const writeFileSync = vi.fn();
await mockModule('node:fs', { existsSync, mkdirSync, writeFileSync });

const createInterface = vi.fn();
await mockModule('node:readline/promises', { createInterface });

// Plattform festnageln, damit sich die tmux-Flows auf jedem Host-OS identisch verhalten.
const platformState = { windows: false };
await mockModule('./platform-shared.mjs', {
  isWindows: () => platformState.windows,
  prepareSpawn: (command, args) => ({ command, args, options: {} }),
});

const {
  adoptLinkedIssueSession,
  buildInitialCopilotPrompt,
  exportTrustedReviewPrompt,
  findReadyPrForIssueSession,
  issueIdFromBranch,
  main,
  parseCliSelection,
  resolveLinkedIssueId,
  resolveReviewBranchContext,
  resolveReviewContext,
  runStartReview,
} = await import('./start-review.mjs');

testEach([
  { tmux: false, linked: false },
  { tmux: true, linked: true },
  { tmux: true, mismatch: true },
  { draft: true },
  { remoteHead: true },
  { missingHead: true },
  { windows: true },
])('review launcher dispatches review only with mocked operations: %j', async (scenario) => {
  const originalArgv = process.argv;
  const originalExitCode = process.exitCode;
  const repoRoot = import.meta.dirname;
  const worktreePath = `${repoRoot}_PR_107`;
  platformState.windows = Boolean(scenario.windows);
  const branch = scenario.linked ? 'feat/issue-103-review' : 'feature/standalone-review';
  const prompt = { question: vi.fn().mockResolvedValue('Review authentication'), close: vi.fn() };
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  const success = (stdout = '') => ({ status: 0, stdout, stderr: '' });
  vi.stubEnv('TMUX', scenario.tmux ? 'mock' : '');
  vi.mocked(createInterface).mockReturnValue(prompt);
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(spawn).mockImplementation(() => ({
    once(event, callback) {
      if (event === 'exit') queueMicrotask(() => callback(0));
      return this;
    },
  }));
  vi.mocked(spawnSync).mockImplementation((command, args) => {
    const operation = args.join(' ');
    if (args.length === 1 && args[0] === '--version' && command !== 'copilot') {
      return success('v1.0.0');
    }
    if (command === 'copilot') {
      return success(args[0] === '--version' ? 'GitHub Copilot CLI 1.0.98.' : '--no-mouse');
    }
    if (command === 'gh') {
      if (args[0] === 'auth' || (args[0] === 'api' && args[1] === 'graphql')) return success('{}');
      if (operation === 'pr view 107 --json title,number,isDraft,headRefName,baseRefName,body') {
        return success(
          JSON.stringify({
            number: 107,
            title: 'Review',
            isDraft: scenario.draft ?? false,
            headRefName: branch,
            baseRefName: 'main',
            body: scenario.linked ? 'Closes #103' : '',
          })
        );
      }
    }
    if (command === 'git') {
      if (args.includes('--show-toplevel')) return success(worktreePath);
      if (args.includes('--git-common-dir')) return success(resolve(repoRoot, '.git'));
      if (args.includes('--is-inside-work-tree')) return success('true');
      if (operation === 'worktree list --porcelain')
        return success(
          `worktree ${repoRoot}\nbranch refs/heads/main\n\nworktree ${worktreePath}\nbranch refs/heads/${branch}\n`
        );
      if (args[0] === 'symbolic-ref') return success('refs/remotes/origin/main');
      if (args[0] === 'rev-parse' && args[1] === '--verify')
        return { ...success(), status: scenario.remoteHead || scenario.missingHead ? 1 : 0 };
      if (args[0] === 'ls-remote') return { ...success(), status: scenario.missingHead ? 2 : 0 };
      if (operation === 'fetch origin dev') return success();
      if (operation === 'show origin/dev:.github/prompts/startreview.prompt.md')
        return success('# trusted prompt\n');
      if (args[0] === 'fetch' && scenario.remoteHead) return success();
      if (args[0] === 'branch' && scenario.remoteHead) {
        assert.deepEqual(args, ['branch', '--track', branch, `origin/${branch}`]);
        return success();
      }
      if (operation === 'rev-parse --abbrev-ref HEAD') return success(branch);
    }
    if (command === 'sh' && operation === '-lc command -v tmux') {
      assert.ok(!scenario.windows, 'tmux must not be probed on Windows');
      return { ...success(), status: scenario.tmux ? 0 : 1 };
    }
    if (command === 'tmux') {
      if (args[0] === '-V' || args[0] === 'set-option') return success();
      if (args[0] === 'display-message')
        return success(`$7\t${scenario.mismatch ? '107-0' : 'PR107'}`);
      if (args[0] === 'new-window') {
        assert.ok(args.includes('PR107'));
        assert.ok(args.includes(worktreePath));
        assert.match(args.at(-1), /startreview\.prompt\.md/);
        assert.doesNotMatch(args.at(-1), /startwork\.prompt\.md/);
        return success('9');
      }
      if (args[0] === 'select-window') return success();
    }
    throw new Error(`Unexpected external operation: ${command} ${operation}`);
  });
  try {
    process.argv = ['node', '/tmp/start-review.mjs', 'PR_107'];
    if (scenario.mismatch || scenario.draft || scenario.missingHead) {
      await assert.rejects(
        main(),
        /Invalid tmux state|still a draft|does not exist locally or on origin/
      );
      assert.equal(vi.mocked(spawn).mock.calls.length, 0);
      assert.ok(
        vi
          .mocked(spawnSync)
          .mock.calls.every(
            ([command, args]) =>
              command !== 'git' || !['branch', 'fetch', 'checkout'].includes(args[0])
          )
      );
    } else {
      await main();
      assert.ok(
        log.mock.calls.some(([message]) => /markieren → Rechtsklick.*Alt\+Ziehen/.test(message))
      );
      if (!scenario.tmux) {
        const [command, args, options] = vi.mocked(spawn).mock.calls[0];
        assert.equal(command, 'copilot');
        assert.equal(options.cwd, worktreePath);
        assert.match(args.at(-1), /startreview\.prompt\.md/);
        assert.doesNotMatch(args.at(-1), /startwork\.prompt\.md/);
        assert.match(args.at(-1), /Linked issue ID.*none/);
        assert.match(args.at(-1), /PR head branch: feature\/standalone-review/);
      }
      const branchCalls = vi
        .mocked(spawnSync)
        .mock.calls.filter(([command, args]) => command === 'git' && args[0] === 'branch');
      assert.equal(branchCalls.length, scenario.remoteHead ? 1 : 0);
      if (scenario.remoteHead) {
        assert.ok(
          vi
            .mocked(spawnSync)
            .mock.calls.some(
              ([command, args]) =>
                command === 'git' &&
                args.join(' ') === `fetch origin refs/heads/${branch}:refs/remotes/origin/${branch}`
            )
        );
      }
    }
    assert.equal(prompt.close.mock.calls.length, 1);
  } finally {
    process.argv = originalArgv;
    process.exitCode = originalExitCode;
    log.mockRestore();
    platformState.windows = false;
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  }
});

testEach(['release/review-base', null])(
  'review owns PR head/base selection with base %j',
  (baseBranch) => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 0,
      stdout: 'refs/remotes/origin/develop',
      stderr: '',
    });
    try {
      assert.deepEqual(
        resolveReviewBranchContext(
          {
            existingPrHeadRefName: 'feature/review-head',
            existingPrBaseRefName: baseBranch,
            existingPrNumber: 107,
          },
          '/tmp/project'
        ),
        {
          branchName: 'feature/review-head',
          baseBranch: baseBranch ?? 'develop',
          prNumber: 107,
        }
      );
      assert.equal(vi.mocked(spawnSync).mock.calls.length, baseBranch ? 0 : 1);
    } finally {
      vi.resetAllMocks();
    }
  }
);

test('npm scripts wire the dedicated launchers and both help paths are side-effect free', async () => {
  const metadata = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(metadata.scripts['start-review'], 'node scripts/start-review.mjs');
  assert.equal(metadata.scripts['start-work'], 'node scripts/start-work.mjs');
  const { main: startWork } = await import('./start-work.mjs');
  const originalArgv = process.argv;
  const output = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  try {
    process.argv = ['node', 'launcher', '--help'];
    await main();
    assert.match(output.mock.calls.at(-1)[0], /startreview\.prompt\.md/);
    await startWork();
    assert.match(output.mock.calls.at(-1)[0], /issue-specific worktree/);
    assert.doesNotMatch(output.mock.calls.at(-1)[0], /issue\/PR-specific/);
    assert.equal(vi.mocked(spawnSync).mock.calls.length, 0);
    assert.equal(vi.mocked(spawn).mock.calls.length, 0);
  } finally {
    process.argv = originalArgv;
    output.mockRestore();
    vi.resetAllMocks();
  }
});

testEach(['IS_113', '--pr', '0', '-1', '9007199254740992'])(
  'review CLI rejects invalid PR reference %s',
  async (reference) => {
    const originalArgv = process.argv;
    try {
      assert.throws(() => parseCliSelection([reference]), /Invalid PR reference/);
      process.argv = ['node', 'launcher', reference];
      await assert.rejects(main(), /Invalid PR reference/);
      assert.equal(vi.mocked(spawnSync).mock.calls.length, 0);
    } finally {
      process.argv = originalArgv;
      vi.resetAllMocks();
    }
  }
);

test('parseCliSelection accepts numeric and canonical PR references', () => {
  assert.equal(parseCliSelection(['107']), 107);
  assert.equal(parseCliSelection(['PR_108']), 108);
  assert.equal(parseCliSelection(['pr109']), 109);
});

test('issueIdFromBranch resolves linked issues from feat and squad branches', () => {
  assert.equal(issueIdFromBranch('feat/issue-103-arbeitsflow-optimieren'), 103);
  assert.equal(issueIdFromBranch('squad/42-fix-login-validation'), 42);
  assert.equal(issueIdFromBranch('feature/no-issue-here'), null);
});

test('resolveLinkedIssueId falls back to PR body closing keywords when branch names are not canonical', () => {
  assert.equal(resolveLinkedIssueId('feature/review-polish', 'Closes #103'), 103);
});

test('review allows a standalone PR and does not guess among multiple linked issues', () => {
  assert.equal(resolveLinkedIssueId('feature/standalone', ''), null);
  assert.equal(resolveLinkedIssueId('feature/standalone', 'Closes #103, fixes #104'), null);
  const context = resolveReviewContext(107, () => ({
    number: 107,
    title: 'Standalone',
    isDraft: false,
    headRefName: 'feature/standalone',
  }));
  assert.equal(context.issueId, null);
});

test('resolveReviewContext rejects draft pull requests before continuing', () => {
  assert.throws(
    () =>
      resolveReviewContext(107, () => ({
        title: 'Workflow review',
        number: 107,
        isDraft: true,
        headRefName: 'feat/issue-103-arbeitsflow-optimieren',
        baseRefName: 'main',
        body: 'Closes #103',
      })),
    /still a draft/
  );
});

test('resolveReviewContext returns the linked issue for ready pull requests', () => {
  const context = resolveReviewContext(107, () => ({
    title: 'Workflow review',
    number: 107,
    isDraft: false,
    headRefName: 'feat/issue-103-arbeitsflow-optimieren',
    baseRefName: 'main',
    body: 'Closes #103',
  }));

  assert.equal(context.issueId, 103);
  assert.equal(context.canonicalRefName, 'PR_107');
  assert.equal(context.existingPrHeadRefName, 'feat/issue-103-arbeitsflow-optimieren');
});

test('runStartReview does not assign or reassign the linked issue (#116)', async () => {
  const calls = [];

  await runStartReview({
    argv: ['107'],
    ensureProjectPropertyAccessFn: () => {
      calls.push('ensureProjectPropertyAccess');
    },
    getMainCheckoutPathFn: () => '/repo',
    createInterfaceFn: () => ({
      question: async () => '',
      close: () => {
        calls.push('prompt.close');
      },
    }),
    resolveReviewContextFn: () => {
      calls.push('resolveReviewContext');
      return {
        requestedType: 'pr',
        requestedId: 107,
        canonicalRefName: 'PR_107',
        issueId: 103,
        existingPrNumber: 107,
        existingPrHeadRefName: 'feat/issue-103-arbeitsflow-optimieren',
        existingPrBaseRefName: 'main',
      };
    },
    promptAdditionalPromptFn: async () => {
      calls.push('promptAdditionalPrompt');
      return null;
    },
    prepareReviewWorkContextFn: async () => {
      calls.push('prepareReviewWorkContext');
      return { tmuxAvailable: false, tmuxContext: null, worktreeContext: {}, portEnv: {} };
    },
    launchPreparedReviewFn: async () => {
      calls.push('launchPreparedReview');
    },
  });

  assert.deepEqual(calls, [
    'ensureProjectPropertyAccess',
    'resolveReviewContext',
    'promptAdditionalPrompt',
    'prepareReviewWorkContext',
    'prompt.close',
    'launchPreparedReview',
  ]);
  assert.ok(
    !calls.some((call) => /assign/i.test(call)),
    'start-review must not trigger any issue-assignment side effect'
  );
});

test('adoptLinkedIssueSession adopts the tmux session of the linked issue', () => {
  const ctx = { issueId: 152, requestedId: 170, tmuxSessionName: 'PR170' };
  const adopted = adoptLinkedIssueSession(ctx, {
    detect: () => ({ id: 152, sessionName: 'IS152' }),
    readJson: () => ({ number: 152 }),
  });
  assert.equal(adopted, true);
  assert.equal(ctx.tmuxSessionName, 'IS152');
});

test('adoptLinkedIssueSession keeps the PR session for other issues or missing issues', () => {
  const other = { issueId: 153, requestedId: 170, tmuxSessionName: 'PR170' };
  assert.equal(
    adoptLinkedIssueSession(other, {
      detect: () => ({ id: 152, sessionName: 'IS152' }),
      readJson: () => ({ number: 152 }),
    }),
    false
  );
  const missing = { issueId: 152, requestedId: 170, tmuxSessionName: 'PR170' };
  assert.equal(
    adoptLinkedIssueSession(missing, {
      detect: () => ({ id: 152, sessionName: 'IS152' }),
      readJson: () => {
        throw new Error('not found');
      },
    }),
    false
  );
  assert.equal(missing.tmuxSessionName, 'PR170');
  assert.equal(adoptLinkedIssueSession(missing, { detect: () => null }), false);
});

test('findReadyPrForIssueSession returns the single ready PR linked to the session issue', () => {
  const prs = [
    { number: 10, isDraft: true, headRefName: 'feat/issue-152-x', body: '' },
    { number: 11, isDraft: false, headRefName: 'feat/issue-152-x', body: '' },
    { number: 12, isDraft: false, headRefName: 'feat/issue-9-y', body: '' },
  ];
  const detected = { id: 152, sessionName: 'IS152' };
  assert.deepEqual(findReadyPrForIssueSession(detected, { readJson: () => prs }), {
    prId: 11,
    issueId: 152,
  });
  assert.equal(findReadyPrForIssueSession(null), null);
  assert.equal(
    findReadyPrForIssueSession(detected, { readJson: () => [...prs, { ...prs[1], number: 13 }] }),
    null
  );
});

test('exportTrustedReviewPrompt writes the origin/dev prompt and the launcher prompt points to it', () => {
  const calls = [];
  const ctx = { canonicalRefName: 'PR_999' };
  const target = exportTrustedReviewPrompt(ctx, '/repo', {
    run: (cmd, args) => {
      calls.push(args.join(' '));
      return { status: 0, stdout: '# prompt\n' };
    },
  });
  assert.match(target, /PR_999.startreview\.prompt\.md$/);
  assert.ok(calls.some((c) => c.startsWith('show origin/dev:')));
  const prompt = buildInitialCopilotPrompt(
    { reviewPromptPath: target, requestedId: 999, canonicalName: 'x', tmuxSessionName: 'IS1' },
    ''
  );
  assert.ok(prompt.startsWith(`Read ${target} and perform`));
  assert.equal(
    exportTrustedReviewPrompt(ctx, '/repo', { run: () => ({ status: 1, stdout: '' }) }),
    null
  );
});
