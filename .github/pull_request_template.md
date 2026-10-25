## Summary

Closes #

What changes, and why? One or two sentences are enough — the reasoning belongs in the linked issue.

## Release label and version

- [ ] The linked issue carries exactly one `release:*` label: `release:v1.0.0` (or another existing target
      such as `release:v0.6.0`) when the work ships with that version, `release:backlog` when it is not
      targeted yet. The label lives on the issue, not on this PR, and no workflow validates it.
- [ ] `CHANGELOG.md` has an entry under `## [Unreleased]` in Keep a Changelog format (`Added`, `Changed`,
      `Fixed`, `Removed`, `Security`) that references the issue as `(#123)`. Required for every PR that
      changes code or the site.
- [ ] Only release PRs touch `version` in `package.json`. `fd-deploy-prd` promotes `dev` → `main` only if
      that version has its own `## [x.y.z]` section in `CHANGELOG.md` and is greater than the latest GitHub
      release — entries under `## [Unreleased]` alone are not enough to promote.
- [ ] Base branch is `dev`. `main` is updated exclusively by the `fd-deploy-prd` workflow; never open a PR
      against `main`.

## Review

- [ ] `fd-ci` is green (lint, format, prose via Vale, 3D smoke test, e2e) — it runs on PRs targeting `dev`.
- [ ] Squad review happened where `.squad/routing.md` requires it; Tony is the final approver.
- [ ] Squash merge into `dev`, and only after an explicit human go-ahead.
