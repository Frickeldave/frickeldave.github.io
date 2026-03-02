#!/usr/bin/env node

/**
 * Main Orchestrator for update-dev-branch workflow
 *
 * Executes the following steps:
 * 1. Prereqs check
 * 2. Analyze changes
 * 3. Understand (Copilot analysis for commit message)
 * 4. Branch Management
 * 5. Quality Gates (lint, format, prose)
 * 6. Build & Test
 * 7. Commit
 * 8. Push
 * 9. Merge to dev
 * 10. Deployment Check
 * 11. Cleanup
 *
 * CLI Arguments (for non-interactive mode):
 *   --auto-cleanup      Auto-delete feature branch after merge (skip prompt)
 */

import { spawnSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { writeFileSync, existsSync, mkdirSync, unlinkSync, rmSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// State file to persist data between steps
const STATE_DIR = join(__dirname, ".state");
const STATE_FILE = join(STATE_DIR, "workflow-state.json");

// Temp file created by copilot understand step
const WORKSPACE_ROOT = join(__dirname, "..", "..", "..");
const COPILOT_PROMPT_FILE = join(WORKSPACE_ROOT, ".copilot-prompt-analyze.txt");

// Cleanup temporary files (called on success and failure)
function cleanup() {
  try {
    if (existsSync(COPILOT_PROMPT_FILE)) {
      unlinkSync(COPILOT_PROMPT_FILE);
    }
    if (existsSync(STATE_DIR)) {
      rmSync(STATE_DIR, { recursive: true, force: true });
    }
    console.log("🧹 Temporary files cleaned up.");
  } catch {
    // Ignore cleanup errors
  }
}

// --- Parse CLI args ---
const args = process.argv.slice(2);
const envOverrides = {};

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--auto-cleanup") {
    envOverrides.DEPLOY_AUTO_CLEANUP = "y";
  }
}

// Merge into current env so child processes inherit these
const childEnv = { ...process.env, ...envOverrides };

// Ensure state dir exists
if (!existsSync(STATE_DIR)) {
  mkdirSync(STATE_DIR, { recursive: true });
}

// Initialize empty state if starting fresh
writeFileSync(STATE_FILE, JSON.stringify({}, null, 2));

const steps = [
  "update-dev-branch-prereqs.mjs",
  "update-dev-branch-analyze.mjs",
  "update-dev-branch-understand.mjs",
  "update-dev-branch-branch-mgmt.mjs",
  "update-branch-quality.mjs",
  "update-branch-build.mjs",
  "update-dev-branch-commit.mjs",
  "update-dev-branch-push.mjs",
  "update-dev-branch-merge.mjs",
  "update-dev-branch-deploy-check.mjs",
  "update-branch-cleanup.mjs",
];

console.log("🚀 Starting update-dev-branch workflow...");
if (Object.keys(envOverrides).length > 0) {
  console.log(
    `   CLI args: ${Object.entries(envOverrides)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")}`
  );
}

for (const step of steps) {
  const scriptPath = join(__dirname, step);
  console.log(`\n---------------------------------------------------------`);
  console.log(`▶️  Running step: ${step}`);
  console.log(`---------------------------------------------------------`);

  const result = spawnSync("node", [scriptPath], {
    stdio: "inherit",
    encoding: "utf-8",
    shell: true,
    env: childEnv,
  });

  if (result.status !== 0) {
    console.error(`\n❌ Step failed: ${step}`);
    console.error("🛑 Workflow stopped.");

    // Print status hint
    console.log("\n🔍 Current Status:");
    spawnSync("git", ["status"], { stdio: "inherit", shell: true });
    spawnSync("git", ["log", "--oneline", "-5"], {
      stdio: "inherit",
      shell: true,
    });

    cleanup();
    process.exit(1);
  }
}

cleanup();
console.log("\n✅ Workflow completed successfully!");
