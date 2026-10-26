import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { parseDevelopers, selectMachines } from './dev-machines.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const bootstrapDir = '.github/workflows/fd-bootstrap';
const KEY = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl dave@laptop';

const team = `## Menschliche Mitglieder

| Name | Spitznamen | Rolle | Sprache | Badge | GitHub | E-Mail |
|------|-----------|-------|---------|-------|--------|--------|
| David Koenig | Dave | Techlead / Developer | German (de) | 👤 Human | Frickeldave | dave@example.com |
| Felix Bajus | | Developer | German (de) | 👤 Human | felix-bajus | |

## Developer SSH Keys

| GitHub | SSH Public Key |
|--------|----------------|
| frickeldave | ${KEY} |
| felix-bajus | ${KEY} |
`;

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

describe('selectMachines', () => {
  const { developers } = parseDevelopers(team);

  test('selects nothing for an empty list', () => {
    assert.deepEqual(selectMachines('', developers), { machines: [], unknown: [] });
    assert.deepEqual(selectMachines(' , ', developers), { machines: [], unknown: [] });
  });

  test('selects every machine for "all"', () => {
    assert.deepEqual(selectMachines('ALL', developers).machines, [
      'fd-dev-frickeldave',
      'fd-dev-felix-bajus',
    ]);
  });

  test('matches handles and machine names case-insensitively and reports unknown entries', () => {
    assert.deepEqual(
      selectMachines('FRICKELDAVE, fd-dev-felix-bajus, nobody', developers),
      {
        machines: ['fd-dev-frickeldave', 'fd-dev-felix-bajus'],
        unknown: ['nobody'],
      }
    );
  });

  test('deduplicates repeated targets', () => {
    assert.deepEqual(
      selectMachines('felix-bajus,fd-dev-felix-bajus', developers).machines,
      ['fd-dev-felix-bajus']
    );
  });
});

describe('restart helper scripts (bash, stubbed kubectl)', () => {
  const work = mkdtempSync(path.join(root, 'node_modules', '.fd-dev-machine-test-'));
  after(() => rmSync(work, { recursive: true, force: true }));

  const run = (script, args, env) =>
    spawnSync(bash, [script, ...args], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, ...env },
    });

  const procDir = (name, titles) => {
    const dir = path.join(work, name);
    titles.forEach((title, index) => {
      mkdirSync(path.join(dir, String(100 + index)), { recursive: true });
      writeFileSync(path.join(dir, String(100 + index), 'cmdline'), title.replaceAll(' ', '\0'));
    });
    return dir;
  };

  test('counts only live ssh session processes', { skip: skipWithoutBash }, () => {
    const dir = procDir('proc-busy', [
      'sshd: /usr/sbin/sshd -D -e -f /home/appuser/.sshd/sshd_config',
      'sshd: appuser@pts/0',
      'sshd: appuser@notty',
      'sshd: [accepted]',
      'node server.js',
    ]);
    const busy = run(`${bootstrapDir}/active-sessions.sh`, [], {
      PROC_DIR: dir.replaceAll('\\', '/'),
    });
    assert.equal(busy.stdout.trim(), '2');
    const idle = run(`${bootstrapDir}/active-sessions.sh`, [], {
      PROC_DIR: procDir('proc-idle', ['sshd: /usr/sbin/sshd -D']).replaceAll('\\', '/'),
    });
    assert.equal(idle.stdout.trim(), '0');
  });

  const stubKubectl = (name) => {
    const dir = path.join(work, name);
    mkdirSync(dir, { recursive: true });
    const stub = path.join(dir, 'kubectl');
    writeFileSync(
      stub,
      `#!/usr/bin/env bash
echo "$*" >> "$STUB_LOG"
verb="$1"
case "$verb" in
  get) [[ " $FAKE_PODS " == *" $3 "* ]] ;;
  exec)
    var="FAKE_SESSIONS_\${3//-/_}"
    value="\${!var:-0}"
    [ "$value" = fail ] && exit 1
    echo "$value" ;;
  delete) exit 0 ;;
esac
`
    );
    chmodSync(stub, 0o755);
    return dir;
  };

  const restart = (name, machines, env) => {
    const dir = stubKubectl(name);
    const log = path.join(work, `${name}.log`);
    const machinesFile = path.join(work, `${name}.machines`);
    writeFileSync(log, '');
    writeFileSync(machinesFile, `${machines.join('\n')}\n`);
    const result = run(`${bootstrapDir}/restart-machines.sh`, [], {
      PATH: `${dir}${path.delimiter}${process.env.PATH}`,
      STUB_LOG: log.replaceAll('\\', '/'),
      NAMESPACE: 'fd-infra',
      MACHINES_FILE: machinesFile.replaceAll('\\', '/'),
      SESSIONS_SCRIPT: `${bootstrapDir}/active-sessions.sh`,
      ...env,
    });
    const calls = readFileSync(log, 'utf8');
    return { result, deleted: [...calls.matchAll(/^delete pod (\S+)/gm)].map((match) => match[1]) };
  };

  test('deletes pods of idle machines only', { skip: skipWithoutBash }, () => {
    const { result, deleted } = restart('idle-busy', ['fd-dev-a', 'fd-dev-b'], {
      FAKE_PODS: 'fd-dev-a-0 fd-dev-b-0',
      FAKE_SESSIONS_fd_dev_b_0: '2',
    });
    assert.equal(result.status, 0);
    assert.deepEqual(deleted, ['fd-dev-a-0']);
    assert.match(result.stdout, /fd-dev-b: 2 active SSH session\(s\); skipped/);
  });

  test('skips a machine whose sessions cannot be determined', { skip: skipWithoutBash }, () => {
    const { result, deleted } = restart('unknown', ['fd-dev-a'], {
      FAKE_PODS: 'fd-dev-a-0',
      FAKE_SESSIONS_fd_dev_a_0: 'fail',
    });
    assert.deepEqual(deleted, []);
    assert.match(result.stdout, /could not determine active SSH sessions/);
  });

  test('force_restart deletes even busy machines and ignores missing pods', { skip: skipWithoutBash }, () => {
    const { deleted } = restart('force', ['fd-dev-a', 'fd-dev-gone'], {
      FAKE_PODS: 'fd-dev-a-0',
      FAKE_SESSIONS_fd_dev_a_0: '3',
      FORCE_RESTART: 'true',
    });
    assert.deepEqual(deleted, ['fd-dev-a-0']);
  });

  test('ships the helper scripts with LF endings', () => {
    for (const script of ['active-sessions.sh', 'restart-machines.sh', 'report-outdated.sh']) {
      const file = path.join(root, bootstrapDir, script);
      assert.ok(existsSync(file), `${script} must exist`);
      assert.ok(!readFileSync(file, 'utf8').includes('\r'), `${script} must use LF`);
    }
  });
});
