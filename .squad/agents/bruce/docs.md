# Bruce — Relevante Dokumentation

> Stand: 2026-07-16
> Diese Datei listet alle Dokumente, die für Backend-/Scripts-/Service-Arbeit relevant sind.

## Primäre Dokumente

| Dokument | Pfad | Relevanz |
|----------|------|----------|
| **Architekturentscheidungen** | `docs/40-arch-architecture-decisions.md` | ⭐ TypeScript-Muster, `similarItems`-Algorithmus, Content-Collections, SSG-Constraints |
| **Link Redirect System (FR001)** | `docs/features/fr001-redirects.md` | ⭐ `clientRedirectService.ts`, Link-Mappings-JSON, Click-Tracking |
| **Podcast-Update-Workflow (FR005)** | `docs/features/fr005-podcast-sync.md` | ⭐ Automatisierte Scripts (`compare-episodes.mjs`, `generate-metadata.mjs`, `update-doag.mjs`), RSS-Parsing |
| **Autodeploy (FR006)** | `docs/features/fr006-autodeploy.md` | 🟢 `merge-branches.mjs`, Deployment-Scripting |
| **Handmade Produktkatalog (FR003)** | `docs/features/fr003-catalog.md` | 🟢 Datenstruktur `handmade.json`, JSON-Quelle für Katalog |

## Sekundäre Dokumente

| Dokument | Pfad | Relevanz |
|----------|------|----------|
| **Commit-Messages** | `docs/12-dev-messages.md` | 🟡 Conventional Commits, commitlint-Konfiguration |
| **Branch-Naming-Strategie** | `docs/13-dev-branch-naming-strategy.md` | 🟡 Branch-Typen, Namenskonvention |
| **Bild-Handling** | `docs/16-write-image-handling.md` | 🟡 Asset-Pfad-Logik (`src/assets/` vs `public/`) |
| **Projektstruktur** | `docs/15-write-structure.md` | 🟡 `src/lib/`, `scripts/`, `public/data/`-Struktur |
| **Design-System** | `docs/20-arch-design-system.md` | 🔵 Button-Komponente (`Button.astro`) Props und Varianten |
| **Linter-Übersicht** | `docs/linter/01-linter-start.md` | 🔵 ESLint-Regeln für TypeScript |

## Legende

- ⭐ = Primäre Relevanz — immer lesen bei Backend-/Scripts-Arbeit
- 🟢 = Regelmässig relevant
- 🟡 = Bei spezifischen Aufgaben relevant
- 🔵 = Hintergrundwissen
