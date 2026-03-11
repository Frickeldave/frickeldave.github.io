#!/usr/bin/env node

/**
 * Main Orchestrator for update-prd-branch workflow
 *
 * Executes the following steps (matching deploy-prd.md):
 * 1. Prereqs check (dev branch, clean, pushed)
 * 2. Issue Check (optional)
 * 3. Analyze changes (main..dev)
 * 4. Understand (Copilot analysis)
 * 5. Issue Create (if needed)
 * 6. Checkout main & Pull
 * 7. Merge dev -> main
 * 8. Build & Test
 * 9. Quality Gates (on main)
 * 10. Push main
 * 11. Deployment Check
 * 12. Issue Close
 * 13. Cleanup & Summary
 */

import { spawnSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
  rmSync,
} from "fs";

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
  if (args[i] === "--issue-id" && args[i + 1]) {
    envOverrides.DEPLOY_ISSUE_ID = args[++i];
  }
  if (args[i] === "--skip-issue") {
    envOverrides.DEPLOY_SKIP_ISSUE = "true";
  }
}

// Merge into current env so child processes inherit these
const childEnv = { ...process.env, ...envOverrides, TARGET_BRANCH: "main" };

// Ensure state dir exists
if (!existsSync(STATE_DIR)) {
  mkdirSync(STATE_DIR, { recursive: true });
}

// Initialize empty state if starting fresh
writeFileSync(STATE_FILE, JSON.stringify({}, null, 2));

const steps = [
  "update-prd-branch-prereqs.mjs",
  "update-branch-issue-check.mjs",
  "update-prd-branch-analyze.mjs",
  "update-prd-branch-understand.mjs",
  "update-branch-issue-create.mjs",
  "update-prd-branch-merge.mjs", // Includes checkout main, pull, merge
  "update-branch-build.mjs",
  "update-branch-quality.mjs",
  "update-prd-branch-push.mjs",
  "update-prd-branch-deploy-check.mjs",
  "update-branch-issue-close.mjs",
];

console.log("🚀 Starting update-prd-branch workflow...");
if (Object.keys(envOverrides).length > 0) {
  console.log(
    `   CLI args: ${Object.entries(envOverrides)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")}`
  );
}

// Backup state before merge step (git operations can delete untracked files)
let stateBackup = null;

for (const step of steps) {
  const scriptPath = join(__dirname, step);
  console.log(`\n---------------------------------------------------------`);
  console.log(`▶️  Running step: ${step}`);
  console.log(`---------------------------------------------------------`);

  // Save state before merge (git merge can delete the state file)
  if (step === "update-prd-branch-merge.mjs" && existsSync(STATE_FILE)) {
    stateBackup = readFileSync(STATE_FILE, "utf-8");
  }

  const result = spawnSync("node", [scriptPath], {
    stdio: "inherit",
    encoding: "utf-8",
    shell: true,
    env: childEnv,
  });

  // Restore state after merge if git deleted it
  if (step === "update-prd-branch-merge.mjs" && stateBackup) {
    if (!existsSync(STATE_DIR)) {
      mkdirSync(STATE_DIR, { recursive: true });
    }
    if (!existsSync(STATE_FILE)) {
      console.log("   📋 Restoring workflow state after merge...");
      writeFileSync(STATE_FILE, stateBackup);
    }
  }

  if (result.status !== 0) {
    console.error(`\n❌ Step failed: ${step}`);
    console.error("🛑 Workflow stopped.");

    // Print status hint
    console.log("\n🔍 Current Status:");
    spawnSync("git", ["status"], { stdio: "inherit", shell: true });

    // Attempt rollback/cleanup hint
    console.log(
      "\n⚠️  If changes were merged to main, you may need to reset main manually or switch back to dev."
    );
    console.log("   git checkout dev");

    cleanup();
    process.exit(1);
  }
}

// Final cleanup and summary
cleanup();

console.log("\n---------------------------------------------------------");
console.log("✅ Production Deployment erfolgreich!");
console.log("---------------------------------------------------------");
spawnSync("git", ["checkout", "dev"], { stdio: "inherit", shell: true });
console.log("\nℹ️  Du bist wieder auf dev für weitere Entwicklung.");
