#!/usr/bin/env node

/**
 * Step 7: Quality Gates
 *
 * Runs:
 * - lint:check
 * - format:check
 * - prose (if available)
 */

import { execSync } from "child_process";

function run(command) {
  console.log(`> ${command}`);
  try {
    execSync(command, { stdio: "inherit" });
  } catch (e) {
    console.error(`❌ Check failed: ${command}`);
    process.exit(1);
  }
}

function main() {
  console.log("🛡️  Step 7: Quality Gates");

  // lint:check
  console.log("\n🧹 Running Lint Check...");
  run("npm run lint:check");

  // format:check
  console.log("\n🎨 Running Format Check...");
  run("npm run format:check");

  // prose / other checks
  // Check if script exists in package.json?
  // User rules said: `npm run prose`
  console.log("\n📝 Running Prose Check...");
  try {
    // Check if prose script exists
    const packageJson = JSON.parse(
      require("fs").readFileSync("package.json", "utf-8")
    );
    if (packageJson.scripts && packageJson.scripts.prose) {
      run("npm run prose");
    } else {
      console.log("   Skipping prose check (script not found).");
    }
  } catch (e) {
    // Fallback
    run("npm run prose");
  }
}

// ESM require workaround
import { createRequire } from "module";
const require = createRequire(import.meta.url);

main();
