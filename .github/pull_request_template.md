## Zusammenfassung

Closes #

Was ändert sich und warum? Ein bis zwei Sätze reichen – die Begründung gehört ins verlinkte Issue.

## Release-Label und Version

- [ ] Dieser PR trägt genau eines der beiden Labels `release:yes` oder `release:no` — keines oder
      beide lassen den Check `check-release-label` scheitern.
      - `release:yes` — die Version in `package.json` ist angehoben und strikt größer als das höchste
        `dev-v*`-Release; der Deploy veröffentlicht beim Merge ein neues `dev-v<version>`.
      - `release:no` — die Version ist nicht angefasst; sie muss exakt der Version an der Merge-Base
        mit `dev` entsprechen, sonst wird der PR rot.
- [ ] `CHANGELOG.md` hat einen Eintrag unter `## [Unreleased]` im Keep-a-Changelog-Format (`Added`,
      `Changed`, `Fixed`, `Removed`, `Security`), der das Issue als `(#123)` referenziert. Pflicht für
      jeden PR, der Code oder die Site ändert.
- [ ] Der Check `check-release-label` (`fd-pr-release-label`) ist grün. Er prüft das Label und den
      Versionsvergleich; der Promote-Weg (`fd-promote-prd` → `fd-deploy-prd`) führt `dev` → `main`
      zusätzlich nur aus, wenn die Version einen eigenen `## [x.y.z]`-Abschnitt in `CHANGELOG.md` hat
      und höher ist als das letzte GitHub-Release — Einträge nur unter `## [Unreleased]` reichen für
      einen Promote nicht.
- [ ] Base-Branch ist `dev`. `main` wird ausschließlich über den Promote-Weg aktualisiert
      (`fd-promote-prd` stößt `fd-deploy-prd` an); niemals einen PR gegen `main` öffnen.

## Review

- [ ] `fd-ci` ist grün (Lint, Format, Prosa über Vale, 3D-Smoke-Test, e2e) – der Workflow läuft auf
      PRs gegen `dev`.
- [ ] Squad-Review ist dort erfolgt, wo `.squad/routing.md` es verlangt; Tony ist der finale Approver.
- [ ] Squash-Merge nach `dev`, und zwar erst nach ausdrücklichem Go eines Menschen.
