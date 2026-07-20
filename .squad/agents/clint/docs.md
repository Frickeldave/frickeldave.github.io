# Clint — Relevante Dokumentation

> Stand: 2026-07-16
> Diese Datei listet alle Dokumente, die für Testing und QA relevant sind.

## Primäre Dokumente

| Dokument | Pfad | Relevanz |
|----------|------|----------|
| **Linter-Integration** | `docs/linter/01-linter-start.md` | ⭐ Qualitätsprüfungen, Pre-Commit-Hooks |
| **ESLint-Konfiguration** | `docs/linter/03-linter-eslint.md` | ⭐ Code-Qualitätsregeln |
| **Prettier-Konfiguration** | `docs/linter/04-linter-prettier.md` | 🟢 Formatierungs-Checks |
| **Vale-Konfiguration** | `docs/linter/05-linter-vale.md` | 🟢 Prosa-Linting-Tests |
| **Husky-Anleitung** | `docs/linter/02-linter-husky.md` | 🟢 Git-Hook-Testing |

## Feature-Test-Dokumente

| Dokument | Pfad | Relevanz |
|----------|------|----------|
| **Autodeploy (FR006)** | `docs/features/fr006-autodeploy.md` | 🟢 Deployment-Testing, CI/CD-Validierung |
| **Podcast-Update (FR005)** | `docs/features/fr005-podcast-sync.md` | 🟢 Workflow-Testing, RSS-Parsing-Validierung |
| **Link Redirect System (FR001)** | `docs/features/fr001-redirects.md` | 🟡 Redirect-Testing, Click-Tracking-Validierung |
| **Handmade Katalog (FR003)** | `docs/features/fr003-catalog.md` | 🟡 Katalog-Filter-Testing |

## Legende

- ⭐ = Primäre Relevanz — immer lesen bei Test-Arbeit
- 🟢 = Regelmässig relevant
- 🟡 = Bei spezifischen Aufgaben relevant
