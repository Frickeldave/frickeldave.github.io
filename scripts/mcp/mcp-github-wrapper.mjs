#!/usr/bin/env node

// Wrapper script for GitHub MCP Server
// Reads GitHub PAT from .env file and starts the server

import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

// Function to load environment variables from .env file
function loadEnvFromFile(envFilePath) {
  if (!existsSync(envFilePath)) {
    console.warn(`Environment file not found: ${envFilePath}`);
    return {};
  }

  const envVars = {};
  const content = readFileSync(envFilePath, "utf8");

  content.split("\n").forEach((line) => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      envVars[key] = value;
    }
  });

  return envVars;
}

// Try to load environment variables from .env file
const projectRoot = join(import.meta.dirname, "../../");
const envFilePath = join(projectRoot, ".env");
const envVars = loadEnvFromFile(envFilePath);

// Check if GITHUB_MCP_TOKEN is available
const githubToken = envVars.GITHUB_MCP_TOKEN || process.env.GITHUB_MCP_TOKEN;

if (!githubToken) {
  console.error(
    "Error: GITHUB_MCP_TOKEN not found in environment or .env file"
  );
  console.info(
    "Please create a .env file in the project root with your GitHub token:"
  );
  console.info("GITHUB_MCP_TOKEN=your_github_personal_access_token_here");
  process.exit(1);
}

// Construct the command to start the GitHub MCP Server Docker container
const command = `docker run --rm -i --env GITHUB_PERSONAL_ACCESS_TOKEN=${githubToken} ghcr.io/github/github-mcp-server:0.34.0`;

console.log(
  "Starting GitHub MCP Server Docker container (ghcr.io/github/github-mcp-server:0.34.0)..."
);
console.log(
  `Using token from: ${envVars.GITHUB_MCP_TOKEN ? ".env file" : "environment variables"}`
);

try {
  // Execute the command
  execSync(command, { stdio: "inherit" });
} catch (error) {
  console.error(
    "Failed to start GitHub MCP Server Docker container (ghcr.io/github/github-mcp-server:0.34.0):",
    error.message
  );
  process.exit(1);
}
