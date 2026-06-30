---
name: docspedagogy
description:
  "**WORKFLOW SKILL** — Bewertet deutsche Dokumentationsinhalte im src/content/docs/-Verzeichnis auf
  pädagogische Wirksamkeit, Klarheit und logischen Aufbau. Evaluiert Inhalte aus der Perspektive
  lernender Entwickler. VERWENDEN FÜR: Überprüfung der aktuellen Markdown-Datei in src/content/docs/ auf didaktische
  Qualität. NICHT VERWENDEN FÜR: Andere Content-Verzeichnisse außer src/content/docs/."
---

# Documentation Pedagogy Review Skill

## Zweck

Dieser Skill bewertet deutsche Dokumentationsinhalte auf ihre pädagogische Qualität, Klarheit und ihren logischen Aufbau. Die Evaluierung erfolgt aus der Perspektive lernender Entwickler, um sicherzustellen, dass die Inhalte effektiv vermittelt werden können. Der Skill konzentriert sich auf die aktuell geöffnete Datei im Editor.

## Evaluierungs-Rahmenwerk

### 1. Klarheits-Bewertung

Für die aktuelle Dokumentationsdatei prüfen:

- **Voraussetzungen explizit?** Sind erforderliche Vorkenntnisse klar angegeben?
- **Konzeptuelles Scaffolding?** Werden abstrakte Konzepte mit konkreten Analogien erklärt?
- **Code-Beispiele gut kommentiert?** Erklären Code-Beispiele WARUM, nicht nur WAS?
- **Fachbegriffe erklärt?** Wird neue Terminologie mit Definitionen eingeführt?
- **Visuelle Hilfen effektiv?** Unterstützen Diagramme oder andere visuelle Elemente das Verständnis?

### 2. Pädagogische Wirksamkeit

Bewerten:

- **Theorie-Praxis-Verhältnis?** Gibt es einen ausgewogenen Wechsel zwischen Erklärung und Anwendung?
- **Lernprogression?** Werden Konzepte schrittweise komplexer eingeführt (Scaffolding)?
- **Sofortiges Feedback?** Können Lernende Erfolg schnell verifizieren?
- **Fehlerbehandlung?** Sind häufige Fehler und Troubleshooting-Schritte enthalten?
- **Lernziele messbar?** Können Lernende verifizieren, dass sie das Ziel erreicht haben?

### 3. Logische Organisation

Prüfen:

- **Abhängigkeits-Mapping?** Werden Konzepte eingeführt, bevor sie verwendet werden?
- **Fluss zwischen Abschnitten?** Führt jeder Abschnitt natürlich zum nächsten?
- **Wiederholung angemessen?** Werden Schlüsselkonzepte ohne Redundanz verstärkt?
- **Querverweise nützlich?** Helfen interne Links bei der Navigation?
- **Zeitangaben realistisch?** Entsprechen Abschnittsdauern der Komplexität?

### 4. Lernender-Entwickler-Perspektive

Berücksichtigen:

- **Geht zu viel voraus?** Würde sich jemand mit grundlegenden Kenntnissen verloren fühlen?
- **Überwältigende Komplexität?** Werden komplexe Themen in verdauliche Stücke gebrochen?
- **Motivation klar?** Erklärt jeder Abschnitt, WARUM das wichtig ist?
- **Nächste Schritte offensichtlich?** Werden Lernende auf nachfolgende Themen hingewiesen?

## Vorgehensweise

1. **Aktuelle Datei analysieren**
   - Die aktuell im Editor geöffnete Datei identifizieren
   - Struktur und Inhalte der Datei verstehen
   - Lernziele und Zielgruppe der Datei ermitteln

2. **Inhalte evaluieren**
   - Die Datei auf Klarheit und pädagogische Effektivität prüfen
   - Praxisbezug und Anwendungsbeispiele bewerten
   - Code-Beispiele auf Nachvollziehbarkeit überprüfen

3. **Verbesserungsvorschläge entwickeln**
   - Schwächen und Verbesserungspotenziale notieren
   - Konkrete Änderungsvorschläge formulieren
   - Priorisierung von notwendigen Änderungen erstellen

## Ausgabe-Format

Strukturierte Evaluation mit folgendem Format zurückgeben:

```markdown
# Dokumentations-Review

## Gesamtbewertung

[Zusammenfassung der Stärken und priorisierter Verbesserungen]

## Datei-für-Datei-Analyse

### [Dateiname]

**Stärken:**

- [Spezifische positive Beobachtungen]

**Bedenken:**

- [Bereiche, die Klärung oder Verbesserung benötigen]

**Vorschläge:**

- [Konkrete, umsetzbare Empfehlungen]

**Lernender-Entwickler-Auswirkung:** [Hoch/Mittel/Niedrig] - Wie dies das Lernerlebnis beeinflusst

## Kritische Probleme (Muss behoben werden)

[Blockierende Probleme, die Lernende verwirren werden]

## Empfohlene Verbesserungen (Sollte behoben werden)

[Verbesserungen zur Steigerung von Klarheit oder Engagement]

## Optionale Erweiterungen (Nizza zu haben)

[Zusätzliche Inhalte, die das Erlebnis bereichern könnten]

## Pädagogische Wertungskarte

| Dimension       | Bewertung (1-5) | Hinweise |
| --------------- | --------------- | -------- |
| Klarheit        | ⭐⭐⭐⭐        |          |
| Scaffolding     | ⭐⭐⭐⭐⭐      |          |
| Praxis-Balance  | ⭐⭐⭐⭐        |          |
| Motivation      | ⭐⭐⭐⭐⭐      |          |
| Troubleshooting | ⭐⭐⭐          |          |

## Beispielhaft verbesserte Erklärungen

[Umgeschriebene Beispiele für verwirrende Abschnitte bereitstellen]
```

## Tool-Nutzungsrichtlinien

- **read**: Zum Untersuchen der aktuell geöffneten Dokumentationsdatei im `src/content/docs/` Verzeichnis verwenden
- **search**: Zum Finden spezifischer Konzepte innerhalb der aktuellen Datei
- **todo**: Zur Verfolgung des Evaluierungsfortschritts

## Besondere Überlegungen

Dieser Skill ist darauf ausgelegt, ausschließlich die aktuell im Editor geöffnete deutsche Dokumentationsdatei im `src/content/docs/` Verzeichnis zu bewerten. Die Evaluierung konzentriert sich auf die pädagogische Qualität und nicht auf die technische Richtigkeit der Inhalte.