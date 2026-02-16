---
trigger: manual
---

Der Prozess zum aktualisieren des dev-branches über einen prompt dauert ganz schön lange. Ich möchte
dass du mir ein node script schreibst. Zweock: Deploye die Änderungen aus dem aktuellen
Arbeitsverzeichnis in den dev-Branch (Solo Development Workflow) unter Verwendungder GitHub copilot
CLI. Dies ist in @generate-metadata.mjs auch schon mal umgesetzt worden). Verwende nur node code,
kein Powershell, kein Bash.

- Name: scripts\workflows\ci\update-dev-branch.mjs

Lege für einzelne Schritte Unterscripte an: scripts\workflows\ci\update-dev-branch-XXX.mjs

**Prerequisites prüfen (STOP bei Fehlern):**

- npm installiert (inkl. `npm install`)
- git installiert (Version >= 2.30)
- gh CLI installiert (Version >= 2.0) und authentifiziert (`gh auth status`)
- Aktuelles Verzeichnis ist Git-Repository mit Remote `origin`

**Workflow:**

1. '' GitHub Issue\*\* Frage nach einer GitHub Issue ID. Diese ist optional. Prüfe, ob ein Issue mit
   der ID in https://github.com/Frickeldave/frickeldave.github.io/issues existiert. Wenn nicht,
   frage erneut nach, der user kann eine neue oder keine ID übergeben. Übergibt der user eine ID,
   wiederhole den Prozess. Übergibt er keine, fahre fort.

2. **Analysiere** alle offenen Änderungen (`git status`, `git diff`).

3.**Verstehe** den Zweck der Änderung über einen prompt, der mit GitHub copilot CLI (gh copilot -p
"<prompt file>") automatisch abgesetzt wird.

4. **GitHub Issue:** Erstelle Issue (`gh issue create`) mit Beschreibung, Labels und Titel wenn
   keiens gegeben ist.

5. **Branch-Management:**
   - Wenn `dev` oder `main` aktiv: Erstelle neuen Branch gemäß `12-branch-naming-strategy.md`
     (basierend auf Analyse aus Schritt 1&2)
   - Wenn anderer Branch aktiv: Validiere Namen, schlage Alternative vor falls nötig
   - Stelle sicher: `git fetch origin dev && git rebase origin/dev`

6. **Stash/Checkout:** Übernimm alle offenen Änderungen (`git stash push -u` oder `git add -p`).

7. **Quality Gates (sequentiell, NIEMALS Dateien löschen):**
   - `npm run lint:check` → **STOP bei Fehlern und berichte.**
   - `npm run format:check` → **STOP bei Fehlern und berichte.**
   - `npm run prose` → **STOP bei Fehlern und berichte.**

8. **Build & Test:** `npm run build` + Tests (falls vorhanden). **STOP bei Fehlern und berichte.**

9. **Commit:**
   - `git add .`
   - Commit-Message gemäß `docs/11-commit-messages.md`
   - Git-Config falls nötig: `git config user.name "David Koenig"`,
     `git config user.email "david.koenig09@gmail.com"`

10. **Push:** `git push -u origin <branch-name>`

11. **Merge:** `git checkout dev && git pull origin dev && git merge <feature-branch> --no-ff`

12. **Deployment:** Prüfe Workflow-Start: `gh run list --workflow=host-waltraud.yaml --limit 1`
    - Gib Run-ID + Link aus
    - Deployment läuft 5-30 Minuten → prüfe selbst nach

13. **Cleanup:** Frage: "Feature-Branch `<name>` löschen? (y/n)" → `git branch -d <name>` +
    `gh pr delete` falls nötig.

14: **Close issue**: Schliesse das GitHub issue.

\*\*Bei JEDEM Fehler: STOP, vollständigen Status ausgeben (`git status`, `git log --oneline -5`)
