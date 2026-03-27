---
name: frickeldave-main
description:
  "Hauptagent für Frickeldave-Projekt. Delegiere Kubernetes-Schulung-Reviews an
  kubernetes-learning-review nach Änderungen in src/content/docs/kubernetes-basis."
tools: Glob, Grep, Read, Write, Edit, Agent(kubernetes-learning-review)
model: sonnet # oder haiku
---

## Projektübersicht

Astro 5.13-basierte Multi-Content-Plattform (Blog, Docs, Recipes, Handmade Portfolio) mit statischer
Site-Generierung für GitHub Pages. TypeScript-typisierte Content Collections, React Islands, Glass
Morphism Design System.

## Kritische Regeln

- **Astro Output MUSS `static` sein** — kein `prerender = false`, keine dynamischen API-Routen
- **Keine `any`-Types**, keine unused Variables ohne `_`-Prefix, explizite Return-Types
- **NIEMALS manuell `git commit` oder `git push`** — immer Deployment-Skripte nutzen!
- Content Collection Queries **immer** auf spezifischen Type casten: `as BlogEntry[]`

## Deployment

```bash
npm run deploy:dev   # Committet + pusht auf dev
npm run deploy:prd   # Mergt dev → main, triggert Production Build
```

Bei Deploy-Auftrag: zuerst nach GitHub Issue-ID fragen. Wenn keine angegeben → non-interactive:

- dev: `npm run deploy:dev -- --auto-cleanup`
- prd: `npm run deploy:prd -- --skip-issue`

Docs: `./docs/features/fr006-autodeploy.md`

## Development & Linting

```bash
npm run dev      # Dev Server Port 4321
npm run build    # Production Build (postbuild läuft automatisch)
npm run lint     # ESLint auto-fix
npm run format   # Prettier
npm run prose    # Vale Markdown-Checks
```

Docs: `./docs/linter/01-linter-start.md`

## Architektur

### Content Collections (`src/content.config.ts`)

Collections: `blog`, `docs`, `recipes`, `authors`, `portfolio`, `handmade`, `downloads`

```typescript
import { getCollection } from "astro:content";
import type { BlogEntry } from "@/types"; // immer casten!

const entries = (await getCollection("blog")) as BlogEntry[];
```

Für multi-collection Utilities: `import type { GenericEntry } from "@/types"`

### React Islands

- `client:load` — Above-the-fold (z.B. `<Search>`)
- `client:idle` — Standard für Interaktionen (z.B. `<Swiper>`)
- `client:only="react"` — Radix UI (z.B. `<ScrollArea>`)

### Link-Redirect-System

Workaround für fehlende dynamische Routen auf GitHub Pages:

- `/public/data/link-mappings.json` — Link-Registry
- `/public/js/redirect-handler.js` — Client-side Router
- `src/lib/redirectService.ts` — Build-time Service

Docs: `./docs/features/fr001-redirect.md`

### Design system

- Glass Morphism (`src/styles/glass.scss`)
- `.glass` / `.glass-t` / `.glass-t-borderless` — mit Tailwind kombinieren:
  `class="glass p-4 rounded-lg"`

Docs: `./docs/20-design-system.md`

### Auto-Import Components (kein Import nötig)

`<Button>`, `<Accordion>`, `<Notice>`, `<Tabs>`, `<Tab>` — konfiguriert in `astro.config.mjs`

### Similar Items

`src/lib/similarItems.ts` — `similerItems(currentItem, allItems, currentItem.id)`

## Naming Conventions

| Typ         | Konvention | Beispiel          |
| ----------- | ---------- | ----------------- |
| Komponenten | PascalCase | `BlogCard.astro`  |
| Pages       | kebab-case | `[entry].astro`   |
| Types       | PascalCase | `BlogEntry`       |
| Functions   | camelCase  | `getLinkMappings` |

## Docs

- `./docs/40-architecture-decisions.md` — Architektur-Entscheidungen
- `./docs/15-structure.md` — Projektstruktur
- `./docs/20-design-system.md` — Design System
- `./docs/12-commit-messages.md` — Commit-Konventionen
- `./docs/features/` — Feature-Dokumentation
