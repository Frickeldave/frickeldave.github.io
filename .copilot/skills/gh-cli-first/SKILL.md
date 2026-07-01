---
name: gh-cli-first
description: Always use the GitHub CLI for GitHub repository operations in this workspace.
---

# GH CLI First

Use this skill whenever the task touches GitHub issues, pull requests, labels, releases, workflows, or repository metadata.

## Rule

- Prefer `gh` CLI over GitHub MCP tools for all GitHub operations in this repository.
- Use MCP only when the user explicitly asks for MCP validation or when `gh` cannot perform the required operation.
- When a command needs a repository target, always pass `-R Frickeldave/frickeldave.github.io` unless the current directory repository is already confirmed and the command does not need an explicit target.

## Standard Commands

- View issue: `gh issue view <number> -R Frickeldave/frickeldave.github.io`
- List issues by label: `gh issue list -R Frickeldave/frickeldave.github.io --label <label> --state open`
- Comment on issue: `gh issue comment <number> -R Frickeldave/frickeldave.github.io --body <text>`
- Edit issue title/body: `gh issue edit <number> -R Frickeldave/frickeldave.github.io --title <title> --body-file <file>`
- View pull request: `gh pr view <number> -R Frickeldave/frickeldave.github.io`
- List pull requests: `gh pr list -R Frickeldave/frickeldave.github.io --state open`
- Checkout pull request: `gh pr checkout <number> -R Frickeldave/frickeldave.github.io`
- Create pull request: `gh pr create -R Frickeldave/frickeldave.github.io --base dev --head <branch> --title <title> --body-file <file>`
- View workflow runs: `gh run list -R Frickeldave/frickeldave.github.io`
- View run details: `gh run view <run-id> -R Frickeldave/frickeldave.github.io --log`
- List releases: `gh release list -R Frickeldave/frickeldave.github.io`
- View labels: `gh label list -R Frickeldave/frickeldave.github.io`

## Guardrails

- Never assume a default repo is configured; prefer explicit `-R`.
- Do not print tokens or auth headers.
- Use `gh auth status` when authentication health matters.
- If `gh` fails because no repo is set, fix the command with `-R` rather than switching to MCP.

## When To Mention MCP

- MCP server health checks
- Comparing MCP behavior against CLI behavior
- User explicitly asks to test MCP servers