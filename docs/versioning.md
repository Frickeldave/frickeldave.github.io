# Versioning-System für Frickeldave

Dieses Dokument erklärt, wie das automatische Versioning-System funktioniert und wie du es verwendest.

## 🎯 Überblick

Wir verwenden ein **Git-basiertes, automatisches Versioning-System**, das die Version automatisch anpasst, wenn Code gemerged wird. Du musst **nichts manuell machen** – alles läuft automatisch!

### Version anzeigen

Die Version wird an **zwei Stellen** angezeigt:

1. **Floating Badge** (oben rechts) – nur in `local` und `dev` sichtbar
2. **Footer** – auf allen Seiten, zeigt Version und Build-Zeit

## 📋 Versions-Format

Wir verwenden **Semantic Versioning (SemVer)**: `vMAJOR.MINOR.PATCH`

Beispiel: `v1.3.5`
- **MAJOR** (1): Breaking Changes – manuell erhöhen
- **MINOR** (3): Neue Features – automatisch bei Merge nach `dev`
- **PATCH** (5): Bugfixes – automatisch bei Merge nach `main`

### Environment-spezifische Versionen

| Environment | Version-Format | Beispiel | Beschreibung |
|------------|----------------|----------|--------------|
| **Local** | `v0.0.0-dev-{branch}-{hash}` | `v0.0.0-dev-54-handmade-a1b2c3d` | Zeigt Branch + Commit |
| **Dev** | `v{major}.{minor}.0-dev-{hash}` | `v1.3.0-dev-a1b2c3d` | Pre-release für Testing |
| **Production** | `v{major}.{minor}.{patch}` | `v1.3.5` | Stabile Release-Version |

## 🚀 Wie funktioniert's?

### 1. Automatische Version-Bumps

Versionen werden **automatisch** bei Pull Requests erhöht:

#### Feature-Branch → `dev` (Minor Bump)
```
Aktuell: v1.2.3
Nach Merge: v1.3.0
```
- Neue Features, Content, Änderungen
- **MINOR** wird erhöht, **PATCH** wird auf 0 zurückgesetzt

#### `dev` → `main` (Patch Bump)
```
Aktuell: v1.3.0
Nach Merge: v1.3.1
```
- Stabiler Release nach Testing
- **PATCH** wird erhöht

### 2. GitHub Actions

Es gibt **zwei Workflows**, die automatisch laufen:

**`.github/workflows/version-bump-dev.yml`**
- Triggert bei: PR closed + merged nach `dev`
- Aktion: Minor Bump (`v1.2.3` → `v1.3.0`)
- Erstellt: Pre-release Tag + GitHub Release

**`.github/workflows/version-bump-main.yml`**
- Triggert bei: PR closed + merged nach `main`
- Aktion: Patch Bump (`v1.3.0` → `v1.3.1`)
- Erstellt: Production Tag + GitHub Release

### 3. Build-Zeit Version-Generierung

Bei jedem Build (lokal oder CI/CD) wird automatisch ein `public/version.json` erstellt:

```json
{
  "version": "v1.3.5",
  "environment": "production",
  "branch": "main",
  "commit": "a1b2c3d",
  "buildTime": "2025-11-14T15:42:00.000Z",
  "buildTimestamp": 1699972920000
}
```

**Script**: `scripts/generate-version.ts`  
**Läuft bei**: `npm run dev` und `npm run build` (via `prebuild` hook)

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
```

### Lokal testen

```bash
# Version generieren + Dev-Server starten
npm run dev

# Version wird in public/version.json geschrieben
# Badge und Footer zeigen Version an
```

### Manuelle Major-Version-Erhöhung

**Nur für Breaking Changes!**

```bash
# Aktuellen Tag abrufen
git tag -l

# Manuell Major-Tag erstellen (z.B. v2.0.0)
git tag -a v2.0.0 -m "Major release: Breaking changes"

# Tag pushen
git push origin v2.0.0
```

## 📦 Komponenten-Übersicht

### 1. Version-Generator Script
**Datei**: `scripts/generate-version.ts`

Generiert `public/version.json` basierend auf:
- Git Branch
- Git Commit Hash
- Build Environment (local/dev/production)
- Git Tags

### 2. Version Badge Component
**Datei**: `src/components/base/VersionBadge.astro`

Floating Badge (oben rechts) – zeigt:
- ✅ Version
- ✅ Environment (Local/Dev)
- ✅ Branch
- ✅ Commit Hash
- ✅ Build-Zeit

**Sichtbar**: Nur in `local` und `dev` (nicht in Production)

### 3. Footer mit Version
**Datei**: `src/components/base/Footer.astro`

Zeigt im Footer: `v1.3.5 | Built: 14.11.2025, 15:42`

### 4. GitHub Actions Workflows
**Dateien**:
- `.github/workflows/version-bump-dev.yml` (Minor Bump)
- `.github/workflows/version-bump-main.yml` (Patch Bump)

Automatische Version-Erhöhung bei PR-Merge.

## 🔍 Troubleshooting

### "Version wird nicht angezeigt"

**Problem**: Badge oder Footer zeigen keine Version.

**Lösung**:
```bash
# Version manuell generieren
npm run generate-version

# Prüfen ob version.json existiert
ls public/version.json
```

### "Git-Tag existiert nicht"

**Problem**: `git describe --tags` schlägt fehl.

**Lösung**: Erstelle einen initialen Tag:
```bash
git tag -a v0.1.0 -m "Initial version"
git push origin v0.1.0
```

### "Workflow läuft nicht"

**Problem**: GitHub Actions Workflow wird nicht getriggert.

**Lösung**:
1. Prüfe, ob PR **wirklich gemerged** wurde (nicht nur closed)
2. Prüfe Branch: Workflow läuft nur bei `dev` oder `main`
3. Prüfe Actions Tab in GitHub für Logs

## 📚 Weiterführende Infos

### Semantic Versioning (SemVer)
Mehr zu SemVer: https://semver.org/

### Git Tags
```bash
# Alle Tags anzeigen
git tag -l

# Spezifischen Tag abrufen
git describe --tags --abbrev=0

# Tag löschen (lokal + remote)
git tag -d v1.2.3
git push origin :refs/tags/v1.2.3
```

### NPM Scripts

| Script | Beschreibung |
|--------|--------------|
| `npm run dev` | Generiert Version + startet Dev-Server |
| `npm run build` | Generiert Version + baut Production |
| `npm run generate-version` | Nur Version generieren |

## 🎉 Zusammenfassung

1. **Automatisch**: Versionen werden automatisch bei PR-Merge erhöht
2. **Sichtbar**: Badge (dev/local) + Footer (alle Environments)
3. **Git-basiert**: Verwendet Git Tags als Single Source of Truth
4. **Keine manuelle Arbeit**: Du musst nichts machen!

**Bei Fragen**: Siehe diese Dokumentation oder frage im Team! 🚀
