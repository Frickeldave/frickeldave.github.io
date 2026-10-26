#!/usr/bin/env node
/**
 * Ermittelt den Pfad der OpenSCAD-Binary.
 *
 * Priorität:
 *   1. `openscad` im PATH gefunden
 *   2. projektlokal installiertes OpenSCAD aus `scripts/install-openscad.mjs`
 *   3. null, wenn nichts gefunden wurde
 *
 * Aufruf:
 *   import { getOpenSCADPath } from "./scripts/get-openscad-path.mjs";
 *   const openscad = getOpenSCADPath();
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..");

const isWindows = process.platform === "win32";
const isMacOS = process.platform === "darwin";
const isLinux = process.platform === "linux";

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

function getLocalBinaryPath() {
  if (isWindows) {
    return path.join(PROJECT_ROOT, ".openscad", "openscad.exe");
  }
  if (isMacOS) {
    return path.join(PROJECT_ROOT, ".openscad", "OpenSCAD.app", "Contents", "MacOS", "OpenSCAD");
  }
  if (isLinux) {
    return path.join(PROJECT_ROOT, ".openscad", "openscad");
  }
  return null;
}

export function getOpenSCADPath() {
  const pathBinary = findInPath("openscad");
  if (pathBinary) return pathBinary;

  const localBinary = getLocalBinaryPath();
  if (localBinary && existsSync(localBinary)) return localBinary;

  return null;
}

// CLI-Aufruf: gibt den ermittelten Pfad aus
if (import.meta.url === `file://${process.argv[1]}`) {
  const p = getOpenSCADPath();
  if (p) {
    console.log(p);
    process.exit(0);
  } else {
    console.error("OpenSCAD not found in PATH or project-local install.");
    process.exit(1);
  }
}
