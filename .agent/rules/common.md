---
trigger: always_on
---

## Wichtige Hinweise

- **Sprache**: Alle Kommentare und Dokumentationen müssen auf Englisch verfasst sein.
- **Code-Kommentare**: Auch Code-Kommentare müssen auf Englisch sein.
- **Variablennamen**: Variablennamen müssen Englisch sein.
- **Beim starten einer Session**: Immer zuerst `Hallo Dave!` sagen, damit ich sehe, du hast diese
  Daten gelesen.

## Projektübersicht

**Frickeldave** ist eine Astro 5.13-basierte Multi-Content-Plattform (Blog, Docs, Recipes, Handmade,
Aboutme) mit statischer Site-Generierung für GitHub Pages. Das Projekt kombiniert
TypeScript-typisierte Content Collections, React Islands für Interaktivität, und ein custom Glass
Morphism Design System.

## Linting

Nach jedem change Frage mich, ob die Änderung OK ist und ob das Linting gestartet werden soll.

### Development Workflow

```bash
npm run dev          # Dev Server auf Port 4321
npm run build        # Production Build
npm run postbuild    # Pagefind Search Index (automatisch nach build)
```

## Architecture

Alle Architektur-Entscheidungen sind in @/docs/40-architecture-decisions.md dokumentiert.

## Styleguide

Alle Styleguides sind in @/docs/20-design-system.md beschrieben

## Deployment Workflow

- `deploy-dev.yml` - automatisches Deployment nach `dev` -> TEST Container im internen Netz
- `deploy-prd.yml` - automatisches Deployment nach `main` -> Produktion
- Self-hosted Runner auf `frickeldave-main` Label

## Link-Redirect-System (Custom Implementation)

**Problem**: GitHub Pages unterstützt keine dynamischen Routen  
**Lösung**: Statische `/redirect/` Seite + Client-side Routing

- `/public/data/link-mappings.json` - Zentrale Link-Registry mit Analytics (Clicks,
  Affiliate-Tracking)
- `/public/js/redirect-handler.js` - Client-side Router für `/redirect/[id]` URLs
- `src/lib/redirectService.ts` - Build-time Service zum Lesen/Schreiben von Mappings
- **Usage**: Generiere Affiliate-Links, Short-URLs, Track-bare Links

## Prompt Speicherung

Speichere alle Prompts in @/docs/31-prompt-summary.md für zukünftige Referenz und
Wiederverwendbarkeit in der Tabelle.

- Hinterlege das Datum, den eingegebenen Prompt und das verwendete Modell |Date|Prompt|model|.
- Wenn der Prompt in einer prompt-Datei oder agent rule gespeichert ist, verweise auf den Dateipfad
  anstelle des gesamten Prompts.
- Ist der Prompt länger als 500 Zeichen, erstelle eine Datei in
  .github/prompts/chats/yyyy-mm-dd-<titel>.md und verweise auf diese Datei.
