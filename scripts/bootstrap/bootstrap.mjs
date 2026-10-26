#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEPLOYMENT_NAME = 'github-actions-runner';
const DEFAULT_SCOPE = 'repo';
const DEFAULT_REGISTRY = 'ghcr.io';
const GITHUB_API_VERSION = '2022-11-28';
const USER_AGENT = 'bootstrap-runner-setup';
// Der Cluster wird über einen Rancher-Proxy erreicht, der Latenz hinzufügt und
// gelegentlich eine einzelne Anfrage verwirft. kubectl hat standardmäßig „kein
// Timeout“; in der Praxis blockiert eine hängende Anfrage dann für immer, während
// ein zu kurzes Timeout normale Proxy-Latenz in ein falsches Negativ verwandelt.
// 60s liegt deutlich über der beobachteten p99 (<1s) und über den 30s, die sich
// manuell bereits als ausreichend erwiesen haben.
const KUBECTL_REQUEST_TIMEOUT = '60s';
// Sporadische Proxy-Fehler betreffen einzelne Anfragen; ein paar Wiederholungen
// mit Backoff beseitigen sie, ohne eine wirklich defekte kubeconfig zu verdecken.
const KUBECTL_RETRY_ATTEMPTS = 3;
const KUBECTL_RETRY_BACKOFF_MS = 2000;
// Docker-Registries antworten sporadisch: ein `docker push` kann alle Layer laden
// und dann den abschließenden Manifest-PUT mit einem schlichten `denied` ablehnen,
// während ein sofortiger zweiter Versuch gelingt. Drei Versuche mit kurzem linearem
// Backoff decken das ab, ohne ein falsches Passwort oder einen fehlenden Scope zu verstecken.
const DOCKER_RETRY_ATTEMPTS = 3;
const DOCKER_RETRY_BACKOFF_MS = 2000;
const CONFIG_FILENAME = 'bootstrap.json';
const CONFIG_PATH = `scripts/bootstrap/${CONFIG_FILENAME}`;
const K8S_NAMESPACE_MANIFEST_PATH = 'scripts/bootstrap/k8s/namespace.yaml';
const K8S_RBAC_TEMPLATE_PATH = 'scripts/bootstrap/k8s/rbac.yaml';
const K8S_SECRETS_TEMPLATE_PATH = 'scripts/bootstrap/k8s/runner-secrets.yaml';
const K8S_DEPLOYMENT_TEMPLATE_PATH = 'scripts/bootstrap/k8s/runner-deployment.yaml';
const DEV_BASE_CONTEXT_PATH = 'scripts/bootstrap/docker-dev-base';
const DEV_BASE_DOCKERFILE_PATH = 'scripts/bootstrap/docker-dev-base/Dockerfile';
const GH_RUNNER_CONTEXT_PATH = 'scripts/bootstrap/docker-dev-ghrunner';
const GH_RUNNER_DOCKERFILE_PATH = 'scripts/bootstrap/docker-dev-ghrunner/Dockerfile';
const KANIKO_CONTEXT_PATH = 'scripts/bootstrap/docker-dev-kaniko';
const KANIKO_DOCKERFILE_PATH = 'scripts/bootstrap/docker-dev-kaniko/Dockerfile';
const GITHUB_PAT_PROMPT =
  'Enter GITHUB_PAT (classic PAT, scopes: repo, read:packages, write:packages): ';
// Jede Image-Referenz ist projektspezifisch und wird deshalb aus Env-Variable >
// bootstrap.json > Fail-fast aufgelöst. `description` benennt nur die Einstellung,
// ist aber nie ein Paket- oder Image-Name.
const IMAGE_SETTINGS = {
  devBaseImage: {
    variableName: 'DEV_BASE_IMAGE',
    description: 'dev base image',
    buildOnlyHint: 'Set SKIP_IMAGE_BUILD=true to reuse existing images without a local build.',
  },
  ghRunnerImage: {
    variableName: 'GH_RUNNER_IMAGE',
    description: 'GitHub runner image',
    buildOnlyHint: null,
  },
  kanikoImage: {
    variableName: 'KANIKO_IMAGE',
    description: 'Kaniko image',
    buildOnlyHint: 'Set SKIP_IMAGE_BUILD=true to reuse existing images without a local build.',
  },
};
const KUBERNETES_LABEL_VALUE_MAX_LENGTH = 63;
const KUBERNETES_LABEL_VALUE_PATTERN = /^[A-Za-z0-9]([-A-Za-z0-9.]*[A-Za-z0-9])?$/;

function usage() {
  console.log(`Usage: ./scripts/bootstrap/bootstrap.mjs [options]

Bootstrap the standalone GitHub Actions self-hosted runner in Kubernetes.
The runner is installed into the namespace configured in ${CONFIG_PATH}
unless one is passed with -n/--namespace. It registers itself at the GitHub
repository level for the configured <owner>/<repo>.

${CONFIG_FILENAME} is the single source of truth for every project-specific
value. This package ships no project defaults: copy scripts/bootstrap/ into
another repository, edit ${CONFIG_FILENAME}, and run it.

Configuration precedence:
  CLI args > env vars > ${CONFIG_PATH} > neutral built-in defaults
  The namespace, the GitHub repository and every image reference have no
  built-in default: they must come from the CLI, the environment or the config
  file, otherwise bootstrap stops with an actionable error.

Options:
  -n, --namespace <namespace>  Target namespace. Defaults to the "namespace"
                               key in ${CONFIG_FILENAME}; when neither is set
                               this script stops instead of inventing a
                               namespace.
  -k, --kubeconfig <path>      Kubeconfig file used for every kubectl call.
                               Without it, bootstrap falls back to
                               $KUBECONFIG, then to the "kubeconfig" key in
                               bootstrap.json, then to the current kubectl
                               context of this machine.
  -h, --help                   Show this help text

Execution flow:
  Step 1/10 Run prerequisite checks first:
            - kubeconfig presence (when one is configured)
            - docker CLI and daemon availability (skipped when SKIP_IMAGE_BUILD=true)
            - kubectl CLI availability
            - Kubernetes cluster reachability, plus the targeted context and
              cluster name
            - required deployment files
            - GITHUB_USERNAME presence
  Step 2/10 Build the dev base image locally
  Step 3/10 Build the GitHub runner image locally
  Step 4/10 Build the Kaniko image locally
  Step 5/10 Log into ${DEFAULT_REGISTRY} and push all three images
  Step 6/10 Render/apply the runner namespace manifest
  Step 7/10 Render/apply the runner-only RBAC manifest
  Step 8/10 Render/apply the runner Secrets manifest
  Step 9/10 Render/apply the runner Deployment manifest
  Step 10/10 Wait for the Deployment rollout

Required/optional variables:
  ${CONFIG_PATH}
                               Committed non-secret defaults file. Supported keys:
                               namespace (required unless passed as
                               -n/--namespace), kubeconfig, devBaseImage,
                               ghRunnerImage, kanikoImage, skipImageBuild,
                               githubUsername, githubRunnerOrg (required),
                               githubRunnerRepo (required), runnerName,
                               runnerLabels (required), runnerScope,
                               partOf (optional, defaults to
                               githubRunnerRepo).
                               Never store GITHUB_PAT there. If the config file
                               contains any PAT-like GitHub key, this script
                               refuses to run until it is removed.

  KUBECONFIG                   Optional kubeconfig path passed to every kubectl
                               call (cluster-info, apply, rollout restart,
                               rollout status). Precedence:
                               -k/--kubeconfig > KUBECONFIG > bootstrap.json
                               "kubeconfig" key > current kubectl context.
                               Linux/macOS:
                                 export KUBECONFIG=~/.kube/config
                               Windows PS:
                                 $env:KUBECONFIG = "<path-to-kubeconfig>"

  DEV_BASE_IMAGE               Dev base image reference to build/push in Step 2
                               and reuse as the Step 3 parent image.
                               Required unless SKIP_IMAGE_BUILD=true. No
                               built-in value:
                                 set "devBaseImage" in bootstrap.json
                                 or export DEV_BASE_IMAGE

  GH_RUNNER_IMAGE              GitHub runner image reference to build, push,
                               and deploy in Steps 3, 5, and 9.
                               Required on every run, because Step 9 always
                               deploys it. No built-in value:
                                 set "ghRunnerImage" in bootstrap.json
                                 or export GH_RUNNER_IMAGE

  KANIKO_IMAGE                 Kaniko image reference to build and push in
                               Steps 4 and 5. The deploy workflow uses this
                               image for throwaway Kaniko build Jobs; bootstrap
                               does not create those Jobs.
                               Required unless SKIP_IMAGE_BUILD=true. No
                               built-in value:
                                 set "kanikoImage" in bootstrap.json
                                 or export KANIKO_IMAGE

  SKIP_IMAGE_BUILD             Optional. Set to true to skip Steps 2 through 5
                               (docker builds, login, and image pushes),
                               for example when all images already exist.
                               Default: false.
                               Linux/macOS:
                                 export SKIP_IMAGE_BUILD=true
                               Windows PS:
                                 $env:SKIP_IMAGE_BUILD = "true"

  GITHUB_PAT                   Required classic GitHub Personal Access Token
                               used for THREE things:
                               - docker login to ghcr.io
                               - the Kubernetes GHCR imagePullSecret
                               - POST /repos/{owner}/{repo}/actions/runners/registration-token
                               Use a classic PAT only. Do NOT use a fine-grained
                               PAT and do NOT use a GitHub App token here.
                               If GITHUB_PAT is not set and stdin is an
                               interactive TTY, the script prompts for it with
                               masked input instead of echoing the token.
                               Create it exactly as follows:
                               1. GitHub -> Settings -> Developer settings
                               2. Personal access tokens
                               3. Tokens (classic)
                               4. Generate new token (classic)
                               5. Enable scopes:
                                  - repo
                                  - read:packages
                                  - write:packages
                               6. If the organization enforces SSO, authorize
                                  the token for SSO after creation.
                               Linux/macOS:
                                 export GITHUB_PAT=ghp_xxxxx
                               Windows PS:
                                 $env:GITHUB_PAT = "ghp_xxxxx"

  GITHUB_USERNAME              Required for docker login/push and for the
                               Kubernetes GHCR imagePullSecret template.
                               Example:
                                 octocat
                               Linux/macOS:
                                 export GITHUB_USERNAME=octocat
                               Windows PS:
                                 $env:GITHUB_USERNAME = "octocat"

  GITHUB_RUNNER_ORG            GitHub organization or user login used to
                               derive REPO_URL.
                               Required. No built-in value:
                                 set "githubRunnerOrg" in bootstrap.json
                                 or export GITHUB_RUNNER_ORG

  GITHUB_RUNNER_REPO           GitHub repository name used to derive REPO_URL
                               and as the fallback for the part-of label.
                               Required. No built-in value:
                                 set "githubRunnerRepo" in bootstrap.json
                                 or export GITHUB_RUNNER_REPO

  REPO_URL                     Derived runner registration target passed to the
                               container.
                               Default:
                                 https://github.com/<owner>/<repo>

  RUNNER_NAME                  Optional descriptive runner name.
                               Set "runnerName" in bootstrap.json to pin it;
                               the built-in fallback is
                               github-actions-runner-<namespace> so that
                               runners from different namespaces registered
                               against the same repository cannot collide.
                               Linux/macOS: export RUNNER_NAME=<runner-name>
                               Windows PS:  $env:RUNNER_NAME = "<runner-name>"

  RUNNER_LABELS                Comma-separated runner labels stored in the
                               Secret.
                               Required. No built-in value:
                                 set "runnerLabels" in bootstrap.json
                                 or export RUNNER_LABELS
                               Linux/macOS: export RUNNER_LABELS=<label>
                               Windows PS:  $env:RUNNER_LABELS = "<label>"

  RUNNER_SCOPE                 Optional compatibility variable stored in the
                               Secret and passed into the runner container.
                               Default: repo.

Examples:
  export GITHUB_PAT=ghp_xxxxx
  export GITHUB_USERNAME=octocat
  node scripts/bootstrap/bootstrap.mjs --namespace <namespace>

  $env:GITHUB_PAT = "ghp_xxxxx"
  $env:GITHUB_USERNAME = "octocat"
  .\\scripts\\bootstrap\\bootstrap.ps1 -Namespace <namespace> -Kubeconfig <path-to-kubeconfig>

  node scripts/bootstrap/bootstrap.mjs --kubeconfig <path-to-kubeconfig>`);
}

function logStep(message) {
  console.log(`▶ ${message}`);
}

function logSuccess(message) {
  console.log(`✅ ${message}`);
}

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function isTrue(value) {
  return value ? ['1', 'true', 'yes', 'on'].includes(value.toLowerCase()) : false;
}

function normalizeConfigKey(key) {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function isForbiddenConfigSecretKey(key) {
  const normalizedKey = normalizeConfigKey(key);

  return (
    normalizedKey.includes('githubpat') ||
    normalizedKey.includes('githubtoken') ||
    normalizedKey.includes('githubaccesstoken') ||
    normalizedKey.includes('githubpersonalaccesstoken') ||
    normalizedKey.includes('githubclassicpat') ||
    (normalizedKey.includes('github') && normalizedKey.endsWith('pat'))
  );
}

function findForbiddenConfigSecretKey(value, pathPrefix = '') {
  if (!value || typeof value !== 'object') {
    return null;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;

    if (isForbiddenConfigSecretKey(key)) {
      return currentPath;
    }

    const nestedMatch = findForbiddenConfigSecretKey(nestedValue, currentPath);
    if (nestedMatch) {
      return nestedMatch;
    }
  }

  return null;
}

function loadBootstrapConfig(scriptDir) {
  const configPath = path.join(scriptDir, CONFIG_FILENAME);

  if (!existsSync(configPath)) {
    return {};
  }

  let parsedConfig;
  try {
    parsedConfig = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (error) {
    fail(
      `Could not parse ${configPath} as JSON: ${error instanceof Error ? error.message : 'unknown parse error'}`
    );
  }

  if (!parsedConfig || Array.isArray(parsedConfig) || typeof parsedConfig !== 'object') {
    fail(`${configPath} must contain a top-level JSON object.`);
  }

  const forbiddenKeyPath = findForbiddenConfigSecretKey(parsedConfig);
  if (forbiddenKeyPath) {
    fail(
      `Refusing to continue because ${configPath} contains a forbidden secret field (${forbiddenKeyPath}). Remove it and provide GITHUB_PAT via the environment or the interactive prompt instead.`
    );
  }

  return parsedConfig;
}

function resolveStringOption({ cliValue, envValue, configValue, defaultValue }) {
  if (typeof cliValue === 'string' && cliValue.length > 0) {
    return cliValue;
  }

  if (typeof envValue === 'string' && envValue.length > 0) {
    return envValue;
  }

  if (typeof configValue === 'string' && configValue.length > 0) {
    return configValue;
  }

  return defaultValue;
}

function resolveBooleanOption({ envValue, configValue, defaultValue }) {
  if (typeof envValue === 'string' && envValue.length > 0) {
    return isTrue(envValue);
  }

  if (typeof configValue === 'boolean') {
    return configValue;
  }

  if (typeof configValue === 'string' && configValue.length > 0) {
    return isTrue(configValue);
  }

  return defaultValue;
}

export function resolveImageBuildSettings(config, environment = process.env) {
  const skipImageBuild = resolveBooleanOption({
    envValue: environment.SKIP_IMAGE_BUILD,
    configValue: config.skipImageBuild,
    defaultValue: false,
  });

  return {
    // Das Deployment referenziert immer das Runner-Image, es ist also bei jedem
    // Lauf nötig. Die beiden anderen speisen nur die lokalen Build-/Push-Steps;
    // ein Lauf mit SKIP_IMAGE_BUILD=true darf Build-only-Einstellungen daher nicht verlangen.
    devBaseImage: resolveImageReference({
      setting: 'devBaseImage',
      envValue: environment.DEV_BASE_IMAGE,
      configValue: config.devBaseImage,
      required: !skipImageBuild,
    }),
    ghRunnerImage: resolveImageReference({
      setting: 'ghRunnerImage',
      envValue: environment.GH_RUNNER_IMAGE,
      configValue: config.ghRunnerImage,
      required: true,
    }),
    kanikoImage: resolveImageReference({
      setting: 'kanikoImage',
      envValue: environment.KANIKO_IMAGE,
      configValue: config.kanikoImage,
      required: !skipImageBuild,
    }),
    skipImageBuild,
  };
}

function missingImageReferenceMessage(setting, { required }) {
  const { variableName, description, buildOnlyHint } = IMAGE_SETTINGS[setting];

  return [
    `No ${description} reference resolved. Set "${setting}" in ${CONFIG_PATH} or export ${variableName}.`,
    `${CONFIG_FILENAME} is the single source of truth for project-specific values; this script has no built-in image defaults.`,
    required ? buildOnlyHint : 'This setting is only required when images are built locally.',
  ]
    .filter(Boolean)
    .join('\n');
}

function resolveImageReference({ setting, envValue, configValue, required }) {
  const image = resolveStringOption({ envValue, configValue, defaultValue: undefined });

  if (!image && required) {
    fail(missingImageReferenceMessage(setting, { required }));
  }

  return image;
}

// Build-only-Einstellungen dürfen bei SKIP_IMAGE_BUILD=true ungesetzt sein; das
// Skip-Log nennt dann die Einstellung, statt „undefined“ zu drucken.
function describeImageForLog(image, setting) {
  return image ?? `<not configured: ${setting}>`;
}

// Ein aufgelöster Wert, den es nur in diesem Repository gibt, ist nicht portabel:
// das Paket muss für jedes Projekt funktionieren, also kommt die Projektidentität
// immer aus der Konfigurationsdatei und nie aus einem eingebauten Literal.
function resolveProjectOption({ envValue, envName, configValue, configKey }) {
  const value = resolveStringOption({ envValue, configValue, defaultValue: undefined });

  if (!value) {
    fail(
      [
        `No ${configKey} resolved. Set "${configKey}" in ${CONFIG_PATH} or export ${envName}.`,
        `${CONFIG_FILENAME} is the single source of truth for project-specific values; this script has no built-in project defaults.`,
      ].join('\n')
    );
  }

  return value;
}

export function isValidKubernetesLabelValue(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= KUBERNETES_LABEL_VALUE_MAX_LENGTH &&
    KUBERNETES_LABEL_VALUE_PATTERN.test(value)
  );
}

// `app.kubernetes.io/part-of` benennt die zugehörige Anwendung. Ein expliziter
// `partOf`-Schlüssel gewinnt; sonst ist der Repository-Name ein sinnvoller, bereits
// gültiger Default. Wird vorab validiert, damit kubectl den Apply nicht später ablehnt.
export function resolvePartOfLabel(config, runnerRepo) {
  const configuredPartOf =
    typeof config.partOf === 'string' && config.partOf.length > 0 ? config.partOf : undefined;
  const partOf = configuredPartOf ?? runnerRepo;

  if (!isValidKubernetesLabelValue(partOf)) {
    fail(
      [
        `Invalid app.kubernetes.io/part-of value: "${partOf}".`,
        `Kubernetes label values must be 1-${KUBERNETES_LABEL_VALUE_MAX_LENGTH} characters of A-Z, a-z, 0-9, "-" or ".", and must start and end with an alphanumeric character.`,
        `Fix "partOf" in ${CONFIG_PATH}, or "githubRunnerRepo" which it falls back to.`,
      ].join('\n')
    );
  }

  return partOf;
}

async function promptForHiddenInput(promptText) {
  process.stdout.write(promptText);

  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    let inputValue = '';
    let finished = false;

    const cleanup = () => {
      stdin.removeListener('data', onData);
      stdin.removeListener('error', onError);
      if (typeof stdin.setRawMode === 'function') {
        stdin.setRawMode(false);
      }
      stdin.pause();
      // TTY-Handle aus dem Event-Loop nehmen, damit ein späteres process.exit()
      // keinen noch referenzierten stdin-Reader abräumt (libuv-Assertion unter Windows).
      stdin.unref();
    };

    const complete = (callback) => {
      if (finished) {
        return;
      }

      finished = true;
      cleanup();
      callback();
    };

    const onError = (error) => {
      process.stdout.write('\n');
      complete(() =>
        reject(error instanceof Error ? error : new Error('Failed while reading hidden input.'))
      );
    };

    const onData = (chunk) => {
      const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');

      for (const character of text) {
        if (character === '\u0003' || character === '\u0004') {
          process.stdout.write('\n');
          complete(() => reject(new Error('Aborted while reading hidden input.')));
          return;
        }

        if (character === '\r' || character === '\n') {
          process.stdout.write('\n');
          complete(() => resolve(inputValue));
          return;
        }

        if (character === '\u0008' || character === '\u007f') {
          if (inputValue.length > 0) {
            inputValue = inputValue.slice(0, -1);
            process.stdout.write('\b \b');
          }
          continue;
        }

        if (character >= ' ') {
          inputValue += character;
          process.stdout.write('*');
        }
      }
    };

    stdin.on('data', onData);
    stdin.on('error', onError);
    stdin.setEncoding('utf8');
    if (typeof stdin.setRawMode === 'function') {
      stdin.setRawMode(true);
    }
    stdin.resume();
  });
}

async function resolveGitHubPat() {
  if (process.env.GITHUB_PAT) {
    return process.env.GITHUB_PAT;
  }

  if (!process.stdin.isTTY) {
    fail(missingGitHubPatMessage());
  }

  const githubPat = await promptForHiddenInput(GITHUB_PAT_PROMPT);
  if (!githubPat) {
    fail('GITHUB_PAT cannot be empty.');
  }

  return githubPat;
}

function runCommand(command, args, options = {}) {
  const { captureOutput = false, input, stdio, missingBinaryMessage } = options;
  const resolvedStdio =
    stdio ??
    (captureOutput
      ? ['pipe', 'pipe', 'inherit']
      : input
        ? ['pipe', 'inherit', 'inherit']
        : 'inherit');

  try {
    return execFileSync(command, args, {
      encoding: captureOutput ? 'utf8' : undefined,
      input,
      stdio: resolvedStdio,
    });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      if (missingBinaryMessage) {
        fail(missingBinaryMessage);
      }
    }
    throw error;
  }
}

// `--request-timeout` begrenzt eine einzelne API-Anfrage. Es darf nicht an
// Watch-Subkommandos (`rollout status`) gehängt werden, wo es den Watch lange vor
// dem eigenen `--timeout` des Kommandos abbrechen würde.
function supportsRequestTimeout(args) {
  if (args.includes('--client=true') || args.includes('--client')) {
    return false;
  }

  return !(args[0] === 'rollout' && args[1] === 'status');
}

// Einmal in main() aufgelöst (CLI > KUBECONFIG > bootstrap.json) und dann an jeden
// kubectl-Aufruf gehängt, damit nie versehentlich ein maschinenweiter Kontext greift.
let activeKubeconfigPath = null;

function setActiveKubeconfig(kubeconfigPath) {
  activeKubeconfigPath = kubeconfigPath ?? null;
}

function withKubeconfigFlag(args) {
  if (!activeKubeconfigPath) {
    return args;
  }

  return [...args, '--kubeconfig', activeKubeconfigPath];
}

function runKubectl(args, options = {}) {
  const effectiveArgs =
    supportsRequestTimeout(args) && !args.some((arg) => arg.startsWith('--request-timeout'))
      ? [...args, `--request-timeout=${KUBECTL_REQUEST_TIMEOUT}`]
      : args;

  return runCommand('kubectl', withKubeconfigFlag(effectiveArgs), options);
}

// Rendert dieselbe kubectl-Kommandozeile, die dieses Skript ausführen würde, für
// Bedienhinweise in Fehlermeldungen.
function kubectlHint(args) {
  const commandParts = ['kubectl'];

  if (activeKubeconfigPath) {
    commandParts.push('--kubeconfig', activeKubeconfigPath);
  }

  return [...commandParts, ...args].join(' ');
}

function describeCommandFailure(error) {
  if (!error || typeof error !== 'object') {
    return 'unknown failure';
  }

  const exitCode = 'status' in error && error.status !== null ? error.status : 'n/a';
  const stderr =
    'stderr' in error && error.stderr ? String(error.stderr).trim() : (error.message ?? '').trim();

  return [`exit code ${exitCode}`, stderr ? `kubectl said: ${stderr}` : null]
    .filter(Boolean)
    .join(' — ');
}

function sleepSync(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

// Wiederholt eine lesende kubectl-Probe und liefert die gesammelten Fehlergründe
// zurück, statt sie zu verschlucken, damit ein falsches Negativ sich selbst erklärt.
function runKubectlWithRetry(args, { attempts = KUBECTL_RETRY_ATTEMPTS, ...options } = {}) {
  const failures = [];

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      runKubectl(args, { ...options, stdio: ['ignore', 'ignore', 'pipe'] });
      return { ok: true, failures };
    } catch (error) {
      failures.push(`attempt ${attempt}/${attempts}: ${describeCommandFailure(error)}`);

      if (attempt < attempts) {
        console.log(`  • kubectl probe failed, retrying in ${KUBECTL_RETRY_BACKOFF_MS / 1000}s...`);
        sleepSync(KUBECTL_RETRY_BACKOFF_MS * attempt);
      }
    }
  }

  return { ok: false, failures };
}

function runDocker(args, options = {}) {
  return runCommand('docker', args, options);
}

const MISSING_DOCKER_MESSAGE =
  'Docker is required to build and push the bootstrap images (dev base, GitHub runner, Kaniko). Install Docker Desktop or the Docker Engine CLI and try again.';

// Credential-Probleme sehen auf den ersten Blick wie sporadische Fehler aus
// („denied“, „unauthorized“), aber kein Retry behebt sie; sie gewinnen daher gegen
// jedes transiente Muster.
const DOCKER_NON_TRANSIENT_PATTERNS = [
  'incorrect username or password',
  'not authorized',
  'does not match expected scopes',
  'invalid username or password',
  'authentication required',
];

// Signale im Gesamttext, die auf eine wackelige Registry oder einen Netzwerkpfad deuten.
const DOCKER_TRANSIENT_PATTERNS = [
  'connection reset',
  'i/o timeout',
  'tls handshake',
  'unexpected eof',
  'eof',
  'toomanyrequests',
  'secondary rate limit',
  'too many requests',
  'bad gateway',
  'service unavailable',
  'gateway timeout',
];
const DOCKER_TRANSIENT_HTTP_STATUS_PATTERN = /\b(?:502|503|504)\b/;

// `denied` / `permission_denied` / `unauthorized` werden nur wiederholt, wenn
// dieselbe Meldung zusätzlich ein serverseitiges oder Rate-Limit-Signal trägt: für
// sich allein bedeuten sie, dass dem Token der nötige Scope für diesen Push fehlt.
const DOCKER_CONDITIONAL_TRANSIENT_PATTERNS = ['denied', 'unauthorized'];
const DOCKER_SERVER_SIDE_HTTP_STATUS_PATTERN = /\b(?:500|502|503|504)\b/;
const DOCKER_SERVER_SIDE_PATTERNS = [
  'internal server error',
  'bad gateway',
  'service unavailable',
  'gateway timeout',
  'toomanyrequests',
  'secondary rate limit',
  'too many requests',
];

function extractFailureText(error) {
  if (!error || typeof error !== 'object') {
    return typeof error === 'string' ? error : '';
  }

  return [error.stderr, error.stdout, error.message]
    .filter((part) => typeof part === 'string' && part.trim().length > 0)
    .join('\n')
    .trim();
}

function summarizeFailureText(text) {
  const firstMeaningfulLine = text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  return firstMeaningfulLine ?? 'unknown failure';
}

export function isTransientDockerFailure(message) {
  const text = String(message ?? '').toLowerCase();

  if (text.length === 0) {
    return false;
  }

  if (DOCKER_NON_TRANSIENT_PATTERNS.some((pattern) => text.includes(pattern))) {
    return false;
  }

  if (DOCKER_TRANSIENT_HTTP_STATUS_PATTERN.test(text)) {
    return true;
  }

  if (DOCKER_TRANSIENT_PATTERNS.some((pattern) => text.includes(pattern))) {
    return true;
  }

  if (DOCKER_CONDITIONAL_TRANSIENT_PATTERNS.some((pattern) => text.includes(pattern))) {
    return (
      DOCKER_SERVER_SIDE_HTTP_STATUS_PATTERN.test(text) ||
      DOCKER_SERVER_SIDE_PATTERNS.some((pattern) => text.includes(pattern))
    );
  }

  return false;
}

// Die Formulierung der Registry ist nur sichtbar, weil stderr mitgeschnitten wird;
// sie wird an den erneut geworfenen Fehler gehängt, damit die Ausgabe vollständig bleibt.
function withFailureText(error, failureText) {
  const annotated = error instanceof Error ? error : new Error(String(error));

  if (failureText.length > 0 && !annotated.message.includes(failureText)) {
    annotated.message = `${annotated.message}\n${failureText}`;
  }

  return annotated;
}

// Gemeinsam von `docker login` und `docker push` genutzt: beide kann derselbe
// sporadische Registry-Aussetzer treffen, und beide müssen echte Credential-Probleme
// sofort melden. `invoke` wird injiziert, damit die Retry-Policy ohne Docker-Daemon
// testbar ist.
export function retryTransientDockerFailure({
  label,
  invoke,
  attempts = DOCKER_RETRY_ATTEMPTS,
  backoffMs = DOCKER_RETRY_BACKOFF_MS,
  sleep = sleepSync,
  logger = console,
}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      invoke();
      return { attemptsUsed: attempt };
    } catch (error) {
      const failureText = extractFailureText(error);
      const reason = summarizeFailureText(failureText);

      if (!isTransientDockerFailure(failureText)) {
        logger.error(`  • ${label} failed and is not retryable: ${reason}`);
        throw withFailureText(error, failureText);
      }

      if (attempt >= attempts) {
        logger.error(`  • ${label} still failing after ${attempts} attempts: ${reason}`);
        throw withFailureText(error, failureText);
      }

      const waitMs = backoffMs * attempt;
      logger.log(
        `  • ${label} hit a transient failure (${reason}); retrying in ${waitMs / 1000}s (attempt ${attempt + 1}/${attempts})...`
      );
      sleep(waitMs);
    }
  }

  throw new Error(`${label} failed: no attempt was made.`);
}

function parseArgs(argv) {
  let namespace;
  let kubeconfig;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '-h' || arg === '--help') {
      usage();
      process.exit(0);
    }

    if (arg === '-n' || arg === '--namespace') {
      const value = argv[index + 1];
      if (!value) {
        fail(`Missing value for ${arg}. See --help for usage.`);
      }
      namespace = value;
      index += 1;
      continue;
    }

    if (arg === '-k' || arg === '--kubeconfig') {
      const value = argv[index + 1];
      if (!value) {
        fail(`Missing value for ${arg}. See --help for usage.`);
      }
      kubeconfig = value;
      index += 1;
      continue;
    }

    fail(`Unknown argument: ${arg}. See --help for usage.`);
  }

  return { namespace, kubeconfig };
}

function ensureRequiredFiles(scriptDir) {
  const requiredFiles = {
    namespacesPath: path.join(scriptDir, 'k8s', 'namespace.yaml'),
    rbacTemplatePath: path.join(scriptDir, 'k8s', 'rbac.yaml'),
    secretsTemplatePath: path.join(scriptDir, 'k8s', 'runner-secrets.yaml'),
    deploymentTemplatePath: path.join(scriptDir, 'k8s', 'runner-deployment.yaml'),
    devBaseContextPath: path.join(scriptDir, 'docker-dev-base'),
    devBaseDockerfilePath: path.join(scriptDir, 'docker-dev-base', 'Dockerfile'),
    ghRunnerContextPath: path.join(scriptDir, 'docker-dev-ghrunner'),
    ghRunnerDockerfilePath: path.join(scriptDir, 'docker-dev-ghrunner', 'Dockerfile'),
    kanikoContextPath: path.join(scriptDir, 'docker-dev-kaniko'),
    kanikoDockerfilePath: path.join(scriptDir, 'docker-dev-kaniko', 'Dockerfile'),
  };

  for (const [label, filePath] of Object.entries(requiredFiles)) {
    if (!existsSync(filePath)) {
      fail(`Missing required ${label} path: ${filePath}`);
    }
  }

  return requiredFiles;
}

function buildRepoUrl(runnerOrg, runnerRepo) {
  return `https://github.com/${runnerOrg}/${runnerRepo}`;
}

function formatBlockScalarValue(text, spaces = 4) {
  const indentation = ' '.repeat(spaces);
  return text.split('\n').join(`\n${indentation}`);
}

export function renderTemplate(templatePath, replacements) {
  let template;
  try {
    template = readFileSync(templatePath, 'utf8');
  } catch (error) {
    fail(
      `Could not read ${templatePath}: ${error instanceof Error ? error.message : 'unknown read error'}`
    );
  }

  let rendered = template;
  for (const [placeholder, value] of Object.entries(replacements)) {
    rendered = rendered.replaceAll(placeholder, value);
  }

  // Auf einer kommentarfreien Kopie validieren: ein platzhalterförmiger Token in einem
  // YAML-Kommentar ist Dokumentation, kein Substitutionsziel.
  const renderedWithoutComments = rendered
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');

  const unresolvedPlaceholders = Array.from(
    new Set(renderedWithoutComments.match(/__[A-Z0-9_]+__/g) ?? [])
  );
  if (unresolvedPlaceholders.length > 0) {
    fail(
      `Template ${templatePath} still contains unresolved placeholders: ${unresolvedPlaceholders.join(', ')}`
    );
  }

  return rendered;
}

function buildGhcrDockerConfigJson(githubUsername, githubPat) {
  return JSON.stringify(
    {
      auths: {
        [DEFAULT_REGISTRY]: {
          username: githubUsername,
          password: githubPat,
          auth: Buffer.from(`${githubUsername}:${githubPat}`, 'utf8').toString('base64'),
        },
      },
    },
    null,
    2
  );
}

function applyYaml(yaml) {
  runKubectl(['apply', '-f', '-'], { input: yaml });
}

function missingGitHubPatMessage() {
  return [
    'GITHUB_PAT is not set.',
    'Create a classic Personal Access Token first.',
    'GitHub -> Settings -> Developer settings -> Personal access tokens -> Tokens (classic).',
    'Choose "Generate new token (classic)" and grant: repo, read:packages, write:packages.',
    'Do not use a fine-grained PAT and do not use a GitHub App token here.',
    'If your organization enforces SSO, authorize the token for SSO after creation.',
    'Linux/macOS: export GITHUB_PAT=ghp_xxxxx',
    'Windows PowerShell: $env:GITHUB_PAT = "ghp_xxxxx"',
    'Run --help for the full step-by-step instructions.',
  ].join('\n');
}

function missingGitHubUsernameMessage() {
  return [
    'GITHUB_USERNAME is not set.',
    'The script needs it together with GITHUB_PAT for docker login ghcr.io and for the Kubernetes GHCR imagePullSecret template.',
    'Linux/macOS: export GITHUB_USERNAME=octocat',
    'Windows PowerShell: $env:GITHUB_USERNAME = "octocat"',
  ].join('\n');
}

function nonGhcrImageMessage(variableName, image) {
  return [
    `${variableName}=${image} is not a GHCR image reference.`,
    `This script\'s built-in docker login/push steps currently target ${DEFAULT_REGISTRY}.`,
    `Use a ${DEFAULT_REGISTRY}/... image tag when building here, or set SKIP_IMAGE_BUILD=true to reuse existing images.`,
  ].join('\n');
}

function validateGhcrImageRef(variableName, image) {
  if (!image.toLowerCase().startsWith(`${DEFAULT_REGISTRY}/`)) {
    fail(nonGhcrImageMessage(variableName, image));
  }
}

function loginToGhcr(githubUsername, githubPat) {
  console.log(`  • docker login ${DEFAULT_REGISTRY} as ${githubUsername}`);
  retryTransientDockerFailure({
    label: `docker login ${DEFAULT_REGISTRY}`,
    invoke: () =>
      runDocker(['login', DEFAULT_REGISTRY, '--username', githubUsername, '--password-stdin'], {
        input: `${githubPat}\n`,
        // Nur stderr mitschneiden: Passwort-Prompt und Fortschritt bleiben sichtbar,
        // und der Fehlertext der Registry steht für die Retry-Klassifikation bereit.
        stdio: ['pipe', 'inherit', 'pipe'],
        missingBinaryMessage: MISSING_DOCKER_MESSAGE,
      }),
  });
}

function buildDockerImage({ image, dockerfilePath, contextPath, buildArgs = [] }) {
  runDocker(
    [
      'build',
      '--file',
      dockerfilePath,
      '--tag',
      image,
      ...buildArgs.flatMap(([name, value]) => ['--build-arg', `${name}=${value}`]),
      contextPath,
    ],
    { missingBinaryMessage: MISSING_DOCKER_MESSAGE }
  );
}

function pushDockerImage(image) {
  retryTransientDockerFailure({
    label: `docker push ${image}`,
    invoke: () =>
      runDocker(['push', image], {
        // Nur stderr mitschneiden: der Layer-Fortschritt bleibt auf stdout, und der
        // Manifest-Fehler (z. B. ein schlichtes „denied“) steht für die
        // Retry-Entscheidung bereit, statt nur gedruckt zu werden.
        stdio: ['ignore', 'inherit', 'pipe'],
        missingBinaryMessage: MISSING_DOCKER_MESSAGE,
      }),
  });
}

function checkDockerCliAvailable() {
  try {
    runDocker(['--version'], {
      stdio: 'ignore',
      missingBinaryMessage: MISSING_DOCKER_MESSAGE,
    });
  } catch {
    fail(MISSING_DOCKER_MESSAGE);
  }
}

function checkDockerDaemonReachable() {
  try {
    runDocker(['info'], {
      stdio: 'ignore',
      missingBinaryMessage: MISSING_DOCKER_MESSAGE,
    });
  } catch {
    fail(
      'Docker CLI found, but the Docker daemon is not reachable. Start Docker Desktop / the Docker service and try again.'
    );
  }
}

function checkKubectlCliAvailable() {
  try {
    runKubectl(['version', '--client=true', '--output=yaml'], {
      stdio: 'ignore',
      missingBinaryMessage:
        'kubectl is required but was not found in PATH. Install kubectl and try again.',
    });
  } catch {
    fail(
      'kubectl is installed but not callable. Reinstall kubectl or fix your PATH and try again.'
    );
  }
}

function validateKubeconfigPath(kubeconfigPath) {
  if (!kubeconfigPath) {
    return;
  }

  if (!existsSync(kubeconfigPath)) {
    fail(
      [
        `Kubeconfig not found: ${kubeconfigPath}`,
        'Pass an existing file via -k/--kubeconfig, set KUBECONFIG, or remove the `kubeconfig` key from bootstrap.json.',
        'Nothing was applied to any cluster.',
      ].join('\n')
    );
  }
}

function captureKubectlValue(args) {
  try {
    const output = runKubectl(args, { captureOutput: true, stdio: ['ignore', 'pipe', 'ignore'] });
    const value = typeof output === 'string' ? output.trim() : '';

    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

function readServerVersion() {
  const raw = captureKubectlValue(['version', '-o', 'json']);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw).serverVersion?.gitVersion ?? null;
  } catch {
    return null;
  }
}

// Vor jedem Apply muss sichtbar sein, welcher Cluster das Ziel ist; sonst
// bootstrappt eine veraltete kubeconfig still den falschen Cluster. Die
// Rancher-Cluster-ID steht nur in der Server-URL, deshalb wird sie neben dem
// schlichten Cluster-Namen aus der kubeconfig ausgegeben.
function reportTargetCluster() {
  console.log(
    `  • kubeconfig: ${activeKubeconfigPath ?? '(none, using current kubectl context)'}`
  );

  const contextName = captureKubectlValue(['config', 'current-context']);
  const clusterName = captureKubectlValue([
    'config',
    'view',
    '--minify',
    '-o',
    'jsonpath={.contexts[0].context.cluster}',
  ]);
  const serverUrl = captureKubectlValue([
    'config',
    'view',
    '--minify',
    '-o',
    'jsonpath={.clusters[0].cluster.server}',
  ]);
  const serverVersion = readServerVersion();

  console.log(`  • context: ${contextName ?? '(unknown)'}`);
  console.log(`  • cluster: ${clusterName ?? '(unknown)'}`);
  console.log(`  • server: ${serverUrl ?? '(unknown)'}`);

  if (serverVersion) {
    console.log(`  • server version: ${serverVersion}`);
  }
}

function checkKubernetesClusterReachable() {
  const connectivity = runKubectlWithRetry(['cluster-info'], {
    missingBinaryMessage:
      'kubectl is required but was not found in PATH. Install kubectl and try again.',
  });

  if (!connectivity.ok) {
    fail(
      [
        `kubectl could not reach the target cluster after ${KUBECTL_RETRY_ATTEMPTS} attempts.`,
        ...connectivity.failures.map((entry) => `  ${entry}`),
        `Each attempt used --request-timeout=${KUBECTL_REQUEST_TIMEOUT}.`,
        `Verify your kubeconfig/context with: ${kubectlHint(['cluster-info'])}`,
      ].join('\n')
    );
  }
}

function runPrerequisiteChecks({
  skipImageBuild,
  githubUsername,
  devBaseImage,
  ghRunnerImage,
  kanikoImage,
}) {
  logStep('Step 1/10: Running prerequisite checks...');

  validateKubeconfigPath(activeKubeconfigPath);

  if (skipImageBuild) {
    console.log('  • SKIP_IMAGE_BUILD=true, skipping Docker CLI and daemon checks');
  } else {
    checkDockerCliAvailable();
    checkDockerDaemonReachable();
  }

  checkKubectlCliAvailable();
  checkKubernetesClusterReachable();
  reportTargetCluster();

  const requiredFiles = ensureRequiredFiles(__dirname);

  if (!githubUsername) {
    fail(missingGitHubUsernameMessage());
  }

  if (!skipImageBuild) {
    validateGhcrImageRef('DEV_BASE_IMAGE', devBaseImage);
    validateGhcrImageRef('GH_RUNNER_IMAGE', ghRunnerImage);
    validateGhcrImageRef('KANIKO_IMAGE', kanikoImage);
  }

  logSuccess('Prerequisite checks passed');

  return requiredFiles;
}

function buildRegistrationTokenErrorMessage(status, runnerOrg, runnerRepo, details) {
  const repoUrl = buildRepoUrl(runnerOrg, runnerRepo);
  const guidance =
    status === 401
      ? 'Likely causes: GITHUB_PAT is expired, revoked, malformed, or not a classic PAT.'
      : status === 403
        ? 'Likely causes: the classic PAT is missing the repo scope, the account lacks repo admin access, or SSO authorization is still required for the organization.'
        : status === 404
          ? 'Likely causes: GITHUB_RUNNER_ORG / GITHUB_RUNNER_REPO is wrong, or the PAT cannot see this repository.'
          : 'Likely causes: invalid PAT, missing repo scope, wrong owner/repo, or missing SSO authorization.';

  return [
    `GitHub API returned ${status} while requesting a runner registration token for ${repoUrl}.`,
    details ? `GitHub said: ${details}` : null,
    guidance,
    'Required classic PAT scopes for this bootstrap flow: repo, read:packages, write:packages.',
    'Linux/macOS: export GITHUB_PAT=ghp_xxxxx',
    'Windows PowerShell: $env:GITHUB_PAT = "ghp_xxxxx"',
  ]
    .filter(Boolean)
    .join('\n');
}

async function fetchRunnerRegistrationToken(runnerOrg, runnerRepo, githubPat) {
  const endpoint = `https://api.github.com/repos/${runnerOrg}/${runnerRepo}/actions/runners/registration-token`;

  console.log(`  • POST ${endpoint}`);

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${githubPat}`,
        'User-Agent': USER_AGENT,
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
      },
    });
  } catch (error) {
    fail(
      `Could not reach the GitHub API to request a runner registration token: ${error instanceof Error ? error.message : 'network request failed'}`
    );
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const details =
    payload &&
    typeof payload === 'object' &&
    'message' in payload &&
    typeof payload.message === 'string'
      ? payload.message
      : null;

  if (!response.ok) {
    fail(buildRegistrationTokenErrorMessage(response.status, runnerOrg, runnerRepo, details));
  }

  if (
    !payload ||
    typeof payload !== 'object' ||
    !('token' in payload) ||
    typeof payload.token !== 'string' ||
    payload.token.length === 0
  ) {
    fail('GitHub API did not return a usable registration token in the response body.');
  }

  return payload.token;
}

async function main() {
  const { namespace: namespaceArg, kubeconfig: kubeconfigArg } = parseArgs(process.argv.slice(2));
  const config = loadBootstrapConfig(__dirname);
  const kubeconfigPath = resolveStringOption({
    cliValue: kubeconfigArg,
    envValue: process.env.KUBECONFIG,
    configValue: config.kubeconfig,
    defaultValue: undefined,
  });
  setActiveKubeconfig(kubeconfigPath);

  const namespace = resolveStringOption({
    cliValue: namespaceArg,
    configValue: config.namespace,
    defaultValue: undefined,
  });
  if (!namespace) {
    fail(
      `No namespace resolved. Set "namespace" in ${CONFIG_PATH} or pass -n/--namespace <namespace>.`
    );
  }

  const runnerName = resolveStringOption({
    envValue: process.env.RUNNER_NAME,
    configValue: config.runnerName,
    // Nur als Fallback mit Namespace-Suffix: GitHub-Runner-Namen müssen pro
    // Repository eindeutig sein, ein unkonfigurierter zweiter Namespace darf also nicht kollidieren.
    defaultValue: `github-actions-runner-${namespace}`,
  });
  const runnerOrg = resolveProjectOption({
    envValue: process.env.GITHUB_RUNNER_ORG,
    configValue: config.githubRunnerOrg,
    configKey: 'githubRunnerOrg',
    envName: 'GITHUB_RUNNER_ORG',
  });
  const runnerRepo = resolveProjectOption({
    envValue: process.env.GITHUB_RUNNER_REPO,
    configValue: config.githubRunnerRepo,
    configKey: 'githubRunnerRepo',
    envName: 'GITHUB_RUNNER_REPO',
  });
  const repoUrl = buildRepoUrl(runnerOrg, runnerRepo);
  const runnerLabels = resolveProjectOption({
    envValue: process.env.RUNNER_LABELS,
    configValue: config.runnerLabels,
    configKey: 'runnerLabels',
    envName: 'RUNNER_LABELS',
  });
  const partOfLabel = resolvePartOfLabel(config, runnerRepo);
  const runnerScope = resolveStringOption({
    envValue: process.env.RUNNER_SCOPE,
    configValue: config.runnerScope,
    defaultValue: DEFAULT_SCOPE,
  });
  const { devBaseImage, ghRunnerImage, kanikoImage, skipImageBuild } =
    resolveImageBuildSettings(config);
  const githubUsername = resolveStringOption({
    envValue: process.env.GITHUB_USERNAME,
    configValue: config.githubUsername,
    defaultValue: undefined,
  });
  let cachedGitHubPat;
  const getGitHubPat = async () => {
    if (!cachedGitHubPat) {
      cachedGitHubPat = await resolveGitHubPat();
    }

    return cachedGitHubPat;
  };

  const requiredFiles = runPrerequisiteChecks({
    skipImageBuild,
    githubUsername,
    devBaseImage,
    ghRunnerImage,
    kanikoImage,
  });

  if (skipImageBuild) {
    logStep(
      'Step 2/10: Building the dev base image locally (skipped because SKIP_IMAGE_BUILD=true).'
    );
    logSuccess(`Skipped local build for ${describeImageForLog(devBaseImage, 'devBaseImage')}`);

    logStep(
      'Step 3/10: Building the GitHub runner image locally (skipped because SKIP_IMAGE_BUILD=true).'
    );
    logSuccess(`Skipped local build for ${describeImageForLog(ghRunnerImage, 'ghRunnerImage')}`);

    logStep(
      'Step 4/10: Building the Kaniko image locally (skipped because SKIP_IMAGE_BUILD=true).'
    );
    logSuccess(`Skipped local build for ${describeImageForLog(kanikoImage, 'kanikoImage')}`);

    logStep(
      `Step 5/10: Pushing images to ${DEFAULT_REGISTRY} (skipped because SKIP_IMAGE_BUILD=true).`
    );
    logSuccess('Skipped docker login and image pushes');
  } else {
    logStep(`Step 2/10: Building the dev base image locally (${devBaseImage})...`);
    buildDockerImage({
      image: devBaseImage,
      dockerfilePath: requiredFiles.devBaseDockerfilePath,
      contextPath: requiredFiles.devBaseContextPath,
    });
    logSuccess(`Built ${devBaseImage}`);

    logStep(
      `Step 3/10: Building the GitHub runner image locally (${ghRunnerImage}) on top of ${devBaseImage}...`
    );
    buildDockerImage({
      image: ghRunnerImage,
      dockerfilePath: requiredFiles.ghRunnerDockerfilePath,
      contextPath: requiredFiles.ghRunnerContextPath,
      buildArgs: [['DEV_BASE_IMAGE', devBaseImage]],
    });
    logSuccess(`Built ${ghRunnerImage}`);

    logStep(`Step 4/10: Building the Kaniko image locally (${kanikoImage})...`);
    buildDockerImage({
      image: kanikoImage,
      dockerfilePath: requiredFiles.kanikoDockerfilePath,
      contextPath: requiredFiles.kanikoContextPath,
    });
    logSuccess(`Built ${kanikoImage}`);

    logStep(`Step 5/10: Pushing images to ${DEFAULT_REGISTRY}...`);
    const githubPat = await getGitHubPat();
    loginToGhcr(githubUsername, githubPat);
    console.log(`  • docker push ${devBaseImage}`);
    pushDockerImage(devBaseImage);
    console.log(`  • docker push ${ghRunnerImage}`);
    pushDockerImage(ghRunnerImage);
    console.log(`  • docker push ${kanikoImage}`);
    pushDockerImage(kanikoImage);
    logSuccess(`Pushed ${devBaseImage}, ${ghRunnerImage}, and ${kanikoImage}`);
  }

  logStep(
    `Step 6/10: Rendering and applying the runner namespace from ${K8S_NAMESPACE_MANIFEST_PATH}...`
  );
  const renderedNamespaceYaml = renderTemplate(requiredFiles.namespacesPath, {
    __NAMESPACE__: namespace,
  });
  applyYaml(renderedNamespaceYaml);
  logSuccess('Runner namespace ready');

  logStep(`Step 7/10: Rendering and applying runner RBAC from ${K8S_RBAC_TEMPLATE_PATH}...`);
  const renderedRbacYaml = renderTemplate(requiredFiles.rbacTemplatePath, {
    __NAMESPACE__: namespace,
  });
  applyYaml(renderedRbacYaml);
  logSuccess('Runner RBAC rendered and applied');

  logStep('Step 8/10: Rendering and applying the GitHub runner Secrets template...');
  const githubPat = await getGitHubPat();
  const registrationToken = await fetchRunnerRegistrationToken(runnerOrg, runnerRepo, githubPat);
  const renderedSecretsYaml = renderTemplate(requiredFiles.secretsTemplatePath, {
    __NAMESPACE__: namespace,
    __REPO_URL__: formatBlockScalarValue(repoUrl),
    __RUNNER_TOKEN__: formatBlockScalarValue(registrationToken),
    __RUNNER_NAME__: formatBlockScalarValue(runnerName),
    __RUNNER_SCOPE__: formatBlockScalarValue(runnerScope),
    __RUNNER_LABELS__: formatBlockScalarValue(runnerLabels),
    __DOCKERCONFIGJSON__: formatBlockScalarValue(
      buildGhcrDockerConfigJson(githubUsername, githubPat)
    ),
  });
  applyYaml(renderedSecretsYaml);
  logSuccess('Secrets template rendered and applied');

  logStep('Step 9/10: Rendering and applying the GitHub runner Deployment template...');
  const renderedDeploymentYaml = renderTemplate(requiredFiles.deploymentTemplatePath, {
    __NAMESPACE__: namespace,
    __RUNNER_IMAGE__: ghRunnerImage,
    __PART_OF__: partOfLabel,
  });
  applyYaml(renderedDeploymentYaml);
  logSuccess('Deployment template rendered and applied');

  // `kubectl apply` ist ein No-op, wenn sich hinter einem beweglichen Tag nur der
  // Image-Inhalt geändert hat, der alte Pod würde also überleben. Eine neue
  // Pod-Template-Revision erzwingen.
  runKubectl(['rollout', 'restart', `deployment/${DEPLOYMENT_NAME}`, '-n', namespace]);

  logStep(`Step 10/10: Waiting for Deployment/${DEPLOYMENT_NAME} rollout to complete...`);
  runKubectl([
    'rollout',
    'status',
    `deployment/${DEPLOYMENT_NAME}`,
    '-n',
    namespace,
    '--timeout=300s',
  ]);
  logSuccess(`Runner deployment is Ready in namespace ${namespace}`);

  console.log('');
  console.log('Runner bootstrap completed successfully.');
  console.log('Verify registration with:');
  console.log(`gh api repos/${runnerOrg}/${runnerRepo}/actions/runners --jq '.runners[].name'`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    if (error && typeof error === 'object' && 'status' in error) {
      process.exit(typeof error.status === 'number' ? error.status : 1);
    }
    fail(error instanceof Error ? error.message : 'Runner bootstrap failed.');
  });
}
