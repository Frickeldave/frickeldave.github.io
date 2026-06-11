# GitHub MCP Server Wrapper

This wrapper script for the official GitHub MCP Server Docker container
(ghcr.io/github/github-mcp-server) reads the GitHub Personal Access Token from a `.env` file instead
of relying solely on environment variables.

## Setup

1. Copy the `.env.example` file to `.env`:

   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file and add your GitHub Personal Access Token:

   ```bash
   GITHUB_MCP_TOKEN=your_actual_github_token_here
   ```

3. Make sure your token has the required scopes for issue administration:
   - `repo` (full access to repository data)
   - `read:org` (read organizational data)
   - `read:user` (read user profile data)
   - `user:email` (access user email addresses)
   - `public_repo` (access public repositories)
   - `repo:status` (access commit statuses)

## Usage

The wrapper script is automatically used when the MCP server is started through the VS Code
integration.

## How It Works

The script:

1. Looks for a `.env` file in the project root
2. Reads the `GITHUB_TOKEN` from the file if available
3. Falls back to the environment variable if the file is not found or doesn't contain the token
4. Starts the GitHub MCP Server with the token
