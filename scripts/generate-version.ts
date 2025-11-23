#!/usr/bin/env node
import { execSync } from "child_process";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

/**
 * Version Generator für Frickeldave GitHub Pages
 * 
 * Generiert automatisch Versionsnummern basierend auf:
 * - Git Branch
 * - Git Commit Hash
 * - Build Environment (local/dev/prod)
 * 
 * Output: public/version.json
 */

interface VersionInfo {
  version: string;
  environment: "local" | "dev" | "production";
  branch: string;
  commit: string;
  buildTime: string;
  buildTimestamp: number;
}

function execCommand(command: string, fallback = "unknown"): string {
  try {
    return execSync(command, { encoding: "utf-8" }).toString().trim();
  } catch (error) {
    console.warn(`Warning: Could not execute "${command}", using fallback: ${fallback}`);
    return fallback;
  }
}

function getEnvironment(): "local" | "dev" | "production" {
  const context = process.env.CONTEXT || process.env.NODE_ENV || "local";
  
  // Cloudflare Pages / GitHub Actions Environment Detection
  if (context === "production" || process.env.CF_PAGES_BRANCH === "main") {
    return "production";
  }
  if (context === "dev" || process.env.CF_PAGES_BRANCH === "dev") {
    return "dev";
  }
  return "local";
}

function getGitBranch(): string {
  // Try multiple sources for branch name
  const sources = [
    () => process.env.CF_PAGES_BRANCH,
    () => process.env.GITHUB_REF_NAME,
    () => execCommand("git rev-parse --abbrev-ref HEAD", "unknown"),
  ];

  for (const source of sources) {
    const result = source();
    if (result && result !== "unknown") {
      return result;
    }
  }
  return "unknown";
}

function getGitCommit(): string {
  // Try multiple sources for commit hash
  const sources = [
    () => process.env.CF_PAGES_COMMIT_SHA?.substring(0, 7),
    () => process.env.GITHUB_SHA?.substring(0, 7),
    () => execCommand("git rev-parse --short HEAD", "0000000"),
  ];

  for (const source of sources) {
    const result = source();
    if (result && result !== "0000000") {
      return result;
    }
  }
  return "0000000";
}

function getLatestGitTag(): string {
  const tag = execCommand("git describe --tags --abbrev=0", "v0.0.0");
  return tag.startsWith("v") ? tag.substring(1) : tag;
}

function generateVersion(): VersionInfo {
  const environment = getEnvironment();
  const branch = getGitBranch();
  const commit = getGitCommit();
  const buildTime = new Date().toISOString();
  const buildTimestamp = Date.now();

  let version: string;

  switch (environment) {
    case "production":
      // Production: Use Git tag (e.g., v1.3.5)
      version = `v${getLatestGitTag()}`;
      break;
    
    case "dev":
      // Dev: Use Git tag + dev suffix (e.g., v1.3.0-dev-a1b2c3d)
      version = `v${getLatestGitTag()}-dev-${commit}`;
      break;
    
    case "local":
    default:
      // Local: Branch + commit (e.g., v0.0.0-dev-54-handmade-a1b2c3d)
      const safeBranch = branch.replace(/[^a-zA-Z0-9-]/g, "-");
      version = `v0.0.0-dev-${safeBranch}-${commit}`;
      break;
  }

  return {
    version,
    environment,
    branch,
    commit,
    buildTime,
    buildTimestamp,
  };
}

function main() {
  console.log("🔧 Generating version information...");
  
  const versionInfo = generateVersion();
  
  console.log(`   Version: ${versionInfo.version}`);
  console.log(`   Environment: ${versionInfo.environment}`);
  console.log(`   Branch: ${versionInfo.branch}`);
  console.log(`   Commit: ${versionInfo.commit}`);
  console.log(`   Build Time: ${versionInfo.buildTime}`);

  // Ensure public directory exists
  const publicDir = join(process.cwd(), "public");
  if (!existsSync(publicDir)) {
    mkdirSync(publicDir, { recursive: true });
  }

  // Write version.json
  const outputPath = join(publicDir, "version.json");
  writeFileSync(outputPath, JSON.stringify(versionInfo, null, 2), "utf-8");
  
  console.log(`✅ Version file written to: ${outputPath}`);
}

// Execute
main();
