---
description:
  "Verwenden beim Erstellen oder Bearbeiten von Markdown-/MDX-Inhalten unter src/content/
  (Blog-Posts, Docs, Handmade, Downloads, Recipes, Aboutme, Authors). Definiert Pflicht-Frontmatter,
  Draft-Workflow und deutsche Content-Konventionen."
applyTo: ["src/content/**/*.md", "src/content/**/*.mdx", "_drafts/**/*.md"]
---

# Content- & Frontmatter-Regeln

Das maßgebliche Schema für jede Collection lebt in
[`src/content.config.ts`](../../src/content.config.ts) (Zod). **Erfinde keine Felder** — wenn Du ein
neues brauchst, erweitere zuerst das Schema.

## Universelles Frontmatter (durchsuchbare Collections)

Die meisten Collections erweitern das `searchable`-Schema:

```yaml
---
title: "Pflichtfeld als String"
description: "Kurze Zusammenfassung (optional, aber für SEO empfohlen)"
autodescription: true # Default true — automatisch erzeugen, wenn description fehlt
draft: false # true verbirgt vom Build
visible: true # MUSS true sein, damit der Eintrag auf der Site erscheint
---
```

> ⚠️ `visible: false` (der Default) bedeutet, dass der Eintrag **nicht gerendert wird**. Setze
> `visible: true` immer, wenn der Inhalt veröffentlicht werden soll.

## Collection-spezifische Pflichtfelder

| Collection | Zusätzliche Pflicht-/häufige Felder                                                             |
| ---------- | ----------------------------------------------------------------------------------------------- |
| `blog`     | `date`, `image`, `imageAlt`, `author` (Reference), `categories[]`, `tags[]`, `complexity` (1–5) |
| `docs`     | `pubDate`, optional `modDate`, `hideToc`, `hideNav`                                             |
| `handmade` | siehe Schema — verwendet Kategorie-Labels aus `src/lib/handmadeCategoryLabels.ts`               |
| `authors`  | `email`, `image`, `imageAlt`, `social`-Objekt                                                   |

## Drafts

- Posts in Arbeit liegen in **`/_drafts/`** im Repo-Root — sie sind vom Astro-Content-Glob
  ausgeschlossen und werden nicht gebaut.
- Wenn veröffentlicht werden soll: verschiebe die Datei in den passenden
  `src/content/<collection>/`-Ordner, ergänze vollständiges Frontmatter, setze `visible: true` und
  referenziere Assets über `@assets/...`.

## Schreibstil (deutsche Inhalte)

Dies ist eine **deutschsprachige** Site. Alle benutzerseitigen Inhalte werden auf Deutsch in der
informellen **"Du"**-Ansprache geschrieben. Wende diese Workflow-Skills an:

- [Skill `consistentaddress`](../skills/consistentaddress/SKILL.md) — immer "Du / Dein / Dich", nie
  "Sie / Ihr".
- [Skill `genderneutral`](../skills/genderneutral/SKILL.md) — inklusive Sprache.
- Nur für `src/content/docs/`: zusätzlich [Skill `docspedagogy`](../skills/docspedagogy/SKILL.md)
  anwenden.

Englische Inhalte liegen unter `src/content/en/` und folgen den dort üblichen englischen
Konventionen.

## Kategorien, Tags & Taxonomie

- Tags und Kategorien sind freie Strings, müssen aber **kebab-case und kleingeschrieben** sein (z.
  B. `3d-druck`, `holz`, `agile`).
- Verwende vorhandene Begriffe wieder — prüfe `src/lib/taxonomyParser.ts` und bestehende Posts,
  bevor Du einen neuen erfindest.
- Siehe [`docs/14-categories-and-tags.md`](../../docs/14-categories-and-tags.md) (in Arbeit).

## Dateinamen

- Markdown-Dateinamen: kebab-case, keine Datumsangaben im Dateinamen (das Datum lebt im
  Frontmatter).
- Ein Ordner pro Blog-Post, wenn dieser eigene Assets hat: `src/content/blog/mein-post/index.md` +
  `src/assets/blog/mein-post/cover.jpg`.
