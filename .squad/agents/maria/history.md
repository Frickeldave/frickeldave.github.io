# Maria History

- 2026-06-30: Agent initialized for project frickeldave.github.io.
- 2026-06-30: Identity set to Maria (Hill), role Technical Writer/Documentation Specialist.
- 2026-06-30: Owner context: David Koenig.
- 2026-06-30: Stack context: Astro 7, TypeScript, Tailwind CSS 4.
# Maria Hill — History

## 2026-07-16

- Team aufgesetzt mit Marvel Cinematic Universe Casting
- Projekt: frickeldave.github.io — deutsche Textqualität

## 2026-08-25

- Issue #266: Humanizer Skill gebaut — `.squad/skills/humanizer/SKILL.md` (163 Zeilen, Deutsch + Englisch)
- Quellen konsolidiert & dedupliziert: Daves manuelle Regeln, Wikipedia "Signs of AI writing", blader/humanizer, oneaway.io/skills/humanizer
- Read-only Validierung gegen `src/content/blog/2026-08-23-souveränität-jenseits-cloud-washing.mdx` — Artikel unverändert
- Ergebnis: Skill von Tony final freigegeben; kein Commit/Push
- Humanizer-Skill auf `src/content/blog/2026-08-23-souveränität-jenseits-cloud-washing.mdx` angewendet (vollständiger Muster-Scan über alle Skill-Abschnitte)
- Ergebnis: keine echten KI-Marker gefunden — Artikel NICHT verändert (bewusst keine Verschlimmbesserung; Stimme aus Humor, Widerspruch und Ich-Perspektive bereits sauber)
- Verifiziert: kein Hedging (könnte/dürfte/denkbar), keine Kopula-Verben (bietet/dient als/markiert/fungiert), keine Em-Dashes in Prosa, alle Anführungszeichen deutsch „…", keine geraden Quotes in Prosa, keine KI-Triggerwörter (unterstreicht/hervorhebend/verdeutlicht etc.)
- „nicht nur … sondern“-Stellen tragen alle echten konkreten Kontrast (CLOUD-Act-Zugriff, Backup-Standort, S3-Prüftiefe, Kompetenzquelle) → laut Skill erlaubt, nicht umgeschrieben
- Frontmatter, Import-Zeile, Mermaid-Diagramm, Linkziele und Quellenliste unangetastet verifiziert
- Humanizer-Skill v1.0.0 → v1.1.0: `description` entschärft (kein Detector-Pass als Garantie; messbare Checks als Hilfsmittel), Version im Frontmatter erhöht
- Teil A integriert (16 Regeln aus KI-Anteil-Bewertung, Deutsch, im Skill-Ton): Symmetrie-Zählung, Listen-Schwellwert, Konjunktiv-II-Trennung, Stil-Referenz-Reichweite, Anapher-Check, Negations-Dreierliste, Triggerwort-Schwelle, Satzlängen-Varianz, Fach-/Mode-Anglizismus, didaktische Beispiele, frische vs. formelhafte Metapher, „bietet"-Differenzierung, „entscheidend ist"-Klarstellung, Scan-Ausnahmen, Regionalismus-Liste
- Teil B als neuer Abschnitt „Messbare Kontrolle (Stylometrie & Feedback-Loop)" zwischen Output Format und Sources eingefügt (Stylometrie-Band, Detector-Feedback-Loop mit False-Positive-Kalibrierung, verblindeter A/B-Gegencheck, Perplexity-Delta, Spezifität statt Detector-Pass, Risk-Acceptance) — advisory, keine Erfolgsgarantie
- Nur die Skill-Datei angefasst; keine externen Fakten/URLs erfunden, kein Commit, kein Terminal-Befehl
- Hinweis an mich: 13 parallele Edits an derselben Datei liefen gegeneinander und korrumpierten mehrere Abschnitte; sequentielle Reparatur in 11 Einzelschritten nötig — künftig Edits an einer Datei strikt nacheinander
## 2026-08-27

- Formatierungs-Standard in Charter verankert (Abschnitt „Formatierung & Editor-Lesbarkeit"): Prosa intelligent auf ~90-110 Zeichen pro Zeile umbrechen (nicht zu frueh), Leerzeilen nur zwischen logischen Absaetzen bzw. wo Markdown sie verlangt — keine Leerzeilen innerhalb umgebrochener Absaetze, keine doppelten Leerzeilen; URLs/Code/Mermaid/Tabellen/Frontmatter nicht teilen. Gilt fuer docs/ und src/content/.
- Artikel `src/content/blog/2026-08-23-souveränität-jenseits-cloud-washing.mdx` einmalig auf den Standard umgebrochen (Fliesstexte, Blockzitate, lange Listeneintraege), Struktur (Frontmatter, Mermaid, Tabelle, Quellen, Linkziele) unangetastet.
- 2026-08-27: Umbruch des Artikels auf 90-110 Zeichen verfeinert (vorher zu frueh bei ~70-80 umgebrochen); Inhalt per normalisiertem Vergleich als 100 % identisch verifiziert (nur Zeilenumbrueche geaendert, keine Textveraenderung).

## 2026-08-28

- Issue #267: Skill `.squad/skills/ai-content-score/SKILL.md` v1.0.0 erstellt — bewertet den KI-Anteil von Blog-Prosa (humanShare 0-100) und läuft IMMER als letzter Schritt nach jeder Artikel-Schreib- oder Update-Arbeit; Raster mit KI-Signal-Abzügen aus den Humanizer-KI-Marker-Listen und Schutz durch menschliche Signale; Schwellen grün >70 / gelb 30-70 / rot <30; Dokumentationspflicht: `aiTransparency`-Frontmatter (humanShare, model, confidence, evaluatedAt); Konfidenz hoch/mittel/niedrig; Tabelle + Balken rendert automatisch die `AiTransparency`-Komponente in `EntryLayout.astro` — Maria schreibt die Tabelle nie von Hand in den Artikelkörper; Erklaerseite `/blog/ki-text-erkennung/`.
- Neuen Artikel `src/content/blog/2026-08-28-wie-ki-generierter-text-erkannt-wird.mdx` erstellt (Kategorie AI, slug `ki-text-erkennung`, ~670 Wörter, humanisiert) mit ehrlichem `aiTransparency` (humanShare 50, Konfidenz hoch — Provenienz bekannt: LLM-Entwurf + Humanizer).
- Backfill: alle 40 `.mdx`-Dateien in `src/content/blog/` gelesen, bewertet und `aiTransparency` ergänzt: 37 x 95/hoch (Bestand 2019-2023), 1 x 90/mittel (2024-09-14), 1 x 82/mittel (2026-08-03, gemischte Signale), 1 x 88/hoch (2026-08-23, humanizer-verifiziert).
- Rubrik-Kurzfassung: Startwert 100, Abzüge für Marker-Cluster (KI-Vokabular, Sprach-, Inhalts-, Stil-Muster, Hedging), Schutz durch Ich-Stimme/Humor/unregelmäßigen Rhythmus/belegte Fakten. Nur bewertet und Frontmatter gepflegt — keine Prosa verändert.