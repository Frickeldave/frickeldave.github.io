---
updated_at: 2026-10-25T19:34:31+0100
focus_area: Issue #282 — CRAFT-Workflows adaptieren; Steps 9–10 (fd-ci komplett auf Runner-Label `fd`) abgeschlossen
active_issues:
  - 282
---

# What We're Focused On

Marvel Cinematic squad is active. Legacy `.github/archive` content has been rewritten into `.squad/agents` and `.squad/skills`.

Issue #282 portiert die CRAFT-Artefakte schrittweise. Steps 1–10 sind auf `dev`: Bootstrap-Paket, Issue-Template, Start-Flow-Skripte/Prompts, Squad 1.1.0, und seit Step 10 laufen **alle drei** Jobs von `fd-ci.yml` (`lint-checks`, `scad-smoke-test`, `e2e-test`) auf den self-hosted Runnern (Label `fd`, Limits jetzt 3 CPU / 8 GiB, `webServer.timeout` 600 s). Nächste Blöcke: `fd-configure.yml`, `fd-bootstrap.yml`, `fd-deploy.yaml` (Kaniko) sowie Repo-Hygiene (Scribe-Inbox, `npm install`).
