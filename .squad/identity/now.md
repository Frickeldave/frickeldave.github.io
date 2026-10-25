---
updated_at: 2026-10-25T18:45:57+0100
focus_area: Issue #282 — CRAFT-Workflows adaptieren; Step 9 (fd-ci auf Runner-Label `fd`) abgeschlossen
active_issues:
  - 282
---

# What We're Focused On

Marvel Cinematic squad is active. Legacy `.github/archive` content has been rewritten into `.squad/agents` and `.squad/skills`.

Issue #282 portiert die CRAFT-Artefakte schrittweise. Steps 1–9 sind auf `dev`: Bootstrap-Paket, Issue-Template, Start-Flow-Skripte/Prompts, Squad 1.1.0, und seit Step 9 laufen `lint-checks` und `scad-smoke-test` von `fd-ci.yml` auf den self-hosted Runnern (Label `fd`). `e2e-test` bleibt GitHub-hosted, bis die Runner-Limits (aktuell 1 CPU / 2 GiB) angehoben sind.
