# Projektstruktur

Dieses Dokument beschreibt die aktuelle Struktur des Repositories `frickeldave.github.io`.

## Repository root

- `.github/` enthält die GitHub Actions Workflows: `fd-ci.yml`, `fd-deploy-dev.yml`,
  `fd-promote-prd.yml`, `fd-deploy-prd.yml`, `fd-configure.yml`, `fd-bootstrap.yml`,
  `fd-podcast-update.yml`, `fd-sync-project-board.yml` sowie die `squad-*.yml`-Workflows für Triage
  und Label-Pflege.
- `.squad/` enthält Team-, Routing- und Governance-Dateien für den internen Squad-Workflow.
- `.husky/` enthält die Git-Hooks für Commit-Message-Prüfung, Pre-Commit-Checks und den Pre-Push.
- `.vale/` enthält die lokale Vale-Binary und die Styles für die Prosa-Prüfung.
- `.openscad/` enthält die OpenSCAD-Installation, mit der `npm run scad:render` die 3D-Modelle baut.
- `docs/` enthält die technische Projektdokumentation, Feature-Beschreibungen und Linter-Guides.
- `public/` enthält statische Dateien, die unverändert ausgeliefert werden.
- `scripts/` enthält Node-basierte Hilfsskripte für Prosa-Checks, Tool-Setup, Bootstrap und lokale
  Git-Workflows.
- `src/` enthält den eigentlichen Astro-Quellcode, Content-Collections und Assets.
- `test/` enthält die Playwright-e2e-Tests und den 3D-Build-Test.
- `package.json` definiert die npm-Skripte und die direkten Abhängigkeiten.
- `package-lock.json` pinnt den vollständigen npm-Dependency-Baum.
- `astro.config.mjs`, `tailwind.config.*`, `eslint.config.mjs`, `tsconfig.json` und `wrangler.jsonc`
  steuern Build, Styling, Linting, TypeScript und Deployment-Konfiguration.

## `src/`

- `src/content.config.ts` definiert die Collection-Schemas.
- `src/content/` enthält alle Inhalte, zum Beispiel Blog, Docs, Downloads, Rezepte, About-me,
  Autoren und die englischen Seiten.
- `src/assets/` enthält Bilder und andere Build-Zeit-Assets, gruppiert nach Fachbereich.
- `src/components/` enthält Layout- und UI-Komponenten, unterteilt nach Domänen wie `blog/`,
  `home/`, `common/` oder `base/`.
- `src/pages/` enthält das dateibasierte Routing für Astro.
- `src/lib/` enthält wiederverwendbare Helfer und Services.
- `src/styles/` enthält globale Styles und Design-System-Bausteine.
- `src/types/` enthält projektspezifische TypeScript-Typen.

## `public/`

- `public/favicon/` enthält Favicons.
- `public/fonts/` enthält lokal ausgelieferte Schriftarten.
- `public/data/` enthält statische JSON-Dateien für Laufzeitdaten.
- `public/downloads/` enthält herunterladbare Dateien, die unter ihrem festen Dateinamen erreichbar
  bleiben müssen.
- Dateien wie `robots.txt`, `site.webmanifest` und `CNAME` werden direkt ausgeliefert.

## Arbeitsregeln

- Lege Content-Bilder bevorzugt in `src/assets/<bereich>/` ab, nicht in `public/`.
- Pflege Content-Struktur und Frontmatter in `src/content/`; passe das Schema bei Bedarf in
  `src/content.config.ts` an.
- Verwende `public/` nur für Dateien, die ohne Build-Transformation veröffentlicht werden müssen.
- Halte Automatisierung, Validierung und Hilfswerkzeuge in `scripts/` statt in ad-hoc Shell-Dateien.
