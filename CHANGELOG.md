# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Runner-Bootstrap unter `scripts/bootstrap/` (Images, Kubernetes-Namespace, RBAC, Secrets, Deployment) inklusive `--kubeconfig`-Unterstützung für einen expliziten Ziel-Cluster (#282).
- npm-Scripts `bootstrap` und `test:bootstrap` (#282).
- Retry mit exponentiellem Backoff für `docker login` und `docker push` bei transienten Registry-Fehlern (Standard: 3 Versuche); jeder Wiederholungsversuch wird mit Grund geloggt, echte Credential-Fehler brechen sofort ab (#282).
- Abschnitt „In ein anderes Projekt übernehmen“ in `scripts/bootstrap/README.md`: Paket kopieren, `bootstrap.json` anpassen, ausführen (#282).
- Portabilitäts-Guard im Bootstrap-Test: außerhalb von `bootstrap.json` darf im gesamten Paket kein Projekt-Literal mehr stehen (#282).

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

### Removed

- Eingebaute Projekt-Defaults in `bootstrap.mjs` (Namespace-, Repository-, Label- und Image-Literale) (#282).
- Die vier getrennten Issue-Templates für Bug-, Feature-, Content- und Dokumentationsarbeit (#282).

### Fixed

- Runner-Registrierung verwendet keine doppelt präfigierten Namen mehr (`github-actions-runner-github-actions-runner-*`); der Entrypoint stellt `RUNNER_NAME_PREFIX` nur voran, wenn der Pod-Name es nicht bereits enthält (#282).

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
