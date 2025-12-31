# Auto-Merge Workflow für Feature → Dev → Main

**Datum:** 2025-11-23  
**Modell:** Claude Sonnet 4.5

## Ursprünglicher Prompt

Boa ey, der Merge von Feature Branch (FB) auf dev und von dev auf main kostet echt immer unheimlich viel Zeit. In der Regel mache ich diese Merge Vorgänge mit einem GitHub PR. Da ich alleine an dem Projekt arbeite, könnte man diese Aufgabe eigentlich irgendwie automatisieren. Ich habe momentan 2 Ideen: 

1) einen Prompt als Datei schreiben der das durchführt
2) Eine VSCode Run & Debug Action schreiben

Problem könnte natürlich immer sein, wenn merge Konflikte auftreten. Hier wäre eine Option cool, die es mir ermöglicht die "Incoming" changes zu akzeptieren. 

Hast du noch weitere Ideen?

## Kontext

- Alleiniger Entwickler am Projekt
- Aktueller Workflow: Feature Branch → PR zu dev → PR zu main
- Zeitaufwändig durch manuelle PR-Erstellung
- Merge-Konflikte sollen automatisch mit "theirs" Strategy gelöst werden
- Bestehende Infrastruktur: Self-hosted GitHub Runner, Husky Pre-Commit Hooks, GitHub Actions

## Lösungsansätze

### 1. GitHub Actions Workflow (Empfohlen)
- Auto-Merge bei Push auf `feature/**` Branches
- Nutzt bestehende Self-hosted Runner
- Konflikt-Resolution mit `-X theirs` Strategy

### 2. VS Code Task + Shell Script
- Manueller Trigger via Tasks
- Lokale Kontrolle über Merge-Prozess
- Kombinierbar mit GitHub Actions

### 3. GitHub CLI + VS Code Task
- PR-basierter Workflow mit Auto-Merge
- Nutzt bestehende PR-Checks

### 4. Git Hooks via Husky
- Komplett automatisch nach Push
- Kann bei experimentellen Pushes stören

## Implementierungsplan

**Finales Konzept (nach User-Feedback):**
Lokales, plattformunabhängiges Script mit GitHub CLI statt Hybrid-Ansatz

**Entscheidung für lokales Script weil:**
- User arbeitet alleine → keine Notwendigkeit für vollautomatische GitHub Actions
- Mehr Kontrolle über Merge-Prozess
- GitHub CLI bietet alle notwendigen Features
- Plattformunabhängig durch Node.js

## Implementierte Dateien

### 1. `scripts/merge-branches.mjs`
**Hauptscript für automatisierte PR-Erstellung und Merge**

**Features:**
- Plattformunabhängig (Node.js .mjs Modul)
- Automatische Branch-Erkennung (`feature/*` → `dev`, `dev` → `main`)
- Intelligente Merge-Strategy:
  - **Feature Branch → dev**: Feature gewinnt (`-X ours`)
  - **dev → main**: dev gewinnt (`-X ours`)
- Pre-Flight Checks:
  - GitHub CLI Installation + Authentifizierung
  - Uncommitted Changes Prüfung
- Test-Merge zur Konfliktprüfung vor PR-Erstellung
- Auto-Merge via `gh pr merge --auto --merge`
- Interaktive Konfliktauflösung bei Bedarf (Browser-basiert)
- Colored Terminal Output für bessere UX

**Usage:**
```bash
node scripts/merge-branches.mjs        # Auto-Erkennung
node scripts/merge-branches.mjs dev    # Explizit zu dev
node scripts/merge-branches.mjs main   # Explizit zu main
```

### 2. `.vscode/tasks.json`
**VS Code Task-Integration für einfachen Zugriff**

**3 Tasks:**
- `Merge: Auto → dev/main` - Automatische Target-Erkennung
- `Merge: → dev` - Explizit zu dev Branch
- `Merge: → main` - Explizit zu main Branch

**Aufruf:** `Ctrl+Shift+P` → "Tasks: Run Task"

### 3. `package.json` - NPM Scripts
**Neue Scripts hinzugefügt:**
```json
"merge": "node scripts/merge-branches.mjs",
"merge:dev": "node scripts/merge-branches.mjs dev",
"merge:main": "node scripts/merge-branches.mjs main"
```

**Usage:**
```bash
npm run merge        # Auto-Erkennung
npm run merge:dev    # Zu dev
npm run merge:main   # Zu main
```

### 4. `docs/branching.md`
**Dokumentation aktualisiert:**
- Neuer Abschnitt "Option A: Automatisiert via Script (Empfohlen)"
- Merge-Strategy Tabelle hinzugefügt
- VS Code Tasks dokumentiert
- Alternative manuelle Workflows beibehalten

## Technische Details

### Merge-Strategy Logik
```javascript
// Feature Branch → dev: Feature gewinnt
if (targetBranch === 'dev') {
  strategy = 'ours'; // Source Branch (Feature) gewinnt
}

// dev → main: dev gewinnt
if (sourceBranch === 'dev' && targetBranch === 'main') {
  strategy = 'ours'; // Source Branch (dev) gewinnt
}
```

**Wichtig:** Git's `-X ours` bedeutet "aktuelle Branch gewinnt", daher:
- Bei Merge von Feature → dev: Feature ist Source → `ours` = Feature gewinnt ✅
- Bei Merge von dev → main: dev ist Source → `ours` = dev gewinnt ✅

### Konflikt-Handling Workflow
1. Script erstellt temporären Test-Branch vom Target
2. Versucht Merge mit Strategy
3. Prüft `git status --porcelain` auf Konflikt-Marker (UU, AA, DD)
4. Bei Konflikten:
   - Erstellt trotzdem PR
   - Öffnet Browser für manuelle Konfliktauflösung
   - User kann GitHub Conflict-Editor nutzen

### Voraussetzungen
**GitHub CLI Installation:**
```bash
# Ubuntu/Debian
sudo apt install gh

# macOS/Linux via Homebrew
brew install gh

# Authentifizierung
gh auth login
```

## Test-Plan
1. Issue #60 Branch erstellt: `60-implement-a-more-effective-merging-strategy`
2. Test mit realen Änderungen:
   - Neue Dateien: `scripts/merge-branches.mjs`, `.vscode/tasks.json`
   - Geänderte Dateien: `package.json`, `docs/branching.md`, `prompts.md`
3. Erwartetes Verhalten:
   - Script erkennt Feature-Branch → dev als Target
   - Test-Merge zeigt keine Konflikte (neue Dateien)
   - PR wird erstellt und auto-merged
   - Lokaler dev Branch wird aktualisiert

## Implementation Verlauf

### Erfolgreiche Schritte
1. ✅ `scripts/merge-branches.mjs` erstellt - Plattformunabhängiges Node.js Script
2. ✅ `.vscode/tasks.json` erstellt - VS Code Integration
3. ✅ `package.json` erweitert - NPM Scripts (`merge`, `merge:dev`, `merge:main`)
4. ✅ `docs/branching.md` aktualisiert - Dokumentation
5. ✅ GitHub CLI Installation und Authentifizierung erfolgreich
6. ✅ Issue-Branch Pattern Support hinzugefügt (`/^\d+-/` Regex)
7. ✅ Pre-Flight Checks funktionierten (gh CLI, Auth, Uncommitted Changes)
8. ✅ Test-Merge Mechanik funktionierte
9. ✅ Branch-Erkennung funktionierte (`60-...` → `dev`)

### Gescheiterte Schritte
1. ❌ **Shell-Escaping Probleme**: Backticks im PR-Body wurden als Shell-Commands interpretiert
2. ❌ **File I/O Inkonsistenzen**: `replace_string_in_file` Tool zeigte inkonsistente Ergebnisse
   - VS Code Buffer zeigte neue Version
   - Filesystem hatte alte Version
   - Node.js lud cached Version
3. ❌ **gh pr create Fehler**: "Head sha can't be blank, No commits between dev and branch"
4. ❌ **Merge-Konflikte**: Branch-Protection Rules verhinderten Auto-Merge
5. ❌ **Komplexität**: Zu viele Edge-Cases für Shell-Escaping, Git-States, PR-Creation

## Entscheidung: Rollback

**Grund:**
- Implementation zu fragil und unkontrollierbar
- Shell-Escaping-Probleme zu komplex
- Tooling-Inkonsistenzen (replace_string_in_file, Git, Node.js Cache)
- Für Solo-Entwickler ist manueller Workflow ausreichend kontrollierbar

**Durchgeführt:**
```bash
git checkout dev
git reset --hard origin/dev
git branch -D 60-implement-a-more-effective-merging-strategy
gh pr close 61 --comment "Rollback: Implementation zu komplex"
```

**Status:** Alle Änderungen zurückgerollt, Repository im sauberen Zustand

## Lessons Learned
- ❌ **Shell-Escaping in Node.js** ist fehleranfällig bei komplexen Strings (Backticks, Quotes, Newlines)
- ❌ **gh CLI PR-Creation** hat strikte Requirements (commits müssen existieren, branches müssen korrekt sein)
- ❌ **Tool-Caching** kann zu inkonsistenten File-States führen (VS Code Buffer ≠ Filesystem ≠ Node.js)
- ✅ **GitHub CLI** ist grundsätzlich mächtig (Installation, Auth, PR-Operations funktionieren)
- ✅ **Pre-Flight Checks** waren solide implementiert
- ⚠️ **Für Solo-Projekte**: Manuelle PR-Workflows sind oft besser kontrollierbar als Automation
- 💡 **Alternative Ansätze für Zukunft**:
  - GitHub Actions Workflow (serverseitig, keine Shell-Escaping-Probleme)
  - Einfachere Scripts ohne PR-Creation (nur git merge + push)
  - GitHub Web-Interface nutzen (bewährter Workflow)
