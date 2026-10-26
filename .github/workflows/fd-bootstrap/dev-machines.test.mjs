import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { after, describe, test } from 'node:test';
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
const tempDirs = [];
after(() => tempDirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

const bash = [
  'bash',
  'C:\\Program Files\\Git\\bin\\bash.exe',
  'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
].find((candidate) => {
  const result = spawnSync(candidate, ['-c', 'echo ok'], { encoding: 'utf8' });
  return result.status === 0 && result.stdout.trim() === 'ok';
});
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
    assert.match(
      developers[0].sshPublicKey,
      /^ssh-ed25519 [A-Za-z0-9+/]+={0,3} dave@frickeldave\.de$/,
      'the roster must expose the public key that is registered for the handle'
    );
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

// Regression guard for run 40235439435: `ghcr.io/${{ github.repository_owner }}/…`
// resolved to `ghcr.io/Frickeldave/…`, which the kubelet rejects with
// InvalidImageName (OCI repository names are lowercase). The workflow must derive
// every image reference from a lowercased owner.
describe('image reference hygiene', () => {
  const workflowPath = '.github/workflows/fd-bootstrap.yml';
  const workflowText = readFileSync(path.join(root, workflowPath), 'utf8');
  const workflow = parseAllDocuments(workflowText)[0].toJS();
  const buildJob = workflow.jobs['build-image'];
  const resolveStep = buildJob.steps.find((step) => step.name === 'Resolve image references');
  const kanikoTemplatePath = buildJob.env.KANIKO_JOB_TEMPLATE;

  const OCI_IMAGE = /^ghcr\.io\/[a-z0-9]+(?:[._-][a-z0-9]+)*\/[a-z0-9]+(?:[._-][a-z0-9]+)*:[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;
  const OCI_REPOSITORY = /^ghcr\.io\/[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*$/;
  const DNS1123_LABEL = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

  const resolveScript = resolveStep?.run ?? '';

  // Runs the real step script in the resolved bash, so normalization and validation
  // behave exactly as on the runner. Returns the exit code, stderr and the parsed
  // GITHUB_ENV / GITHUB_OUTPUT files of that run.
  const resolveImages = (inputImage, owner = 'Frickeldave') => {
    const envFile = path.join(
      mkdtempSync(path.join(root, 'node_modules', '.fd-images-')),
      'github_env'
    );
    tempDirs.push(path.dirname(envFile));
    writeFileSync(envFile, '');
    const outputFile = `${envFile}.out`;
    writeFileSync(outputFile, '');

    const result = spawnSync(bash ?? 'bash', ['-c', resolveScript], {
      encoding: 'utf8',
      env: {
        ...process.env,
        GITHUB_REPOSITORY_OWNER: owner,
        GITHUB_ENV: envFile.replaceAll('\\', '/'),
        GITHUB_OUTPUT: outputFile.replaceAll('\\', '/'),
        INPUT_IMAGE: inputImage,
      },
    });
    const resolved = Object.fromEntries(
      readFileSync(envFile, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)])
    );
    return {
      status: result.status,
      stderr: result.stderr ?? '',
      env: resolved,
      output: readFileSync(outputFile, 'utf8').trim(),
    };
  };

  test('the workflow never interpolates a raw GitHub owner into an image reference', () => {
    assert.ok(!workflowText.includes('ghcr.io/${{ github.repository_owner }}'));
    assert.ok(!/\$\{\{\s*github\.repository_owner\s*\}\}/.test(workflowText));
    for (const value of Object.values(buildJob.env ?? {})) {
      assert.ok(!String(value).includes('ghcr.io/'), `${value} must be resolved at run time`);
    }
  });

  test('resolving the image references lowercases the owner and rejects uppercase refs', () => {
    assert.ok(resolveStep, 'the build job needs the "Resolve image references" step');
    assert.match(resolveScript, /tr '\[:upper:\]' '\[:lower:\]'/);
    assert.match(resolveScript, /\*\[A-Z\]\*\)/);

    const blank = resolveImages('');
    assert.equal(blank.status, 0, blank.stderr);
    assert.equal(blank.env.DEV_BASE_IMAGE, 'ghcr.io/frickeldave/fd-dev-base:latest');
    assert.equal(blank.env.KANIKO_IMAGE, 'ghcr.io/frickeldave/fd-dev-kaniko:latest');
    assert.equal(blank.env.IMAGE_REF, 'ghcr.io/frickeldave/fd-dev-full:latest');
    assert.equal(blank.env.CACHE_REPO, 'ghcr.io/frickeldave/fd-dev-kaniko-cache');
    for (const [name, ref] of Object.entries(blank.env)) {
      if (name === 'CACHE_REPO') {
        // Cache repository has no tag; OCI repository names are lowercase only.
        assert.match(ref, OCI_REPOSITORY, `${ref} must be a valid OCI repository`);
      } else {
        assert.match(ref, OCI_IMAGE, `${ref} must be a valid OCI reference`);
      }
    }
    // The dev-machine job consumes this job output as its image.
    assert.equal(blank.output, 'image_ref=ghcr.io/frickeldave/fd-dev-full:latest');

    // A mixed-case override must fail fast instead of timing out in the cluster.
    const rejected = resolveImages('ghcr.io/Frickeldave/fd-dev-full:latest');
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /must be lowercase/);
  });

  // Regression guard for run 40390700825: a `docker pull …` snippet copied from the
  // GHCR package page was accepted verbatim and only failed inside the Kaniko Job
  // ("registries must be valid RFC 3986 URI authorities: docker pull ghcr.io").
  test('normalizes a pasted pull command into a bare image reference', () => {
    const pasted = resolveImages('docker pull ghcr.io/frickeldave/fd-dev-full:latest');
    assert.equal(pasted.status, 0, pasted.stderr);
    assert.equal(pasted.env.IMAGE_REF, 'ghcr.io/frickeldave/fd-dev-full:latest');
    assert.equal(pasted.output, 'image_ref=ghcr.io/frickeldave/fd-dev-full:latest');
    assert.match(pasted.env.IMAGE_REF, OCI_IMAGE);

    for (const [input, expected] of [
      ['DOCKER PULL ghcr.io/frickeldave/fd-dev-full:latest', 'ghcr.io/frickeldave/fd-dev-full:latest'],
      ['docker image pull ghcr.io/frickeldave/fd-dev-full:latest', 'ghcr.io/frickeldave/fd-dev-full:latest'],
      ['podman pull ghcr.io/frickeldave/fd-dev-full:latest', 'ghcr.io/frickeldave/fd-dev-full:latest'],
      ['  docker pull   ghcr.io/frickeldave/fd-dev-full:v2  ', 'ghcr.io/frickeldave/fd-dev-full:v2'],
    ]) {
      const result = resolveImages(input);
      assert.equal(result.status, 0, `${input}: ${result.stderr}`);
      assert.equal(result.env.IMAGE_REF, expected, input);
    }
  });

  test('rejects image inputs it cannot normalize before any cluster interaction', () => {
    // `docker pull` alone, the bare host from the incident log, and other malformed
    // shapes must abort with an actionable annotation instead of creating a Job.
    for (const input of [
      'docker pull',
      'podman pull ',
      'docker pull ghcr.io',
      'ghcr.io/frickeldave/fd-dev-full@sha256:abc123',
      'fd-dev-full:latest',
      'ghcr.io//fd-dev-full:latest',
      'ghcr.io/frickeldave/fd-dev-full:',
      'ghcr.io/frickeldave/fd-dev-full:latest extra',
      'ghcr.io/frickeldave/fd-dev-full:latest\nrm -rf /',
    ]) {
      const result = resolveImages(input);
      assert.notEqual(result.status, 0, `${input} must be rejected`);
      assert.match(result.stderr, /::error::/, `${input} needs an ::error:: annotation`);
      assert.ok(
        result.stderr.includes(input.trim()) || result.stderr.includes(input),
        `${input} must be named in the message: ${result.stderr}`
      );
      assert.equal(result.env.IMAGE_REF, undefined, `${input} must not publish an image ref`);
      assert.equal(result.output, '', `${input} must not publish the job output`);
    }

    // Validation runs in the resolve step, which must not talk to the cluster.
    assert.doesNotMatch(resolveScript, /kubectl/);
    const stepNames = buildJob.steps.map((step) => step.name);
    assert.ok(
      stepNames.indexOf('Resolve image references') <
        stepNames.findIndex((name) => String(name).includes('Kaniko')),
      'validation must precede the Kaniko build'
    );
  });

  test('the rendered Kaniko Job stays a valid, lowercase Kubernetes object', () => {
    const rendered = readFileSync(path.join(root, kanikoTemplatePath), 'utf8')
      .replaceAll('__JOB_NAME__', 'kaniko-fd-dev-full-40235439435-1')
      .replaceAll('__NAMESPACE__', 'fd-infra')
      .replaceAll('__KANIKO_IMAGE__', 'ghcr.io/frickeldave/fd-dev-kaniko:latest')
      .replaceAll('__GIT_TOKEN_SECRET_NAME__', 'kaniko-fd-dev-full-40235439435-1-git')
      .replaceAll('__GIT_CONTEXT__', 'git://github.com/Frickeldave/frickeldave.github.io.git#refs/heads/dev#abc')
      .replaceAll('__DOCKERFILE_PATH__', '.github/workflows/fd-bootstrap/docker-dev-full/Dockerfile')
      .replaceAll('__DESTINATION_ARGS__', '--destination=ghcr.io/frickeldave/fd-dev-full:latest')
      .replaceAll('__DEV_BASE_IMAGE__', 'ghcr.io/frickeldave/fd-dev-base:latest')
      .replaceAll('__CACHE_REPO__', 'ghcr.io/frickeldave/fd-dev-kaniko-cache');
    const job = parseAllDocuments(rendered)[0].toJS();

    assert.match(job.metadata.name, DNS1123_LABEL);
    assert.match(job.metadata.namespace, DNS1123_LABEL);
    const container = job.spec.template.spec.containers[0];
    assert.match(container.image, OCI_IMAGE);
    for (const arg of container.args) {
      const destination = String(arg).match(/--destination=(.+)$/)?.[1];
      if (destination) {
        assert.match(destination, OCI_IMAGE);
      }
      const buildArg = String(arg).match(/--build-arg=DEV_BASE_IMAGE=(.+)$/)?.[1];
      if (buildArg) {
        assert.match(buildArg, OCI_IMAGE);
      }
    }

    // Layer cache: enabled, GHCR repository lowercase, TTL bounded.
    assert.ok(container.args.includes('--cache=true'), 'the build must use the layer cache');
    const cacheRepo = container.args.find((arg) => String(arg).startsWith('--cache-repo='));
    assert.ok(cacheRepo, 'the build must set --cache-repo');
    assert.match(cacheRepo.slice('--cache-repo='.length), OCI_REPOSITORY);
    const cacheTtl = container.args.find((arg) => String(arg).startsWith('--cache-ttl='));
    assert.match(cacheTtl ?? '', /^--cache-ttl=\d+h$/, 'the cache must expire');
    // The cache repo must not be pushed as the build destination.
    assert.ok(
      !container.args.some((arg) => String(arg).startsWith('--destination=') && String(arg).includes('cache')),
      '--destination must point at the image, not at the cache'
    );
    // Secret names are DNS-1123 subdomains: the job name plus a suffix stays valid.
    assert.match(container.env.find((entry) => entry.name === 'GIT_PASSWORD').valueFrom.secretKeyRef.name, /^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$/);
  });

  test('the dev-machine manifest uses lowercase, DNS-1123-safe names and labels', () => {
    const { developers } = parseDevelopers(
      team().replaceAll('felix-bajus', 'FelixBajus')
    );
    const docs = parseAllDocuments(renderAll(developers, template)).map((doc) => doc.toJS());

    for (const doc of docs) {
      assert.match(doc.metadata.name, DNS1123_LABEL);
      assert.match(
        doc.metadata.labels['frickeldave.github.io/developer'],
        /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/
      );
      // StatefulSet pod names are `<machine>-0`, so the machine name needs headroom.
      assert.ok(doc.metadata.name.length + 2 <= 63);
    }
    const set = docs.find((doc) => doc.kind === 'StatefulSet');
    assert.match(set.spec.template.spec.containers[0].image, OCI_IMAGE);
  });
});
