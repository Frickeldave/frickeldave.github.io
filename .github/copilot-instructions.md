## Projektübersicht

Astro 5.13-basierte Multi-Content-Plattform (Blog, Docs, Recipes, Handmade Portfolio) mit statischer
Site-Generierung für GitHub Pages. TypeScript-typisierte Content Collections, React Islands, Glass
Morphism Design System.

## Kritische Regeln

- **Astro Output MUSS `static` sein** — kein `prerender = false`, keine dynamischen API-Routen
- **Keine `any`-Types**, keine unused Variables ohne `_`-Prefix, explizite Return-Types
- **NIEMALS manuell `git commit` oder `git push`** — immer Deployment-Skripte nutzen!
- Content Collection Queries **immer** auf spezifischen Type casten: `as BlogEntry[]`

## Development Commands

```bash
npm run dev           # Dev Server Port 4321 (0.0.0.0 für Netzwerkzugriff)
npm run build         # Production Build (läuft automatisch postbuild)
npm run postbuild     # Pagefind Site-Indexing (Search)
npm run lint          # ESLint auto-fix
npm run lint:check    # ESLint check only
npm run format        # Prettier auto-fix
npm run format:check  # Prettier check only
npm run prose         # Vale Markdown linting
```

## Deployment

```bash
npm run deploy:dev   # Committet + pusht auf dev
npm run deploy:prd   # Mergt dev → main, triggert Production Build
```

Bei Deploy-Auftrag: zuerst nach GitHub Issue-ID fragen. Wenn keine angegeben → non-interactive:

- dev: `npm run deploy:dev -- --auto-cleanup`
- prd: `npm run deploy:prd -- --skip-issue`

Docs: `./docs/features/fr006-autodeploy.md`

## Linting & Quality

- **ESLint**: `eslint-plugin-astro` + TypeScript rules — auto-fix mit `npm run lint`
- **Prettier**: Formatierung für `.astro`, `.ts`, `.tsx`, `.md`
- **Vale**: Markdown-Style-Checks (deutsche Regeln) — `npm run prose`
- **Commitlint**: Conventional Commits enforced via Husky

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

### TypeScript Type Patterns

- **Type imports**: `import type { BlogEntry } from "@/types"`
- **Collection casting**: Always cast: `(await getCollection("blog")) as BlogEntry[]`
- **Union types**: `GenericEntry` für multi-collection Utilities
- **No `any`**: Use `unknown` or specific types instead

## Naming Conventions

| Typ          | Konvention | Beispiel          |
| ------------ | ---------- | ----------------- |
| Komponenten  | PascalCase | `BlogCard.astro`  |
| Pages        | kebab-case | `[entry].astro`   |
| Types        | PascalCase | `BlogEntry`       |
| Functions    | camelCase  | `getLinkMappings` |
| Private libs | `_prefix`  | `_helpers.ts`     |

## Component Organization

```
src/components/
  common/          # Auto-imported: Button, Accordion, Notice, Tabs, Tab
  [collection]/    # Collection-specific: BlogCard, DocsBrowser, etc.
  shortcodes/      # MDX components: Accordion, Notice, Tabs, Tab
```

**Note**: `Youtube` component muss manuell importiert werden (ESM/CJS-Konflikt)

## Potential Pitfalls

- ❌ **Kein SSR** — Alle Routen müssen statisch generiert sein
- ❌ **Kein dynamisches Form-Handling** — Forms müssen externe Services nutzen
- ⚠️ **Youtube-Embeds** — Manuell importieren:
  `import Youtube from "@/components/shortcodes/Youtube.astro"`
- ⚠️ **Content Collections** — Immer Type-casten, optional fields mit `.optional()` markieren

## Documentation Inventory

### Onboarding & Setup

- [`./docs/10-install.md`](./docs/10-install.md) — Installation & Dependencies
- [`./docs/11-usage.md`](./docs/11-usage.md) — Usage Guide
- [`./docs/12-commit-messages.md`](./docs/12-commit-messages.md) — Commit-Konventionen
- [`./docs/13-branch-naming-strategy.md`](./docs/13-branch-naming-strategy.md) — Branching
- [`./docs/14-categories-and-tags.md`](./docs/14-categories-and-tags.md) — Taxonomie
- [`./docs/15-structure.md`](./docs/15-structure.md) — Projektstruktur

### Custom Agents

- `/.github/agents/compliance-checker.agent.md` — Compliance Checking Agent
- `/.github/agents/gender-neutral-language-review.agent.md` — Gender-Neutral Language Review Agent
- `/.github/agents/kubernetes-learning-review.agent.md` — Kubernetes Learning Review Agent

### Architecture & Design

- [`./docs/40-architecture-decisions.md`](./docs/40-architecture-decisions.md) — ADRs
- [`./docs/20-design-system.md`](./docs/20-design-system.md) — Glass Morphism

### Feature Documentation

- [`./docs/features/fr001-redirects.md`](./docs/features/fr001-redirects.md) — Link-Redirect-System
- [`./docs/features/fr003-catalog.md`](./docs/features/fr003-catalog.md) — Content Catalog
- [`./docs/features/fr005-podcast-sync.md`](./docs/features/fr005-podcast-sync.md) — Podcast Sync
- [`./docs/features/fr006-autodeploy.md`](./docs/features/fr006-autodeploy.md) — Auto-Deploy

### Linting & Quality

- [`./docs/linter/01-linter-start.md`](./docs/linter/01-linter-start.md) — Linter Overview
- [`./docs/linter/02-linter-husky.md`](./docs/linter/02-linter-husky.md) — Husky Hooks
- [`./docs/linter/03-linter-eslint.md`](./docs/linter/03-linter-eslint.md) — ESLint Config
- [`./docs/linter/04-linter-prettier.md`](./docs/linter/04-linter-prettier.md) — Prettier Config
- [`./docs/linter/05-linter-vale.md`](./docs/linter/05-linter-vale.md) — Vale Markdown

### Skills & Agents

- [`./docs/skills/gender-neutral-language.md`](./docs/skills/gender-neutral-language.md) — Gender-Neutral Language Skill
