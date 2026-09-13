---
name: ai-content-score
version: 1.0.0
description:
  Bewertet nach jeder Artikel-Schreib- oder Update-Arbeit den KI-Anteil der Blog-Prosa (humanShare
  0-100) und pflegt das aiTransparency-Objekt im Frontmatter. Läuft immer als letzter Schritt.
---

# ai-content-score — KI-Anteil von Blog-Prosa bewerten

## Zweck

Dieser Skill bewertet, wie viel des Prosatexts eines Blog-Artikels KI-generiert ist. Ergebnis ist der
menschliche Anteil (humanShare) von 0 bis 100. Er läuft IMMER als letzter Schritt, nach allen Schreib-
und Update-Arbeiten an einem Artikel — nie zwischendurch und nie vor dem Humanizer-Schritt. Die Bewertung
ändert keine Prosa; sie dokumentiert nur. Verpflichtende Lesereihenfolge: erst
`.squad/skills/humanizer/SKILL.md` (Stilreferenz), dann dieser Skill.

## Bewertungsraster

Startwert: 100 (menschlich). Für gefundene KI-Signale wird abgezogen, klare menschliche Signale schützen
gegen Abzug. Nicht bewertet werden: Frontmatter, Code, Tabellen, Mermaid-Diagramme, Quellenlisten,
Bildunterschriften und Bildpfade. Die Signal-Listen stammen aus dem Humanizer (KI-Marker):

### KI-Signale (Abzug)

1. **KI-Vokabular** (Triggerwort-Listen des Humanizers, GPT-4-/4o-/5-Ära): ab ~5 Treffern pro 1000 Wörter
   starkes Signal; 1–2 Treffer sind Rauschen. (−10 bis −25)
2. **Sprachmuster:** Kopula-Konstruktionen („bietet", „dient als", „markiert"), vage Verbindungen, negative
   Parallelismen, Anapher-Reihen (≥3 gleiche Satzanfänge), erzwungene Dreiergruppen, Synonym-Zyklen, False
   Agency, Passiv ohne Subjekt. (−5 bis −20)
3. **Inhaltliche Muster:** aufgeblasene Bedeutung, Namedropping, -ing/-end-Partizip-Phrasen, Weasel Words,
   formelhafte „Herausforderungen & Ausblick"-Blöcke, Pauschalbehauptungen (immer/nie/jeder), vage
   Beispiele. (−10 bis −25)
4. **Stil:** gespacede Em-Dashes, mechanischer Fettdruck, Mini-Tabellen ohne Vergleichswert,
   Bindestrich-Wortpaar-Häufung, Ankündigungsformeln („Lass uns eintauchen"), formelhafte Sprüche,
   Fake-Lockerheit, Negations-Dreierlisten, >80 % Sätze im 15–25-Wörter-Band, Symmetrie (≥3 gleich
   gebaute Abschnitte). (−5 bis −20)
5. **Chatbot/Filler/Hedging:** Chatbot-Reste („Ich hoffe, das hilft!"), Knowledge-Cutoff-Disclaimer,
   Füllphrasen, Konjunktiv-II-Hedging, generische positive Schlüsse. (−5 bis −15)

### Menschliche Signale (Schutz)

Ich-Perspektive mit sichtbarer Haltung, Humor und Widerspruch; unregelmäßige Satzlängen; regionale Wörter
und ~3 % Fehlerquote; konkrete, belegte Namen/Daten/Quellen; Abschweifungen und halbfertige Gedanken.
Fehlen diese Signale fast völlig, mindestens −10 zusätzlich.

### Berechnung

humanShare = 100 − Summe der Abzüge, begrenzt auf 0–100. Bei unbekannter Provenienz zählt nur das
Signalbild des Textes. Bei bekannter KI-Erstellung zählt die Provenienz als eigenes, starkes Signal und
wird in der Begründung offen ausgewiesen.

## Schwellen und Farben

- **grün: >70** — überwiegend menschlich; wenige oder keine Marker-Cluster. Freigeben, nichts erzwingen.
- **gelb: 30–70** — gemischter Text; typisch für humanisierte KI-Entwürfe oder stark überarbeitete
  Mischtexte. Humanizer-Pass erwägen, Wert ehrlich dokumentieren.
- **rot: <30** — überwiegend KI-generiert. Vor Veröffentlichung überarbeiten oder klar kennzeichnen; ein
  roter Wert darf nicht stillschweigend online gehen.

## Dokumentationspflicht

Nach der Bewertung MUSS der Agent das `aiTransparency`-Objekt im Frontmatter des Artikels anlegen oder
aktualisieren:

```yaml
aiTransparency:
  humanShare: 85            # 0-100, % menschlicher Anteil
  model: "DeepSeek V4 Pro"  # LLM, mit dem der Wert erhoben wurde
  confidence: "hoch"        # hoch | mittel | niedrig
  evaluatedAt: "2026-08-28"
```

- `model`: das LLM, auf dem der bewertende Agent tatsächlich läuft (dieses Projekt: "DeepSeek V4 Pro").
- `evaluatedAt`: Datum der Bewertung im ISO-Format JJJJ-MM-TT.
- Wird der Artikel später geändert, läuft dieser Skill erneut als letzter Schritt und aktualisiert das
  Objekt.

## Konfidenz-Semantik

- **hoch:** klare Signale + homogener Text (durchgängig menschlich oder durchgängig maschinell),
  ausreichende Textlänge.
- **mittel:** gemischte Signale, Mischtext, unklare Provenienz oder kurze Textbasis.
- **niedrig:** unsichere Einschätzung, sehr kurzer oder nicht-prosaischer Text (überwiegend Listen,
  Bildtexte, Code). Bei „niedrig" den Wert konservativ in Richtung Mitte ansetzen.

## Was Maria nicht tun darf

- Die sichtbare Transparenz-Tabelle und das Balkendiagramm werden automatisch von der
  `AiTransparency`-Komponente in `EntryLayout.astro` aus den Frontmatter-Feldern gerendert. Maria
  schreibt die Tabelle NIEMALS von Hand in den Artikelkörper.
- Die Erklaerseite liegt unter `/blog/ki-text-erkennung/` und wird automatisch verlinkt; sie wird nicht
  erneut in den Artikel kopiert.
- Die Bewertung ändert nie die Prosa. Wer Prosa verbessern muss, nutzt zuerst den Humanizer, danach
  diesen Skill als letzten Schritt.

## Quellen

- `.squad/skills/humanizer/SKILL.md` — KI-Marker-Listen und menschliche Signale, die hier als Signale
  übernommen werden.
- [Wikipedia: Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing)
- [GLTR — Gehrmann, Strobelt, Rush (ACL 2019)](https://arxiv.org/abs/1906.04043)
- GPTZero-Dokumentation zu Perplexität und Burstiness: https://gptzero.me/
