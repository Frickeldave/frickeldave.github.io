import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, 'docker-dev-full');
const read = (name) => readFileSync(path.join(dir, name), 'utf8');
const root = path.resolve(here, '..', '..', '..');

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

// Windows paths need forward slashes inside bash; the drive letter stays, because
// `node "C:/..."` (unlike `/c/...`) resolves on Windows as well.
const toSlashes = (value) => value.replace(/\\/g, '/');

const scripts = ['entrypoint.sh', 'fd-clone-repo.sh', 'fd-setup.sh', 'fd-welcome.sh', 'fd-status.sh'];
const tempDirs = [];
after(() => tempDirs.forEach((tempDir) => rmSync(tempDir, { recursive: true, force: true })));

function makeHome(copilotVersion = '1.0.98.') {
  const home = mkdtempSync(path.join(root, 'node_modules', '.fd-home-'));
  tempDirs.push(home);
  mkdirSync(path.join(home, 'bin'), { recursive: true });
  writeFileSync(
    path.join(home, 'bin', 'copilot'),
    `#!/usr/bin/env bash\nprintf "GitHub Copilot CLI ${copilotVersion}\\n"\n`,
    { mode: 0o755 }
  );
  return home;
}

function run(script, args, { home, env = {}, cwd } = {}) {
  return spawnSync(bash, [toSlashes(path.join(dir, script)), ...args], {
    encoding: 'utf8',
    cwd,
    env: {
      PATH: `${toSlashes(path.join(home, 'bin'))}:${process.env.PATH}`,
      HOME: toSlashes(home),
      // Node's os.homedir() uses USERPROFILE on Windows, so the runtime checks
      // must see the test home there as well.
      USERPROFILE: toSlashes(home),
      FD_STATUS_LIB: toSlashes(path.join(dir, 'fd-status.sh')),
      FD_RUNTIME_LIB: toSlashes(path.resolve('scripts/copilot-environment.mjs')),
      FD_REPO_DIR: toSlashes(path.join(home, 'repo')),
      // The surrounding shell may carry a token; the banner must report the
      // offline state of the container, not the test environment.
      GH_TOKEN: '',
      GITHUB_TOKEN: '',
      COPILOT_GITHUB_TOKEN: '',
      ...env,
    },
  });
}

describe('docker-dev-full image', () => {
  const dockerfile = read('Dockerfile');

  test('installs the helper scripts and strips CRLF from all of them', () => {
    for (const target of ['fd-setup', 'fd-welcome', 'fd-clone-repo']) {
      assert.match(dockerfile, new RegExp(`--chmod=755 \\S+ /usr/local/bin/${target}\\b`));
    }
    assert.ok(dockerfile.includes('/usr/local/lib/fd-dev/fd-status.sh'));
    // A COPY with --chmod=644 into a missing directory would create it without the x bit.
    assert.match(dockerfile, /mkdir -p \/usr\/local\/lib\/fd-dev/);
    const sed = dockerfile.slice(dockerfile.indexOf("sed -i 's/\\r$//'")).split(/\n(?!\s)/)[0];
    for (const target of ['fd-dev-entrypoint', 'fd-clone-repo', 'fd-setup', 'fd-welcome', 'fd-status.sh']) {
      assert.ok(sed.includes(target), `sed must cover ${target}`);
    }
  });

  test('copies only files that exist', () => {
    const sources = [...dockerfile.matchAll(/^COPY (?:--\S+ )*(\S+) /gm)].map((match) => match[1]);
    assert.ok(sources.length >= 5);
    for (const source of sources) {
      assert.doesNotThrow(
        () => readFileSync(path.join(root, source)),
        `${source} must exist in the repository`
      );
    }
  });

  test('rebuilds the image when the shared startup runtime changes', () => {
    const workflow = readFileSync(path.resolve('.github/workflows/fd-bootstrap.yml'), 'utf8');
    assert.ok(workflow.includes('"scripts/copilot-environment.mjs"'));
    assert.ok(workflow.includes('"scripts/platform-shared.mjs"'));
    assert.match(
      workflow,
      /git diff --quiet[^\n]+docker-dev-full"[^\n]+scripts\/copilot-environment\.mjs/
    );
    assert.ok(dockerfile.includes('COPY --chmod=644 scripts/copilot-environment.mjs'));
    assert.ok(dockerfile.includes('COPY --chmod=644 scripts/platform-shared.mjs'));
  });

  test('contains no secrets or tokens for authentication', () => {
    for (const name of scripts) {
      assert.ok(!/gh auth token|GH_TOKEN=|ghp_|echo .*oauth_token/.test(read(name)), name);
    }
  });

  test('requires no SSH key: the entrypoint keeps the container alive for kubectl exec', () => {
    const entrypoint = read('entrypoint.sh');
    assert.match(entrypoint, /if \[ -n "\$\{FD_SSH_PUBLIC_KEY:-\}" \]; then/);
    assert.match(entrypoint, /exec sleep infinity/);
    // start_sshd (which writes authorized_keys) must only be reachable with a key.
    const start = entrypoint.indexOf('if [ "${1:-}" = "sshd" ]; then');
    const keyBranch = entrypoint.indexOf('if [ -n "${FD_SSH_PUBLIC_KEY:-}" ]; then');
    const sshdExec = entrypoint.indexOf('exec /usr/sbin/sshd');
    assert.ok(start >= 0 && keyBranch > start && sshdExec > keyBranch);
    assert.ok(entrypoint.slice(keyBranch, sshdExec).includes('start_sshd'));
    assert.ok(!entrypoint.slice(sshdExec).includes('start_sshd'));
    assert.ok(!entrypoint.slice(sshdExec).includes('> "${ssh_dir}/authorized_keys"'));
  });
});

describe('fd scripts', () => {
  for (const name of scripts) {
    test(`${name} has valid shell syntax`, { skip: skipWithoutBash }, () => {
      const result = spawnSync(bash, ['-n', toSlashes(path.join(dir, name))], { encoding: 'utf8' });
      assert.equal(result.stderr, '');
      assert.equal(result.status, 0);
    });
  }

  test('fd-setup --help succeeds and rejects unknown arguments', { skip: skipWithoutBash }, () => {
    const home = makeHome();
    const help = run('fd-setup.sh', ['--help'], { home });
    assert.equal(help.status, 0);
    assert.ok(help.stdout.includes('Usage: fd-setup'));
    assert.equal(run('fd-setup.sh', ['--bogus'], { home }).status, 2);
  });

  test('fd-welcome prints nothing without a terminal', { skip: skipWithoutBash }, () => {
    const result = run('fd-welcome.sh', [], { home: makeHome() });
    assert.equal(result.status, 0);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, '');
  });

  test('fd-welcome --force reports offline status and the key hints', { skip: skipWithoutBash }, () => {
    const home = makeHome();
    const out = run('fd-welcome.sh', ['--force'], { home }).stdout;
    assert.ok(out.includes('GitHub CLI logged in : no'));
    assert.ok(out.includes('Repository cloned    : no'));
    assert.ok(out.includes('tmux installed'));
    assert.ok(out.includes('Copilot CLI logged in: no'));
    assert.ok(out.includes('fd-setup'));
    assert.match(out, /restart or redeploy[\s\S]*deletes it/);
    assert.ok(out.includes('port-forward svc/fd-dev-<handle> 3000:3000'));
    // No SSH key in the environment: the banner must point at kubectl exec.
    assert.ok(out.includes('kubectl -n ${FD_NAMESPACE:-fd-infra} exec -it fd-dev-<handle>-0'));
  });

  test('fd-welcome detects logins and checkout from local files only', { skip: skipWithoutBash }, () => {
    const home = makeHome();
    mkdirSync(path.join(home, '.config', 'gh'), { recursive: true });
    writeFileSync(
      path.join(home, '.config', 'gh', 'hosts.yml'),
      'github.com:\n    user: someone\n    oauth_token: SECRET-VALUE\n'
    );
    mkdirSync(path.join(home, '.copilot'), { recursive: true });
    writeFileSync(
      path.join(home, '.copilot', 'config.json'),
      '{"last_logged_in_user":{"host":"https://github.com","login":"someone"}}'
    );
    spawnSync('git', ['init', '-q', path.join(home, 'repo')]);
    const result = run('fd-welcome.sh', ['--force'], { home });
    assert.ok(result.stdout.includes('GitHub CLI logged in : yes'));
    assert.ok(result.stdout.includes('Repository cloned    : yes'));
    assert.ok(result.stdout.includes('Copilot CLI logged in: yes'));
    assert.ok(!result.stdout.includes('SECRET-VALUE'));
  });

  test('fd-welcome reports no for a settings-only Copilot config', { skip: skipWithoutBash }, () => {
    const home = makeHome();
    mkdirSync(path.join(home, '.copilot'), { recursive: true });
    writeFileSync(path.join(home, '.copilot', 'config.json'), '{"theme":"dark"}');
    assert.ok(run('fd-welcome.sh', ['--force'], { home }).stdout.includes('Copilot CLI logged in: no'));
  });
});

describe('login banner hook', () => {
  const hook = read('entrypoint.sh').match(/^welcome_hook='(.*)'$/m)?.[1];

  test('is defined in the entrypoint and appended to .bashrc', () => {
    assert.ok(hook);
    assert.ok(read('entrypoint.sh').includes('"${welcome_hook}" >> "${HOME}/.bashrc"'));
  });

  function runHook(shellArgs, script = hook, extraEnv = {}) {
    const home = makeHome();
    const bin = path.join(home, 'bin');
    mkdirSync(bin, { recursive: true });
    writeFileSync(path.join(bin, 'fd-welcome'), '#!/usr/bin/env bash\necho BANNER-SHOWN\n', {
      mode: 0o755,
    });
    return spawnSync(bash, [...shellArgs, script], {
      encoding: 'utf8',
      env: { PATH: `${toSlashes(bin)}:${process.env.PATH}`, HOME: toSlashes(home), ...extraEnv },
    });
  }

  test('stays silent for non-interactive shells (ssh host cmd, scp, sftp)', { skip: skipWithoutBash }, () => {
    assert.equal(runHook(['-c']).stdout, '');
  });

  test('shows the banner once for interactive shells', { skip: skipWithoutBash }, () => {
    const result = runHook(['-i', '-c']);
    assert.equal(result.stdout.match(/BANNER-SHOWN/g)?.length, 1);
  });

  test('stays quiet in nested shells but shows again when the recorded shell is gone', { skip: skipWithoutBash }, () => {
    const nested = runHook(
      ['-i', '-c'],
      `${hook}\n${hook}\nbash -i -c '${hook.replace(/'/g, `'\\''`)}'`
    );
    assert.equal(nested.stdout.match(/BANNER-SHOWN/g)?.length, 1);
    const stale = runHook(['-i', '-c'], hook, { FD_WELCOME_SHOWN: '999999' });
    assert.equal(stale.stdout.match(/BANNER-SHOWN/g)?.length, 1);
  });
});

describe('entrypoint bashrc and VS Code settings', () => {
  const entrypoint = read('entrypoint.sh');
  const functions = [
    entrypoint.match(/^write_vscode_machine_settings\(\) \{[\s\S]*?^SETTINGS\n.*\n\}$/m)?.[0],
  ].join('\n');

  test('replaces older hook lines instead of stacking them', () => {
    assert.ok(entrypoint.includes("grep -vF 'fd-welcome'"));
  });

  test('writes Machine settings once and keeps existing developer settings', { skip: skipWithoutBash }, () => {
    const home = makeHome();
    const script = `${functions}\nvscode_machine_dir="${toSlashes(home)}/.vscode-server/data/Machine"\nwrite_vscode_machine_settings\nwrite_vscode_machine_settings`;
    const first = spawnSync(bash, ['-c', script], {
      encoding: 'utf8',
      env: { PATH: process.env.PATH, HOME: toSlashes(home) },
    });
    assert.equal(first.status, 0);
    const file = path.join(home, '.vscode-server', 'data', 'Machine', 'settings.json');
    const settings = JSON.parse(readFileSync(file, 'utf8'));
    assert.equal(settings['terminal.integrated.defaultProfile.linux'], 'bash');
    assert.equal(settings['workbench.startupEditor'], 'none');
    writeFileSync(file, '{"custom":true}');
    spawnSync(bash, ['-c', script], {
      encoding: 'utf8',
      env: { PATH: process.env.PATH, HOME: toSlashes(home) },
    });
    assert.equal(readFileSync(file, 'utf8'), '{"custom":true}');
  });

  test('bashrc hook is idempotent across entrypoint runs', { skip: skipWithoutBash }, () => {
    const home = makeHome();
    writeFileSync(path.join(home, '.bashrc'), '# user\nfd-welcome old hook\n');
    const snippet = entrypoint.match(
      /# Banner for interactive shells[\s\S]*?echo "\$\{welcome_hook\}" >> "\$\{HOME\}\/\.bashrc"/
    )?.[0];
    const hookLine = entrypoint.match(/^welcome_hook='(.*)'$/m)[1];
    const script = `welcome_hook='${hookLine}'\n${snippet}\n${snippet}`;
    spawnSync(bash, ['-c', script], {
      encoding: 'utf8',
      env: { PATH: process.env.PATH, HOME: toSlashes(home) },
    });
    const rc = readFileSync(path.join(home, '.bashrc'), 'utf8');
    assert.equal(rc.match(/FD_WELCOME_SHOWN=\$\$/g)?.length, 1);
    assert.ok(!rc.includes('old hook'));
    assert.ok(rc.includes('# user'));
  });
});
