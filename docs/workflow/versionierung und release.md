# Versionierung und Release

Diese Seite beschreibt, wie Versionen entstehen, welchen Anteil ein
Pull Request daran hat und was ein Merge auslöst.

## Die eine Quelle: `package.json`

`version` in `package.json` ist die einzige Versionsquelle. Weder die
Workflows noch die Labels führen eine eigene Version, alles andere
leitet sich davon ab:

- Der Footer der Website zeigt die Version des Builds.
- `fd-deploy-dev` veröffentlicht daraus `dev-v<version>`.
- `fd-promote-prd` vergleicht sie mit dem letzten stabilen Release.
- `fd-deploy-prd` erzeugt daraus den Tag `v<version>`.

Angehoben wird sie nur über `npm run versionbump`; das Skript legt
zusätzlich den passenden `## [x.y.z]`-Abschnitt in `CHANGELOG.md` an:

```bash
npm run versionbump -- 1.0.7
```

## Das Gate: `release:yes` oder `release:no`

Jeder PR gegen `dev` trägt genau eines der beiden Labels. Keins oder
beide: der PR ist blockiert. Dieselbe Logik läuft zweimal, als
Pflicht-Check `check-release-label`
(`.github/workflows/fd-pr-release-label.yml`) und im Husky-Hook
`pre-push`.

| Label | Regel | Ergebnis |
| --- | --- | --- |
| `release:yes` | Version > höchstes `dev-v*` | neues Release |
| `release:no` | Version = Merge-Base | Deploy, kein Release |

`release:no` vergleicht gegen die Version an der **Merge-Base** von
PR-Head und `origin/dev`, nicht gegen die Spitze von `dev`. Ein
paralleler Bump auf `dev` macht einen unberührten PR also nicht rot.
Existiert noch kein `dev-v*`-Release, entfällt bei `release:yes` der
Versionsvergleich.

`release:no` heißt nicht "nicht deployen", sondern nur: dieser PR
ändert die Version nicht, es gibt also nichts Neues zu veröffentlichen.

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

## Wo die Version sichtbar ist

Der Footer der Website zeigt `v<version>` und verlinkt auf die
Releases-Seite. Die Seite wird aus `dev` gebaut, dort steht also die
Version des laufenden Dev-Builds; sie ändert sich nur mit
`release:yes`.

## Häufige Fehler

| Meldung | Fix |
| --- | --- |
| `Missing label` | `release:yes` oder `release:no` setzen |
| `requires a version greater` | `npm run versionbump -- x.y.z` |
| `must not change the version` | zurücksetzen oder `release:yes` |
