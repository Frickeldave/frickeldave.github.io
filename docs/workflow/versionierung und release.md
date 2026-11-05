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

`fd-deploy-prd` ist der Produktionspfad: Er prüft CI auf `dev`, promotet `dev`
nach `main`, deployt Pages und veröffentlicht erst danach Tag und Release.
`fd-promote-prd` ist der manuelle Weg davor und behält vorerst das strenge
Versions-Gate (siehe unten).

### Zwei Gates: Promotion und Release

Seit dem Katalog-Schnellweg fragt der Produktions-Deploy zwei Dinge getrennt:

| Gate | Frage | Entscheidung |
| --- | --- | --- |
| Promotion | Darf der Stand nach `main`? | `promote` |
| Release | Ist das ein Release? | `should_release` |

Dazwischen liegt der Deploy: `should_deploy` entscheidet, ob Pages gebaut und
veröffentlicht wird.

- `dev_version > latest_stable`: `promote=true`, Merge `dev` → `main`,
  `should_release=true`.
- `dev_version == latest_stable` mit nicht leerem Diff
  `origin/main..origin/dev`, der ausschließlich verwaltete Katalog- und
  Produktbildpfade enthält: `promote=true` („Katalog-Merge ohne Release“),
  `should_deploy=true`, `should_release=false`.
- `dev_version == latest_stable` mit leerem oder gemischtem Diff:
  `promote=false`, kein Merge, grüner Lauf.
- `dev_version < latest_stable`: `::error::` und Exit 1, weil `dev` hinter
  `main` zurückliegt.

`should_deploy` ist wahr, wenn `main` sich durch den Merge geändert hat —
gemessen am Vergleich vor und nach dem Merge — oder wenn `force_deploy` gesetzt
ist. `should_release` ist wahr, wenn die Version auf `main` höher ist als das
letzte stabile Release oder noch kein stabiles Release existiert. Der
Pages-Deploy läuft bei `should_deploy`, Tag und GitHub-Release zusätzlich nur
bei `should_release`.

### Allowlist des Katalog-Schnellwegs

`scripts/catalog-only.mjs` klassifiziert den Diff `main..dev` und spiegelt exakt
`_is_managed_path`/`_MANAGED_IMAGE_RE` der Store-Sync-Integration:

- `public/data/handmade.json`,
- `src/assets/handmade/<3D|EP|LA|SB|WO>/<Artikel>/<Artikel>-NN.<Endung>` mit
  `jpg`, `jpeg`, `png`, `webp` oder `gif`, wobei die Artikelnummer mit ihrer
  Kategorie beginnt und jede tiefere Ebene fremd ist.

Alles andere ist Website-Inhalt und damit kein reiner Katalog-Deploy:
`3dmodels/**`, `public/data/news.json`, `public/data/link-mappings.json`,
Workflows, Dokumentation und Quellcode. Ein gemischter Diff braucht weiterhin
einen Versions-Bump; ohne ihn bleibt die Promotion bei gleicher Version aus.
Pfade mit Backslash, absolute Pfade, `..`-Segmente und leere Segmente gelten nie
als verwaltet.

Ein reiner Katalog-Deploy lässt `version` in `package.json` unverändert. Die
Footer-Version der Website bleibt damit gleich, weil sie den Stand des Builds
zeigt und ein Daten-Deploy keinen neuen Versionsstand erzeugt.

### Retry mit `force_deploy`

Der manuelle Dispatch von `fd-deploy-prd` kennt neben `dry_run` den Eingang
`force_deploy` (Standard `false`). Ist er `true`, läuft `deploy-pages` auch ohne
neuen Merge, etwa um einen fehlgeschlagenen Pages-Deploy zu wiederholen.
`should_release` bleibt davon unberührt: Ein Retry taggt nur dann, wenn
zusätzlich eine Versionserhöhung ansteht.

### Rollback eines Daten-Deploys

Ein reiner Katalog-Deploy hat keinen Tag und kein Release, an dem er sich
zurücknehmen ließe; einen eigenen `data-*`-Tag gibt es nicht. Zurückgerollt wird
stattdessen der Merge-Commit:

```bash
git revert -m 1 <merge-commit>
```

`-m 1` behält `main` als erste Elternseite, also den Stand vor dem Merge. Der
Revert ist ein normaler Commit und braucht keinen Versions-Bump; er läuft als
nächster Katalog-Deploy durch dasselbe Gate. Danach `fd-deploy-prd` erneut
starten — oder mit `force_deploy` nur den Pages-Deploy wiederholen, wenn
ausschließlich der Deploy fehlgeschlagen war.

### Der manuelle Weg `fd-promote-prd`

`fd-promote-prd` ist ein manueller Dispatch und prüft vor dem Merge:

- Version in `package.json` größer als das letzte stabile Release,
- eigener `## [x.y.z]`-Abschnitt in `CHANGELOG.md`,
- grüner `fd-ci`-Lauf auf der Spitze von `dev`.

Er behält vorerst das strenge Versions-Gate: Gleiche Version bedeutet No-Op
(grün), kleinere Version bedeutet Fehler. Ein Katalog-only-Deploy ohne Bump
läuft deshalb über `fd-deploy-prd`, nicht über `fd-promote-prd`.

Danach wird `dev` nach `main` gemergt und `fd-deploy-prd` gestartet:
Pages-Deploy, Tag `v<version>`, stabiles Release.

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

Der Footer der Website zeigt `v<version>` und verlinkt auf die Releases-Seite.
Auf der Dev-Seite steht die Version des laufenden Dev-Builds; sie ändert sich
mit `release:yes`. Ein reiner Katalog-Deploy nach `main` lässt `version`
unverändert, deshalb zeigt auch die Produktionsseite nach dem Deploy weiterhin
die Version des letzten Releases.

## Fehlersuche

| Meldung | Fix |
| --- | --- |
| `Missing label` | `gh pr edit <nr> --add-label release:yes` |
| Beide Labels gesetzt | das nicht gewollte per `--remove-label` |
| `requires a version greater` | `npm run versionbump -- x.y.z` |
| `must not change the version` | zurücksetzen oder `release:yes` |
| Merge-Base-Version nicht lesbar | `fetch-depth: 0` prüfen |
