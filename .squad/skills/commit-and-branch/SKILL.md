---
name: commit-and-branch
description: Conventional commit and branch naming workflow for this repository.
---

# Commit and Branch Workflow

Use for commit message and branch naming decisions.

## Key Rules

- Use conventional commit types: feat, fix, docs, style, refactor, perf, test, ci, chore.
- Keep commit subject concise, imperative, and lower-case style.
- Branch naming: type/short-description in kebab-case.
- Scope commits to related changes; avoid mixed unrelated bundles.

## Process

- Commit work directly to `dev` (single-developer workflow) — no feature branch or PR required.
- Promote `dev` → `main` only via the `fd-promote` workflow.
- Reference the issue in the commit body or PR (`Closes #N`) — not in the branch name.

## Gate

If branch or commit implies major code/config/process changes, get Tony approval first.
