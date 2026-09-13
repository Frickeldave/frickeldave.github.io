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
import { chmod, mkdir, rm, stat } from "node:fs/promises";
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

function execShell(cmd, args = [], opts = {}) {
  return new Promise((resolve, reject) => {
    const proc = execFile(
      cmd,
      args,
      { ...opts, timeout: 120_000 },
      (err, stdout, _stderr) => {
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

async function installWindowsZip() {
  const zipPath = path.join(OPENSCAD_DIR, `OpenSCAD-${OPENSCAD_VERSION}.zip`);
  const url = getOpenSCADDownloadUrl();

  await downloadFile(url, zipPath);
  await execShell("tar", ["-xf", zipPath, "-C", OPENSCAD_DIR]);
  await rm(zipPath, { force: true });

  // The zip extracts to OpenSCAD-2021.01/; move contents up
  const extractedDir = path.join(OPENSCAD_DIR, `OpenSCAD-${OPENSCAD_VERSION}`);
  if (existsSync(extractedDir)) {
    const entries = await import("node:fs/promises").then((fs) => fs.readdir(extractedDir));
    for (const entry of entries) {
      const src = path.join(extractedDir, entry);
      const dst = path.join(OPENSCAD_DIR, entry);
      await execShell("mv", [src, dst]).catch(() => {});
    }
    await rm(extractedDir, { recursive: true, force: true });
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
