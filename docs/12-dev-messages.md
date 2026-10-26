# Richtlinien für Commit-Messages

Dieses Dokument beschreibt die Konvention für Commit-Messages im Repository von Frickeldave. Die
Einhaltung dieser Regeln sorgt für eine klare Historie und unterstützt die vorhandene
Automatisierung.

## Inhaltsverzeichnis

- [Richtlinien für Commit-Messages](#richtlinien-für-commit-messages)
  - [Conventional Commits](#conventional-commits)
    - [Format von Commit-Messages](#format-von-commit-messages)
    - [Typen](#typen)
    - [Beispiele](#beispiele)
    - [Automatische Validierung](#automatische-validierung)
    - [Scope (optional)](#scope-optional)
  - [Hilfe und Support](#hilfe-und-support)

## Conventional Commits

Dieses Projekt erzwingt für alle Commit-Messages das Format **Conventional Commits** mit
`commitlint`. Diese Standardisierung sorgt für:

- eine klare Commit-Historie
- die Grundlage für automatische Changelog-Generierung
- eindeutige Kommunikation von Änderungen
- bessere Integration in CI/CD-Werkzeuge

### Format von Commit-Messages

```
<type>(<optional-scope>): <subject>

<optional-body>

<optional-footer>
```

### Typen

| Typ          | Zweck                                          | Beispiel                                     |
| ------------ | ---------------------------------------------- | -------------------------------------------- |
| **feat**     | Neues Feature                                  | `feat(sidebar): add dark mode toggle`        |
| **fix**      | Fehlerbehebung                                 | `fix(pagination): correct page calculation`  |
| **docs**     | Dokumentationsänderungen                      | `docs: update installation guide`            |
| **style**    | Code-Stil (Formatierung, Semikolons, Leerraum) | `style: format code with Prettier`           |
| **refactor** | Umstrukturierung von Code                      | `refactor(utils): simplify helper functions` |
| **perf**     | Performance-Verbesserungen                     | `perf: optimize image loading`               |
| **test**     | Tests hinzufügen oder aktualisieren           | `test: add unit tests for auth`              |
| **ci**       | Änderungen an der CI/CD-Konfiguration         | `ci: update GitHub Actions workflow`         |
| **chore**    | Wartung, Abhängigkeiten                       | `chore: update dependencies`                 |

### Beispiele

✅ **Gültige Commit-Messages**

```bash
feat: add new authentication system
fix(blog): correct category filtering bug
docs: update README installation steps
ci(deploy): improve production workflow security
chore(deps): update all dependencies to latest
feat(ui): add dark mode support
fix(sidebar): resolve scrolling issue on mobile
refactor(api): simplify request handling
```

❌ **Ungültige Commit-Messages** (werden abgewiesen)

```bash
added new feature              # Missing type
Fixed the bug                  # Wrong case
feat: Add new feature.         # Ends with period
asdfgh                         # No valid format
WIP on something               # Not conventional commits
```

### Automatische Validierung

Der Git-Workflow enthält eine automatische Validierung mit **commitlint**:

- **Hook**: Läuft beim Commit über den `commit-msg`-Hook
- **Aktion**: Blockiert Commits, die das Format nicht einhalten
- **Fehlermeldung**: Liefert konkrete Hinweise zum korrekten Format

Wenn ein Commit abgewiesen wird:

1. Lies die Fehlermeldung.
2. Korrigiere die Commit-Message: `git commit --amend -m "correct: message"`
3. Führe den Commit erneut aus.

### Scope (optional)

Der Scope zeigt an, welcher Bereich des Projekts geändert wurde:

```bash
feat(sidebar): add navigation items       # Modify sidebar component
fix(blog): correct date formatting        # Fix in blog section
docs(config): update setup instructions   # Configuration docs
ci(deploy): improve workflow              # Deployment workflow
```

## Hilfe und Support

Wenn es Fragen oder Probleme zu Commit-Messages gibt:

1. **Dokumentation prüfen**: Lies die vorhandenen Anleitungen.
2. **GitHub Discussions**: Stelle Fragen in der Community.
3. **Issue erstellen**: Melde Probleme direkt im Repository.

Danke für deinen Beitrag zum Frickeldave-Projekt.
