# GitHub Copilot Instructions

## Projektübersicht

**Frickeldave** ist eine Astro 5.13-basierte Multi-Content-Plattform (Blog, Docs, Recipes, Handmade Portfolio) mit statischer Site-Generierung für GitHub Pages. Das Projekt kombiniert TypeScript-typisierte Content Collections, React Islands für Interaktivität, und ein custom Glass Morphism Design System.

## Kritische Architektur-Entscheidungen

### GitHub Pages Static-Only Constraint
- **Astro Output MUSS `static` sein** (siehe `astro.config.mjs`)
- **Keine dynamischen API-Routen möglich** - alle Daten werden zur Build-Zeit generiert
- **Workaround für dynamische Features**: Client-side JS + JSON-Dateien in `/public/data/`
- Beispiel: Link-Redirect-System verwendet `/public/data/link-mappings.json` + client-side JS (`/public/js/redirect-handler.js`)

### Content Collection Architecture
Alle Content Types sind in `src/content.config.ts` mit Zod-Schemas definiert:
- Collections: `blog`, `docs`, `recipes`, `authors`, `portfolio`, `handmade`, `downloads`
- **Typed Exports**: Verwende `@/types` für typsichere Content-Queries (z.B. `BlogEntry`, `DocsEntry`)
- **Pattern**: `getCollection()` für Listen, `getEntryBySlug()` für einzelne Einträge
- **Reference-System**: `reference("authors")` für typsichere Cross-Collection References

### Component Island Pattern
React wird sparsam für Interaktivität eingesetzt:
- `client:load` - sofort laden (nur für Above-the-fold kritische UI)
- `client:idle` - nach Idle (Standard für nicht-kritische Interaktionen)
- `client:only="react"` - für Radix UI Components (siehe `ScrollArea` in Sidebars)
- Finde Verwendungen in: `Search`, `Swiper`, `TableOfContents`, `Browser` Components

## Build & Deployment Workflow

### Development
```bash
npm run dev          # Dev Server auf Port 4321
npm run build        # Production Build
npm run postbuild    # Pagefind Search Index (automatisch nach build)
```

### Linting (KRITISCH vor jedem Commit)
```bash
npm run lint         # ESLint mit auto-fix
npm run format       # Prettier formatierung
npm run prose        # Vale für Markdown (Schreibstil-Checks)
```
**Regel**: Keine unused Variables/Parameters ohne `_` Prefix, keine `any`-Types, explizite Return-Types

### GitHub Actions
- `deploy-prd.yml` - automatisches Deployment nach `main` merge
- Self-hosted Runner auf `frickeldave-main` Label
- Nutzt `withastro/action@v3` für Build + `actions/deploy-pages@v4`

## Projekt-spezifische Patterns & Konventionen

### Link-Redirect-System (Custom Implementation)
**Problem**: GitHub Pages unterstützt keine dynamischen Routen  
**Lösung**: Statische `/redirect/` Seite + Client-side Routing
- `/public/data/link-mappings.json` - Zentrale Link-Registry mit Analytics (Clicks, Affiliate-Tracking)
- `/public/js/redirect-handler.js` - Client-side Router für `/redirect/[id]` URLs
- `src/lib/redirectService.ts` - Build-time Service zum Lesen/Schreiben von Mappings
- **Usage**: Generiere Affiliate-Links, Short-URLs, Track-bare Links

### Glass Morphism Design System
Custom SCSS in `src/styles/glass.scss`:
```scss
.glass      // Standard Glass mit Blur + Border
.glass-t    // Transparent Variant
.glass-t-borderless  // Transparent ohne Border
```
Nutze mit Tailwind: `class="glass p-4 rounded-lg"`

### Content Collection TypeScript Pattern
```typescript
import { getCollection } from "astro:content";
import type { BlogEntry } from "@/types";

const entries = (await getCollection("blog")) as BlogEntry[];
const published = entries.filter(e => !e.data.draft);
```
**Wichtig**: Immer Cast zu spezifischem Type (`BlogEntry`, `DocsEntry`, etc.) für Type-Safety

### Similar Items Algorithm
`src/lib/similarItems.ts` - Content-basierte Recommendations:
- Matcht via `categories` und `tags` Arrays in Frontmatter
- Zählt Overlap-Häufigkeit für Ranking
- Verwendet für "Related Posts", "You might also like" Sections
- **Usage**: `similerItems(currentItem, allItems, currentItem.id)`

### Static Path Generation Pattern
Alle dynamischen Routen in `src/pages/` verwenden `getStaticPaths()`:
```typescript
export async function getStaticPaths() {
  const entries = await getCollection("blog");
  return entries.map(entry => ({
    params: { entry: entry.id },
    props: { entry },
  }));
}
```
**Regel**: Keine `export const prerender = false` - alles muss static sein!

## Component Patterns

### BaseLayout Usage (Standard Page Wrapper)
Alle Seiten verwenden `BaseLayout.astro` für konsistente Meta-Tags, SEO, Theme-Switching:
```astro
---
import BaseLayout from "@components/base/BaseLayout.astro";
interface Props {
  title: string;
  description?: string;
}
const { title, description } = Astro.props;
---
<BaseLayout {title} {description}>
  <slot />
</BaseLayout>
```

### Auto-Import Components
Diese Components sind in `astro.config.mjs` konfiguriert und MÜSSEN NICHT importiert werden:
- `<Button>` - Standard UI Button
- `<Accordion>`, `<Notice>`, `<Tabs>`, `<Tab>` - MDX Shortcodes
- **Ausnahme**: YouTube Component temporär deaktiviert (ES Module Konflikt mit `react-lite-youtube-embed`)

### React Island Hydration Strategy
- `client:load` → Sofort laden (nur für Above-the-fold kritische UI wie `<Search>`)
- `client:idle` → Nach Browser Idle (Standard für Interaktionen wie `<Swiper>`)
- `client:only="react"` → Nur Client-side rendern (für Radix UI wie `<ScrollArea>`)
```astro
<ScrollArea className="h-full" client:only="react">
  <!-- Content -->
</ScrollArea>
```

## TypeScript Type System

### Content Collection Types
`src/types/index.d.ts` exportiert typsichere Wrapper für alle Collections:
```typescript
import type { BlogEntry, DocsEntry, AuthorsEntry } from "@/types";

// ✅ Richtig - Typsicher
const posts = (await getCollection("blog")) as BlogEntry[];

// ❌ Falsch - Kein Type-Checking
const posts = await getCollection("blog");
```

### Generic Entry Type für flexible Functions
Für Utilities die mehrere Collection-Types unterstützen:
```typescript
import type { GenericEntry } from "@/types";

function processEntry(entry: GenericEntry) {
  // Works with any collection type
}
```

## Code Quality & Linting (Husky Pre-Commit Hooks)

### Linter Stack
- **ESLint** - TypeScript/JS/Astro Code-Analyse (keine `any`, unused vars mit `_` prefix)
- **Prettier** - Auto-Formatting (läuft on Save in VS Code)
- **Vale** - Markdown/MDX Prose Linting (Schreibstil, Terminologie)
- **Husky** - Pre-Commit Hooks für automatische Checks

### Critical Linting Rules
```typescript
// ❌ Falsch - Unused variable
function getData(param) { return 42; }

// ✅ Richtig - Prefix mit _ für unused
function getData(_param) { return 42; }

// ❌ Falsch - Implicit any
function process(data) { }

// ✅ Richtig - Explicit type
function process(data: string): void { }
```

### Pre-Commit Workflow
```bash
npm run lint     # ESLint auto-fix
npm run format   # Prettier formatting
npm run prose    # Vale markdown checks (optional)
```

## Naming Conventions

- **Komponenten**: `BlogCard.astro`, `EntryLayout.astro` (PascalCase)
- **Pages**: `[entry].astro`, `[...id].astro` (kebab-case)
- **Types**: `BlogEntry`, `LinkMappings` (PascalCase)
- **Functions**: `similerItems`, `getLinkMappings` (camelCase)
- **CSS Classes**: Tailwind utilities + `glass`, `glass-t`, `glass-t-borderless`
