# Tony — Relevante Dokumentation

> Stand: 2026-07-16
> Diese Datei listet alle Dokumente, die für Architektur-, Review- und Lead-Aufgaben relevant sind.

## Primäre Dokumente

| Dokument | Pfad | Relevanz |
|----------|------|----------|
| **12-Factor App Audit Template** | `docs/60-ops-12-factor-audit-template.md` | ⭐ Betriebliche Freigabe, Architektur-Audit, Go/No-Go-Entscheidungen |
| **Architekturentscheidungen** | `docs/40-arch-architecture-decisions.md` | ⭐ SSG, Content-Collections, Component Islands, Styling-System, Typen |
| **Design-System** | `docs/20-arch-design-system.md` | ⭐ Farbschemata, Button-Design, Glass-Boxen, sektionsspezifische Systeme |
| **Squad-Agent-Setup** | `docs/50-agent-setup.md` | ⭐ Rollenmodell, Issue-Gate, Routing, Governance |
| **Projektstruktur** | `docs/15-write-structure.md` | 🟢 Gesamtarchitektur, Verzeichnisstruktur |

## Feature-Dokumente (alle relevant für Architektur-Review)

| Dokument | Pfad | Relevanz |
|----------|------|----------|
| **Link Redirect System (FR001)** | `docs/features/fr001-redirects.md` | 🟢 Client-seitiges Redirect-System, Affiliate-Compliance |
| **Handmade Katalog (FR003)** | `docs/features/fr003-catalog.md` | 🟢 SSG-Produktkatalog, Datenstruktur, Seiten-Routing |
| **Podcast-Update (FR005)** | `docs/features/fr005-podcast-sync.md` | 🟢 Automatisierter Workflow, GitHub Copilot CLI-Integration |
| **Autodeploy (FR006)** | `docs/features/fr006-autodeploy.md` | 🟢 Branch-basiertes Deployment, CI/CD-Architektur |

## Sekundäre Dokumente

| Dokument | Pfad | Relevanz |
|----------|------|----------|
| **Commit-Messages** | `docs/12-dev-messages.md` | 🟡 Conventional Commits-Standard |
| **Branch-Naming-Strategie** | `docs/13-dev-branch-naming-strategy.md` | 🟡 Git-Workflow, Branch-Typen |
| **Bild-Handling** | `docs/16-write-image-handling.md` | 🟡 Asset-Strategie, UrhG-Compliance |
| **Linter-Integration** | `docs/linter/01-linter-start.md` | 🟡 Qualitätssicherungs-Architektur |
| **Dev-Installation** | `docs/10-dev-install.md` | 🔵 Entwickler-Setup |
| **Dev-Usage** | `docs/11-dev-usage.md` | 🔵 Build-Befehle, Deployment-Ablauf |

## Legende

- ⭐ = Primäre Relevanz — immer lesen bei Architektur-/Review-Arbeit
- 🟢 = Regelmässig relevant
- 🟡 = Bei spezifischen Aufgaben relevant
- 🔵 = Hintergrundwissen
