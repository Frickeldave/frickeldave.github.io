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
  providerStatusLines,
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

  it('forwards homeDirectory from readiness to copilotStatus', () => {
    const home = fixture();
    mkdirSync(join(home, '.copilot'));
    writeFileSync(
      join(home, '.copilot', 'config.json'),
      JSON.stringify({ lastLoggedInUser: user, loggedInUsers: [user] })
    );
    const spawnFn = vi.fn((cmd, args) => {
      if (cmd === 'git' && args.includes('--show-toplevel'))
        return { status: 0, stdout: `${home}\n` };
      if (cmd === 'git' && args.includes('--git-common-dir'))
        return { status: 0, stdout: `${join(home, '.git')}\n` };
      if (cmd === 'git' && args.includes('--is-inside-work-tree'))
        return { status: 0, stdout: 'true\n' };
      if (cmd === 'copilot') return version();
      return { status: 0, stdout: '' };
    });
    const state = readiness(home, { env: {}, notmux: true, homeDirectory: home, spawnFn });
    // Without the forwarded home this would read the real ~/.copilot and report "no".
    expect(state.copilot).toBe('yes');
    expect(state.provider.state).toBe('unset');
  });

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

describe('offline BYOK provider status', () => {
  // Assembled at runtime so the tracked file never contains a key-shaped literal.
  const KEY = ['sk', 'TEST0123456789abcdef'].join('-');
  const BASE_URL = 'https://api.deepseek.com/anthropic';

  function providerFixture({ configMode = 0o600, keyMode = 0o600 } = {}) {
    const home = fixture();
    chmodSync(home, 0o700);
    const dir = join(home, '.config', 'fd');
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    chmodSync(dir, 0o700);
    const configPath = join(dir, 'copilot-provider.env');
    const keyPath = join(dir, 'copilot-provider.key');
    writeFileSync(
      configPath,
      `FD_COPILOT_PROVIDER=deepseek\nCOPILOT_PROVIDER_BASE_URL=${BASE_URL}\nCOPILOT_MODEL=deepseek-v4-pro\n`
    );
    writeFileSync(keyPath, `${KEY}\n`);
    chmodSync(configPath, configMode);
    chmodSync(keyPath, keyMode);
    return { home, configPath, keyPath };
  }

  const spawnFnFor = (repo) =>
    vi.fn((cmd, args) => {
      if (cmd === 'git' && args.includes('--show-toplevel')) return { status: 0, stdout: `${repo}\n` };
      if (cmd === 'git' && args.includes('--git-common-dir'))
        return { status: 0, stdout: `${join(repo, '.git')}\n` };
      if (cmd === 'git' && args.includes('--is-inside-work-tree'))
        return { status: 0, stdout: 'true\n' };
      if (cmd === 'copilot' && args[0] === '--version') return version();
      if (cmd === 'tmux') return { status: 0, stdout: 'tmux 3.4\n' };
      return { status: 0, stdout: 'v1.0.0\n' };
    });

  const readinessFor = (repo, options) =>
    readiness(repo, { env: {}, notmux: true, spawnFn: spawnFnFor(repo), ...options });

  it('reports state set with host, model and limits', () => {
    const { home, configPath, keyPath } = providerFixture();
    const provider = readinessFor(home, { homeDirectory: home, configPath, keyPath }).provider;

    expect(provider.state).toBe('set');
    expect(provider.type).toBe('anthropic');
    expect(provider.baseUrl).toBe(BASE_URL);
    expect(provider.host).toBe('api.deepseek.com');
    expect(provider.model).toBe('deepseek-v4-pro');
    expect(providerStatusLines(provider)).toEqual([
      'Provider : deepseek (api.deepseek.com) | Modell: deepseek-v4-pro',
      '  Provider type     : anthropic',
      `  Provider base URL : ${BASE_URL}`,
      '  Provider model    : deepseek-v4-pro',
      '  Provider limits   : prompt=840000 output=128000',
    ]);
    expect(providerStatusLines(provider).join('\n')).not.toContain(KEY);
  });

  it('reports unset without a configuration file and keeps the single provider line', () => {
    const home = fixture();
    const provider = readinessFor(home, {
      homeDirectory: home,
      configPath: join(home, 'missing.env'),
      keyPath: join(home, 'missing.key'),
    }).provider;

    expect(provider.state).toBe('unset');
    expect(provider.warnings).toEqual([]);
    expect(providerStatusLines(provider)).toEqual(['Provider : GitHub Copilot (Standard)']);
  });

  it('reports invalid-permissions instead of the key content for an unsafe key file', () => {
    const { home, configPath, keyPath } = providerFixture({ keyMode: 0o644 });
    const provider = readinessFor(home, { homeDirectory: home, configPath, keyPath }).provider;

    expect(provider.state).toBe('invalid-permissions');
    expect(providerStatusLines(provider)).toEqual([
      'Provider : invalid-permissions (GitHub Copilot in use)',
    ]);
    expect(provider.warnings.join('\n')).not.toContain(KEY);
    expect(provider.warnings.join('\n')).toContain('Key file');
  });

  it('marks GitHub auth as not required while the BYOK provider is active', () => {
    const { home, configPath, keyPath } = providerFixture();
    mkdirSync(join(home, '.copilot'));
    writeFileSync(
      join(home, '.copilot', 'config.json'),
      '{"lastLoggedInUser":null,"loggedInUsers":[]}'
    );
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      reportReadiness(home, {
        // COPILOT_HOME overrides the derived ~/.copilot path explicitly.
        env: { COPILOT_HOME: join(home, '.copilot') },
        notmux: true,
        homeDirectory: home,
        configPath,
        keyPath,
        spawnFn: spawnFnFor(home),
      });
      const lines = log.mock.calls.map(([line]) => line);
      expect(lines).toContain('  Copilot CLI logged in: not required (BYOK provider is active)');
      expect(lines).toContain('  Provider : deepseek (api.deepseek.com) | Modell: deepseek-v4-pro');
      expect(lines.join('\n')).not.toContain(KEY);
    } finally {
      log.mockRestore();
    }
  });

  itEach([
    ['--state', 'set'],
    ['--line', 'Provider : deepseek (api.deepseek.com) | Modell: deepseek-v4-pro'],
  ])('provider %s prints exactly one line', (flag, expected) => {
    const { home, configPath, keyPath } = providerFixture();
    const result = spawnSync(
      process.execPath,
      [resolve('scripts', 'copilot-environment.mjs'), 'provider', flag],
      {
        encoding: 'utf8',
        env: { FD_COPILOT_PROVIDER_CONFIG: configPath, FD_COPILOT_API_KEY_FILE: keyPath },
      }
    );
    expect(result.status).toBe(0);
    expect(result.stdout.trimEnd()).toBe(expected);
    expect(result.stdout).not.toContain(KEY);
  });

  it('provider without flags prints the detail block', () => {
    const { configPath, keyPath } = providerFixture();
    const result = spawnSync(
      process.execPath,
      [resolve('scripts', 'copilot-environment.mjs'), 'provider'],
      {
        encoding: 'utf8',
        env: { FD_COPILOT_PROVIDER_CONFIG: configPath, FD_COPILOT_API_KEY_FILE: keyPath },
      }
    );
    expect(result.status).toBe(0);
    expect(result.stdout.trimEnd().split('\n')).toHaveLength(5);
    expect(result.stdout).toContain('  Provider limits   : prompt=840000 output=128000');
  });

  itEach([
    ['unset', 'unset'],
    ['invalid-permissions', 'invalid-permissions'],
  ])('provider --state prints %s', (state, expected) => {
    const { home } = providerFixture({ configMode: 0o644 });
    const configPath =
      state === 'unset' ? join(home, 'absent.env') : join(home, '.config', 'fd', 'copilot-provider.env');
    const keyPath =
      state === 'unset' ? join(home, 'absent.key') : join(home, '.config', 'fd', 'copilot-provider.key');
    const result = spawnSync(
      process.execPath,
      [resolve('scripts', 'copilot-environment.mjs'), 'provider', '--state'],
      {
        encoding: 'utf8',
        env: { FD_COPILOT_PROVIDER_CONFIG: configPath, FD_COPILOT_API_KEY_FILE: keyPath },
      }
    );
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(expected);
  });
});
