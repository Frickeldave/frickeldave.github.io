#!/usr/bin/env node

/**
 * Step 3: Understand Intent
 *
 * Uses GitHub Copilot CLI to analyze the changes and determining the intent.
 * Generates:
 * - Suggested Branch Name (if not exists)
 * - Suggested Commit Message
 * - Suggested Issue Title/Body (if needed)
 */

import { spawnSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync, writeFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const STATE_FILE = join(__dirname, ".state", "workflow-state.json");
const WORKSPACE_ROOT = join(__dirname, "..", "..", "..");

function readState() {
  return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
}

function updateState(updates) {
  const currentState = readState();
  const newState = { ...currentState, ...updates };
  writeFileSync(STATE_FILE, JSON.stringify(newState, null, 2));
}

function buildPrompt(state) {
  return `
Analyze the following git changes and determine the intent.

GIT STATUS:
${state.gitStatus}

GIT DIFF (truncated):
${state.gitDiff ? state.gitDiff.substring(0, 5000) : ""}

TASK:
1. Identify the TYPE of change (feat, fix, docs, style, refactor, perf, test, ci, chore).
2. Create a specific, kebab-case branch name (max 50 chars) following the pattern: <type>/<issue-id-if-present>-<description>.
   - If issue ID is present (${state.issueId}), include it (e.g., feat/123-add-login).
   - If no issue ID, just use description (e.g., feat/add-login).
3. Create a conventional commit message.
4. Create a title and body for a GitHub Issue (if we needed to create one).

OUTPUT JSON format ONLY:
{
  "type": "feat",
  "branchName": "feat/...",
  "commitMessage": "feat(...): ...",
  "issueTitle": "...",
  "issueBody": "..."
}
`;
}

function runCopilot() {
  console.log("🤖 Step 3: Asking Copilot to understand changes...");

  const state = readState();

  if (!state.gitStatus && !state.gitDiff) {
    console.log("⚠️  No changes to analyze.");
    process.exit(0);
  }

  const promptText = buildPrompt(state);
  const promptFile = join(WORKSPACE_ROOT, ".copilot-prompt-analyze.txt");
  writeFileSync(promptFile, promptText, "utf-8");

  console.log("⏳ Waiting for Copilot...");

  // Use spawnSync with shell: false to avoid shell escaping issues.
  // We pass arguments as an array, which Node.js handles correctly for both OSs.
  console.log("Executing copilot via safe spawn...");

  const result = spawnSync(
    "copilot",
    ["-p", promptText, "--model", "claude-haiku-4.5", "--no-ask-user"], // --no-ask-user for non-interactive
    {
      encoding: "utf-8",
      shell: false,
      input: "", // Provide empty stdin to avoid waiting for interactive input
    }
  );

  if (result.error || result.status !== 0) {
    console.error(
      "❌ Error executing copilot:",
      result.stderr || result.stdout
    );
    process.exit(1);
  }

  let output = result.stdout;
  // Helper to extract JSON
  try {
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const jsonData = JSON.parse(jsonMatch[0]);
      console.log("✅ Copilot analysis successful.");
      console.log("   Type:", jsonData.type);
      console.log("   Branch:", jsonData.branchName);
      updateState({ analysis: jsonData });
    } else {
      console.error("❌ Could not parse JSON from Copilot output.");
      console.log("Output:", output);
      process.exit(1);
    }
  } catch (e) {
    console.error("❌ JSON Parse Error:", e.message);
    process.exit(1);
  }
}

runCopilot();
