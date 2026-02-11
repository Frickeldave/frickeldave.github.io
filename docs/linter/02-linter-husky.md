
# Anleitung husky

Diese Anleitung beschreibt, wie die einzelnen Tools in ein NEUES astro oder node Projekt eingebunden
werden. Dieses Schritte dienen der reinen Dokumentation und müssen NICHT vom Entwickler durchgeführt
werden.

- [Anleitung husky](#anleitung-husky)
  - [Pre-commit hooks via husky](#pre-commit-hooks-via-husky)
  - [Voraussetzungen](#voraussetzungen)
  - [Installation](#installation)
  - [Einfachen pre-commit hook anlegen](#einfachen-pre-commit-hook-anlegen)
  - [Testen](#testen)
  - [Wie wird der hook ausgelöst](#wie-wird-der-hook-ausgelöst)
  - [Setup nach dem Clone](#setup-nach-dem-clone)


## Pre-commit hooks via husky

Husky ist ein Tool, das **Git Hooks** in Node.js-Projekten vereinfacht und automatisiert. Git Hooks
sind Skripte, die automatisch zu bestimmten Zeitpunkten im Git-Workflow ausgeführt werden (z.B. vor
einem Commit oder Push).

**Problem ohne Husky:**

- Entwickler vergessen, Linter vor dem Commit auszuführen
- Inkonsistente Code-Qualität erreicht das Repository
- CI/CD-Pipeline schlägt erst spät fehl
- Manuelle Prozesse sind fehleranfällig

**Lösung mit Husky:**

- **Automatische Qualitätsprüfung** bei jedem Commit/Push
- **Verhindert schlechten Code** im Repository
- **Konsistente Standards** für alle Entwickler
- **Frühe Fehlererkennung** vor CI/CD

**Wie funktioniert Husky?**

```bash
# Ohne Husky (manuell):
git add .
npm run lint        # Entwickler vergisst diesen Schritt oft!
git commit -m "fix"

# Mit Husky (automatisch):
git add .
git commit -m "fix" # Husky führt automatisch lint + tests aus
```

**Vorteile von Husky**

| Vorteil                   | Beschreibung                                      |
| ------------------------- | ------------------------------------------------- |
| **Automatisierung**       | Linter, Tests und Formatierung laufen automatisch |
| **Konsistenz**            | Alle Entwickler haben die gleichen Standards      |
| **Frühe Fehlererkennung** | Probleme werden vor dem Push erkannt              |
| **Einfache Einrichtung**  | Funktioniert nach `npm install` automatisch       |
| **Teamweite Standards**   | Hooks werden im Repository geteilt                |

## Voraussetzungen

- Node.js (>=24) und npm installiert
- Git-Repository initialisiert (oder bestehendes Repo)

## Installation

Öffne ein Terminal im Ziel-Repo und installiere Husky als Dev-Dependency:

```bash
npm install --save-dev husky
```

`prepare`-Script in `package.json` eintragen

Füge in `package.json` unter `scripts` folgendes hinzu (falls noch nicht vorhanden):

```json
"scripts": {
  "prepare": "husky install"
}
```

Husky einmalig initialisieren (setzt `git config core.hooksPath .husky` und erstellt `.husky`).
Husky-Versionen (ab v7) setzen die Git-Konfiguration `core.hooksPath` auf das Verzeichnis `.husky/`
im Projekt. Git liest Hooks also nicht aus `.git/hooks`, sondern aus dem Pfad, der in
`core.hooksPath` konfiguriert ist. Deshalb zeigt ein `ls .git/hooks` häufig nur die mitgelieferten
`*.sample`-Dateien, obwohl Husky-Hooks unter `.husky/` aktiv sind.

```bash
npm run prepare
```

## Einfachen pre-commit hook anlegen

Lege die Datei `.husky/pre-commit` mit folgendem Inhalt an:

```sh
#!/usr/bin/env sh
.
echo "Husky pre-commit hook: hello from husky!"
```

Setze die Datei ausführbar:

```bash
chmod +x .husky/pre-commit
```

## Testen

Erzeuge eine Änderung, stage und committe:

```bash
git add .
git commit -m "test husky"
```

Beim Commit solltest du die Nachricht vom Hook in der Konsole sehen.

## Wie wird der hook ausgelöst

Prüfen, wo Git Hooks sucht:

```bash
git config --get core.hooksPath
git config --show-origin core.hooksPath
```

Prüfen, ob der Husky-Hook vorhanden und ausführbar ist:

```bash
ls -l .husky
ls -l .husky/pre-commit
cat .husky/pre-commit
```

## Setup nach dem Clone

Im Gegensatz zu hooks in `.git/hooks`, müssen Husky-Hooks nach dem Klonen eines Repositories lokal
eingerichtet werden, dies passiert über das `prepare` Script in der `package.json`. Führe hierzu
bitte folgenden Befehl aus

```bash

# Abhängigkeiten installieren (führt `prepare` aus, wenn es in package.json steht)
npm install

```