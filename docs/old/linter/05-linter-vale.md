# Vale Installation & Konfiguration

Vale ist ein Syntax-aware Linter für Prosa und Dokumentation, der Schreibstil, Grammatik und
Terminologie-Konsistenz überprüft.

- **Schreibstil-Konsistenz**: Durchsetzt einheitliche Schreibregeln
- **Terminologie-Management**: Stellt sicher, dass Fachbegriffe korrekt verwendet werden
- **Syntax-Aware**: Versteht Markdown, reStructuredText, AsciiDoc etc.
- **Anpassbare Regeln**: Unterstützt verschiedene Style Guides (Google, Microsoft, etc.)

**Beispiele für Vale-Regeln:**

```markdown
❌ Vale würde warnen:

- "We should of done this differently" (should have, nicht should of)
- "The API is very easy to use" (subjektive Sprache)
- "Click here for more info" (nicht-deskriptive Links)

✅ Von Vale akzeptiert:

- "We should have implemented this differently"
- "The API provides a straightforward interface"
- "Read the complete documentation for detailed examples"
```

## Installationsvorbereitungen

Vale wird in diesem Repository über Node-Skripte installiert und ausgeführt:

- **Installer**: [scripts/prose-install.mjs](../../scripts/prose-install.mjs)
- **Checker**: [scripts/prose-check.mjs](../../scripts/prose-check.mjs)

Das Installationsskript lädt die passende Vale-Binary in das Verzeichnis `.vale/`, installiert die
Styles `Microsoft` und `write-good` und kann bei Bedarf mit `--force` erneut ausgeführt werden.

**Automatische Installation:** Vale wird automatisch über einen `postinstall` Hook nach jedem
`npm install` installiert und die Styles (Microsoft, write-good) werden automatisch heruntergeladen
und bereinigt:

```json
"scripts": {
  "postinstall": "npm run prose-install && npm run scad:install",
  "prose-install": "node scripts/prose-install.mjs",
  "prose": "node scripts/prose-check.mjs"
}
```

Der zweite Teil des Hooks (`scad:install`) installiert OpenSCAD für den 3D-Build; er hat nichts mit
Vale zu tun, läuft aber im selben `postinstall`.

**Warum dieser Ansatz?**

- ✅ Vale wird automatisch nach dem Klonen installiert
- ✅ Styles (Microsoft, write-good) werden automatisch heruntergeladen und bereinigt
- ✅ Keine manuellen Installationsschritte erforderlich
- ✅ Korrekte Ausführungsberechtigungen werden automatisch gesetzt
- ✅ Plattformübergreifende Kompatibilität (Windows/Linux/macOS)
- ✅ Vale-Binary liegt projektspezifisch unter `.vale/`

## Vale-Konfiguration erstellen

Vale wird über `.vale.ini` und Style-Dateien im `.vale/` Verzeichnis konfiguriert. Über die
`.vale.ini` im Projekt-Root wird die Konfiguration vorgenommen. Folgend ist eine einfache
Start-Konfiguration ohne erweiterte Regelsätze dargestellt; die letzte gültige Konfiguration steht
in der `.vale.ini` im Projektverzeichnis.

Viele Regeln prüft Vale automatisch, weitere sind in den Style-Dateien definiert. Zusätzlich prüft
die Base-Vokabular-Datei, ob Wörter korrekt geschrieben sind.

**Base Vocabulary** (`.vale/styles/Base/accept.txt`):

```
STACKIT
Astro
TypeScript
...
...
...
TOML
Markdown
```

**Base Rejections** (`.vale/styles/Base/reject.txt`):

```
# Common typos and alternatives
Javascript -> JavaScript
Typescript -> TypeScript
Github -> GitHub
```

## Hook erweitern für Vale

Erweitere den Husky pre-commit Hook um Vale:

```sh
#!/usr/bin/env sh
.

echo ""
echo "🚀 Pre-commit Quality Checks"
echo "=============================="
echo ""

...
...
...

echo "📝 Running Vale (Prose Linting)..."
echo "   ↳ Checking documentation and content for style consistency"
npm run prose

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ VALE failed!"
  echo "   ↳ Prose style issues found in documentation"
  echo "   💡 Review the suggestions above and edit the content manually"
  echo "   📋 Vale cannot auto-fix - manual review required"
  echo ""
  exit 1
fi

echo "   ✅ Prose style checks passed successfully"
echo ""

...
...
...

```

## Testen der Vale-Integration

**Nach der Installation:**

Vale wird automatisch installiert wenn du das Repository klonst und `npm install` ausführst. Falls
Vale bereits installiert ist, kannst du die Integration direkt testen:

```bash
# Dependencies installieren (installiert automatisch Vale über den postinstall Hook)
npm install

# Vale-Konfiguration testen
npm run prose

# Einzelne Datei testen
./.vale/vale --config=.vale.ini src/content/blog/example.md

# Vale-Version überprüfen
./.vale/vale --version

# Mit Commit testen (führt den Hook aus)
git add .
git commit -m "test vale integration"
```

## Vale Styles und Regeln

**Installierte Style-Pakete:**

Die folgenden Styles werden automatisch über die Installationsskripte heruntergeladen:

- **Microsoft Writing Style Guide**: [GitHub Repository](https://github.com/errata-ai/Microsoft)
- **write-good**: [GitHub Repository](https://github.com/errata-ai/write-good)

**Base Vocabulary:**

- **Accept-Liste**: [`.vale/styles/Base/accept.txt`](../../.vale/styles/Base/accept.txt)
- **Reject-Liste**: [`.vale/styles/Base/reject.txt`](../../.vale/styles/Base/reject.txt)

**Custom Rules:** Können bei Bedarf im `.vale/styles/Custom/` Verzeichnis erstellt werden.

## Hinweise für Vale

- **Vale kann nicht automatisch fixen** - alle Fehler müssen manuell korrigiert werden
- **Style-Regeln sind anpassbar** - du kannst eigene Regeln für dein Projekt erstellen
- **Vocabulary-Management** - führe projektspezifische Begriffe in `accept.txt` auf
- **Performance** - Vale ist schnell, aber bei sehr großen Repositories kann es länger dauern
- **IDE-Integration** - Es gibt Vale-Extensions für VS Code und andere Editoren
- **CI/CD-Integration** - Vale kann auch in GitHub Actions oder anderen CI-Systemen laufen
- **Automatische Installation** - Vale wird über
  [scripts/prose-install.mjs](../../scripts/prose-install.mjs) installiert und aktualisiert

**Vale sync funktioniert nicht zuverlässig** - die manuelle Installation über Git Clone mit
automatischer Bereinigung wurde hier als soliderer Ansatz gewählt.

**Empfohlene Vale-Einstellungen für technische Dokumentation:**

Siehe aktuelle Konfiguration in [`.vale.ini`](../../.vale.ini) – die Einstellungen sind bereits für
technische Inhalte optimiert:

- `MinAlertLevel = error` – nur Fehler werden gemeldet, Warnungen und Hinweise erscheinen nicht im
  Output
- `Vale.Spelling = NO` – Rechtschreibprüfung aus, weil die Inhalte gemischtsprachig sind
- `Vale.Repetition = NO` – vermeidet Falschmeldungen in langen deutschen Texten
- `Microsoft.PassiveVoice = YES` – Passive Voice wird gemeldet
- `write-good.Weasel = YES` – Weasel-Wörter werden gemeldet
- `Microsoft.Contracting`, `Microsoft.Contractions` und `Microsoft.Quotes = NO` – deutsche
  Anführungszeichen und fehlende Kontraktionen sind korrekt
