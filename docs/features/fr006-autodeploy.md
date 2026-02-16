# FR006: Automated Dev Deployment

This document describes the automated deployment workflow for the `dev` branch, triggered by
`npm run deploy:dev`.

- [FR006: Automated Dev Deployment](#fr006-automated-dev-deployment)
  - [Overview](#overview)
  - [Prerequisites](#prerequisites)
  - [Workflow Steps](#workflow-steps)
    - [1. Prerequisites Check](#1-prerequisites-check)
    - [2. Issue Management](#2-issue-management)
    - [3. Analysis \& AI Intent Understanding](#3-analysis--ai-intent-understanding)
    - [4. Branch Management](#4-branch-management)
    - [5. Quality Gates \& Build](#5-quality-gates--build)
    - [6. Commit \& Push](#6-commit--push)
    - [7. Merge \& Deployment](#7-merge--deployment)
    - [8. Cleanup](#8-cleanup)
  - [CLI Parameters](#cli-parameters)

## Overview

The `deploy:dev` command orchestrates a multi-step process to safely deploy local changes to the
`dev` branch. It ensures code quality, manages GitHub issues, and automates the merging process to
maintain a clean and reliable development environment.

The core logic resides in [update-dev-branch.mjs](../../scripts/workflows/ci/update-dev-branch.mjs).

## Prerequisites

To run this workflow, the following tools must be installed and configured:

- **Node.js**: >= 20.x
- **Git**: Properly configured with user credentials.
- **GitHub CLI (gh)**: Authenticated with the repository.
- **GitHub Copilot CLI**: Used for analyzing change intent.

## Workflow Steps

### 1. Prerequisites Check

Verifies that all required tools (`npm`, `git`, `gh`, `copilot`) are installed and the user is
authenticated.

- Responsible script:
  [update-dev-branch-prereqs.mjs](../../scripts/workflows/ci/update-dev-branch-prereqs.mjs)

### 2. Issue Management

Checks if a GitHub issue ID was provided or if one is already associated with the changes. If not,
it can interactively prompt to skip or create a new issue later.

- Responsible scripts:
  [issue-check.mjs](../../scripts/workflows/ci/update-dev-branch-issue-check.mjs),
  [issue-create.mjs](../../scripts/workflows/ci/update-dev-branch-issue-create.mjs),
  [issue-close.mjs](../../scripts/workflows/ci/update-dev-branch-issue-close.mjs)

### 3. Analysis & AI Intent Understanding

Analyzes the staged changes. It uses the GitHub Copilot CLI to "understand" the intent of the
changes, which is then used to generate a meaningful commit message and issue description if needed.

- Responsible scripts: [analyze.mjs](../../scripts/workflows/ci/update-dev-branch-analyze.mjs),
  [understand.mjs](../../scripts/workflows/ci/update-dev-branch-understand.mjs)

### 4. Branch Management

Determines the target branch for the deployment:

- **On `dev` or `main`**: Creates a NEW temporary feature branch (e.g., `ci/auto-deploy-...`) to
  perform the deployment steps. This keeps the working directory clean and avoids direct commits to
  `dev`.
- **On any other branch**: Stays on the current branch, assuming you are already working on a
  dedicated feature branch.

- Responsible script:
  [branch-mgmt.mjs](../../scripts/workflows/ci/update-dev-branch-branch-mgmt.mjs)

### 5. Quality Gates & Build

Runs automated checks:

- **Prettier**: Ensures correct code formatting.
- **ESLint**: Checks for code quality issues.
- **Vale**: Validates documentation and prose style.
- **Build**: Executes `npm run build` to ensure the project compiles correctly.
- Responsible scripts: [quality.mjs](../../scripts/workflows/ci/update-dev-branch-quality.mjs),
  [build.mjs](../../scripts/workflows/ci/update-dev-branch-build.mjs)

### 6. Commit & Push

Commits the changes to the temporary branch using the AI-generated message and pushes it to the
remote repository (`origin`).

- Responsible scripts: [commit.mjs](../../scripts/workflows/ci/update-dev-branch-commit.mjs),
  [push.mjs](../../scripts/workflows/ci/update-dev-branch-push.mjs)

### 7. Merge & Deployment

Uses the GitHub CLI to merge the temporary branch into the `dev` branch. This triggers the GitHub
Actions CI/CD pipeline for the actual deployment.

- Responsible scripts: [merge.mjs](../../scripts/workflows/ci/update-dev-branch-merge.mjs),
  [deploy-check.mjs](../../scripts/workflows/ci/update-dev-branch-deploy-check.mjs)

### 8. Cleanup

Removes temporary files, states, and the temporary local/remote branches after a successful merge.

- Responsible script: [cleanup.mjs](../../scripts/workflows/ci/update-dev-branch-cleanup.mjs)

## CLI Parameters

The workflow can be controlled with the following flags:

| Parameter          | Description                                            |
| :----------------- | :----------------------------------------------------- |
| `--issue-id <id>`  | Specify an existing GitHub issue ID.                   |
| `--auto-cleanup`   | Automatically remove temporary branches after success. |
| `--skip-devserver` | Skip the local dev server check (if applicable).       |

Example with all parameters:

> **Important:** Always use the double dash `--` before your arguments so that they are passed
> correctly to the underlying script!

```bash
npm run deploy:dev -- --issue-id 123 --auto-cleanup --skip-devserver
```
