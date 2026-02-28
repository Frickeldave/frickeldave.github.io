#!/usr/bin/env node

/**
 * Step 7: Merge dev -> main
 *
 * 1. Checkout main
 * 2. Pull origin main
 * 3. Merge dev --no-ff
 * 4. Handle conflicts (rollback)
 */

import { execSync } from "child_process";

function run(command) {
  console.log(`> ${command}`);
  return execSync(command, { encoding: "utf-8", stdio: "inherit" });
}

function main() {
  console.log("🔀 Step 7: Merging dev into main...");

  try {
    console.log("   Switching to main...");
    run("git checkout main");

    console.log("   Pulling latest main...");
    run("git pull origin main");

    console.log("   Merging dev...");
    // --no-ff for explicit merge commit
    // --no-verify to skip hooks (changes already validated on dev)
    // -m "chore: deploy dev to production"
    try {
      run('git merge dev --no-ff --no-verify -m "chore: deploy dev to production"');
    } catch (mergeError) {
      console.error(`❌ Merge failed: ${mergeError.message}`);
      console.error("   This implies main has direct commits not in dev.");

      console.log("🔄 Rolling back...");
      run("git merge --abort");
      run("git checkout dev");

      console.error("🛑 Aborting. Please sync main into dev first.");
      process.exit(1);
    }

    console.log("✅ Merge successful.");
  } catch (error) {
    console.error("❌ Step failed:", error.message);
    process.exit(1);
  }
}

main();
