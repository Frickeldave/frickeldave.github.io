#!/usr/bin/env node

/**
 * Step 11: Merge to dev
 *
 * 1. Checkout dev
 * 2. Pull dev
 * 3. Merge feature branch --no-ff
 * 4. Push dev (to trigger deployment)
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
  console.log("twisted_rightwards_arrows Step 11: Merging to dev...");
  const state = readState();
  const { branchName } = state;

  if (!branchName) {
    console.error("❌ Unknown feature branch name.");
    process.exit(1);
  }

  if (branchName === "dev") {
    console.log("ℹ️  Already on dev branch. Skipping merge.");
    // We still push to ensure deployment triggers if there were local commits
    try {
      run("git push origin dev");
    } catch (e) {
      console.warn("⚠️  Push to dev failed:", e.message);
    }
    return;
  }

  try {
    run("git checkout dev");
    run("git pull origin dev");
    run(`git merge ${branchName} --no-ff`);

    console.log("🚀 Pushing dev to trigger deployment...");
    run("git push origin dev");

    console.log("✅ Merged and pushed to dev.");
  } catch (error) {
    console.error("❌ Merge failed:", error.message);
    process.exit(1);
  }
}

main();
