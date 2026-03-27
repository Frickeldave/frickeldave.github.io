#!/usr/bin/env node
/**
 * Installs the GitHub Copilot CLI (@github/copilot) globally if not already present.
 * Used as part of the postinstall hook.
 */

import { execSync, spawnSync } from "child_process";

function isCopilotInstalled() {
  // The VS Code shim exits 0 even when the real CLI is missing,
  // so we verify the output actually contains a version string.
  try {
    const r = spawnSync("copilot", ["--version"], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 5000,
    });
    return r.status === 0 && /\d+\.\d+/.test(r.stdout || "");
  } catch {
    return false;
  }
}

if (isCopilotInstalled()) {
  console.log("Copilot CLI: already installed, skipping.");
  process.exit(0);
}

console.log("Installing GitHub Copilot CLI (@github/copilot)...");
try {
  execSync("npm install -g @github/copilot", { stdio: "inherit" });
  console.log("Copilot CLI installed successfully.");
} catch (err) {
  console.warn(
    "Warning: Could not install Copilot CLI (non-fatal):",
    err.message
  );
}
