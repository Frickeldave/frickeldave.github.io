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
- **Auswirkung**: Es gibt keine Server-Side-Rendering-Funktionalität. Das gesamte HTML wird beim
  Build erzeugt.
- **Dynamische Logik**: Funktionen mit Interaktivität, etwa Suche oder Redirects, werden per
  clientseitigem JavaScript umgesetzt und greifen auf statische JSON-Daten aus dem Build oder aus
  `/public/data` zu.

## Kerntechnologien

- **Framework**: Astro 7 mit Islands-Architektur.
- **Templating**: `.astro`-Komponenten für Layout und statische Struktur; React für interaktive
  Islands.
- **Styling**: Tailwind CSS v4 mit projektspezifischer Konfiguration.
- **Content**: Markdown/MDX für Inhalte; TypeScript für Typsicherheit.

## Content-Collections

Definiert in `src/content.config.ts` ist dies die zentrale Quelle für alle Content-Collections.

- **Validierung**: Strikte **Zod**-Schemas erzwingen die Datentypen im Frontmatter.
- **Organisation**: Inhalte sind in typisierte Collections gegliedert, etwa `blog`, `docs`,
  `aboutme` oder `recipes`.
- **Referenzen**: Mit `reference()` werden relationale Verknüpfungen zwischen Collections
  hergestellt, etwa zwischen `author` und einem `blog`-Beitrag.

## Styling-System

- **Tailwind-Konfiguration**: `tailwind.config.js` implementiert das projektspezifische
  Design-System.
  - **Schriften**: Eigene Logik für Schriftskalierung und Schriftfamilien (Serif primär,
    Sans-Serif sekundär).
  - **Grid**: `tailwind-bootstrap-grid` sorgt für ein konsistentes 12-Spalten-Layout.
  - **Animationen**: Eigene Keyframes und Animation-Utilities, etwa die `intersect`-Variante.
- **Dark Mode**: Wird über die Strategie `darkMode: "class"` erzwungen.

## Component Islands (Interaktivität)

React ist bewusst auf interaktive Elemente beschränkt, um die Performance hoch zu halten.

- **Strategie für die Nutzung**:
  - `client:load`: Kritische Interaktivität im direkt sichtbaren Bereich.
  - `client:idle`: Nicht kritische Interaktivität, etwa Suchfelder oder Tooltips.
  - `client:only="react"`: Bibliotheken, die sofort Browser-APIs benötigen, etwa Radix-UI-Komponenten.

## Suche und Auffindbarkeit

- **Engine**: Das Projekt verwendet **Pagefind** im `postbuild`-Schritt für performante statische
  Indizierung.
- **Alternative/Bestand**: **Fuse.js** ist weiterhin als Abhängigkeit vorhanden und wird
  voraussichtlich für spezielle Filter- oder Suchlogik innerhalb einzelner Komponenten genutzt,
  etwa in `EntryLayout`.

## Qualitätssicherung

- **Code**: ESLint und Prettier sind für TypeScript und Astro konfiguriert.
- **Prosa**: **Vale** ist zur sprachlichen Prüfung von Markdown-Inhalten eingebunden.

## Entscheidungen zur Dateistruktur

- **`src/content/`**: Alle Markdown- und MDX-Inhalte.
- **`src/components/base/`**: Basis-Komponenten wie globale Seiten-Wrapper.
- **`public/`**: Statische Assets, die Astro nicht verarbeitet, etwa generierte JSON-Daten.

## TypeScript-Muster für Content Collections

```typescript
import { getCollection } from "astro:content";
import type { BlogEntry } from "@/types";

const entries = (await getCollection("blog")) as BlogEntry[];
const published = entries.filter((e) => !e.data.draft);
```

**Wichtig**: Immer auf den spezifischen Typ casten (`BlogEntry`, `DocsEntry` usw.), um
Typsicherheit zu behalten.

## Algorithmus für ähnliche Einträge

`src/lib/similarItems.ts` - Content-basierte Empfehlungen:

- Matcht über `categories`- und `tags`-Arrays im Frontmatter
- Zählt Überschneidungen für das Ranking
- Wird für Bereiche wie "Related Posts" oder "You might also like" verwendet
- **Verwendung**: `similerItems(currentItem, allItems, currentItem.id)`

## Muster für statische Pfadgenerierung

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

## Verwendung von `BaseLayout` (Standard-Wrapper für Seiten)

Alle Seiten verwenden `BaseLayout.astro` für konsistente Meta-Tags, SEO und Theme-Switching:

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

Diese Komponenten sind in `astro.config.mjs` konfiguriert und MÜSSEN NICHT importiert werden:

- `<Button>` - Standard UI Button
- `<Accordion>`, `<Notice>`, `<Tabs>`, `<Tab>` - MDX Shortcodes
- **Ausnahme**: YouTube-Komponente temporär deaktiviert (ES-Module-Konflikt mit
  `react-lite-youtube-embed`)

## React-Island-Hydration-Strategie

- `client:load` → Sofort laden (nur für kritisch sichtbare UI wie `<Search>`)
- `client:idle` → Nach Browser-Idle laden (Standard für Interaktionen wie `<Swiper>`)
- `client:only="react"` → Nur clientseitig rendern (für Radix UI wie `<ScrollArea>`)

```astro
<ScrollArea className="h-full" client:only="react">
  <!-- Content -->
</ScrollArea>
```

## Typen für Content Collections

`src/types/index.d.ts` exportiert typsichere Wrapper für alle Collections:

```typescript
import type { BlogEntry, DocsEntry, AuthorsEntry } from "@/types";

// ✅ Richtig - typsicher
const posts = (await getCollection("blog")) as BlogEntry[];

// ❌ Falsch - kein Type-Checking
const posts = await getCollection("blog");
```

## Generischer Entry-Typ für flexible Funktionen

Für Utilities, die mehrere Collection-Typen unterstützen:

```typescript
import type { GenericEntry } from "@/types";

function processEntry(entry: GenericEntry) {
  // Works with any collection type
}
```
