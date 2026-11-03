#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseHumanMembers } from '../../../scripts/flow-shared.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDir, '..', '..', '..');

export const DEFAULT_NAMESPACE = 'fd-infra';
export const DEFAULT_IMAGE = 'ghcr.io/frickeldave/fd-dev-full:latest';
export const DEFAULT_REPO_URL = 'https://github.com/Frickeldave/frickeldave.github.io.git';
export const DEFAULT_REPO_BRANCH = 'dev';
// Defaults der Dev-Maschine: 16 GiB Limit, weil die Grundlast (3,7 GiB) plus
// Build-Peak (~8 GiB) das alte 8-GiB-Limit sprengte (Issue #303, OOMKilled 137).
export const DEFAULT_RESOURCES = Object.freeze({
  cpuRequest: '100m',
  memoryRequest: '2Gi',
  cpuLimit: '4',
  memoryLimit: '16Gi',
});
export const MACHINE_PREFIX = 'fd-dev-';
export const MANAGED_SELECTOR = 'app.kubernetes.io/part-of=fd-dev-machines';
export const TEMPLATE_PATH = path.join(scriptDir, 'k8s', 'fd-k8s-dev-machine.yaml');

const GITHUB_HANDLE_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})(?:_[A-Za-z0-9]+)?$/;
const SSH_KEYS_HEADING = /^##\s+(?:Developer\s+SSH\s+Keys|Entwickler-SSH-Schl(?:ü|ue)ssel)\b/i;
const MAX_SLUG_LENGTH = 40;
const SSH_KEY_PATTERN =
  /^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(?:256|384|521)|sk-ssh-ed25519@openssh\.com|sk-ecdsa-sha2-nistp256@openssh\.com) [A-Za-z0-9+/]+={0,3}(?: [^\r\n]*)?$/;

// Kubernetes-Quantity-Formate. Bewusst streng: der Wert landet im YAML, und ein
// Tippfehler in einer Dispatch-Eingabe soll den Render-Schritt abbrechen, bevor
// `kubectl apply` irgendetwas anwendet.
const CPU_QUANTITY_PATTERN = /^\d+(?:\.\d+)?m?$/;
const MEMORY_QUANTITY_PATTERN = /^\d+(?:\.\d+)?(?:Ki|Mi|Gi|Ti|Pi|Ei|k|M|G|T|P|E)?$/;

const RESOURCE_SPECS = [
  {
    key: 'cpuRequest',
    flag: '--cpu-request',
    label: 'CPU request',
    pattern: CPU_QUANTITY_PATTERN,
    examples: '100m, 0.5 or 4',
  },
  {
    key: 'memoryRequest',
    flag: '--memory-request',
    label: 'memory request',
    pattern: MEMORY_QUANTITY_PATTERN,
    examples: '2Gi, 512Mi or 2G',
  },
  {
    key: 'cpuLimit',
    flag: '--cpu-limit',
    label: 'CPU limit',
    pattern: CPU_QUANTITY_PATTERN,
    examples: '4, 500m or 2.5',
  },
  {
    key: 'memoryLimit',
    flag: '--memory-limit',
    label: 'memory limit',
    pattern: MEMORY_QUANTITY_PATTERN,
    examples: '16Gi, 24Gi or 16384Mi',
  },
];

/** Only Developer / Techlead roles get a machine; Projektleiter do not. */
export function isDevMachineRole(role) {
  return /(?:^|[\s/(),;])(?:Developer|Techlead)(?=$|[\s/(),;])/i.test(String(role ?? ''));
}

export function slugify(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '');
}

export function normalizeHandle(handle) {
  return String(handle ?? '')
    .trim()
    .replace(/^`|`$/g, '')
    .replace(/^@/, '')
    .trim();
}

export function isValidGitHubHandle(handle) {
  return GITHUB_HANDLE_PATTERN.test(handle);
}

/** Returns a Map of lower-cased GitHub handle -> key text (never logged). */
export function parseSshKeys(teamMarkdown) {
  const keys = new Map();
  let inSection = false;

  for (const line of String(teamMarkdown ?? '').split(/\r?\n/)) {
    if (SSH_KEYS_HEADING.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && /^##\s+/.test(line)) {
      break;
    }
    if (!inSection || !line.trim().startsWith('|') || /^\|\s*:?-{2,}/.test(line.trim())) {
      continue;
    }

    const cells = line
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((cell) => cell.trim());
    if (cells.length < 2 || cells[0].toLowerCase() === 'github') {
      continue;
    }
    const handle = normalizeHandle(cells[0]);
    if (keys.has(handle.toLowerCase())) {
      throw new Error(`The GitHub handle "${handle}" appears more than once in Developer SSH Keys.`);
    }
    keys.set(handle.toLowerCase(), cells[1].replace(/^`|`$/g, '').trim());
  }

  return keys;
}

export function validateSshPublicKey(key, owner = 'developer') {
  if (/PRIVATE KEY/i.test(key)) {
    throw new Error(
      `The SSH key of ${owner} looks like a private key. Only public keys are allowed.`
    );
  }
  if (!SSH_KEY_PATTERN.test(key)) {
    throw new Error(`The SSH key of ${owner} is not a valid single-line OpenSSH public key.`);
  }
  return key;
}

/**
 * Returns `{ developers, skipped, warnings }`. `developers` are Developer/Techlead
 * members with a GitHub handle. `sshPublicKey` is `null` when team.md has no key
 * for the handle: the machine is still created, only sshd stays off (kubectl exec).
 * `skipped` lists eligible roster members without a handle (no machine name can be
 * derived), `warnings` are key rows whose handle is not in Human Members.
 * Keys are matched by GitHub handle (case-insensitive), never by display name.
 */
export function parseDevelopers(teamMarkdown) {
  const keys = parseSshKeys(teamMarkdown);
  const members = parseHumanMembers(teamMarkdown);
  const developers = [];
  const skipped = [];
  const warnings = [];
  const seen = new Map();

  const handles = new Map();
  for (const member of members) {
    const handle = normalizeHandle(member.github);
    if (!handle) {
      continue;
    }
    if (!isValidGitHubHandle(handle)) {
      throw new Error(`Invalid GitHub handle "${handle}" for ${member.name} in Human Members.`);
    }
    const previous = handles.get(handle.toLowerCase());
    if (previous) {
      throw new Error(`The GitHub handle "${handle}" is used by "${member.name}" and "${previous}".`);
    }
    handles.set(handle.toLowerCase(), member.name);
  }

  for (const handleKey of keys.keys()) {
    if (!handles.has(handleKey)) {
      warnings.push(`Ignoring SSH key row for unknown GitHub handle "${handleKey}".`);
    }
  }

  for (const member of members) {
    if (!isDevMachineRole(member.role)) {
      continue;
    }
    const handle = normalizeHandle(member.github);
    if (!handle) {
      skipped.push({
        name: member.name,
        slug: '',
        reason: 'no GitHub handle in Human Members (required for Developer/Techlead)',
      });
      continue;
    }
    const slug = slugify(handle);
    if (!slug) {
      throw new Error(`Cannot derive a machine name from GitHub handle "${handle}".`);
    }
    if (seen.has(slug)) {
      throw new Error(`"${handle}" and "${seen.get(slug)}" map to the same machine name.`);
    }
    seen.set(slug, handle);

    const key = keys.get(handle.toLowerCase());
    developers.push({
      name: member.name,
      github: handle,
      slug,
      machineName: `${MACHINE_PREFIX}${slug}`,
      sshPublicKey: key ? validateSshPublicKey(key, `${member.name} (${handle})`) : null,
    });
  }

  return { developers, skipped, warnings };
}

/**
 * Resolves cpu/memory requests and limits from render options. An `undefined` or
 * blank value falls back to `DEFAULT_RESOURCES`; anything else must be a valid
 * Kubernetes quantity, otherwise this throws with the offending value and flag.
 */
export function resolveResources(options = {}) {
  const resolved = {};
  for (const spec of RESOURCE_SPECS) {
    const raw = options[spec.key];
    const value = raw === undefined || raw === null ? '' : String(raw).trim();
    if (!value) {
      resolved[spec.key] = DEFAULT_RESOURCES[spec.key];
      continue;
    }
    if (!spec.pattern.test(value)) {
      throw new Error(
        `Invalid ${spec.label} "${value}" for ${spec.flag}: expected a Kubernetes quantity like ${spec.examples}.`
      );
    }
    resolved[spec.key] = value;
  }
  return resolved;
}

export function renderDevMachine(developer, template, options = {}) {
  const resources = resolveResources(options);
  const replacements = {
    __MACHINE_NAME__: developer.machineName,
    __NAMESPACE__: options.namespace ?? DEFAULT_NAMESPACE,
    __DEVELOPER_SLUG__: developer.slug,
    __DEVELOPER_NAME__: JSON.stringify(developer.name),
    __DEVELOPER_GITHUB__: JSON.stringify(developer.github),
    __IMAGE__: options.image ?? DEFAULT_IMAGE,
    __CPU_REQUEST__: resources.cpuRequest,
    __MEMORY_REQUEST__: resources.memoryRequest,
    __CPU_LIMIT__: resources.cpuLimit,
    __MEMORY_LIMIT__: resources.memoryLimit,
    // JSON string literal, so quoting/escaping never depends on the template;
    // an absent key becomes "" and the entrypoint skips sshd.
    __SSH_PUBLIC_KEY__: JSON.stringify(developer.sshPublicKey ?? ''),
    __REPO_URL__: JSON.stringify(options.repoUrl ?? DEFAULT_REPO_URL),
    __REPO_BRANCH__: JSON.stringify(options.repoBranch ?? DEFAULT_REPO_BRANCH),
  };
  let rendered = template.replace(/^#.*\n/gm, '');
  for (const [placeholder, value] of Object.entries(replacements)) {
    rendered = rendered.replaceAll(placeholder, value);
  }
  const leftover = rendered.match(/__[A-Z_]+__/);
  if (leftover) {
    throw new Error(`Unreplaced placeholder ${leftover[0]} in dev machine template.`);
  }
  return rendered.trim();
}

export function renderAll(developers, template, options = {}) {
  return developers
    .map((developer) => renderDevMachine(developer, template, options))
    .join('\n---\n');
}

/**
 * `existing` holds kubectl `-o name` lines such as `statefulset.apps/fd-dev-x`
 * or `service/fd-dev-x`. Returns the ones whose machine is no longer desired.
 */
export function findStale(existing, developers) {
  const desired = new Set(developers.map((developer) => developer.machineName));
  return existing
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((ref) => !desired.has(ref.slice(ref.indexOf('/') + 1)));
}

/**
 * Resolves a restart target list ("all" or comma-separated GitHub handles /
 * machine names) to machine names. Unknown entries are returned separately.
 */
export function selectMachines(targets, developers) {
  const tokens = String(targets ?? '')
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.includes('all')) {
    return { machines: developers.map((developer) => developer.machineName), unknown: [] };
  }
  const machines = [];
  const unknown = [];
  for (const token of tokens) {
    const developer = developers.find(
      (candidate) =>
        candidate.machineName === token ||
        candidate.slug === token ||
        candidate.github.toLowerCase() === token
    );
    if (!developer) {
      unknown.push(token);
    } else if (!machines.includes(developer.machineName)) {
      machines.push(developer.machineName);
    }
  }
  return { machines, unknown };
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 2) {
    options[rest[index].replace(/^--/, '')] = rest[index + 1];
  }
  return { command, options };
}

export function main(argv, { stdout = process.stdout, stderr = process.stderr, stdin } = {}) {
  const { command, options } = parseArgs(argv);
  const teamPath = options.team ?? path.join(repositoryRoot, '.squad', 'team.md');
  const { developers, skipped, warnings } = parseDevelopers(readFileSync(teamPath, 'utf8'));
  for (const warning of warnings) {
    stderr.write(`::warning::${warning}\n`);
  }
  for (const entry of skipped) {
    stderr.write(`::warning::Skipping ${entry.name}: ${entry.reason}\n`);
  }
  for (const developer of developers) {
    if (!developer.sshPublicKey) {
      stderr.write(
        `::notice::${developer.name} (${developer.github}) has no SSH public key in Developer SSH Keys; ` +
          `machine ${developer.machineName} is created without sshd and is reachable via kubectl exec only.\n`
      );
    }
  }

  if (command === 'render') {
    // Validate before rendering so an invalid dispatch input fails even when the
    // roster has no machines to render (and therefore never reaches kubectl apply).
    const resources = resolveResources({
      cpuRequest: options['cpu-request'],
      memoryRequest: options['memory-request'],
      cpuLimit: options['cpu-limit'],
      memoryLimit: options['memory-limit'],
    });
    stdout.write(
      `${renderAll(developers, readFileSync(TEMPLATE_PATH, 'utf8'), {
        namespace: options.namespace,
        image: options.image,
        repoUrl: options['repo-url'],
        repoBranch: options['repo-branch'],
        ...resources,
      })}\n`
    );
  } else if (command === 'names') {
    stdout.write(developers.map((developer) => `${developer.machineName}\n`).join(''));
  } else if (command === 'select') {
    const { machines, unknown } = selectMachines(options.targets, developers);
    for (const token of unknown) {
      stderr.write(`::warning::restart_machines: no dev machine matches "${token}"; ignored.\n`);
    }
    stdout.write(machines.map((machine) => `${machine}\n`).join(''));
  } else if (command === 'stale') {
    const existing = readFileSync(stdin ?? 0, 'utf8').split(/\r?\n/);
    stdout.write(
      findStale(existing, developers)
        .map((ref) => `${ref}\n`)
        .join('')
    );
  } else {
    stderr.write(
      'Usage: dev-machines.mjs <render|names|select|stale> [--targets list] [--team file] [--namespace ns] [--image ref]\n' +
        '       render also accepts [--cpu-request q] [--memory-request q] [--cpu-limit q] [--memory-limit q]\n' +
        '       (Kubernetes quantities; empty or omitted = 100m / 2Gi / 4 / 16Gi)\n'
    );
    return 2;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}
