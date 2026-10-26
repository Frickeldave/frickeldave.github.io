#!/usr/bin/env node
/**
 * Plattformübergreifender Vale-Prosa-Checker
 *
 * Führt Vale über das Verzeichnis src/content mit der konfigurierten .vale.ini aus.
 * Nutzt die Vale-Binary aus .vale/ (plattformspezifisch).
 *
 * Aufruf:
 *   npm run prose
 */

import { execFile } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

// Plattform und Pfad der Vale-Binary ermitteln
const isWindows = process.platform === "win32";
const valePath = path.resolve(
  rootDir,
  ".vale",
  isWindows ? "vale.exe" : "vale"
);

const contentDir = "src/content";
const configPath = ".vale.ini";

// Vale ausführen
execFile(
  valePath,
  ["--config=" + configPath, contentDir],
  { cwd: rootDir, stdio: "pipe" },
  (err, stdout, stderr) => {
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
    if (err) {
      process.exit(1);
    }
  }
);
