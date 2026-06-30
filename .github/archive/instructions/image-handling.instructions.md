---
description:
  "Verwenden beim Hinzufügen, Verschieben, Optimieren oder Referenzieren von Bildern, Fotos,
  Illustrationen, Screenshots oder Cover-/Hero-Bildern für Blog-Posts, Docs, Handmade-Projekte oder
  beliebige Inhalte. Behandelt Asset-Pfade, Formate, Alt-Texte und Bildnachweis nach deutschem UrhG."
---

# Bild-Handling

Vollständige Referenz: [`docs/16-write-image-handling.md`](../../docs/16-write-image-handling.md). Kurzfassung
für die tägliche Arbeit:

## Wohin mit der Datei

| Anwendungsfall                                  | Ordner                                  |
| ----------------------------------------------- | --------------------------------------- |
| Cover-/Inline-Bilder für Content-Einträge       | `src/assets/<collection>/<entry-slug>/` |
| Favicons                                        | `public/favicon/`                       |
| Schriftarten                                    | `public/fonts/`                         |
| Herunterladbare Dateien (PDF, Visio, Lightburn) | `public/downloads/`                     |

❌ Lege Content-Bilder niemals in `public/` ab — sie umgehen Astros Bildoptimierung.

## Wie referenzieren

- **In Markdown-/MDX-Frontmatter** — den `@assets/...`-Alias verwenden:
  ```yaml
  image: "@assets/blog/mein-post/cover.jpg"
  imageAlt: "Beschreibung auf Deutsch, was zu sehen ist"
  ```
- **In Astro-Komponenten** — das Asset importieren und `<Image />` aus `astro:assets` nutzen:
  ```astro
  import {Image} from "astro:assets"; import cover from "@assets/blog/mein-post/cover.jpg";
  ```
- **Im MDX-Body** — bevorzuge den projekt-eigenen `Image`-Shortcode in
  `src/components/common/shortcodes/` gegenüber rohem `<img>`.

## Pflicht-Metadaten

- Jedes `image:`-Feld braucht ein zugehöriges `imageAlt:` (deutsch, beschreibend, was zu sehen ist).
- Rein dekorativ: `imageAlt: ""`.
- Hero-Bilder: lange Kante ≥ 1600 px; Body-Bilder ~1200 px reichen.
- Dateien unter ~500 KB halten; bevorzuge WebP/AVIF als Quellformat.

## Recht — Bildnachweis (Pflicht bei Fremdbildern)

Das deutsche UrhG verlangt eine Attribution für jedes Bild, das nicht Dein eigenes ist. Wenn Du ein
solches Bild hinzufügst:

1. Trage den Nachweis auf der **Bildnachweis**-Seite ein (`src/content/terms/`).
2. Gib Quelle, Urheber und Lizenz-Link an.
3. KI-generierte Bilder: in der Bildunterschrift markieren (z. B. "Bild generiert mit …").

Siehe den [Skill `compliancechecker`](../skills/compliancechecker/SKILL.md) für die
Audit-Checkliste.

## Beispiel-Ordnerstruktur

```
src/content/blog/mein-post/index.md          ← Inhalt
src/assets/blog/mein-post/cover.jpg          ← Hero
src/assets/blog/mein-post/step-01.jpg        ← Inline
```
