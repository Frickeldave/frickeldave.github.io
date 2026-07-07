# RAI-Policy

> Verantwortungsvolle AI-Policy für dieses Projekt. Rai setzt diese Standards durch.

## Prinzipien

1. **Safety first** — Keine Ausgabe sollte Schaden für Individuen oder Gruppen verursachen.
2. **Transparenz** — Nutzer sollten wissen, wenn sie mit KI-generiertem Inhalt interagieren.
3. **Fairness** — Systeme sollten nicht basierend auf geschützten Merkmalen diskriminieren.
4. **Privatsphäre** — Personenbezogene Daten müssen mit minimaler Exposition und expliziter Zustimmung behandelt werden.
5. **Verantwortlichkeit** — Jede Entscheidung hat einen Eigentümer; jede Befundung hat einen Remediation-Pfad.

## Kritische Verstöße (🔴 — Immer Blockiert)

Diese KÖNNEN nicht ausgeliefert werden. Kein Opt-out. Keine Ausnahmen.

### Credentials & Secrets
- Hardcoded API-Keys, Tokens, Passwörter, Connection Strings
- Private Keys im Source Control committet
- Secrets in Environment-Variable-Defaults oder Config-Templates

### Injection-Schwachstellen
- SQL Injection (ungesäuberte Benutzereingabe in Queries)
- Command Injection (Benutzereingabe in Shell-Befehlen)
- Path Traversal (Benutzereingabe in Dateipfaden ohne Validierung)

### Schädlicher Inhalt
- Hassrede, Schimpfwörter oder herabsetzende Sprache, die Gruppen targetet
- Inhalt, der Gewalt oder Selbstverletzung fördert
- Sexuell expliziter Inhalt ohne angemessenen Kontext/Gating

### Täuschende Muster
- Ungegründete faktische Behauptungen, die als autoritär präsentiert werden
- Halluzinierte Zitierungen, Referenzen oder Statistiken
- Anweisungen, die AI-Safety-Richtlinien oder Content-Filter umgehen

## Beratende Bedenken (🟡 — Markiert, Nicht Blockiert)

Dies sind Empfehlungen. Arbeit schreitet mit angehängten Vorschlägen fort.

### Privatsphäre & Daten
- PII (Namen, E-Mails, Telefonnummern) in Logs oder Antworten
- Übermäßig breite Datensammlung ohne angegebenen Zweck
- Fehlende Daten-Retentions- oder Löschrichtlinien

### Bias & Fairness
- Algorithmen, die demografische Merkmale (Alter, Geschlecht, Ethnie) ohne Begründung verwenden
- Proxy-Attribute, die mit geschützten Merkmalen korrelieren
- Trainingsdaten mit bekannten Repräsentationslücken

### Inklusive Sprache
- Geschlechtsspezifische Begriffe, wo neutrale Alternativen existieren (z. B. "Leute" → "alle")
- Ableistische Sprache (z. B. "Blindspot" → "Aufsichtspunkt", "Sanity Check" → "Validierung")
- Kulturell annehmende Begriffe (z. B. Annahme westlicher Feiertage, Namenskonventionen)

### Security-Postur
- Fehlendes Rate Limiting auf benutzerzugewandten Endpoints
- Übermäßig permissive CORS- oder Authentifizierungsrichtlinien
- Unzureichende Input-Validierung auf öffentlichen Schnittstellen

### Barrierefreiheit
- Fehlender Alt-Text auf Bildern
- Unzureichender Farbkontrast
- Fehlende ARIA-Labels auf interaktiven Elementen

## Terminologiestandards

| Vermeiden           | Bevorzugen             | Grund                    |
| ------------------- | ---------------------- | ------------------------ |
| whitelist/blacklist | allowlist/blocklist    | Rassistische Konnotation |
| master/slave        | primary/replica        | Rassistische Konnotation |
| sanity check        | validation, smoke test | Ableistisch              |
| dummy value         | placeholder, sample    | Potentiell anstößig      |
| guys                | alle, Team, Leute      | Geschlechtsspezifisch    |
| man-hours           | person-hours, Aufwand  | Geschlechtsspezifisch    |

## Review-Scope nach Änderungstyp

| Änderungstyp                | Review-Level                  | Begründung             |
| --------------------------- | ----------------------------- | ---------------------- |
| Source Code (neue Features) | Vollständiger Check-Suite     | Höchste Risikofläche   |
| Source Code (Bugfixes)      | Credential + Injection-Checks | Targeted Risk          |
| Dokumentation               | Content + Terminologie nur    | Niedrigeres Risiko     |
| Test-Dateien                | Nur Credential-Checks         | Minimalrisiko          |
| Dependency-Updates          | Überspringen (Fast-Path)      | Kein authored Content  |
| Konfiguration               | Nur Credential-Checks         | Secret-Exposure-Risiko |

## Eskalationspfad

1. **🟢 Grün** — Keine Aktion nötig. Arbeit schreitet fort.
2. **🟡 Gelb** — Vorschläge an Arbeitsergebnis angehängt. Autor entscheidet.
3. **🔴 Rot** — Arbeit blockiert. Reviewer-Rejektions-Protokoll aktiviert:
   - Original-Autor von Revision ausgeschlossen
   - Rai empfiehlt Fix-Agent
   - Rai liefert Pair-Mode-Leitfaden während Revision
   - Neureview erforderlich, bevor Arbeit ausgeliefert werden kann

## Policy-Updates

Diese Policy entwickelt sich weiter. Änderungen erfordern:
- Justification logged to `.squad/rai/audit-trail.md`
- Team acknowledgment (via decisions inbox)
- No retroactive enforcement (new rules apply forward only)
