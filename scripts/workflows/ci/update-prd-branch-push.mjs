#!/usr/bin/env node

/**
 * Step 10: Push main
 */

import { execSync } from "child_process";

console.log("🚀 Step 10: Pushing main to remote...");

try {
  execSync("git push origin main", { stdio: "inherit" });
  console.log("✅ Main pushed successfully.");
} catch (error) {
  console.error("❌ Failed to push main:", error.message);
  process.exit(1);
}
