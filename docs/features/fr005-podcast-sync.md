# FR005: Automatisierter Podcast-Update-Workflow

**Status:** Aktiv  
**Zuletzt aktualisiert:** 2026-02-11  
**Verantwortung:** frickeldave  

## Übersicht

Der Podcast-Update-Workflow (`podcast-update.yml`) ist eine vollständig automatisierte GitHub Actions Pipeline, die:

1. **Abruft** neue Episoden vom Acast RSS-Feed (DOAG VOICES)
2. **Vergleicht** Episoden mit vorhandenen Einträgen in `doag.md`
3. **Generiert** Episode-Metadaten mittels GitHub Copilot CLI
4. **Erstellt** ein GitHub Issue für die Nachverfolgung
5. **Aktualisiert** die doag.md-Datei mit neuen Episoden
6. **Verwaltet** PRs über dev → main Branches
7. **Mergt automatisch** mit Squash-Commits sobald CI-Checks bestanden

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
    Git-Operationen
    ├─→ Feature-Branch erstellen
    ├─→ Mit --no-verify committen (Linter überspringen)
    ├─→ Zu Origin pushen
    └─→ PR zu dev erstellen
            ↓
    Auto-Merge (gh pr merge --auto)
    ├─→ Auf CI-Checks warten
    ├─→ Zu dev mergen (Squash)
    ├─→ PR dev → main erstellen
    └─→ Zu main mergen (Squash)
```

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
- **GitHub CLI prüfen** - Verifiziert ob `gh` Befehl verfügbar ist
- **GitHub Authentication prüfen** - Validiert `GH_TOKEN` Secret
- **GitHub Copilot CLI prüfen** - Verifiziert `gh copilot` Erweiterung
- **Repository auschecken** - Klont Repo mit vollständigem Verlauf
- **Node.js-Version prüfen** - Stellt sicher, dass v24 installiert ist (via NVM)

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

### 4. Issue & PR-Erstellung
- **GitHub Issue erstellen** - Tracker mit Label `podcast-update`
- **Feature-Branch erstellen** - Format: `podcast-update-{TIMESTAMP}-{SLUG}`
- **doag.md aktualisieren** - Neue Episode in Frontmatter-Array einfügen
- **Mit --no-verify committen** - Husky Pre-Commit-Hooks (Linting) überspringen
- **Branch pushen** - Zu Origin hochladen

### 5. PR-Verwaltung (dev Branch)
- **PR zu dev erstellen** - Base: dev, Head: Feature-Branch
- **Auto-Merge mit Copilot** - `gh pr merge --auto --squash`
  - Wartet auf alle CI-Checks
  - Erfordert "Allow auto-merge" auf dev Branch aktiviert
  - Verwendet Squash-Strategie für sauberen Verlauf
- **PR-Merge verifizieren** - Prüfe finalen Status

### 6. Deployment zu main
- **Dev Branch auschecken** - Wechsel zu aktualisiertem dev
- **PR zu main erstellen** - Base: main, Head: dev
- **Auto-Merge zu main** - Gleiche Merge-Strategie wie dev
- **PR-Merge verifizieren** - Bestätige erfolgreiches Merge

### 7. Erfolgsmeldung
- Zeige Episode-Titel, Issue-Link und PR-Links
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

Beide `dev` und `main` Branches benötigen Schutzregeln mit Auto-Merge aktiviert:

**GitHub Einstellungen → Branches → Branch protection rules:**

Für jeden von `dev` und `main`:
```
✅ Einen Pull Request vor dem Zusammenführen erforderlich
✅ Stale Pull-Request-Genehmigungen verwerfen bei neuen Commits
✅ Auto-Merge zulassen
  └─ ☑ Squash-Zusammenführung zulassen
```

⚠️ **Wichtig:** Stelle zusätzlich sicher, dass die Repository-Option "Allow auto-merge" in den allgemeinen Settings aktiviert ist:

**GitHub Einstellungen → General → Pull Requests:**
```
✅ Allow auto-merge
```

Ohne diese Repository-Level-Einstellung funktioniert `gh pr merge --auto` nicht, auch wenn die Branch-Regel aktiviert ist!

### Scheduler

Läuft automatisch jeden **Dienstag um 09:00 CET** (08:00 UTC):
```yaml
schedule:
  - cron: '0 8 * * 2'  # 08:00 UTC = 09:00 CET (Winter) / 07:00 UTC = 09:00 CEST (Sommer)
```

Kann auch manuell ausgelöst werden mit:
```bash
gh workflow run podcast-update.yml
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

## Fehlerbehebung

### Problem: Workflow beendet sich mit "Keine neuen Episoden gefunden"
**Grund:** Alle RSS-Episoden bereits in doag.md  
**Lösung:** Neue Episode wurde noch nicht im RSS veröffentlicht, oder Duplikat-Erkennung ist zu streng

### Problem: "COPILOT_GITHUB_TOKEN ist nicht gesetzt"
**Grund:** Secret nicht im Repository konfiguriert  
**Lösung:** 
```bash
# Erstelle Fine-grained PAT unter https://github.com/settings/tokens
# Berechtigung: copilot:read
# Hinzufügen zum Repo: Einstellungen → Secrets and variables → Actions
```

### Problem: "GraphQL: Pull request ... enablePullRequestAutoMerge"
**Grund:** Auto-Merge nicht auf Ziel-Branch aktiviert  
**Lösung:** Aktivieren unter GitHub → Einstellungen → Branches → Branch protection rules

### Problem: Workflow hängt bei "Verifiziere PR ist gemergt"
**Grund:** CI-Checks laufen noch, Workflow-Timeout nach 10 Minuten  
**Lösung:** Prüfe GitHub Actions-Logs auf aktuellen Status; merge manuell falls nötig

### Problem: YAML-Parsing findet Episoden nicht
**Grund:** Unerwartete Einrückung oder Struktur in doag.md  
**Lösung:** Verifiziere dass Frontmatter exakt 2-Leerzeichen/4-Leerzeichen Format folgt; prüfe auf Tabs

## Entwicklung

### Lokales Testen

**Episode-Vergleich testen:**
```bash
node scripts/workflows/podcast-update/compare-episodes.mjs
# Ausgabe: missing-episode.json
```

**Metadaten-Generierung testen:**
```bash
# Erstelle zuerst missing-episode.json manuell, dann:
export GITHUB_TOKEN="your-copilot-token"
node scripts/workflows/podcast-update/generate-metadata.mjs
# Ausgabe: metadata.json
```

**doag.md Update testen:**
```bash
# Erstelle zuerst metadata.json manuell, dann:
node scripts/workflows/podcast-update/update-doag.mjs
# Aktualisiert: src/content/aboutme/doag.md
```

### Debug-Ausgabe hinzufügen

Alle Skripte schreiben zu stdout. Workflow-Logs prüfen unter:
```
GitHub → Actions → Podcast Update → [Run ID] → podcast-update job
```

## Performance

- **Workflow-Dauer:** ~3-5 Minuten gesamt
  - Checks: 20 Sekunden
  - RSS-Abruf + Parsen: 5 Sekunden
  - Copilot Metadaten-Generierung: 15-20 Sekunden
  - Git-Operationen + PR-Erstellung: 30 Sekunden
  - CI-Checks (pull-request-checks.yml): ~1-2 Minuten
  - Auto-Merge: 10-30 Sekunden

- **API-Aufrufe:**
  - Acast RSS: 1x HTTP-Request (~2 Sekunden)
  - GitHub Copilot: 1x CLI-Aufruf (~15 Sekunden)
  - GitHub API (via gh CLI): ~5 Aufrufe

## Zukünftige Verbesserungen

- [ ] Unterstützung mehrerer Podcast-Feeds (nicht nur DOAG VOICES)
- [ ] Episode-Artwork/-Thumbnail-Extraktion hinzufügen
- [ ] Episode-Transkript-Parsing implementieren
- [ ] Slack-Benachrichtigungen für neue Episoden hinzufügen
- [ ] Social-Media-Templates für Podcast-Episoden erstellen
- [ ] RSS-Feed cachen für schnellere Duplikat-Erkennung
- [ ] Manuellen Episode-Override-Mechanismus hinzufügen

## Verwandte Dokumentation

- [GitHub Actions Best Practices](../linter/01-linter-start.md)
- [Content Collections](../20-design-system.md)
- [YAML Frontmatter Spec](../13-structure.md)
