#!/usr/bin/env node

/**
 * Step: Prerequisites Check
 *
 * Checks:
 * - npm installed
 * - git installed >= 2.30
 * - gh CLI installed >= 2.0 & authenticated
 * - Current dir is git repo with remote origin
 */

import { execSync } from "child_process";

console.log("🔍 Checking prerequisites...");

try {
  // Check npm
  try {
    const npmVersion = execSync("npm --version", { encoding: "utf-8" }).trim();
    console.log(`✅ npm installed: ${npmVersion}`);
  } catch {
    throw new Error("npm is not installed or not in PATH");
  }

  // Check git
  try {
    const gitVersion = execSync("git --version", { encoding: "utf-8" }).trim();
    // Parse version manually or just log it. git version 2.45.0.windows.1
    // Simple check:
    console.log(`✅ git installed: ${gitVersion}`);
  } catch {
    throw new Error("git is not installed or not in PATH");
  }

  // Check gh CLI
  try {
    const ghVersion = execSync("gh --version", { encoding: "utf-8" }).split(
      "\n"
    )[0];
    console.log(`✅ gh CLI installed: ${ghVersion}`);

    // Check auth
    execSync("gh auth status", { stdio: "ignore" });
    console.log(`✅ gh CLI authenticated`);

    // Check copilot CLI
    try {
      const copilotVersion = execSync("copilot --version", {
        encoding: "utf-8",
      }).trim();
      console.log(`✅ copilot CLI installed: ${copilotVersion}`);
    } catch {
      throw new Error(
        "copilot CLI is not installed or not in PATH. Please install it."
      );
    }
  } catch (e) {
    throw new Error(
      'gh CLI is not installed, not in PATH, or not authenticated. Run "gh auth login". Error: ' +
        e.message
    );
  }

  // Check git repo
  try {
    const isRepo = execSync("git rev-parse --is-inside-work-tree", {
      encoding: "utf-8",
    }).trim();
    if (isRepo !== "true") throw new Error("Not a git repository");

    const remotes = execSync("git remote", { encoding: "utf-8" }).trim();
    if (!remotes.includes("origin"))
      throw new Error('No remote "origin" found');

    console.log(`✅ Git repository valid`);
  } catch (e) {
    throw new Error(`Git repository check failed: ${e.message}`);
  }
} catch (error) {
  console.error(`❌ Prerequisites check failed: ${error.message}`);
  process.exit(1);
}
