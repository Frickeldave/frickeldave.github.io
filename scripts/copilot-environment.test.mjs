import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { after, describe, it } from 'node:test';
import { expect, itEach, vi } from './test-mock-support.mjs';
import {
  configureCopilotMouse,
  configureMultiline,
  copilotStatus,
  COPY_HINT,
  parseJsonc,
  prepareCopilotEnvironment,
  readiness,
  reportReadiness,
} from './copilot-environment.mjs';

const dirs = [];
function fixture() {
  mkdirSync(join(process.cwd(), 'node_modules'), { recursive: true });
  const root = mkdtempSync(join(process.cwd(), 'node_modules', '.copilot-env-'));
  dirs.push(root);
  return root;
}
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));
const user = { host: 'https://github.com', login: 'someone' };
const version = () => ({ status: 0, stdout: 'GitHub Copilot CLI 1.0.98.\nRun copilot update.\n' });
function auth(config, extra = {}) {
  const home = fixture();
  if (config !== undefined) {
    mkdirSync(join(home, '.copilot'));
    writeFileSync(
      join(home, '.copilot', 'config.json'),
      typeof config === 'string' ? config : JSON.stringify(config)
    );
  }
  return copilotStatus({ homeDirectory: home, env: {}, spawnFn: version, ...extra });
}

describe('offline Copilot status', () => {
  itEach([
    ['current account', { lastLoggedInUser: user, loggedInUsers: [user] }, 'yes'],
    ['legacy account', { last_logged_in_user: user, logged_in_users: [user] }, 'yes'],
    ['legacy selected account', { last_logged_in_user: user }, 'yes'],
    ['logged out', { lastLoggedInUser: null, loggedInUsers: [] }, 'no'],
    ['no selected account', { loggedInUsers: [user] }, 'no'],
    ['stale selected account', { lastLoggedInUser: user, loggedInUsers: [] }, 'no'],
    ['settings only', { theme: 'dark' }, 'no'],
    ['missing file', undefined, 'no'],
    ['malformed JSON', '{broken', 'error'],
    ['malformed account', { lastLoggedInUser: { login: 'someone' } }, 'error'],
    ['malformed list', { loggedInUsers: 'bad' }, 'error'],
    ['unknown schema', [], 'unsupported'],
    [
      'JSONC',
      '// local state\n{"lastLoggedInUser":{"host":"github.com","login":"someone",},}',
      'yes',
    ],
  ])('%s → %s', (_name, config, expected) => {
    expect(auth(config)).toBe(expected);
  });

  itEach(['COPILOT_GITHUB_TOKEN', 'GH_TOKEN', 'GITHUB_TOKEN'])(
    'recognizes %s presence without printing it',
    (key) => {
      expect(auth(undefined, { env: { [key]: 'not-a-real-secret' } })).toBe('yes');
    }
  );

  itEach([
    [{ status: 0, stdout: '1.0.98\n' }, 'no'],
    [{ status: 0, stdout: 'GitHub Copilot CLI 0.0.420.\n' }, 'no'],
    [{ status: 0, stdout: 'not the Copilot CLI' }, 'unsupported'],
    [{ status: 1, stderr: 'failure' }, 'error'],
    [{ error: { code: 'ETIMEDOUT' }, status: null }, 'error'],
    [{ error: { code: 'ENOENT' }, status: null }, 'unavailable'],
  ])('handles version output/failure %#', (result, expected) => {
    const spawnFn = vi.fn(() => result);
    expect(auth(undefined, { spawnFn })).toBe(expected);
    expect(spawnFn.mock.calls.map(([cmd, args]) => [cmd, args])).toEqual([
      ['copilot', ['--version']],
    ]);
  });

  it('honors COPILOT_HOME and does not confuse gh metadata with Copilot auth', () => {
    const root = fixture();
    mkdirSync(join(root, 'custom'));
    writeFileSync(join(root, 'custom', 'config.json'), JSON.stringify({ lastLoggedInUser: user }));
    expect(copilotStatus({ env: { COPILOT_HOME: join(root, 'custom') }, spawnFn: version })).toBe(
      'yes'
    );
    expect(auth({ github: user })).toBe('no');
  });
});

describe('readiness', () => {
  it('reports the repository, the toolchain and .env.local existence without reading it', () => {
    const root = fixture();
    const checkout = join(root, 'checkout');
    mkdirSync(join(checkout, '.git'), { recursive: true });
    writeFileSync(join(checkout, '.env.local'), 'DO-NOT-READ');
    chmodSync(join(checkout, '.env.local'), 0);
    const spawnFn = vi.fn((cmd, args) => {
      if (cmd === 'git' && args.includes('--show-toplevel'))
        return { status: 0, stdout: `${checkout}\n` };
      if (cmd === 'git' && args.includes('--git-common-dir'))
        return { status: 0, stdout: join(checkout, '.git') };
      if (cmd === 'git') return { status: 0, stdout: 'true\n' };
      if (cmd === 'copilot') return version();
      if (cmd === 'node' || cmd === 'npm' || cmd === 'gh') return { status: 0, stdout: 'v1\n' };
      return { error: { code: 'ENOENT' } };
    });
    const out = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const result = reportReadiness(checkout, { env: {}, spawnFn });
      expect(result.repoRoot).toBe(resolve(checkout));
      expect(result.mainRoot).toBe(resolve(checkout));
      expect(result.gitWorkTree).toBe('yes');
      expect(result.tools).toEqual({ node: 'yes', npm: 'yes', gh: 'yes', git: 'yes', copilot: 'yes' });
      expect(result.envExists).toBe(true);
      expect(result.tmux).toBe('no');
      const output = out.mock.calls.flat().join('\n');
      expect(output).toContain('Toolchain');
      expect(output).toContain('node=yes npm=yes gh=yes git=yes copilot=yes');
      expect(output).toContain('tmux is optional');
      expect(output).not.toContain('DO-NOT-READ');
      expect(output).toContain('validity/subscription not checked');
    } finally {
      out.mockRestore();
      chmodSync(join(checkout, '.env.local'), 0o600);
    }
  });

  it('resolves the main checkout from a linked worktree', () => {
    const root = fixture();
    const main = join(root, 'repo');
    const worktree = join(root, 'elsewhere', 'IS_202');
    const git = (...args) => {
      const result = spawnSync('git', args, { encoding: 'utf8' });
      expect(result.status, result.stderr).toBe(0);
    };
    git('init', '-q', main);
    git(
      '-C',
      main,
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.test',
      'commit',
      '--allow-empty',
      '-qm',
      'fixture'
    );
    git('-C', main, 'worktree', 'add', '-qb', 'test-worktree', worktree);
    const result = readiness(worktree, { env: {}, notmux: true });
    expect(result.repoRoot).toBe(resolve(worktree));
    expect(result.mainRoot).toBe(resolve(main));
    expect(result.gitWorkTree).toBe('yes');
    expect(result.envExists).toBe(false);
    expect(result.envPath).toBe(join(resolve(worktree), '.env.local'));
    expect(result.mainEnvPath).toBe(join(resolve(main), '.env.local'));
    expect(result.tmux).toContain('skipped');
  });

  it('does not invoke tmux with --notmux; exposes errors instead of reporting installed=yes', () => {
    const root = fixture();
    const spawnFn = vi.fn((cmd) => {
      if (cmd === 'copilot') return version();
      return { status: 1, stdout: '' };
    });
    expect(readiness(root, { env: {}, notmux: true, spawnFn }).tmux).toContain('skipped');
    expect(spawnFn.mock.calls.some(([cmd]) => cmd === 'tmux')).toBe(false);
    expect(readiness(root, { env: {}, spawnFn }).tmux).toBe('error');
  });
});

describe('terminal configuration', () => {
  it('parses BOM, emoji, inline/block comments and trailing commas without changing strings', () => {
    const text = '\uFEFF/* keep */[{"key":"😀","text":"// not a comment, ]",},]';
    expect(parseJsonc(text).value).toEqual([{ key: '😀', text: '// not a comment, ]' }]);
    expect(parseJsonc(text).clean.length).toBe(text.length);
    expect(() => parseJsonc('[/* broken')).toThrow('Unterminated');
  });
  it('installs the verified /terminal-setup binding, preserves JSONC/comments and is idempotent', () => {
    const home = fixture();
    const path = join(home, '.config', 'Code', 'User', 'keybindings.json');
    mkdirSync(join(home, '.config', 'Code', 'User'), { recursive: true });
    const original =
      '// user bindings\n[\n  {"key":"ctrl+k","command":"custom","args":{"text":"https://example/*path*/"}}, // keep\n]\n';
    writeFileSync(path, original);
    const options = { homeDirectory: home, env: { TERM_PROGRAM: 'vscode' }, platformName: 'linux' };
    expect(configureMultiline(options)).toContain('yes');
    const updated = readFileSync(path, 'utf8');
    expect(updated).toContain('// user bindings');
    expect(updated).toContain('// keep');
    const bindings = parseJsonc(updated).value;
    expect(bindings[0]).toEqual({
      key: 'shift+enter',
      command: 'workbench.action.terminal.sendSequence',
      when: 'terminalFocus',
      args: { text: '\x1b\r' },
    });
    expect(bindings[1].args.text).toBe('https://example/*path*/');
    configureMultiline(options);
    expect(readFileSync(path, 'utf8')).toBe(updated);
  });

  itEach(['[{"key":"shift+enter","command":"custom"}]', '{broken', '{}'])(
    'does not overwrite conflicts or invalid settings: %s',
    (text) => {
      const home = fixture();
      const path = join(home, '.config', 'Code', 'User');
      mkdirSync(path, { recursive: true });
      writeFileSync(join(path, 'keybindings.json'), text);
      expect(
        configureMultiline({
          homeDirectory: home,
          env: { TERM_PROGRAM: 'vscode' },
          platformName: 'linux',
        })
      ).toMatch(/error|conflict/);
      expect(readFileSync(join(path, 'keybindings.json'), 'utf8')).toBe(text);
    }
  );

  itEach([
    ['darwin', ['Library', 'Application Support', 'Code', 'User']],
    ['win32', ['appdata', 'Code', 'User']],
    ['linux', ['.config', 'Code', 'User']],
  ])(
    'uses the native CLI path on %s and warns about the local Remote-SSH client',
    (platformName, segments) => {
      const home = fixture();
      const result = configureMultiline({
        homeDirectory: home,
        env: { TERM_PROGRAM: 'vscode', SSH_CONNECTION: 'remote', APPDATA: join(home, 'appdata') },
        platformName,
      });
      expect(result).toContain('LOCAL VS Code client');
      expect(
        parseJsonc(readFileSync(join(home, ...segments, 'keybindings.json'), 'utf8')).value
      ).toHaveLength(1);
    }
  );

  it('does not touch other terminals or guess missing APPDATA', () => {
    const home = fixture();
    expect(
      configureMultiline({ homeDirectory: home, env: { TERM_PROGRAM: 'iTerm.app' } })
    ).toContain('skipped');
    expect(
      configureMultiline({
        homeDirectory: home,
        env: { TERM_PROGRAM: 'vscode' },
        platformName: 'win32',
      })
    ).toContain('APPDATA missing');
  });

  it('uses supported config command for mouse capture; does not add permission flags or echo failures', () => {
    const spawnFn = vi.fn((_cmd, args) =>
      args[0] === '--help' ? { status: 0, stdout: '--no-mouse' } : { status: 0 }
    );
    configureCopilotMouse({ env: {}, spawnFn });
    expect(spawnFn.mock.calls.map(([cmd, args]) => [cmd, args])).toEqual([
      ['copilot', ['--help']],
      ['copilot', ['config', 'mouse', 'false']],
    ]);
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      configureCopilotMouse({ env: {}, spawnFn: () => ({ status: 1, stderr: 'SECRET' }) });
      expect(warning.mock.calls.flat().join()).not.toContain('SECRET');
      expect(warning.mock.calls.flat().join()).toContain('unsupported');
    } finally {
      warning.mockRestore();
    }
  });

  it('prints the one-line native copy fallback at actual startup and configures existing tmux sessions', () => {
    const home = fixture();
    const spawnFn = vi.fn((cmd, args) => {
      if (cmd === 'copilot' && args[0] === '--version') return version();
      if (cmd === 'copilot' && args[0] === '--help') return { status: 0, stdout: '--no-mouse' };
      return { status: 0, stdout: '' };
    });
    const output = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      prepareCopilotEnvironment(home, {
        env: { TMUX: 'session' },
        spawnFn,
        homeDirectory: home,
        tmuxAvailable: true,
        sessionName: 'IS202',
      });
      expect(output.mock.calls.filter(([line]) => line === COPY_HINT)).toHaveLength(1);
      expect(COPY_HINT).not.toContain('\n');
      expect(COPY_HINT).toContain('markieren → Rechtsklick');
      expect(COPY_HINT).toContain('Alt+Ziehen');
      expect(COPY_HINT).toContain('Strg+Umschalt+C');
      expect(
        spawnFn.mock.calls.some(
          ([cmd, args]) => cmd === 'tmux' && args.join(' ') === 'set-option -t IS202 mouse off'
        )
      ).toBe(true);
      spawnFn.mockClear();
      prepareCopilotEnvironment(home, {
        env: { TMUX: 'session' },
        spawnFn,
        homeDirectory: home,
        tmuxAvailable: false,
      });
      expect(spawnFn.mock.calls.some(([cmd]) => cmd === 'tmux')).toBe(false);
    } finally {
      output.mockRestore();
    }
  });

  itEach(['start-work', 'start-reqeng', 'start-review'])(
    '%s calls the shared preparation before either launch path',
    (flow) => {
      const source = readFileSync(resolve('scripts', `${flow}.mjs`), 'utf8');
      expect(source).toContain(
        "import { prepareCopilotEnvironment } from './copilot-environment.mjs'"
      );
      expect(source).toMatch(
        /prepareCopilotEnvironment\(worktreeContext\.worktreePath,[\s\S]*?if \(!tmuxAvailable\)/
      );
    }
  );
});
