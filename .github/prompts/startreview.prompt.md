---
description: 'Review one existing, ready pull request in its head-branch worktree without starting the issue implementation.'
agent: Squad
argument-hint: 'PR_<pr-id>'
---

# StartReview Pull Request Review

## Role and goal

Review exactly one existing non-draft pull request. `npm run start-review -- PR_<id>` (or a numeric PR ID)
prepares the context and dispatches this prompt, never `.github/prompts/startwork.prompt.md`. A linked
issue is optional; a standalone PR is a valid review target.

This is `Frickeldave/frickeldave.github.io`: a single Astro 7 repository (TypeScript, Tailwind CSS 4,
Node 24, npm) with content below `src/content/`. Pull requests target `dev`, the integration branch. `main`
is updated exclusively by the `fd-deploy-prd` workflow — a PR against `main` is not reviewable here.

Relevant skills:

- `.github/skills/worktree-naming-conventions/SKILL.md`
- `.github/skills/tmux-session-management/SKILL.md`

tmux does not exist on Windows/PowerShell, where this project is developed. In `--notmux` foreground mode
no session is created, attached, switched or renamed — report that instead of a tmux status.

## Required inputs

Use the launcher's PR ID, the optional linked issue ID, the canonical worktree context, the PR head branch
and the session state. If no PR ID is given, ask for it explicitly; never replace it with an issue number.
Metadata of a linked issue is context only.

## Mandatory gates

1. Verify the PR exists and is not a draft. Load the actual `headRefName`; never create a replacement
   implementation branch. Refuse a PR whose base is `main` and point to `fd-deploy-prd`.
2. Finish the identity check before preparing branch, worktree or runtime. Inside tmux the session named by
   the launcher (`tmux session:`) is authoritative: `PR<n>` or `IS<m>` of the linked issue (already checked
   by the launcher). Any other session stops; issue sessions are not renamed for PR reviews. Outside tmux,
   or when tmux is unavailable (Windows `--notmux`), create no session and attach to none.
3. Reuse or prepare the exact neighbouring worktree `<ProjectName>_PR_<n>` and reuse the PR head branch,
   including a local tracking branch when needed. Use the basename of the registered main checkout and the
   reuse rules of the linked skills. Stop when the expected head branch is unavailable; never replace it
   with an issue branch.
4. The review itself needs no issue implementation labels, no project readiness and no issue assignee. Do not
   assign issues, create drafts or request developer reviewers through the issue start flow. The
   `status:in-pr-review` label only marks such an issue and is not a gate for this workflow.
5. Local dev/test operations never derive a port from a PR ID or a directory name: use the launcher's
   `DEV_SERVER_PORT` when it is set and the Astro default `http://localhost:4321` otherwise. Disclose no
   secrets.

## Steps

1. Read PR metadata, description, base/head diff, existing review comments and the relevant code/tests in
   the prepared PR worktree.
2. Read a uniquely linked issue for the acceptance criteria when one exists; a missing or ambiguous link may
   neither be guessed nor treated as a review blocker.
3. Dispatch the actual review to the appropriate Squad reviewer. Tony is the final gatekeeper
   (`.squad/team.md`, `.squad/routing.md`); pull in domain reviewers for the affected area, for example
   Natasha for Astro/Tailwind UI, Bruce for scripts and integration, Clint for tests and QA, Nick for
   CI/CD and deployment, Maria for documentation and content prose, Jennifer for legal, privacy and
   editorial compliance and Rai for safety and bias. Prioritise bugs, regressions, security risks and
   missing tests; back findings with file/line references. Do not run the issue implementation workflow and
   never implement fixes silently.
4. Run focused validation only when the applicable safety gates pass, without recomputing ports. The
   project's validation commands are `npm run lint:check`, `npm run format:check`, `npm run prose`,
   `npm run build` and `npm run test:bootstrap`. Report blocked or skipped checks honestly.
5. Present findings and reviewer verdict first, then assumptions and validation. Document review results in
   the PR and in a uniquely linked issue when authorised; never change issue labels, status or assignment
   just to perform a review. Respect the existing stricter review/rejection gates for rework
   (`.github/skills/reviewer-protocol/SKILL.md`); fixes require the separate authorised workflow
   (`npm run start-work`).
6. At the end, on a positive verdict (no blocking findings, checks green), ask the human via `ask_user`
   whether the PR should be formally approved (`gh pr review --approve`) and merged with a squash merge into
   `dev`. Never approve or merge without an explicit yes; a textual approval in the verdict does not replace
   that question. Never merge into `main` — production deploys are owned by `fd-deploy-prd` and stay with
   the human. On yes: approve, merge into `dev`, and document the result in the PR and the linked issue.
   Never close the issue; closing happens only on explicit human command. If approval fails (for example on
   your own PR), report it and ask whether to merge anyway. Do not offer anything on findings or red checks.

## Hard boundaries

- No merge and no formal approval without explicit consent from step 6.
- No draft review, no dispatch of an issue implementation and no forwarding to `start-work`.
- No session creation, attachment, switching or renaming, and no overwriting on collisions.
- No new issue implementation branch, no issue reassignment, no draft creation and no change to reviewer
  requests.
- No work in the main checkout, in unrelated worktrees or with recomputed ports; no commit, merge or push on
  `main`.
- A missing issue link still allows a read-only PR review.

## Output

Report the PR ID, head/base branches, canonical worktree and session status (`--notmux` or tmux), the
optional linked issue, findings with severity and file/line references, the reviewer verdict, the exact
validation commands and every blocked check. State clearly when no findings were detected and what remains
unverified.
