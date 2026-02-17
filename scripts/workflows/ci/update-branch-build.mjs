#!/usr/bin/env node

/**
 * Step 8: Build & Test
 */

import { execSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

function run(command) {
  console.log(`> ${command}`);
  try {
    execSync(command, { stdio: "inherit" });
  } catch (e) {
    console.error(`❌ Build/Test failed: ${command}`);
    process.exit(1);
  }
}

function main() {
  console.log("🏗️  Step 8: Build & Test");

  // Build
  console.log("\n📦 Running Build...");
  run("npm run build");

  // Test
  // Check if 'test' script exists in package.json
  console.log("\n🧪 Running Tests...");
  try {
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf-8")
    );
    if (packageJson.scripts && packageJson.scripts.test) {
      run("npm test");
    } else {
      console.log(
        "ℹ️  No 'test' script found in package.json. Skipping tests."
      );
    }
  } catch (e) {
    console.warn("⚠️  Could not read package.json or tests failed:", e.message);
    if (e.message.includes("Build/Test failed")) {
      process.exit(1);
    }
  }
}

main();
