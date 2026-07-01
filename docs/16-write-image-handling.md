# Bild-Handling

Dieses Dokument beschreibt, wie Bilder auf der Frickeldave-Site gespeichert, referenziert, optimiert
und mit Quellenangaben versehen werden.

## Inhaltsverzeichnis

## Wo Bilder liegen

| Pfad                       | Zweck                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------- |
| `src/assets/<collection>/` | Alle Bilder, die **in Seiten eingebettet** werden — von Astro zur Build-Zeit optimiert |
| `public/favicon/`          | Favicons (roh, keine Verarbeitung)                                                     |
| `public/fonts/`            | Web-Schriftarten                                                                       |
| `public/downloads/`        | Herunterladbare Dateien (Visio, Lightburn etc.)                                        |

## `src/assets/` vs. `public/`

- **`src/assets/`** — Astro liest `image:`-Felder im Frontmatter über den `image()`-Helper, der in
  [`src/content.config.ts`](../src/content.config.ts) deklariert ist. Dateien hier werden gehasht,
  in moderne Formate konvertiert und automatisch lazy geladen.
- **`public/`** — wird unverändert in den Build-Output kopiert. Nur für Dateien, die ihren exakten
  Dateinamen und Pfad behalten müssen (Favicons, Schriftarten, Downloads, JSON-Datendateien).

> ⚠️ Lege **niemals** Content-Bilder in `public/` ab — Du verlierst Optimierung und Asset-Hashing.

## Bilder referenzieren

### Aus Markdown/MDX (`@assets/...`)

In einem Blog-Post-Frontmatter:

```yaml
---
title: "Mein Projekt"
image: "@assets/blog/3d-druck/cover.jpg"
imageAlt: "3D-gedruckter Vogelfutterspender auf einer Werkbank"
---
```

Innerhalb des Bodys einer `.mdx`-Datei bevorzuge den projekt-eigenen `Image`-Shortcode (in
`src/components/common/shortcodes/`) gegenüber einem rohen `<img>`.

### Aus Astro-Komponenten

```astro
---
import { Image } from "astro:assets";
import cover from "@assets/blog/mein-post/cover.jpg";
---

<Image src={cover} alt="…" widths={[400, 800, 1200]} />
```

## Formate & Größen

- Bevorzuge **WebP** oder **AVIF** als Quelle — Astro re-encodiert ohnehin, aber die Quelle lädt in
  Editoren bereits schnell.
- Hero-/Cover-Bilder: lange Kante ≥ 1600 px.
- Inline-Body-Bilder: lange Kante ~1200 px reicht völlig; lass Astro kleinere responsive Varianten
  erzeugen.
- Halte einzelne Dateien vor dem Commit unter ~500 KB. Entferne EXIF-Daten (z. B. mit
  `exiftool -all=`).

## Alt-Text (`imageAlt`)

- Jedes `image:`-Frontmatter-Feld hat ein zugehöriges `imageAlt:` — fülle beide.
- Schreibe beschreibenden deutschen Alt-Text (diese Site ist deutsch-zuerst). Beschreibe, **was zu
  sehen ist**, nicht den Dateinamen.
- Rein dekorative Bilder: leerer String `imageAlt: ""` (der Schema-Default).

## Bildnachweis

Das deutsche Urheberrechtsgesetz (UrhG) verlangt eine Attribution für Fremdbilder.

- Eigene Fotos: keine Attribution erforderlich, optional Selbstnennung in der Bildunterschrift.
- Fremd-/Stock-Bilder: Nachweis auf der **Bildnachweis**-Seite (`src/content/terms/` —
  Impressum-/Rechtsbereich). Mit Quelle, Urheber, Lizenz-Link.
- KI-generierte Bilder: als solche kennzeichnen ("Bild generiert mit …") in der Bildunterschrift.

Siehe den [Skill `compliancechecker`](../.github/archive/skills/compliancechecker/SKILL.md) für die
vollständige Audit-Checkliste.

## Konventionen für die Ordnerstruktur

- Ein Ordner pro Content-Eintrag, wenn dieser eigene Bilder hat:

  ```
  src/content/blog/mein-post/index.md
  src/assets/blog/mein-post/cover.jpg
  src/assets/blog/mein-post/step-01.jpg
  src/assets/blog/mein-post/step-02.jpg
  ```

- Geteilte/generische Bilder für eine Collection liegen direkt im Collection-Asset-Ordner (z. B.
  `src/assets/blog/emmy-noether.jpg`).
