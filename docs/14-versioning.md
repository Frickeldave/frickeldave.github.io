# Versioning-System für Frickeldave

Dieses Dokument erklärt, wie das automatische Versioning-System funktioniert und wie du es verwendest.

## 🎯 Überblick

Wir verwenden ein **Git-Tag-basiertes, automatisches Versioning-System**. Das System ist bewusst **einfach gehalten**: 
- Die Version wird aus Git-Tags gelesen
- Das Environment wird aus der URL erkannt
- Automatische Version-Bumps bei Merges

### Version anzeigen

Die Version wird an **zwei Stellen** angezeigt:

1. **Floating Badge** (oben rechts) – nur in `local` und `dev` sichtbar, **versteckt auf Production**
2. **Footer** – auf allen Seiten/Environments, zeigt Version und Build-Zeit

## 📋 Versions-Format

Wir verwenden **Semantic Versioning (SemVer)**: `vMAJOR.MINOR.PATCH`

Beispiel: `v0.7.2`
- **MAJOR** (0): Breaking Changes – manuell erhöhen
- **MINOR** (7): Neue Features – automatisch bei Merge nach `dev`
- **PATCH** (2): Bugfixes/Content – automatisch bei Merge nach `main`

### Version-Anzeige nach Environment

| Environment | URL | Version-Anzeige | Badge sichtbar |
|------------|-----|-----------------|----------------|
| **Local** | `localhost` | Git-Tag (z.B. `v0.7.2`) | ✅ Ja (blau) |
| **Dev** | `test.frickeldave.de` o.ä. | Git-Tag (z.B. `v0.7.2`) | ✅ Ja (grün) |
| **Production** | `frickeldave.github.io`<br>`frickeldave.de` | Git-Tag (z.B. `v0.7.2`) | ❌ Nein |

**Wichtig**: Das Environment wird **client-side aus der URL** erkannt, nicht durch Build-Variablen!

## 🚀 Wie funktioniert's?

### 1. Git-Tags als Single Source of Truth

Die Version wird **immer** aus dem neuesten Git-Tag gelesen:

```bash
git describe --tags --abbrev=0
# Output: v0.7.2
```

Keine komplexen Environment-Variablen, keine Build-Konfigurationen. **Ein Tag = Eine Version.**

### 2. Automatische Version-Bumps

Versionen werden **automatisch** bei Pull Requests erhöht:

#### Feature-Branch → `dev` (Minor Bump)
```
Aktuell: v0.7.2
Nach Merge: v0.8.0
```
- Neue Features, Content, größere Änderungen
- **MINOR** wird erhöht, **PATCH** wird auf 0 zurückgesetzt
- Workflow: `.github/workflows/version-bump-dev.yml`

#### `dev` → `main` (Patch Bump)
```
Aktuell: v0.8.0
Nach Merge: v0.8.1
```
- Stabiler Release nach Testing
- **PATCH** wird erhöht
- Workflow: `.github/workflows/version-bump-main.yml`

### 3. Build-Zeit Version-Generierung

Bei jedem Build (lokal oder CI/CD) wird automatisch `public/version.json` erstellt:

```json
{
  "version": "v0.7.2",
  "branch": "feature/78-migrate-zwingenhalter",
  "commit": "a1b2c3d",
  "buildTime": "2025-12-11T19:24:46.718Z",
  "buildTimestamp": 1733944686718
}
```

**Script**: `scripts/generate-version.ts`  
**Läuft bei**: 
- `npm run dev` (via `generate-version` script)
- `npm run build` (via `prebuild` hook)

**Was es macht**:
```typescript
// Liest den neuesten Git-Tag
const tag = execCommand("git describe --tags --abbrev=0", "v0.0.0");

// Gibt Git-Branch und Commit-Hash zurück
const branch = git rev-parse --abbrev-ref HEAD
const commit = git rev-parse --short HEAD

// Schreibt version.json
writeFileSync("public/version.json", JSON.stringify(versionInfo))
```

### 4. Client-Side Environment-Erkennung

Das **VersionBadge** Widget erkennt das Environment aus der URL:

```javascript
function getEnvironment() {
  const hostname = window.location.hostname;
  
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "local";  // Blaues Badge
  }
  if (hostname === "frickeldave.github.io" || 
      hostname === "frickeldave.de" || 
      hostname === "www.frickeldave.de") {
    return "production";  // Badge versteckt!
  }
  return "dev";  // Grünes Badge (z.B. test.frickeldave.de)
}
```

**Vorteil**: Keine Build-Variablen nötig, funktioniert in jedem Deployment-Szenario (Container, GitHub Pages, etc.)

## 🛠️ Verwendung

### Normale Entwicklung

Du musst **NICHTS** machen! Das System arbeitet automatisch:

```bash
# 1. Feature-Branch erstellen
git checkout -b feature/my-new-feature

# 2. Änderungen machen
git add .
git commit -m "feat: meine neue Funktion"

# 3. Push + PR nach dev
git push origin feature/my-new-feature

# 4. PR mergen → Version wird automatisch gebumpt! 🎉
# version-bump-dev.yml läuft und erstellt neuen Tag (z.B. v0.8.0)
```

### Lokal testen

```bash
# Version generieren + Dev-Server starten
npm run dev

# Version wird automatisch generiert und in public/version.json geschrieben
# Badge zeigt: "LOCAL | v0.7.2 | Branch | Commit | Zeit"
# Footer zeigt: "v0.7.2 | Built: 11.12.2025, 19:24"
```

### Manuelle Tag-Erstellung (nur wenn nötig)

Normalerweise musst du das **nicht** machen, da die Workflows automatisch Tags erstellen.

**Aber**: Für spezielle Fälle (z.B. Initial-Setup oder Major-Version):

```bash
# Aktuellen Tag abrufen
git tag -l | sort -V | tail -1

# Neuen Tag erstellen
git tag -a v0.8.0 -m "Release v0.8.0: Migrate Zwingenhalter article"

# Tag pushen
git push origin v0.8.0
```

### Manuelle Major-Version-Erhöhung

**Nur für Breaking Changes!**

```bash
# Major-Tag erstellen (z.B. v1.0.0)
git tag -a v1.0.0 -m "Major release: Complete redesign"
git push origin v1.0.0
```

## 📦 Komponenten-Übersicht

### 1. Version-Generator Script
**Datei**: `scripts/generate-version.ts`

**Input**:
- Git-Tags (via `git describe --tags --abbrev=0`)
- Git-Branch (via `git rev-parse --abbrev-ref HEAD`)
- Git-Commit (via `git rev-parse --short HEAD`)

**Output**: `public/version.json`

**Läuft automatisch bei**:
- `npm run dev`
- `npm run build` (prebuild hook)

### 2. Version Badge Component
**Datei**: `src/components/base/VersionBadge.astro`

**Funktionalität**:
- Lädt `version.json` client-side
- Erkennt Environment aus URL
- Zeigt Badge nur bei `local` und `dev`
- Versteckt sich automatisch auf Production-Domains

**Anzeige**:
- Version (aus version.json)
- Environment (aus URL)
- Branch (aus version.json)
- Commit Hash (aus version.json)
- Build-Zeit (formatiert)

### 3. Footer mit Version
**Datei**: `src/components/base/Footer.astro`

**Funktionalität**:
- Lädt `version.json` client-side
- Zeigt auf **allen** Environments
- Format: `v0.7.2 | Built: 11.12.2025, 19:24`

### 4. GitHub Actions Workflows

**`.github/workflows/version-bump-dev.yml`** (Minor Bump)
- **Trigger**: PR closed + merged nach `dev`
- **Aktion**: 
  1. Liest aktuellen Tag (z.B. `v0.7.2`)
  2. Erhöht Minor (→ `v0.8.0`)
  3. Erstellt neuen Git-Tag
  4. Erstellt GitHub Release
- **Self-hosted Runner**: `frickeldave-main`

**`.github/workflows/version-bump-main.yml`** (Patch Bump)
- **Trigger**: PR closed + merged nach `main`
- **Aktion**:
  1. Liest aktuellen Tag (z.B. `v0.8.0`)
  2. Erhöht Patch (→ `v0.8.1`)
  3. Erstellt neuen Git-Tag
  4. Erstellt GitHub Release
- **Self-hosted Runner**: `frickeldave-main`

### 5. Deployment Workflows

**`.github/workflows/deploy-prd.yml`**
- Deployed nach GitHub Pages (Production)
- Nutzt `withastro/action@v3`
- Wichtig: `fetch-depth: 0` um alle Git-Tags zu fetchen

**`.github/workflows/deploy-dev.yml`**
- Triggert Ansible-Deployment (Container auf Waltraud)
- Ansible-Playbook muss `git fetch --tags` ausführen

## 🔍 Troubleshooting

### "Version zeigt v0.0.0"

**Problem**: Git-Tags werden nicht gefunden.

**Ursachen & Lösungen**:

1. **Kein Tag vorhanden**:
   ```bash
   git tag -a v0.1.0 -m "Initial version"
   git push origin v0.1.0
   ```

2. **Shallow Clone** (z.B. in CI/CD):
   ```yaml
   # In GitHub Actions
   - uses: actions/checkout@v4
     with:
       fetch-depth: 0  # ← Wichtig!
   ```

3. **Container-Build** (Dev auf Waltraud):
   - Ansible-Playbook muss `git fetch --tags` vor Build ausführen
   - Oder: Git-Clone mit `--tags` Option

### "Badge wird nicht versteckt auf Production"

**Problem**: Badge ist auf frickeldave.github.io sichtbar.

**Lösung**: 
1. Prüfe Browser-Konsole: `console.log(window.location.hostname)`
2. Checke `VersionBadge.astro` → `getEnvironment()` Funktion
3. Stelle sicher, dass Hostname-Check korrekt ist:
   ```javascript
   if (hostname === "frickeldave.github.io" || 
       hostname === "frickeldave.de") {
     return "production";  // Badge wird versteckt
   }
   ```

### "Workflow läuft nicht"

**Problem**: GitHub Actions Workflow wird nicht getriggert.

**Lösung**:
1. ✅ Prüfe, ob PR **wirklich gemerged** wurde (nicht nur closed)
2. ✅ Prüfe Branch: Workflow läuft nur bei Merge nach `dev` oder `main`
3. ✅ Prüfe Actions Tab in GitHub für Logs
4. ✅ Prüfe Workflow-Datei auf Syntax-Fehler

### "Version.json wird nicht erstellt"

**Problem**: `public/version.json` fehlt nach Build.

**Lösung**:
```bash
# Manuell ausführen
npm run generate-version

# Prüfen ob Script funktioniert
cat public/version.json

# Prüfen ob prebuild hook läuft
npm run build  # sollte generate-version automatisch aufrufen
```

## 📋 Best Practices

### ✅ DO's

- Lass die Workflows automatisch laufen
- Vertraue auf Git-Tags als Single Source of Truth
- Teste lokal mit `npm run dev` vor Push
- Nutze semantische Commit-Messages (`feat:`, `fix:`, `docs:`)

### ❌ DON'Ts

- Erstelle keine Tags manuell (außer für Major-Versionen oder Initial-Setup)
- Ändere keine Version-Werte hardcoded im Code
- Lösche keine alten Tags (Historie!)
- Skippe nicht die Workflows durch Force-Push

## 🎓 Beispiel-Workflow

```bash
# 1. Feature entwickeln
git checkout -b feature/new-article
# ... Änderungen machen ...
git commit -m "feat: add article about woodworking"
git push origin feature/new-article

# 2. PR nach dev erstellen & mergen
# → version-bump-dev.yml läuft
# → Neuer Tag: v0.8.0

# 3. Lokal pullen
git checkout dev
git pull origin dev
git fetch --tags

# 4. Version testen
npm run dev
# Badge zeigt: "LOCAL | v0.8.0 | dev | a1b2c3d | 11.12.2025 19:24"

# 5. Nach Testing: PR von dev nach main
# → version-bump-main.yml läuft  
# → Neuer Tag: v0.8.1

# 6. Production-Deployment
# GitHub Pages zeigt: Footer "v0.8.1 | Built: ..."
# Badge ist versteckt ✅
```

## 📚 Weitere Dokumentation

- [Semantic Versioning](https://semver.org/)
- [Git Tags](https://git-scm.com/book/en/v2/Git-Basics-Tagging)
- [GitHub Actions](https://docs.github.com/en/actions)
