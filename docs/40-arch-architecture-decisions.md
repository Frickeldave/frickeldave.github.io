# Architekturentscheidungen

## Namenskonventionen

- **Komponenten**: `BlogCard.astro`, `EntryLayout.astro` (PascalCase)
- **Seiten**: `[entry].astro`, `[...id].astro` (Dateinamen im bestehenden Routing-Schema)
- **Typen**: `BlogEntry`, `LinkMappings` (PascalCase)
- **Funktionen**: `similerItems`, `getLinkMappings` (camelCase)
- **CSS-Klassen**: Tailwind-Utilities plus `glass`, `glass-t`, `glass-t-borderless`

## Statische Seitengenerierung (SSG)

- **Randbedingung**: Das Projekt ist als statische Astro-Site mit `output: "static"` in
  `astro.config.mjs` konfiguriert.
- **Auswirkung**: Es gibt keine Server-Side-Rendering-Funktionalitaet. Das gesamte HTML wird beim
  Build erzeugt.
- **Dynamische Logik**: Funktionen mit Interaktivitaet, etwa Suche oder Redirects, werden per
  clientseitigem JavaScript umgesetzt und greifen auf statische JSON-Daten aus dem Build oder aus
  `/public/data` zu.

## Kerntechnologien

- **Framework**: Astro 7 mit Islands-Architektur.
- **Templating**: `.astro`-Komponenten fuer Layout und statische Struktur; React fuer interaktive
  Islands.
- **Styling**: Tailwind CSS v4 mit projektspezifischer Konfiguration.
- **Content**: Markdown/MDX fuer Inhalte; TypeScript fuer Typsicherheit.

## Content-Collections

Definiert in `src/content.config.ts` ist dies die zentrale Quelle fuer alle Content-Collections.

- **Validierung**: Strikte **Zod**-Schemas erzwingen die Datentypen im Frontmatter.
- **Organisation**: Inhalte sind in typisierte Collections gegliedert, etwa `blog`, `docs`,
  `aboutme` oder `recipes`.
- **Referenzen**: Mit `reference()` werden relationale Verknuepfungen zwischen Collections
  hergestellt, etwa zwischen `author` und einem `blog`-Beitrag.

## Styling-System

- **Tailwind-Konfiguration**: `tailwind.config.js` implementiert das projektspezifische
  Design-System.
  - **Schriften**: Eigene Logik fuer Schriftskalierung und Schriftfamilien (Serif primaer,
    Sans-Serif sekundaer).
  - **Grid**: `tailwind-bootstrap-grid` sorgt fuer ein konsistentes 12-Spalten-Layout.
  - **Animationen**: Eigene Keyframes und Animation-Utilities, etwa die `intersect`-Variante.
- **Dark Mode**: Wird ueber die Strategie `darkMode: "class"` erzwungen.

## Component Islands (Interaktivitaet)

React ist bewusst auf interaktive Elemente beschraenkt, um die Performance hoch zu halten.

- **Strategie fuer die Nutzung**:
  - `client:load`: Kritische Interaktivitaet im direkt sichtbaren Bereich.
  - `client:idle`: Nicht kritische Interaktivitaet, etwa Suchfelder oder Tooltips.
  - `client:only="react"`: Bibliotheken, die sofort Browser-APIs benoetigen, etwa Radix-UI-Komponenten.

## Suche und Auffindbarkeit

- **Engine**: Das Projekt verwendet **Pagefind** im `postbuild`-Schritt fuer performante statische
  Indizierung.
- **Alternative/Bestand**: **Fuse.js** ist weiterhin als Abhaengigkeit vorhanden und wird
  voraussichtlich fuer spezielle Filter- oder Suchlogik innerhalb einzelner Komponenten genutzt,
  etwa in `EntryLayout`.

## Qualitaetssicherung

- **Code**: ESLint und Prettier sind fuer TypeScript und Astro konfiguriert.
- **Prosa**: **Vale** ist zur sprachlichen Pruefung von Markdown-Inhalten eingebunden.

## Entscheidungen zur Dateistruktur

- **`src/content/`**: Alle Markdown- und MDX-Inhalte.
- **`src/components/base/`**: Basis-Komponenten wie globale Seiten-Wrapper.
- **`public/`**: Statische Assets, die Astro nicht verarbeitet, etwa generierte JSON-Daten.

## TypeScript-Muster fuer Content Collections

```typescript
import { getCollection } from "astro:content";
import type { BlogEntry } from "@/types";

const entries = (await getCollection("blog")) as BlogEntry[];
const published = entries.filter((e) => !e.data.draft);
```

**Wichtig**: Immer auf den spezifischen Typ casten (`BlogEntry`, `DocsEntry` usw.), um
Typsicherheit zu behalten.

## Algorithmus fuer aehnliche Eintraege

`src/lib/similarItems.ts` - Content-basierte Empfehlungen:

- Matcht ueber `categories`- und `tags`-Arrays im Frontmatter
- Zaehlt Ueberschneidungen fuer das Ranking
- Wird fuer Bereiche wie "Related Posts" oder "You might also like" verwendet
- **Verwendung**: `similerItems(currentItem, allItems, currentItem.id)`

## Muster fuer statische Pfadgenerierung

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

**Regel**: Kein `export const prerender = false` - alles muss statisch bleiben.

## Verwendung von `BaseLayout` (Standard-Wrapper fuer Seiten)

Alle Seiten verwenden `BaseLayout.astro` fuer konsistente Meta-Tags, SEO und Theme-Switching:

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

## Auto-Import-Komponenten

Diese Komponenten sind in `astro.config.mjs` konfiguriert und MUESSEN NICHT importiert werden:

- `<Button>` - Standard UI Button
- `<Accordion>`, `<Notice>`, `<Tabs>`, `<Tab>` - MDX Shortcodes
- **Ausnahme**: YouTube-Komponente temporaer deaktiviert (ES-Module-Konflikt mit
  `react-lite-youtube-embed`)

## React-Island-Hydration-Strategie

- `client:load` → Sofort laden (nur fuer kritisch sichtbare UI wie `<Search>`)
- `client:idle` → Nach Browser-Idle laden (Standard fuer Interaktionen wie `<Swiper>`)
- `client:only="react"` → Nur clientseitig rendern (fuer Radix UI wie `<ScrollArea>`)

```astro
<ScrollArea className="h-full" client:only="react">
  <!-- Content -->
</ScrollArea>
```

## Typen fuer Content Collections

`src/types/index.d.ts` exportiert typsichere Wrapper fuer alle Collections:

```typescript
import type { BlogEntry, DocsEntry, AuthorsEntry } from "@/types";

// ✅ Richtig - typsicher
const posts = (await getCollection("blog")) as BlogEntry[];

// ❌ Falsch - kein Type-Checking
const posts = await getCollection("blog");
```

## Generischer Entry-Typ fuer flexible Funktionen

Fuer Utilities, die mehrere Collection-Typen unterstuetzen:

```typescript
import type { GenericEntry } from "@/types";

function processEntry(entry: GenericEntry) {
  // Works with any collection type
}
```
