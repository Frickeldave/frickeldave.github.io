#!/usr/bin/env node

/**
 * Step 12: Deployment Check
 *
 * Checks the status of the deployment workflow.
 */

import { execSync } from "child_process";

function main() {
  console.log("🚀 Step 12: Checking Deployment Status...");

  try {
    // Wait a moment for GitHub to register the workflow run
    console.log("⏳ Waiting 5s for workflow to trigger...");
    execSync("ping 127.0.0.1 -n 6 > nul", { shell: true }); // Windows sleep hack or use setTimeout if async

    const command =
      "gh run list --workflow=host-waltraud.yaml --limit 1 --json databaseId,status,conclusion,url";
    const output = execSync(command, { encoding: "utf-8" });
    const runs = JSON.parse(output);

    if (runs.length > 0) {
      const run = runs[0];
      console.log(`\n✅ Generated Deployment Run:`);
      console.log(`   ID: ${run.databaseId}`);
      console.log(`   Status: ${run.status}`);
      console.log(`   URL: ${run.url}`);
      console.log(`\nℹ️  Monitor the deployment at the URL above.`);
    } else {
      console.log(
        "⚠️  No workflow run found yet. Check GitHub Actions manually."
      );
    }
  } catch (error) {
    console.warn("⚠️  Could not check deployment status:", error.message);
  }
}

main();
