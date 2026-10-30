# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Interaktive Checkliste für die Abschlussaufgabe an Tag 2: Aufgaben lassen sich bis zum nächsten
  Seiten-Refresh an- und abhaken (#260).

## [1.0.10] - 2026-10-30

### Changed

- Kubernetes-Schulung Tag 2 und die Chromium-Beispielmanifeste ergänzen und korrigieren die Probe-Konfigurationen (#260).

## [1.0.9] - 2026-10-29

### Changed

- Git-Bash-Troubleshooting: die breite Drei-Spalten-Tabelle ist durch eine Definitionsliste aus Symptom, Ursache und Lösung ersetzt und passt damit in die rund 667 px breite Prose-Spalte (#260).
- § „api-resources“ der Vorbereitungsseite nennt den Befehl `kubectl api-resources | grep -E "(pods|services|deployments|ingress)"` samt Kurzerklärung über der Ausgabe (#260).

### Fixed

- Kubernetes-Schulung: Alle Deployment-Beispiele (`examplefiles/*deployment*.yaml`, die YAML-Blöcke in Tag 1 und Tag 2) setzen `resources.requests` und `resources.limits` und erfüllen damit die Kyverno-Policy `require-resource-requirements` der Firmen-Cluster; `code-server-deployment.yaml` und `code-server-deployment-configmap.yaml` sowie `code-server-pvc.yaml` stimmen wieder mit den Doku-Blöcken überein, das Passwort heißt überall `trainingk8s`; neu sind `create-namespace.yaml`, `ssh-bastion-deployment.yaml` und `ssh-bastion-service.yaml` (#260).
- Vorbereitungsseite: der LimitRange-Hinweis steht nur noch an Tag 2, wo er auftritt (#260).
- Der „Weiter“-Link der Vorbereitungsseite zeigt jetzt auf `/docs/kubernetes-basis/10-tag-1` statt auf den `.mdx`-Pfad und trägt das Label „Tag 1“ (#260).

## [1.0.8] - 2026-10-27

### Added

- Globaler Kopierknopf für Codeblöcke: `src/lib/code-copy.ts` bindet sich idempotent auf `astro:page-load` (Muster wie `cart-dom.ts`), `src/components/base/CopyCode.astro` liefert Markup und Script, `src/components/base/BaseLayout.astro` bindet beides einmalig ein; einen Knopf bekommt nur `pre > code`, ausgenommen sind `pre.mermaid`, Inline-Code und Blöcke mit `[data-no-copy]`; ohne `navigator.clipboard` (unsicherer Kontext) blendet sich der Knopf aus, das Feedback läuft über `role="status"` mit `Kopiert!` für 2000 ms (#260).
- Beispielmanifest `src/content/docs/kubernetes-basis/examplefiles/linuxserver-common-config-map.yaml`: zentrale linuxserver-ConfigMap mit den Keys `PUID`, `PGID` und `TZ` (#260).
- Beispielmanifest `src/content/docs/kubernetes-basis/examplefiles/database-deployment.yaml`: vollständiges MariaDB-+-phpMyAdmin-Deployment mit Init-Container `wait-for-mariadb`, PVC-Mount `mariadb-config` und den Container-Ports 3306 und 80 (#260).
- Glossareintrag `ACME` in `90-glossar.mdx` zwischen `Ingress Controller` und `ClusterIP` (#260).

### Changed

- Zeitplan und Rahmen der Kubernetes-Schulung Tag 2: Persistent Volumes (15:30–16:15), optionale Vertiefung MariaDB + phpMyAdmin (16:15–17:00) und Abschluss (17:00–17:15) statt des Ingress-Blocks; Frontmatter-`description` und § „Workloads & Networking“ nennen kein Ingress mehr (#260).
- Kubernetes-Schulung Tag 1: `kubectl port-forward deployment/chromium 4000:3000` steht jetzt in § „Chromium deployen“ → § „Imperativ“, § „Port-Forwarding“ schrumpft auf Referenzsätze und bekommt ein SSH-Container-Beispiel als „Harness“ mit `ClusterIP`-Service und `ssh_config` (#260).
- Ingress-Kapitel Tag 1: Hosts `chrome.k8s-training.frickeldave.de` und `code.k8s-training.frickeldave.de` statt der ungültigen `*.*.com`-Platzhalter, `ingressClassName` mit den Kandidaten `nginx`, `traefik` und `traefik-ingress-controller` samt Discovery über `kubectl get ingressclass`, § „Status prüfen“ heißt jetzt § „Ingress-URL ermitteln“ (#260).
- ConfigMaps Tag 2: neue zentrale ConfigMap `linuxserver-common`, `code-server-config` enthält nur noch `DEFAULT_WORKSPACE`, das Deployment bindet beide per `envFrom` ein; Reloader als kanonischer Link samt Installationssätzen und Annotation `reloader.stakater.com/auto: "true"` (#260).
- LimitRange Tag 2 und `examplefiles/limitrange.yaml`: Name `default-container-resources`, Defaults `cpu: "1"` / `memory: "1Gi"`, Requests `cpu: "100m"` / `memory: "256Mi"`, `max`/`min` unverändert; Rechte-Aussage auf Namespace-Admin korrigiert, Fehlerfall `exceeded quota` und `kubectl describe limitrange` ergänzt (#260).
- PV/PVC Tag 2: neue StorageClass-Sektion mit Default-Erkennung und Fehlerbild „PVC bleibt Pending“, auskommentierte `storageClassName` im PVC; § „Analogie: Das Logistiklager“ mit „schlecht erreichbares Regal (Festplatte)“, „Regalplatz auf Schulterhöhe am Eingang (SSD)“ und „Kühl-Regal (Archive)“ neu formuliert (#260).
- Vertiefung MariaDB + phpMyAdmin: NodePort als Alternative zum Ingress, Ingress-Route als freiwillige Zusatzaufgabe (#260).
- Ausblick Tag 1, Feinlernziele Tag 2 und Tag-2-Checkpoint: Code-Server mit PVC sowie MariaDB + phpMyAdmin statt Home Assistant, Nextcloud und Ingress-Routing für vier Anwendungen (#260).
- Beispielmanifests: Namespace `kw-b2824a-default` → `k8s-training`, interner Cluster-FQDN → `code.k8s-training.frickeldave.de` in `code-server-ingress.yaml` und `example_commands.txt` (#260).

### Fixed

- Doku nannte `vector-config.yaml` und `chromium-logging-configmap.yaml`; sie verweist jetzt auf die vorhandenen Dateien `vector-config-map.yaml` und `chromium-logging-config-map.yaml` (#260).
- `examplefiles/code-server-deployment.yaml` nutzt dieselben zwei `envFrom`-Referenzen wie die Doku und setzt `PUID`/`PGID`/`TZ` nicht mehr inline (#260).
- Warnhinweis auf die Dateinamen-Konvention `<app>-<kind>.yaml` samt Prüfritual `kubectl diff` vor dem ersten `kubectl apply -f` in § „Chromium deklarativ neu anlegen“ (#260).
- „Status prüfen“ im Ingress-Kapitel verweist nicht mehr auf den ungültigen Wildcard-Host, sondern auf den tatsächlich gesetzten HOST (#260).

## [1.0.7] - 2026-10-27

### Added

- Release-Gate für Pull Requests nach `dev`: `scripts/release-gate.mjs` bündelt die Regeln (genau eines von `release:yes` / `release:no`, Versionsvergleich gegen das höchste `dev-v*`-Release bzw. gegen die Merge-Base) und `scripts/check-release-label.mjs` liefert dazu den CI- und den lokalen Modus (#282).
- Workflow `fd-pr-release-label` mit dem Required-Status-Check `check-release-label` für Pull Requests nach `dev`; der Job läuft ohne `npm ci`, weil die Skripte nur `node:`-Module importieren (#282).
- Neue Seite `docs/workflow/versionierung und release.md` zu Label-Modell, Regeln, Deploy/Release und Promote (#282).
- Release-Version in der Fußzeile: `src/components/base/Footer.astro` rendert `v<version>` zur Build-Zeit aus `package.json` und verlinkt auf die GitHub-Releases (#282).

### Changed

- Das Label-Modell trennt Issue-Triage und Release-Schalter: `release:yes` / `release:no` hängen jetzt am Pull Request und werden von `fd-configure` verwaltet; der Husky-Hook `.husky/pre-push` ruft das Gate zusätzlich zum Branch-Namens-Check auf und blockiert nur, wenn ein offener PR gegen `dev` die Regeln verletzt (#282).
- Doku-Struktur: die bisherigen Seiten liegen unverändert unter `docs/old/`, die neue Struktur beginnt mit `docs/workflow/`; die Release-Doku führt beide Fassungen in `docs/workflow/versionierung und release.md` zusammen (#282).
- `docs/old/11-dev-usage.md` und `docs/old/features/fr006-autodeploy.md` beschreiben den PR-Schalter und den Versionsvergleich; `npm run test:scripts` führt die beiden neuen Testdateien mit aus (#282).

### Removed

- Die Issue-Ziel-Labels `release:v0.4.0`, `release:v0.5.0`, `release:v0.6.0`, `release:v1.0.0` und `release:backlog` ersatzlos — der Präfix `release:` gehört ausschließlich dem PR-Schalter, und `squad-label-enforce` setzt oder entfernt auf Issues keine `release:`-Labels mehr (#282).
### Fixed

- Das Freitextfeld `image` von `fd-bootstrap` akzeptiert jetzt ein von der GHCR-Paketseite kopiertes `docker pull …`: Umgebender Leerraum und die Präfixe `docker pull`, `docker image pull` und `podman pull` werden entfernt, leere Eingaben fallen unverändert auf `ghcr.io/<owner>/fd-dev-full:latest` zurück. Eine Referenz, die danach nicht der OCI-Form (Registry-Host, Repository-Pfad in Kleinbuchstaben, optionales Tag) entspricht, bricht den Lauf im Runner mit einer `::error::`-Meldung ab, die den Wert und die erwartete Form nennt — vor jedem `kubectl`-Aufruf und damit ohne Kaniko-Job, statt nach Minuten mit einer Registry-Fehlermeldung im Cluster (#282).

## [1.0.6] - 2026-10-26

### Added

- Optionale DeepSeek-Anbindung der Copilot CLI (BYOK über die Anthropic-kompatible API) mit Opt-in über den optionalen Schritt `7/7` von `fd-setup` oder eine Konfigurationsdatei unter `${XDG_CONFIG_HOME:-$HOME/.config}/fd/`; ohne Aktivierung bleibt das Verhalten unverändert (#285).
- `scripts/copilot-provider.mjs`: löst den Launch-Plan (`provider`/`github`) auf, prüft Konfiguration und Key-Datei fail-closed und liefert den Offline-Status für `fd-welcome` und die Start-Flows (#285).
- `--model <id>` und `--no-provider` in `start-work`, `start-reqeng` und `start-review`; `--model` gewinnt gegen Konfiguration und Shell-Env, ein unbekanntes Modell bricht den Flow mit Exit ≠ 0 ab (#285).
- Provider-Zeile im Login-Banner `fd-welcome` und im Offline-Status (`node scripts/copilot-environment.mjs provider`, im Container `node /usr/local/lib/fd-dev/copilot-environment.mjs provider`) sowie `fd-setup --reset-provider` zum Entfernen der Konfiguration inklusive Widerrufshinweis (#285).
- Neue Seite `docs/17-dev-copilot-provider.md` mit Aktivierung, Dateien und Rechten, Variablentabelle, Modellwahl, Fallback, Fehlersuche und Drittanbieter-Hinweis; verlinkt aus `scripts/README.md`, `docker-dev-full/README.md` und `docs/11-dev-usage.md` (#285).

### Changed

- Ein Provider-Fallback startet mit den GitHub-Copilot-Modellen, entfernt die Provider-Variablen aus dem Kind-Env, übergibt kein `--model` und gibt genau eine Warnzeile mit Grund und Host aus — ohne Key-Material (#285).
- Die Aussagen „Maschine enthält keine Secrets“ bzw. „Keine Secrets im Repository“ sind auf eine bewusst begrenzte Ausnahme umformuliert: Der optionale Key liegt als `0600`-Datei außerhalb des Repos (#285).

## [1.0.5] - 2026-10-26

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
