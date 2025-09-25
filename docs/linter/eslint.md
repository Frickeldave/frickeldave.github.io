# ESLint Installation & Konfiguration

ESLint ist ein statisches Code-Analyse-Tool für JavaScript und TypeScript, das potenzielle Probleme,
Bugs und stilistische Inkonsistenzen in Ihrem Code identifiziert.

- **Fehlerprävention**: Erkennt potenzielle Bugs und problematische Patterns
- **Code-Konsistenz**: Durchsetzt einheitliche Coding Standards
- **Best Practices**: Warnt vor anti-patterns und schlägt bessere Alternativen vor
- **Framework-Support**: Spezielle Regeln für React, Astro, Node.js etc.

- [ESLint Installation \& Konfiguration](#eslint-installation--konfiguration)
  - [ESLint Dependencies installieren](#eslint-dependencies-installieren)
  - [ESLint-Konfiguration erstellen](#eslint-konfiguration-erstellen)
  - [Lint-Script in package.json hinzufügen](#lint-script-in-packagejson-hinzufügen)
  - [ESLint-Ignore-Datei erstellen](#eslint-ignore-datei-erstellen)
  - [Hook erweitern für ESLint](#hook-erweitern-für-eslint)
  - [Testen der ESLint Integration](#testen-der-eslint-integration)
  - [Hinweise für ESLint](#hinweise-für-eslint)


```javascript
// ❌ ESLint würde warnen:
var unusedVariable = "never used"; // unused variable
if ((condition = true)) {
} // assignment instead of comparison
function foo() {
  return;
} // unreachable code

// ✅ ESLint approved:
const usedVariable = "properly used";
if (condition === true) {
}
function foo() {
  return "value";
}
```

**Konfiguration** ESLint wird über `.eslintrc.js` oder `eslint.config.js` konfiguriert und kann
projekt-spezifische Regeln definieren.

**Anwendung während der Entwicklung**

Neben Pre-Commit Hooks und Ausführung in der Pipeline kann ESLint wie folgt aufgerufen werden

- `npm run lint:check` Führt einen Check der gesamte Codebase des Repositories für alle
  .js,.ts,.jsx,.tsx,.astro Dateien aus.
- `npm run lint` Führt einen Check der gesamte Codebase des Repositories für alle
  .js,.ts,.jsx,.tsx,.astro Dateien aus und versucht die gefundenen Errors und Warning automatisch zu
  fixen.
- `npx eslint ./src/lib/taxonomyFilter.ts #--fix` Prüft nur die Datei `/taxonomyFilter.ts` auf
  Fehler, kann mit dem Parameter `--fix` erweitert werden um ein automatisches fixen.

Automatisch gefixed werden kann:

- Formatierung (Semicolons, Quotes, Indentation)
- Import-Sortierung
- Trailing Commas
- Spacing-Regeln

## ESLint Dependencies installieren

Installiere ESLint und die benötigten Plugins für TypeScript und Astro:

```bash
npm install --save-dev eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser astro-eslint-parser eslint-plugin-astro
```

## ESLint-Konfiguration erstellen

Erstelle eine `.eslintrc.js` im Projekt-Root:

```javascript
module.exports = {
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  env: {
    node: true,
    browser: true,
    es2022: true,
  },
  rules: {
    // Allow unused vars that start with underscore
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    // Allow any type occasionally
    "@typescript-eslint/no-explicit-any": "warn",
    // Allow empty interfaces for extending
    "@typescript-eslint/no-empty-interface": "off",
  },
  overrides: [
    {
      files: ["*.astro"],
      extends: ["plugin:astro/recommended"],
      parser: "astro-eslint-parser",
      parserOptions: {
        parser: "@typescript-eslint/parser",
        extraFileExtensions: [".astro"],
      },
      rules: {
        // Astro specific rules can go here
      },
    },
  ],
};
```

## Lint-Script in package.json hinzufügen

Füge ein `lint`-Script zu den Scripts in `package.json` hinzu:

```json
"scripts": {
  "lint": "eslint ./src --ext .js,.ts,.jsx,.tsx,.astro --fix",
  "lint:check": "eslint ./src --ext .js,.ts,.jsx,.tsx,.astro"
}
```

Das `--fix` Flag repariert automatisch behebbare Probleme. Mit `lint:check` kannst du nur prüfen,
ohne automatische Reparaturen.

## ESLint-Ignore-Datei erstellen

Im Projekt-Root ist eine `.eslintignore` gespeichert, um bestimmte Dateien und Ordner vom Linting
auszuschließen.

**Wichtige Ignore-Patterns erklärt:**

| Pattern           | Grund                                               |
| ----------------- | --------------------------------------------------- |
| `dist/`, `build/` | Build-Ausgaben sollten nicht gelintet werden        |
| `node_modules/`   | Dependencies sind bereits gelintet                  |
| `public/`         | Statische Assets brauchen kein Linting              |
| `*.config.*`      | Konfigurationsdateien haben oft andere Standards    |
| `.astro/`         | Astro-Build-Cache                                   |
| `docs/`           | Dokumentation braucht meist kein JavaScript-Linting |
| `.husky/`         | Shell-Scripts, nicht JavaScript                     |
| `wrangler.toml`   | Cloudflare-Konfiguration                            |

## Hook erweitern für ESLint

Erweitere den Husky pre-commit Hook, um ESLint auszuführen:

```sh
#!/usr/bin/env sh
echo "Execute linting -> code quality and best practices"
npm run lint:check
```

## Testen der ESLint Integration

**Zuerst die Dependencies installieren (falls noch nicht geschehen):**

```bash
npm install
```

Dann das ESLint-Setup testen:

```bash
# ESLint manuell ausführen (nur prüfen)
npm run lint:check

# ESLint mit automatischen Reparaturen
npm run lint

# Mit einem Commit testen (führt den Hook aus)
git add .
git commit -m "test eslint integration"
```

## Hinweise für ESLint

- ESLint wird nun bei jedem Commit automatisch ausgeführt und versucht, Probleme zu beheben
- Falls ESLint Fehler findet, die nicht automatisch behoben werden können, wird der Commit blockiert
- Du kannst einzelne Regeln in der `.eslintrc.js` anpassen oder deaktivieren
- Für größere Projekte empfiehlt sich die Verwendung von `lint-staged`, um nur geänderte Dateien zu
  prüfen
