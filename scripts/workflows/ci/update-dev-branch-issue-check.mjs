#!/usr/bin/env node

/**
 * Step 1: Issue Check
 *
 * Asks user for an optional GitHub Issue ID.
 * Validates existence using `gh issue view`.
 */

import { createInterface } from "readline";
import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync, writeFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const STATE_FILE = join(__dirname, ".state", "workflow-state.json");

// Helper to read state
function readState() {
  return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
}

// Helper to write state
function updateState(updates) {
  const currentState = readState();
  const newState = { ...currentState, ...updates };
  writeFileSync(STATE_FILE, JSON.stringify(newState, null, 2));
}

async function prompt(question) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log("🎫 Step 1: Issue Check");

  while (true) {
    const issueId = await prompt(
      "Enter GitHub Issue ID (optional, press Enter to skip): "
    );

    if (!issueId) {
      console.log("ℹ️  No issue ID provided. Will create one later if needed.");
      updateState({ issueId: null });
      break;
    }

    // Validate Issue ID
    try {
      console.log(`🔍 Validating issue #${issueId}...`);
      // gh issue view 123 --json title,number,url
      const result = execSync(
        `gh issue view ${issueId} --json title,number,url`,
        { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }
      );
      const issue = JSON.parse(result);

      console.log(`✅ Found issue: #${issue.number} - ${issue.title}`);

      updateState({
        issueId: issue.number,
        issueTitle: issue.title,
        issueUrl: issue.url,
      });
      break;
    } catch (e) {
      console.error(`❌ Issue #${issueId} not found or error accessing it.`);
      console.error("Please try again or leave empty to skip.");
    }
  }
}

main();
