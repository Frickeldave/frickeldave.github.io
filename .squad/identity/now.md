---
updated_at: 2026-11-03T14:25:28+0000
focus_area: Issue #303 — Dev-Container-OOMKill behoben (Paket B); Ressourcen der Dev-Maschinen sind jetzt Dispatch-Parameter, Draft-PR #304 wartet auf Review und Rollout
active_issues:
  - 303
---

# What We're Focused On

Marvel Cinematic squad is active. Legacy `.github/archive` content has been rewritten into `.squad/agents` and `.squad/skills`.

Aktuell: **Issue #303 — Development Container wird nach dem start-work flow neu gestartet.** Ursache belegt: `OOMKilled` (exitCode 137, `restartCount` 3), weil ~3,7 GiB Grundlast plus ~8 GiB Build-Peak das 8-GiB-Limit sprengten und der Pod kein Volume hat. Paket B ist auf `feat/issue-303-…` umgesetzt (Draft-PR #304, `release:no`):

- **Ressourcen sind Parameter:** `dev_cpu_request`, `dev_memory_request`, `dev_cpu_limit`, `dev_memory_limit` → `dev-machines.mjs render --cpu-request/…`; Default `100m` / `2Gi` / `4` / `16Gi`, Validierung vor `kubectl apply`.
- **Diagnose:** `fd_memory_limit`, `fd_container_uptime`, `fd_restart_hint` (offline) und Bannerzeilen `Container-Uptime:`, `Memory-Limit:`, `Restart:` mit Warnung unter 600 s Uptime.
- **Start-Flow:** kein `npm run build` mehr im Dev-Pod; Build und e2e prüft `fd-ci` nach dem Push.
- **Doku:** README-Abschnitt „Neustart: was verloren geht und wie es weitergeht" plus Parametertabelle, `fd-setup`-Verweis in `restart-machines.sh`.

Offen: Rollout der Limits (`updateStrategy: OnDelete` verlangt einen bewussten Neustart — AC 13 aus #303 ist erst danach abnehmbar), Review und Merge von PR #304, sowie der Branch-Basis-Defekt von `start-reqeng` als eigenes Issue.

## Vorheriger Fokus: Issue #282

Issue #282 übernimmt die Artefakte aus dem Ursprungsprojekt schrittweise. Steps 1–24 sind auf `dev`, **v1.0.4 ist nach `main` promotet und als Release veröffentlicht**:

- **CI:** alle drei Jobs von `fd-ci.yml` laufen auf den self-hosted Runnern (Label `fd`, Limits 3 CPU / 8 GiB, `webServer.timeout` 600 s). Ein Wächter bricht ab, falls ein zweiter Label-Workflow zurückkehrt.
- **Labels:** `fd-configure.yml` ist die einzige Quelle (statische Namespaces plus `squad:<member>`).
- **Dev-Maschinen:** `fd-bootstrap.yml` legt je menschlichem Mitglied mit GitHub-Handle ein `fd-dev-full`-StatefulSet an, mit Kaniko-Layer-Cache und SSH-Zugang auf Port 2222.
- **Release:** `npm run versionbump` öffnet die CHANGELOG-Sektion, `fd-deploy-dev` veröffentlicht `dev-v<version>`-Pre-Releases, `fd-deploy-prd` deployt nur, wenn `main` höher ist als der letzte stabile Release, `fd-promote-prd` stößt den Promote manuell an.
- **Sprache:** Doku, Charter und Code-Kommentare sind deutsch; Code, Identifier, Befehle, Commit-Messages und Branch-Namen bleiben englisch.

Nächste Blöcke: `fd-deploy.yaml` (Kaniko-Deploy), `fd-sync-project-board.yml`, `fd-update-badges.yml`, `fd-pr-release-label.yml`.