#!/usr/bin/env node

/**
 * Main Orchestrator for update-dev-branch workflow
 *
 * Executes the following steps:
 * 1. Prereqs check
 * 2. Issue check
 * 3. Analyze changes
 * 4. Understand intent (Copilot)
 * 5. Create Issue (if needed)
 * 6. Branch Management
 * 7. Stash/Add
 * 8. Quality Gates
 * 9. Build & Test
 * 10. Commit
 * 11. Push
 * 12. Merge
 * 13. Deployment Check
 * 14. Cleanup
 * 15. Close Issue
 */

import { spawnSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { writeFileSync, existsSync, mkdirSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// State file to persist data between steps
const STATE_DIR = join(__dirname, ".state");
const STATE_FILE = join(STATE_DIR, "workflow-state.json");

// Ensure state dir exists
if (!existsSync(STATE_DIR)) {
  mkdirSync(STATE_DIR, { recursive: true });
}

// Initialize empty state if starting fresh
writeFileSync(STATE_FILE, JSON.stringify({}, null, 2));

const steps = [
  "update-dev-branch-prereqs.mjs",
  "update-dev-branch-issue-check.mjs",
  "update-dev-branch-analyze.mjs",
  "update-dev-branch-understand.mjs",
  "update-dev-branch-issue-create.mjs",
  "update-dev-branch-branch-mgmt.mjs",
  "update-dev-branch-stash.mjs",
  "update-dev-branch-quality.mjs",
  "update-dev-branch-build.mjs",
  "update-dev-branch-commit.mjs",
  "update-dev-branch-push.mjs",
  "update-dev-branch-merge.mjs",
  "update-dev-branch-deploy-check.mjs",
  "update-dev-branch-cleanup.mjs",
  "update-dev-branch-issue-close.mjs",
];

console.log("🚀 Starting update-dev-branch workflow...");

for (const step of steps) {
  const scriptPath = join(__dirname, step);
  console.log(`\n---------------------------------------------------------`);
  console.log(`▶️  Running step: ${step}`);
  console.log(`---------------------------------------------------------`);

  const result = spawnSync("node", [scriptPath], {
    stdio: "inherit",
    encoding: "utf-8",
    shell: true,
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

    process.exit(1);
  }
}

console.log("\n✅ Workflow completed successfully!");
