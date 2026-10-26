# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- `npm run start-work` aktiviert den lokalen Marker `.frickeldave-active-issue` jetzt selbst im Ziel-Worktree, nachdem alle übrigen Gates grün sind: Der Launcher schreibt `issue`, `title`, `status`, `tony_approved: true`, `tony_approved_at` (lokaler Zeitstempel mit Offset) und `session_id` (tmux-Sessionname bzw. stabiler `--notmux`-Fallback), ist bei identischem Inhalt idempotent und bricht mit klarer Meldung ab, wenn der Marker nicht geschrieben werden kann; damit endet ein Lauf nicht mehr im toten Stopp der Copilot-Session, weil ein frischer Worktree den gitignorierten Marker nie enthält. Agenten und `npm run start-reqeng` schreiben ihn weiterhin nie (#282).

## [1.0.4] - 2026-10-26

### Added

- Runner-Bootstrap unter `scripts/bootstrap/` (Images, Kubernetes-Namespace, RBAC, Secrets, Deployment) inklusive `--kubeconfig`-Unterstützung für einen expliziten Ziel-Cluster (#282).
- npm-Scripts `bootstrap` und `test:bootstrap` (#282).
- Retry mit exponentiellem Backoff für `docker login` und `docker push` bei transienten Registry-Fehlern (Standard: 3 Versuche); jeder Wiederholungsversuch wird mit Grund geloggt, echte Credential-Fehler brechen sofort ab (#282).
- Abschnitt „In ein anderes Projekt übernehmen“ in `scripts/bootstrap/README.md`: Paket kopieren, `bootstrap.json` anpassen, ausführen (#282).
- Portabilitäts-Guard im Bootstrap-Test: außerhalb von `bootstrap.json` darf im gesamten Paket kein Projekt-Literal mehr stehen (#282).
- Start-Flow-Scripts unter `scripts/`: `start-work.mjs`, `start-reqeng.mjs`, `start-review.mjs`, `flow-shared.mjs`, `ensure-issue-branch.mjs`, `platform-shared.mjs` und `copilot-environment.mjs` inklusive Tests (#282).
- npm-Scripts `start-work`, `start-reqeng`, `start-review` und `test:scripts` (#282).
- Skills `.github/skills/tmux-session-management/` und `.github/skills/worktree-naming-conventions/`, auf die die Start-Scripts verweisen (#282).
- Workflow `fd-configure`, der sämtliche Labels verwaltet: die statischen Namespaces (`go:*`, `release:*`, `type:*`, `priority:*`, `bug`, `feedback`), das Basislabel `squad`, `squad:<member>` je Roster-Zeile und `squad:copilot`; er validiert dabei das deutsche Roster aus `.squad/team.md`, und `go:spec-finished` wird ebenfalls verwaltet. Die 31 verwalteten Labels blieben beim Zusammenlegen unverändert, keine Farbe hat sich verschoben (#282).
- Workflow `fd-bootstrap` samt `.github/workflows/fd-bootstrap/` (Dev-Machine-Renderer, Tests, Dev-Image `docker-dev-full`, Kubernetes-Manifeste, Restart-, Session- und Report-Skripte): legt pro menschlichem Mitglied mit GitHub-Handle ein `fd-dev-full`-StatefulSet plus Service an, baut das Image bei Bedarf mit einem wegwerfbaren Kaniko-Job und startet laufende Maschinen nie automatisch neu (#282).
- Abschnitt `## Menschliche Mitglieder` in `.squad/team.md` (David Koenig, `dave@frickeldave.de`) als Roster-Quelle für die Dev-Machines; `parseHumanMembers` in `scripts/flow-shared.mjs` liest die Tabelle header-getrieben und akzeptiert auch die englische Überschrift (#282).
- `dev-machines`-Role und -RoleBinding in `scripts/bootstrap/k8s/rbac.yaml`, damit der ServiceAccount des Runners StatefulSets, Services und `pods/exec` der Dev-Machines verwalten darf (#282).
- Workflow `fd-promote-prd` als manueller Promote von `dev` nach `main`: prüft dieselben Versions- und CHANGELOG-Gates wie `fd-deploy-prd`, verlangt zusätzlich einen grünen `fd-ci`-Lauf auf der `dev`-Spitze und stößt danach `fd-deploy-prd` an (#282).
- `.github/pull_request_template.md` mit den Gates dieses Repositories: `release:*`-Label am Issue, CHANGELOG-Eintrag unter `## [Unreleased]`, Versionsbump nur in Release-PRs, Basisbranch `dev` (#282).
- `.dockerignore` begrenzt den Build-Kontext der Dev-Images auf die Dateien, die der Dockerfile tatsächlich kopiert (#282).
- Öffentlicher SSH-Schlüssel von `Frickeldave` in `.squad/team.md` unter `## Developer SSH Keys` eingetragen; die doppelte Nennung der Überschrift und der veraltete Satz „für David Koenig ist hier kein Schlüssel hinterlegt“ sind entfernt, und `dev-machines.test.mjs` prüft den registrierten Schlüssel statt des schlüssellosen Zustands (#282).
- npm-Script `versionbump` mit `scripts/versionbump.mjs` und `scripts/versionbump.test.mjs`: hebt `package.json` an und öffnet gleichzeitig die Release-Sektion in `CHANGELOG.md`, indem der Inhalt von `## [Unreleased]` nach `## [x.y.z] - <Datum>` wandert und ein leeres `Unreleased` zurückbleibt; ohne neue Abhängigkeit (`node:readline/promises`), mit allen Prüfungen vor dem ersten Schreibzugriff, 21 Tests und einem um das neue Testfile erweiterten `test:scripts` (#282).
- Job `release` in `fd-deploy-dev`, der für den CI-Commit das Pre-Release `dev-v<version>` veröffentlicht; der Lauf ist idempotent und nutzt `--prerelease --latest=false` (#282).

### Changed

- Bootstrap-Zielwerte auf dieses Repository umgestellt: Label `fd`, 2 Runner-Replicas, Images `ghcr.io/frickeldave/fd-dev-*`; der Namespace kommt ausschließlich aus `scripts/bootstrap/bootstrap.json` (#282).
- Bootstrap, PowerShell-Wrapper und Kubernetes-Templates enthalten kein Namespace-Literal mehr; das Paket ist damit in ein anderes Repository kopierbar (#282).
- Kaniko-Bausteine (Image, Build-/Push-Steps, RBAC) bleiben für ein künftiges `fd-deploy.yaml` erhalten; nicht mehr benötigte App-Deploy-RBAC-Objekte wurden entfernt (#282).
- Kubernetes-Templates auf neutrale Dateinamen umbenannt: `namespace.yaml`, `rbac.yaml`, `runner-secrets.yaml`, `runner-deployment.yaml` (#282).
- Image-Referenzen kommen ausschließlich aus `bootstrap.json` bzw. den Umgebungsvariablen `DEV_BASE_IMAGE`, `GH_RUNNER_IMAGE` und `KANIKO_IMAGE` (vormals `FD_KANIKO_IMAGE`) und brechen sonst mit einer klaren Meldung ab; bei `SKIP_IMAGE_BUILD=true` werden die Build-only-Images nicht mehr verlangt (#282).
- Das Label `app.kubernetes.io/part-of` wird aus `partOf` (Fallback `githubRunnerRepo`) gerendert und vor dem Apply gegen die Kubernetes-Label-Regeln validiert (#282).
- Das Runner-Image-Dockerfile hat keinen Default für `DEV_BASE_IMAGE` mehr; `bootstrap.mjs` übergibt den Wert immer per `--build-arg` (#282).
- Dokumentation (README, `bootstrap.md`, Docker-READMEs) beschreibt durchgängig die konfigurationsgetriebenen Werte statt Projekt-Literale (#282).
- Issue-Templates auf eine einzige Standardvorlage `.github/ISSUE_TEMPLATE/standard.yaml` zusammengeführt (Ziel, Technik, Akzeptanzkriterien, Scope, betroffene Komponenten, offene Fragen, Risiko); Labels setzt der Triage-Workflow (#282).
- Start-Flow-Scripts auf dieses Einzel-Repository angepasst: `readiness()` prüft Repo-Root, Git-Work-Tree und Toolchain statt vier Schwester-Repositories; nur noch `DEV_SERVER_PORT` statt der fünf Service-Ports; GitHub-Projects-Prüfung nutzt `PROJECT_OWNER`/`PROJECT_NUMBER` (Default `Frickeldave`/`2`) mit `user(login:)`; Worktree-Fallback liegt unter `~/.cache/flow-worktrees` (#282).
- Die Start-Flow-Tests laufen mit `node --test` (inkl. `--experimental-test-module-mocks`) statt vitest; gemeinsame Helfer in `scripts/test-mock-support.mjs` (#282).
- `fd-ci` führt `lint-checks` und `scad-smoke-test` auf den selbst gehosteten `fd`-Runnern aus; die Actions sind auf `actions/checkout@v7` und `actions/setup-node@v7` mit vollständigen Commit-SHAs gepinnt (#282).
- Runner-Limits in `scripts/bootstrap/k8s/runner-deployment.yaml` von 1 CPU / 2 GiB auf 3 CPU / 8 GiB angehoben, die Requests bleiben bei 100m CPU / 512Mi; der e2e-Job läuft ebenfalls auf den `fd`-Runnern, und `playwright.config.js` wartet 600 s statt 300 s auf den `webServer`-Build (#282).
- `scripts/prose-install.mjs` und `scripts/install-openscad.mjs` brauchen unter Windows kein `unzip`, `cp` und `mv` mehr: entpackt wird mit `Expand-Archive`, kopiert und verschoben mit `Copy-Item` und `Move-Item`; der Download-Stream ist vor dem Entpacken geschlossen, und das OpenSCAD-Payload wird unabhängig von der Schreibweise seines Ordnernamens gefunden (#282).
- `fd-podcast-update` läuft mit beiden Jobs auf den `fd`-Runnern; der nvm-Import und die Login-Shell entfallen, `GITHUB_OUTPUT` wird vor dem RSS-Vergleich geleert, und die Actions sind auf volle Commit-SHAs gepinnt (#282).
- `yaml` ist jetzt devDependency, weil die Tests des Dev-Machine-Workflows die gerenderten Manifeste parsen (#282).
- Die Entscheidungen aus `.squad/decisions/inbox/` sind in die gemeinsame `.squad/decisions.md` übernommen (#282).
- `fd-deploy-dev` lässt beide Jobs auf `[self-hosted, fd]` laufen (#282).
- `fd-deploy-prd` vergleicht nur noch mit dem neuesten **stabilen** GitHub-Release (`isPrerelease == false`, `dev-v*` zusätzlich defensiv ausgeschlossen); neues Gate: `dev <= latest_stable` überspringt den Merge, `main <= latest_stable` überspringt Deploy und Release mit einem `::notice::`, `main > latest_stable` deployt und veröffentlicht (#282).
- Der Kaniko-Build von `fd-dev-full` nutzt einen Layer-Cache (`--cache=true`, `--cache-repo=ghcr.io/<owner>/fd-dev-kaniko-cache`, `--cache-ttl=336h` in `.github/workflows/fd-bootstrap/k8s/fd-k8s-kaniko-build-job.yaml`); `CACHE_REPO` leitet `fd-bootstrap.yml` aus dem kleingeschriebenen Owner ab. Gemessen: kalt 437 s, warm 237 s, deshalb steigt das Job-Timeout von 600 s auf 900 s (#282).
- Dokumentation, Charters und Code-Kommentare sind auf Deutsch umgestellt: `docs/**`, `README.md`, `scripts/README.md` (neu geschrieben, weil er Dateien dokumentierte, die es nie gab), `.github/pull_request_template.md`, `.squad/routing.md`, die Charters (`rai` aus den ausgelieferten Vorlagen neu aufgebaut, `ralph`, `fact-checker`, `tony`) und `.squad/ralph-instructions.md` sowie die Kommentare in `scripts/**`, `test/**`, `src/**` und allen Workflows. Veraltete Aussagen zu Workflow-Namen, `postinstall`-Kette, ESLint-Flat-Config, Vale-Einstellungen und toten Links sind dabei korrigiert (#282).

### Removed

- Eingebaute Projekt-Defaults in `bootstrap.mjs` (Namespace-, Repository-, Label- und Image-Literale) (#282).
- Die vier getrennten Issue-Templates für Bug-, Feature-, Content- und Dokumentationsarbeit (#282).
- Der Schritt `npx playwright install --with-deps chromium` im e2e-Job; Browser und Systembibliotheken liegen im `fd-dev-base`-Image, und der Runner-Benutzer hat kein `sudo` (#282).
- Workflow `.github/workflows/squad-sync-squad-labels.yml`; seine Labels `squad:<member>` und `squad:copilot` pflegt jetzt `fd-configure`, damit nie zwei Workflows unterschiedliche Werte an dasselbe Label schreiben (#282).

### Fixed

- Runner-Registrierung verwendet keine doppelt präfigierten Namen mehr (`github-actions-runner-github-actions-runner-*`); der Entrypoint stellt `RUNNER_NAME_PREFIX` nur voran, wenn der Pod-Name es nicht bereits enthält (#282).
- `fd-podcast-update` schlug seit dem 15.09.2026 bei jedem Schedule-Lauf fehl, weil `ubuntu-latest` Node 22 ausliefert, der Workflow aber Node 24 verlangte; die `fd`-Runner liefern Node 24 (#282).
- `.vscode/tasks.json` hatte einen Task „Deploy to Main“, der direkt nach `main` pushte und damit Versions-Gate, CHANGELOG-Pflicht und `fd-ci` umging; er startet jetzt `fd-promote-prd.yml` per `gh workflow run` (#282).

## [1.0.3] - 2026-09-14

### Added

- Social-Share: Label „Share via..." vor den Buttons, neue Instagram- und TikTok-Buttons sowie echte Artikel-URLs statt Platzhalter-Domain (#273).

### Changed

- Footer-Link `© Frickeldave` verweist jetzt auf `/aboutme` statt `/terms` (#274).

### Removed

- Terms-Seite (`/terms`) samt Content, Layout und Content-Collection entfernt (#274).

### Security

- `smol-toml` per npm-Override auf `1.8.0` angehoben (behebt DoS-Schwachstelle) (#276).

## [1.0.2] - 2026-09-13

### Fixed

- Pages-Deploy: `package-manager` für `withastro/action` explizit auf `npm` gesetzt (kein Lockfile im Repo).

## [1.0.1] - 2026-09-13

### Changed

- CI/Workflows: auf GitHub-Hosted Runner umgestellt, Workflows umbenannt und mit Kurzbeschreibungen versehen.
- `main` in `dev` gemergt (Branch-Reconciliation).

## [1.0.0] - 2026-09-10

### Added

- Initial release of Astrogon.
