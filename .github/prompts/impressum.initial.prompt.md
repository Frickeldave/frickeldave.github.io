---
agent: 'agent'
description: 'Migrate WordPress article to Astro MDX format'
model: Claude Sonnet 4.5 (copilot)
---


# GitHub Copilot Prompt: Impressum für frickeldave.github.io

## Kontext & Anforderungen

Du entwickelst eine Astro-Website mit dem Astrogon Theme. Die Website wird gehostet auf GitHub Pages und nutzt Cloudflare Analytics (ohne Cookies). Die Website enthält handgemachte Deko-Artikel als Nebeneinkommen, Anleitungen für DIY Projekte, Beschreibung von IT Projekte und §D Druck Anleitungen.

**Ziel:** Erstelle eine rechtlich sichere, deutschsprachige Impressum-Seite als Markdown-Datei für Astro, die alle TMG-Anforderungen erfüllt und automatisch das aktuelle Jahr einfügt.

- Erstelle die Datei unter `src/pages/impressum.astro` oder aktualisiere diese, falls sie bereits existiert
- Nutze das gleiche Glass Design und Theme wie der Rest der Seite (Astrogon Theme)
- Nutze Astro Frontmatter für Metadaten (title, description, layout)
- Verlinke das Impressum im Footer
- lass alle Linter laufen und stelle sicher dass keine Fehler geschmissen werden
- Checke die copilot-instructions.md datei für weitere details ab
- Starte den dev server lokal und lasse mich die Seite unter `/impressum/` sehen
- erstelle eine Branch und übernimm alle Änderungen in den neuen Branch
- Committe und Pushe
- Erstelle einen neuen PR, der den neuen Branch in den dev Branch merged

---

## Vorgaben

### Persönliche Daten (hartcodiert)

```
Name: Frickeldave (Kunstname registriert unter: David König)
Adresse: Bgm. Heimbrand Straße 10, 85413 Hörgertshausen
Telefon: 08541-114422
E-Mail: handmade@frickeldave.de
Geburtsjahr: 1979
Unternehmensform: Einzelunternehmer (Nebeneinkommen)
Tätigkeitsbereich: Handgemachte Deko-Artikel
```

### Rechtliche Anforderungen

- **Gesetzliche Grundlage:** Telemediengesetz (TMG) § 5 und § 7
- **Geltungsbereich:** Deutschland (Bayern, Hörgertshausen)
- **Typ:** Einzelunternehmer, Kleinunternehmer (kein Gewerbeamt-Eintrag erforderlich bei Nebeneinkommen)
- **Umsatzsteuer:** Keine USt-ID erforderlich (Kleinunternehmer-Regel)

### Technische Details

- **Hosting:** GitHub Pages
- **CDN/Analytics:** Cloudflare Analytics (nicht-invasiv, kein Cookie-Banner erforderlich)
- **Theme:** Astro mit Astrogon Theme
- **Zielformat:** Markdown (`.md`) für Astro Pages
- **Pfad:** `src/pages/impressum.md`
- **Sprache:** Deutsch (de)
- **Jahr:** Dynamisch via Astro-Frontmatter (z.B. `year: new Date().getFullYear()`)
- **URL:** `/impressum/`

### Externe Links & Social Media

Folgende Plattformen sollen verlinkt werden:
- GitHub Repository: https://github.com/Frickeldave/frickeldave.github.io
- Instagram: https://www.instagram.com/frickeldave.de/
- LinkedIn: https://www.linkedin.com/in/frickeldave/
- Facebook: https://www.facebook.com/david.konig.3557/

### Datenschutz & Haftung

- **Datenschutzerklärung:** Separater Link zu `./datenschutz` (wird später erstellt)
- **Cloudflare Analytics:** Wird erwähnt, aber KEIN Cookie-Banner nötig (Analytics setzt keine Cookies)
- **Externe Links:** Standard-Haftungsausschluss für verlinkter Inhalte
- **Theme-Attributionen:** Link zu Astro.build und Astrogon Theme

---

## Anforderungen an die Ausgabe

### Struktur

1. **Astro Frontmatter** mit Metadaten (title, description, layout)
2. **Hauptabschnitte:**
   - Angaben gemäß TMG
   - Kontaktinformationen
   - Verantwortlicher für Inhalte
   - Haftungsausschlüsse
   - Externe Links & Social Media
   - Hosting & Technische Informationen
   - Links zu Datenschutz & Rechtliches

3. **Styling:** Verwende Markdown-Standard, keine HTML-Tags (außer für semantische Struktur wenn nötig)

### Inhalts-Anforderungen

**Muss enthalten:**
- ✅ Vollständige Kontaktdaten (Name, Adresse, Telefon, E-Mail)
- ✅ Hinweis auf Kunstname & bürgerlichen Namen (minimal, wie vorgegeben)
- ✅ Verantwortlicher für redaktionelle Inhalte
- ✅ Haftungsausschluss für externe Inhalte und Links
- ✅ Hinweis auf Cloudflare Analytics
- ✅ Datenschutzerklärung-Link
- ✅ Hosting-Provider-Information (GitHub Pages)
- ✅ Theme-Attributions (Astro, Astrogon)
- ✅ Social-Media-Links (Instagram, LinkedIn, Facebook, GitHub)
- ✅ Copyright mit dynamischem Jahr
- ✅ Keine Erwähnung von Handelsregister oder USt-ID (nicht erforderlich bei Kleinunternehmer)

**Format:**
- Markdown mit H2/H3 Headings
- Listen für Kontaktdaten
- Paragraphen für Fließtext
- Links in Standard-Markdown-Format `[Text](URL)`

### Sicherheits- & Compliance-Anforderungen

- ✅ Keine persönlichen Daten außerhalb der Kontaktsektion exponieren
- ✅ E-Mail NICHT mit `mailto:` verlinken (Spam-Schutz)
- ✅ Abmahnungssicher nach deutschem Recht (TMG § 5, § 7)
- ✅ DSGVO-konform (Hinweis auf Cloudflare Analytics & Datenschutzerklärung)
- ✅ Regelmäßig aktualisierbar (Jahr automatisch, andere Daten wartbar)

---

## Aufgabe für GitHub Copilot

Erstelle eine Markdown-Datei (`impressum.md`) für Astro mit folgender Struktur:

### Astro Frontmatter

```yaml
---
title: "Impressum"
description: "Impressum von Frickeldave - Kontaktinformationen und rechtliche Hinweise"
layout: "../layouts/LegalLayout.astro"
lang: "de"
---
```

*(Falls `LegalLayout.astro` nicht existiert, nutze Default-Layout)*

### Markdown-Inhalt

Gliedere das Impressum nach folgenden Abschnitten:

1. **Introduktion:** Kurzer Satz zur Seite
2. **Herausgeber & Redaktion:** Kontaktdaten, Name, Kunstname-Hinweis
3. **Kontakt:** Telefon, E-Mail
4. **Verantwortlichkeit:** Wer ist für welche Inhalte verantwortlich?
5. **Haftungsausschluss:** Für externe Links und Inhalte von Dritten
6. **Cloudflare Analytics:** Hinweis auf nicht-invasive Analytics
7. **Datenschutzerklärung:** Link zur separaten Datenschutzseite
8. **Hosting & Technologie:** GitHub Pages, Cloudflare, Astro, Astrogon Theme
9. **Social Media & Links:** Instagram, LinkedIn, Facebook, GitHub
10. **Copyright:** Dynamisches Jahr mit `© [Jahr] Frickeldave`
11. **Letzte Aktualisierung:** Datum der letzten Änderung

### Stil & Ton

- **Professional** aber **freundlich** (nicht zu juristisch-steif)
- **Klar strukturiert** (gute Lesbarkeit)
- **Transparent** über Technologie & Datenschutz
- **Verständlich** für Nicht-Juristen

---

## Zusätzliche Hinweise für Copilot

### Was du NICHT tun solltest

- ❌ Keine HTML-Tags verwenden (außer Markdown-Standard)
- ❌ Keine Geburtsdatum vollständig angeben (nur Jahr: 1979)
- ❌ Keine Umsatzsteuer-ID erwähnen (nicht erforderlich)
- ❌ Keine Handelsregisternummer erwähnen (nicht erforderlich)
- ❌ Keine Cookie-Banner-Hinweise (nicht nötig bei Cloudflare Analytics allein)
- ❌ Keine überlangen juristischen Texte (verständlich halten)

### Best Practices

- ✅ Verwende `(1979)` oder `geb. 1979` statt vollständiges Geburtsdatum
- ✅ E-Mail nicht klickbar machen (Spam-Schutz): `handmade@frickeldave.de` (plain text)
- ✅ Links zu externen Seiten mit `target="_blank"` wenn möglich (via HTML-Link in Markdown)
- ✅ Klare Trennlinien zwischen Abschnitten
- ✅ Responsive Design bedenken (Markdown wird vom Layout gerendert)

### Update-Strategie

Diese Datei wird **manuell updated**, wenn sich Daten ändern:
- **Kontaktdaten:** Direkt in der Markdown-Datei ändern
- **Jahr:** Wird automatisch via Astro-Frontmatter aktualisiert (falls implementiert)
- **Datenschutzerklärung-Link:** Manuell aktualisieren, wenn separate Seite existiert

---

## Beispiel-Struktur (Vorschlag)

```markdown
---
title: "Impressum"
description: "Impressum von Frickeldave"
layout: "../layouts/PageLayout.astro"
---

# Impressum

Angaben gemäß § 5 TMG und § 7 Abs. 1 TMG.

## Herausgeber & Redaktion

**Frickeldave**  
(Kunstname registriert unter: David König)

Bgm. Heimbrand Straße 10  
85413 Hörgertshausen  
Deutschland

## Kontakt

**Telefon:** 08541-114422  
**E-Mail:** handmade@frickeldave.de

## Verantwortlicher für Inhalte

Verantwortlich für die Inhalte dieser Website ist:  
Frickeldave (David König)

## Haftungsausschluss

...

[weitere Abschnitte]
```

---

## Zielkriterien für die fertige Datei

- [ ] TMG-konform (§ 5, § 7)
- [ ] Alle Kontaktdaten vorhanden
- [ ] Kunstname-Hinweis integriert
- [ ] Externe Links erwähnt
- [ ] Datenschutzerklärung verlinkt
- [ ] Hosting-Provider genannt
- [ ] Cloudflare Analytics erwähnt
- [ ] Social-Media-Links integriert
- [ ] Copyright mit dynamischem Jahr
- [ ] Abmahnungssicher
- [ ] DSGVO-konform
- [ ] Wartbar & regelmäßig updatebar
- [ ] Verständlich & nicht überladend

---

## Ausgabe

**Format:** Markdown (`.md`)  
**Zielort:** `src/pages/impressum.md` (Astro)  
**Encoding:** UTF-8  
**Dateigröße:** ~3-5 KB erwartet

---

## Ende des Prompts

Sobald die Datei erstellt ist, kannst du sie mit `astro build` testen und unter `/impressum/` abrufen.

Bei Änderungen: Diesen Prompt verwenden mit aktualisierten Daten.
