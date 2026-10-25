import assert from "node:assert/strict";
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

test("bootstrap.json carries the fd target values", () => {
  assert.equal(config.namespace, "fd-infra");
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
  assert.match(bootstrapScript, /const DEFAULT_NAMESPACE = 'fd-infra';/);
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

test("the namespace manifest declares only fd-infra", () => {
  assert.equal(namespacesManifest.match(/kind: Namespace/g)?.length, 1);
  assert.match(namespacesManifest, /name: fd-infra/);
});

test("the runner deployment runs two replicas in the fd namespace", () => {
  assert.match(deploymentTemplate, /namespace: __NAMESPACE__/);
  assert.match(
    deploymentTemplate,
    /app\.kubernetes\.io\/part-of: frickeldave\.github\.io/
  );
  assert.match(deploymentTemplate, /replicas: 2\b/);
  assert.match(deploymentTemplate, /imagePullPolicy: Always/);

  const rendered = deploymentTemplate
    .replaceAll("__NAMESPACE__", "fd-infra")
    .replaceAll(
      "__RUNNER_IMAGE__",
      "ghcr.io/frickeldave/fd-dev-ghrunner:latest"
    );

  assert.doesNotMatch(rendered, /__[A-Z0-9_]+__/);
  assert.match(rendered, /namespace: fd-infra/);
});

test("runner RBAC keeps the kaniko capability and stays in fd-infra", () => {
  assert.match(rbacTemplate, /name: kaniko-builder/);
  assert.match(rbacTemplate, /namespace: fd-infra/);
  assert.match(rbacTemplate, /namespace: __NAMESPACE__/);
  assert.match(rbacTemplate, /resources: \["jobs"\]/);
  assert.match(rbacTemplate, /resources: \["secrets"\]/);
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
