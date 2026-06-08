---
description:
  "Verwenden beim Schreiben, Bearbeiten oder Refactoren von Astro-Komponenten, TypeScript-Modulen
  oder Page-Routes in diesem Astro-5- + TypeScript-Blog. Behandelt Komponentenstruktur,
  Routing-Regeln, Datenfluss, Imports und ESLint-Erwartungen."
applyTo: "src/**/*.{astro,ts,tsx,mts,cts}"
---

# Astro- & TypeScript-Konventionen

Dieses Projekt ist eine **statische Astro-5-Site** mit TypeScript, Tailwind CSS und
Cloudflare-Deployment. Halte Dich an die Architektur, die in
[`docs/15-write-structure.md`](../../docs/15-write-structure.md) dokumentiert ist.

## Schichten-Architektur (strikt)

1. **`src/pages/*.astro`** — nur Routing. Jede Page-Datei referenziert **genau ein Layout** und
   führt das gesamte Daten-Querying durch (z. B. `getCollection()`, Helper aus `src/lib/`).
2. **`src/components/<collection>/*.astro`** — Layout + Collection-spezifische UI.
3. **`src/components/common/`** — Collection-übergreifend wiederverwendbar; `shortcodes/` ist für
   die Verwendung **innerhalb** von `.mdx`-Content-Dateien.
4. **`src/components/base/BaseLayout.astro`** — umschließt jedes andere Layout. Hier lebt das
   site-weite Chrome.
5. **`src/lib/`** — reine TypeScript-Helper (Parsing, Sortierung, Redirects). Keine Astro-Imports.

Rufe **niemals** `getCollection()` aus Komponenten auf — gib die Daten als Props weiter.

## TypeScript

- Strict Mode ist aktiv (`tsconfig.json`). Vermeide `any` — ESLint warnt bei
  `@typescript-eslint/no-explicit-any`.
- Stelle bewusst ungenutzten Argumenten ein `_` voran (z. B. `(_event) => ...`), um
  `@typescript-eslint/no-unused-vars` zu erfüllen.
- Verwende die Zod-Schemas in [`src/content.config.ts`](../../src/content.config.ts) wieder — sie
  sind die einzige Quelle der Wahrheit für Collection-Formen. Leite Typen über
  `CollectionEntry<"blog">` aus `astro:content` ab, deklariere Frontmatter-Formen **nicht** neu.

## Imports

- Verwende den `@assets/...`-Alias für Bilder, die aus `.md`/`.mdx` referenziert werden; Astro löst
  ihn relativ zu `src/assets/` auf.
- Verwende relative Pfade innerhalb von `src/components/` für Geschwister-Komponenten.
- Importiere niemals aus `public/` — das sind Laufzeit-URLs (`/fonts/...`, `/data/...`).

## Astro-Komponenten-Stil

- `---`-Frontmatter: zuerst Imports, dann `Astro.props`-Destrukturierung, dann abgeleitete Daten.
- Bevorzuge `Astro.glob` / `getCollection` **nur in Pages**, nie in verschachtelten Komponenten.
- Nutze `<slot />` für Komposition statt HTML-Strings zu übergeben.
- Client-seitiges JS gehört in `<script>`-Blöcke; markiere sie nur dann mit `is:inline`, wenn Du
  bewusst auf das Bundling verzichten willst.

## Vermeide

- ❌ Lege keine neuen Top-Level-Ordner unter `src/` an, ohne
  [`docs/15-write-structure.md`](../../docs/15-write-structure.md) zu aktualisieren.
- ❌ Frage keine Daten in `components/` ab — Pages besitzen den Datenfluss.
- ❌ Bearbeite keine generierten Verzeichnisse: `dist/`, `.astro/`, `node_modules/`.
