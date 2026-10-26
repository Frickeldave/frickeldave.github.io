#!/usr/bin/env node
/**
 * Plattformübergreifender Vale-Installer
 *
 * Lädt die Vale-Binary und die Style-Guides (Microsoft, write-good) automatisch
 * für die aktuelle Plattform herunter.
 *
 * Aufruf:
 *   node scripts/prose-install.mjs           # interaktiv
 *   node scripts/prose-install.mjs --quiet   # stiller Modus
 *   node scripts/prose-install.mjs --force   # auch bei vorhandener Installation neu installieren
 */

import { execFile } from "node:child_process";
import { chmod, mkdir, rm, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import https from "node:https";
import path from "node:path";
import process from "node:process";

// ── Konfiguration ─────────────────────────────────────────────────────────────

const VALE_VERSION = "3.7.1";
const GITHUB_BASE = "https://github.com";
const REPO_MIRROR = "https://github.com";

// Plattform und Architektur erkennen
const isWindows = process.platform === "win32";
const isMacOS = process.platform === "darwin";
const isLinux = process.platform === "linux";
const isArm = process.arch === "arm64";

const VALE_DIR = path.resolve(".vale");
const STYLES_DIR = path.join(VALE_DIR, "styles");
const VALE_BINARY = isWindows
  ? path.join(VALE_DIR, "vale.exe")
  : path.join(VALE_DIR, "vale");

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

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

// Literal-String in PowerShell; das Escape für ein einfaches Anführungszeichen ist '' (Verdopplung).
function psLiteral(value) {
  return `'${path.resolve(value).replace(/'/g, "''")}'`;
}

// ── Argument-Parsing ──────────────────────────────────────────────────────────

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

// ── Download-Hilfen ───────────────────────────────────────────────────────────

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    log(`  → ${url}`);
    https
      .get(url, (res) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          // Redirects folgen. Das Ziel erst für den letzten Hop öffnen: ein aus einem
          // Redirect übrig gebliebener Write-Stream hält die Datei unter Windows
          // gesperrt, was das spätere Entpacken blockiert.
          res.resume();
          return downloadFile(res.headers.location, destPath)
            .then(resolve)
            .catch(reject);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        const file = createWriteStream(destPath);
        res.pipe(file);
        file.on("finish", () => {
          // Erst auflösen, wenn der Deskriptor geschlossen ist, damit Aufrufer das
          // Archiv direkt danach lesen können (unter Windows erforderlich).
          file.close(() => resolve());
        });
        file.on("error", (err) => {
          file.destroy();
          reject(err);
        });
      })
      .on("error", (err) => {
        reject(err);
      });
  });
}

// ── Schritt 1: Vale-Binary herunterladen ──────────────────────────────────────

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
    // `unzip` gibt es unter Windows nicht, deshalb PowerShells Expand-Archive nutzen,
    // das immer vorhanden ist. `-LiteralPath` schaltet die Wildcard-Expansion ab und
    // `ErrorActionPreference=Stop` macht aus nicht-terminierenden Cmdlet-Fehlern einen
    // Exit-Code ungleich Null statt einer stillen Teilentpackung.
    const command = [
      "$ErrorActionPreference='Stop';",
      `Expand-Archive -LiteralPath ${psLiteral(archivePath)}`,
      `-DestinationPath ${psLiteral(VALE_DIR)} -Force`,
    ].join(" ");

    await runPowershell(command);
    log("  Extracted Windows archive");
  } else {
    // .tar.gz mit dem System-tar entpacken
    await execShell("tar", ["xzf", archivePath, "-C", VALE_DIR]);
    log("  Extracted Unix archive");
  }

  await rm(archivePath);

  // Ausführbar machen (unter Windows ein No-op)
  if (!isWindows) {
    await chmod(valePath, 0o755);
  }

  log("✓ Vale binary installed");
}

// ── Schritt 2: Style-Guides herunterladen ─────────────────────────────────────

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

  // In ein temporäres Verzeichnis klonen
  await execShell("git", ["clone", "--depth", "1", url, tmpDir]);

  // Kompletten Style-Ordner ins Ziel kopieren
  await rm(targetDir, { recursive: true, force: true }).catch(() => {});
  if (isWindows) {
    // `cp` gibt es unter Windows nicht, deshalb mit PowerShells Copy-Item kopieren.
    await runPowershell(
      [
        "$ErrorActionPreference='Stop';",
        `Copy-Item -LiteralPath ${psLiteral(path.join(tmpDir, localName))}`,
        `-Destination ${psLiteral(targetDir)} -Recurse -Force`,
      ].join(" ")
    );
  } else {
    await execShell("cp", ["-r", path.join(tmpDir, localName), targetDir]);
  }

  // Temp aufräumen
  await rm(tmpDir, { recursive: true, force: true });

  log('✓ Style guide "%s" installed', localName);
}

// ── Hauptablauf ───────────────────────────────────────────────────────────────

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

  // Sicherstellen, dass die Verzeichnisse existieren
  await mkdir(VALE_DIR, { recursive: true });
  await mkdir(STYLES_DIR, { recursive: true });

  try {
    // Vale-Binary installieren
    await installValeBinary();

    // Style-Guides installieren
    await installStyleGuide("errata-ai/Microsoft", "Microsoft");
    await installStyleGuide("errata-ai/write-good", "write-good");

    // Installation prüfen
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
