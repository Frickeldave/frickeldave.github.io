#!/usr/bin/env node

/**
 * Step 6: Dev-Server
 *
 * If Quality Gates made changes (lint/format), starts
 * the dev server for manual verification.
 * User confirms via readline prompt, then the server is killed.
 *
 * Non-interactive: Set env DEPLOY_SKIP_DEVSERVER=true or pass --skip-devserver to orchestrator.
 */

import { spawn, execSync } from "child_process";
import { createInterface } from "readline";

function hasQualityChanges() {
  try {
    const status = execSync("git status --porcelain", {
      encoding: "utf-8",
    }).trim();
    return status.length > 0;
  } catch {
    return false;
  }
}

function prompt(question) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function main() {
  console.log("🌐 Step 6: Dev-Server Check");

  // Non-interactive: skip entirely
  if (process.env.DEPLOY_SKIP_DEVSERVER === "true") {
    console.log(
      "   (non-interactive: skipping dev server per DEPLOY_SKIP_DEVSERVER)"
    );
    return;
  }

  if (!hasQualityChanges()) {
    console.log(
      "ℹ️  No changes from quality gates detected. Skipping dev server."
    );
    return;
  }

  console.log("📝 Quality gates made changes. Starting dev server for review.");
  console.log("   URL: http://localhost:4321\n");

  const devServer = spawn("npm", ["run", "dev"], {
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });

  // Show server output
  devServer.stdout.on("data", (data) => {
    const line = data.toString().trim();
    if (line) console.log(`   [dev] ${line}`);
  });

  devServer.stderr.on("data", (data) => {
    const line = data.toString().trim();
    if (line) console.log(`   [dev] ${line}`);
  });

  // Wait for server to start
  await new Promise((resolve) => setTimeout(resolve, 5000));

  const answer = await prompt(
    "\n✅ Dev server running. Review your changes at http://localhost:4321\n   Press Enter to continue (or type 'abort' to stop): "
  );

  // Kill dev server
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /pid ${devServer.pid} /T /F`, { stdio: "ignore" });
    } else {
      devServer.kill("SIGTERM");
    }
  } catch {
    // Process may have already exited
  }

  if (answer === "abort") {
    console.error("❌ User aborted after dev server review.");
    process.exit(1);
  }

  console.log("✅ Dev server stopped. Continuing workflow.");
}

main();
