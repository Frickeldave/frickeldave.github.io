---
updated_at: 2026-10-26T08:10:00+0100
focus_area: Issue #282 — Steps 1–24 auf dev, v1.0.4 ist nach main promotet; offen: fd-deploy.yaml (Kaniko-Deploy), Projektboard-/Badge-/Release-Label-Workflows
active_issues:
  - 282
---

# What We're Focused On

Marvel Cinematic squad is active. Legacy `.github/archive` content has been rewritten into `.squad/agents` and `.squad/skills`.

Issue #282 übernimmt die Artefakte aus dem Ursprungsprojekt schrittweise. Steps 1–24 sind auf `dev`, **v1.0.4 ist nach `main` promotet und als Release veröffentlicht**:

- **CI:** alle drei Jobs von `fd-ci.yml` laufen auf den self-hosted Runnern (Label `fd`, Limits 3 CPU / 8 GiB, `webServer.timeout` 600 s). Ein Wächter bricht ab, falls ein zweiter Label-Workflow zurückkehrt.
- **Labels:** `fd-configure.yml` ist die einzige Quelle (statische Namespaces plus `squad:<member>`).
- **Dev-Maschinen:** `fd-bootstrap.yml` legt je menschlichem Mitglied mit GitHub-Handle ein `fd-dev-full`-StatefulSet an, mit Kaniko-Layer-Cache und SSH-Zugang auf Port 2222.
- **Release:** `npm run versionbump` öffnet die CHANGELOG-Sektion, `fd-deploy-dev` veröffentlicht `dev-v<version>`-Pre-Releases, `fd-deploy-prd` deployt nur, wenn `main` höher ist als der letzte stabile Release, `fd-promote-prd` stößt den Promote manuell an.
- **Sprache:** Doku, Charter und Code-Kommentare sind deutsch; Code, Identifier, Befehle, Commit-Messages und Branch-Namen bleiben englisch.

Nächste Blöcke: `fd-deploy.yaml` (Kaniko-Deploy), `fd-sync-project-board.yml`, `fd-update-badges.yml`, `fd-pr-release-label.yml`.