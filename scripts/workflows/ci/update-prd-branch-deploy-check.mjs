#!/usr/bin/env node

/**
 * Step 11: Deployment Check
 *
 * Checks if the GitHub Action 'deploy-prd.yml' has started.
 */

import { execSync } from "child_process";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("👀 Step 11: Checking Deployment Workflow...");

  const maxRetries = 15; // 30 seconds (2s interval)
  const workflowFile = "deploy-prd.yml";

  console.log(`   Waiting for workflow '${workflowFile}' to start...`);

  for (let i = 0; i < maxRetries; i++) {
    try {
      // Get the latest run
      const result = execSync(
        `gh run list --workflow=${workflowFile} --limit 1 --json status,url,createdAt`,
        { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }
      );

      const runs = JSON.parse(result);
      if (runs.length > 0) {
        const latest = runs[0];
        const created = new Date(latest.createdAt).getTime();
        const now = Date.now();

        // Check if created in last 60 seconds (to avoid picking up old run)
        if (now - created < 60000) {
          console.log("✅ Deployment-Workflow gestartet!");
          console.log(`🔗 Link: ${latest.url}`);
          return;
        }
      }
    } catch {
      // Ignore transient errors
    }

    await sleep(2000);
    process.stdout.write(".");
  }

  console.log("\n⚠️  Workflow nicht automatisch erkannt (Timeout).");
  console.log(
    `🔗 Bitte manuell prüfen: https://github.com/Frickeldave/frickeldave.github.io/actions/workflows/${workflowFile}`
  );
  // Not an error, just a warning
}

main();
