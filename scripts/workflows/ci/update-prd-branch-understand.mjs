#!/usr/bin/env node

/**
 * Step 4: Understand Changes (Production)
 *
 * Uses GitHub Copilot CLI to analyze the changes and generate a deployment summary.
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
Analyze the following changes between main (production) and dev (staging).
Create a summary for the deployment.

COMMITS:
${state.log}

DIFF STAT:
${state.diffStat}

DIFF (truncated):
${state.fullDiff ? state.fullDiff.substring(0, 5000) : ""}

TASK:
1. Summarize the changes in a short, user-friendly sentence (Validation).
2. Generate a title for the deployment issue, e.g. "deploy: <summary>".
3. Generate a body for the deployment issue, listing key changes.

OUTPUT JSON format ONLY:
{
  "summary": "...",
  "issueTitle": "deploy: ...",
  "issueBody": "..."
}
`;
}

function runCopilot() {
  console.log("🤖 Step 4: Asking Copilot to summarize deployment...");

  const state = readState();
  const promptText = buildPrompt(state);
  const promptFile = join(WORKSPACE_ROOT, ".copilot-prompt-analyze.txt"); // Reusing temp file name
  writeFileSync(promptFile, promptText, "utf-8");

  console.log("⏳ Waiting for Copilot...");

  const result = spawnSync(
    "copilot",
    ["--model", "claude-haiku-4.5", "--no-ask-user", "--allow-all-tools", "--silent"],
    {
      input: promptText,
      encoding: "utf-8",
      shell: true,
      timeout: 180000,
    }
  );

  if (result.error || result.status !== 0) {
    console.error("❌ Error executing copilot:");
    console.error("   Status:", result.status);
    console.error("   Error:", result.error ? result.error.message : "(none)");
    console.error("   Stderr:", result.stderr ? result.stderr.substring(0, 500) : "(none)");
    console.error("   Stdout:", result.stdout ? result.stdout.substring(0, 500) : "(none)");
    process.exit(1);
  }

  let output = result.stdout;
  try {
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const jsonData = JSON.parse(jsonMatch[0]);
      console.log("✅ Copilot analysis successful.");
      console.log("   Summary:", jsonData.summary);

      // Store in 'analysis' prop so update-branch-issue-create.mjs can use it
      updateState({
        analysis: jsonData,
      });
    } else {
      console.error("❌ Could not parse JSON from Copilot output.");
      console.error("   Raw output (first 500 chars):", output ? output.substring(0, 500) : "(empty)");
      process.exit(1);
    }
  } catch (e) {
    console.error("❌ JSON Parse Error:", e.message);
    process.exit(1);
  }
}

runCopilot();
