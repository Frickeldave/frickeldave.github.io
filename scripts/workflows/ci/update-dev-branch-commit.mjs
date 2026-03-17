#!/usr/bin/env node

/**
 * Step 9: Commit
 *
 * 1. git add .
 * 2. Commit with message from analysis.
 * 3. Configure git if needed.
 */

import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const STATE_FILE = join(__dirname, ".state", "workflow-state.json");

function readState() {
  return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
}

function run(command) {
  console.log(`> ${command}`);
  return execSync(command, { encoding: "utf-8", stdio: "inherit" });
}

function main() {
  console.log("💾 Step 9: Committing changes...");
  const state = readState();

  const { commitMessage } = state.analysis || {};

  if (!commitMessage) {
    // Check if there are actually any changes to commit
    const pendingChanges = execSync("git status --porcelain", { encoding: "utf-8" }).trim();
    if (!pendingChanges) {
      console.log("ℹ️  No changes to commit and no commit message. Nothing to do.");
      process.exit(0);
    }
    console.error("❌ No commit message found in state.");
    process.exit(1);
  }

  try {
    // Git config overrides (local only)
    try {
      execSync('git config user.name "David Koenig"');
      execSync('git config user.email "david.koenig09@gmail.com"');
    } catch (e) {
      console.warn("⚠️  Could not set git config (ignored):", e.message);
    }

    run("git add .");

    // Remove temporary workflow files from staging
    // These should never be committed
    const tempFiles = [
      ".copilot-prompt-analyze.txt",
      "scripts/workflows/ci/.state",
    ];
    for (const f of tempFiles) {
      try {
        execSync(`git reset HEAD -- ${f}`, { stdio: "ignore" });
      } catch {
        // File might not be staged, ignore
      }
    }

    // Commit
    // Use proper escaping for commit message
    const escapedMessage = commitMessage.replace(/"/g, '\\"');
    run(`git commit -m "${escapedMessage}"`);

    console.log("✅ Changes committed.");
  } catch (error) {
    console.error("❌ Commit failed:", error.message);
    process.exit(1);
  }
}

main();
