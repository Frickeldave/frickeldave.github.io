# ESLint Installation & Konfiguration

ESLint ist ein statisches Code-Analyse-Tool für JavaScript und TypeScript, das potenzielle Probleme,
Bugs und stilistische Inkonsistenzen in Ihrem Code identifiziert.

- **Fehlerprävention**: Erkennt potenzielle Bugs und problematische Patterns
- **Code-Konsistenz**: Durchsetzt einheitliche Coding Standards
- **Best Practices**: Warnt vor anti-patterns und schlägt bessere Alternativen vor
- **Framework-Support**: Spezielle Regeln für React, Astro, Node.js etc.


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

**Konfiguration** Dieses Repository nutzt die Flat Config in `eslint.config.mjs`. Ältere Projekte
können ESLint auch über `.eslintrc.js` konfigurieren; beide Varianten erlauben
projekt-spezifische Regeln.

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
npm install --save-dev eslint @eslint/js typescript-eslint eslint-plugin-astro astro-eslint-parser globals
```

## ESLint-Konfiguration erstellen

Erstelle im Projekt-Root eine `eslint.config.mjs` (Flat Config). Für ältere ESLint-Versionen zeigt
das folgende Beispiel die klassische `.eslintrc.js`-Schreibweise:

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
  "lint": "eslint ./src --fix",
  "lint:check": "eslint ./src"
}
```

Das `--fix` Flag repariert automatisch behebbare Probleme. Mit `lint:check` kannst du nur prüfen,
ohne automatische Reparaturen.

## Ignore-Patterns

Im Projekt-Root steht kein `.eslintignore` mehr: Seit der Flat Config stehen die Ignore-Patterns im
`ignores`-Block von `eslint.config.mjs`.

**Wichtige Ignore-Patterns erklärt:**

| Pattern           | Grund                                               |
| ----------------- | --------------------------------------------------- |
| `dist/`, `build/` | Build-Ausgaben sollten nicht gelintet werden        |
| `node_modules/`   | Dependencies sind bereits gelintet                  |
| `public/`         | Statische Assets brauchen kein Linting              |
| `*.config.*`      | Konfigurationsdateien haben oft andere Standards    |
| `.astro/`         | Astro-Build-Cache                                   |
| `.cache/`         | Werkzeug-Caches                                     |
| `.env`, `.env.*`  | Enthalten Secrets und gehören nicht ins Linting     |

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
