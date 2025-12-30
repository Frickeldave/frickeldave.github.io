---
agent: 'agent'
description: 'Migrate WordPress article to Astro MDX format'
model: Claude Sonnet 4.5 (copilot)
---


# GitHub Copilot Prompt: Impressum für frickeldave.github.io

## Kontext & Anforderungen

Du entwickelst eine Astro-Website mit dem Astrogon Theme. Die Website wird gehostet auf GitHub Pages und nutzt Cloudflare Analytics (ohne Cookies). Die Website enthält handgemachte Deko-Artikel als Nebeneinkommen, Anleitungen für DIY Projekte, Beschreibung von IT Projekte und 3D Druck Anleitungen.

**Ziel:** Erstelle eine rechtlich sichere, deutschsprachige Datenschutz-Seite als Markdown-Datei für Astro, die alle DSGVO-Anforderungen erfüllt und automatisch das aktuelle Jahr einfügt.

- Erstelle die Datei unter `src/pages/datenschutz.astro` oder aktualisiere diese, falls sie bereits existiert
- Separater Link zu `./impressum`
- Nutze das gleiche Glass Design und Theme wie der Rest der Seite (Astrogon Theme)
- Nutze Astro Frontmatter für Metadaten (title, description, layout)
- Verlinke die Datenschutz-Seite im Footer
- lass alle Linter (lint, format, prose) laufen und stelle sicher dass keine Fehler geschmissen werden
- Checke die copilot-instructions.md datei für weitere details ab
- Starte den dev server lokal und lasse mich die Seite unter `/datenschutz/` sehen und warte auf mein Feedback
- erstelle eine Branch und übernimm alle Änderungen in den neuen Branch
- Committe und Pushe
- Erstelle einen neuen PR, der den neuen Branch in den dev Branch merged
- Wechsel am Ende in den dev Branch zurück


Ich verwende für das Hosting auf der Seite:
- **Cloudflare**
- **GitHub Pages**

---

## Anforderungen an die Ausgabe

### Struktur

1. **Astro Frontmatter** mit Metadaten (title, description, layout)
2. **Hauptabschnitte:**
   - Verantwortlicher und Kontakte
   - Erfasste Daten und Zwecke
   - Weitergabe und Speicherung
   - Betroffenenrechte

**Format:**
- Markdown mit H2/H3 Headings
- Listen für Kontaktdaten
- Paragraphen für Fließtext
- Links in Standard-Markdown-Format `[Text](URL)`

### Sicherheits- & Compliance-Anforderungen

- ✅ Keine persönlichen Daten außerhalb der Kontaktsektion exponieren
- ✅ E-Mail NICHT mit `mailto:` verlinken (Spam-Schutz)
- ✅ Abmahnungssicher nach deutschem Recht
- ✅ DSGVO-konform
- ✅ Regelmäßig aktualisierbar (Jahr automatisch, andere Daten wartbar)

### Stil & Ton

- **Professional** aber **freundlich** (nicht zu juristisch-steif)
- **Klar strukturiert** (gute Lesbarkeit)
- **Transparent** über Technologie & Datenschutz
- **Verständlich** für Nicht-Juristen
