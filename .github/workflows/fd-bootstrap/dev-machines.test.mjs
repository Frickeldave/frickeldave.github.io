import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseAllDocuments } from 'yaml';

import {
  TEMPLATE_PATH,
  findStale,
  isDevMachineRole,
  parseDevelopers,
  parseSshKeys,
  renderAll,
  renderDevMachine,
  selectMachines,
  slugify,
  validateSshPublicKey,
} from './dev-machines.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const template = readFileSync(TEMPLATE_PATH, 'utf8');
const KEY_A =
  'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl dave@laptop';
const KEY_B = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC7 felix';

// German headings: this repository writes German team files, so the parser must
// accept `## Menschliche Mitglieder` exactly like the English original.
const team = (keys = `| frickeldave | ${KEY_A} |\n| felix-bajus | ${KEY_B} |`) => `# Squad-Team

## Mitglieder

| Name | Rolle | Charter | Status |
|------|-------|---------|--------|
| Tony | Lead & Requirement Gatekeeper | .squad/agents/tony/charter.md | ✅ Aktiv |

## Menschliche Mitglieder

| Name | Spitznamen | Rolle | Sprache | Badge | GitHub | E-Mail |
|------|-----------|-------|---------|-------|--------|--------|
| David Koenig | Frickeldave, Dave | Techlead / Developer | German (de) | 👤 Human | Frickeldave | dave@example.com |
| Felix Bajus | | Developer | German (de) | 👤 Human | felix-bajus | |
| Oliver Davies | | Projektleiter (Vertrieb) | German (de) | 👤 Human | | |

## Developer SSH Keys

| GitHub | SSH Public Key |
|--------|----------------|
${keys}

## Projektkontext
`;

describe('roster parsing', () => {
  test('selects Developer and Techlead members but not Projektleiter', () => {
    assert.equal(isDevMachineRole('Techlead'), true);
    assert.equal(isDevMachineRole('Techlead / Developer'), true);
    assert.equal(isDevMachineRole('Developer'), true);
    assert.equal(isDevMachineRole('Projektleiter (Vertrieb)'), false);
    const { developers } = parseDevelopers(team());
    assert.deepEqual(
      developers.map((developer) => developer.machineName),
      ['fd-dev-frickeldave', 'fd-dev-felix-bajus']
    );
    assert.equal(developers[0].sshPublicKey, KEY_A);
  });

  test('derives DNS-safe slugs', () => {
    assert.equal(slugify('Jürgen Müller-Lüdenscheid'), 'jurgen-muller-ludenscheid');
    assert.equal(slugify('  Ann  '), 'ann');
  });

  test('creates a machine for a member without a key and reports the missing SSH access', () => {
    const { developers, skipped } = parseDevelopers(
      team(`| frickeldave | ${KEY_A} |\n| felix-bajus | |`)
    );
    assert.deepEqual(
      developers.map((developer) => developer.slug),
      ['frickeldave', 'felix-bajus']
    );
    assert.equal(developers[1].sshPublicKey, null);
    assert.deepEqual(skipped, []);
  });

  test('reads the key table independently of the Human Members table', () => {
    assert.deepEqual(
      [...parseSshKeys(team()).keys()],
      ['frickeldave', 'felix-bajus']
    );
  });

  test('rejects private, malformed and multi-line keys', () => {
    assert.throws(() => validateSshPublicKey('-----BEGIN OPENSSH PRIVATE KEY-----'), /private/);
    assert.throws(() => validateSshPublicKey('not a key'), /valid/);
    assert.throws(() => validateSshPublicKey(`${KEY_A}\nssh-rsa AAAA`), /valid/);
    assert.throws(() => parseDevelopers(team('| frickeldave | nonsense |')), /David Koenig/);
  });

  test('fails when two members use the same handle (case-insensitive)', () => {
    const duplicate = team().replace('felix-bajus', 'FRICKELDAVE');
    assert.throws(() => parseDevelopers(duplicate), /is used by/);
  });

  test('fails when two handles collapse to the same machine name', () => {
    // Distinct, valid handles; slugify collapses the doubled dash to one.
    const clash = team()
      .replace('| Frickeldave | dave@example.com |', '| frickel--dave | dave@example.com |')
      .replace('| felix-bajus | |', '| frickel-dave | |');
    assert.throws(() => parseDevelopers(clash), /same machine name/);
  });

  test('matches keys case-insensitively and tolerates a leading @', () => {
    const { developers } = parseDevelopers(
      team(`| @FRICKELDAVE | ${KEY_A} |\n| felix-bajus | ${KEY_B} |`)
    );
    assert.deepEqual(
      developers.map((developer) => developer.github),
      ['Frickeldave', 'felix-bajus']
    );
    assert.equal(developers[0].sshPublicKey, KEY_A);
  });

  test('does not match keys by display name', () => {
    const { developers, warnings } = parseDevelopers(team(`| David Koenig | ${KEY_A} |`));
    assert.deepEqual(
      developers.map((developer) => developer.sshPublicKey),
      [null, null]
    );
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /"david koenig"/i);
  });

  test('skips Developer/Techlead without a GitHub handle', () => {
    const missing = team().replace('| Felix Bajus | | Developer | German (de) | 👤 Human | felix-bajus | |', '| Felix Bajus | | Developer | German (de) | 👤 Human | | |');
    const { developers, skipped } = parseDevelopers(missing);
    assert.deepEqual(
      developers.map((developer) => developer.slug),
      ['frickeldave']
    );
    assert.equal(skipped.length, 1);
    assert.equal(skipped[0].name, 'Felix Bajus');
    assert.match(skipped[0].reason, /GitHub handle/);
  });

  test('rejects invalid handles', () => {
    assert.throws(
      () => parseDevelopers(team().replace('| felix-bajus | |', '| bad handle! | |')),
      /Invalid GitHub handle/
    );
  });

  test('warns about key rows with unknown handle and never leaks key content', () => {
    const { developers, warnings } = parseDevelopers(
      team(`| frickeldave | ${KEY_A} |\n| stranger | ${KEY_B} |`)
    );
    assert.equal(developers.length, 2);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /"stranger"/);
    assert.ok(!warnings.join('\n').includes('AAAA'));
  });

  test('fails on duplicate key rows for the same handle', () => {
    assert.throws(() => parseDevelopers(team(`| a-b | ${KEY_A} |\n| A-B | ${KEY_B} |`)), /more than once/);
  });

  test('error messages never contain key material', () => {
    const broken = team('| frickeldave | ssh-rsa AAAAsecret!! |');
    assert.throws(() => parseDevelopers(broken), /David Koenig/);
    try {
      parseDevelopers(broken);
    } catch (error) {
      assert.ok(!error.message.includes('AAAAsecret'));
    }
  });
});

describe('manifest rendering', () => {
  const { developers } = parseDevelopers(team());
  const docs = parseAllDocuments(renderAll(developers, template)).map((doc) => doc.toJS());

  test('renders one StatefulSet and one Service per developer in fd-infra', () => {
    assert.deepEqual(
      docs.map((doc) => `${doc.kind}/${doc.metadata.name}`),
      [
        'StatefulSet/fd-dev-frickeldave',
        'Service/fd-dev-frickeldave',
        'StatefulSet/fd-dev-felix-bajus',
        'Service/fd-dev-felix-bajus',
      ]
    );
    assert.deepEqual([...new Set(docs.map((doc) => doc.metadata.namespace))], ['fd-infra']);
  });

  test('uses no volumes and passes the public key via environment', () => {
    const set = docs[0];
    assert.equal(set.spec.volumeClaimTemplates, undefined);
    assert.equal(set.spec.template.spec.volumes, undefined);
    assert.equal(set.spec.template.spec.containers[0].volumeMounts, undefined);
    const env = Object.fromEntries(
      set.spec.template.spec.containers[0].env.map((entry) => [entry.name, entry.value])
    );
    assert.equal(env.FD_SSH_PUBLIC_KEY, KEY_A);
    assert.equal(set.spec.template.spec.containers[0].image, 'ghcr.io/frickeldave/fd-dev-full:latest');
  });

  test('renders an empty key as empty env value so the entrypoint skips sshd', () => {
    const { developers: withoutKeys } = parseDevelopers(team(''));
    const [set] = parseAllDocuments(renderAll(withoutKeys, template)).map((doc) => doc.toJS());
    const env = Object.fromEntries(
      set.spec.template.spec.containers[0].env.map((entry) => [entry.name, entry.value])
    );
    assert.equal(env.FD_SSH_PUBLIC_KEY, '');
    assert.equal(env.FD_REPO_URL, 'https://github.com/Frickeldave/frickeldave.github.io.git');
    assert.equal(env.FD_REPO_BRANCH, 'dev');
  });

  test('declares cpu and memory requests and limits', () => {
    for (const set of docs.filter((doc) => doc.kind === 'StatefulSet')) {
      const { requests, limits } = set.spec.template.spec.containers[0].resources;
      assert.ok(requests.cpu);
      assert.ok(requests.memory);
      assert.ok(limits.cpu);
      assert.ok(limits.memory);
    }
  });

  test('stays idempotent and only restarts on purpose (OnDelete)', () => {
    for (const set of docs.filter((doc) => doc.kind === 'StatefulSet')) {
      assert.equal(set.spec.updateStrategy.type, 'OnDelete');
    }
    assert.equal(renderAll(developers, template), renderAll(developers, template));
  });

  test('wires selector, labels and service ports consistently', () => {
    const [set, service] = docs;
    assert.deepEqual(set.spec.selector.matchLabels, {
      'app.kubernetes.io/name': 'fd-dev-machine',
      'frickeldave.github.io/developer': 'frickeldave',
    });
    assert.deepEqual(service.spec.selector, set.spec.selector.matchLabels);
    assert.equal(set.metadata.labels['app.kubernetes.io/part-of'], 'fd-dev-machines');
    assert.deepEqual(
      service.spec.ports.map((port) => port.port),
      [22, 3000]
    );
  });

  test('escapes hostile key comments and leaves no placeholder', () => {
    const developer = { ...developers[0], sshPublicKey: `${KEY_A} "quoted" \\ backslash` };
    const rendered = renderDevMachine(developer, template);
    const [set] = parseAllDocuments(rendered).map((doc) => doc.toJS());
    assert.equal(set.spec.template.spec.containers[0].env[0].value, developer.sshPublicKey);
    assert.ok(!/__[A-Z_]+__/.test(rendered));
  });
});

describe('add / remove / idempotency', () => {
  const names = (markdown) => parseDevelopers(markdown).developers;
  const withoutMember = (markdown, name) =>
    markdown
      .split('\n')
      .filter((line) => !line.startsWith(`| ${name} |`))
      .join('\n');
  const existing = (developers) =>
    developers.flatMap((developer) => [
      `statefulset.apps/${developer.machineName}`,
      `service/${developer.machineName}`,
    ]);

  test('is a no-op when the cluster already matches the roster', () => {
    const developers = names(team());
    assert.deepEqual(findStale(existing(developers), developers), []);
    assert.deepEqual(findStale(existing(developers), developers), []);
  });

  test('adds a new developer without touching existing machines', () => {
    const before = names(withoutMember(team(), 'Felix Bajus'));
    const after = names(team());
    assert.deepEqual(findStale(existing(before), after), []);
    assert.equal(after.length, before.length + 1);
  });

  test('deletes machines of removed developers on the next run', () => {
    const before = names(team());
    const after = names(withoutMember(team(), 'Felix Bajus'));
    assert.deepEqual(findStale(existing(before), after), [
      'statefulset.apps/fd-dev-felix-bajus',
      'service/fd-dev-felix-bajus',
    ]);
  });

  test('works against the real team.md', () => {
    const real = readFileSync(path.join(root, '.squad', 'team.md'), 'utf8');
    const { developers, skipped } = parseDevelopers(real);
    assert.deepEqual(
      developers.map((developer) => developer.machineName),
      ['fd-dev-frickeldave']
    );
    assert.equal(developers[0].name, 'David Koenig');
    assert.equal(developers[0].github, 'Frickeldave');
    assert.equal(developers[0].sshPublicKey, null);
    assert.deepEqual(skipped, []);
  });
});

describe('restart target selection', () => {
  const { developers } = parseDevelopers(team());

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
    assert.deepEqual(selectMachines('FRICKELDAVE, fd-dev-felix-bajus, nobody', developers), {
      machines: ['fd-dev-frickeldave', 'fd-dev-felix-bajus'],
      unknown: ['nobody'],
    });
  });

  test('deduplicates repeated targets', () => {
    assert.deepEqual(selectMachines('frickeldave,fd-dev-frickeldave', developers).machines, [
      'fd-dev-frickeldave',
    ]);
  });
});

describe('static contracts', () => {
  const read = (...parts) => readFileSync(path.join(root, ...parts), 'utf8');

  test('fd-dev-full inherits from the repository base image and only adds SSH', () => {
    const dockerfile = read('.github/workflows/fd-bootstrap/docker-dev-full/Dockerfile');
    assert.match(dockerfile, /^FROM \$\{DEV_BASE_IMAGE\}$/m);
    assert.match(dockerfile, /^ARG DEV_BASE_IMAGE=ghcr\.io\/frickeldave\/fd-dev-base:latest$/m);
    assert.ok(dockerfile.includes('openssh-server'));
    assert.ok(dockerfile.includes('netcat-openbsd'));
    assert.ok(!/npm install|dl\.k8s\.io|playwright/i.test(dockerfile));
    const entrypoint = read('.github/workflows/fd-bootstrap/docker-dev-full/entrypoint.sh');
    assert.ok(entrypoint.includes('PasswordAuthentication no'));
    assert.ok(entrypoint.includes('fd-clone-repo'));
    // Without a key the container must stay alive for `kubectl exec`.
    assert.ok(entrypoint.includes('exec sleep infinity'));
  });

  test('workflow only uses files below fd-bootstrap/ and builds the image via Kaniko', () => {
    const workflow = read('.github/workflows/fd-bootstrap.yml');
    assert.ok(!workflow.includes('scripts/bootstrap/'));
    assert.ok(workflow.includes('fd-bootstrap/docker-dev-full/Dockerfile'));
    assert.ok(workflow.includes('build_image'));
    assert.ok(!/docker (build|push)/.test(workflow));
    assert.ok(workflow.includes('fd-k8s-kaniko-build-job.yaml'));
    assert.ok(workflow.includes('dev-machines.mjs" render'));
    assert.ok(workflow.includes('dev-machines.mjs" stale'));
    assert.ok(workflow.includes('runs-on: [self-hosted, fd]'));
  });

  test('template contains no volume and no secret references', () => {
    assert.ok(!/volumeClaimTemplates|^\s*volumes:|secretKeyRef|PRIVATE KEY/m.test(template));
  });
});
