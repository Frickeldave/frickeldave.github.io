#!/usr/bin/env node

/**
 * Step 3: Analyze changes (main..dev)
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
  console.log("🔍 Step 3: Analyzing changes (main..dev)...");

  try {
    console.log("   Fetching origin...");
    execSync("git fetch origin", { stdio: "ignore" });

    console.log("   Calculating diff...");
    const diffStat = execSync("git diff origin/main..dev --stat", {
      encoding: "utf-8",
    });
    const log = execSync("git log origin/main..dev --oneline", {
      encoding: "utf-8",
    });

    // Full diff for Copilot (truncated to avoid huge prompts)
    const fullDiff = execSync("git diff origin/main..dev", {
      encoding: "utf-8",
    });

    console.log("\n--- Changes to Deploy ---");
    console.log(diffStat);
    console.log("\n--- Commits ---");
    console.log(log);
    console.log("-------------------------");

    updateState({
      diffStat: diffStat,
      log: log,
      fullDiff: fullDiff,
    });
  } catch (error) {
    console.error("❌ Failed to analyze changes:", error.message);
    process.exit(1);
  }
}

main();
