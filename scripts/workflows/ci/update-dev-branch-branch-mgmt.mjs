#!/usr/bin/env node

/**
 * Step 3: Branch Management
 *
 * Logic:
 * 1. If on `dev` or `main`:
 *    - Create NEW branch from current HEAD (working tree changes are preserved).
 * 2. If on other branch:
 *    - Stay on it.
 *
 * No stash needed: `git checkout -b` preserves working tree changes.
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

function run(command) {
  console.log(`> ${command}`);
  return execSync(command, { encoding: "utf-8", stdio: "inherit" });
}

function main() {
  console.log("🌿 Step 3: Branch Management");
  const state = readState();

  try {
    // Get current branch
    const currentBranch = execSync("git branch --show-current", {
      encoding: "utf-8",
    }).trim();
    console.log(`📍 Current branch: ${currentBranch}`);

    let targetBranch = currentBranch;

    if (currentBranch === "dev" || currentBranch === "main") {
      console.log(
        `✨ Working directly on ${currentBranch} without creating a feature branch.`
      );
      targetBranch = currentBranch;
    } else {
      // Already on a feature branch
      console.log(`🛠️  Working on existing branch: ${currentBranch}`);
      targetBranch = currentBranch;
    }

    // Update state with target branch
    const updatedState = { ...state, branchName: targetBranch };
    writeFileSync(STATE_FILE, JSON.stringify(updatedState, null, 2));

    // Verify changes are in working directory
    console.log("🔍 Verifying changes in working directory...");
    const finalStatus = execSync("git status --porcelain", {
      encoding: "utf-8",
    });
    if (!finalStatus.trim()) {
      console.log("⚠️  No changes found in working directory.");
    } else {
      console.log("✅ Changes are present in working directory.");
      console.log(execSync("git status -s", { encoding: "utf-8" }));
    }
  } catch (error) {
    console.error("❌ Branch management failed:", error.message);
    process.exit(1);
  }
}

main();
