import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { after, describe, test } from 'node:test';
import { testEach, vi } from './test-mock-support.mjs';

import {
  buildCopilotArgs,
  buildCopilotChildEnv,
  buildCopilotShellCommand,
  buildTmuxSessionName,
  detectIdFromTmuxSession,
  ensureProjectPropertyAccess,
  ensureTmuxSessionAvailable,
  launchInNewTmuxSession,
  parseFlowFlags,
  parseHumanMembers,
  reportCopilotLaunchPlan,
  requestPullRequestReviewers,
  resolveAdditionalPrompt,
  resolveIssueWorktreePath,
  resolveHumanReviewerLogins,
  trustCopilotFolder,
  trustWorktreeFolder,
} from './flow-shared.mjs';

test('resolveIssueWorktreePath keeps the canonical sibling path when its parent is writable', () => {
  assert.equal(
    resolveIssueWorktreePath('/workspaces/site', 'site_IS_78', {
      canWriteDirectoryFn: () => true,
      homeDirectory: '/home/node',
    }),
    resolve('/workspaces/site_IS_78')
  );
});

test('resolveIssueWorktreePath uses a stable per-checkout home path when the parent is not writable', () => {
  const options = {
    canWriteDirectoryFn: () => false,
    homeDirectory: '/home/node',
  };
  const worktreePath = resolveIssueWorktreePath('/workspaces/site', 'site_IS_78', options);

  const expectedPrefix = resolve('/home/node', '.cache', 'flow-worktrees');
  assert.ok(worktreePath.startsWith(expectedPrefix));
  assert.match(worktreePath.slice(expectedPrefix.length), /^[\\/][a-f0-9]{12}[\\/]site_IS_78$/);
  assert.equal(resolveIssueWorktreePath('/workspaces/site', 'site_IS_78', options), worktreePath);
  assert.notEqual(resolveIssueWorktreePath('/other/site', 'site_IS_78', options), worktreePath);
});

test('resolveIssueWorktreePath propagates unexpected checkout-parent filesystem errors', () => {
  assert.throws(() => resolveIssueWorktreePath('/path-that-does-not-exist/site', 'site_IS_78'), {
    code: 'ENOENT',
  });
});

test('requestPullRequestReviewers uses repository-scoped REST POST with string array fields', () => {
  const calls = [];
  const reviewers = ['felix-bajus_example', '123'];

  requestPullRequestReviewers(
    (command, args, options) => {
      calls.push({ command, args, options });
      return { status: 0, stdout: '{}', stderr: '' };
    },
    114,
    reviewers
  );

  assert.deepEqual(
    calls,
    reviewers.map((reviewer) => ({
      command: 'gh',
      args: [
        'api',
        'repos/{owner}/{repo}/pulls/114/requested_reviewers',
        '--method',
        'POST',
        '--raw-field',
        `reviewers[]=${reviewer}`,
      ],
      options: {
        allowFailure: true,
        description: `requesting reviewer ${reviewer} on PR #114`,
      },
    }))
  );
});

test('requestPullRequestReviewers does not invoke gh for an empty reviewer list', () => {
  requestPullRequestReviewers(() => assert.fail('Unexpected reviewer request'), 114, []);
});

test('requestPullRequestReviewers tolerates existing requests and continues to the next reviewer', () => {
  for (const details of [
    'already requested',
    'is already a reviewer',
    'review request already exists',
  ]) {
    const calls = [];
    requestPullRequestReviewers(
      (_command, args) => {
        calls.push(args);
        return calls.length === 1
          ? { status: 1, stdout: '', stderr: details }
          : { status: 0, stdout: '{}', stderr: '' };
      },
      114,
      ['existing-reviewer', 'next-reviewer']
    );
    assert.equal(calls.length, 2);
    assert.equal(calls[1].at(-1), 'reviewers[]=next-reviewer');
  }
});

test('requestPullRequestReviewers reports API failures with context and stops requesting reviewers', () => {
  for (const result of [
    { status: 1, stdout: '', stderr: 'gh: Resource not accessible (HTTP 403)' },
    { status: 1, stdout: '{"message":"Validation Failed"}', stderr: 'gh: HTTP 422' },
  ]) {
    let calls = 0;
    assert.throws(
      () =>
        requestPullRequestReviewers(
          () => {
            calls += 1;
            return result;
          },
          114,
          ['felix-bajus_example', 'next-reviewer']
        ),
      {
        message: `Failed to request reviewer "felix-bajus_example" on PR #114. ${[
          result.stderr,
          result.stdout,
        ]
          .filter(Boolean)
          .join(' ')}`,
      }
    );
    assert.equal(calls, 1);
  }
});

test('buildTmuxSessionName shortens canonical refs for tmux sessions', () => {
  assert.equal(buildTmuxSessionName('IS_103'), 'IS103');
  assert.equal(buildTmuxSessionName('PR_107'), 'PR107');
});

test('parseHumanMembers reads the Human Members table from team markdown', () => {
  const members = parseHumanMembers(`
## Human Members

| Name | Nicknames | Role | Language | Badge |
|------|-----------|------|----------|-------|
| David Koenig | Frickeldave, Dave | Techlead / Developer | German (de) | 👤 Human |
| Felix Bajus | | Developer | German (de) | 👤 Human |

## Other
`);

  assert.deepEqual(members, [
    {
      name: 'David Koenig',
      nicknames: ['Frickeldave', 'Dave'],
      role: 'Techlead / Developer',
      language: 'German (de)',
      github: '',
    },
    {
      name: 'Felix Bajus',
      nicknames: [],
      role: 'Developer',
      language: 'German (de)',
      github: '',
    },
  ]);
});

test('parseHumanMembers reads the optional GitHub column by header', () => {
  const members = parseHumanMembers(`
## Human Members

| Name | Nicknames | Role | Language | Badge | GitHub |
|------|-----------|------|----------|-------|--------|
| David Koenig | Dave | Techlead / Developer | German (de) | 👤 Human | @david-koenig_example |
| Oliver Davies | | Projektleiter | German (de) | 👤 Human | |
`);

  assert.deepEqual(
    members.map((member) => member.github),
    ['david-koenig_example', '']
  );
});

test('parseHumanMembers accepts the German heading and resolves columns from the header', () => {
  const members = parseHumanMembers(`
## Mitglieder

| Name | Rolle | Charter | Status |
|------|-------|---------|--------|
| Tony | Lead | .squad/agents/tony/charter.md | ✅ Aktiv |

## Menschliche Mitglieder

| Rolle | Name | GitHub | Spitznamen | Sprache |
|-------|------|--------|------------|---------|
| Techlead / Developer | David Koenig | Frickeldave | Frickeldave, Dave | German (de) |

## Developer SSH Keys
`);

  assert.deepEqual(members, [
    {
      name: 'David Koenig',
      nicknames: ['Frickeldave', 'Dave'],
      role: 'Techlead / Developer',
      language: 'German (de)',
      github: 'Frickeldave',
    },
  ]);
});

test('parseHumanMembers does not read the agent roster when no human heading exists', () => {
  assert.deepEqual(
    parseHumanMembers(`
## Mitglieder

| Name | Rolle | Charter | Status |
|------|-------|---------|--------|
| Tony | Lead | .squad/agents/tony/charter.md | ✅ Aktiv |
`),
    []
  );
});

test('ensureProjectPropertyAccess instructs gh auth refresh when read:project is missing', () => {
  let calls = 0;

  assert.throws(
    () =>
      ensureProjectPropertyAccess((_command, args) => {
        calls += 1;
        if (args[0] === 'auth') {
          return { status: 0, stdout: 'ok', stderr: '' };
        }

        return {
          status: 1,
          stdout: '',
          stderr:
            "Your token has not been granted the required scopes to execute this query. The 'projectV2' field requires one of the following scopes: ['read:project'].",
        };
      }),
    /gh auth refresh -s read:project/
  );

  assert.equal(calls, 2);
});

test('resolveHumanReviewerLogins resolves current and searched human reviewers', () => {
  const calls = [];
  const teamMarkdown = `
## Human Members
| Name | Nicknames | Role | Language | Badge |
|------|-----------|------|----------|-------|
| David Koenig | Frickeldave, Dave | Techlead / Developer | German (de) | 👤 Human |
| Felix Bajus | | Developer | German (de) | 👤 Human |
| Oliver Davies | | Projektleiter | German (de) | Human |
| Benjamin Janisch | | Projektleiter (Vertrieb) | German (de) | Human |
| Other Human | | Non-Developer | German (de) | Human |
| Another Human | | DeveloperRelations | German (de) | Human |
`;

  const runCommand = (command, args) => {
    calls.push([command, ...args]);

    if (args[0] === 'api' && args[1] === 'user') {
      return {
        status: 0,
        stdout: JSON.stringify({ login: 'david-koenig_example', name: 'David Koenig' }),
        stderr: '',
      };
    }

    return {
      status: 0,
      stdout: JSON.stringify({
        data: {
          search: {
            nodes: [{ login: 'felix-bajus_example', name: 'Felix Bajus' }],
          },
        },
      }),
      stderr: '',
    };
  };

  const reviewers = resolveHumanReviewerLogins(runCommand, '/repo', { teamMarkdown });
  assert.deepEqual(reviewers, [
    {
      member: {
        name: 'David Koenig',
        nicknames: ['Frickeldave', 'Dave'],
        role: 'Techlead / Developer',
        language: 'German (de)',
        github: '',
      },
      login: 'david-koenig_example',
    },
    {
      member: {
        name: 'Felix Bajus',
        nicknames: [],
        role: 'Developer',
        language: 'German (de)',
        github: '',
      },
      login: 'felix-bajus_example',
    },
  ]);

  assert.equal(
    calls.some((call) => call.some((part) => String(part).includes('"Felix Bajus" in:fullname'))),
    true
  );
  assert.equal(calls.length, 2);
});

test('resolveHumanReviewerLogins skips GitHub resolution when no Developer role is present', () => {
  assert.deepEqual(
    resolveHumanReviewerLogins(() => assert.fail('Unexpected GitHub resolution'), '/repo', {
      teamMarkdown: `
## Human Members
| Name | Nicknames | Role | Language | Badge |
|------|-----------|------|----------|-------|
| Manager | | Projektleiter (Vertrieb) | German (de) | Human |
| Other Human | | Non-Developer | German (de) | Human |
`,
    }),
    []
  );
});

test('resolveHumanReviewerLogins excludes manager/PM-only roles and includes Techlead/Developer roles', () => {
  const teamMarkdown = `
## Human Members
| Name | Nicknames | Role | Language | Badge |
|------|-----------|------|----------|-------|
| David Koenig | Frickeldave, Dave | Techlead / Developer | German (de) | 👤 Human |
| Felix Bajus | | Developer | German (de) | 👤 Human |
| Oliver Davies | | Projektleiter — Businessline Automotive & Defense | German (de) | 👤 Human |
| Benjamin Janisch | | Projektleiter (Vertrieb) | German (de) | 👤 Human |
`;

  const runCommand = (_command, args) => {
    if (args[0] === 'api' && args[1] === 'user') {
      return {
        status: 0,
        stdout: JSON.stringify({ login: 'david-koenig_example', name: 'David Koenig' }),
        stderr: '',
      };
    }

    return {
      status: 0,
      stdout: JSON.stringify({
        data: {
          search: {
            nodes: [{ login: 'felix-bajus_example', name: 'Felix Bajus' }],
          },
        },
      }),
      stderr: '',
    };
  };

  const reviewers = resolveHumanReviewerLogins(runCommand, '/repo', { teamMarkdown });
  const names = reviewers.map((entry) => entry.member.name);

  assert.deepEqual(names.sort(), ['David Koenig', 'Felix Bajus']);
  assert.ok(!names.includes('Oliver Davies'), 'manager role must be excluded');
  assert.ok(!names.includes('Benjamin Janisch'), 'manager role must be excluded');
});

test('resolveHumanReviewerLogins deduplicates reviewers resolving to the same login', () => {
  const teamMarkdown = `
## Human Members
| Name | Nicknames | Role | Language | Badge |
|------|-----------|------|----------|-------|
| David Koenig | Frickeldave, Dave | Techlead / Developer | German (de) | 👤 Human |
| David K. Duplicate | David Koenig | Developer | German (de) | 👤 Human |
`;

  const runCommand = (_command, args) => {
    if (args[0] === 'api' && args[1] === 'user') {
      return {
        status: 0,
        stdout: JSON.stringify({ login: 'david-koenig_example', name: 'David Koenig' }),
        stderr: '',
      };
    }

    return {
      status: 0,
      stdout: JSON.stringify({
        data: { search: { nodes: [{ login: 'david-koenig_example', name: 'David Koenig' }] } },
      }),
      stderr: '',
    };
  };

  const reviewers = resolveHumanReviewerLogins(runCommand, '/repo', { teamMarkdown });
  assert.equal(reviewers.length, 1);
  assert.equal(reviewers[0].login, 'david-koenig_example');
});

test('resolveHumanReviewerLogins excludes the PR author and already-requested reviewers at the call site (start-work.mjs contract)', () => {
  const teamMarkdown = `
## Human Members
| Name | Nicknames | Role | Language | Badge |
|------|-----------|------|----------|-------|
| David Koenig | Frickeldave, Dave | Techlead / Developer | German (de) | 👤 Human |
| Felix Bajus | | Developer | German (de) | 👤 Human |
`;

  const runCommand = (_command, args) => {
    if (args[0] === 'api' && args[1] === 'user') {
      return {
        status: 0,
        stdout: JSON.stringify({ login: 'david-koenig_example', name: 'David Koenig' }),
        stderr: '',
      };
    }

    return {
      status: 0,
      stdout: JSON.stringify({
        data: { search: { nodes: [{ login: 'felix-bajus_example', name: 'Felix Bajus' }] } },
      }),
      stderr: '',
    };
  };

  const prAuthorLogin = 'david-koenig_example';
  const requestedReviewers = new Set(['felix-bajus_example']);
  const resolvedReviewers = resolveHumanReviewerLogins(runCommand, '/repo', { teamMarkdown })
    .map((entry) => entry.login)
    .filter((login) => login !== prAuthorLogin && !requestedReviewers.has(login));

  assert.deepEqual(resolvedReviewers, []);
});

test('detectIdFromTmuxSession reads canonical IS/PR session names only', () => {
  const spawnFn = (name) => () => ({ status: 0, stdout: `${name}\n` });
  const env = { TMUX: '/tmp/tmux-1/default,1,0' };
  assert.deepEqual(detectIdFromTmuxSession('issue', { env, spawnFn: spawnFn('IS138') }), {
    id: 138,
    sessionName: 'IS138',
  });
  assert.deepEqual(detectIdFromTmuxSession('pr', { env, spawnFn: spawnFn('PR7') })?.id, 7);
  assert.equal(detectIdFromTmuxSession('issue', { env, spawnFn: spawnFn('PR7') }), null);
  assert.equal(detectIdFromTmuxSession('issue', { env, spawnFn: spawnFn('IS_138') }), null);
  assert.equal(detectIdFromTmuxSession('issue', { env, spawnFn: spawnFn('IS0') }), null);
  assert.equal(detectIdFromTmuxSession('issue', { env, spawnFn: spawnFn('113-0') }), null);
});

test('detectIdFromTmuxSession returns null outside tmux or on tmux failure', () => {
  const spawnFn = () => {
    throw new Error('must not be called');
  };
  assert.equal(detectIdFromTmuxSession('issue', { env: {}, spawnFn }), null);
  assert.equal(
    detectIdFromTmuxSession('issue', {
      env: { TMUX: 'x' },
      spawnFn: () => ({ status: 1, stdout: '' }),
    }),
    null
  );
});

describe('parseFlowFlags', () => {
  test('returns defaults and untouched rest arguments without flags', () => {
    assert.deepEqual(parseFlowFlags(['IS_202', '--other']), {
      notmux: false,
      prompt: null,
      noprompt: false,
      model: null,
      noProvider: false,
      rest: ['IS_202', '--other'],
    });
  });

  test('extracts --notmux, --noprompt and both --prompt forms', () => {
    assert.deepEqual(parseFlowFlags(['--notmux', '42', '--noprompt']), {
      notmux: true,
      prompt: null,
      noprompt: true,
      model: null,
      noProvider: false,
      rest: ['42'],
    });
    assert.equal(parseFlowFlags(['--prompt', '  Continue  ', '7']).prompt, 'Continue');
    assert.deepEqual(parseFlowFlags(['--prompt=Do it', '7']).rest, ['7']);
    assert.equal(parseFlowFlags(['--prompt=a=b']).prompt, 'a=b');
  });

  test('rejects --prompt together with --noprompt in either order', () => {
    assert.throws(() => parseFlowFlags(['--prompt', 'x', '--noprompt']), /mutually exclusive/);
    assert.throws(() => parseFlowFlags(['--noprompt', '--prompt=x']), /mutually exclusive/);
  });

  testEach([[['--prompt']], [['--prompt', '']], [['--prompt', '   ']], [['--prompt=']]])(
    'rejects an empty or missing --prompt value %j',
    (argv) => {
      assert.throws(() => parseFlowFlags(argv), /--prompt requires a non-empty message/);
    }
  );

  test('extracts --model and --no-provider and rejects an empty --model value', () => {
    assert.deepEqual(parseFlowFlags(['--model', ' deepseek-v4-pro ', '--no-provider', '7']), {
      notmux: false,
      prompt: null,
      noprompt: false,
      model: 'deepseek-v4-pro',
      noProvider: true,
      rest: ['7'],
    });
    assert.equal(parseFlowFlags(['--model=deepseek-v4-flash']).model, 'deepseek-v4-flash');
    assert.throws(() => parseFlowFlags(['--model']), /--model requires a model id/);
    assert.throws(() => parseFlowFlags(['--model=']), /--model requires a model id/);
  });
});

describe('copilot launch plan helpers', () => {
  const providerPlan = {
    mode: 'provider',
    model: 'deepseek-v4-pro',
    envDelta: {
      COPILOT_PROVIDER_TYPE: 'anthropic',
      COPILOT_PROVIDER_BASE_URL: 'https://api.deepseek.com/anthropic',
      COPILOT_PROVIDER_API_KEY_COMMAND: `cat '/home/tester/.config/fd/copilot-provider.key'`,
      COPILOT_MODEL: 'deepseek-v4-pro',
    },
    envUnset: ['COPILOT_PROVIDER_API_KEY', 'COPILOT_PROVIDER_BEARER_TOKEN'],
    warnings: [],
  };
  const fallbackPlan = {
    mode: 'github',
    model: null,
    envDelta: {},
    envUnset: ['COPILOT_PROVIDER_API_KEY'],
    warnings: ['Copilot provider: missing key file. Using GitHub Copilot models instead.'],
  };

  test('buildCopilotArgs only adds --model in the provider mode', () => {
    assert.deepEqual(buildCopilotArgs('Go', providerPlan), [
      '--agent',
      'Squad',
      '--yolo',
      '--model',
      'deepseek-v4-pro',
      '-i',
      'Go',
    ]);
    assert.deepEqual(buildCopilotArgs('Go', fallbackPlan), [
      '--agent',
      'Squad',
      '--yolo',
      '-i',
      'Go',
    ]);
    assert.deepEqual(buildCopilotArgs('Go'), ['--agent', 'Squad', '--yolo', '-i', 'Go']);
  });

  test('buildCopilotShellCommand prefixes exec env with unset flags before variables', () => {
    const command = buildCopilotShellCommand({ PORT: '4321' }, 'Go', providerPlan);

    assert.ok(
      command.startsWith(
        "exec env -u 'COPILOT_PROVIDER_API_KEY' -u 'COPILOT_PROVIDER_BEARER_TOKEN' PORT='4321' "
      ),
      command
    );
    assert.ok(command.includes("COPILOT_PROVIDER_TYPE='anthropic' "), command);
    assert.ok(
      command.includes("COPILOT_PROVIDER_BASE_URL='https://api.deepseek.com/anthropic' "),
      command
    );
    // Der Key-Pfad steckt in einem sh-Quoting, die einfachen Quotes werden maskiert.
    assert.ok(
      command.includes(
        "COPILOT_PROVIDER_API_KEY_COMMAND='cat '\\''/home/tester/.config/fd/copilot-provider.key'\\''' "
      ),
      command
    );
    assert.ok(
      command.endsWith(
        "'copilot' '--agent' 'Squad' '--yolo' '--model' 'deepseek-v4-pro' '-i' 'Go'"
      ),
      command
    );

    const order = [
      "PORT='4321'",
      "COPILOT_PROVIDER_TYPE='anthropic'",
      'COPILOT_PROVIDER_BASE_URL=',
      'COPILOT_PROVIDER_API_KEY_COMMAND=',
      "COPILOT_MODEL='deepseek-v4-pro'",
      "'copilot'",
    ].map((part) => command.indexOf(part));
    assert.deepEqual(order, [...order].sort((left, right) => left - right));
    assert.ok(order.every((index) => index > 0));
  });

  test('buildCopilotShellCommand escapes quotes in the prompt', () => {
    assert.ok(
      buildCopilotShellCommand({}, "it's").endsWith("'-i' 'it'\\''s'"),
      buildCopilotShellCommand({}, "it's")
    );
  });

  test('buildCopilotShellCommand stays byte-identical without a plan', () => {
    assert.equal(
      buildCopilotShellCommand({}, 'Go'),
      "exec 'copilot' '--agent' 'Squad' '--yolo' '-i' 'Go'"
    );
    assert.equal(
      buildCopilotShellCommand({}, 'Go', null, { copilotCommand: '/usr/bin/copilot' }),
      "exec '/usr/bin/copilot' '--agent' 'Squad' '--yolo' '-i' 'Go'"
    );
  });

  test('buildCopilotChildEnv returns a fresh object and applies unset then delta', () => {
    const baseEnv = {
      PATH: '/bin',
      COPILOT_PROVIDER_TYPE: 'openai',
      COPILOT_PROVIDER_API_KEY: 'stale',
    };
    const childEnv = buildCopilotChildEnv(baseEnv, providerPlan, { PORT: '4321', EXTRA: 'x' });

    assert.notEqual(childEnv, baseEnv);
    assert.equal(baseEnv.COPILOT_PROVIDER_API_KEY, 'stale');
    assert.deepEqual(childEnv, {
      PATH: '/bin',
      PORT: '4321',
      EXTRA: 'x',
      COPILOT_PROVIDER_TYPE: 'anthropic',
      COPILOT_PROVIDER_BASE_URL: 'https://api.deepseek.com/anthropic',
      COPILOT_PROVIDER_API_KEY_COMMAND: `cat '/home/tester/.config/fd/copilot-provider.key'`,
      COPILOT_MODEL: 'deepseek-v4-pro',
    });
    assert.deepEqual(buildCopilotChildEnv({ A: '1' }), { A: '1' });
    const cleared = buildCopilotChildEnv({ KEEP: '1', DROP: '2' }, {
      envDelta: {},
      envUnset: ['DROP'],
    });
    assert.deepEqual(cleared, { KEEP: '1' });
  });

  test('reportCopilotLaunchPlan logs the provider line and warns exactly once on fallback', () => {
    const log = vi.fn();
    const warn = vi.fn();

    reportCopilotLaunchPlan(providerPlan, { log, warn, describe: () => 'Provider : deepseek' });
    assert.deepEqual(log.mock.calls, [['Provider : deepseek']]);
    assert.equal(warn.mock.calls.length, 0);

    log.mockClear();
    reportCopilotLaunchPlan(fallbackPlan, { log, warn, describe: () => 'unused' });
    assert.equal(warn.mock.calls.length, 1);
    assert.deepEqual(warn.mock.calls[0], [fallbackPlan.warnings[0]]);
    assert.equal(log.mock.calls.length, 0);

    log.mockClear();
    warn.mockClear();
    reportCopilotLaunchPlan(null, { log, warn });
    reportCopilotLaunchPlan({ mode: 'github', warnings: [] }, { log, warn });
    assert.deepEqual([log.mock.calls.length, warn.mock.calls.length], [0, 0]);
  });
});

describe('resolveAdditionalPrompt', () => {
  test('--prompt wins without asking', async () => {
    const askFn = vi.fn();
    assert.equal(await resolveAdditionalPrompt({ prompt: 'Go', noprompt: false }, askFn), 'Go');
    assert.equal(askFn.mock.calls.length, 0);
  });

  test('--noprompt returns null without asking', async () => {
    const askFn = vi.fn();
    assert.equal(await resolveAdditionalPrompt({ prompt: null, noprompt: true }, askFn), null);
    assert.equal(askFn.mock.calls.length, 0);
  });

  test('asks interactively when no flag is set', async () => {
    const askFn = vi.fn().mockResolvedValue('typed');
    assert.equal(await resolveAdditionalPrompt({ prompt: null, noprompt: false }, askFn), 'typed');
    assert.equal(askFn.mock.calls.length, 1);
  });
});

describe('ensureTmuxSessionAvailable', () => {
  const hasSession = (status) => vi.fn(() => ({ status }));

  testEach([
    ['tmux is unavailable', { tmuxAvailable: false }],
    ['--notmux is set', { tmuxAvailable: true, notmux: true }],
    ['already inside tmux', { tmuxAvailable: true, env: { TMUX: '/tmp/tmux-1/default,1,0' } }],
  ])('does not probe tmux when %s', (_name, options) => {
    const spawnFn = hasSession(0);
    ensureTmuxSessionAvailable('IS202', { env: {}, ...options, spawnFn });
    assert.equal(spawnFn.mock.calls.length, 0);
  });

  test('aborts with the attach hint when the session already exists', () => {
    const spawnFn = hasSession(0);
    assert.throws(
      () => ensureTmuxSessionAvailable('IS202', { tmuxAvailable: true, env: {}, spawnFn }),
      /tmux attach -t IS202/
    );
    assert.deepEqual(spawnFn.mock.calls[0].slice(0, 2), ['tmux', ['has-session', '-t', '=IS202']]);
  });

  test('passes when the session is missing', () => {
    const spawnFn = hasSession(1);
    assert.doesNotThrow(() =>
      ensureTmuxSessionAvailable('IS202', { tmuxAvailable: true, env: {}, spawnFn })
    );
    assert.equal(spawnFn.mock.calls.length, 1);
  });
});

describe('trustCopilotFolder', () => {
  const dirs = [];
  const makeDir = () => {
    mkdirSync(join(process.cwd(), 'node_modules'), { recursive: true });
    const dir = mkdtempSync(join(process.cwd(), 'node_modules', '.flow-trust-'));
    dirs.push(dir);
    return dir;
  };
  after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

  test('creates config.json with trusted_folders under COPILOT_HOME', () => {
    const home = makeDir();
    const copilotHome = join(home, 'custom', 'copilot');
    assert.equal(
      trustCopilotFolder('/work/IS_202', {
        env: { COPILOT_HOME: copilotHome },
        homeDirectory: join(home, 'unused'),
      }),
      true
    );
    const config = JSON.parse(readFileSync(join(copilotHome, 'config.json'), 'utf8'));
    assert.deepEqual(config.trusted_folders, [resolve('/work/IS_202')]);
    assert.equal(existsSync(join(home, 'unused')), false);
  });

  test('falls back to ~/.copilot, keeps other settings and is idempotent', () => {
    const home = makeDir();
    const configPath = join(home, '.copilot', 'config.json');
    mkdirSync(join(home, '.copilot'));
    // Gespeicherte Einträge sind absolute Pfade, deshalb muss das Fixture wie der echte Ordner aufgelöst werden.
    const alreadyTrusted = resolve('/already');
    writeFileSync(
      configPath,
      `// comment line\n{"model":"x","trusted_folders":${JSON.stringify([alreadyTrusted])}}\n`
    );
    const options = { env: {}, homeDirectory: home };

    assert.equal(trustCopilotFolder('/work/IS_202', options), true);
    assert.equal(trustCopilotFolder('/work/IS_202', options), false);
    assert.equal(trustCopilotFolder('/already', options), false);

    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    assert.equal(config.model, 'x');
    assert.deepEqual(config.trusted_folders, [alreadyTrusted, resolve('/work/IS_202')]);
  });

  test('throws on unparsable config instead of overwriting it', () => {
    const home = makeDir();
    mkdirSync(join(home, '.copilot'));
    writeFileSync(join(home, '.copilot', 'config.json'), '{broken');
    assert.throws(
      () => trustCopilotFolder('/w', { env: {}, homeDirectory: home }),
      /Cannot parse Copilot config/
    );
    assert.equal(readFileSync(join(home, '.copilot', 'config.json'), 'utf8'), '{broken');
  });

  test('preserves current camelCase auth state and uses trustedFolders', () => {
    const home = makeDir();
    mkdirSync(join(home, '.copilot'));
    const configPath = join(home, '.copilot', 'config.json');
    writeFileSync(
      configPath,
      '// state\n{"lastLoggedInUser":{"host":"github.com","login":"someone"},"trustedFolders":["/existing"],"custom":true,}'
    );
    trustCopilotFolder('/new', { homeDirectory: home, env: {} });
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    assert.equal(config.lastLoggedInUser.login, 'someone');
    assert.equal(config.custom, true);
    assert.deepEqual(config.trustedFolders, ['/existing', resolve('/new')]);
    assert.equal(Object.hasOwn(config, 'trusted_folders'), false);
  });

  test('uses current global-state spelling for a fresh configuration, not the unsupported config settings key', () => {
    const home = makeDir();
    const spawnFn = vi.fn(() => ({ status: 0, stdout: '`trustedFolders`: list of folders' }));
    trustWorktreeFolder('/work/current', { env: {}, homeDirectory: home, spawnFn });
    assert.deepEqual(
      spawnFn.mock.calls.map(([_command, args]) => args),
      [['help', 'config']]
    );
    const config = JSON.parse(readFileSync(join(home, '.copilot', 'config.json'), 'utf8'));
    assert.deepEqual(config.trustedFolders, [resolve('/work/current')]);
  });
});

describe('launchInNewTmuxSession', () => {
  test('creates the session, disables mouse mode and attaches', () => {
    const spawnFn = vi.fn(() => ({ status: 0 }));
    assert.equal(launchInNewTmuxSession('IS202', '/wt', 'copilot --x', { spawnFn }), 0);
    const calls = spawnFn.mock.calls.map(([, args]) => args);
    assert.deepEqual(calls[0], [
      'new-session',
      '-d',
      '-s',
      'IS202',
      '-n',
      'copilot',
      '-c',
      '/wt',
      'copilot --x',
    ]);
    assert.deepEqual(calls[1], ['set-option', '-t', 'IS202', 'mouse', 'off']);
    assert.deepEqual(calls[2], ['attach-session', '-t', 'IS202']);
  });

  test('returns the attach exit code', () => {
    const spawnFn = vi.fn((_c, args) => ({ status: args[0] === 'attach-session' ? 3 : 0 }));
    assert.equal(launchInNewTmuxSession('IS1', '/wt', 'c', { spawnFn }), 3);
  });

  test('throws and does not attach when session creation fails', () => {
    const spawnFn = vi.fn(() => ({ status: 1, stderr: 'duplicate session\n' }));
    assert.throws(
      () => launchInNewTmuxSession('IS1', '/wt', 'c', { spawnFn }),
      /Failed to create tmux session "IS1": duplicate session/
    );
    assert.equal(spawnFn.mock.calls.length, 1);
  });
});
