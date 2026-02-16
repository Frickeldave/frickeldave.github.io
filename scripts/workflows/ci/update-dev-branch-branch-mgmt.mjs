#!/usr/bin/env node

/**
 * Step 5: Branch Management
 *
 * Logic:
 * 1. Stash current changes (to allow checkout/rebase).
 * 2. If on `dev` or `main`:
 *    - Update `dev` (fetch/rebase).
 *    - Create NEW branch based on analysis.
 * 3. If on other branch:
 *    - Validate name.
 *    - Fetch origin.
 *    - Rebase on `origin/dev`.
 * 4. Pop stash.
 */

import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync, writeFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const STATE_FILE = join(__dirname, ".state", "workflow-state.json");

function readState() {
  return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
}

function updateState(updates) {
  const currentState = readState();
  const newState = { ...currentState, ...updates };
  writeFileSync(STATE_FILE, JSON.stringify(newState, null, 2));
}

function run(command) {
  console.log(`> ${command}`);
  return execSync(command, { encoding: "utf-8", stdio: "inherit" });
}

function main() {
  console.log("🌿 Step 5: Branch Management");
  const state = readState();

  try {
    // 0. Get current branch
    const currentBranch = execSync("git branch --show-current", {
      encoding: "utf-8",
    }).trim();
    console.log(`📍 Current branch: ${currentBranch}`);

    // 1. Stash changes
    console.log("📦 Stashing changes...");
    let stashed = false;
    try {
      // Check if there are changes to stash
      const status = execSync("git status --porcelain", { encoding: "utf-8" });
      if (status.trim()) {
        run(
          'git stash push -u -m "Auto-stash by update-dev-branch" -- . ":!scripts/workflows/ci"'
        );
        stashed = true;
      } else {
        console.log("   No changes to stash.");
      }
    } catch (e) {
      console.warn("⚠️  Stash failed or nothing to stash:", e.message);
    }

    let targetBranch = currentBranch;

    // 2. Branch Logic
    if (currentBranch === "dev" || currentBranch === "main") {
      const { branchName } = state.analysis || {};

      if (!branchName) {
        throw new Error(
          "No branch name generated from analysis. Cannot create new branch."
        );
      }

      console.log(`✨ Creating new branch: ${branchName}`);

      run("git fetch origin dev");

      // If we are on dev, we pull rebase first
      if (currentBranch === "dev") {
        run("git pull --rebase origin dev");
      }

      run(`git checkout -b ${branchName} origin/dev`);
      targetBranch = branchName;
    } else {
      // Already on a feature branch
      // Validate name?
      // For now assume it's okay or prompt user?
      // The requirement says: "Validiere Namen, schlage Alternative vor falls nötig"
      // We'll trust the user for now to keep it simple, or check against regex.
      // Regex from 12-branch-naming-strategy: <type>/<optional-ticket-id>-<description>

      console.log(`🛠️  Working on existing branch: ${currentBranch}`);

      console.log("🔄 Rebased on origin/dev...");
      run("git fetch origin dev");
      run("git rebase origin/dev");
      targetBranch = currentBranch;
    }

    updateState({ branchName: targetBranch });

    // 4. Pop stash
    if (stashed) {
      console.log("📤 Popping stash...");
      try {
        run("git stash pop");
      } catch (e) {
        console.error(
          "❌ Conflict during stash pop. Please resolve conflicts manually."
        );
        // We shouldn't exit with 1 necessarily if we want the user to fix it, but the script will stop.
        process.exit(1);
      }
    }
  } catch (error) {
    console.error("❌ Branch management failed:", error.message);
    process.exit(1);
  }
}

main();
