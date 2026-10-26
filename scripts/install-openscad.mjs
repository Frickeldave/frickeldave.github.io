#!/usr/bin/env node
/**
 * Plattformübergreifender OpenSCAD-CLI-Installer
 *
 * Lädt die OpenSCAD-CLI-Binary für die aktuelle Plattform herunter und entpackt
 * sie in ein projektlokales Verzeichnis. Fällt auf ein vorhandenes `openscad` im
 * PATH zurück.
 *
 * Aufruf:
 *   node scripts/install-openscad.mjs           # interaktiv
 *   node scripts/install-openscad.mjs --quiet   # stiller Modus
 *   node scripts/install-openscad.mjs --force   # auch bei vorhandener Installation neu installieren
 *
 * CI:
 *   npm ci                                      # löst postinstall aus
 *   node scripts/install-openscad.mjs --quiet   # explizite Installation
 */

import { execFile, execFileSync } from "node:child_process";
import { chmod, mkdir, readdir, rm, stat } from "node:fs/promises";
import { createWriteStream, existsSync } from "node:fs";
import https from "node:https";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

// ── Konfiguration ─────────────────────────────────────────────────────────────

const OPENSCAD_VERSION = "2021.01";
const DOWNLOAD_BASE = "https://files.openscad.org";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..");
const OPENSCAD_DIR = path.resolve(PROJECT_ROOT, ".openscad");

// Plattform und Architektur erkennen
const isWindows = process.platform === "win32";
const isMacOS = process.platform === "darwin";
const isLinux = process.platform === "linux";
const isArm = process.arch === "arm64" || process.arch === "aarch64";

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

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

// Literal-String in PowerShell; das Escape für ein einfaches Anführungszeichen ist '' (Verdopplung).
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
          // Das Fehlerobjekt von execFile trägt die mitgeschnittene Ausgabe hier nicht,
          // deshalb hängen wir sie für Aufrufer an, die lesbare Fehlermeldungen bauen.
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

// Führt eine PowerShell-Kommandozeile aus und meldet bei Fehlschlag das exakte
// Kommando, damit ein fehlendes oder kaputtes Tool als lesbare Meldung statt als nacktes ENOENT auftaucht.
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

// ── Plattform-Erkennung ───────────────────────────────────────────────────────

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

// ── PATH-Hilfen ───────────────────────────────────────────────────────────────

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

// ── Download-Hilfen ───────────────────────────────────────────────────────────

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

// ── Installer je Plattform ────────────────────────────────────────────────────

async function installLinuxAppImage() {
  const binaryPath = getOpenSCADBinaryPath();
  const url = getOpenSCADDownloadUrl();
  const appImageFilename = path.basename(url);
  const appImagePath = path.join(OPENSCAD_DIR, appImageFilename);

  await downloadFile(url, appImagePath);
  await chmod(appImagePath, 0o755);

  // AppImage entpacken, damit es ohne FUSE läuft (CI-freundlich)
  log("Extracting AppImage (this may take a moment)...");
  try {
    await execShell(appImagePath, ["--appimage-extract"], { cwd: OPENSCAD_DIR });
  } catch (err) {
    warn("AppImage extraction failed, trying direct execution later:", err.message);
  }

  // Extrahierte Binary suchen
  const extractedBinary = path.join(OPENSCAD_DIR, "squashfs-root", "usr", "bin", "openscad");
  if (existsSync(extractedBinary)) {
    await chmod(extractedBinary, 0o755);
    // Wrapper-Symlink anlegen
    await execShell("ln", ["-sf", extractedBinary, binaryPath]).catch(() => {});
  } else if (existsSync(appImagePath)) {
    // Fallback: Wrapper-Skript, das das AppImage ausführt
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

  // DMG mounten
  const mountDir = path.join(OPENSCAD_DIR, "_mount");
  await mkdir(mountDir, { recursive: true });
  await execShell("hdiutil", ["attach", dmgPath, "-mountpoint", mountDir, "-nobrowse", "-quiet"]);

  try {
    // OpenSCAD.app kopieren
    await execShell("cp", ["-R", path.join(mountDir, "OpenSCAD.app"), OPENSCAD_DIR]);
    await chmod(binaryPath, 0o755);
  } finally {
    // DMG unmounten
    await execShell("hdiutil", ["detach", mountDir, "-quiet"]).catch(() => {});
  }

  await rm(dmgPath, { force: true });
  await rm(mountDir, { recursive: true, force: true });
}

// Sucht rekursiv nach einem Dateinamen (case-insensitiv) und liefert seinen Pfad.
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
    // `unzip`, `cp` und `mv` gibt es unter Windows nicht, deshalb mit PowerShells
    // Expand-Archive entpacken, das immer vorhanden ist. `-LiteralPath` schaltet die
    // Wildcard-Expansion ab und `ErrorActionPreference=Stop` macht aus
    // nicht-terminierenden Cmdlet-Fehlern einen Exit-Code ungleich Null statt einer
    // stillen Teilentpackung.
    await rm(stagingDir, { recursive: true, force: true });
    await mkdir(stagingDir, { recursive: true });
    await runPowershell(
      [
        "$ErrorActionPreference='Stop';",
        `Expand-Archive -LiteralPath ${psLiteral(zipPath)}`,
        `-DestinationPath ${psLiteral(stagingDir)} -Force`,
      ].join(" ")
    );

    // Das Archiv verpackt seinen Inhalt in ein einziges Top-Level-Verzeichnis, dessen
    // Name in der Schreibweise variiert hat (`OpenSCAD-2021.01` vs. das mitgelieferte
    // `openscad-2021.01`). Deshalb den Ordner suchen, der die Binary tatsächlich
    // enthält, statt seinen Namen anzunehmen. Wird er nicht gefunden, ist das ein
    // harter Fehler.
    const extractedBinary = await findFileRecursive(stagingDir, "openscad.exe");
    if (!extractedBinary) {
      throw new Error(
        `openscad.exe not found in the extracted archive at ${stagingDir}`
      );
    }
    const payloadDir = path.dirname(extractedBinary);

    // Reste eines abgebrochenen Laufs entfernen, damit das Verschieben nicht kollidiert.
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

    // Den Archivinhalt eine Ebene nach oben verschieben, damit openscad.exe in .openscad/ liegt.
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

// ── Hauptinstallation ─────────────────────────────────────────────────────────

async function installOpenSCAD() {
  log(`OpenSCAD installer v${OPENSCAD_VERSION}`);

  // 1. Zuerst den PATH prüfen
  const pathBinary = findInPath("openscad");
  if (pathBinary && !force) {
    log(`✓ OpenSCAD found in PATH: ${pathBinary}`);
    return;
  }

  // 2. Lokale Installation prüfen
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

    // Installation prüfen
    if (!existsSync(binaryPath)) {
      throw new Error(`Installation completed but binary not found at ${binaryPath}`);
    }

    const version = await execShell(binaryPath, ["--version"]).catch(() => "unknown");
    log(`✓ OpenSCAD installed: ${version.trim() || binaryPath}`);

    // Warnen, wenn xvfb-run unter Linux fehlt — nötig für headless PNG-Rendering
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
