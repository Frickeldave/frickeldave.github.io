#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEPLOYMENT_NAME = 'github-actions-runner';
const DEFAULT_ORG = 'Frickeldave';
const DEFAULT_REPO = 'frickeldave.github.io';
const DEFAULT_LABELS = 'fd';
const DEFAULT_SCOPE = 'repo';
const DEFAULT_DEV_BASE_IMAGE = 'ghcr.io/frickeldave/fd-dev-base:latest';
const DEFAULT_GH_RUNNER_IMAGE = 'ghcr.io/frickeldave/fd-dev-ghrunner:latest';
const DEFAULT_KANIKO_IMAGE = 'ghcr.io/frickeldave/fd-dev-kaniko:latest';
const DEFAULT_REGISTRY = 'ghcr.io';
const GITHUB_API_VERSION = '2022-11-28';
// The cluster is reached through a Rancher proxy that adds latency and
// occasionally drops a single request. kubectl's own default is "no timeout",
// which in practice means a hung request blocks forever, while a short timeout
// turns normal proxy latency into a false negative. 60s is well above the
// observed p99 (<1s) and above the 30s that already proved sufficient manually.
const KUBECTL_REQUEST_TIMEOUT = '60s';
// Transient proxy failures are single-request events, so a couple of retries
// with backoff removes them without masking a genuinely broken kubeconfig.
const KUBECTL_RETRY_ATTEMPTS = 3;
const KUBECTL_RETRY_BACKOFF_MS = 2000;
const CONFIG_FILENAME = 'bootstrap.json';
const CONFIG_PATH = `scripts/bootstrap/${CONFIG_FILENAME}`;
const K8S_NAMESPACES_PATH = 'scripts/bootstrap/k8s/fd-k8s-namespaces.yaml';
const K8S_RBAC_TEMPLATE_PATH = 'scripts/bootstrap/k8s/fd-k8s-rbac.yaml';
const K8S_SECRETS_TEMPLATE_PATH = 'scripts/bootstrap/k8s/fd-k8s-ghrunner-secrets.yaml';
const K8S_DEPLOYMENT_TEMPLATE_PATH = 'scripts/bootstrap/k8s/fd-k8s-ghrunner-deployments.yaml';
const DEV_BASE_CONTEXT_PATH = 'scripts/bootstrap/docker-dev-base';
const DEV_BASE_DOCKERFILE_PATH = 'scripts/bootstrap/docker-dev-base/Dockerfile';
const GH_RUNNER_CONTEXT_PATH = 'scripts/bootstrap/docker-dev-ghrunner';
const GH_RUNNER_DOCKERFILE_PATH = 'scripts/bootstrap/docker-dev-ghrunner/Dockerfile';
const KANIKO_CONTEXT_PATH = 'scripts/bootstrap/docker-dev-kaniko';
const KANIKO_DOCKERFILE_PATH = 'scripts/bootstrap/docker-dev-kaniko/Dockerfile';
const GITHUB_PAT_PROMPT =
  'Enter GITHUB_PAT (classic PAT, scopes: repo, read:packages, write:packages): ';

function usage() {
  console.log(`Usage: ./scripts/bootstrap/bootstrap.mjs [options]

Bootstrap the standalone GitHub Actions self-hosted runner in Kubernetes.
The runner is installed into the namespace configured in ${CONFIG_PATH}
unless one is passed with -n/--namespace. It registers itself at the GitHub
repository level for Frickeldave/frickeldave.github.io.

Configuration precedence:
  CLI args > env vars > ${CONFIG_PATH} > built-in defaults
  The namespace has no built-in default: it must come from the CLI or the
  config file, otherwise bootstrap stops with an actionable error.

Options:
  -n, --namespace <namespace>  Target namespace. Defaults to the "namespace"
                               key in ${CONFIG_PATH}; when neither is set this
                               script stops instead of inventing a namespace.
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
  Step 2/10 Build fd-dev-base image locally
  Step 3/10 Build fd-dev-ghrunner image locally
  Step 4/10 Build fd-dev-kaniko image locally
  Step 5/10 Log into GHCR and push all three images
  Step 6/10 Render/apply the runner namespace manifest
  Step 7/10 Render/apply the runner-only RBAC manifest
  Step 8/10 Render/apply the runner Secrets manifest
  Step 9/10 Render/apply the runner Deployment manifest
  Step 10/10 Wait for the Deployment rollout

Required/optional variables:
  ${CONFIG_PATH}    Committed non-secret defaults file. Supported keys:
                               namespace (required unless passed as
                               -n/--namespace), kubeconfig, devBaseImage, ghRunnerImage,
                               kanikoImage, skipImageBuild, githubUsername,
                               githubRunnerOrg, githubRunnerRepo,
                               runnerName, runnerLabels, runnerScope.
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
                                 $env:KUBECONFIG = "C:\\Users\\dakoenig\\.kube\\dev-kw-bee23d.yaml"

  DEV_BASE_IMAGE               Optional base image reference to build/push in
                               Step 2 and reuse as the Step 3 parent image.
                               Default:
                                 ${DEFAULT_DEV_BASE_IMAGE}

  GH_RUNNER_IMAGE              Optional GitHub runner image reference to build,
                               push, and deploy in Steps 3, 5, and 9.
                               Default:
                                 ${DEFAULT_GH_RUNNER_IMAGE}

  FD_KANIKO_IMAGE              Optional Kaniko image reference to build and push
                               in Steps 4 and 5. The deploy workflow uses this
                               image for throwaway Kaniko build Jobs; bootstrap
                               does not create those Jobs.
                               Default:
                                 ${DEFAULT_KANIKO_IMAGE}

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
                               6. If Frickeldave enforces SSO, authorize
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

  GITHUB_RUNNER_ORG            Optional GitHub organization login used to
                               derive REPO_URL.
                               Default: Frickeldave.
                               Linux/macOS: export GITHUB_RUNNER_ORG=Frickeldave
                               Windows PS:  $env:GITHUB_RUNNER_ORG = "Frickeldave"

  GITHUB_RUNNER_REPO           Optional GitHub repository name used to derive
                               REPO_URL.
                               Default: frickeldave.github.io.
                               Linux/macOS: export GITHUB_RUNNER_REPO=frickeldave.github.io
                               Windows PS:  $env:GITHUB_RUNNER_REPO = "frickeldave.github.io"

  REPO_URL                     Derived runner registration target passed to the
                               container.
                               Default:
                                 https://github.com/Frickeldave/frickeldave.github.io

  RUNNER_NAME                  Optional descriptive runner name.
                               bootstrap.json ships github-actions-runner; the built-in
                               fallback is github-actions-runner-<namespace> so that
                               runners from different namespaces registered
                               against the same repository cannot collide.
                               Linux/macOS: export RUNNER_NAME=github-actions-runner
                               Windows PS:  $env:RUNNER_NAME = "github-actions-runner"

  RUNNER_LABELS                Optional comma-separated runner labels.
                               Default: fd.
                               Linux/macOS: export RUNNER_LABELS=fd
                               Windows PS:  $env:RUNNER_LABELS = "fd"

  RUNNER_SCOPE                 Optional compatibility variable stored in the
                               Secret and passed into the runner container.
                               Default: repo.

Examples:
  export GITHUB_PAT=ghp_xxxxx
  export GITHUB_USERNAME=octocat
  node scripts/bootstrap/bootstrap.mjs --namespace <namespace>

  $env:GITHUB_PAT = "ghp_xxxxx"
  $env:GITHUB_USERNAME = "octocat"
  .\\scripts\\bootstrap\\bootstrap.ps1 -Namespace <namespace> -Kubeconfig C:\\Users\\dakoenig\\.kube\\dev-kw-bee23d.yaml

  node scripts/bootstrap/bootstrap.mjs --kubeconfig C:\\Users\\dakoenig\\.kube\\dev-kw-bee23d.yaml`);
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
  return {
    devBaseImage: resolveStringOption({
      envValue: environment.DEV_BASE_IMAGE,
      configValue: config.devBaseImage,
      defaultValue: DEFAULT_DEV_BASE_IMAGE,
    }),
    ghRunnerImage: resolveStringOption({
      envValue: environment.GH_RUNNER_IMAGE,
      configValue: config.ghRunnerImage,
      defaultValue: DEFAULT_GH_RUNNER_IMAGE,
    }),
    kanikoImage: resolveStringOption({
      envValue: environment.FD_KANIKO_IMAGE,
      configValue: config.kanikoImage,
      defaultValue: DEFAULT_KANIKO_IMAGE,
    }),
    skipImageBuild: resolveBooleanOption({
      envValue: environment.SKIP_IMAGE_BUILD,
      configValue: config.skipImageBuild,
      defaultValue: false,
    }),
  };
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
      // Drop the TTY handle from the event loop so a later process.exit() does not
      // tear down an still-referenced stdin reader (libuv assertion on Windows).
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

// `--request-timeout` bounds a single API request. It must not be attached to
// watch-style subcommands (`rollout status`), where it would abort the watch
// long before the command's own `--timeout` is reached.
function supportsRequestTimeout(args) {
  if (args.includes('--client=true') || args.includes('--client')) {
    return false;
  }

  return !(args[0] === 'rollout' && args[1] === 'status');
}

// Resolved once in main() from CLI > KUBECONFIG > bootstrap.json, then appended
// to every kubectl invocation so a machine-wide context can never be hit by
// accident.
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

// Renders the same kubectl command line this script would run, for operator
// hints in error messages.
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

// Retries a read-only kubectl probe and returns the collected failure reasons
// instead of swallowing them, so a false negative is self-diagnosing.
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
    namespacesPath: path.join(scriptDir, 'k8s', 'fd-k8s-namespaces.yaml'),
    rbacTemplatePath: path.join(scriptDir, 'k8s', 'fd-k8s-rbac.yaml'),
    secretsTemplatePath: path.join(scriptDir, 'k8s', 'fd-k8s-ghrunner-secrets.yaml'),
    deploymentTemplatePath: path.join(scriptDir, 'k8s', 'fd-k8s-ghrunner-deployments.yaml'),
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

  // Validate on a comment-free copy: a placeholder-shaped token inside a YAML
  // comment is documentation, not a substitution target.
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
    'If Frickeldave enforces SSO, authorize the token for SSO after creation.',
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
  runDocker(['login', DEFAULT_REGISTRY, '--username', githubUsername, '--password-stdin'], {
    input: `${githubPat}\n`,
    missingBinaryMessage:
      'Docker is required to build and push the fd-dev-base/fd-dev-ghrunner/fd-dev-kaniko images. Install Docker Desktop or the Docker Engine CLI and try again.',
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
    {
      missingBinaryMessage:
        'Docker is required to build and push the fd-dev-base/fd-dev-ghrunner/fd-dev-kaniko images. Install Docker Desktop or the Docker Engine CLI and try again.',
    }
  );
}

function pushDockerImage(image) {
  runDocker(['push', image], {
    missingBinaryMessage:
      'Docker is required to build and push the fd-dev-base/fd-dev-ghrunner/fd-dev-kaniko images. Install Docker Desktop or the Docker Engine CLI and try again.',
  });
}

function checkDockerCliAvailable() {
  const missingDockerMessage =
    'Docker is required to build and push the fd-dev-base/fd-dev-ghrunner/fd-dev-kaniko images. Install Docker Desktop or the Docker Engine CLI and try again.';

  try {
    runDocker(['--version'], {
      stdio: 'ignore',
      missingBinaryMessage: missingDockerMessage,
    });
  } catch {
    fail(missingDockerMessage);
  }
}

function checkDockerDaemonReachable() {
  try {
    runDocker(['info'], {
      stdio: 'ignore',
      missingBinaryMessage:
        'Docker is required to build and push the fd-dev-base/fd-dev-ghrunner/fd-dev-kaniko images. Install Docker Desktop or the Docker Engine CLI and try again.',
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

// The operator must be able to see which cluster is targeted before any
// manifest is applied, otherwise a stale kubeconfig silently bootstraps the
// wrong cluster. The Rancher cluster id only shows up in the server URL, so it
// is printed next to the plain cluster name from the kubeconfig.
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
    validateGhcrImageRef('FD_KANIKO_IMAGE', kanikoImage);
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
        ? 'Likely causes: the classic PAT is missing the repo scope, the account lacks repo admin access, or SSO authorization is still required for Frickeldave.'
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
        'User-Agent': 'frickeldave.github.io-bootstrap',
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
    // Namespace-suffixed fallback only: GitHub runner names must be unique per
    // repository, so an unconfigured second namespace must not collide.
    defaultValue: `github-actions-runner-${namespace}`,
  });
  const runnerOrg = resolveStringOption({
    envValue: process.env.GITHUB_RUNNER_ORG,
    configValue: config.githubRunnerOrg,
    defaultValue: DEFAULT_ORG,
  });
  const runnerRepo = resolveStringOption({
    envValue: process.env.GITHUB_RUNNER_REPO,
    configValue: config.githubRunnerRepo,
    defaultValue: DEFAULT_REPO,
  });
  const repoUrl = buildRepoUrl(runnerOrg, runnerRepo);
  const runnerLabels = resolveStringOption({
    envValue: process.env.RUNNER_LABELS,
    configValue: config.runnerLabels,
    defaultValue: DEFAULT_LABELS,
  });
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
      `Step 2/10: Building fd-dev-base image locally (skipped because SKIP_IMAGE_BUILD=true).`
    );
    logSuccess(`Skipped local build for ${devBaseImage}`);

    logStep(
      'Step 3/10: Building fd-dev-ghrunner image locally (skipped because SKIP_IMAGE_BUILD=true).'
    );
    logSuccess(`Skipped local build for ${ghRunnerImage}`);

    logStep(
      'Step 4/10: Building fd-dev-kaniko image locally (skipped because SKIP_IMAGE_BUILD=true).'
    );
    logSuccess(`Skipped local build for ${kanikoImage}`);

    logStep('Step 5/10: Pushing images to GHCR (skipped because SKIP_IMAGE_BUILD=true).');
    logSuccess('Skipped docker login and image pushes');
  } else {
    logStep(`Step 2/10: Building fd-dev-base image locally (${devBaseImage})...`);
    buildDockerImage({
      image: devBaseImage,
      dockerfilePath: requiredFiles.devBaseDockerfilePath,
      contextPath: requiredFiles.devBaseContextPath,
    });
    logSuccess(`Built ${devBaseImage}`);

    logStep(
      `Step 3/10: Building fd-dev-ghrunner image locally (${ghRunnerImage}) on top of ${devBaseImage}...`
    );
    buildDockerImage({
      image: ghRunnerImage,
      dockerfilePath: requiredFiles.ghRunnerDockerfilePath,
      contextPath: requiredFiles.ghRunnerContextPath,
      buildArgs: [['DEV_BASE_IMAGE', devBaseImage]],
    });
    logSuccess(`Built ${ghRunnerImage}`);

    logStep(`Step 4/10: Building fd-dev-kaniko image locally (${kanikoImage})...`);
    buildDockerImage({
      image: kanikoImage,
      dockerfilePath: requiredFiles.kanikoDockerfilePath,
      contextPath: requiredFiles.kanikoContextPath,
    });
    logSuccess(`Built ${kanikoImage}`);

    logStep('Step 5/10: Pushing images to GHCR...');
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

  logStep(`Step 6/10: Rendering and applying the runner namespace from ${K8S_NAMESPACES_PATH}...`);
  const renderedNamespacesYaml = renderTemplate(requiredFiles.namespacesPath, {
    __NAMESPACE__: namespace,
  });
  applyYaml(renderedNamespacesYaml);
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
  });
  applyYaml(renderedDeploymentYaml);
  logSuccess('Deployment template rendered and applied');

  // `kubectl apply` is a no-op when only the image *contents* changed behind a mutable
  // tag, so the old pod would survive. Force a new pod template revision.
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
