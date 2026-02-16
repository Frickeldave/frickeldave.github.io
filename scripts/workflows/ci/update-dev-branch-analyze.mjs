#!/usr/bin/env node

/**
 * Step 2: Analyze Changes
 *
 * Runs `git status` and `git diff` to capture the current state of changes.
 */

import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync, writeFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const STATE_FILE = join(__dirname, ".state", "workflow-state.json");

function updateState(updates) {
  const currentState = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
  const newState = { ...currentState, ...updates };
  writeFileSync(STATE_FILE, JSON.stringify(newState, null, 2));
}

function main() {
  console.log("🔍 Step 2: Analyzing changes...");

  try {
    const status = execSync("git status --porcelain", { encoding: "utf-8" });

    if (!status.trim()) {
      console.log("⚠️  No changes found directly in git status.");
      // Proceed anyway? The prompt implies "offene Änderungen".
      // If nothing matches, we might stop here.
      // But maybe untracked files?
    }

    // Capture diff of tracked files
    // limit diff size to avoid prompt overflow
    const diff = execSync("git diff HEAD", { encoding: "utf-8" });

    // Also capture list of files
    const fileList = status;

    console.log(
      `📄 Found ${fileList.split("\n").filter(Boolean).length} changed files.`
    );

    updateState({
      gitStatus: status,
      gitDiff: diff,
    });

    // Also print for user visibility
    console.log("\n--- Changes ---");
    console.log(status);
    console.log("---------------");
  } catch (error) {
    console.error("❌ Failed to analyze changes:", error.message);
    process.exit(1);
  }
}

main();
