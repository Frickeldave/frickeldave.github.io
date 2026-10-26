## Zusammenfassung

Closes #

Was ändert sich und warum? Ein bis zwei Sätze reichen – die Begründung gehört ins verlinkte Issue.

## Release-Label und Version

- [ ] Das verlinkte Issue trägt genau ein `release:*`-Label: `release:v1.0.0` (oder ein anderes
      bestehendes Ziel wie `release:v0.6.0`), wenn die Arbeit mit dieser Version ausgeliefert wird,
      `release:backlog`, solange sie keinem Release zugeordnet ist. Das Label hängt am Issue, nicht an
      diesem PR, und kein Workflow validiert es.
- [ ] `CHANGELOG.md` hat einen Eintrag unter `## [Unreleased]` im Keep-a-Changelog-Format (`Added`,
      `Changed`, `Fixed`, `Removed`, `Security`), der das Issue als `(#123)` referenziert. Pflicht für
      jeden PR, der Code oder die Site ändert.
- [ ] Nur Release-PRs ändern `version` in `package.json`. Der Promote-Weg (`fd-promote-prd` →
      `fd-deploy-prd`) führt `dev` → `main` nur aus, wenn diese Version einen eigenen
      `## [x.y.z]`-Abschnitt in `CHANGELOG.md` hat und höher ist als das letzte GitHub-Release –
      Einträge nur unter `## [Unreleased]` reichen für einen Promote nicht.
- [ ] Base-Branch ist `dev`. `main` wird ausschließlich über den Promote-Weg aktualisiert
      (`fd-promote-prd` stößt `fd-deploy-prd` an); niemals einen PR gegen `main` öffnen.

## Review

- [ ] `fd-ci` ist grün (Lint, Format, Prosa über Vale, 3D-Smoke-Test, e2e) – der Workflow läuft auf
      PRs gegen `dev`.
- [ ] Squad-Review ist dort erfolgt, wo `.squad/routing.md` es verlangt; Tony ist der finale Approver.
- [ ] Squash-Merge nach `dev`, und zwar erst nach ausdrücklichem Go eines Menschen.
