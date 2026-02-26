#!/usr/bin/env node

/**
 * Step: Prerequisites Check for PRD
 *
 * Checks:
 * - npm installed
 * - git installed
 * - gh CLI installed & authenticated
 * - Current dir is git repo
 * - Current branch is dev
 * - dev is clean
 * - dev is pushed to origin
 */

import { execSync } from "child_process";

console.log("🔍 Checking prerequisites...");

try {
  // Check npm
  execSync("npm --version", { stdio: "ignore" });

  // Check git
  execSync("git --version", { stdio: "ignore" });

  // Check gh CLI
  execSync("gh auth status", { stdio: "ignore" });

  // Check git repo
  const isRepo = execSync("git rev-parse --is-inside-work-tree", {
    encoding: "utf-8",
  }).trim();
  if (isRepo !== "true") throw new Error("Not a git repository");

  // Check current branch is dev
  const branch = execSync("git branch --show-current", {
    encoding: "utf-8",
  }).trim();
  if (branch !== "dev")
    throw new Error(`Current branch is '${branch}', must be 'dev'`);

  // Check dev is clean
  const status = execSync("git status --porcelain", {
    encoding: "utf-8",
  }).trim();
  if (status)
    throw new Error("Branch is dirty. Please commit or stash changes.");

  // Check dev is pushed
  // Compare local dev with origin/dev
  execSync("git fetch origin dev", { stdio: "ignore" });
  const localRev = execSync("git rev-parse dev", { encoding: "utf-8" }).trim();
  const remoteRev = execSync("git rev-parse origin/dev", {
    encoding: "utf-8",
  }).trim();
  if (localRev !== remoteRev)
    throw new Error(
      "Local dev branch is not in sync with origin/dev. Please push first."
    );

  console.log("✅ Prerequisites passed.");
} catch (error) {
  console.error(`❌ Prerequisites check failed: ${error.message}`);
  process.exit(1);
}
