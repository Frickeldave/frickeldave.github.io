---
trigger: manual
---

# GitHub Copilot Prompt: Impressum für frickeldave.github.io

## Kontext & Anforderungen

Du entwickelst eine Astro-Website mit dem Astrogon Theme. Die Website wird gehostet auf GitHub Pages
und nutzt Cloudflare Analytics (ohne Cookies). Die Website enthält handgemachte Deko-Artikel als
Nebeneinkommen, Anleitungen für DIY Projekte, Beschreibung von IT Projekte, 3D Druck Anleitungen und
mein Portfolio.

**Ziel:** Eine rechtlich sichere, deutschsprachige Impressum-Seite als Markdown-Datei für Astro, die
alle gesetzlichen Anforderungen erfüllt und automatisch das aktuelle Jahr einfügt. Nutze
https://www.gesetze-im-internet.de/ddg/__5.html als Referenz für die rechtlichen Anforderungen in
Deutschland.

- Nutze die Datei unter `src/pages/impressum.astro` oder aktualisiere diese, falls sie bereits
  existiert
- Nutze das gleiche Glass Design und Theme wie der Rest der Seite (Astrogon Theme)
- Nutze Astro Frontmatter für Metadaten (title, description, layout)
- Verlinke das Impressum im Footer
- lass alle Linter laufen und stelle sicher dass keine Fehler geschmissen werden
- Starte den dev server lokal und lasse mich die Seite unter `/impressum/` sehen

---

## Vorgaben

### Persönliche Daten (hartcodiert)

```
Name: Frickeldave (Kunstname registriert unter: David König)
Adresse: Bgm. Heimbrand Straße 10, 85413 Hörgertshausen
Telefon: +49 8764 9490205
E-Mail: handmade@frickeldave.de
Geburtsjahr: 1979
Unternehmensform: Einzelunternehmer (Nebeneinkommen)
Tätigkeitsbereich: Handgemachte Deko-Artikel
```

### Rechtliche Anforderungen

- **Geltungsbereich:** Deutschland (Bayern, Hörgertshausen)
- **Typ:** Einzelunternehmer, Kleinunternehmer (kein Gewerbeamt-Eintrag erforderlich bei
  Nebeneinkommen)
- **Umsatzsteuer:** Keine USt-ID erforderlich (Kleinunternehmer-Regel)

### Technische Details

- **Hosting:** GitHub Pages
- **CDN/Analytics:** Cloudflare Analytics (nicht-invasiv, kein Cookie-Banner erforderlich)
- **Theme:** Astro mit Astrogon Theme
- **Sprache:** Deutsch (de)
- **Jahr:** Dynamisch via Astro-Frontmatter (z.B. `year: new Date().getFullYear()`)
- **URL:** `/impressum/`

### Externe Links & Social Media

Folgende Plattformen sollen verlinkt werden:

- GitHub Repository: https://github.com/Frickeldave/frickeldave.github.io
- Instagram: https://www.instagram.com/frickeldave.de/
- LinkedIn: https://www.linkedinhttps://www.gesetze-im-internet.de/ddg/__5.html.com/in/frickeldave/
- Facebook: https://www.facebook.com/david.konig.3557/

### Datenschutz & Haftung

- **Datenschutzerklärung:** Separater Link zu `./datenschutz` (wird später erstellt)
- **Cloudflare Analytics:** Wird erwähnt, aber KEIN Cookie-Banner nötig (Analytics setzt keine
  Cookies)
- **Externe Links:** Standard-Haftungsausschluss für verlinkter Inhalte
- **Theme-Attributionen:** Link zu Astro.build und Astrogon Theme

**Format:**

- Markdown mit H2/H3 Headings
- Listen für Kontaktdaten
- Paragraphen für Fließtext
- Links in Standard-Markdown-Format `[Text](URL)`

### Sicherheits- & Compliance-Anforderungen

- ✅ Keine persönlichen Daten außerhalb der Kontaktsektion exponieren
- ✅ E-Mail NICHT mit `mailto:` verlinken (Spam-Schutz)
- ✅ Abmahnungssicher nach deutschem Recht https://www.gesetze-im-internet.de/ddg/__5.html
- ✅ DSGVO-konform (Hinweis auf Cloudflare Analytics & Datenschutzerklärung)
- ✅ Regelmäßig aktualisierbar (Jahr automatisch, andere Daten wartbar)
