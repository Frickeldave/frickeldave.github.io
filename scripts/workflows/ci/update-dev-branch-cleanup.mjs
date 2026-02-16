#!/usr/bin/env node

/**
 * Step 12: Cleanup
 *
 * Asks user if they want to delete the feature branch.
 *
 * Non-interactive: Set env DEPLOY_AUTO_CLEANUP=y or pass --auto-cleanup to orchestrator.
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

function deleteBranch(branchName) {
  const current = execSync("git branch --show-current", {
    encoding: "utf-8",
  }).trim();
  if (current === branchName) {
    console.log("   Switching to dev before deletion...");
    execSync("git checkout dev", { stdio: "ignore" });
  }

  console.log(`   Deleting local branch ${branchName}...`);
  execSync(`git branch -d ${branchName}`, { stdio: "inherit" });
  console.log("✅ Branch deleted.");
}

async function main() {
  console.log("🧹 Step 12: Cleanup");
  const state = readState();
  const { branchName } = state;

  if (!branchName || branchName === "dev" || branchName === "main") {
    console.log("ℹ️  No feature branch to clean up.");
    return;
  }

  // Non-interactive: use env var if set
  const autoCleanup = process.env.DEPLOY_AUTO_CLEANUP;
  let answer;

  if (autoCleanup) {
    console.log(`   (non-interactive: DEPLOY_AUTO_CLEANUP=${autoCleanup})`);
    answer = autoCleanup.toLowerCase();
  } else {
    answer = await prompt(`Delete feature branch '${branchName}'? (y/N): `);
  }

  if (answer === "y" || answer === "yes") {
    try {
      deleteBranch(branchName);
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
