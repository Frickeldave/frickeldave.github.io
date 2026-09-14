# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
