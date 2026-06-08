# Architecture Decisions

## Naming Conventions

- **Komponenten**: `BlogCard.astro`, `EntryLayout.astro` (PascalCase)
- **Pages**: `[entry].astro`, `[...id].astro` (kebab-case)
- **Types**: `BlogEntry`, `LinkMappings` (PascalCase)
- **Functions**: `similerItems`, `getLinkMappings` (camelCase)
- **CSS Classes**: Tailwind utilities + `glass`, `glass-t`, `glass-t-borderless`

## Static Site Generation (SSG)

- **Constraint**: Hosted on GitHub Pages, forcing `output: "static"` in `astro.config.mjs`.
- **Implication**: No Server-Side Rendering (SSR) functionality. All HTML is generated at build
  time.
- **Dynamic Logic**: Features requiring interactivity (e.g., search, redirects) are implemented via
  client-side JavaScript utilizing static JSON data generated during the build or stored in
  `/public/data`.

## Core Technologies

- **Framework**: Astro 5 (Beta/Latest) utilizing the Islands Architecture.
- **Templating**: `.astro` components for layout and static structure; React for interactive
  islands.
- **Styling**: Tailwind CSS v3 with a custom configuration.
- **Content**: MDX for content; TypeScript for type safety.

## Content Collections

Defined in `src/content.config.ts` (formerly `config.ts`), this is the source of truth for all
content.

- **Validation**: Strict **Zod** schemas enforce frontmatter data types.
- **Organization**: Content is segregated into typed collections (e.g., `blog`, `docs`, `aboutme`,
  `recipes`).
- **References**: Uses `reference()` for relational data link between collections (e.g., associating
  an `author` with a `blog` post).

## Styling System

- **Tailwind Configuration**: `tailwind.config.js` implements a specific design system:
  - **Fonts**: Custom font scaling logic and font families (Serif primary, Sans-serif secondary).
  - **Grid**: Integrates `tailwind-bootstrap-grid` for 12-column layout consistency.
  - **Animations**: Custom keyframes and animation utilities (e.g., `intersect` variant).
- **Dark Mode**: enforced via `darkMode: "class"` strategy.

## Component Islands (Interactivity)

React is strictly reserved for interactive elements ("Islands") to maintain high performance.

- **Usage Strategy**:
  - `client:load`: Critical above-the-fold interactivity.
  - `client:idle`: Non-critical interactive elements (e.g., search bars, tooltips).
  - `client:only="react"`: Libraries requiring browser APIs immediately (e.g., Radix UI components).

## Search and Discovery

- **Engine**: The project includes **Pagefind** (`postbuild` script) for high-performance static
  indexing.
- **Legacy/Alternative**: **Fuse.js** is also present as a dependency, likely used for specific
  in-page filtering or component-level search logic (e.g. `EntryLayout`).

## Quality Assurance

- **Code**: ESLint and Prettier configured for TypeScript and Astro.
- **Prose**: **Vale** is integrated to lint English prose quality in Markdown content (`.vale.ini`).

## File Structure Decisions

- **`src/content/`**: All markdown/MDX data.
- **`src/layouts/`**: Global page wrappers.
- **`public/`**: Static assets that bypass Astro processing (e.g., generated JSON data).

## Content Collection TypeScript Pattern

```typescript
import { getCollection } from "astro:content";
import type { BlogEntry } from "@/types";

const entries = (await getCollection("blog")) as BlogEntry[];
const published = entries.filter((e) => !e.data.draft);
```

**Wichtig**: Immer Cast zu spezifischem Type (`BlogEntry`, `DocsEntry`, etc.) für Type-Safety

## Similar Items Algorithm

`src/lib/similarItems.ts` - Content-basierte Recommendations:

- Matcht via `categories` und `tags` Arrays in Frontmatter
- Zählt Overlap-Häufigkeit für Ranking
- Verwendet für "Related Posts", "You might also like" Sections
- **Usage**: `similerItems(currentItem, allItems, currentItem.id)`

## Static Path Generation Pattern

Alle dynamischen Routen in `src/pages/` verwenden `getStaticPaths()`:

```typescript
export async function getStaticPaths() {
  const entries = await getCollection("blog");
  return entries.map((entry) => ({
    params: { entry: entry.id },
    props: { entry },
  }));
}
```

**Regel**: Keine `export const prerender = false` - alles muss static sein!

## BaseLayout Usage (Standard Page Wrapper)

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

## Auto-Import Components

Diese Components sind in `astro.config.mjs` konfiguriert und MÜSSEN NICHT importiert werden:

- `<Button>` - Standard UI Button
- `<Accordion>`, `<Notice>`, `<Tabs>`, `<Tab>` - MDX Shortcodes
- **Ausnahme**: YouTube Component temporär deaktiviert (ES Module Konflikt mit
  `react-lite-youtube-embed`)

## React Island Hydration Strategy

- `client:load` → Sofort laden (nur für Above-the-fold kritische UI wie `<Search>`)
- `client:idle` → Nach Browser Idle (Standard für Interaktionen wie `<Swiper>`)
- `client:only="react"` → Nur Client-side rendern (für Radix UI wie `<ScrollArea>`)

```astro
<ScrollArea className="h-full" client:only="react">
  <!-- Content -->
</ScrollArea>
```

## Content Collection Types

`src/types/index.d.ts` exportiert typsichere Wrapper für alle Collections:

```typescript
import type { BlogEntry, DocsEntry, AuthorsEntry } from "@/types";

// ✅ Richtig - Typsicher
const posts = (await getCollection("blog")) as BlogEntry[];

// ❌ Falsch - Kein Type-Checking
const posts = await getCollection("blog");
```

## Generic Entry Type für flexible Functions

Für Utilities die mehrere Collection-Types unterstützen:

```typescript
import type { GenericEntry } from "@/types";

function processEntry(entry: GenericEntry) {
  // Works with any collection type
}
```
