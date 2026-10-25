#!/usr/bin/env node
/**
 * Cross-platform OpenSCAD CLI installer
 *
 * Downloads and extracts the OpenSCAD CLI binary for the current platform
 * into a project-local directory. Falls back to an existing `openscad` in PATH.
 *
 * Usage:
 *   node scripts/install-openscad.mjs           # interactive
 *   node scripts/install-openscad.mjs --quiet   # silent mode
 *   node scripts/install-openscad.mjs --force   # reinstall even if already installed
 *
 * CI:
 *   npm ci                                      # triggers postinstall
 *   node scripts/install-openscad.mjs --quiet   # explicit install
 */

import { execFile, execFileSync } from "node:child_process";
import { chmod, mkdir, readdir, rm, stat } from "node:fs/promises";
import { createWriteStream, existsSync } from "node:fs";
import https from "node:https";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

// ── Config ────────────────────────────────────────────────────────────────────

const OPENSCAD_VERSION = "2021.01";
const DOWNLOAD_BASE = "https://files.openscad.org";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..");
const OPENSCAD_DIR = path.resolve(PROJECT_ROOT, ".openscad");

// Detect platform and architecture
const isWindows = process.platform === "win32";
const isMacOS = process.platform === "darwin";
const isLinux = process.platform === "linux";
const isArm = process.arch === "arm64" || process.arch === "aarch64";

// ── Helpers ───────────────────────────────────────────────────────────────────

let quiet = false;
let force = false;

for (const arg of process.argv.slice(2)) {
  if (arg === "--quiet" || arg === "-q") quiet = true;
  if (arg === "--force" || arg === "-f") force = true;
}

function log(...args) {
  if (!quiet) console.log(...args);
}

function warn(...args) {
  console.error("\x1b[33m⚠ ", ...args, "\x1b[0m");
}

function error(...args) {
  console.error("\x1b[31m✖ ", ...args, "\x1b[0m");
}

// PowerShell literal string; the escape for a single quote is '' (doubling).
function psLiteral(value) {
  return `'${path.resolve(value).replace(/'/g, "''")}'`;
}

function execShell(cmd, args = [], opts = {}) {
  return new Promise((resolve, reject) => {
    const proc = execFile(
      cmd,
      args,
      { ...opts, timeout: 120_000 },
      (err, stdout, stderr) => {
        if (err) {
          // execFile's error object does not carry the captured output here, so
          // attach it for callers that build readable failure messages.
          err.stdout = stdout;
          err.stderr = stderr;
          return reject(err);
        }
        resolve(stdout);
      }
    );
    if (!quiet) {
      proc.stdout?.pipe(process.stdout);
      proc.stderr?.pipe(process.stderr);
    }
  });
}

// Runs a PowerShell command line and reports the exact command on failure, so
// a missing/broken tool surfaces as a readable message instead of a bare ENOENT.
function runPowershell(command) {
  const args = ["-NoProfile", "-NonInteractive", "-Command", command];
  return new Promise((resolve, reject) => {
    execShell("powershell.exe", args).then(resolve, (err) => {
      const detail = (err.stderr?.toString() ?? "").trim();
      const wrapped = new Error(
        `powershell.exe ${args.join(" ")} failed (exit ${
          err.code ?? "unknown"
        }): ${detail || err.message}`
      );
      wrapped.stdout = err.stdout;
      wrapped.stderr = err.stderr;
      reject(wrapped);
    });
  });
}

// ── Platform detection ────────────────────────────────────────────────────────

function getOpenSCADDownloadUrl() {
  if (isWindows) {
    return `${DOWNLOAD_BASE}/OpenSCAD-${OPENSCAD_VERSION}-x86-64.zip`;
  }
  if (isMacOS) {
    return `${DOWNLOAD_BASE}/OpenSCAD-${OPENSCAD_VERSION}.dmg`;
  }
  if (isLinux && isArm) {
    return `${DOWNLOAD_BASE}/OpenSCAD-${OPENSCAD_VERSION}-aarch64.AppImage`;
  }
  if (isLinux) {
    return `${DOWNLOAD_BASE}/OpenSCAD-${OPENSCAD_VERSION}-x86_64.AppImage`;
  }
  throw new Error(`Unsupported platform: ${process.platform} ${process.arch}`);
}

function getOpenSCADBinaryPath() {
  if (isWindows) {
    return path.join(OPENSCAD_DIR, "openscad.exe");
  }
  if (isMacOS) {
    return path.join(OPENSCAD_DIR, "OpenSCAD.app", "Contents", "MacOS", "OpenSCAD");
  }
  if (isLinux) {
    return path.join(OPENSCAD_DIR, "openscad");
  }
  throw new Error(`Unsupported platform: ${process.platform} ${process.arch}`);
}

// ── PATH helpers ──────────────────────────────────────────────────────────────

function findInPath(command) {
  try {
    return execFileSync(
      isWindows ? "where" : "which",
      [command],
      { stdio: ["ignore", "pipe", "ignore"], timeout: 10_000 }
    )
      .toString()
      .trim()
      .split(/\r?\n/)[0];
  } catch {
    return null;
  }
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

// ── Installers per platform ───────────────────────────────────────────────────

async function installLinuxAppImage() {
  const binaryPath = getOpenSCADBinaryPath();
  const url = getOpenSCADDownloadUrl();
  const appImageFilename = path.basename(url);
  const appImagePath = path.join(OPENSCAD_DIR, appImageFilename);

  await downloadFile(url, appImagePath);
  await chmod(appImagePath, 0o755);

  // Extract AppImage so it can run without FUSE (CI-friendly)
  log("Extracting AppImage (this may take a moment)...");
  try {
    await execShell(appImagePath, ["--appimage-extract"], { cwd: OPENSCAD_DIR });
  } catch (err) {
    warn("AppImage extraction failed, trying direct execution later:", err.message);
  }

  // Try to find the extracted binary
  const extractedBinary = path.join(OPENSCAD_DIR, "squashfs-root", "usr", "bin", "openscad");
  if (existsSync(extractedBinary)) {
    await chmod(extractedBinary, 0o755);
    // Create wrapper symlink
    await execShell("ln", ["-sf", extractedBinary, binaryPath]).catch(() => {});
  } else if (existsSync(appImagePath)) {
    // Fallback: wrapper script that runs the AppImage
    const wrapper = `#!/bin/sh\nexec "${appImagePath}" "$@"\n`;
    await import("node:fs/promises").then((fs) => fs.writeFile(binaryPath, wrapper));
    await chmod(binaryPath, 0o755);
  }
}

async function installMacOSDmg() {
  const binaryPath = getOpenSCADBinaryPath();
  const dmgPath = path.join(OPENSCAD_DIR, `OpenSCAD-${OPENSCAD_VERSION}.dmg`);
  const url = getOpenSCADDownloadUrl();

  await downloadFile(url, dmgPath);

  // Mount DMG
  const mountDir = path.join(OPENSCAD_DIR, "_mount");
  await mkdir(mountDir, { recursive: true });
  await execShell("hdiutil", ["attach", dmgPath, "-mountpoint", mountDir, "-nobrowse", "-quiet"]);

  try {
    // Copy OpenSCAD.app
    await execShell("cp", ["-R", path.join(mountDir, "OpenSCAD.app"), OPENSCAD_DIR]);
    await chmod(binaryPath, 0o755);
  } finally {
    // Unmount DMG
    await execShell("hdiutil", ["detach", mountDir, "-quiet"]).catch(() => {});
  }

  await rm(dmgPath, { force: true });
  await rm(mountDir, { recursive: true, force: true });
}

// Recursively looks for a file name (case-insensitive) and returns its path.
async function findFileRecursive(dir, fileName) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = await findFileRecursive(fullPath, fileName);
      if (found) return found;
    } else if (entry.name.toLowerCase() === fileName.toLowerCase()) {
      return fullPath;
    }
  }
  return null;
}

async function installWindowsZip() {
  const zipPath = path.join(OPENSCAD_DIR, `OpenSCAD-${OPENSCAD_VERSION}.zip`);
  const stagingDir = path.join(OPENSCAD_DIR, "_extract");
  const url = getOpenSCADDownloadUrl();

  await downloadFile(url, zipPath);

  try {
    // `unzip`, `cp` and `mv` are not shipped with Windows, so extract with
    // PowerShell's Expand-Archive, which is always available. `-LiteralPath`
    // disables wildcard expansion and `ErrorActionPreference=Stop` turns
    // non-terminating cmdlet errors into a non-zero exit code instead of a
    // silent partial extraction.
    await rm(stagingDir, { recursive: true, force: true });
    await mkdir(stagingDir, { recursive: true });
    await runPowershell(
      [
        "$ErrorActionPreference='Stop';",
        `Expand-Archive -LiteralPath ${psLiteral(zipPath)}`,
        `-DestinationPath ${psLiteral(stagingDir)} -Force`,
      ].join(" ")
    );

    // The archive wraps its payload in a single top-level directory whose name
    // has varied in case (`OpenSCAD-2021.01` vs. the shipped `openscad-2021.01`),
    // so locate the folder that actually contains the binary instead of
    // assuming its name. Not finding it is a hard failure.
    const extractedBinary = await findFileRecursive(stagingDir, "openscad.exe");
    if (!extractedBinary) {
      throw new Error(
        `openscad.exe not found in the extracted archive at ${stagingDir}`
      );
    }
    const payloadDir = path.dirname(extractedBinary);

    // Drop leftovers of an interrupted run so the move cannot collide.
    const keep = new Set(
      [path.basename(zipPath), path.basename(stagingDir)].map((name) =>
        name.toLowerCase()
      )
    );
    for (const entry of await readdir(OPENSCAD_DIR)) {
      if (!keep.has(entry.toLowerCase())) {
        await rm(path.join(OPENSCAD_DIR, entry), { recursive: true, force: true });
      }
    }

    // Move the archive payload one level up so openscad.exe sits in .openscad/.
    await runPowershell(
      [
        "$ErrorActionPreference='Stop';",
        `Get-ChildItem -LiteralPath ${psLiteral(payloadDir)} |`,
        `Move-Item -Destination ${psLiteral(OPENSCAD_DIR)} -Force`,
      ].join(" ")
    );
  } finally {
    await rm(stagingDir, { recursive: true, force: true }).catch(() => {});
    await rm(zipPath, { force: true }).catch(() => {});
  }
}

// ── Main install ──────────────────────────────────────────────────────────────

async function installOpenSCAD() {
  log(`OpenSCAD installer v${OPENSCAD_VERSION}`);

  // 1. Check PATH first
  const pathBinary = findInPath("openscad");
  if (pathBinary && !force) {
    log(`✓ OpenSCAD found in PATH: ${pathBinary}`);
    return;
  }

  // 2. Check local install
  const binaryPath = getOpenSCADBinaryPath();
  const binaryExists = await stat(binaryPath)
    .then(() => true)
    .catch(() => false);

  if (binaryExists && !force) {
    log(`✓ OpenSCAD already installed locally: ${binaryPath}`);
    return;
  }

  await mkdir(OPENSCAD_DIR, { recursive: true });

  log(`Downloading OpenSCAD v${OPENSCAD_VERSION} for ${process.platform} ${process.arch}...`);

  try {
    if (isLinux) await installLinuxAppImage();
    else if (isMacOS) await installMacOSDmg();
    else if (isWindows) await installWindowsZip();

    // Verify installation
    if (!existsSync(binaryPath)) {
      throw new Error(`Installation completed but binary not found at ${binaryPath}`);
    }

    const version = await execShell(binaryPath, ["--version"]).catch(() => "unknown");
    log(`✓ OpenSCAD installed: ${version.trim() || binaryPath}`);

    // Warn if xvfb-run is missing on Linux — needed for headless PNG rendering
    if (isLinux) {
      try {
        execFileSync("which", ["xvfb-run"], { stdio: "ignore", timeout: 5_000 });
      } catch {
        warn("PNG rendering on headless Linux requires 'xvfb-run'.");
        warn("Install it with: sudo apt-get install -y xvfb   (Debian/Ubuntu)");
        warn("Or: sudo yum install -y xorg-x11-server-Xvfb   (RHEL/Fedora)");
      }
    }
  } catch (err) {
    error(`Failed to install OpenSCAD: ${err.message}`);
    error("Please install OpenSCAD manually from https://openscad.org/downloads.html");
    process.exit(1);
  }
}

installOpenSCAD().catch((err) => {
  error(`Unexpected error: ${err.message}`);
  process.exit(1);
});
