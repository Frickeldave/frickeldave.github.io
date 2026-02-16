#!/usr/bin/env node

/**
 * Step 10: Push
 *
 * Pushes the current branch to origin.
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
  console.log("🚀 Step 10: Pushing branch...");
  const state = readState();
  const { branchName } = state;

  if (!branchName) {
    console.error("❌ Unknown branch name.");
    process.exit(1);
  }

  try {
    run(`git push -u origin ${branchName}`);
    console.log("✅ Branch pushed to origin.");
  } catch (error) {
    console.error("❌ Push failed:", error.message);
    process.exit(1);
  }
}

main();
