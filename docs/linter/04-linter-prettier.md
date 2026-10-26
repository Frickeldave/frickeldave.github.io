# Was ist Prettier?

Prettier ist ein automatischer Code-Formatter, der deinen Code konsistent und lesbar formatiert, ohne dass du dich um Stil-Entscheidungen kümmern musst. Es unterstützt viele Sprachen wie JavaScript, TypeScript, HTML, CSS, Markdown und mehr. Prettier sorgt für einheitliche Einrückungen, Zeilenumbrüche und andere Formatierungsregeln in deinem gesamten Projekt.

- [Was ist Prettier?](#was-ist-prettier)
  - [Prettier-Konfiguration erstellen](#prettier-konfiguration-erstellen)
  - [Format-Scripts in package.json hinzufügen](#format-scripts-in-packagejson-hinzufügen)
  - [Prettier-Ignore-Datei erstellen](#prettier-ignore-datei-erstellen)
  - [Hook erweitern für Prettier](#hook-erweitern-für-prettier)
  - [Testen der Prettier-Integration](#testen-der-prettier-integration)
  - [Editor-Integration für Prettier](#editor-integration-für-prettier)
  - [Hinweise für Prettier](#hinweise-für-prettier)


## Prettier-Konfiguration erstellen

Erstelle eine `.prettierrc` im Projekt-Root:

```json
{
  "plugins": ["prettier-plugin-astro", "prettier-plugin-tailwindcss"],
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 80,
  "useTabs": false,
  "bracketSpacing": true,
  "bracketSameLine": false,
  "arrowParens": "always",
  "endOfLine": "lf",
  "overrides": [
    {
      "files": ["*.astro"],
      "options": {
        "parser": "astro"
      }
    },
    {
      "files": ["*.md", "*.mdx"],
      "options": {
        "printWidth": 100,
        "proseWrap": "always"
      }
    },
    {
      "files": ["*.json", "*.jsonc"],
      "options": {
        "printWidth": 100
      }
    }
  ]
}
```

**Erklärung der wichtigsten Konfigurationsoptionen:**

| Option          | Wert       | Beschreibung                                         |
| --------------- | ---------- | ---------------------------------------------------- |
| `semi`          | `true`     | Semikolons am Ende von Statements                    |
| `singleQuote`   | `false`    | Verwende doppelte Anführungszeichen                  |
| `tabWidth`      | `2`        | Anzahl Leerzeichen pro Einrückungsebene              |
| `trailingComma` | `"es5"`    | Trailing Commas wo ES5 gültig ist (Objekte, Arrays)  |
| `printWidth`    | `80`       | Maximale Zeilenlänge vor Umbruch                     |
| `arrowParens`   | `"always"` | Klammern um Arrow-Function-Parameter                 |
| `endOfLine`     | `"lf"`     | Unix-style line endings (wichtig für cross-platform) |
| `proseWrap`     | `"always"` | Markdown-Text wird umgebrochen                       |

## Format-Scripts in package.json hinzufügen

Füge `format`-Scripts zu den Scripts in `package.json` hinzu:

```json
"scripts": {
  "format": "prettier --write ./src --log-level silent",
  "format:check": "prettier --check ./src"
}
```

**Script-Erklärung:**

- `format`: Formatiert alle Dateien im `src/` Verzeichnis und schreibt Änderungen zurück (`-w` =
  write)
- `format:check`: Prüft nur, ob Dateien korrekt formatiert sind, ohne sie zu ändern

## Prettier-Ignore-Datei erstellen

Eine `.prettierignore` im Projekt-Root sorgt dafür, dass bestimmte Dateien von der Formatierung
ausgeschlossen sind. 

## Hook erweitern für Prettier

Erweitere den Husky pre-commit Hook, um Prettier vor ESLint auszuführen:

```sh
#!/usr/bin/env sh
echo "Execute formatting (PRETTIER) -> consistent code formatting"
npm run format:check

echo "Execute linting (ESLINT) -> code quality and best practices"
npm run lint:check

if [ $? -ne 0 ]; then
  echo "❌ ESLINT failed! Please fix the linting errors before committing."
  echo "💡 Run 'npm run lint' to automatically fix some issues."
  exit 1
fi

echo "✅ All checks passed successfully!"
```

**Wichtig:** Prettier läuft vor ESLint, da Prettier Formatierung Einfluss auf ESLint-Regeln haben
kann.

## Testen der Prettier-Integration

**Zuerst die Dependencies installieren (falls noch nicht geschehen):**

```bash
npm install
```

Dann das Prettier-Setup testen:

```bash
# Prettier manuell ausführen (nur prüfen)
npm run format:check

# Prettier mit automatischer Formatierung
npm run format

# Einzelne Datei formatieren
npx prettier --write src/components/example.astro

# Mit einem Commit testen (führt den Hook aus)
git add .
git commit -m "test prettier integration"
```

## Editor-Integration für Prettier

**VS Code Konfiguration (.vscode/settings.json):**

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "prettier.documentSelectors": ["**/*.astro"],
  "[astro]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

**Installiere die VS Code Prettier Extension:**

```bash
code --install-extension esbenp.prettier-vscode
```

## Hinweise für Prettier

- Prettier formatiert automatisch bei jedem Commit durch den Husky-Hook
- Du kannst einzelne Zeilen von der Formatierung ausschließen mit `// prettier-ignore`
- Prettier und ESLint können Konflikte haben - verwende `eslint-config-prettier` um Konflikte zu
  vermeiden
- Für Markdown-Dateien wird eine größere `printWidth` (100) verwendet für bessere Lesbarkeit
- Das `prettier-plugin-tailwindcss` Plugin sortiert automatisch Tailwind-Klassen
