#!/usr/bin/env node

/**
 * Main Orchestrator for update-dev-branch workflow
 *
 * Executes the following steps (matching deploy-dev.md):
 * 1. Prereqs check
 * 2. Analyze changes
 * 3. Branch Management
 * 4. Quality Gates (lint, format, prose)
 * 5. Build & Test
 * 6. Dev-Server (if quality changes detected)
 * 7. Commit
 * 8. Push
 * 9. Issue Create (if needed)
 * 10. Merge to dev
 * 11. Deployment Check
 * 12. Cleanup
 * 13. Issue Close
 *
 * Note: Issue-Check and Understand (Copilot analysis) run early
 * to generate branch names and commit messages.
 *
 * CLI Arguments (for non-interactive mode):
 *   --issue-id <id>     Pre-set GitHub Issue ID (skip prompt)
 *   --auto-cleanup      Auto-delete feature branch after merge (skip prompt)
 *   --skip-devserver    Skip the dev-server review step
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

// --- Parse CLI args ---
const args = process.argv.slice(2);
const envOverrides = {};

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--issue-id" && args[i + 1]) {
    envOverrides.DEPLOY_ISSUE_ID = args[++i];
  } else if (args[i] === "--auto-cleanup") {
    envOverrides.DEPLOY_AUTO_CLEANUP = "y";
  } else if (args[i] === "--skip-devserver") {
    envOverrides.DEPLOY_SKIP_DEVSERVER = "true";
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
  "update-dev-branch-issue-check.mjs",
  "update-dev-branch-analyze.mjs",
  "update-dev-branch-understand.mjs",
  "update-dev-branch-issue-create.mjs",
  "update-dev-branch-branch-mgmt.mjs",
  "update-dev-branch-quality.mjs",
  "update-dev-branch-build.mjs",
  "update-dev-branch-devserver.mjs",
  "update-dev-branch-commit.mjs",
  "update-dev-branch-push.mjs",
  "update-dev-branch-merge.mjs",
  "update-dev-branch-deploy-check.mjs",
  "update-dev-branch-cleanup.mjs",
  "update-dev-branch-issue-close.mjs",
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

    process.exit(1);
  }
}

console.log("\n✅ Workflow completed successfully!");
