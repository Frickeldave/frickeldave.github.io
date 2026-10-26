import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, 'docker-dev-full');
const root = path.resolve(here, '..', '..', '..');
const toSlashes = (value) => value.replace(/\\/g, '/');
// Only PATH needs the MSYS form (/c/...), file arguments stay on C:/...
const toPosix = (value) =>
  toSlashes(value).replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`);

const bashCandidates = [
  'bash',
  'C:\\Program Files\\Git\\bin\\bash.exe',
  'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
];
const bash = bashCandidates.find((candidate) => {
  const result = spawnSync(candidate, ['-c', 'echo ok'], { encoding: 'utf8' });
  return result.status === 0 && result.stdout.trim() === 'ok';
});
const skipWithoutBash = bash ? false : 'bash is not available on this machine';

const tempDirs = [];
after(() => tempDirs.forEach((tempDir) => rmSync(tempDir, { recursive: true, force: true })));

const stubs = {
  copilot: `#!/usr/bin/env bash
case "$1" in
  --version) echo 'GitHub Copilot CLI 1.0.98.' ;;
  --help) echo 'config --no-mouse' ;;
  config) echo "copilot $*" >> "$STUB_LOG" ;;
esac
`,
  // Scopes come from $GH_SCOPES; `auth refresh` grants read:project unless GH_REFRESH_FAILS is set.
  gh: `#!/usr/bin/env bash
echo "gh $*" >> "$STUB_LOG"
case "$1 $2" in
  "auth status")
    if [ -f "$STUB_STATE/scope" ] || [ -n "\${GH_SCOPES:-}" ]; then echo "  - Token scopes: 'repo', 'read:project'" >&2; else echo "  - Token scopes: 'repo'" >&2; fi
    exit 0 ;;
  "auth refresh") [ -n "\${GH_REFRESH_FAILS:-}" ] && exit 1; touch "$STUB_STATE/scope"; exit 0 ;;
  "auth setup-git") exit 0 ;;
  "api user")
    case "$4" in
      *login*) printf '%s\\n' "\${GH_USER_LOGIN-octo}" ;;
      *'.id'*) printf '%s\\n' "\${GH_USER_ID-42}" ;;
      *name*) printf '%s\\n' "\${GH_USER_NAME-}" ;;
      *email*) printf '%s\\n' "\${GH_USER_EMAIL-}" ;;
    esac
    exit 0 ;;
esac
exit 0
`,
  git: `#!/usr/bin/env bash
echo "git $*" >> "$STUB_LOG"
exit 0
`,
  npm: `#!/usr/bin/env bash
echo "npm $* cwd=$PWD" >> "$STUB_LOG"
[ -z "\${NPM_FAILS:-}" ]
`,
  'fd-clone-repo': `#!/usr/bin/env bash
name="$(basename "$FD_REPO_DIR")"
[ "\${CLONE_FAILS:-}" = "$name" ] && exit 1
echo "clone $FD_REPO_URL $FD_REPO_DIR branch=\${FD_REPO_BRANCH:-}" >> "$STUB_LOG"
mkdir -p "$FD_REPO_DIR/.git"
`,
};

function setup(env = {}, { input, args = [], work: existingWork } = {}) {
  const work = existingWork ?? mkdtempSync(path.join(root, 'node_modules', '.fd-setup-'));
  if (!tempDirs.includes(work)) tempDirs.push(work);
  const bin = path.join(work, 'bin');
  const state = path.join(work, 'state');
  const home = path.join(work, 'home');
  const log = path.join(work, 'stub.log');
  [bin, state, home].forEach((entry) => mkdirSync(entry, { recursive: true }));
  writeFileSync(log, '');
  for (const [name, body] of Object.entries(stubs)) {
    writeFileSync(path.join(bin, name), body);
    chmodSync(path.join(bin, name), 0o755);
  }
  const repoDir = path.join(home, 'frickeldave.github.io');
  const argv = args.map((arg) => `'${arg.replace(/'/g, `'\\''`)}'`).join(' ');
  // PATH is exported inside the shell: a Windows-style entry in spawn's env is
  // not picked up reliably by Git Bash, and the stubs must win over the real tools.
  const result = spawnSync(
    bash,
    [
      '-c',
      `export PATH='${toPosix(bin)}':"$PATH"; exec bash '${toSlashes(
        path.join(dir, 'fd-setup.sh')
      )}'${argv ? ` ${argv}` : ''}`,
    ],
    {
      encoding: 'utf8',
      input,
      // The opt-in path reads the key from stdin; without an input the descriptor
      // stays closed, which is exactly the non-interactive "no key" case.
      stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        HOME: toSlashes(home),
        FD_STATUS_LIB: toSlashes(path.join(dir, 'fd-status.sh')),
        FD_RUNTIME_LIB: toSlashes(path.join(root, 'scripts/copilot-environment.mjs')),
        FD_REPO_DIR: toSlashes(repoDir),
        FD_REPO_URL: 'https://github.com/example-org/frickeldave.github.io.git',
        GH_TOKEN: 'dummy',
        STUB_LOG: toSlashes(log),
        STUB_STATE: toSlashes(state),
        ...env,
      },
    }
  );
  const lines = readFileSync(log, 'utf8').split('\n').filter(Boolean);
  return { result, lines, repoDir, home, work };
}

describe('fd-setup.sh with stubbed gh/git/npm/clone', () => {
  test(
    'completes the happy path, sets the git identity from gh api user and skips the refresh when the scope exists',
    { skip: skipWithoutBash },
    () => {
      const { result, lines } = setup({
        GH_SCOPES: '1',
        GH_USER_NAME: 'Octo Cat',
        GH_USER_EMAIL: 'octo@example.com',
      });
      assert.equal(result.status, 0);
      assert.ok(lines.includes('git config --global user.name Octo Cat'));
      assert.ok(lines.includes('git config --global user.email octo@example.com'));
      assert.ok(!lines.some((line) => line.startsWith('gh auth refresh')));
    }
  );

  test('requests the read:project scope when missing and continues once granted', { skip: skipWithoutBash }, () => {
    const { result, lines } = setup();
    assert.equal(result.status, 0);
    assert.ok(lines.includes('gh auth refresh --hostname github.com -s read:project'));
  });

  test('aborts when the read:project scope cannot be obtained', { skip: skipWithoutBash }, () => {
    const { result, lines } = setup({ GH_REFRESH_FAILS: '1' });
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes('gh auth refresh -s read:project failed'));
    assert.ok(!lines.some((line) => line.startsWith('git config')));
    assert.ok(!lines.some((line) => line.startsWith('clone')));
    assert.ok(!lines.some((line) => line.startsWith('npm')));
  });

  test('falls back to the login and the noreply address when name and email are private', { skip: skipWithoutBash }, () => {
    const { result, lines } = setup({ GH_SCOPES: '1', GH_USER_NAME: '', GH_USER_EMAIL: '' });
    assert.equal(result.status, 0);
    assert.ok(lines.includes('git config --global user.name octo'));
    assert.ok(lines.includes('git config --global user.email 42+octo@users.noreply.github.com'));
  });

  test('aborts without a GitHub login from gh api user', { skip: skipWithoutBash }, () => {
    const { result, lines } = setup({ GH_SCOPES: '1', GH_USER_LOGIN: '' });
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes("Could not read the GitHub user from 'gh api user'"));
    assert.ok(!lines.some((line) => line.startsWith('clone')));
  });

  test('clones the repository into FD_REPO_DIR with the configured branch', { skip: skipWithoutBash }, () => {
    const { result, lines, repoDir } = setup({ GH_SCOPES: '1', FD_REPO_BRANCH: 'feat/x' });
    assert.equal(result.status, 0);
    const clones = lines.filter((line) => line.startsWith('clone '));
    assert.equal(clones.length, 1);
    assert.equal(
      clones[0],
      `clone https://github.com/example-org/frickeldave.github.io.git ${toSlashes(repoDir)} branch=feat/x`
    );
  });

  test('fails when the clone fails and does not run npm install', { skip: skipWithoutBash }, () => {
    const { result, lines } = setup({ GH_SCOPES: '1', CLONE_FAILS: 'frickeldave.github.io' });
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes('The clone failed'));
    assert.ok(!lines.some((line) => line.startsWith('npm')));
  });

  test('runs npm only inside the checkout and writes no secret file', { skip: skipWithoutBash }, () => {
    const { result, lines, repoDir } = setup({ GH_SCOPES: '1' });
    assert.equal(result.status, 0);
    const installs = lines.filter((line) => line.startsWith('npm '));
    assert.deepEqual(installs, [`npm ci cwd=${toPosix(repoDir)}`]);
    // No credentials or AI keys are persisted by the setup flow.
    for (const name of ['.env', '.env.local']) {
      assert.ok(!existsSync(path.join(repoDir, name)), `${name} must not be created`);
    }
    assert.ok(!readFileSync(path.join(dir, 'fd-setup.sh'), 'utf8').includes('AIHUB'));
  });

  test('aborts when npm install fails', { skip: skipWithoutBash }, () => {
    const { result } = setup({ GH_SCOPES: '1', NPM_FAILS: '1' });
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes('npm install failed'));
  });

  test('prepares multiline input and persists mouse=false through the supported CLI config command', {
    // On Windows Node spawns the real `copilot.cmd` shim, so the bash stub on
    // PATH is bypassed; the assertion only holds on POSIX runners.
    skip:
      skipWithoutBash || (process.platform === 'win32' ? 'copilot is a .cmd shim on Windows' : false),
  }, () => {
    const { result, lines } = setup({ GH_SCOPES: '1' });
    assert.equal(result.status, 0);
    assert.ok(lines.includes('copilot config mouse false'));
    assert.ok(result.stdout.includes('Copilot multiline   : yes'));
    assert.ok(result.stdout.includes('LOCAL VS Code client'));
    assert.ok(result.stdout.includes('markieren → Rechtsklick'));
    assert.ok(result.stdout.includes('Alt+Ziehen'));
  });

  // Assembled at runtime so the tracked file never contains a key-shaped literal.
  const SENTINEL_KEY = ['sk', 'Sentinel0123456789abcdef'].join('-');
  const sentinel = (result) => `${result.stdout}${result.stderr}`;
  const providerPaths = (home) => ({
    configPath: path.join(home, '.config', 'fd', 'copilot-provider.env'),
    keyPath: path.join(home, '.config', 'fd', 'copilot-provider.key'),
  });

  test('opt-in stores the key in a 0600 file and never prints it', { skip: skipWithoutBash }, () => {
    const run = setup(
      { GH_SCOPES: '1', FD_SETUP_DEEPSEEK: '1' },
      { input: `${SENTINEL_KEY}\n` }
    );
    assert.equal(run.result.status, 0);
    const { configPath, keyPath } = providerPaths(run.home);
    assert.equal(readFileSync(keyPath, 'utf8'), `${SENTINEL_KEY}\n`);
    assert.equal(statSync(keyPath).mode & 0o777, 0o600);
    assert.equal(statSync(configPath).mode & 0o777, 0o600);
    assert.equal(statSync(path.dirname(configPath)).mode & 0o777, 0o700);
    assert.match(readFileSync(configPath, 'utf8'), /^FD_COPILOT_PROVIDER=deepseek$/m);
    assert.ok(run.result.stdout.includes('provider active.'));
    assert.ok(!sentinel(run.result).includes(SENTINEL_KEY), 'the key must never be printed');
  });

  test(
    '--reset-provider removes both files and prints the revocation hint without key material',
    { skip: skipWithoutBash },
    () => {
      const first = setup(
        { GH_SCOPES: '1', FD_SETUP_DEEPSEEK: '1' },
        { input: `${SENTINEL_KEY}\n` }
      );
      const { configPath, keyPath } = providerPaths(first.home);
      assert.ok(existsSync(configPath) && existsSync(keyPath));
      const reset = setup({ GH_SCOPES: '1' }, { args: ['--reset-provider'], work: first.work });
      assert.equal(reset.result.status, 0);
      assert.ok(!existsSync(configPath), 'the configuration file must be gone');
      assert.ok(!existsSync(keyPath), 'the key file must be gone');
      const output = sentinel(reset.result);
      assert.ok(output.includes(`removed ${toSlashes(configPath)}`));
      assert.ok(output.includes(`removed ${toSlashes(keyPath)}`));
      assert.ok(output.includes('https://platform.deepseek.com/api_keys'));
      assert.ok(output.includes('the start flows use GitHub Copilot models again'));
      assert.ok(!output.includes(SENTINEL_KEY));
    }
  );

  test('reports rejected permissions instead of the key content', { skip: skipWithoutBash }, () => {
    const first = setup(
      { GH_SCOPES: '1', FD_SETUP_DEEPSEEK: '1' },
      { input: `${SENTINEL_KEY}\n` }
    );
    const { configPath, keyPath } = providerPaths(first.home);
    chmodSync(configPath, 0o644);
    chmodSync(keyPath, 0o644);
    const second = setup({ GH_SCOPES: '1', FD_SETUP_DEEPSEEK: '1' }, { work: first.work });
    assert.equal(second.result.status, 0);
    const output = sentinel(second.result);
    assert.ok(output.includes('provider files found but rejected'));
    assert.ok(output.includes('files 0600'));
    assert.ok(output.includes("re-run 'fd-setup --reset-provider'"));
    assert.ok(!output.includes(SENTINEL_KEY));
    // Existing files stay untouched, only their mode is reported as the problem.
    assert.equal(readFileSync(keyPath, 'utf8'), `${SENTINEL_KEY}\n`);
  });

  for (const [label, value, expected] of [
    ['an empty key', '', /no key entered; nothing was written/],
    ['a key without the sk- prefix', 'not-a-deepseek-key', /does not look like a DeepSeek key/],
    ['a key with shell characters', 'sk-Sentinel value with spaces', /characters outside A-Z a-z 0-9 _ -/],
  ]) {
    test(`opt-in rejects ${label} without writing or echoing it`, { skip: skipWithoutBash }, () => {
      const run = setup({ GH_SCOPES: '1', FD_SETUP_DEEPSEEK: '1' }, { input: `${value}\n` });
      assert.equal(run.result.status, 0);
      const { configPath, keyPath } = providerPaths(run.home);
      assert.ok(!existsSync(configPath), 'no configuration file must be written');
      assert.ok(!existsSync(keyPath), 'no key file must be written');
      const output = sentinel(run.result);
      assert.match(output, expected);
      if (value) assert.ok(!output.includes(value), 'the rejected value must not be echoed');
    });
  }
});
