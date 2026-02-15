---
trigger: manual
---

Deploye die Änderungen aus dem aktuellen Arbeitsverzeichnis in den dev-Branch (Solo Development
Workflow).

**Prerequisites prüfen (STOP bei Fehlern):**

- npm installiert (inkl. `npm install`)
- git installiert (Version >= 2.30)
- gh CLI installiert (Version >= 2.0) und authentifiziert (`gh auth status`)
- Aktuelles Verzeichnis ist Git-Repository mit Remote `origin`

**Workflow:**

1. **Analysiere** alle offenen Änderungen (`git status`, `git diff`) und verstehe den Zweck.

2. **Branch-Management:**
   - Wenn `dev` oder `main` aktiv: Erstelle neuen Branch gemäß `12-branch-naming-strategy.md`
     (basierend auf Analyse aus Schritt 1)
   - Wenn anderer Branch aktiv: Validiere Namen, schlage Alternative vor falls nötig
   - Stelle sicher: `git fetch origin dev && git rebase origin/dev`

3. **Stash/Checkout:** Übernimm alle offenen Änderungen (`git stash push -u` oder `git add -p`).

4. **Quality Gates (sequentiell, NIEMALS Dateien löschen):**
   - `npm run lint` → behebe alle Errors/Warnings
   - `npm run format` → formatiere alles
   - `npm run prose` → behebe Rechtschreib-/Grammatikfehler

5. **Build & Test:** `npm run build` + Tests (falls vorhanden). **STOP bei Fehlern und berichte.**

6. **Dev-Server:** Falls Linting/Formatting/Prose-Änderungen → starte `npm run dev` und frage nach
   manueller Prüfung.

7. **Commit:**
   - `git add .`
   - Commit-Message gemäß `docs/11-commit-messages.md`
   - Git-Config falls nötig: `git config user.name "David Koenig"`,
     `git config user.email "david.koenig09@gmail.com"`

8. **Push:** `git push -u origin <branch-name>`

9. **GitHub Issue:** Erstelle Issue (`gh issue create`) mit Beschreibung, Labels und Milestone
   (falls relevant).

10. **Merge:** `git checkout dev && git pull origin dev && git merge <feature-branch> --no-ff`

11. **Deployment:** Prüfe Workflow-Start: `gh run list --workflow=host-waltraud.yaml --limit 1`
    - Gib Run-ID + Link aus
    - Deployment läuft 5-30 Minuten → prüfe selbst nach

12. **Cleanup:** Frage: "Feature-Branch `<name>` löschen? (y/n)" → `git branch -d <name>` +
    `gh pr delete` falls nötig.

**Bei JEDEM Fehler: STOP, vollständigen Status ausgeben (`git status`, `git log --oneline -5`),
Lösungsvorschlag machen.**
