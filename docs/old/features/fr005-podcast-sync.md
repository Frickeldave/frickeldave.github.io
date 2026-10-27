# FR005: Automatisierter Podcast-Update-Workflow

**Status:** Aktiv  
**Zuletzt aktualisiert:** 2026-10-26  
**Verantwortung:** frickeldave  

## Übersicht

Der Podcast-Update-Workflow (`fd-podcast-update.yml`) ist eine vollständig automatisierte GitHub
Actions Pipeline, die:

1. **Abruft** neue Episoden vom Acast RSS-Feed (DOAG VOICES)
2. **Vergleicht** Episoden mit vorhandenen Einträgen in `doag.md`
3. **Generiert** Episode-Metadaten mittels GitHub Copilot CLI
4. **Committet** die neue Episode direkt auf `dev`
5. **Stößt** `fd-ci` auf `dev` an, das bei Erfolg `fd-deploy-dev` auslöst
6. **Aktualisiert** bei `target=all` oder im Scheduler-Lauf zusätzlich `main` und deployt die Seite

## Architektur

### Datenfluss

```
Acast RSS-Feed
    ↓
    ├─→ Abrufen & Parsen (compare-episodes.mjs)
    ├─→ Vergleich mit doag.md Frontmatter
    └─→ Fehlende Episoden erkennen
            ↓
    Metadaten generieren (generate-metadata.mjs)
    ├─→ GitHub Copilot CLI abfragen
    ├─→ Strukturiertes JSON erstellen
    └─→ Metadaten validieren
            ↓
    doag.md aktualisieren (update-doag.mjs)
    ├─→ YAML Frontmatter parsen
    ├─→ Neuen Episode-Eintrag hinzufügen
    ├─→ Zeile-für-Zeile-Struktur beibehalten
    └─→ Datei zurück schreiben
            ↓
    Git-Operationen (Branch-Updates)
    ├─→ Checkout dev Branch
    ├─→ Mit --no-verify committen (Linter überspringen)
    ├─→ Push zu origin/dev
    │       ↓
    │   Deployment-Trigger (via workflow_dispatch API)
    │   └─→ fd-ci.yml auf 'dev' triggern
    │       └─→ erfolgreicher Lauf startet fd-deploy-dev.yml (workflow_run)
    │
    ├─→ Checkout main Branch (bei target='all' oder schedule)
    ├─→ Mit --no-verify committen
    └─→ Push zu origin/main
            ↓
    Job deploy-main im selben Workflow
    ├─→ withastro/action baut die Site
    └─→ actions/deploy-pages veröffentlicht GitHub Pages
            ↓
    Erfolgsmeldung
    ├─→ Episode-Details anzeigen
    └─→ Branch-Status bestätigen
```

> **Hinweis:** Der Workflow committet direkt auf `dev` (und bei Bedarf auf `main`), er erzeugt keine
> Pull Requests mehr.

### Content-Struktur

**RSS-Feed-Quelle:**
```
https://feeds.acast.com/public/shows/doag-voices-arbeitstitel
```

**Episoden gespeichert in:**
```
src/content/aboutme/doag.md
```

**Frontmatter-Format (YAML):**
```yaml
episodes:
  - id: doag-voices-10849
    title: "Low-Code, KI und die Zukunft der Softwareentwicklung"
    edition: "DevLand"
    date: "10. Februar 2026"
    guests: "Dave König, Vanessa Schmitz und Markus Bernhart"
    description: "..."
    links:
      spotify: "https://open.spotify.com/..."
      apple: "https://podcasts.apple.com/..."
      amazon: "https://music.amazon.de/..."
    audioUrl: "https://sphinx.acast.com/p/open/s/.../media.mp3"
```

## Workflow-Schritte

### 1. Verfügbarkeitsprüfungen
- **Repository auschecken** - Klont das Repo mit vollständigem Verlauf
- **Git-Konfiguration setzen** - hinterlegt `github-actions[bot]` als Autor
- **Node.js-Version prüfen** - stellt sicher, dass der Runner v24 mitbringt; der Job bricht hart ab,
  wenn das Image davon abweicht

### 2. Episode-Erkennung
- **Acast RSS abrufen** - HTTP-Abruf vom RSS-Feed
- **RSS XML parsen** - Episoden-Daten mit Regex extrahieren (Titel, Datum, Beschreibung, Audio-URL)
- **doag.md parsen** - Zeile-für-Zeile YAML-Parser für Frontmatter
  - Respektiert 2-Leerzeichen/4-Leerzeichen Einrückung
  - Verarbeitet komplexe verschachtelte Strukturen
  - Gibt Array von vorhandenen Episoden zurück
- **Episoden vergleichen** - Fuzzy-Matching bei:
  - Episode-Titel (normalisiert)
  - Veröffentlichungsdatum
  - Audio-URL
  - Gibt älteste fehlende Episode zurück

**Ausstiegsbedingung:** Wenn keine fehlenden Episoden, Workflow beendet sich sauber mit exit 0

### 3. Metadaten-Generierung
- **GitHub Copilot CLI aufrufen** - Sende Episode-Details + Context-Prompt
  - Erhalte Copilot-Antwort in JSON-Format
  - Extrahiere Metadaten aus Markdown-Code-Blöcken
  - Validiere erforderliche Felder (Titel, Edition, Gäste, Datum, Beschreibung, Links)
  - Speichere als `metadata.json`

### 4. Commit auf `dev`
- **doag.md aktualisieren** - Neue Episode in das Frontmatter-Array einfügen
- **Mit --no-verify committen** - Husky Pre-Commit-Hooks (Linting) überspringen
- **Nach `dev` pushen** - `git push origin dev`

### 5. CI und Dev-Deployment anstoßen
- **`fd-ci` auf `dev` dispatchen** - `workflow_dispatch` auf `fd-ci.yml` mit `ref: dev`
- **Weiterer Ablauf** - Ein erfolgreicher `fd-ci`-Lauf auf `dev` startet `fd-deploy-dev`, das
  HomeNet deployt und das Pre-Release `dev-v<version>` setzt

### 6. Update von `main` (nur bei `target=all` oder im Scheduler-Lauf)
- **`main` auschecken** - `git checkout main` und `git pull origin main`
- **doag.md aus `dev` übernehmen** - `git checkout dev -- src/content/aboutme/doag.md`, damit die
  Episode-ID identisch bleibt
- **Mit --no-verify committen und pushen** - `git push origin main`
- **Deployment im selben Workflow** - Der Job `deploy-main` baut die Site mit `withastro/action` und
  veröffentlicht sie mit `actions/deploy-pages`

> **Hinweis:** Frühere Fassungen dieses Workflows erzeugten Issues und Pull Requests. Der aktuelle
> Stand committet direkt auf die Branches.

### 7. Automatisierte Deployments

**WARUM manuelle Deployment-Trigger notwendig sind:**

GitHub Actions hat ein bewusst eingebautes Sicherheits-Feature: Workflows, die mit dem Standard-`GITHUB_TOKEN` einen Push durchführen, triggern **keine weiteren Workflows**. Das bedeutet, dass Push-Events vom Workflow nicht an andere Workflows weitergeleitet werden. Diese Limitierung verhindert:

- **Endlose Workflow-Ketten**: Ein Workflow triggert einen anderen, der wieder einen triggert, usw.
- **Rekursive Trigger-Loops**: Workflows, die sich gegenseitig aufrufen und nie terminieren
- **Unbeabsichtigte Cascading-Effekte**: Automatisierte Änderungen lösen ungewollte weitere Automationen aus

**Alternative Ansätze:**
- **Personal Access Token (PAT)**: Ein PAT würde die Limitation umgehen und automatische Trigger ermöglichen
  - ❌ **Nachteil**: Zusätzliches Secret-Management erforderlich
  - ❌ **Sicherheitsrisiko**: PAT hat breitere Permissions als nötig
  - ❌ **Wartungsaufwand**: Token müssen regelmäßig rotiert werden

**WIE der Dev-Trigger funktioniert:**

Statt auf einen automatischen Push-Trigger zu warten, verwendet der Workflow einen expliziten `workflow_dispatch`-API-Call auf `fd-ci`:

```yaml
- name: Trigger dev CI & deployment
  if: steps.update_dev.outcome == 'success' &&
      steps.check_episodes.outputs.missing_episode != '' &&
      github.event.inputs.dryRun != 'true'
  continue-on-error: true
  uses: actions/github-script@v7
  with:
    script: |
      await github.rest.actions.createWorkflowDispatch({
        owner: context.repo.owner,
        repo: context.repo.repo,
        workflow_id: 'fd-ci.yml',
        ref: 'dev'
      });
```

Ein erfolgreicher `fd-ci`-Lauf auf `dev` startet über `workflow_run` automatisch `fd-deploy-dev`.

**Warum `main` keinen Trigger mehr braucht:**

Der frühere „Trigger production deployment“-Schritt entfällt. Wenn der Workflow `main` aktualisiert,
baut und veröffentlicht der Job `deploy-main` die Seite im selben Lauf. `fd-deploy-prd` bleibt als
eigenständiger Produktions-Deploy verfügbar.

**Trigger-Conditions:**

Der Dev-Trigger läuft nur, wenn **alle** folgenden Bedingungen erfüllt sind:

- ✅ `steps.update_dev.outcome == 'success'` - Branch-Update war erfolgreich
- ✅ `steps.check_episodes.outputs.missing_episode != ''` - Eine fehlende Episode wurde gefunden
- ✅ `github.event.inputs.dryRun != 'true'` - Workflow läuft nicht im Dry-Run-Modus

**Error-Handling:**

Der Dev-Trigger verwendet `continue-on-error: true`. Das stellt sicher, dass:
- Deploy-Fehler den Podcast-Update-Workflow nicht komplett blockieren
- Episode-Updates als kritischer eingestuft werden (können nicht manuell nachgeholt werden)
- Deployments bei Bedarf manuell nachgetriggert werden können

**Vorteile dieser Architektur:**
- ✅ Keine zusätzlichen Secrets erforderlich
- ✅ Klare Trennung zwischen Content-Update und Deployment
- ✅ Robustes Fehlerhandling (Deploy-Fehler blockieren nicht Episode-Updates)
- ✅ Testbar über Dry-Run-Modus
- ✅ Einfache Wartung und Debugging

### 8. Erfolgsmeldung
- Zeigt Episode-Titel und die aktualisierten Branches
- Bestätigungsmeldung

## Konfiguration

### Erforderliche Secrets

1. **`GITHUB_TOKEN`** (automatisch bereitgestellt von Actions)
   - Verwendet für: Issue/PR-Erstellung, Branch-Verwaltung
   - Berechtigung: Standard Actions-Token mit Repo-Schreibzugriff

2. **`COPILOT_GITHUB_TOKEN`** (manuelle Einrichtung erforderlich)
   - Verwendet für: GitHub Copilot CLI Authentifizierung
   - Typ: Fine-grained Personal Access Token (PAT)
   - Erforderliche Berechtigung: `copilot:read`
   - Einrichtung: Repository-Einstellungen → Secrets and variables → Actions

### Erforderliche Branch-Einstellungen

Der Workflow committet und pusht direkt auf `dev` und `main`. Branch-Protection-Regeln dürfen diese
Pushes deshalb nicht blockieren; ein Pflicht-PR-Gate oder eine aktive Auto-Merge-Konfiguration ist
für diesen Workflow nicht nötig. Benötigt werden die Workflow-Permissions `contents: write`,
`actions: write`, `pages: write` und `id-token: write`.

### Scheduler

Läuft automatisch jeden **Dienstag um 09:00 CET** (08:00 UTC):
```yaml
schedule:
  - cron: '0 8 * * 2'  # 08:00 UTC = 09:00 CET (Winter) / 07:00 UTC = 09:00 CEST (Sommer)
```

Kann auch manuell ausgelöst werden mit:
```bash
gh workflow run fd-podcast-update.yml
```

## Helper-Skripte

### 1. compare-episodes.mjs
**Speicherort:** `scripts/workflows/podcast-update/compare-episodes.mjs`

**Verantwortungen:**
- Acast RSS-Feed via HTTPS abrufen
- XML-Episoden parsen (Regex-basierte Extraktion)
- HTML-Entities und CDATA-Tags bereinigen
- doag.md Zeile-für-Zeile lesen zum YAML-Parsen
- Episoden mit Fuzzy-Matching vergleichen (Titel, Datum, URL)
- JSON zu `missing-episode.json` ausgeben
- Ausgabe zu `GITHUB_OUTPUT` schreiben für nachfolgende Schritte

**Hauptfunktionen:**
```javascript
fetchAcastRSS()         // HTTPS-Abruf mit Fehlerbehandlung
parseRSSFeed(xml)       // Regex: Titel, Datum, Beschreibung, audioUrl
cleanHtml(html)         // CDATA und HTML-Entity-Kodierung entfernen
getExistingEpisodes()   // Zeile-für-Zeile YAML-Parser
episodeExists(title, date, etc)  // Fuzzy-Vergleich
```

### 2. generate-metadata.mjs
**Speicherort:** `scripts/workflows/podcast-update/generate-metadata.mjs`

**Verantwortungen:**
- Fehlende Episode aus `missing-episode.json` lesen
- Detaillierten Copilot-Prompt mit Kontext erstellen
- `gh copilot explain` via Subprocess ausführen
- JSON aus Copilot-Antwort parsen (verarbeitet Markdown-Code-Blöcke)
- Metadaten-Struktur validieren
- Strukturiertes JSON zu `metadata.json` ausgeben

**Prompt-Template:**
```
Du bist ein Podcast-Metadaten-Experte. Analysiere diese DOAG VOICES Episode und extrahiere:
- Deutscher Titel (professionell, prägnant)
- Edition (DevLand, FutureAI, People, CloudTalk)
- Gäste (komma-getrennt)
- Datum (Format: "D. Monat YYYY" auf Deutsch)
- Beschreibung (2-3 Sätze, professionelles Deutsch, max 300 Zeichen)
- Links (Spotify, Apple Podcasts, Amazon Music)

Episode-Details:
- Titel: {title}
- Datum: {date}
- Beschreibung: {description}
- Audio-URL: {audioUrl}

Antworte NUR mit gültigem JSON (kein Markdown-Wrapper).
```

### 3. update-doag.mjs
**Speicherort:** `scripts/workflows/podcast-update/update-doag.mjs`

**Verantwortungen:**
- Metadaten aus `metadata.json` lesen
- doag.md parsen um vorhandene Episoden zu extrahieren (für ID-Generierung)
- Eindeutige Episode-ID generieren (Format: `doag-voices-{zufällig5Ziffern}`)
- YAML-Frontmatter-Struktur parsen
- Neue Episode bei Einrückung beibehalten einfügen
- Aktualisierte Datei zurück auf Disk schreiben

**Einfügungslogik:**
- Behält 2-Leerzeichen Einrückung für Array-Items bei
- Bewahrt vorhandene Zeilenstruktur
- Fügt vor schließendem `---` Delimiter ein
