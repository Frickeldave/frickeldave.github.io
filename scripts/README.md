# Scripts Documentation

Übersicht aller verfügbaren Scripts im Projekt. Diese Scripts automatisieren wichtige Entwicklungs- und Deployment-Prozesse.

## Inhaltsverzeichnis

- [Quick Start](#quick-start)
- [Installation Scripts](#installation-scripts)
  - [install-gh-copilot.mjs](#install-gh-copilotmjs)
  - [prose-install.mjs](#prose-installmjs)
- [Development Scripts](#development-scripts)
  - [merge-branches.mjs](#merge-branchesmjs)
  - [prose-check.mjs](#prose-checkmjs)
  - [translate.mjs](#translatemjs)
- [Podcast Update Scripts](#podcast-update-scripts)
  - [compare-episodes.mjs](#compare-episodesmjs)
  - [generate-metadata.mjs](#generate-metadatamjs)
  - [update-doag.mjs](#update-doagmjs)

---

## Quick Start

Alle Scripts können über npm ausgeführt werden:

```bash
# Installation (wird automatisch nach npm install ausgeführt)
npm run install-gh-copilot  # GitHub Copilot CLI installieren
npm run prose-install       # Vale Prose Checker installieren

# Entwicklung
npm run prose               # Inhalte mit Vale überprüfen
```

---

## Installation Scripts

### install-gh-copilot.mjs

**Zweck:** Installiert die GitHub Copilot CLI global, falls nicht bereits vorhanden.

**Beschreibung:**
- Überprüft, ob die GitHub Copilot CLI (`@github/copilot`) bereits installiert ist
- Verifiziert die Installation durch Versionsprüfung (vs. bloße Exit-Code Prüfung)
- Installiert die CLI global via npm, falls erforderlich
- Wird automatisch als Post-Install Hook ausgeführt (`npm install`)

**Usage:**
```bash
npm run install-gh-copilot
# oder direkt:
node scripts/install-gh-copilot.mjs
```

**Ausgabe:**
- ✓ "Copilot CLI: already installed, skipping." — CLI ist bereits vorhanden
- ✓ "Copilot CLI installed successfully." — Installation erfolgreich
- ⚠ Warnung bei Installationsfehler (nicht kritisch)

**Abhängigkeiten:**
- Node.js (gebündelt)
- npm (zum Installieren von `@github/copilot`)

#### Verwendung im GitHub Workflow

**Postinstall Hook (.github/workflows/pull-request-checks.yml):**
```yaml
- name: Install dependencies
  run: npm ci  # Führt postinstall-Hook aus
```

Das Script wird automatisch nach `npm ci` / `npm install` aufgerufen:
- Im lokalen Setup (Development)
- In CI/CD Pipelines (via `npm ci` in Workflows)
- Auf Build-Servern und Runner-Instanzen

**Automatischer Ablauf:**
1. Pull Request wird erstellt → Workflow triggered
2. `npm ci` wird ausgeführt
3. postinstall-Hook führt `npm run install-gh-copilot` aus
4. GitHub Copilot CLI wird (falls nicht vorhanden) installiert
5. Weitere Checks können auf der CLI zugreifen

---

### prose-install.mjs

**Zweck:** Installiert Vale (Prose Checker) und Style Guides plattformübergreifend.

**Beschreibung:**
- Erkennt automatisch die aktuelle Plattform (Windows, macOS, Linux)
- Erkennt die CPU-Architektur (x86_64, ARM64)
- Lädt die korrekte Vale-Binary (v3.7.1) herunter
- Installiert Microsoft und write-good Style Guides
- Unterstützt Force-Reinstall und Silent Mode

**Usage:**
```bash
npm run prose-install              # Interaktiv
node scripts/prose-install.mjs     # Interaktiv

node scripts/prose-install.mjs --quiet   # Stille Installation (keine Ausgabe)
node scripts/prose-install.mjs --force   # Erzwingt Neuinstallation
node scripts/prose-install.mjs -q -f     # Kombiniert: stille, erzwungene Installation
```

**Parameter:**
| Parameter | Shorthand | Beschreibung |
|-----------|-----------|---|
| `--quiet` | `-q` | Unterdrückt alle Ausgaben (außer Fehlern) |
| `--force` | `-f` | Erzwingt Neuinstallation, auch wenn bereits vorhanden |

**Installation:**
- **Windows:** `vale.exe` (64-bit)
- **macOS:** `vale` (ARM64 oder x86_64)
- **Linux:** `vale` (64-bit)
- **Zielverzeichnis:** `.vale/` im Projekt-Root

**Style Guides:**
- Microsoft (Corporate style, best practices)
- write-good (Plain language, readability)

**Fehlermeldungen:**
- Unsupported platform → Script beendet sich mit Fehlermeldung
- Download fehlgeschlagen → Detaillierte Fehler mit Wiederherstellungshinweisen

**Abhängigkeiten:**
- Node.js (gebündelt)
- Internet-Zugang (zum Herunterladen von Vale und Styles)

#### Verwendung im GitHub Workflow

**Postinstall Hook (.github/workflows/pull-request-checks.yml):**
```yaml
- name: Install dependencies
  run: npm ci  # Führt postinstall-Hook aus, der prose-install aufruft
```

Das Script wird automatisch nach `npm ci` / `npm install` aufgerufen:
- Im lokalen Setup (Development)
- In CI/CD Pipelines (via `npm ci` in Workflows)
- Auf Build-Servern und Runner-Instanzen

**Automatischer Ablauf:**
1. Pull Request wird erstellt → Workflow triggered
2. `npm ci` wird ausgeführt
3. postinstall-Hook führt `npm run prose-install` aus
4. Vale wird platformgerecht heruntergeladen und installiert
5. Style Guides werden konfiguriert
6. Nachfolgende `npm run prose` Checks können Vale verwenden

**Workflow-Integration:**
- `.github/workflows/pull-request-checks.yml` — Vale Installation vor Prose Checks
- Stille Installation (`--quiet` Flag) wird in CI empfohlen
- Force-Reinstall wird nicht benötigt (wird bei jedem Run frisch installiert)

---

## Development Scripts

### merge-branches.mjs

**Zweck:** Automatisiertes Merging von Feature-Branches in Entwicklungszweige mit PR-Erstellung und konfigurierbarer Konfliktauflösung.

**Beschreibung:**
- Feature-Branch → Dev-Branch → Main-Branch Workflow
- Erstellt automatisch Pull Requests via GitHub CLI
- Unterstützt konfigurierbare Merge-Strategien
- Interaktive Konfliktauflösung bei Bedarf
- Plattformunabhängig (Windows, macOS, Linux)
- Farbiges Terminal-Output für bessere Lesbarkeit

**Features:**
- ✓ Automatische Branch-Erkennung (aktueller Branch)
- ✓ Pull Request Erstellung über GitHub CLI
- ✓ Auto-Merge mit konfigurierbarer Strategie
- ✓ Interaktive Konfliktauflösung
- ✓ Benutzerfreundliche Terminal-UI mit Farbcodes

**Voraussetzungen:**
- GitHub CLI (`gh`) installiert und authentifiziert
- Lokales Git Repository mit Branches

**Usage:**
```bash
# Automatische Branch-Erkennung (mergt aktuellen Branch)
node scripts/merge-branches.mjs

# Explizit zu dev mergen
node scripts/merge-branches.mjs dev

# Explizit zu main mergen
node scripts/merge-branches.mjs main
```

**Workflow:**
1. Prüft GitHub CLI Installation und Authentifizierung
2. Erkennt aktuellen Branch
3. Erstellt Pull Request für den Ziel-Branch
4. Wartet auf Benutzerbestätigung
5. Führt Merge durch (bei Bedarf mit Konfliktauflösung)
6. Pushed Änderungen

**Ausgabe (farbig):**
```
ℹ GitHub CLI verfügbar: gh version ...
✓ GitHub CLI authentifiziert
▶ Extracting branch information...
▶ Creating pull request...
? Proceed with merge? [y/n]
✓ Merge successful
```

#### Verwendung im GitHub Workflow

**Nicht in CI Workflows verwendet.**

Dieses Script ist ausschließlich für **lokale, manuelle Entwicklung** gedacht:
- Feature-Branch lokal mergen
- Interaktive Konfliktauflösung auf dem Developer-Rechner
- Manuelles PR-Management vor automatisierten Checks

**Warum nicht in Workflows?**
- GitHub Workflows verwenden automatisierte Merge-Optionen via `gh pr merge`
- Keine interaktive User-Eingabe in CI/CD möglich

**Empfohlener Workflow:**
1. Lokal: `node scripts/merge-branches.mjs dev` (interaktiv)
2. Push der Änderungen
3. GitHub Workflows übernehmen automatisierte Checks und Deployment

---

### prose-check.mjs

**Zweck:** Führt Vale-Überprüfungen auf allen Inhalten durch (Prose/Style Checking).

**Beschreibung:**
- Prüft Inhalte in `src/content` auf Style-Richtlinien
- Nutzt Vale-Konfiguration aus `.vale.ini`
- Plattformübergreifende Binary-Erkennung (`.vale/vale` oder `.vale/vale.exe`)
- Einfacher direkter Aufruf ohne Zusatzkonfiguration

**Usage:**
```bash
npm run prose
# oder direkt:
node scripts/prose-check.mjs
```

**Prüfungen (via Style Guides):**
- Microsoft Style Guidelines (formale Anforderungen)
- write-good Guidelines (Lesbarkeit, Klarheit)
- Vale-Standard Rules

**Output:**
- Violations werden mit Dateipfad, Zeile, Spalte und Fehlerbeschreibung angezeigt
- Nicht-kritische Fehler: Warning
- Kritische Fehler: Error

**Beispiel-Output:**
```
src/content/blog/article.md
  42:15  error    Avoid using "However" at the start of a sentence.
  58:3   warning  Use "do not" instead of "don't"
```

**Abhängigkeiten:**
- Vale installiert (via `npm run prose-install`)
- `.vale.ini` Konfigurationsdatei
- Style Guides in `.vale/styles/`

#### Verwendung im GitHub Workflow

**Pull Request Checks (.github/workflows/pull-request-checks.yml):**
```yaml
- name: Running Vale prose check...
  run: npm run prose || { echo "❌ Vale prose check failed"; exit 1; }
```

**Workflow-Integration:**
- **Trigger:** Pull Request auf `dev` oder `main` Branch
- **Step:** Nach ESLint und Prettier Checks
- **Konsequenz bei Fehler:** PR-Check schlägt fehl, Merge wird blockiert
- **Zeitpunkt:** Auf jedem Push in einem offenen PR

**Ablauf in CI/CD:**
1. PR wird erstellt/aktualisiert
2. `npm ci` installiert Dependencies + Vale
3. Linting-Checks laufen:
   - ESLint (`npm run lint:check`)
   - Prettier (`npm run format:check`)
   - **Vale Prose Check** (`npm run prose`) ← hier ist dieses Script
4. Bei Fehler: PR-Check rot, Merge blockiert
5. Bei Erfolg: ✅ Alle Checks bestanden, Merge möglich

**Status-Badge im PR:**
- 🟢 Grün: Prose Check bestanden
- 🔴 Rot: Vale-Fehler gefunden (müssen behoben werden)

---

### translate.mjs

**Zweck:** Übersetzt technische Dokumentation mit LLM-API von Englisch in andere Sprachen (z.B. Deutsch, Klingonisch).

**Beschreibung:**
- Integriert mit LLM-APIs (OpenAI-kompatibel, vgl. Ollama, etc.)
- Unterstützt mehrere Zielsprachen (über `SUPPORTED_LANGS` konfigurierbar)
- Behält Markdown-Formatierung, Code-Blöcke und Links bei
- Nutzt Umgebungsvariablen für API-Konfiguration
- Ausgabeverzeichnisse pro Sprache

**Unterstützte Sprachen (aktuell):**
- `de` → Deutsch (`de/`)
- `kl` → Klingonisch (`kl/`) — konstruierte Star Trek Sprache

**Konfiguration (.env erforderlich):**
```env
LLM_API_URL=http://localhost:11434/v1    # LLM API Endpoint
LLM_API_KEY=no-key                        # API Key (falls erforderlich)
LLM_MODEL=llama2                          # Modell-Name
TARGET_LANG=de                            # Standard-Zielsprache
```

**Usage:**
```bash
# Mit .env Konfiguration (Standard)
node scripts/translate.mjs <eingabedatei>

# CLI-Parameter überschreiben .env
node scripts/translate.mjs <eingabedatei> --lang=kl
node scripts/translate.mjs <eingabedatei> kl

# In package.json (npm):
npm run translate <datei> -- --lang=kl
```

**Parameter:**
| Parameter | Beschreibung |
|-----------|---|
| `--lang=<code>` | Zielsprache setzen (z.B. `kl`, `de`) |
| `<code>` als 2. Arg | Alternative: Sprache als direktes Argument |

**Workflow:**
1. `.env` Datei laden
2. LLM_API_URL und LLM_MODEL prüfen (erforderlich)
3. Eingabedatei laden
4. Pro Chunk über LLM übersetzen
5. Markdown-Struktur beibehalten
6. In `src/content/<lang>/` speichern

**Ausgabe:**
```
✓ Übersetzung abgeschlossen
  Eingabe: docs/tutorial.md
  Ausgabe: src/content/de/tutorial.md
  Sprache: Deutsch
  Token: 1242
```

**LLM-Integration:**
- Kompatibel mit OpenAI-API Format
- Unterstützt lokale LLMs (Ollama, etc.)
- Bearer Token Authentifizierung (wenn LLM_API_KEY gesetzt)

**Fehlerbehandlung:**
- `.env` nicht gefunden → Fehler mit Hinweis auf `.env.example`
- LLM_API_URL oder LLM_MODEL fehlt → Fehler mit Anforderungen
- API-Fehler → Detaillierte Fehlermeldung

#### Verwendung im GitHub Workflow

**Nicht in CI Workflows verwendet.**

Dieses Script ist für **lokale, manuelle Content-Übersetzung** gedacht:
- Übersetzung von Dokumentation vor Commit
- Manuelle Übersetzung durch Entwickler
- Auf Bedarf basierend (keine automatisierte Übersetzung)

**Warum nicht in Workflows?**
- Externe LLM-API Abhängigkeit (`.env` Konfiguration erforderlich)
- Kostenintensiv (API-Aufrufe pro Übersetzung)
- Keine automatisierte Übersetzung gewünscht (manueller Prozess)
- CI/CD sollte keine LLM-Credentials speichern

**Manueller Workflow:**
```bash
# Lokal durchführen:
npm run translate path/to/file.md --lang=de
git add src/content/de/file.md
git commit -m "docs: translate file to German"
git push
# → Danach: GitHub Workflows überprüfen Inhalte mit prose-check und triggern Deployment automatisch
```

---

## Podcast Update Scripts

Diese Scripts automatisieren das Auffinden und Hinzufügen neuer Podcast-Episoden zur doag.md Datei.

### compare-episodes.mjs

**Zweck:** Vergleicht den Acast RSS-Feed mit existierenden Episoden in doag.md und identifiziert fehlende Episodes.

**Beschreibung:**
- Lädt RSS-Feed vom Acast DOAG Voices Podcast
- Vergleicht mit existierenden Episoden in `src/content/aboutme/doag.md`
- Findet die **älteste fehlende Episode**
- Gibt Ergebnis als JSON aus
- Nutzt als Eingabe für nachfolgende Metadaten-Generierung

**Usage:**
```bash
node scripts/workflows/podcast-update/compare-episodes.mjs
```

**Ausgabe:**
```json
{
  "title": "Episode Title",
  "description": "Episode description from RSS feed",
  "pubDateFormatted": "2026-06-25",
  "audioUrl": "https://...",
  "link": "https://..."
}
```

**Abhängigkeiten:**
- Node.js (gebündelt)
- Internet-Zugang (zum Abrufen des RSS-Feeds)

#### Verwendung im GitHub Workflow

**Podcast Update Workflow (.github/workflows/podcast-update.yml):**
```yaml
on:
  schedule:
    # Every Tuesday at 09:00 CET/CEST
    - cron: "0 8 * * 2"
  workflow_dispatch:

jobs:
  podcast-update:
    steps:
      - name: Global episode comparison (against main)
        run: node scripts/workflows/podcast-update/compare-episodes.mjs
```

**Workflow-Integration:**
- **Trigger:** Wöchentlich (dienstags 09:00 CET) oder manuell via `workflow_dispatch`
- **Step:** Erster Check im Workflow
- **Konsequenz:** Wenn keine neuen Episodes gefunden → Workflow beendet sich
- **Output:** Wird an nächste Steps weitergegeben

**Ablauf in CI/CD:**
1. Workflow triggert (Schedule oder manuell)
2. compare-episodes.mjs lädt Acast RSS-Feed
3. Vergleicht mit doag.md (main branch)
4. Falls neue Episode gefunden → JSON Output
5. Falls keine neue Episode → Workflow stoppt (erfolgreich)
6. Falls neue Episode → Nächster Step generiert Metadaten

---

### generate-metadata.mjs

**Zweck:** Generiert strukturierte Metadaten für eine Podcast-Episode mittels GitHub Copilot CLI.

**Beschreibung:**
- Liest Episode-JSON aus compare-episodes.mjs
- Sendet Prompt an GitHub Copilot CLI
- Lässt Copilot Metadaten (Titel, Edition, Gäste, Beschreibung) generieren
- Fallback-Mechanismus: API oder manuelle Eingabe wenn CLI fehlschlägt
- Speichert Ergebnis in `metadata.json`
- Validiert JSON-Output vor Speicherung

**Supported Podcast Editionen:**
- `People` — Persönliche Geschichten hinter dem Fachwissen
- `FutureAI` — KI im Hier und Morgen, Ethik und Zukunftsvisionen
- `DataWorld` — Von Analytics bis zu intelligenten Architekturen
- `CloudTalk` — Wie Cloud-Technologien Unternehmen verändern
- `DevLand` — Moderne Softwareentwicklung zwischen Wandel und multiplen Perspektiven

**Usage:**
```bash
node scripts/workflows/podcast-update/generate-metadata.mjs
```

**Ausgabe (metadata.json):**
```json
{
  "title": "Episode Title",
  "edition": "FutureAI",
  "guests": "Dave König und Dr. Max Mustermann",
  "date": "2026-06-25",
  "description": "Zusammenfassung der Episode (2-4 Sätze)",
  "links": {
    "spotify": "https://open.spotify.com/show/...",
    "apple": "https://podcasts.apple.com/de/podcast/...",
    "amazon": "https://music.amazon.de/podcasts/..."
  }
}
```

**Abhängigkeiten:**
- GitHub Copilot CLI (`@github/copilot`) — installiert via postinstall-Hook
- `GITHUB_TOKEN` Environment Variable (für Copilot Authentifizierung)
- Node.js 24+

#### Verwendung im GitHub Workflow

**Podcast Update Workflow (.github/workflows/podcast-update.yml):**
```yaml
- name: Generate episode metadata using Copilot CLI
  if: steps.check_episodes.outputs.missing_episode != ''
  run: node scripts/workflows/podcast-update/generate-metadata.mjs
  env:
    GITHUB_TOKEN: ${{ secrets.COPILOT_GITHUB_TOKEN }}
```

**Workflow-Integration:**
- **Trigger:** Nach compare-episodes.mjs (wenn neue Episode gefunden)
- **Step:** Zweiter Schritt im Podcast-Update Workflow
- **Konsequenz:** Generiert metadata.json für next Step
- **Abhängigkeit:** Nur wenn `missing_episode` nicht leer ist

**Ablauf in CI/CD:**
1. compare-episodes.mjs hat neue Episode gefunden
2. generate-metadata.mjs wird aufgerufen
3. GitHub Copilot analysiert Episode-Daten
4. Strukturierte Metadaten werden generiert
5. metadata.json wird im Workspace gespeichert
6. Wird von update-doag.mjs weiterverarbeitet

---

### update-doag.mjs

**Zweck:** Aktualisiert doag.md mit neuer Podcast-Episode und generiert eindeutige Episode-IDs.

**Beschreibung:**
- Liest Metadaten aus `metadata.json`
- Generiert eindeutige 5-stellige Episode-ID (z.B. `doag-voices-42857`)
- Validiert auf Duplikate mit existierenden Episodes
- Inserted Episode am **Anfang** des Episode-Arrays
- Aktualisiert doag.md Datei
- Supportet Dry-Run Mode (Validierung ohne Commit)

**Usage:**
```bash
# Mit commit und push
node scripts/workflows/podcast-update/update-doag.mjs

# Dry-run (nur validieren, kein commit)
node scripts/workflows/podcast-update/update-doag.mjs --dry-run
```

**Ablauf:**
1. Reads metadata.json
2. Extracts existing IDs from doag.md
3. Generates new unique ID
4. Inserts episode at array start
5. Updates doag.md
6. (wenn nicht --dry-run) Ready für git commit

**Abhängigkeiten:**
- metadata.json (von generate-metadata.mjs)
- doag.md (zu aktualisierende Datei)
- Node.js 24+

#### Verwendung im GitHub Workflow

**Podcast Update Workflow (.github/workflows/podcast-update.yml):**
```yaml
- name: Update dev branch
  run: |
    if [ "${{ github.event.inputs.dryRun }}" == "true" ]; then
      node scripts/workflows/podcast-update/update-doag.mjs --dry-run
      echo "🦁 DRY RUN: Skipping git commit and push."
    else
      node scripts/workflows/podcast-update/update-doag.mjs
      git add src/content/aboutme/doag.md
      git commit -m "feat(podcast): Add episode '$TITLE'" --no-verify
      git push origin dev
    fi
```

**Workflow-Integration:**
- **Trigger:** Nach generate-metadata.mjs (wenn keine Fehler)
- **Step:** Dritter Schritt im Podcast-Update Workflow
- **Konsequenz:** Commitet und pushed Episode zu dev-Branch
- **Abhängigkeit:** Nur wenn generate-metadata erfolgreich war

**Ablauf in CI/CD:**
1. generate-metadata.mjs hat Metadaten generiert
2. update-doag.mjs wird aufgerufen
3. Unique ID wird generiert
4. Episode wird in doag.md inserted
5. Datei wird aktualisiert
6. Git commit: `"feat(podcast): Add episode 'Title'"`
7. Git push zu dev-Branch
8. Triggert automatisch deploy-dev.yml Workflow

**Dry-Run Mode:**
```bash
node scripts/workflows/podcast-update/update-doag.mjs --dry-run
```
- Validiert Metadaten und ID-Generierung
- Aktualisiert doag.md temporär
- Kein Git Commit
- Nützlich für Tests und Validierung

---

## Installation & Wartung

### Automatische Installation nach npm install

```bash
npm install  # Führt postinstall-Hook aus
```

Dies führt automatisch aus:
```bash
npm run prose-install       # Vale installieren
npm run install-gh-copilot  # GitHub Copilot installieren
```

### Manuelle Re-Installation

```bash
# Vale Prose Checker neu installieren
npm run prose-install --force

# GitHub Copilot CLI neu installieren
npm run install-gh-copilot
```
