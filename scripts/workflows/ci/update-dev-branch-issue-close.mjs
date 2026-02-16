#!/usr/bin/env node

/**
 * Step 14: Close Issue
 *
 * Closes the GitHub Issue.
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

function main() {
  console.log("🏁 Step 14: Closing Issue...");
  const state = readState();
  const { issueId } = state;

  if (!issueId) {
    console.log("ℹ️  No associated issue to close.");
    return;
  }

  try {
    console.log(`   Closing issue #${issueId}...`);
    execSync(
      `gh issue close ${issueId} --comment "Completed via update-dev-branch workflow"`,
      { stdio: "inherit" }
    );
    console.log("✅ Issue closed.");
  } catch (error) {
    console.error("❌ Failed to close issue:", error.message);
  }
}

main();
