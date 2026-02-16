#!/usr/bin/env node

/**
 * Step 4: Create Issue (if needed)
 *
 * If no Issue ID was provided in Step 1, create one now using the analysis from Step 3.
 */

import { spawnSync } from "child_process";
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

function run() {
  console.log("🎫 Step 4: Checking Issue status...");
  const state = readState();

  if (state.issueId) {
    console.log(`✅ Issue already exists: #${state.issueId}`);
    return;
  }

  console.log("🆕 Creating new GitHub Issue...");
  const { issueTitle, issueBody } = state.analysis || {};

  if (!issueTitle) {
    console.error("❌ Missing issue title from analysis.");
    process.exit(1);
  }

  const result = spawnSync(
    "gh",
    [
      "issue",
      "create",
      "--title",
      issueTitle,
      "--body",
      issueBody || "Automated issue created by update-dev-branch workflow.",
    ],
    { encoding: "utf-8", shell: false }
  );

  if (result.status !== 0) {
    console.error("STDERR:", result.stderr);
    console.error("STDOUT:", result.stdout);
    process.exit(1);
  }

  // gh issue create outputs the URL to stdout, e.g. https://github.com/owner/repo/issues/123
  const issueUrl = result.stdout.trim();
  const match = issueUrl.match(/\/issues\/(\d+)$/);

  if (!match) {
    console.error("❌ Could not parse issue URL from output:", issueUrl);
    process.exit(1);
  }

  const issueNumber = parseInt(match[1], 10);
  console.log(`✅ Created Issue: #${issueNumber} - ${issueTitle}`);

  updateState({
    issueId: issueNumber,
    issueTitle: issueTitle,
    issueUrl: issueUrl,
  });
}

run();
