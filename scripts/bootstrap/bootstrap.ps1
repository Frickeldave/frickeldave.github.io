#!/usr/bin/env pwsh
<#
.SYNOPSIS
Bootstraps the standalone GitHub Actions runner deployment for Kubernetes.

.DESCRIPTION
This wrapper is intended for normal user PowerShell sessions on Windows. It
ensures a suitable Node.js runtime is available, then calls
`scripts/bootstrap/bootstrap.mjs` with the same namespace/extra arguments.

The Node.js script reads committed non-secret defaults from
`scripts/bootstrap/bootstrap.json` and resolves settings in this order:
CLI args -> env vars -> JSON config -> built-in defaults.

`-Namespace` is optional and has no default here: when it is omitted, the
namespace from `bootstrap.json` applies. Passing `-Namespace` overrides that
value for a single run.

Required/optional variables:
- DEV_BASE_IMAGE (optional): base image to build/push in Step 1. Defaults to
  `ghcr.io/frickeldave/fd-dev-base:latest`.
  Linux/macOS: `export DEV_BASE_IMAGE=ghcr.io/frickeldave/fd-dev-base:latest`
  Windows PowerShell: `$env:DEV_BASE_IMAGE = "ghcr.io/frickeldave/fd-dev-base:latest"`
- GH_RUNNER_IMAGE (optional): runner image to build/push/deploy in Step 3/5/8.
  Defaults to `ghcr.io/frickeldave/fd-dev-ghrunner:latest`.
  Linux/macOS: `export GH_RUNNER_IMAGE=ghcr.io/frickeldave/fd-dev-ghrunner:latest`
  Windows PowerShell: `$env:GH_RUNNER_IMAGE = "ghcr.io/frickeldave/fd-dev-ghrunner:latest"`
- FD_KANIKO_IMAGE (optional): Ubuntu-based Kaniko image to build/push in
    Step 4/5. It is built here but used by `fd-deploy.yaml`, which starts a
    throwaway Kaniko build Job per image; it is not deployed by this script.
    Defaults to `ghcr.io/frickeldave/fd-dev-kaniko:latest`. It is built from
    `scripts/bootstrap/docker-dev-kaniko` so the cluster never runs an arbitrary Kaniko
    executor image.
    Linux/macOS: `export FD_KANIKO_IMAGE=ghcr.io/frickeldave/fd-dev-kaniko:latest`
    Windows PowerShell: `$env:FD_KANIKO_IMAGE = "ghcr.io/frickeldave/fd-dev-kaniko:latest"`
- SKIP_IMAGE_BUILD (optional): set to `true` to skip docker login, all three
  image builds, and all three pushes.
  Linux/macOS: `export SKIP_IMAGE_BUILD=true`
  Windows PowerShell: `$env:SKIP_IMAGE_BUILD = "true"`
- GITHUB_PAT (required unless the Node.js script can prompt interactively):
  classic GitHub Personal Access Token used by the Node bootstrap script for
  `docker login ghcr.io`, the Kubernetes GHCR image pull Secret, and for the
  GitHub REST API call that mints a fresh runner registration token
  automatically on each run.
  Create it via GitHub -> Settings -> Developer settings -> Personal access
  tokens -> Tokens (classic) -> Generate new token (classic), with scopes:
  `repo`, `read:packages`, and `write:packages`. If `Frickeldave`
  enforces SSO, the token may also need SSO authorization after creation. If
  `GITHUB_PAT` is not set and stdin stays attached to an interactive TTY, the
  Node.js script prompts for it with masked input instead of echoing the token.
  Linux/macOS: `export GITHUB_PAT=ghp_xxxxx`
  Windows PowerShell: `$env:GITHUB_PAT = "ghp_xxxxx"`
- GITHUB_USERNAME (required): GitHub username used together with `GITHUB_PAT`
  for `docker login ghcr.io` and for the Kubernetes GHCR image pull Secret.
  Linux/macOS: `export GITHUB_USERNAME=octocat`
  Windows PowerShell: `$env:GITHUB_USERNAME = "octocat"`
- GITHUB_RUNNER_ORG (optional): GitHub organization login used to derive the
  repository URL. Defaults to `Frickeldave`.
  Linux/macOS: `export GITHUB_RUNNER_ORG=Frickeldave`
  Windows PowerShell: `$env:GITHUB_RUNNER_ORG = "Frickeldave"`
- GITHUB_RUNNER_REPO (optional): GitHub repository name used to derive the
  repository URL. Defaults to `frickeldave.github.io`.
  Linux/macOS: `export GITHUB_RUNNER_REPO=frickeldave.github.io`
  Windows PowerShell: `$env:GITHUB_RUNNER_REPO = "frickeldave.github.io"`
- RUNNER_NAME (optional): descriptive runner name. `bootstrap.json` ships
  `github-actions-runner`; the built-in fallback is `github-actions-runner-<namespace>` to keep
  runners from different namespaces unique per repository.
  Linux/macOS: `export RUNNER_NAME=github-actions-runner`
  Windows PowerShell: `$env:RUNNER_NAME = "github-actions-runner"`
- RUNNER_LABELS (optional): comma-separated runner labels. Defaults to
  `fd`.
  Linux/macOS: `export RUNNER_LABELS=fd`
  Windows PowerShell: `$env:RUNNER_LABELS = "fd"`
- RUNNER_SCOPE (optional): compatibility value stored in the Kubernetes Secret.
  Defaults to `repo`.
- KUBECONFIG (optional): kubeconfig file targeted by every kubectl call. Pass
  it with the `-Kubeconfig` parameter, which exports `KUBECONFIG` for the
  duration of the run and restores the previous value afterwards. Precedence:
  `-Kubeconfig` > `$env:KUBECONFIG` > `kubeconfig` key in `bootstrap.json` >
  current kubectl context.
  Windows PowerShell:
  `.\scripts\bootstrap\bootstrap.ps1 -Kubeconfig C:\Users\dakoenig\.kube\dev-kw-bee23d.yaml`

The bootstrap script derives `REPO_URL=https://github.com/<org>/<repo>` and
stores `RUNNER_SCOPE=repo` in the Secret by default. After rollout, verify
registration with:
`gh api repos/Frickeldave/frickeldave.github.io/actions/runners --jq '.runners[].name'`

See `scripts/bootstrap/README.md` for the full bootstrap flow and Kubernetes details.

.EXAMPLE
$env:GITHUB_PAT = "ghp_xxxxx"
$env:GITHUB_USERNAME = "octocat"
# Namespace comes from scripts/bootstrap/bootstrap.json
.\scripts\bootstrap\bootstrap.ps1 -Kubeconfig C:\Users\dakoenig\.kube\dev-kw-bee23d.yaml

.EXAMPLE
# Override the configured namespace for a single run
.\scripts\bootstrap\bootstrap.ps1 -Namespace <namespace> -Kubeconfig C:\Users\dakoenig\.kube\dev-kw-bee23d.yaml
#>

param(
    [string]$Namespace,
    [string]$Kubeconfig,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ForwardedArgs
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "▶ $Message"
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message"
}

function Fail {
    param([string]$Message)
    Write-Host "❌ $Message"
    exit 1
}

function Get-NodeMajorVersion {
    param([string]$NodePath = "node")

    try {
        $versionOutput = & $NodePath --version 2>$null
    }
    catch {
        return $null
    }

    if (-not $versionOutput) {
        return $null
    }

    if ($versionOutput -match "^v(?<Major>\d+)(\.\d+){0,2}$") {
        return [int]$Matches["Major"]
    }

    return $null
}

function Refresh-NodePath {
    if (Get-Command refreshenv -ErrorAction SilentlyContinue) {
        Write-Step "Refreshing PATH via refreshenv..."
        refreshenv | Out-Null
    }

    $candidatePaths = @(
        [Environment]::GetEnvironmentVariable("Path", "User"),
        [Environment]::GetEnvironmentVariable("Path", "Machine"),
        "$env:LOCALAPPDATA\Programs\nodejs",
        "$env:ProgramFiles\nodejs"
    ) | Where-Object { $_ }

    $pathEntries = [System.Collections.Generic.List[string]]::new()

    foreach ($candidate in $candidatePaths) {
        foreach ($entry in ($candidate -split ";")) {
            if (-not [string]::IsNullOrWhiteSpace($entry) -and -not $pathEntries.Contains($entry)) {
                $pathEntries.Add($entry)
            }
        }
    }

    foreach ($entry in ($env:Path -split ";")) {
        if (-not [string]::IsNullOrWhiteSpace($entry) -and -not $pathEntries.Contains($entry)) {
            $pathEntries.Add($entry)
        }
    }

    $env:Path = ($pathEntries | Where-Object { $_ }) -join ";"
}

function Ensure-Node24 {
    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    $currentMajor = Get-NodeMajorVersion

    if ($nodeCommand -and $null -ne $currentMajor -and $currentMajor -ge 24) {
        Write-Success "Using existing Node.js $currentMajor at $($nodeCommand.Source)"
        return
    }

    if ($nodeCommand) {
        $reportedVersion = if ($null -ne $currentMajor) { $currentMajor } else { "unknown" }
        Write-Step "Found Node.js $reportedVersion at $($nodeCommand.Source), but version 24 or newer is required."
    }
    else {
        Write-Step "Node.js was not found in PATH."
    }

    $wingetCommand = Get-Command winget -ErrorAction SilentlyContinue
    if (-not $wingetCommand) {
        Fail "winget is not available. Install Node.js 24 or newer manually from https://nodejs.org/ and re-run this script."
    }

    Write-Step "Installing Node.js for the current user via winget..."
    & $wingetCommand.Source install --id OpenJS.NodeJS.LTS --exact --scope user --accept-package-agreements --accept-source-agreements --disable-interactivity
    $installExitCode = $LASTEXITCODE

    Refresh-NodePath

    if ($installExitCode -ne 0) {
        Write-Step "winget install exited with code $installExitCode. Trying winget upgrade as a fallback..."
        & $wingetCommand.Source upgrade --id OpenJS.NodeJS.LTS --exact --scope user --accept-package-agreements --accept-source-agreements --disable-interactivity
        if ($LASTEXITCODE -ne 0) {
            Fail "winget could not install or upgrade Node.js LTS for the current user. Install Node.js 24 or newer manually from https://nodejs.org/ and re-run this script."
        }

        Refresh-NodePath
    }

    $installedMajor = Get-NodeMajorVersion
    if ($null -eq $installedMajor -or $installedMajor -lt 24) {
        Fail "Node.js 24 or newer is still not available in this PowerShell session. Open a new shell or install Node.js manually from https://nodejs.org/ and re-run this script."
    }

    $resolvedNode = Get-Command node -ErrorAction SilentlyContinue
    if ($resolvedNode) {
        Write-Success "Using Node.js $installedMajor at $($resolvedNode.Source)"
        return
    }

    Write-Success "Using Node.js $installedMajor"
}

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$nodeScriptPath = Join-Path $repoRoot "scripts\bootstrap\bootstrap.mjs"

if (-not (Test-Path $nodeScriptPath)) {
    Fail "Missing $nodeScriptPath"
}

Ensure-Node24

$nodeArgs = @("scripts/bootstrap/bootstrap.mjs")

if ($Namespace) {
    $nodeArgs += @("--namespace", $Namespace)
}

if ($Kubeconfig) {
    if (-not (Test-Path -LiteralPath $Kubeconfig)) {
        Fail "Kubeconfig not found: $Kubeconfig"
    }

    $nodeArgs += @("--kubeconfig", $Kubeconfig)
}

if ($ForwardedArgs) {
    $nodeArgs += $ForwardedArgs
}

# Export KUBECONFIG for the child process so any kubectl call made outside
# bootstrap.mjs targets the same cluster, then restore the previous value.
$previousKubeconfig = $env:KUBECONFIG
$kubeconfigExported = $false

if ($Kubeconfig) {
    $env:KUBECONFIG = (Resolve-Path -LiteralPath $Kubeconfig).Path
    $kubeconfigExported = $true
    Write-Step "Using kubeconfig $($env:KUBECONFIG)"
}

Write-Step "Running bootstrap.mjs..."
Push-Location $repoRoot
try {
    & node @nodeArgs
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}
finally {
    Pop-Location

    if ($kubeconfigExported) {
        $env:KUBECONFIG = $previousKubeconfig
    }
}
