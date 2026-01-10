---
agent: 'agent'
description: 'Migrate WordPress article to Astro MDX format'
model: Auto (copilot)
---


# GitHub Copilot Prompt: Impressum für frickeldave.github.io

## Kontext & Anforderungen

Du entwickelst eine Astro-Website mit dem Astrogon Theme. Die Website wird gehostet auf GitHub Pages und nutzt Cloudflare Analytics (ohne Cookies). Die Website enthält handgemachte Deko-Artikel als Nebeneinkommen, Anleitungen für DIY Projekte, Beschreibung von IT Projekte, 3D Druck Anleitungen und mein Portfolio.

**Ziel:** Erstelle eine rechtlich sichere, deutschsprachige Impressum-Seite als Markdown-Datei für Astro, die alle gesetzlichen Anforderungen erfüllt und automatisch das aktuelle Jahr einfügt. Nutze https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32016R0679 als Referenz für die rechtlichen Anforderungen in Deutschland.


- Nutze das gleiche Glass Design und Theme wie der Rest der Seite (Astrogon Theme)
- Nutze Astro Frontmatter für Metadaten (title, description, layout)
- Verlinke das Impressum im Footer
- lass alle Linter laufen und stelle sicher dass keine Fehler geschmissen werden
- Checke die copilot-instructions.md datei für weitere details ab
- Starte den dev server lokal und lasse mich die Seite unter `/datenschutz/` sehen


Ich verwende für das Hosting auf der Seite:
- **Cloudflare**
- **GitHub Pages**

---

## Technische Details

- **Hosting:** GitHub Pages
- **CDN/Analytics:** Cloudflare Analytics (nicht-invasiv, kein Cookie-Banner erforderlich)
- **Theme:** Astro mit Astrogon Theme
- **Sprache:** Deutsch (de)
- **Jahr:** Dynamisch via Astro-Frontmatter (z.B. `year: new Date().getFullYear()`)
- **URL:** `/datenschutz/`

**Format:**
- Markdown mit H2/H3 Headings
- Listen für Kontaktdaten
- Paragraphen für Fließtext
- Links in Standard-Markdown-Format `[Text](URL)`

### Sicherheits- & Compliance-Anforderungen

- ✅ Keine persönlichen Daten außerhalb der Kontaktsektion exponieren
- ✅ E-Mail NICHT mit `mailto:` verlinken (Spam-Schutz)
- ✅ Abmahnungssicher nach deutschem Recht https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32016R0679
- ✅ DSGVO-konform (Hinweis auf Cloudflare Analytics/GitHub & Datenschutzerklärung)
- ✅ Regelmäßig aktualisierbar (Jahr automatisch, andere Daten wartbar)