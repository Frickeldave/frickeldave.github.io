# Branching- und Naming-Strategie

Dieses Dokument beschreibt die Branching-Strategie und die standardisierten Namenskonventionen für
das Frickeldave-Repository. Die Einhaltung dieser Regeln sorgt für Konsistenz und passt zum
automatisierten CI/CD- und Deployment-Ablauf.

## Inhaltsverzeichnis

- [Branching- und Naming-Strategie](#branching--und-naming-strategie)
  - [Inhaltsverzeichnis](#inhaltsverzeichnis)
  - [Einleitung](#einleitung)
    - [Grundprinzipien](#grundprinzipien)
  - [Branch-Typen](#branch-typen)
    - [Haupt-Branches](#haupt-branches)
    - [Unterstützende Branches](#unterstützende-branches)
  - [Namenskonvention](#namenskonvention)
    - [Format](#format)
    - [Empfehlungen](#empfehlungen)
  - [Beitrags-Workflow](#beitrags-workflow)
    - [1. Vorbereitung](#1-vorbereitung)
    - [2. Feature-Branch anlegen](#2-feature-branch-anlegen)
    - [3. Änderungen vornehmen und committen](#3-änderungen-vornehmen-und-committen)
    - [4. Mergen und deployen](#4-mergen-und-deployen)
  - [Typische Anwendungsfälle](#typische-anwendungsfälle)
    - [Neue Inhalte hinzufügen](#neue-inhalte-hinzufügen)
    - [Fehler beheben](#fehler-beheben)
  - [Hilfe und Support](#hilfe-und-support)

## Einleitung

Das Frickeldave-Repository verwendet eine strukturierte Branching-Strategie, um eine saubere
Historie zu bewahren und sicherzustellen, dass nur geprüfte Änderungen in die Produktion gelangen.

### Grundprinzipien

1. **In Branches arbeiten**, damit `main` und `dev` sauber bleiben.
2. **Issue-Branch und Draft-PR** als Standardweg: die Integration passiert in `dev`.
3. **Automatisierte Prüfungen** laufen weiterhin bei Pushes, um die Qualität zu sichern.
4. **Beschreibende Namen** für alle unterstützenden Branches.

## Branch-Typen

### Haupt-Branches

- **`main`**: Enthält die stabile und veröffentlichte Version.
- **`dev`**: Dient als Integrations-Branch für neue Features und Änderungen.

### Unterstützende Branches

Unterstützende Branches werden für Feature-Entwicklung, Fehlerbehebungen oder
Dokumentationsänderungen verwendet. Nach Abschluss werden sie per Squash-Merge nach `dev`
integriert; `dev` ist der Integrationsbranch.

| Typ        | Zweck                            | Beispiel                      |
| ---------- | -------------------------------- | ----------------------------- |
| `feat`     | Neues Feature oder neue Funktion | `feat/user-authentication`    |
| `fix`      | Fehlerbehebung                   | `fix/sidebar-scrolling-issue` |
| `docs`     | Dokumentationsänderungen        | `docs/update-branching-guide` |
| `style`    | Stil-Änderungen am Code         | `style/format-components`     |
| `refactor` | Umstrukturierung von Code        | `refactor/simplify-utils`     |
| `perf`     | Performance-Verbesserungen       | `perf/optimize-images`        |
| `test`     | Tests ergänzen oder anpassen    | `test/add-component-tests`    |
| `ci`       | CI/CD-Konfiguration              | `ci/github-actions-security`  |
| `chore`    | Wartung, Abhängigkeiten         | `chore/update-dependencies`   |

## Namenskonvention

### Format

Alle unterstützenden Branches MÜSSEN diesem Format folgen:

```
<type>/<optional-ticket-id>-<description>
```

**Beispiele:**

- `feat/dark-mode-support`
- `fix/gh-456-button-alignment`
- `docs/add-contribution-guide`

### Empfehlungen

1. **Nur Kleinbuchstaben** verwenden.
2. **Bindestriche** zur Worttrennung nutzen (kebab-case).
3. **Kurz halten** (maximal 50 Zeichen).
4. **Beschreibend formulieren**, damit der Zweck des Branches klar ist.
5. **Zum Commit-Typ passend benennen**: Der Branch-Typ sollte zu den
   [Conventional Commits](./12-dev-messages.md) passen.

## Beitrags-Workflow

```mermaid
graph TD
    Start([Issue-Branch anlegen]) --> DevWork[Entwicklung]
    DevWork --> DraftPR[Draft-PR gegen dev]
    DraftPR --> Squash[Squash-Merge nach dev]
    Squash --> PushDev[Push dev branch]
    PushDev --> CiRun[fd-ci.yml]
    CiRun --> DevDeploy[fd-deploy-dev.yml]

    CiRun -. manuell .-> Promote[fd-promote-prd.yml]
    Promote --> ProdWorkflow[fd-deploy-prd.yml]
    ProdWorkflow --> ProdDeploy[GitHub Pages und Release]

    style DevDeploy fill:#6699ff
    style ProdDeploy fill:#ff9933
    style Promote fill:#ffff99
```

### 1. Vorbereitung

1. **Repository klonen**:

   ```bash
   git clone https://github.com/Frickeldave/frickeldave.github.io.git
   cd frickeldave.github.io
   ```

2. **Optional einen `upstream`-Remote hinzufügen**:
   ```bash
   git remote add upstream https://github.com/Frickeldave/frickeldave.github.io.git
   ```

Wenn du direkt im Haupt-Repository arbeitest, ist dieser Schritt in der Regel nicht nötig.

### 2. Feature-Branch anlegen

1. **Mit dem aktuellen Stand synchronisieren**:

   ```bash
   git checkout dev
   git pull origin dev
   ```

2. **Neuen Branch anlegen**:
   ```bash
   git checkout -b feat/new-feature
   ```

### 3. Änderungen vornehmen und committen

1. Änderungen vornehmen und Dateien vormerken:

   ```bash
   git add .
   ```

2. Commit-Message schreiben (siehe [Commit-Richtlinien](./12-dev-messages.md)):
   ```bash
   git commit -m "feat: add new feature"
   ```

### 4. Mergen und deployen

1. **Den Issue-Branch per Squash nach `dev` integrieren** — im Draft-PR oder lokal:

   ```bash
   git checkout dev
   git merge --squash feat/new-feature
   git commit
   ```

2. **Push ausführen, um das Dev-Deployment zu starten**:

   ```bash
   git push origin dev
   ```

   `fd-ci` prüft den Stand, danach deployt `fd-deploy-dev` automatisch.

3. **Für die Produktion den Promote auslösen** (nach Versionsbump):

   ```bash
   gh workflow run fd-promote-prd.yml
   ```

   `main` wird nicht lokal gemergt. Der Promote-Workflow merged `dev` nach `main` und stößt
   `fd-deploy-prd` an; Details stehen in [FR006](./features/fr006-autodeploy.md).

## Typische Anwendungsfälle

### Neue Inhalte hinzufügen

1. `git checkout -b feat/new-content`
2. Inhalte hinzufügen und committen.
3. Per Squash nach `dev` integrieren und prüfen; die Produktion folgt über den Promote-Workflow.

### Fehler beheben

1. `git checkout -b fix/bug-description`
2. Fehler beheben und committen.
3. Mergen und pushen.

## Hilfe und Support

Wenn Fragen oder Probleme auftreten:

1. **Dokumentation prüfen**: Lies die vorhandenen Anleitungen.
2. **GitHub Discussions**: Stelle Fragen in der Community.
3. **Issue erstellen**: Melde Probleme direkt im Repository.

Danke für deinen Beitrag zum Frickeldave-Projekt.
