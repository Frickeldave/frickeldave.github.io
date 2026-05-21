#!/usr/bin/env node
/**
 * Cross-platform Vale prose checker
 *
 * Runs Vale on the src/content directory with the configured .vale.ini.
 * Uses the Vale binary from .vale/ (platform-specific).
 *
 * Usage:
 *   npm run prose
 */

import { execFile } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

// Detect platform and Vale binary path
const isWindows = process.platform === "win32";
const valePath = path.resolve(
  rootDir,
  ".vale",
  isWindows ? "vale.exe" : "vale"
);

const contentDir = "src/content";
const configPath = ".vale.ini";

// Run Vale
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
