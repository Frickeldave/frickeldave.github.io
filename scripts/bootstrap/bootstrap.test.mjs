import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const packageDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(packageDirectory, "..", "..");

const config = JSON.parse(
  readFileSync(path.join(packageDirectory, "bootstrap.json"), "utf8")
);
const bootstrapScript = readFileSync(
  path.join(packageDirectory, "bootstrap.mjs"),
  "utf8"
);
const powershellWrapper = readFileSync(
  path.join(packageDirectory, "bootstrap.ps1"),
  "utf8"
);
const deploymentTemplate = readFileSync(
  path.join(packageDirectory, "k8s", "fd-k8s-ghrunner-deployments.yaml"),
  "utf8"
);
const namespacesManifest = readFileSync(
  path.join(packageDirectory, "k8s", "fd-k8s-namespaces.yaml"),
  "utf8"
);
const rbacTemplate = readFileSync(
  path.join(packageDirectory, "k8s", "fd-k8s-rbac.yaml"),
  "utf8"
);
const runnerEntrypoint = readFileSync(
  path.join(packageDirectory, "docker-dev-ghrunner", "entrypoint.sh"),
  "utf8"
);

const K8S_MANIFESTS = [
  "fd-k8s-ghrunner-deployments.yaml",
  "fd-k8s-ghrunner-secrets.yaml",
  "fd-k8s-namespaces.yaml",
  "fd-k8s-rbac.yaml",
];

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

// The naming block is delimited by markers so the test can execute the exact
// shipped code instead of a copy of it.
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

  const result = spawnSync(
    shell,
    ["-eu", "-c", `${runnerNameBlock}\nresolve_runner_name`],
    { encoding: "utf8", env }
  );

  assert.equal(result.status, 0, `runner-name block failed: ${result.stderr}`);
  return result.stdout.trim();
}

test("bootstrap.json carries the fd target values", () => {
  assert.equal(typeof config.namespace, "string");
  assert.ok(config.namespace.length > 0, "namespace must be configured");
  assert.equal(config.githubRunnerOrg, "Frickeldave");
  assert.equal(config.githubRunnerRepo, "frickeldave.github.io");
  assert.equal(config.runnerScope, "repo");
  assert.equal(config.runnerName, "github-actions-runner");
  assert.equal(config.runnerLabels, "fd");
  assert.equal(config.devBaseImage, "ghcr.io/frickeldave/fd-dev-base:latest");
  assert.equal(
    config.ghRunnerImage,
    "ghcr.io/frickeldave/fd-dev-ghrunner:latest"
  );
  assert.equal(config.kanikoImage, "ghcr.io/frickeldave/fd-dev-kaniko:latest");
  assert.equal(config.skipImageBuild, false);
  assert.equal(
    config.kubeconfig,
    "C:\\Users\\dakoenig\\.kube\\dev-kw-bee23d.yaml"
  );
});

test("bootstrap.json never carries a personal access token", () => {
  for (const key of Object.keys(config)) {
    assert.doesNotMatch(key.toLowerCase(), /pat|token|secret/);
  }
});

test("bootstrap.mjs resolves the same defaults as bootstrap.json", () => {
  assert.match(bootstrapScript, /const DEFAULT_ORG = 'Frickeldave';/);
  assert.match(
    bootstrapScript,
    /const DEFAULT_REPO = 'frickeldave\.github\.io';/
  );
  assert.match(bootstrapScript, /const DEFAULT_LABELS = 'fd';/);
  assert.match(
    bootstrapScript,
    /const DEFAULT_DEV_BASE_IMAGE = 'ghcr\.io\/frickeldave\/fd-dev-base:latest';/
  );
  assert.match(
    bootstrapScript,
    /const DEFAULT_GH_RUNNER_IMAGE = 'ghcr\.io\/frickeldave\/fd-dev-ghrunner:latest';/
  );
  assert.match(
    bootstrapScript,
    /const DEFAULT_KANIKO_IMAGE = 'ghcr\.io\/frickeldave\/fd-dev-kaniko:latest';/
  );
  assert.match(
    bootstrapScript,
    /defaultValue: `github-actions-runner-\$\{namespace\}`/
  );
  assert.doesNotMatch(bootstrapScript, /DEFAULT_NAMESPACE/);
  assert.match(
    bootstrapScript,
    /No namespace resolved\. Set "namespace" in \$\{CONFIG_PATH\} or pass -n\/--namespace <namespace>\./
  );
  assert.match(bootstrapScript, /cliValue: namespaceArg,\n\s+configValue: config\.namespace,/);
});

test("the namespace manifest is rendered like every other template", () => {
  assert.match(
    bootstrapScript,
    /renderTemplate\(requiredFiles\.namespacesPath, \{\n\s+__NAMESPACE__: namespace,/
  );
  assert.match(bootstrapScript, /applyYaml\(renderedNamespacesYaml\)/);
  assert.doesNotMatch(
    bootstrapScript,
    /runKubectl\(\['apply', '-f', requiredFiles\.namespacesPath\]\)/
  );
  assert.match(bootstrapScript, /-n, --namespace <namespace>\s+Target namespace\./);
  assert.match(bootstrapScript, /node scripts\/bootstrap\/bootstrap\.mjs --namespace <namespace>/);
});

test("the PowerShell wrapper leaves the namespace default to bootstrap.json", () => {
  assert.match(powershellWrapper, /\[string\]\$Namespace,/);
  assert.doesNotMatch(powershellWrapper, /\$Namespace\s*=\s*["']/);
  assert.match(powershellWrapper, /if \(\$Namespace\) \{\r?\n\s+\$nodeArgs \+= @\("--namespace", \$Namespace\)/);
});

test("the runner entrypoint never double-prefixes the runner name", (t) => {
  assert.ok(
    runnerNameBlock,
    "entrypoint.sh must keep the runner-name resolution block between its BEGIN/END markers"
  );

  // Regression guard that works even without a shell: the old unconditional
  // template is what produced github-actions-runner-github-actions-runner-*.
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
      prefix: "fd-runner",
      podName: "github-actions-runner-abc",
    }),
    "fd-runner-github-actions-runner-abc",
    "a prefix that is not part of the pod name is still prepended"
  );

  assert.equal(
    resolveRunnerName(shell, { podName: "github-actions-runner-abc" }),
    "github-actions-runner-abc",
    "the built-in default prefix matches the deployment pod names"
  );

  assert.equal(
    resolveRunnerName(shell, { podName: "some-pod" }),
    "github-actions-runner-some-pod"
  );

  // Without POD_NAME (plain `docker run`) the hostname is used and prefixed once.
  const hostnameName = resolveRunnerName(shell, { prefix: "github-actions-runner" });
  assert.match(hostnameName, /^github-actions-runner-.+$/);
});

test("kaniko stays part of the bootstrap flow", () => {
  assert.match(bootstrapScript, /envValue: environment\.FD_KANIKO_IMAGE/);
  assert.match(
    bootstrapScript,
    /validateGhcrImageRef\('FD_KANIKO_IMAGE', kanikoImage\)/
  );
  assert.match(
    bootstrapScript,
    /Step 4\/10: Building fd-dev-kaniko image locally/
  );
  assert.match(bootstrapScript, /Step 5\/10: Pushing images to GHCR/);
  assert.match(bootstrapScript, /pushDockerImage\(kanikoImage\)/);
  assert.match(bootstrapScript, /path\.join\(scriptDir, 'docker-dev-kaniko'\)/);
  assert.ok(
    existsSync(path.join(packageDirectory, "docker-dev-kaniko", "Dockerfile"))
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

test("the k8s manifests named in bootstrap.mjs exist", () => {
  for (const manifest of K8S_MANIFESTS) {
    assert.ok(
      existsSync(path.join(packageDirectory, "k8s", manifest)),
      `missing k8s manifest: ${manifest}`
    );
    assert.ok(
      bootstrapScript.includes(`'${manifest}'`),
      `bootstrap.mjs does not reference ${manifest}`
    );
  }

  assert.ok(existsSync(path.join(packageDirectory, "k8s", "fd-k8s-rbac.yaml")));
  assert.match(
    bootstrapScript,
    /Step 7\/10: Rendering and applying runner RBAC/
  );
});

test("the namespace manifest declares exactly one namespace from a placeholder", () => {
  assert.equal(namespacesManifest.match(/kind: Namespace/g)?.length, 1);
  assert.match(namespacesManifest, /name: __NAMESPACE__/);

  const rendered = namespacesManifest.replaceAll("__NAMESPACE__", config.namespace);

  assert.doesNotMatch(rendered, /__[A-Z0-9_]+__/);
  assert.match(
    rendered,
    new RegExp(`kind: Namespace\\nmetadata:\\n {2}name: ${config.namespace}\\n`)
  );
});

test("the runner deployment runs two replicas in the configured namespace", () => {
  assert.match(deploymentTemplate, /namespace: __NAMESPACE__/);
  assert.match(
    deploymentTemplate,
    /app\.kubernetes\.io\/part-of: frickeldave\.github\.io/
  );
  assert.match(deploymentTemplate, /replicas: 2\b/);
  assert.match(deploymentTemplate, /imagePullPolicy: Always/);

  const rendered = deploymentTemplate
    .replaceAll("__NAMESPACE__", config.namespace)
    .replaceAll(
      "__RUNNER_IMAGE__",
      "ghcr.io/frickeldave/fd-dev-ghrunner:latest"
    );

  assert.doesNotMatch(rendered, /__[A-Z0-9_]+__/);
  assert.match(rendered, new RegExp(`namespace: ${config.namespace}`));
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

test("the namespace name lives only in bootstrap.json", () => {
  assert.ok(config.namespace, "bootstrap.json must configure a namespace");

  // Built from character codes so this guard cannot match its own source.
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

test("the package contains no leftover upstream naming", () => {
  // Built from character codes so this guard cannot match its own source.
  const forbidden = new RegExp(
    [
      String.fromCharCode(99, 114, 97, 102, 116),
      String.fromCharCode(97, 100, 101, 115, 115, 111),
    ].join("|"),
    "i"
  );

  for (const filePath of listPackageFiles(packageDirectory)) {
    const content = readFileSync(filePath, "utf8");
    const relativePath = path.relative(packageDirectory, filePath);

    assert.doesNotMatch(
      content,
      forbidden,
      `${relativePath} still references the old project`
    );
  }
});

test("package.json exposes the bootstrap scripts", () => {
  const packageJson = JSON.parse(
    readFileSync(path.join(repositoryRoot, "package.json"), "utf8")
  );

  assert.equal(
    packageJson.scripts.bootstrap,
    "node scripts/bootstrap/bootstrap.mjs"
  );
  assert.equal(
    packageJson.scripts["test:bootstrap"],
    "node --test scripts/bootstrap/bootstrap.test.mjs"
  );
});
