import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  isTransientDockerFailure,
  isValidKubernetesLabelValue,
  resolveImageBuildSettings,
  resolvePartOfLabel,
  retryTransientDockerFailure,
} from "./bootstrap.mjs";

const packageDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(packageDirectory, "..", "..");

const configPath = path.join(packageDirectory, "bootstrap.json");
const bootstrapScriptPath = path.join(packageDirectory, "bootstrap.mjs");
const config = JSON.parse(readFileSync(configPath, "utf8"));
const bootstrapScript = readFileSync(bootstrapScriptPath, "utf8");
const powershellWrapper = readFileSync(
  path.join(packageDirectory, "bootstrap.ps1"),
  "utf8"
);

const K8S_MANIFEST_FILENAMES = [
  "namespace.yaml",
  "rbac.yaml",
  "runner-deployment.yaml",
  "runner-secrets.yaml",
];

const k8sFile = (filename) => readFileSync(path.join(packageDirectory, "k8s", filename), "utf8");

const deploymentTemplate = k8sFile("runner-deployment.yaml");
const namespaceManifest = k8sFile("namespace.yaml");
const rbacTemplate = k8sFile("rbac.yaml");
const secretsTemplate = k8sFile("runner-secrets.yaml");

const runnerEntrypoint = readFileSync(
  path.join(packageDirectory, "docker-dev-ghrunner", "entrypoint.sh"),
  "utf8"
);

function listPackageFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    return entry.isDirectory() ? listPackageFiles(entryPath) : [entryPath];
  });
}

function findPosixShell() {
  const candidates =
    process.platform === "win32"
      ? [
          "sh",
          "C:\\Program Files\\Git\\bin\\sh.exe",
          "C:\\Program Files\\Git\\usr\\bin\\sh.exe",
        ]
      : ["sh", "/bin/sh"];

  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ["-c", "exit 0"], { stdio: "ignore" });

    if (!probe.error && probe.status === 0) {
      return candidate;
    }
  }

  return null;
}

// Every project-specific value lives in bootstrap.json; the executable
// fail-fast checks below run a scratch copy of the script with a doctored
// config, so they never touch the committed file and never need a cluster.
const SCRUBBED_VARIABLES = [
  "DEV_BASE_IMAGE",
  "GH_RUNNER_IMAGE",
  "KANIKO_IMAGE",
  "SKIP_IMAGE_BUILD",
  "RUNNER_NAME",
  "RUNNER_LABELS",
  "RUNNER_SCOPE",
  "GITHUB_RUNNER_ORG",
  "GITHUB_RUNNER_REPO",
  "GITHUB_USERNAME",
  "GITHUB_PAT",
  "KUBECONFIG",
];

function runScratchBootstrap(configOverride) {
  const scratchDirectory = mkdtempSync(path.join(tmpdir(), "bootstrap-failfast-"));
  const scratchScript = path.join(scratchDirectory, "bootstrap.mjs");

  try {
    copyFileSync(bootstrapScriptPath, scratchScript);
    writeFileSync(
      path.join(scratchDirectory, "bootstrap.json"),
      JSON.stringify({ ...config, ...configOverride }, null, 2),
      "utf8"
    );

    const environment = { ...process.env };
    for (const variable of SCRUBBED_VARIABLES) {
      delete environment[variable];
    }

    return spawnSync(process.execPath, [scratchScript], {
      encoding: "utf8",
      env: environment,
      timeout: 30000,
    });
  } finally {
    rmSync(scratchDirectory, { recursive: true, force: true });
  }
}

function withoutKeys(source, keys) {
  const copy = { ...source };
  for (const key of keys) {
    delete copy[key];
  }

  return copy;
}

const runnerNameBlock = runnerEntrypoint.match(
  /^# BEGIN runner-name resolution$([\s\S]*?)^# END runner-name resolution$/m
)?.[1];

function resolveRunnerName(shell, { prefix, podName }) {
  const env = { ...process.env };
  delete env.RUNNER_NAME_PREFIX;
  delete env.POD_NAME;

  if (prefix !== undefined) {
    env.RUNNER_NAME_PREFIX = prefix;
  }

  if (podName !== undefined) {
    env.POD_NAME = podName;
  }

  const result = spawnSync(shell, ["-eu", "-c", `${runnerNameBlock}\nresolve_runner_name`], {
    encoding: "utf8",
    env,
  });

  assert.equal(result.status, 0, `runner-name block failed: ${result.stderr}`);
  return result.stdout.trim();
}

test("bootstrap.json holds every project-specific value the script needs", () => {
  assert.equal(typeof config.namespace, "string");
  assert.ok(config.namespace.length > 0, "namespace must be configured");

  for (const key of ["devBaseImage", "ghRunnerImage", "kanikoImage"]) {
    assert.equal(typeof config[key], "string", `${key} must be configured`);
    assert.match(
      config[key],
      /^[a-z0-9.-]+\/[^/\s]+\/[^/\s]+:[^\s]+$/,
      `${key} must be a fully qualified image reference with a tag`
    );
  }

  assert.equal(typeof config.githubRunnerOrg, "string");
  assert.ok(config.githubRunnerOrg.length > 0);
  assert.equal(typeof config.githubRunnerRepo, "string");
  assert.ok(config.githubRunnerRepo.length > 0);
  assert.equal(typeof config.githubUsername, "string");
  assert.ok(config.githubUsername.length > 0);
  assert.equal(typeof config.runnerLabels, "string");
  assert.ok(config.runnerLabels.length > 0);
  assert.equal(typeof config.runnerName, "string");
  assert.equal(typeof config.runnerScope, "string");
  assert.equal(typeof config.kubeconfig, "string");
  assert.equal(typeof config.skipImageBuild, "boolean");
});

test("bootstrap.json never carries a personal access token", () => {
  for (const key of Object.keys(config)) {
    assert.doesNotMatch(key.toLowerCase(), /pat|token|secret/);
  }
});

test("bootstrap.mjs has no built-in project defaults", () => {
  assert.doesNotMatch(bootstrapScript, /const DEFAULT_NAMESPACE/);
  assert.doesNotMatch(bootstrapScript, /const DEFAULT_ORG/);
  assert.doesNotMatch(bootstrapScript, /const DEFAULT_REPO/);
  assert.doesNotMatch(bootstrapScript, /const DEFAULT_LABELS/);
  assert.doesNotMatch(bootstrapScript, /const DEFAULT_DEV_BASE_IMAGE/);
  assert.doesNotMatch(bootstrapScript, /const DEFAULT_GH_RUNNER_IMAGE/);
  assert.doesNotMatch(bootstrapScript, /const DEFAULT_KANIKO_IMAGE/);
  assert.match(bootstrapScript, /defaultValue: `github-actions-runner-\$\{namespace\}`/);
});

test("a missing namespace fails fast with an actionable message", () => {
  assert.match(
    bootstrapScript,
    /No namespace resolved\. Set "namespace" in \$\{CONFIG_PATH\} or pass -n\/--namespace <namespace>\./
  );

  const result = runScratchBootstrap({ namespace: undefined });

  assert.equal(result.status, 1, `expected exit code 1, got ${result.status}`);
  assert.match(result.stderr, /No namespace resolved\./);
  assert.match(result.stderr, /bootstrap\.json/);
  assert.match(result.stderr, /-n\/--namespace/);
});

test("the build-only images are not required when SKIP_IMAGE_BUILD=true", () => {
  const buildOnlyKeys = ["devBaseImage", "kanikoImage"];

  const skipping = resolveImageBuildSettings(
    { ...withoutKeys(config, buildOnlyKeys), skipImageBuild: true },
    {}
  );

  assert.equal(skipping.devBaseImage, undefined);
  assert.equal(skipping.kanikoImage, undefined);
  assert.equal(skipping.ghRunnerImage, config.ghRunnerImage);
  assert.equal(skipping.skipImageBuild, true);

  const scratchConfig = {
    ...withoutKeys(config, buildOnlyKeys),
    skipImageBuild: true,
    // A deliberately missing kubeconfig stops the scratch run immediately after
    // the image resolution, so the test never reaches docker or kubectl.
    kubeconfig: path.join(tmpdir(), "bootstrap-missing-kubeconfig.yaml"),
  };
  const result = runScratchBootstrap(scratchConfig);

  assert.equal(result.status, 1, `expected exit code 1, got ${result.status}`);
  assert.match(result.stderr, /Kubeconfig not found:/);
  assert.doesNotMatch(result.stderr, /No dev base image reference resolved/);
  assert.doesNotMatch(result.stderr, /No Kaniko image reference resolved/);
});

test("a missing runner image reference fails fast on every run", () => {
  assert.match(
    bootstrapScript,
    /No \$\{description\} reference resolved\. Set "\$\{setting\}" in \$\{CONFIG_PATH\} or export \$\{variableName\}\./
  );

  const result = runScratchBootstrap({
    ghRunnerImage: undefined,
    skipImageBuild: true,
  });

  assert.equal(result.status, 1, `expected exit code 1, got ${result.status}`);
  assert.match(result.stderr, /No GitHub runner image reference resolved\./);
  assert.match(result.stderr, /"ghRunnerImage"/);
  assert.match(result.stderr, /GH_RUNNER_IMAGE/);
});

test("a missing build-only image reference fails fast when images are built", () => {
  const result = runScratchBootstrap({
    devBaseImage: undefined,
    skipImageBuild: false,
  });

  assert.equal(result.status, 1, `expected exit code 1, got ${result.status}`);
  assert.match(result.stderr, /No dev base image reference resolved\./);
  assert.match(result.stderr, /"devBaseImage"/);
  assert.match(result.stderr, /SKIP_IMAGE_BUILD=true/);
});

test("image settings resolve env var > bootstrap.json and use neutral variable names", () => {
  const fromConfig = resolveImageBuildSettings(config, {});
  assert.equal(fromConfig.devBaseImage, config.devBaseImage);

  const fromEnvironment = resolveImageBuildSettings(config, {
    DEV_BASE_IMAGE: "registry.example/dev-base:env",
    GH_RUNNER_IMAGE: "registry.example/runner:env",
    KANIKO_IMAGE: "registry.example/kaniko:env",
  });

  assert.equal(fromEnvironment.devBaseImage, "registry.example/dev-base:env");
  assert.equal(fromEnvironment.ghRunnerImage, "registry.example/runner:env");
  assert.equal(fromEnvironment.kanikoImage, "registry.example/kaniko:env");

  const legacyVariableIsIgnored = resolveImageBuildSettings(config, {
    FD_KANIKO_IMAGE: "registry.example/legacy:env",
  });
  assert.equal(legacyVariableIsIgnored.kanikoImage, config.kanikoImage);
  assert.doesNotMatch(bootstrapScript, /FD_KANIKO_IMAGE/);
  assert.match(bootstrapScript, /envValue: environment\.KANIKO_IMAGE/);
});

test("the part-of label comes from config, falling back to the repository name", () => {
  assert.match(
    bootstrapScript,
    /const partOfLabel = resolvePartOfLabel\(config, runnerRepo\);/
  );
  assert.match(bootstrapScript, /__PART_OF__: partOfLabel/);

  assert.equal(resolvePartOfLabel(config, config.githubRunnerRepo), config.partOf ?? config.githubRunnerRepo);
  assert.equal(resolvePartOfLabel({ ...config, partOf: "custom-app" }, config.githubRunnerRepo), "custom-app");
  assert.equal(resolvePartOfLabel({}, "my-repo"), "my-repo");
});

test("an invalid part-of label fails fast instead of letting kubectl reject it", () => {
  assert.match(
    bootstrapScript,
    /Invalid app\.kubernetes\.io\/part-of value: "\$\{partOf\}"\./
  );

  const result = runScratchBootstrap({ partOf: "-invalid-label-" });

  assert.equal(result.status, 1, `expected exit code 1, got ${result.status}`);
  assert.match(result.stderr, /Invalid app\.kubernetes\.io\/part-of value: "-invalid-label-"\./);
  assert.match(result.stderr, /1-63 characters/);
});

test("kubernetes label values are validated against the real rules", () => {
  for (const value of ["app", "a1", "my-app", "my-app.example", "a".repeat(63)]) {
    assert.equal(isValidKubernetesLabelValue(value), true, `${value} should be valid`);
  }

  for (const value of ["", "-app", "app-", ".app", "app.", "a".repeat(64), "app_name", undefined, null]) {
    assert.equal(isValidKubernetesLabelValue(value), false, `${value} should be invalid`);
  }
});

test("the deployment template renders __PART_OF__ from config", () => {
  assert.equal(
    deploymentTemplate.match(/app\.kubernetes\.io\/part-of: __PART_OF__/g)?.length,
    2,
    "both part-of labels must be placeholders"
  );
  assert.match(deploymentTemplate, /app\.kubernetes\.io\/part-of: __PART_OF__/);
  assert.match(deploymentTemplate, /namespace: __NAMESPACE__/);
  assert.match(deploymentTemplate, /replicas: 2\b/);
  assert.match(deploymentTemplate, /imagePullPolicy: Always/);

  const expectedPartOf = config.partOf ?? config.githubRunnerRepo;
  const rendered = deploymentTemplate
    .replaceAll("__NAMESPACE__", config.namespace)
    .replaceAll("__RUNNER_IMAGE__", config.ghRunnerImage)
    .replaceAll("__PART_OF__", expectedPartOf);

  assert.doesNotMatch(rendered, /__[A-Z0-9_]+__/);
  assert.equal(rendered.match(/app\.kubernetes\.io\/part-of: /g)?.length, 2);
  for (const line of rendered.match(/app\.kubernetes\.io\/part-of: .*/g) ?? []) {
    assert.equal(line, `app.kubernetes.io/part-of: ${expectedPartOf}`);
  }
});

test("the k8s manifests named in bootstrap.mjs exist under their neutral filenames", () => {
  for (const manifest of K8S_MANIFEST_FILENAMES) {
    assert.ok(
      existsSync(path.join(packageDirectory, "k8s", manifest)),
      `missing k8s manifest: ${manifest}`
    );
    assert.ok(
      bootstrapScript.includes(`'k8s', '${manifest}'`),
      `bootstrap.mjs does not reference k8s/${manifest}`
    );
  }

  const trackedManifests = readdirSync(path.join(packageDirectory, "k8s"));
  assert.deepEqual(trackedManifests.sort(), [...K8S_MANIFEST_FILENAMES].sort());
  assert.match(bootstrapScript, /Step 7\/10: Rendering and applying runner RBAC/);
});

test("the namespace manifest declares exactly one namespace from a placeholder", () => {
  assert.equal(namespaceManifest.match(/kind: Namespace/g)?.length, 1);
  assert.match(namespaceManifest, /name: __NAMESPACE__/);

  const rendered = namespaceManifest.replaceAll("__NAMESPACE__", config.namespace);

  assert.doesNotMatch(rendered, /__[A-Z0-9_]+__/);
  assert.match(
    rendered,
    new RegExp(`kind: Namespace\\nmetadata:\\n {2}name: ${config.namespace}\\n`)
  );
});

test("runner RBAC renders into the target namespace and keeps the kaniko capability", () => {
  const rbacObjects = rbacTemplate
    .split(/^---$/m)
    .map((document) => document.trim())
    .filter(Boolean);

  assert.equal(rbacObjects.length, 2, "expected exactly a Role and a RoleBinding");

  for (const object of rbacObjects) {
    assert.match(object, /name: kaniko-builder/);
    assert.match(object, /namespace: __NAMESPACE__/);
    assert.ok(
      !object.includes(config.namespace),
      "RBAC objects must not hardcode a namespace"
    );
  }

  const namespace = config.namespace;
  const rendered = rbacTemplate.replaceAll("__NAMESPACE__", namespace);

  assert.doesNotMatch(rendered, /__[A-Z0-9_]+__/);
  assert.ok(
    rendered.includes(
      `kind: Role\nmetadata:\n  name: kaniko-builder\n  namespace: ${namespace}\n`
    )
  );
  assert.ok(
    rendered.includes(
      `kind: RoleBinding\nmetadata:\n  name: kaniko-builder\n  namespace: ${namespace}\n`
    )
  );
  assert.ok(
    rendered.includes(
      `subjects:\n  - kind: ServiceAccount\n    name: default\n    namespace: ${namespace}\n`
    )
  );
  assert.match(rendered, /resources: \["jobs"\]/);
  assert.match(rendered, /resources: \["pods", "pods\/log"\]/);
  assert.match(rendered, /resources: \["secrets"\]/);
  assert.match(rendered, /verbs: \["create", "update", "get", "delete"\]/);
});

test("the secrets template keeps every placeholder the script renders", () => {
  for (const placeholder of [
    "__NAMESPACE__",
    "__REPO_URL__",
    "__RUNNER_TOKEN__",
    "__RUNNER_NAME__",
    "__RUNNER_SCOPE__",
    "__RUNNER_LABELS__",
    "__DOCKERCONFIGJSON__",
  ]) {
    assert.ok(secretsTemplate.includes(placeholder), `missing ${placeholder}`);
    assert.ok(bootstrapScript.includes(placeholder), `bootstrap.mjs never renders ${placeholder}`);
  }
});

test("the namespace name lives only in bootstrap.json", () => {
  assert.ok(config.namespace, "bootstrap.json must configure a namespace");

  const namespaceLiteral = new RegExp(
    config.namespace
      .split("")
      .map((character) => String.fromCharCode(character.charCodeAt(0)))
      .join("")
  );

  for (const filePath of listPackageFiles(packageDirectory)) {
    const relativePath = path.relative(packageDirectory, filePath);

    if (relativePath === "bootstrap.json") {
      continue;
    }

    assert.doesNotMatch(
      readFileSync(filePath, "utf8"),
      namespaceLiteral,
      `${relativePath} hardcodes the configured namespace; it must come from bootstrap.json`
    );
  }
});

test("no project literal survives outside bootstrap.json (portability guard)", () => {
  // Built from character codes so the guard cannot match its own source. These
  // are the identifiers of this repository and of the upstream project the
  // package was extracted from; a portable copy must not contain any of them.
  const forbidden = new RegExp(
    [
      [102, 100, 45], // the repository prefix used by the image and namespace names
      [102, 114, 105, 99, 107, 101, 108, 100, 97, 118, 101], // this repository owner
      [99, 114, 97, 102, 116], // upstream project
      [97, 100, 101, 115, 115, 111], // upstream project
    ]
      .map((codes) => codes.map((code) => String.fromCharCode(code)).join(""))
      .join("|"),
    "i"
  );

  for (const filePath of listPackageFiles(packageDirectory)) {
    const relativePath = path.relative(packageDirectory, filePath);

    if (relativePath === "bootstrap.json") {
      continue;
    }

    assert.doesNotMatch(
      readFileSync(filePath, "utf8"),
      forbidden,
      `${relativePath} still contains a project-specific literal; it must come from bootstrap.json`
    );
  }
});

test("transient docker failures are retried and eventually succeed", () => {
  let calls = 0;
  const sleeps = [];
  const logged = [];
  const errored = [];

  const result = retryTransientDockerFailure({
    label: "docker push <image>",
    attempts: 3,
    backoffMs: 1000,
    sleep: (milliseconds) => sleeps.push(milliseconds),
    logger: {
      log: (message) => logged.push(message),
      error: (message) => errored.push(message),
    },
    invoke: () => {
      calls += 1;

      if (calls < 3) {
        const error = new Error("Command failed: docker push <image>");
        error.stderr = "received unexpected HTTP status: 503 Service Unavailable";
        throw error;
      }
    },
  });

  assert.equal(result.attemptsUsed, 3);
  assert.equal(calls, 3);
  assert.deepEqual(sleeps, [1000, 2000]);
  assert.equal(logged.length, 2);
  assert.match(logged[0], /transient failure/);
  assert.match(logged[0], /503/);
  assert.match(logged[1], /attempt 3\/3/);
  assert.deepEqual(errored, []);
});

test("a successful docker step is not retried", () => {
  let calls = 0;
  const sleeps = [];

  const result = retryTransientDockerFailure({
    label: "docker push <image>",
    sleep: (milliseconds) => sleeps.push(milliseconds),
    logger: { log: () => {}, error: () => {} },
    invoke: () => {
      calls += 1;
    },
  });

  assert.equal(result.attemptsUsed, 1);
  assert.equal(calls, 1);
  assert.deepEqual(sleeps, []);
});

test("non-transient docker credential errors fail on the first attempt", () => {
  let calls = 0;
  const sleeps = [];
  const errored = [];

  assert.throws(
    () =>
      retryTransientDockerFailure({
        label: "docker login <registry>",
        attempts: 3,
        backoffMs: 1000,
        sleep: (milliseconds) => sleeps.push(milliseconds),
        logger: { log: () => {}, error: (message) => errored.push(message) },
        invoke: () => {
          calls += 1;
          const error = new Error("Command failed: docker login");
          error.stderr = "Error response from daemon: denied: incorrect username or password";
          throw error;
        },
      }),
    /incorrect username or password/
  );

  assert.equal(calls, 1);
  assert.deepEqual(sleeps, []);
  assert.equal(errored.length, 1);
  assert.match(errored[0], /not retryable/);
});

test("a repeatedly transient docker failure gives up after the configured attempts", () => {
  let calls = 0;

  assert.throws(
    () =>
      retryTransientDockerFailure({
        label: "docker push <image>",
        attempts: 2,
        backoffMs: 10,
        sleep: () => {},
        logger: { log: () => {}, error: () => {} },
        invoke: () => {
          calls += 1;
          const error = new Error("Command failed: docker push");
          error.stderr = "write tcp: connection reset by peer";
          throw error;
        },
      }),
    /connection reset by peer/
  );

  assert.equal(calls, 2);
});

test("docker failure classification only retries transient causes", () => {
  const transient = [
    "received unexpected HTTP status: 502 Bad Gateway",
    "received unexpected HTTP status: 503",
    "received unexpected HTTP status: 504",
    "toomanyrequests: You have reached your pull rate limit",
    "unexpected EOF",
    "read tcp 10.0.0.1:443: connection reset by peer",
    "net/http: TLS handshake timeout",
    "dial tcp: i/o timeout",
    "denied: 503 Service Unavailable",
    "unauthorized: secondary rate limit exceeded",
  ];

  const nonTransient = [
    "denied: requested access to the resource is denied",
    "permission_denied: The token provided does not match expected scopes.",
    "unauthorized: authentication required",
    "denied: incorrect username or password",
    "not authorized to perform this operation",
    "",
  ];

  for (const message of transient) {
    assert.equal(isTransientDockerFailure(message), true, `${message} should be transient`);
  }

  for (const message of nonTransient) {
    assert.equal(isTransientDockerFailure(message), false, `${message} must not be retried`);
  }
});

test("docker push and login both go through the retry helper", () => {
  assert.match(
    bootstrapScript,
    /label: `docker push \$\{image\}`,\n\s+invoke: \(\) =>\n\s+runDocker\(\['push', image\]/
  );
  assert.match(bootstrapScript, /label: `docker login \$\{DEFAULT_REGISTRY\}`/);
  assert.match(bootstrapScript, /const DOCKER_RETRY_ATTEMPTS = 3;/);
  assert.match(bootstrapScript, /const DOCKER_RETRY_BACKOFF_MS = 2000;/);
});

test("the PowerShell wrapper leaves the namespace default to bootstrap.json", () => {
  assert.match(powershellWrapper, /\[string\]\$Namespace,/);
  assert.doesNotMatch(powershellWrapper, /\$Namespace\s*=\s*["']/);
  assert.match(
    powershellWrapper,
    /if \(\$Namespace\) \{\r?\n\s+\$nodeArgs \+= @\("--namespace", \$Namespace\)/
  );
});

test("bootstrap.mjs supports an explicit kubeconfig for every kubectl call", () => {
  assert.match(bootstrapScript, /arg === '-k' \|\| arg === '--kubeconfig'/);
  assert.match(bootstrapScript, /envValue: process\.env\.KUBECONFIG/);
  assert.match(bootstrapScript, /configValue: config\.kubeconfig/);
  assert.match(bootstrapScript, /function withKubeconfigFlag\(/);
  assert.match(
    bootstrapScript,
    /runCommand\('kubectl', withKubeconfigFlag\(effectiveArgs\)/
  );
  assert.match(bootstrapScript, /function validateKubeconfigPath\(/);
  assert.match(bootstrapScript, /function reportTargetCluster\(/);
  assert.match(powershellWrapper, /\[string\]\$Kubeconfig/);
  assert.match(powershellWrapper, /--kubeconfig/);
});

test("kaniko stays part of the bootstrap flow", () => {
  assert.match(bootstrapScript, /envValue: environment\.KANIKO_IMAGE/);
  assert.match(bootstrapScript, /validateGhcrImageRef\('KANIKO_IMAGE', kanikoImage\)/);
  assert.match(bootstrapScript, /Step 4\/10: Building the Kaniko image locally/);
  assert.match(bootstrapScript, /Step 5\/10: Pushing images to \$\{DEFAULT_REGISTRY\}/);
  assert.match(bootstrapScript, /pushDockerImage\(kanikoImage\)/);
  assert.match(bootstrapScript, /path\.join\(scriptDir, 'docker-dev-kaniko'\)/);
  assert.ok(existsSync(path.join(packageDirectory, "docker-dev-kaniko", "Dockerfile")));
});

test("the runner image build has no hardcoded parent image", () => {
  const runnerDockerfile = readFileSync(
    path.join(packageDirectory, "docker-dev-ghrunner", "Dockerfile"),
    "utf8"
  );

  assert.match(runnerDockerfile, /^ARG DEV_BASE_IMAGE$/m);
  assert.doesNotMatch(runnerDockerfile, /^ARG DEV_BASE_IMAGE=/m);
  assert.match(runnerDockerfile, /^FROM \$\{DEV_BASE_IMAGE\}$/m);
});

test("the runner entrypoint never double-prefixes the runner name", (t) => {
  assert.ok(
    runnerNameBlock,
    "entrypoint.sh must keep the runner-name resolution block between its BEGIN/END markers"
  );

  assert.doesNotMatch(
    runnerEntrypoint,
    /RUNNER_NAME="\$\{RUNNER_NAME_PREFIX:-github-actions-runner\}-\$\{POD_NAME/,
    "entrypoint.sh must not prepend the prefix unconditionally"
  );

  const shell = findPosixShell();
  if (!shell) {
    t.skip("no POSIX shell available to execute the runner-name block");
    return;
  }

  assert.equal(
    resolveRunnerName(shell, {
      prefix: "github-actions-runner",
      podName: "github-actions-runner-55795b4dcb-2wjn6",
    }),
    "github-actions-runner-55795b4dcb-2wjn6",
    "a pod already named after the prefix keeps its name"
  );

  assert.equal(
    resolveRunnerName(shell, {
      prefix: "github-actions-runner",
      podName: "runner-a",
    }),
    "github-actions-runner-runner-a"
  );

  assert.equal(
    resolveRunnerName(shell, {
      prefix: "custom-runner",
      podName: "github-actions-runner-abc",
    }),
    "custom-runner-github-actions-runner-abc",
    "a prefix that is not part of the pod name is still prepended"
  );

  assert.equal(
    resolveRunnerName(shell, { podName: "github-actions-runner-abc" }),
    "github-actions-runner-abc",
    "the built-in default prefix matches the deployment pod names"
  );

  assert.equal(resolveRunnerName(shell, { podName: "some-pod" }), "github-actions-runner-some-pod");

  const hostnameName = resolveRunnerName(shell, { prefix: "github-actions-runner" });
  assert.match(hostnameName, /^github-actions-runner-.+$/);
});

test("package.json exposes the bootstrap scripts", () => {
  const packageJson = JSON.parse(readFileSync(path.join(repositoryRoot, "package.json"), "utf8"));

  assert.equal(packageJson.scripts.bootstrap, "node scripts/bootstrap/bootstrap.mjs");
  assert.equal(
    packageJson.scripts["test:bootstrap"],
    "node --test scripts/bootstrap/bootstrap.test.mjs"
  );
});