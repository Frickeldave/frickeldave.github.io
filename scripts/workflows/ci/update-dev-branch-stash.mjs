#!/usr/bin/env node

/**
 * Step 6: Stash/Checkout (Placeholder)
 *
 * Since Step 5 handled the stash/pop cycle to ensure clean rebase,
 * this step just ensures that the changes are present in the working directory.
 */

import { execSync } from "child_process";

function main() {
  console.log("💾 Step 6: Verifying changes...");

  try {
    const status = execSync("git status --porcelain", { encoding: "utf-8" });
    if (!status.trim()) {
      console.log("⚠️  No changes found in working directory.");
      console.log("   Did stash pop fail? Or were there no changes?");
      // process.exit(1); // Optional: Fail if no changes to commit?
    } else {
      console.log("✅ Changes are present in working directory.");
      console.log(execSync("git status -s", { encoding: "utf-8" }));
    }
  } catch (error) {
    process.exit(1);
  }
}

main();
