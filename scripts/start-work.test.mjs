import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

import { mockModule, testEach, vi } from './test-mock-support.mjs';

const spawn = vi.fn();
const spawnSync = vi.fn();
await mockModule('node:child_process', { spawn, spawnSync });

const existsSync = vi.fn();
const readFileSync = vi.fn();
const mkdirSync = vi.fn();
const writeFileSync = vi.fn();
await mockModule('node:fs', { existsSync, readFileSync, mkdirSync, writeFileSync });

const createInterface = vi.fn();
await mockModule('node:readline/promises', { createInterface });

// Pin the platform so the tmux flows behave identically on every host OS.
const platformState = { windows: false };
await mockModule('./platform-shared.mjs', {
  isWindows: () => platformState.windows,
  prepareSpawn: (command, args) => ({ command, args, options: {} }),
});

const {
  createPortEnvironment,
  ensureDevBaseBranchAvailable,
  ensureBranchReadyForWorktree,
  ensureDependenciesReady,
  loadProjectItemsViaGraphql,
  main,
  parseCanonicalRefToken,
  parseCliSelection,
  preflightStartWorkTarget,
  resolveBranchContext,
  resolveCurrentTmuxContext,
  resolveProjectStatus,
  runGateThenAssignAndResolveBranch,
  validateIssueStartGate,
} = await import('./start-work.mjs');

test('ensureDependenciesReady installs husky hooks when the worktree has none', () => {
  const worktree = resolve('/wt');
  const present = new Set([
    resolve(worktree, 'node_modules'),
    resolve(worktree, '.husky'),
    resolve(worktree, 'node_modules', 'husky', 'bin.js'),
  ]);
  existsSync.mockImplementation((path) => present.has(path));
  spawnSync.mockImplementation(() => {
    present.add(resolve(worktree, '.husky', '_', 'pre-commit'));
    return { status: 0, stdout: '', stderr: '' };
  });

  ensureDependenciesReady(resolve('/repo'), worktree);

  const huskyCall = spawnSync.mock.calls.find(([, args]) => args[0]?.endsWith('bin.js'));
  assert.ok(huskyCall, 'husky bin.js was run');
  assert.equal(huskyCall[2].cwd, worktree);
});

test('ensureDependenciesReady leaves existing husky hooks alone', () => {
  const worktree = resolve('/wt');
  const present = new Set([
    resolve(worktree, 'node_modules'),
    resolve(worktree, '.husky'),
    resolve(worktree, '.husky', '_', 'pre-commit'),
    resolve(worktree, 'node_modules', 'husky', 'bin.js'),
  ]);
  existsSync.mockImplementation((path) => present.has(path));
  spawnSync.mockClear();

  ensureDependenciesReady(resolve('/repo'), worktree);

  assert.equal(spawnSync.mock.calls.length, 0);
});

test('ensureDependenciesReady fails when husky does not produce the hooks', () => {
  const worktree = resolve('/wt');
  const present = new Set([
    resolve(worktree, 'node_modules'),
    resolve(worktree, '.husky'),
    resolve(worktree, 'node_modules', 'husky', 'bin.js'),
  ]);
  existsSync.mockImplementation((path) => present.has(path));
  spawnSync.mockImplementation(() => ({ status: 1, stdout: '', stderr: 'boom' }));

  assert.throws(
    () => ensureDependenciesReady(resolve('/repo'), worktree),
    /Failed to install husky git hooks/
  );
});

test('issue branch selection uses the issue slug and dev instead of the repository default branch', () => {
  vi.mocked(spawnSync).mockReturnValue({
    status: 0,
    stdout: 'refs/remotes/origin/develop',
    stderr: '',
  });
  try {
    assert.deepEqual(
      resolveBranchContext({ issueId: 113, branchSlug: 'refinement' }, '/tmp/project'),
      {
        branchName: 'feat/issue-113-refinement',
        baseBranch: 'dev',
        prNumber: null,
      }
    );
  } finally {
    vi.resetAllMocks();
  }
});

testEach([undefined, { createIfMissing: true }, { createIfMissing: false }])(
  'generic branch creation respects policy %j',
  (options) => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(spawnSync).mockImplementation((command, args) => ({
      status: args.includes('refs/remotes/origin/main') || args[0] === 'branch' ? 0 : 1,
      stdout: '',
      stderr: '',
    }));
    try {
      const prepare = () =>
        ensureBranchReadyForWorktree(
          '/tmp/project',
          { branchName: 'feature/new', baseBranch: 'main' },
          options
        );
      if (options?.createIfMissing === false) {
        assert.throws(prepare, /does not exist locally or on origin/);
        assert.equal(vi.mocked(spawnSync).mock.calls.length, 2);
      } else {
        prepare();
        assert.deepEqual(vi.mocked(spawnSync).mock.calls.at(-1)[1], [
          'branch',
          'feature/new',
          'refs/remotes/origin/main',
        ]);
      }
    } finally {
      log.mockRestore();
      vi.resetAllMocks();
    }
  }
);

testEach(['113-0', 'IS_113', 'issue113-work'])(
  'confirms related tmux session %s before renaming by stable ID',
  async (name) => {
    const prompt = { question: vi.fn().mockResolvedValue('yes') };
    const run = vi
      .fn()
      .mockReturnValueOnce({ status: 0, stdout: `$7\t${name}` })
      .mockReturnValueOnce({ status: 0, stdout: name })
      .mockReturnValueOnce({ status: 0, stdout: name })
      .mockReturnValueOnce({ status: 0, stdout: '' })
      .mockReturnValueOnce({ status: 0, stdout: '$7\tIS113' });
    assert.deepEqual(
      await resolveCurrentTmuxContext(true, 'IS113', { prompt, run, env: { TMUX: 'mock' } }),
      {
        isInsideTmux: true,
        currentSessionName: 'IS113',
        sessionId: '$7',
      }
    );
    assert.match(prompt.question.mock.calls[0][0], /Rename.*IS113.*\[y\/N\]/);
    assert.deepEqual(run.mock.calls[3][1], ['rename-session', '-t', '$7', 'IS113']);
  }
);

testEach(['no', '', 'maybe'])(
  'declining tmux rename with %j aborts without mutation',
  async (answer) => {
    const run = vi
      .fn()
      .mockReturnValueOnce({ status: 0, stdout: '$7\t113-0' })
      .mockReturnValueOnce({ status: 0, stdout: '113-0' });
    await assert.rejects(
      resolveCurrentTmuxContext(true, 'IS113', {
        run,
        env: { TMUX: 'mock' },
        prompt: { question: async () => answer },
      }),
      /rename declined/
    );
    assert.equal(run.mock.calls.length, 2);
  }
);

testEach(['1113', '1130', 'other', 'PR113'])(
  'rejects unrelated or PR tmux context %s without rename',
  async (name) => {
    const run = vi.fn().mockReturnValue({ status: 0, stdout: `$7\t${name}` });
    const prompt = { question: vi.fn() };
    if (name === 'PR113') {
      await assert.rejects(
        resolveCurrentTmuxContext(true, 'PR114', { run, prompt, env: { TMUX: 'mock' } }),
        /Invalid tmux state/
      );
    } else {
      await assert.rejects(
        resolveCurrentTmuxContext(true, 'IS113', { run, prompt, env: { TMUX: 'mock' } }),
        /Invalid tmux state/
      );
    }
    assert.equal(run.mock.calls.length, 1);
    assert.equal(prompt.question.mock.calls.length, 0);
  }
);

test('canonical tmux session needs no confirmation; outside/unavailable tmux needs no operations', async () => {
  const run = vi.fn().mockReturnValue({ status: 0, stdout: '$7\tIS113' });
  const prompt = { question: vi.fn() };
  await resolveCurrentTmuxContext(true, 'IS113', { run, prompt, env: { TMUX: 'mock' } });
  assert.equal(prompt.question.mock.calls.length, 0);
  run.mockClear();
  for (const [available, env] of [
    [false, { TMUX: 'mock' }],
    [true, {}],
  ]) {
    assert.deepEqual(await resolveCurrentTmuxContext(available, 'IS113', { run, prompt, env }), {
      isInsideTmux: false,
    });
  }
  assert.equal(run.mock.calls.length, 0);
});

test('tmux identity targets the invoking pane when available', async () => {
  const run = vi.fn().mockReturnValue({ status: 0, stdout: '$7\tIS113' });
  await resolveCurrentTmuxContext(true, 'IS113', {
    run,
    env: { TMUX: 'mock', TMUX_PANE: '%19' },
  });
  assert.deepEqual(run.mock.calls[0][1], [
    'display-message',
    '-p',
    '-t',
    '%19',
    '#{session_id}\t#{session_name}',
  ]);
});

testEach(['PR113', 'PR_113', 'pr-113'])(
  'does not rename PR context %s into an issue context',
  async (name) => {
    const run = vi.fn().mockReturnValue({ status: 0, stdout: `$7\t${name}` });
    const prompt = { question: vi.fn() };
    await assert.rejects(
      resolveCurrentTmuxContext(true, 'IS113', { run, prompt, env: { TMUX: 'mock' } }),
      /npm run start-review/
    );
    assert.equal(prompt.question.mock.calls.length, 0);
    assert.equal(run.mock.calls.length, 1);
  }
);

testEach([
  'collision',
  'raced collision',
  'rename failure',
  'verification failure',
  'identity failure',
  'list failure',
])('tmux %s stops safely', async (scenario) => {
  const run = vi
    .fn()
    .mockReturnValueOnce(
      scenario === 'identity failure'
        ? { status: 1, stderr: 'server unavailable' }
        : { status: 0, stdout: '$7\t113-0' }
    )
    .mockReturnValueOnce(
      scenario === 'list failure'
        ? { status: 1, stderr: 'list failed' }
        : { status: 0, stdout: scenario === 'collision' ? '113-0\nIS113' : '113-0' }
    )
    .mockReturnValueOnce({ status: 0, stdout: scenario === 'raced collision' ? 'IS113' : '113-0' })
    .mockReturnValueOnce(
      scenario === 'rename failure'
        ? { status: 1, stderr: 'rename failed' }
        : { status: 0, stdout: '' }
    )
    .mockReturnValueOnce({ status: 0, stdout: '$7\twrong' });
  await assert.rejects(
    resolveCurrentTmuxContext(true, 'IS113', {
      run,
      env: { TMUX: 'mock' },
      prompt: { question: async () => 'y' },
    }),
    /already exists|rename failed|verification failed|server unavailable|list failed/
  );
  if (scenario.includes('collision')) {
    assert.ok(run.mock.calls.every(([, args]) => args[0] !== 'rename-session'));
  }
});

test('main does not assign the selected issue when the issue gate fails', async () => {
  vi.stubEnv('TMUX', '');
  const originalArgv = process.argv;
  const prompt = {
    question: vi.fn().mockResolvedValueOnce('113'),
    close: vi.fn(),
  };
  vi.mocked(createInterface).mockReturnValue(prompt);
  vi.mocked(existsSync).mockReturnValue(false);
  vi.mocked(spawnSync).mockImplementation((command, args) => {
    const success = (payload = {}) => ({
      status: 0,
      stdout: JSON.stringify(payload),
      stderr: '',
    });
    if (command === 'git' && args.join(' ') === 'worktree list --porcelain') {
      return { status: 0, stdout: 'worktree /tmp/ExampleProject\n', stderr: '' };
    }
    if (command === 'gh') {
      if (args[0] === 'auth' || (args[0] === 'api' && args[1] === 'graphql')) {
        return success();
      }
      if (args.join(' ') === 'issue view 113 --json title') {
        return success({ title: '[BUG] Mission status differs' });
      }
      if (args.join(' ') === 'api user') {
        return success({ login: 'test-human' });
      }
      if (args.join(' ') === 'issue edit 113 --add-assignee test-human') {
        return success();
      }
      if (args.join(' ') === 'issue view 113 --json labels') {
        return success({ labels: [] });
      }
    }
    throw new Error(`Unexpected external operation: ${command} ${args.join(' ')}`);
  });
  const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

  try {
    process.argv = ['node', '/tmp/start-work.mjs'];
    await assert.rejects(() => main(), /go:yes/);
    assert.ok(
      vi
        .mocked(spawnSync)
        .mock.calls.some(
          ([command, args]) => command === 'gh' && args.join(' ') === 'issue view 113 --json labels'
        )
    );
    assert.equal(prompt.question.mock.calls.length, 1);
    assert.ok(
      vi
        .mocked(spawnSync)
        .mock.calls.every(([command, args]) => command !== 'gh' || !args.includes('edit'))
    );
    assert.equal(prompt.question.mock.calls[0][0], 'Enter the numeric issue ID: ');
    assert.equal(prompt.close.mock.calls.length, 1);
  } finally {
    process.argv = originalArgv;
    consoleLog.mockRestore();
    vi.resetAllMocks();
  }
});

testEach([
  { name: 'stops before every mutation when dev is unavailable', missingDev: true },
  { name: 'creates a branch, draft PR and worktree', create: true },
  { name: 'reuses a PR and worktree and deduplicates eligible reviewers' },
  { name: 'skips reviewers already requested', alreadyRequested: true },
  { name: 'skips when only the PR author is eligible', authorOnly: true },
  { name: 'skips when there are no Developer members', noDevelopers: true },
  { name: 'reuses a PR discovered after creation fails', create: true, racedPr: true },
  { name: 'preserves contextual failures for eligible Developers', reviewerFailure: true },
  { name: 'renames a related tmux session before preparing work', tmux: true },
  {
    name: 'stops on declined tmux rename before preparing work',
    tmux: true,
    tmuxFailure: 'declined',
  },
  {
    name: 'stops on canonical tmux collision before preparing work',
    tmux: true,
    tmuxFailure: 'collision',
  },
  { name: 'stops on tmux rename failure before preparing work', tmux: true, tmuxFailure: 'rename' },
  { name: 'skips tmux on Windows and runs Copilot in the foreground', windows: true },
])('main $name with external mutations mocked', async (scenario) => {
  const originalArgv = process.argv;
  const originalExitCode = process.exitCode;
  const repoRoot = join(import.meta.dirname, 'ExampleProject');
  const worktreePath = resolve(`${repoRoot}_IS_113`);
  platformState.windows = Boolean(scenario.windows);
  const branchName = 'feat/issue-113-mission-status-differs';
  const prUrl = 'https://github.com/example/project/pull/114';
  const prompt = {
    question: vi.fn(async (message) =>
      message.startsWith('Rename') ? (scenario.tmuxFailure === 'declined' ? 'no' : 'yes') : '1'
    ),
    close: vi.fn(),
  };
  const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
  let localBranchReady = !scenario.create;
  let worktreeReady = !scenario.create;
  let prReady = !scenario.create;
  let sessionName = '113-0';
  const success = (stdout = '') => ({ status: 0, stdout, stderr: '' });
  const json = (payload) => success(JSON.stringify(payload));
  const teamMarkdown = `
## Human Members
| Name | Nicknames | Role | Language | Badge |
|------|-----------|------|----------|-------|
| David Koenig | Dave | ${scenario.noDevelopers ? 'Non-Developer' : 'Techlead / Developer'} | German (de) | Human |
| Felix Bajus | | ${scenario.noDevelopers || scenario.authorOnly ? 'Non-Developer' : 'Developer'} | German (de) | Human |
| Felix Bajus | | ${scenario.noDevelopers || scenario.authorOnly ? 'Projektleiter' : 'Developer'} | German (de) | Human |
| Oliver Davies | | Projektleiter | German (de) | Human |
| Benjamin Janisch | | Projektleiter (Vertrieb) | German (de) | Human |
`;

  vi.stubEnv('GITHUB_REPOSITORY', '');
  vi.stubEnv('TMUX', scenario.tmux ? 'mock' : '');
  vi.mocked(createInterface).mockReturnValue(prompt);
  vi.mocked(existsSync).mockImplementation((path) =>
    path === worktreePath ? worktreeReady : /node_modules|startwork\.prompt\.md$/.test(path)
  );
  vi.mocked(readFileSync).mockImplementation((path) => {
    assert.equal(path, join(repoRoot, '.squad', 'team.md'));
    return teamMarkdown;
  });
  vi.mocked(spawn).mockImplementation(() => ({
    once(event, callback) {
      if (event === 'exit') {
        queueMicrotask(() => callback(0));
      }
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
    if (command === 'git') {
      if (args.includes('--show-toplevel')) return success(worktreePath);
      if (args.includes('--git-common-dir')) return success(join(repoRoot, '.git'));
      if (args.includes('--is-inside-work-tree')) return success('true');
      if (operation === 'worktree list --porcelain') {
        return success(
          `worktree ${repoRoot}\nbranch refs/heads/main\n\n` +
            (worktreeReady ? `worktree ${worktreePath}\nbranch refs/heads/${branchName}\n` : '')
        );
      }
      if (operation === 'symbolic-ref refs/remotes/origin/HEAD') {
        return success('refs/remotes/origin/main');
      }
      if (args[0] === 'rev-parse' && args[1] === '--verify') {
        return {
          status:
            (scenario.missingDev && args.at(-1).endsWith('/dev')) ||
            (args.at(-1).endsWith(branchName) && !localBranchReady)
              ? 1
              : 0,
          stdout: '',
          stderr: '',
        };
      }
      if (args[0] === 'ls-remote') {
        return { status: 2, stdout: '', stderr: '' };
      }
      if (operation === 'fetch origin dev') {
        return success();
      }
      if (operation === `branch ${branchName} refs/remotes/origin/dev`) {
        localBranchReady = true;
        return success();
      }
      if (args[0] === 'rev-list') {
        return success('1');
      }
      if (args[0] === 'push' && scenario.create) {
        return success();
      }
      if (operation === `worktree add --force ${worktreePath} ${branchName}`) {
        worktreeReady = true;
        return success();
      }
      if (operation === 'rev-parse --abbrev-ref HEAD') {
        return success(branchName);
      }
    }
    if (command === 'gh') {
      if (args[0] === 'auth') {
        return success();
      }
      if (operation === 'issue view 113 --json title') {
        return json({ title: '[BUG] Mission status differs' });
      }
      if (operation === 'api user') {
        return json({ login: 'david-koenig_example', name: 'David Koenig' });
      }
      if (operation === 'issue edit 113 --add-assignee david-koenig_example') {
        return success();
      }
      if (operation === 'issue view 113 --json labels') {
        return json({ labels: [{ name: 'go:yes' }, { name: 'squad:nick' }] });
      }
      if (operation === 'repo view --json owner,name') {
        return json({ owner: { login: 'example' }, name: 'project' });
      }
      if (args[0] === 'api' && args[1] === 'graphql') {
        if (args.some((arg) => arg.startsWith('searchQuery='))) {
          assert.ok(args.includes('searchQuery="Felix Bajus" in:fullname'));
          return json({
            data: { search: { nodes: [{ login: 'felix-bajus_example', name: 'Felix Bajus' }] } },
          });
        }
        return json({
          data: {
            repository: {
              issue: {
                projectItems: { nodes: [{ fieldValueByName: { name: 'Ready to Implement' } }] },
              },
            },
          },
        });
      }
      if (args[0] === 'pr' && args[1] === 'list') {
        assert.ok(args.includes('number,url,isDraft,headRefName,baseRefName,title'));
        return json(
          prReady
            ? [
                {
                  number: 114,
                  url: prUrl,
                  headRefName: branchName,
                  isDraft: Boolean(scenario.create),
                },
              ]
            : []
        );
      }
      if (args[0] === 'pr' && args[1] === 'create') {
        assert.ok(args.includes('--draft'));
        assert.equal(args[args.indexOf('--base') + 1], 'dev');
        prReady = true;
        return scenario.racedPr
          ? { status: 1, stdout: '', stderr: 'PR already exists' }
          : success(prUrl);
      }
      if (operation === 'pr view 114 --json author,reviewRequests') {
        return json({
          author: { login: 'david-koenig_example' },
          reviewRequests: scenario.alreadyRequested ? [{ login: 'felix-bajus_example' }] : [],
        });
      }
      if (args[1] === 'repos/{owner}/{repo}/pulls/114/requested_reviewers') {
        assert.deepEqual(args.slice(2), [
          '--method',
          'POST',
          '--raw-field',
          'reviewers[]=felix-bajus_example',
        ]);
        return scenario.reviewerFailure
          ? {
              status: 1,
              stdout: '',
              stderr: 'Reviews may only be requested from collaborators (HTTP 422)',
            }
          : json({});
      }
    }
    if (command === 'sh' && operation === '-lc command -v tmux') {
      assert.ok(!scenario.windows, 'tmux must not be probed on Windows');
      return { status: scenario.tmux ? 0 : 1, stdout: '', stderr: '' };
    }
    if (command === 'tmux' && scenario.tmux) {
      if (args[0] === 'display-message') {
        return success(`$7\t${sessionName}`);
      }
      if (args[0] === 'list-sessions') {
        return success(scenario.tmuxFailure === 'collision' ? '113-0\nIS113' : sessionName);
      }
      if (args[0] === 'rename-session') {
        assert.deepEqual(args, ['rename-session', '-t', '$7', 'IS113']);
        if (scenario.tmuxFailure === 'rename') {
          return { status: 1, stdout: '', stderr: 'rename blocked' };
        }
        sessionName = 'IS113';
        return success();
      }
      if (
        args[0] === '-V' ||
        args[0] === 'set-option' ||
        args[0] === 'set-environment' ||
        args[0] === 'select-window'
      ) {
        return success();
      }
      if (args[0] === 'new-window') {
        return success('9');
      }
    }
    throw new Error(`Unexpected external operation: ${command} ${operation}`);
  });

  try {
    process.argv = ['node', '/tmp/start-work.mjs', 'IS_113'];
    if (scenario.missingDev) {
      await assert.rejects(main(), /Dev-first policy violation/);
      assert.equal(vi.mocked(spawn).mock.calls.length, 0);
      assert.ok(
        vi
          .mocked(spawnSync)
          .mock.calls.every(([command, args]) =>
            command === 'git'
              ? ['rev-parse', 'ls-remote', 'worktree'].includes(args[0]) &&
                (args[0] !== 'worktree' || args[1] === 'list')
              : command === 'gh' && !args.includes('edit') && args[0] !== 'pr'
          )
      );
      assert.equal(prompt.close.mock.calls.length, 1);
      return;
    }
    if (scenario.tmuxFailure) {
      await assert.rejects(main(), /rename declined|already exists|rename blocked/);
      assert.equal(vi.mocked(spawn).mock.calls.length, 0);
      assert.ok(
        vi
          .mocked(spawnSync)
          .mock.calls.every(
            ([command, args]) =>
              command !== 'git' ||
              ['rev-parse', 'ls-remote'].includes(args[0]) ||
              args.join(' ') === 'worktree list --porcelain'
          )
      );
      assert.ok(
        vi
          .mocked(spawnSync)
          .mock.calls.every(([command, args]) => command !== 'gh' || args[0] !== 'pr')
      );
      return;
    }
    if (scenario.reviewerFailure) {
      await assert.rejects(
        () => main(),
        /Failed to request reviewer "felix-bajus_example" on PR #114.*HTTP 422/
      );
      assert.equal(vi.mocked(spawn).mock.calls.length, 0);
      assert.ok(
        !consoleLog.mock.calls.some(([message]) => message.includes('Reviewer requests completed'))
      );
      return;
    }
    await main();
    const messages = consoleLog.mock.calls.map(([message]) => message);
    assert.ok(messages.some((message) => /markieren → Rechtsklick.*Alt\+Ziehen/.test(message)));
    for (const message of [
      'Checking GitHub authentication and project access...',
      'GitHub authentication and project access verified.',
      'Selected issue #113: [BUG] Mission status differs',
      'Issue #113 assigned to david-koenig_example.',
      'Issue #113: project status is "Ready to Implement".',
      'Issue #113: start gates passed.',
      'Checking Developer reviewers for PR #114...',
      'Workflow prompt and dependencies ready.',
      scenario.tmux
        ? 'Starting Copilot window in tmux session IS113...'
        : `Starting Copilot in ${worktreePath} (tmux unavailable)...`,
    ]) {
      assert.ok(messages.includes(message), `Missing progress: ${message}`);
    }
    assert.ok(
      messages.includes(
        scenario.create && !scenario.racedPr
          ? `Draft PR #114 created: ${prUrl}`
          : `Reusing ${scenario.racedPr ? 'draft PR' : 'PR'} #114: ${prUrl}`
      )
    );
    assert.ok(
      messages.includes(
        scenario.create ? `Worktree ${worktreePath} created.` : `Reusing worktree ${worktreePath}.`
      )
    );
    assert.ok(
      messages.includes(
        scenario.create
          ? `Local branch ${branchName} created.`
          : `Reusing local branch ${branchName}.`
      )
    );
    const reviewerCalls = vi
      .mocked(spawnSync)
      .mock.calls.filter(
        ([command, args]) => command === 'gh' && args[1]?.endsWith('/requested_reviewers')
      );
    const skipReviewers = scenario.alreadyRequested || scenario.noDevelopers || scenario.authorOnly;
    assert.equal(reviewerCalls.length, skipReviewers ? 0 : 1);
    assert.ok(
      messages.some((message) =>
        message.startsWith(
          skipReviewers
            ? 'Skipping reviewer requests for PR #114:'
            : 'Reviewer requests completed for PR #114.'
        )
      )
    );
    if (scenario.tmux) {
      const calls = vi.mocked(spawnSync).mock.calls;
      const renamedAt = calls.findIndex(
        ([command, args]) => command === 'tmux' && args[0] === 'rename-session'
      );
      const branchAt = calls.findIndex(([command, args]) => command === 'gh' && args[0] === 'pr');
      assert.ok(renamedAt >= 0 && renamedAt < branchAt);
      assert.equal(vi.mocked(spawn).mock.calls.length, 0);
      assert.ok(
        calls.every(
          ([command, args]) =>
            command !== 'tmux' ||
            !['new-session', 'attach-session', 'kill-session', 'switch-client'].includes(args[0])
        )
      );
    } else {
      assert.equal(vi.mocked(spawn).mock.calls.length, 1);
      assert.equal(vi.mocked(spawn).mock.calls[0][0], 'copilot');
      assert.equal(vi.mocked(spawn).mock.calls[0][2].cwd, worktreePath);
      assert.match(vi.mocked(spawn).mock.calls[0][1].at(-1), /startwork\.prompt\.md/);
      assert.match(vi.mocked(spawn).mock.calls[0][1].at(-1), /work_ref: IS_113/);
      assert.doesNotMatch(vi.mocked(spawn).mock.calls[0][1].at(-1), /startreview\.prompt\.md/);
    }
    assert.equal(prompt.close.mock.calls.length, 1);
  } finally {
    process.argv = originalArgv;
    process.exitCode = originalExitCode;
    consoleLog.mockRestore();
    platformState.windows = false;
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  }
});

test('preflightStartWorkTarget refuses PR-only contexts regardless of worktree existence', () => {
  assert.throws(
    () =>
      preflightStartWorkTarget(
        {
          requestedType: 'pr',
          canonicalName: 'ExampleProject_PR_622',
          existingPrHeadRefName: 'squad/621-chore',
        },
        '/tmp/ExampleProject',
        { pathExists: () => false }
      ),
    /npm run start-review/
  );
});

test('preflightStartWorkTarget refuses a PR even when the worktree branch identifies an issue', () => {
  assert.throws(
    () =>
      preflightStartWorkTarget(
        {
          requestedType: 'pr',
          canonicalName: 'ExampleProject_PR_622',
          existingPrHeadRefName: 'squad/621-chore',
        },
        '/tmp/ExampleProject',
        { pathExists: () => true, resolveBranch: () => 'squad/621-chore' }
      ),
    /npm run start-review/
  );
});

test('preflightStartWorkTarget rejects a PR whose existing worktree branch does not match', () => {
  assert.throws(
    () =>
      preflightStartWorkTarget(
        {
          requestedType: 'pr',
          canonicalName: 'ExampleProject_PR_622',
          existingPrHeadRefName: 'squad/621-chore',
        },
        '/tmp/ExampleProject',
        { pathExists: () => true, resolveBranch: () => 'feat/pr-622' }
      ),
    /npm run start-review/
  );
});

test('preflightStartWorkTarget returns the issue context unchanged when there is no existing worktree', () => {
  const issueContext = {
    requestedType: 'issue',
    canonicalName: 'ExampleProject_IS_621',
    issueId: 621,
  };
  assert.equal(
    preflightStartWorkTarget(issueContext, '/tmp/ExampleProject', { pathExists: () => false }),
    issueContext
  );
});

test('parseCanonicalRefToken accepts only issue single-token CLI refs case-insensitively', () => {
  assert.deepEqual(parseCanonicalRefToken('IS_480'), { workType: 'issue', requestedId: 480 });
  assert.deepEqual(parseCanonicalRefToken('is-481'), { workType: 'issue', requestedId: 481 });
  assert.deepEqual(parseCanonicalRefToken('IS482'), { workType: 'issue', requestedId: 482 });
  assert.throws(() => parseCanonicalRefToken('pr_483'), /npm run start-review/);
});

testEach([['PR113'], ['PR_113'], ['pr-113'], ['--pr', '113'], ['--pr=113']])(
  'issue CLI rejects PR target %j before external calls',
  async (...argv) => {
    const originalArgv = process.argv;
    try {
      assert.throws(() => parseCliSelection(argv), /npm run start-review/);
      process.argv = ['node', '/tmp/start-work.mjs', ...argv];
      await assert.rejects(main(), /npm run start-review/);
      assert.equal(vi.mocked(spawnSync).mock.calls.length, 0);
    } finally {
      process.argv = originalArgv;
      vi.resetAllMocks();
    }
  }
);

test('parseCanonicalRefToken rejects bare or non-canonical CLI refs', () => {
  assert.equal(parseCanonicalRefToken('480'), null);
  assert.equal(parseCanonicalRefToken('#480'), null);
  assert.equal(parseCanonicalRefToken('issue_480'), null);
});

test('createPortEnvironment hashes the full canonical name, not only the numeric id', () => {
  const issuePorts = createPortEnvironment('ExampleProject_IS_480');
  const prPorts = createPortEnvironment('ExampleProject_PR_480');

  assert.notDeepEqual(issuePorts, prPorts);
  assert.deepEqual(issuePorts, createPortEnvironment('ExampleProject_IS_480'));
});

test('loadProjectItemsViaGraphql returns GraphQL project items and targets the resolved host', () => {
  let receivedArgs = null;
  const projectItems = loadProjectItemsViaGraphql(
    { issueId: 623 },
    {
      repositoryContext: {
        owner: 'ExampleProject',
        repo: 'ExampleProject',
        repository: 'ExampleProject/ExampleProject',
        host: 'bmw.ghe.com',
      },
      readGhJson(args) {
        receivedArgs = args;
        return {
          data: {
            repository: {
              issue: {
                projectItems: {
                  nodes: [{ id: 'ITEM_1', fieldValueByName: { name: 'Ready to Implement' } }],
                },
              },
            },
          },
        };
      },
    }
  );

  assert.deepEqual(projectItems, [
    { id: 'ITEM_1', fieldValueByName: { name: 'Ready to Implement' } },
  ]);
  assert.deepEqual(receivedArgs.slice(0, 3), ['api', 'graphql', '-f']);
  assert.match(receivedArgs[3], /query StartWorkIssueProjectItems/);
  assert.ok(receivedArgs.includes('owner=ExampleProject'));
  assert.ok(receivedArgs.includes('repo=ExampleProject'));
  assert.ok(receivedArgs.includes('number=623'));
  assert.deepEqual(receivedArgs.slice(-2), ['--hostname', 'bmw.ghe.com']);
});

test('resolveProjectStatus reads the GraphQL fieldValueByName status shape', () => {
  assert.equal(
    resolveProjectStatus([{ fieldValueByName: { name: 'Ready to Implement' } }]),
    'Ready to Implement'
  );
});

test('validateIssueStartGate resolves project status via GraphQL without prompting the user', async () => {
  const calls = [];
  const messages = [];

  await assert.doesNotReject(() =>
    validateIssueStartGate({ requestedType: 'issue', issueId: 623 }, null, {
      readGhJson(args) {
        calls.push(args);
        if (args[0] === 'issue' && args[1] === 'view') {
          return { labels: [{ name: 'go:yes' }, { name: 'squad:backend' }] };
        }

        if (args[0] === 'repo' && args[1] === 'view') {
          return { owner: { login: 'ExampleProject' }, name: 'ExampleProject' };
        }

        if (args[0] === 'api' && args[1] === 'graphql') {
          return {
            data: {
              repository: {
                issue: {
                  projectItems: {
                    nodes: [{ fieldValueByName: { name: 'Ready to Implement' } }],
                  },
                },
              },
            },
          };
        }

        throw new Error(`Unexpected gh call: ${args.join(' ')}`);
      },
      log(message) {
        messages.push(message);
      },
    })
  );

  assert.equal(calls.length, 3);
  assert.deepEqual(calls[0], ['issue', 'view', '623', '--json', 'labels']);
  assert.deepEqual(calls[1], ['repo', 'view', '--json', 'owner,name']);
  assert.deepEqual(calls[2].slice(0, 3), ['api', 'graphql', '-f']);
  assert.deepEqual(messages, [
    'Checking issue #623 go and squad gates...',
    'Issue #623: go:yes and squad gates passed; checking project status...',
    'Issue #623: project status is "Ready to Implement".',
    'Issue #623: start gates passed.',
  ]);
});

test('validateIssueStartGate falls back to interactive confirmation when GraphQL is unavailable', async () => {
  const messages = [];
  let promptCalled = false;
  const fakePrompt = {
    async question() {
      promptCalled = true;
      return '1';
    },
  };

  await assert.doesNotReject(() =>
    validateIssueStartGate({ requestedType: 'issue', issueId: 623 }, fakePrompt, {
      readGhJson(args) {
        if (args[0] === 'issue' && args[1] === 'view') {
          return { labels: [{ name: 'go:yes' }, { name: 'squad:backend' }] };
        }

        throw new Error('GraphQL permissions missing');
      },
      log(message) {
        messages.push(message);
      },
    })
  );

  assert.equal(promptCalled, true);
  assert.equal(messages.length, 4);
  assert.match(messages[2], /project status could not be verified/);
  assert.match(messages[3], /passed with human project-status confirmation/);
});

test('validateIssueStartGate rejects a status outside the accepted set', async () => {
  await assert.rejects(
    () =>
      validateIssueStartGate({ requestedType: 'issue', issueId: 623 }, null, {
        readGhJson(args) {
          if (args[0] === 'issue' && args[1] === 'view') {
            return { labels: [{ name: 'go:yes' }, { name: 'squad:backend' }] };
          }

          if (args[0] === 'repo' && args[1] === 'view') {
            return { owner: { login: 'ExampleProject' }, name: 'ExampleProject' };
          }

          return {
            data: {
              repository: {
                issue: { projectItems: { nodes: [{ fieldValueByName: { name: 'Backlog' } }] } },
              },
            },
          };
        },
      }),
    /project status is "Backlog"/
  );
});

test('runGateThenAssignAndResolveBranch assigns and resolves the branch only after the gate succeeds', async () => {
  const calls = [];
  const issueContext = { requestedType: 'issue', issueId: 623 };
  const repoRoot = '/repo';

  const result = await runGateThenAssignAndResolveBranch(issueContext, repoRoot, null, {
    validateGate: async (ctx, prompt) => {
      calls.push(['validateGate', ctx, prompt]);
    },
    assign: (ctx) => {
      calls.push(['assign', ctx]);
    },
    resolveBranch: (ctx, root) => {
      calls.push(['resolveBranch', ctx, root]);
      return { branchName: 'feat/issue-623-example', baseBranch: 'dev', prNumber: null };
    },
  });

  assert.deepEqual(
    calls.map((call) => call[0]),
    ['validateGate', 'resolveBranch', 'assign']
  );
  assert.deepEqual(result, {
    branchName: 'feat/issue-623-example',
    baseBranch: 'dev',
    prNumber: null,
  });
});

test('runGateThenAssignAndResolveBranch does not assign when dev is unavailable', async () => {
  const calls = [];
  await assert.rejects(
    () =>
      runGateThenAssignAndResolveBranch({ requestedType: 'issue', issueId: 623 }, '/repo', null, {
        validateGate: async () => calls.push('gate'),
        resolveBranch: (context, root) => {
          calls.push('dev');
          return resolveBranchContext(context, root, {
            ensureDevBaseAvailable: () => {
              throw new Error('Dev-first policy violation: base branch "dev" is unavailable');
            },
          });
        },
        assign: () => calls.push('assign'),
      }),
    /Dev-first policy violation/
  );
  assert.deepEqual(calls, ['gate', 'dev']);
});

test('runGateThenAssignAndResolveBranch causes no assignment or branch resolution when the gate fails', async () => {
  const calls = [];
  const issueContext = { requestedType: 'issue', issueId: 623 };

  await assert.rejects(
    () =>
      runGateThenAssignAndResolveBranch(issueContext, '/repo', null, {
        validateGate: async () => {
          throw new Error('project status is "Backlog"');
        },
        assign: (ctx) => {
          calls.push(['assign', ctx]);
        },
        resolveBranch: (ctx, root) => {
          calls.push(['resolveBranch', ctx, root]);
          return { branchName: 'should-not-be-created', baseBranch: 'dev', prNumber: null };
        },
      }),
    /project status is "Backlog"/
  );

  assert.deepEqual(calls, [], 'no assignment or branch/PR/worktree side effect must occur');
});

test('resolveBranchContext hardcodes "dev" as the base branch for new feature branches', () => {
  const ensureCalls = [];
  const branchContext = resolveBranchContext(
    { requestedType: 'issue', issueId: 623, branchSlug: 'example-feature' },
    '/repo',
    {
      ensureDevBaseAvailable: (repoRoot, baseBranch) => {
        ensureCalls.push([repoRoot, baseBranch]);
      },
    }
  );

  assert.deepEqual(branchContext, {
    branchName: 'feat/issue-623-example-feature',
    baseBranch: 'dev',
    prNumber: null,
  });
  assert.deepEqual(ensureCalls, [['/repo', 'dev']]);
});

test('resolveBranchContext fails closed before any side effect when "dev" is unavailable', () => {
  assert.throws(
    () =>
      resolveBranchContext(
        { requestedType: 'issue', issueId: 623, branchSlug: 'example-feature' },
        '/repo',
        {
          ensureDevBaseAvailable: () => {
            throw new Error('Dev-first policy violation: base branch "dev" is unavailable');
          },
        }
      ),
    /Dev-first policy violation/
  );
});

test('resolveBranchContext keeps using the existing PR baseRefName for PR-mode review (unaffected by dev-first policy)', () => {
  const branchContext = resolveBranchContext(
    {
      requestedType: 'pr',
      existingPrHeadRefName: 'squad/621-chore',
      existingPrBaseRefName: 'main',
      existingPrNumber: 621,
    },
    '/repo'
  );

  assert.equal(branchContext.baseBranch, 'main');
});

test('ensureDevBaseBranchAvailable throws a clear, fail-closed error when "dev" cannot be resolved locally or on origin', () => {
  assert.throws(
    () =>
      ensureDevBaseBranchAvailable('/repo', 'dev', {
        resolveRef: () => {
          throw new Error('Could not resolve the default/base branch "dev" locally or on origin.');
        },
      }),
    /Dev-first policy violation.*unavailable locally and on origin/s
  );
});

test('ensureDevBaseBranchAvailable succeeds silently when "dev" resolves', () => {
  assert.doesNotThrow(() =>
    ensureDevBaseBranchAvailable('/repo', 'dev', {
      resolveRef: () => 'refs/remotes/origin/dev',
    })
  );
});

test('validateIssueStartGate requires an implementer label beyond squad:tony and squad:pepper', async () => {
  await assert.rejects(
    () =>
      validateIssueStartGate({ requestedType: 'issue', issueId: 152 }, null, {
        readGhJson() {
          return {
            labels: [
              { name: 'go:yes' },
              { name: 'squad' },
              { name: 'squad:tony' },
              { name: 'squad:pepper' },
            ],
          };
        },
        log() {},
      }),
    /missing implementer squad:\* label/
  );
});
