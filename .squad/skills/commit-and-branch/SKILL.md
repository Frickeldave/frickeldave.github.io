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

- Start feature work from dev and merge back to dev.
- Use release flow for dev to main promotion.
- Include issue context in branch names when available.

## Gate

If branch or commit implies major code/config/process changes, get Tony approval first.
