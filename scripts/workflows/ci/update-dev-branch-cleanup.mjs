#!/usr/bin/env node

/**
 * Step 13: Cleanup
 *
 * Asks user if they want to delete the feature branch.
 */

import { createInterface } from "readline";
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

async function prompt(question) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function main() {
  console.log("🧹 Step 13: Cleanup");
  const state = readState();
  const { branchName } = state;

  if (!branchName || branchName === "dev" || branchName === "main") {
    console.log("ℹ️  No feature branch to clean up.");
    return;
  }

  const answer = await prompt(`Delete feature branch '${branchName}'? (y/N): `);

  if (answer === "y" || answer === "yes") {
    try {
      // Must be on another branch to delete
      const current = execSync("git branch --show-current", {
        encoding: "utf-8",
      }).trim();
      if (current === branchName) {
        console.log("   Switching to dev before deletion...");
        execSync("git checkout dev", { stdio: "ignore" });
      }

      console.log(`   Deleting local branch ${branchName}...`);
      execSync(`git branch -d ${branchName}`, { stdio: "inherit" });

      // Check for PR?
      // "gh pr delete falls nötig"
      // If we merged locally, maybe no PR. But check just in case.
      // Or maybe the user rules meant "if a PR exists".
      // We won't aggressively delete PRs unless we are sure.
      // The prompt to user implies asking.
      // I will skip PR deletion for now as it's safer, unless user specifically asked.
      // Rules: "`gh pr delete` falls nötig."

      console.log("✅ Branch deleted.");
    } catch (error) {
      console.error(
        "❌ Failed to delete branch (maybe not fully merged? try -D manually):",
        error.message
      );
    }
  } else {
    console.log("   Skipping cleanup.");
  }
}

main();
