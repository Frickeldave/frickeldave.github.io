# Skript-Dokumentation

Diese Seite beschreibt alle Hilfsskripte unter `scripts/`. Sie sind in Node.js geschrieben, laufen
plattformübergreifend (Windows, Linux, macOS) und decken Build, Prosa-Prüfung, Issue-Workflows,
Release, Projekt-Board, Übersetzung und Podcast-Sync ab.

Fast jedes Skript lässt sich über ein npm-Skript aufrufen. Wo es kein npm-Skript gibt, steht der
direkte `node`-Aufruf daneben. Externe Werkzeuge, die einzelne Skripte erwarten: Git, GitHub CLI
(`gh`), optional `tmux` und `kubectl` (nur Bootstrap).

## Inhaltsverzeichnis

- [Schnellstart](#schnellstart)
- [Build und 3D-Modelle](#build-und-3d-modelle)
- [Prosa-Prüfung mit Vale](#prosa-prüfung-mit-vale)
- [Issue- und Branch-Workflows](#issue--und-branch-workflows)
- [Release-Gate für Pull Requests](#release-gate-für-pull-requests)
- [Gemeinsame Module](#gemeinsame-module)
- [Projekt-Board synchronisieren](#projekt-board-synchronisieren)
- [Übersetzung von Inhalten](#übersetzung-von-inhalten)
- [Runner-Bootstrap](#runner-bootstrap)
- [Podcast-Update](#podcast-update)
- [Tests](#tests)
- [Hinweise](#hinweise)

## Schnellstart

| npm-Skript        | Datei                            | Zweck                                        |
| ----------------- | -------------------------------- | -------------------------------------------- |
| `scad:install`    | `install-openscad.mjs`           | OpenSCAD lokal installieren                  |
| `scad:render`     | `build-scad.mjs`                 | 3D-Modelle rendern                           |
| `prose-install`   | `prose-install.mjs`              | Vale und Styles installieren                 |
| `prose`           | `prose-check.mjs`                | Prosa mit Vale prüfen                        |
| `bootstrap`       | `bootstrap/bootstrap.mjs`        | Self-hosted Runner bootstrappen              |
| `test:bootstrap`  | `bootstrap/bootstrap.test.mjs`   | Tests des Bootstrap-Skripts                  |
| `start-work`      | `start-work.mjs`                 | Issue-Branch, Worktree und Draft-PR          |
| `start-reqeng`    | `start-reqeng.mjs`               | Requirement-Engineering-Session              |
| `start-review`    | `start-review.mjs`               | Review-Worktree für einen PR                 |
| `versionbump`     | `versionbump.mjs`                | Version und Changelog anheben                |
| `test:scripts`    | `*.test.mjs`                     | Tests der Start-Flow- und Release-Skripte    |

`postinstall` besteht aus `npm run prose-install && npm run scad:install`, damit nach `npm install`
sowohl Vale als auch OpenSCAD bereitstehen.

## Build und 3D-Modelle

### `build-scad.mjs`

```bash
npm run scad:render
node scripts/build-scad.mjs
```

Sucht alle SCAD-Quelldateien, rendert daraus STL-Dateien, erzeugt die Metadaten-JSON und cached das
Ergebnis über einen Datei-Hash. Die Ausgabe landet unter `dist/3dmodels/`; generierte Dateien werden
nicht eingecheckt. `npm run build` ruft das Skript vor `astro build` auf, und `fd-ci` fährt einen
eigenen Smoke-Test für den 3D-Build.

### `install-openscad.mjs`

```bash
npm run scad:install
node scripts/install-openscad.mjs            # interaktiv
node scripts/install-openscad.mjs --quiet    # ohne Rückfragen
node scripts/install-openscad.mjs --force    # Neuinstallation erzwingen
```

Lädt die OpenSCAD-CLI für die aktuelle Plattform herunter und entpackt sie in ein projektlokales
Verzeichnis. Existiert bereits ein `openscad` im `PATH`, wird das genutzt. Das Skript läuft
automatisch im `postinstall`-Hook.

### `get-openscad-path.mjs`

Kein eigenständiges Kommando, sondern ein Modul: Es liefert den Pfad zur OpenSCAD-Binary in dieser
Reihenfolge — `openscad` aus dem `PATH`, dann die projektlokale Installation, sonst `null`.
`build-scad.mjs` importiert die Funktion.

```javascript
import { getOpenSCADPath } from "./scripts/get-openscad-path.mjs";

const openscad = getOpenSCADPath();
```

## Prosa-Prüfung mit Vale

### `prose-check.mjs`

```bash
npm run prose
```

Ruft Vale mit `.vale.ini` gegen `src/content` auf und verwendet die Binary aus `.vale/`
(`vale` bzw. `vale.exe`). Geprüft werden also die Inhalte der Site, nicht die Projektdokumentation
unter `docs/`.

### `prose-install.mjs`

```bash
npm run prose-install
node scripts/prose-install.mjs            # interaktiv
node scripts/prose-install.mjs --quiet    # ohne Rückfragen
node scripts/prose-install.mjs --force    # Neuinstallation erzwingen
```

Lädt die Vale-Binary (3.7.1) samt der Styles `Microsoft` und `write-good` nach `.vale/` und setzt die
Ausführungsrechte. Läuft automatisch im `postinstall`-Hook.

## Issue- und Branch-Workflows

### `start-work.mjs`

```bash
npm run start-work -- IS_480
npm run start-work -- IS_480 --notmux
npm run start-work -- IS_480 --prompt "Setze beim letzten Schritt fort"
```

Bereitet die Umsetzung eines Issues vor: löst den kanonischen Issue-Kontext auf, prüft bei Bedarf die
Issue-Gates, legt den Issue-Branch nach Conventional Branch Names an
(`<type>/issue-<n>-<slug>` auf Basis von `dev`) und erstellt bzw. verwendet den kanonischen Worktree
wieder. Danach öffnet das Skript den Draft-PR gegen `dev` und startet Copilot im Worktree mit dem
Hinweis, `.github/prompts/startwork.prompt.md` zu lesen.

Flags: `--notmux` (ohne tmux-Session, auf Windows der Standardweg), `--prompt <text>`,
`--noprompt`, `--model <id>` und `--no-provider`. Die beiden letzten steuern den optionalen
DeepSeek-Provider; Details stehen in [Copilot-Provider (DeepSeek)](../docs/17-dev-copilot-provider.md).

Die Flags `--model` und `--no-provider` gelten für alle drei Start-Flows:

- `--model deepseek-v4-flash|deepseek-v4-pro` wählt das Modell für genau diesen Lauf und
  überschreibt die Konfigurationsdatei. Ein anderes Modell bricht den Flow mit Exit ≠ 0 ab.
- `--no-provider` ignoriert eine vorhandene Provider-Konfiguration für diesen Lauf und startet mit
  den GitHub-Copilot-Modellen.

### `start-reqeng.mjs`

```bash
npm run start-reqeng -- IS_480
```

Gleicher Ablauf wie `start-work`, aber für Requirement Engineering: eigener Worktree und eine Session,
die mit `.github/prompts/startreqeng.prompt.md` arbeitet. Das Issue-Ref-Format `IS_480` und `is480`
werden beide akzeptiert. `--model` und `--no-provider` verhalten sich wie bei `start-work`.

### `start-review.mjs`

```bash
npm run start-review -- PR_480
```

Legt einen Review-Worktree auf dem Head-Branch eines bestehenden Pull Requests an und startet die
Session mit `.github/prompts/startreview.prompt.md`. Der Review endet mit einem Verdict; gemergt wird
erst nach ausdrücklicher menschlicher Freigabe. `--model` und `--no-provider` verhalten sich wie bei
`start-work`.

### `ensure-issue-branch.mjs`

Kein eigenständiges Kommando, sondern ein Modul für die Start-Flow-Skripte: Es leitet Branch-Typ und
-slug aus dem Issue ab und erzeugt den Branch nach der Repo-Policy
`<type>/issue-<n>-<slug>` mit Basis `dev`. Das frühere Schema `squad/<issue>-<type>` ist bewusst
entfernt, weil `.husky/pre-push-validate.js` nur Conventional Branch Names akzeptiert.

### `merge-branches.mjs`

```bash
node scripts/merge-branches.mjs          # automatische Branch-Erkennung
node scripts/merge-branches.mjs dev      # explizit nach dev
node scripts/merge-branches.mjs main     # explizit nach main
```

Erstellt über die GitHub CLI einen Pull Request, kann ihn per Auto-Merge zusammenführen und bietet bei
Konflikten eine interaktive Auflösung an. Für `main` ist das Skript **nicht** der Release-Weg: Die
Produktion läuft ausschließlich über `fd-promote-prd.yml` und `fd-deploy-prd.yml` mit Versions-Gate
(siehe [FR006](../docs/features/fr006-autodeploy.md)).

### `versionbump.mjs`

```bash
npm run versionbump            # fragt nach der Zielversion
npm run versionbump 1.2.3      # Version direkt setzen
```

Hebt `version` in `package.json` und `package-lock.json` an und verschiebt die Einträge unter
`## [Unreleased]` in einen neuen Abschnitt `## [x.y.z]` in `CHANGELOG.md`. Genau diesen Abschnitt
verlangt `fd-deploy-prd` vor einem Promote. Das Skript committet und pusht nicht — Commit und Push
bleiben ein bewusster eigener Schritt.

## Release-Gate für Pull Requests

Zwei Skripte, ein Regelwerk. `release-gate.mjs` ist rein (keine Seiteneffekte, kein `git`/`gh`) und
exportiert `evaluateReleaseGate()`, `extractDevReleaseVersion()`, `findHighestDevReleaseVersion()`
und `readRootVersion()`. `check-release-label.mjs` ist die CLI davor; sie wird vom PR-Check
`fd-pr-release-label` und vom Husky-Hook `.husky/pre-push` aufgerufen.

```bash
# CI-Modus (bindend): Labels aus LABELS-Env oder GitHub-API
node scripts/check-release-label.mjs --ci --repo Frickeldave/frickeldave.github.io --base dev

# Lokaler Modus (Husky-Hook): liest den offenen PR zum aktuellen Branch über gh
node scripts/check-release-label.mjs
```

Regeln: genau eines von `release:yes` / `release:no`; `release:yes` verlangt eine strikt höhere
Version als das höchste `dev-v*`-Release, `release:no` exakt die Version an der Merge-Base mit
`origin/dev`. Der lokale Modus blockiert nur bei einem offenen `dev`-PR mit Regelverstoß — fehlt
`gh`, gibt es keinen PR oder ist etwas nicht lesbar, endet er grün. Details in
[Versionierung und Release](../docs/workflow/versionierung%20und%20release.md).

## Gemeinsame Module

Diese Dateien werden von den Start-Flow-Skripten importiert und haben keinen eigenen npm-Aufruf:

- `flow-shared.mjs` — gemeinsame Helfer der Flow-Skripte: Flag-Parsing (`--notmux`, `--prompt`,
  `--noprompt`), Worktree-Pfade, tmux-Start, Projekt-Zugriff, Issue-Erkennung. Enthält auch die
  Defaults für das Projekt-Board (`PROJECT_OWNER`, `PROJECT_NUMBER`).
- `platform-shared.mjs` — plattformabhängiges Starten von Prozessen. Auf Windows sind `npm`, `npx`
  und `copilot` `.cmd`-Shims, die seit Node 20.12 `shell: true` und korrektes Quoting brauchen.
- `copilot-environment.mjs` — prüft und richtet die Copilot-CLI-Umgebung ein (Auth, Terminal,
  VS-Code-Settings) und meldet den Provider-Status. Auch direkt aufrufbar:

  ```bash
  node scripts/copilot-environment.mjs auth
  node scripts/copilot-environment.mjs terminal
  node scripts/copilot-environment.mjs status
  node scripts/copilot-environment.mjs provider
  node scripts/copilot-environment.mjs provider --line
  node scripts/copilot-environment.mjs provider --state
  ```

  Die `provider`-Aufrufe arbeiten offline: kein API-Call, kein Key-Inhalt. `--line` liefert genau
  eine Zeile für das Login-Banner `fd-welcome`, `--state` nur `set`, `unset` oder `invalid-permissions`.
- `copilot-provider.mjs` — löst den Start-Plan der Copilot CLI auf und liest dafür die
  fd-Konfiguration unter `~/.config/fd/`. Exportiert `resolveCopilotLaunchPlan()` (Ergebnis
  `{ mode, model, envDelta, envUnset, warnings }`), `copilotProviderStatus()`,
  `describeCopilotProviderStatus()` sowie `resolveCopilotConfigPath()` und `resolveCopilotKeyPath()`.
  Der Plan ist im Provider-Modus autoritativ: Was er nicht setzt, wird über `envUnset` aus dem
  Kind-Env entfernt. Den Key reicht ausschließlich
  `COPILOT_PROVIDER_API_KEY_COMMAND="cat '<pfad>'"` weiter. Aktivierung, Variablen, Rechte und
  Fehlersuche beschreibt [Copilot-Provider (DeepSeek)](../docs/17-dev-copilot-provider.md).

## Projekt-Board synchronisieren

### `sync-project-board.mjs`

```bash
SQUAD_PROJECT_TOKEN=<pat> node scripts/sync-project-board.mjs --issue 272
SQUAD_PROJECT_TOKEN=<pat> node scripts/sync-project-board.mjs --all
SQUAD_PROJECT_TOKEN=<pat> node scripts/sync-project-board.mjs --all --dry-run
```

Leitet aus den Labels eines Issues die Zielspalte im GitHub-Projekt V2 ab und verschiebt das Item
dorthin. Labels sind die Quelle der Wahrheit, das Board ist eine Einweg-Projektion. Benötigt einen PAT
mit Scope `project` (Repository-Secret `SQUAD_PROJECT_TOKEN`); das eingebaute `GITHUB_TOKEN` kann
Projects V2 nicht ansprechen. `PROJECT_OWNER` (Default `Frickeldave`) und `PROJECT_NUMBER` (Default
`2`) sind überschreibbar. Details stehen in
[FR007](../docs/features/fr007-project-board-sync.md); der Workflow ist
`.github/workflows/fd-sync-project-board.yml`.

## Übersetzung von Inhalten

### `translate.mjs`

```bash
node scripts/translate.mjs src/content/blog/beispiel.md --lang=de
node scripts/translate.mjs src/content/blog/beispiel.md de
```

Übersetzt eine Content-Datei über ein LLM mit OpenAI-kompatibler Chat-API. Erwartet eine `.env` im
Projektwurzelverzeichnis mit `LLM_API_URL`, `LLM_API_KEY` und `LLM_MODEL`; `.env.example` dient als
Vorlage. Unterstützte Zielsprachen stehen im Skript (`de`, `kl` als Beispiel für eine konstruierte
Sprache). Das Skript ist **kein** npm-Skript — es wird direkt mit `node` aufgerufen. Die `.env` wird
nie eingecheckt.

## Runner-Bootstrap

### `bootstrap/`

```powershell
$env:GITHUB_PAT = "ghp_xxxxx"
$env:GITHUB_USERNAME = "<github-username>"
.\scripts\bootstrap\bootstrap.ps1
```

```bash
npm run bootstrap
node scripts/bootstrap/bootstrap.mjs
```

Bootstrap für den GitHub-Actions-Self-hosted-Runner in Kubernetes: Namespace, Images, Secrets, RBAC
und das Runner-Deployment. Alle projektspezifischen Werte stehen in `bootstrap/bootstrap.json` — es
gibt bewusst keine eingebauten Defaults für Namespace oder Repository. Fehlt ein Pflichtwert, bricht
das Skript mit einer klaren Meldung ab.

| Datei                            | Zweck                                                        |
| -------------------------------- | ------------------------------------------------------------ |
| `bootstrap/bootstrap.mjs`        | Node-Implementierung, aufgerufen über `npm run bootstrap`    |
| `bootstrap/bootstrap.ps1`        | Windows-Wrapper, installiert Node.js bei Bedarf              |
| `bootstrap/bootstrap.json`       | einzige Quelle für projektspezifische Werte                  |
| `bootstrap/bootstrap.md`         | ausführliche Ablaufbeschreibung                              |
| `bootstrap/README.md`            | Paketdokumentation und Übernahme in andere Projekte          |
| `bootstrap/bootstrap.test.mjs`   | Tests, ausgeführt über `npm run test:bootstrap`              |
| `bootstrap/docker-dev-base/`     | Basis-Image mit Node, Git, gh und Copilot CLI                |
| `bootstrap/docker-dev-ghrunner/` | Runner-Image für die self-hosted Runner                      |
| `bootstrap/docker-dev-kaniko/`   | Kaniko-Build-Image, genutzt von `fd-bootstrap.yml`           |
| `bootstrap/k8s/`                 | Namespace, RBAC, Runner-Deployment und Secrets               |

Der Workflow `.github/workflows/fd-bootstrap.yml` baut die Dev-Images und legt bei Bedarf
Entwicklungsmaschinen an. Details stehen in `bootstrap/README.md`.

## Podcast-Update

Die vier Skripte unter `scripts/workflows/podcast-update/` bilden den Ablauf von
`.github/workflows/fd-podcast-update.yml` ab.

### `compare-episodes.mjs`

Liest den Acast-RSS-Feed, parst die Episoden und vergleicht sie mit dem Frontmatter von
`src/content/aboutme/doag.md`. Die älteste fehlende Episode landet als JSON in `missing-episode.json`
und in `GITHUB_OUTPUT` für die nachfolgenden Schritte.

### `generate-metadata.mjs`

Erzeugt die Episoden-Metadaten über die GitHub Copilot CLI (`gh copilot`, das intern die Copilot CLI
aufruft) und schreibt sie als `metadata.json`. Schlägt die CLI fehl, greift ein Fallback auf die API
bzw. auf manuelle Eingaben.

### `generate-metadata-api.mjs`

Dieselbe Aufgabe ohne CLI: erzeugt die Metadaten direkt über die API.

### `update-doag.mjs`

```bash
node scripts/workflows/podcast-update/update-doag.mjs
node scripts/workflows/podcast-update/update-doag.mjs --dry-run
```

Fügt die neue Episode mit einer eindeutigen fünfstelligen ID am Anfang des Episoden-Arrays in
`doag.md` ein und behält dabei Einrückung und Zeilenstruktur bei. `--dry-run` validiert nur.

## Tests

- `npm run test:scripts` — Tests der Start-Flow- und Release-Skripte:
  `start-work.test.mjs`, `start-reqeng.test.mjs`, `start-review.test.mjs`, `start-flow-flags.test.mjs`,
  `flow-shared.test.mjs`, `platform-shared.test.mjs`, `copilot-environment.test.mjs`,
  `ensure-issue-branch.test.mjs`, `versionbump.test.mjs`, `release-gate.test.mjs`,
  `check-release-label.test.mjs`. Der Lauf braucht `--experimental-test-module-mocks`.
- `npm run test:bootstrap` — Tests des Bootstrap-Skripts.
- `test-mock-support.mjs` — Adapter, der die für vitest geschriebenen Tests auf `node --test`
  lauffähig macht (`vi.fn`, `vi.spyOn`, `vi.stubEnv`, `expect`-Teilmenge).

Playwright-e2e-Tests und der 3D-Build-Test liegen außerhalb von `scripts/` unter `test/` und laufen in
`fd-ci`.

## Hinweise

- **Keine Secrets im Repository — mit einer bewusst begrenzten Ausnahme.** `.env` bleibt lokal (siehe
  `.env.example`); Tokens kommen in Workflows aus Repository-Secrets. Einzige Ausnahme ist der
  optionale DeepSeek-Key: Er liegt als Datei mit `0600` unter `~/.config/fd/` außerhalb des
  Repositories und wird nie getrackt, geloggt oder als Docker-`ARG`/`ENV` gesetzt. Siehe
  [Copilot-Provider (DeepSeek)](../docs/17-dev-copilot-provider.md).
- **Skripte statt Ad-hoc-Shell.** Automatisierung, Validierung und Hilfswerkzeuge gehören nach
  `scripts/`, nicht in einmalige Befehlszeilen.
- **Branch- und Commit-Konventionen** für Skript-Änderungen stehen in
  [Richtlinien für Commit-Messages](../docs/12-dev-messages.md) und
  [Branching- und Naming-Strategie](../docs/13-dev-branch-naming-strategy.md).
- **Release-Weg** ist in [FR006](../docs/features/fr006-autodeploy.md) beschrieben; `main` wird nur
  über `fd-promote-prd` und `fd-deploy-prd` aktualisiert.
