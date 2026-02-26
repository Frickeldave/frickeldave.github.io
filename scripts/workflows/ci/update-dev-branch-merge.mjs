#!/usr/bin/env node

/**
 * Step 11: Merge to dev
 *
 * 1. Read state (must happen BEFORE checkout, as state file may be on feature branch only)
 * 2. Checkout dev
 * 3. Pull dev
 * 4. Merge feature branch --no-ff with explicit message
 * 5. Push dev (to trigger deployment)
 *
 * Important notes:
 * - We use `-m` to avoid opening an editor (which hangs in non-interactive scripts).
 * - We use `--no-verify` to skip commit hooks (commitlint rejects default merge messages).
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
  console.log("🔀 Step 11: Merging to dev...");

  // Read state BEFORE checkout — the state file lives on the feature branch
  // and will be removed when switching to dev.
  const state = readState();
  const { branchName } = state;
  const commitMessage =
    (state.analysis && state.analysis.commitMessage) || null;

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

    // Build a conventional merge commit message
    const mergeMsg = commitMessage
      ? `merge: ${branchName} - ${commitMessage}`
      : `merge: ${branchName} into dev`;
    const escapedMsg = mergeMsg.replace(/"/g, '\\"');

    // --no-ff: always create a merge commit
    // -m: explicit message (avoids editor popup)
    // --no-verify: skip commit hooks (commitlint rejects default merge messages)
    run(`git merge ${branchName} --no-ff --no-verify -m "${escapedMsg}"`);

    console.log("🚀 Pushing dev to trigger deployment...");
    run("git push origin dev");

    console.log("✅ Merged and pushed to dev.");
  } catch (error) {
    console.error("❌ Merge failed:", error.message);
    process.exit(1);
  }
}

main();
