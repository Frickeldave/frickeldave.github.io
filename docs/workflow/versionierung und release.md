# Versionierung und Release

Wie Versionen gebildet werden, welchen Anteil ein Pull Request daran hat
und was ein Merge auf `dev` bzw. `main` auslöst.

## Die eine Quelle: `package.json`

`version` in `package.json` ist die einzige Versionsquelle. Sie ist
strikt `X.Y.Z` ohne Pre-Release- oder Build-Suffixe, weil der
Versionsvergleich dieselbe Funktion wie `versionbump.mjs` nutzt.
Weder Workflows noch Labels führen eine eigene Version:

- Der Footer der Website zeigt die Version des Builds.
- `fd-deploy-dev` veröffentlicht daraus `dev-v<version>`.
- `fd-promote-prd` vergleicht sie mit dem letzten stabilen Release.

Angehoben wird sie nur über `npm run versionbump`; das Skript legt
zusätzlich den passenden `## [x.y.z]`-Abschnitt in `CHANGELOG.md` an:

```bash
npm run versionbump -- 1.0.7
```

## Das Gate: `release:yes` oder `release:no`

Der Präfix `release:` gehört ausschließlich dem PR-Schalter; Issues
tragen keine Release-Zuordnung. Beide Labels verwaltet `fd-configure`.

| Label | Regel | Ergebnis |
| --- | --- | --- |
| `release:yes` | Version > höchstes `dev-v*` | neues Release |
| `release:no` | Version = Merge-Base | Deploy, kein Release |

Genau eines der beiden Labels hängt am PR; keines oder beide lassen den
Check mit einer Meldung scheitern, die das fehlende bzw. zu entfernende
Label nennt. Verglichen wird die Version an der **Merge-Base** von
PR-Head und `origin/dev`, nicht die Spitze von `dev` — ein paralleler
Bump macht einen unberührten PR also nicht rot. Existiert noch kein
`dev-v*`-Release, entfällt bei `release:yes` der Versionsvergleich.

`release:no` heißt nicht "nicht deployen", sondern nur: dieser PR
ändert die Version nicht, es gibt also nichts Neues zu veröffentlichen.

## Der PR-Check `fd-pr-release-label`

`.github/workflows/fd-pr-release-label.yml` läuft bei `opened`,
`synchronize`, `reopened`, `labeled` und `unlabeled` für PRs gegen
`dev`.

- Job und Check heißen `check-release-label`, `runs-on: [self-hosted, fd]`,
  `permissions: contents: read`.
- Ausgecheckt wird der **PR-Head-SHA** mit `fetch-depth: 0`; danach holt
  ein Schritt `origin/<base>` nach, weil ein SHA-Checkout keinen
  Remote-Tracking-Ref für den Basisbranch anlegt.
- Kein `npm ci`: die Skripte importieren nur `node:`-Module und das
  lokale `versionbump.mjs`.
- Labels kommen aus der `LABELS`-Env des Events, sonst über `PR_NUMBER`;
  die Release-Liste über `gh api --paginate repos/<repo>/releases`.

## Der lokale Hook `.husky/pre-push`

`.husky/pre-push` ruft `pre-push-validate.js` für den Branch-Namen auf
und danach `scripts/check-release-label.mjs`; der lokale Modus liest
Labels, Zustand und Basisbranch des offenen PRs über `gh pr view`.

| Situation | Ergebnis |
| --- | --- |
| Kein offener PR, PR nicht `OPEN` oder nicht auf `dev` | grün |
| `gh` fehlt, nicht eingeloggt oder ohne Antwort | grün |
| Release-Liste oder Merge-Base-Version nicht lesbar | grün |
| Offener `dev`-PR mit Regelverstoß | Exit 1 |

`git push --no-verify` überspringt den Hook; verbindlich bleibt der
PR-Check `check-release-label`.

## Nach dem Merge auf `dev`

1. `fd-ci` läuft: Lint, Format, Prosa, 3D-Smoke-Test, e2e.
2. `fd-deploy-dev` dispatcht das Ansible-Playbook (Deploy) und
   veröffentlicht `dev-v<version>` als Pre-Release.
3. Bei `release:no` existiert `dev-v<version>` schon. Der Release-Job
   meldet `already released; skipping` und bleibt grün.

Das Image der Dev-Maschinen (`fd-dev-full`) ist davon unabhängig:
`fd-bootstrap` baut es nur neu, wenn `.squad/team.md`,
`.github/workflows/fd-bootstrap/**` oder die geteilten `scripts/*.mjs`
sich geändert haben. Laufende Maschinen bleiben auf ihrem Image.

## Promote nach `main`

`fd-promote-prd` ist ein manueller Dispatch und prüft vor dem Merge:

- Version in `package.json` größer als das letzte stabile Release,
- eigener `## [x.y.z]`-Abschnitt in `CHANGELOG.md`,
- grüner `fd-ci`-Lauf auf der Spitze von `dev`.

Danach wird `dev` nach `main` gemergt und `fd-deploy-prd` gestartet:
Pages-Deploy, Tag `v<version>`, stabiles Release. Gleiche Version
bedeutet No-Op (grün), kleinere Version bedeutet Fehler.

## Required-Status-Check einrichten

Erst mit `check-release-label` im Ruleset für `dev` blockiert das Gate
einen Merge. Der Eintrag erfolgt, nachdem der Workflow auf `dev` liegt:
`pull_request`-Workflows laufen aus dem PR-Branch, ein PR ohne die
Datei meldet den Check nicht und bliebe auf "Expected" stehen.

```bash
gh api -X POST repos/<owner>/<repo>/rulesets --input - <<'JSON'
{ "name": "dev release gate", "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/dev"] } },
  "rules": [ { "type": "required_status_checks",
    "parameters": {
      "strict_required_status_checks_policy": false,
      "required_status_checks": [ { "context": "check-release-label" } ]
    } } ] }
JSON
```

## Wo die Version sichtbar ist

Der Footer der Website zeigt `v<version>` und verlinkt auf die
Releases-Seite. Die Seite wird aus `dev` gebaut, dort steht also die
Version des laufenden Dev-Builds; sie ändert sich nur mit
`release:yes`.

## Fehlersuche

| Meldung | Fix |
| --- | --- |
| `Missing label` | `gh pr edit <nr> --add-label release:yes` |
| Beide Labels gesetzt | das nicht gewollte per `--remove-label` |
| `requires a version greater` | `npm run versionbump -- x.y.z` |
| `must not change the version` | zurücksetzen oder `release:yes` |
| Merge-Base-Version nicht lesbar | `fetch-depth: 0` prüfen |
