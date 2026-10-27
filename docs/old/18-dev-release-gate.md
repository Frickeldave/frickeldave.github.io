# Release-Gate für Pull Requests

Dieses Dokument beschreibt den Release-Schalter dieses Repositories: genau ein Label pro Pull
Request gegen `dev`, geprüft von einem Required-Status-Check und von demselben Husky-Hook, der
lokal vor dem Push läuft. Beide Wege nutzen dieselbe Regel-Logik; sie können nicht auseinanderlaufen.

Das Modell ist aus dem Ursprungsprojekt CRAFT portiert, ohne dessen Workspace-Prüfung — dieses
Repository hat keine npm-Workspaces (`workspaces` fehlt in `package.json`).

## Inhaltsverzeichnis

- [Label-Modell](#label-modell)
- [Regeln](#regeln)
- [Versionsvergleich im Detail](#versionsvergleich-im-detail)
- [PR-Check `fd-pr-release-label`](#pr-check-fd-pr-release-label)
- [Lokaler Hook `.husky/pre-push`](#lokaler-hook-huskypre-push)
- [Zusammenspiel mit Deploy und Promote](#zusammenspiel-mit-deploy-und-promote)
- [Required-Status-Check einrichten](#required-status-check-einrichten)
- [Fehlersuche](#fehlersuche)

## Label-Modell

Der Präfix `release:` gehört ausschließlich dem PR-Schalter. Es gibt genau zwei Labels, beide in
`fd-configure` verwaltet:

| Label         | Bedeutung                                                              |
| :------------ | :--------------------------------------------------------------------- |
| `release:yes` | Neue Version, dev-Release beim Deploy — die Version steigt an          |
| `release:no`  | Version bleibt unverändert — der PR fasst `package.json` nicht an      |

Die früheren Issue-Ziel-Labels (`release:v0.4.0`, `release:v0.5.0`, `release:v0.6.0`,
`release:v1.0.0`, `release:backlog`) sind ersatzlos entfernt. Ein Issue trägt damit keine
Release-Zuordnung mehr; die Release-Entscheidung fällt am Pull Request. `squad-label-enforce` setzt
auf Issues kein `release:backlog` mehr und entfernt dort keine `release:`-Labels mehr.

## Regeln

1. Genau eines der Labels `release:yes` / `release:no` hängt am Pull Request. Keines oder beide →
   der Check scheitert mit einer Meldung, die das fehlende bzw. das zu entfernende Label nennt.
2. `release:yes` → die Version in `package.json` ist **strikt größer** als die höchste
   `dev-v*`-Release-Version. Sonst nennt die Meldung den Fix: `npm run versionbump -- x.y.z`.
3. `release:no` → die Version ist **exakt gleich** der Version an der **Merge-Base** von PR-Head und
   `origin/dev`. Größer oder kleiner scheitert mit der Richtung (`höher` / `niedriger`) und dem
   Rückweg (`npm run versionbump -- <basisversion>`) bzw. dem Hinweis auf `release:yes`.
4. Existiert noch kein `dev-v*`-Release, entfällt bei `release:yes` der Versionsvergleich; es gilt
   nur die Label-Regel.
5. Die Version muss strikt `X.Y.Z` sein (keine Pre-Release- oder Build-Suffixe), weil der
   Versionsvergleich dieselbe Funktion wie `versionbump.mjs` nutzt.

## Versionsvergleich im Detail

Verglichen wird bewusst die **Merge-Base** und nicht die Spitze von `dev`. Hat ein anderer PR `dev`
inzwischen auf `1.0.7` gehoben, bleibt ein unberührter `release:no`-PR mit `1.0.6` grün — er hat die
Version ja nicht angefasst. Nur so können parallele Bumps einen fremden PR nicht rot machen.

Bei `release:yes` zählt dagegen das höchste veröffentlichte `dev-v*`-Pre-Release, weil
`fd-deploy-dev` genau daraus ein Release baut: eine Version, die es als `dev-v<version>` schon gibt,
würde beim Deploy zum No-Op und ist deshalb kein gültiges „neues Release“.

## PR-Check `fd-pr-release-label`

`.github/workflows/fd-pr-release-label.yml` läuft bei `opened`, `synchronize`, `reopened`,
`labeled` und `unlabeled` für Pull Requests gegen `dev`.

- Job-Name und Check-Name: `check-release-label`, `runs-on: [self-hosted, fd]`,
  `permissions: contents: read`.
- Ausgecheckt wird der **PR-Head-SHA** mit `fetch-depth: 0`; danach holt ein Schritt
  `origin/<base>` nach, weil das Auschecken eines Commit-SHA keinen Remote-Tracking-Ref für den
  Basisbranch anlegt.
- **Kein `npm ci`**: `scripts/check-release-label.mjs` und `scripts/release-gate.mjs` importieren
  ausschließlich `node:`-Module plus das lokale `versionbump.mjs`. `npm ci` würde über den
  `postinstall`-Hook Vale und OpenSCAD herunterladen und den Job unnötig teuer machen.
- Label-Quelle ist die `LABELS`-Env des Events (JSON-Array der Label-Namen). Fehlt sie, fragt das
  Skript die GitHub-API über `PR_NUMBER`; Infrastrukturfehler lassen den Job sichtbar scheitern.
- Die Release-Liste kommt über `gh api --paginate repos/<repo>/releases`, mit `GH_TOKEN` aus dem
  Workflow.

## Lokaler Hook `.husky/pre-push`

`.husky/pre-push` ruft weiterhin `pre-push-validate.js` für den Branch-Namen auf und danach
`scripts/check-release-label.mjs`. Der lokale Modus liest Labels, Zustand und Basisbranch des
offenen PRs zum aktuellen Branch über `gh pr view`.

Verhalten bei fehlender Information — bewusst gewählt:

| Situation                                            | Ergebnis                    |
| :--------------------------------------------------- | :-------------------------- |
| Kein offener PR zum Branch                           | grün, keine Ausgabe         |
| PR zeigt nicht auf `dev`, oder PR ist nicht `OPEN`   | grün, keine Ausgabe         |
| `gh` fehlt, ist nicht eingeloggt oder antwortet nicht | grün, keine Ausgabe        |
| Release-Liste oder Merge-Base-Version nicht lesbar    | grün, keine Ausgabe         |
| Offener `dev`-PR mit Regelverstoß                    | **blockiert** (Exit 1)      |

Der Hook darf lokal nicht blockieren, wenn die Information fehlt: Der bindende PR-Check läuft
ohnehin auf jedem Push in den PR. Wer auch den Regelverstoß übergehen will, nutzt
`git push --no-verify` — der PR-Check `check-release-label` bleibt davon unberührt.

## Zusammenspiel mit Deploy und Promote

Die Deploy-Workflows bleiben unverändert:

- `fd-deploy-dev` veröffentlicht nach einem grünen `fd-ci`-Lauf auf `dev` automatisch das
  Pre-Release `dev-v<version>`; ein zweiter Lauf derselben Version ist ein No-Op.
- `fd-promote-prd` gatet gegen das letzte **stabile** Release und verlangt einen eigenen
  `## [x.y.z]`-Abschnitt in `CHANGELOG.md`.

`release:no` bedeutet „dieser PR verändert die Version nicht“. Der Deploy läuft trotzdem normal, der
Release-Job wird zum No-Op, weil `dev-v<version>` bereits existiert. `release:yes` heißt: Der PR
hebt die Version an, `fd-deploy-dev` erzeugt beim Merge das nächste `dev-v*`-Pre-Release.

## Required-Status-Check einrichten

Der Check heißt `check-release-label`. Damit er einen Merge blockiert, muss er im Ruleset für `dev`
als Required-Status-Check eingetragen sein:

```bash
gh api -X POST repos/{owner}/{repo}/rulesets --input - <<'JSON'
{
  "name": "dev release gate",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/dev"], "exclude": [] } },
  "rules": [
    { "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [{ "context": "check-release-label" }]
      } }
  ]
}
JSON
```

Wichtig: `pull_request`-Workflows laufen aus dem Branch des PRs. Ein PR, dessen Branch die Datei
`fd-pr-release-label.yml` noch nicht enthält, meldet den Check nicht — sein Merge bleibt dann auf
„Expected“ stehen. Deshalb wird der Required-Status-Check erst aktiviert, nachdem dieser Workflow
auf `dev` liegt.

## Fehlersuche

- **„Kein Release-Label“**: `gh pr edit <nr> --add-label release:yes` (Version angehoben) oder
  `--add-label release:no` (Version unverändert).
- **„Beide Labels gesetzt“**: `gh pr edit <nr> --remove-label release:no` (oder `release:yes`).
- **`release:yes` und „Version nicht größer“**: `npm run versionbump -- x.y.z` mit einer Version über
  dem höchsten `dev-v*`. Die Liste zeigt `gh release list`.
- **`release:no` und „Version verändert“**: `npm run versionbump -- <basisversion>` zurück auf die
  Merge-Base-Version — oder bewusst `release:yes` setzen.
- **„Merge-Base-Version nicht lesbar“** im CI: Der PR-Head wurde ohne Historie ausgecheckt; der
  Workflow braucht `fetch-depth: 0` und den nachgeholten `origin/<base>`-Ref.
- **Lokal passiert nichts, obwohl der PR rot ist**: Erwartetes Verhalten. Der Hook ist absichtlich
  nachsichtig; verbindlich ist der PR-Check.

Siehe auch [Nutzung](./11-dev-usage.md), [Automatisierte Deployment-Workflows](./features/fr006-autodeploy.md)
und [Branching- und Naming-Strategie](./13-dev-branch-naming-strategy.md).
