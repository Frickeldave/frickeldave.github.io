#!/usr/bin/env node
/**
 * Cross-platform Vale installer
 *
 * Downloads the Vale binary and style guides (Microsoft, write-good)
 * for the current platform automatically.
 *
 * Usage:
 *   node scripts/prose-install.mjs           # interactive
 *   node scripts/prose-install.mjs --quiet   # silent mode
 *   node scripts/prose-install.mjs --force   # reinstall even if already installed
 */

import { execFile } from "node:child_process";
import { chmod, mkdir, rm, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import https from "node:https";
import path from "node:path";
import process from "node:process";

// ── Config ────────────────────────────────────────────────────────────────────

const VALE_VERSION = "3.7.1";
const GITHUB_BASE = "https://github.com";
const REPO_MIRROR = "https://github.com";

// Detect platform and architecture
const isWindows = process.platform === "win32";
const isMacOS = process.platform === "darwin";
const isLinux = process.platform === "linux";
const isArm = process.arch === "arm64";

const VALE_DIR = path.resolve(".vale");
const STYLES_DIR = path.join(VALE_DIR, "styles");
const VALE_BINARY = isWindows
  ? path.join(VALE_DIR, "vale.exe")
  : path.join(VALE_DIR, "vale");

// ── Helpers ───────────────────────────────────────────────────────────────────

let quiet = false;
let force = false;

function log(...args) {
  if (!quiet) console.log(...args);
}

function warn(...args) {
  console.error("\x1b[33m⚠ ", ...args, "\x1b[0m");
}

function error(...args) {
  console.error("\x1b[31m✖ ", ...args, "\x1b[0m");
}

// ── Argument parsing ──────────────────────────────────────────────────────────

for (const arg of process.argv.slice(2)) {
  if (arg === "--quiet" || arg === "-q") quiet = true;
  if (arg === "--force" || arg === "-f") force = true;
}

function execShell(cmd, args = [], opts = {}) {
  return new Promise((resolve, reject) => {
    const proc = execFile(
      cmd,
      args,
      { ...opts, timeout: 120_000 },
      (err, stdout, stderr) => {
        if (err) return reject(err);
        resolve(stdout);
      }
    );
    if (!quiet) {
      proc.stdout?.pipe(process.stdout);
      proc.stderr?.pipe(process.stderr);
    }
  });
}

// ── Platform detection ────────────────────────────────────────────────────────

function getValeDownloadUrl() {
  if (isWindows) {
    return `${GITHUB_BASE}/errata-ai/vale/releases/download/v${VALE_VERSION}/vale_${VALE_VERSION}_Windows_64-bit.zip`;
  }
  if (isMacOS && isArm) {
    return `${GITHUB_BASE}/errata-ai/vale/releases/download/v${VALE_VERSION}/vale_${VALE_VERSION}_macOS_arm64.tar.gz`;
  }
  if (isMacOS) {
    return `${GITHUB_BASE}/errata-ai/vale/releases/download/v${VALE_VERSION}/vale_${VALE_VERSION}_macOS_x86_64.tar.gz`;
  }
  if (isLinux) {
    return `${GITHUB_BASE}/errata-ai/vale/releases/download/v${VALE_VERSION}/vale_${VALE_VERSION}_Linux_64-bit.tar.gz`;
  }
  throw new Error(`Unsupported platform: ${process.platform} ${process.arch}`);
}

// ── Download utilities ────────────────────────────────────────────────────────

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    log(`  → ${url}`);
    const file = createWriteStream(destPath);
    https
      .get(url, (res) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          // Follow redirects
          return downloadFile(res.headers.location, destPath)
            .then(resolve)
            .catch(reject);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", (err) => {
        file.destroy();
        reject(err);
      });
  });
}

// ── Step 1: Download Vale binary ─────────────────────────────────────────────

async function installValeBinary() {
  const valePath = isWindows
    ? path.join(VALE_DIR, "vale.exe")
    : path.join(VALE_DIR, "vale");
  const valeExists = await stat(valePath)
    .then(() => true)
    .catch(() => false);

  if (valeExists && !force) {
    log("✓ Vale binary already installed");
    return;
  }

  log("Downloading Vale v%s...", VALE_VERSION);

  const archivePath = path.join(VALE_DIR, `vale-${VALE_VERSION}.archive`);
  const url = getValeDownloadUrl();

  await downloadFile(url, archivePath);

  if (isWindows) {
    // Extract .zip using system unzip
    await execShell("unzip", ["-o", archivePath, "-d", VALE_DIR]);
    log("  Extracted Windows archive");
  } else {
    // Extract .tar.gz using system tar
    await execShell("tar", ["xzf", archivePath, "-C", VALE_DIR]);
    log("  Extracted Unix archive");
  }

  await rm(archivePath);

  // Make executable (no-op on Windows)
  if (!isWindows) {
    await chmod(valePath, 0o755);
  }

  log("✓ Vale binary installed");
}

// ── Step 2: Download style guides ─────────────────────────────────────────────

async function installStyleGuide(repo, localName) {
  const targetDir = path.join(STYLES_DIR, localName);
  const targetExists = await stat(targetDir)
    .then(() => true)
    .catch(() => false);

  if (targetExists && !force) {
    log(`✓ Style guide "${localName}" already installed`);
    return;
  }

  log("Downloading style guide: %s...", localName);

  const tmpDir = path.join(VALE_DIR, "_tmp-" + localName);
  const url = `${REPO_MIRROR}/${repo}.git`;

  // Clone into temp directory
  await execShell("git", ["clone", "--depth", "1", url, tmpDir]);

  // Copy entire style folder to target
  await rm(targetDir, { recursive: true, force: true }).catch(() => {});
  await execShell("cp", ["-r", path.join(tmpDir, localName), targetDir]);

  // Clean up temp
  await rm(tmpDir, { recursive: true, force: true });

  log('✓ Style guide "%s" installed', localName);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  log("");
  log("╔══════════════════════════════════════════╗");
  log("║       Vale Installer v%s               ║", VALE_VERSION);
  log("╚══════════════════════════════════════════╝");
  log("");
  log(
    "Platform: %s %s (%s)",
    process.platform,
    process.arch,
    isWindows ? "Windows" : isMacOS ? "macOS" : isLinux ? "Linux" : "Unknown"
  );

  // Ensure directories exist
  await mkdir(VALE_DIR, { recursive: true });
  await mkdir(STYLES_DIR, { recursive: true });

  try {
    // Install Vale binary
    await installValeBinary();

    // Install style guides
    await installStyleGuide("errata-ai/Microsoft", "Microsoft");
    await installStyleGuide("errata-ai/write-good", "write-good");

    // Verify installation
    const versionOutput = await execShell(VALE_BINARY, ["--version"]);

    log("");
    log("✓ Vale installation complete!");
    log("  Version: %s", versionOutput.trim());
    log("");
  } catch (err) {
    error("Installation failed:", err.message);
    if (err.stdout) log("  stdout:", err.stdout.toString());
    if (err.stderr) log("  stderr:", err.stderr.toString());
    process.exit(1);
  }
}

main();
