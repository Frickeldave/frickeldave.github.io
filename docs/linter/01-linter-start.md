# Linter Installation und Integration über Husky

Diese Anleitung beschreibt, wie du in einem Astro/Starlight Repository alle notwendigen Linter
einbaust und mit Husky Git Hooks automatisierst.

- [Linter Installation und Integration über Husky](#linter-installation-und-integration-über-husky)
  - [Übersicht der Tools](#übersicht-der-tools)
  - [Wie die Tools zusammenarbeiten](#wie-die-tools-zusammenarbeiten)
  - [Workflow für Entwickler](#workflow-für-entwickler)
    - [Beim Entwickeln](#beim-entwickeln)
    - [Vor dem Commit](#vor-dem-commit)
    - [Bei Fehlern](#bei-fehlern)
  - [Nützliche Befehle für Entwickler](#nützliche-befehle-für-entwickler)


## Übersicht der Tools

| Tool         | Zweck                            | Dateitypen                              | Fokus                                                              |
| ------------ | -------------------------------- | --------------------------------------- | ------------------------------------------------------------------ |
| **Husky**    | Git Hooks Automatisierung        | Alle (indirekt über andere Tools)       | Automatische Ausführung von Qualitätsprüfungen bei Git-Operationen |
| **ESLint**   | Code-Qualität und Best Practices | `.js`, `.ts`, `.astro`, `.jsx`, `.tsx`  | JavaScript/TypeScript Syntax, Logik, Patterns                      |
| **Prettier** | Code-Formatierung                | Alle unterstützten Dateitypen           | Einheitliche Formatierung und Styling                              |
| **Vale**     | Prose-Linting                    | `.md`, `.mdx`, Text in Code-Kommentaren | Schreibstil, Grammatik, Terminologie                               |

More details: 

- [Husky](./02-linter-husky.md)
- [ESLint](./03-linter-eslint.md)
- [Prettier](./04-linter-prettier.md)
- [Vale](./05-linter-vale.md)

## Wie die Tools zusammenarbeiten

**1. Entwicklungsphase**

- **ESLint**: Läuft im Editor und zeigt Code-Probleme in Echtzeit
- **Prettier**: Formatiert Code automatisch beim Speichern
- **Vale**: Überprüft Dokumentation und Kommentare

**1. Pre-commit Phase**

- Alle drei Tools laufen automatisch vor jedem Git-Commit
- Verhindert, dass problematischer Code/Content committed wird
- Stellt sicher, dass alle Änderungen den Qualitätsstandards entsprechen
- Kann mit --no-verify übersprungen werden (Nicht empfohlen)
  
**3. CI/CD Pipeline**

- Validiert, dass alle Regeln eingehalten werden
- Blockiert Merges bei Regelverstößen
- Stellt sicher, dass nur qualitativ hochwertiger Code deployed wird

## Workflow für Entwickler

### Beim Entwickeln

1. **Code schreiben** - ESLint zeigt Probleme in Echtzeit
2. **Datei speichern** - Prettier formatiert automatisch
3. **Dokumentation schreiben** - Vale prüft Schreibstil

### Vor dem Commit

1. **Pre-commit Hook** läuft automatisch
2. **ESLint** prüft alle geänderten Code-Dateien
3. **Prettier** formatiert alle Dateien
4. **Vale** prüft alle Markdown-Dateien
5. **Commit wird blockiert** bei Fehlern

### Bei Fehlern

1. **ESLint-Fehler**: Code korrigieren oder `npm run lint` verwenden
2. **Prettier-Fehler**: Automatisch behoben durch `npm run format`
3. **Vale-Fehler**: Text manuell korrigieren oder Regel anpassen

## Nützliche Befehle für Entwickler

- `npm install`: Installiert alle Dependencies und Vale automatisch über postinstall Hook
- `npm run lint`: Versucht den Code automatisch zu korrigieren
- `npm run lint:check`: Findet Fehler im Code und zeigt diese an
- `npm run format`: Formatiert alle Dateien gemäß den Vorgaben
- `npm run format:check`: Findet Formatierungsfehler und zeigt diese an
- `npm run install-vale`: Installiert Vale manuell (falls erforderlich)
- `npm run prose`: Findet alle Prosa-Fehler und zeigt diese an
- `npm run lint:all`: Findet alle Issues im Code und versucht diese soweit es geht automatisch zu
  korrigieren
- `npm run lint:checkall`: Findet alle Issues im Code und zeigt die Ergebnisse an
