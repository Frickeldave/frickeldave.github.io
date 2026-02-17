---
trigger: manual
---

Ich möchte, dass du mir ein node script schreibst. Zweock: Deploye die Änderungen aus dem aktuellen
dev Branch in den main-Branch (Solo Development Workflow) unter Verwendungder GitHub copilot CLI.
Verwende nur node code, kein Powershell, kein Bash.

Analysiere, ob ein einzelnes Script mit Paramter target:dev|prd sinn macht, oder 2 Scripte:

- Name: scripts\workflows\ci\update-prd-branch.mjs
- Name: scripts\workflows\ci\update-dev-branch.mjs

Analysiere und entscheide basierend auf:

- Code-Reuse: Wie viele Schritte sind identisch?
- Unterschiede: Wie fundamental unterscheiden sich die Workflows?
- Wartbarkeit: Was ist wartbarer?
- Fehleranfälligkeit: Wo sind weniger Conditions = besser?

Lege für einzelne Schritte Unterscripte an:

- scripts\workflows\ci\update-dev-branch-XXX.mjs die nur für merges von feature branch auf dev sind
- scripts\workflows\ci\update-prd-branch-XXX.mjs die nur für merges von dev branch auf main sind
- scripte die für beides sind sollen so abgelegt werden: scripts\workflows\ci\update-branch-XXX.mjs

Baue die gleichen Eingabeparameter ein, wie bei npm run deploy:dev und stelle npm run deploy:prd zur
Verfügung.

**Prerequisites prüfen (STOP bei Fehlern):**

- npm installiert (inkl. `npm install`)
- git installiert (Version >= 2.30)
- gh CLI installiert (Version >= 2.0) und authentifiziert (`gh auth status`)
- Aktuelles Verzeichnis ist Git-Repository mit Remote `origin`
- Prüfe dass aktueller Branch = dev ist
- Prüfe dass dev clean ist (git status --porcelain)
- Prüfe dass dev auf origin/dev gepusht ist

**Workflow:**

1. **GitHub Issue** Frage nach einer GitHub Issue ID. Diese ist optional. Prüfe, ob ein Issue mit
   der ID in https://github.com/Frickeldave/frickeldave.github.io/issues existiert. Wenn nicht,
   frage erneut nach, der user kann eine neue oder keine ID übergeben. Übergibt der user eine ID,
   wiederhole den Prozess. Übergibt er keine, fahre fort.

2. **Analysiere** Unterschiede zwischen main und dev:
   - `git fetch origin` (remote Updates holen)
   - `git diff main..dev --stat` (was wird gemerged)
   - `git log main..dev --oneline` (welche Commits)

3. **Verstehe** den Zweck: Nutze GitHub Copilot CLI um die Änderungen zwischen main und dev zu
   verstehen und eine Deployment-Summary zu erstellen

4. **GitHub Issue:** Erstelle Issue (`gh issue create`) mit Beschreibung, Label "ci" und Titel
   "deploy: <generated summary from copilot>" wenn kein GitHub Issue gegeben ist.

5. **Checkout main** und pull latest
   - git checkout main
   - git pull origin main
   - STOP wenn: Checkout fails, Pull-Konflikt, dirty state

6. Merge dev→main
   - git merge dev --no-ff -m "chore: deploy dev to production"
   - STOP bei Merge-Konflikt: → Bedeutet: main hat unerlaubte direkte Commits! → git merge --abort →
     git checkout dev → Report: "❌ main hat direkte Commits. Bitte main säubern!" → Exit 1

7. Build & Test
   - npm run build
   - STOP bei Fehler + Rollback

8. Quality Gates auf main (Sanity-Check)
   - npm run lint:check
   - npm run format:check
   - npm run prose
   - Bei JEDEM Fehler: Rollback + Report

9. **Push** auf main

10. Deployment-Check
    - Warte max. 30 Sekunden auf Workflow-Start
    - Prüfe mit: gh run list --workflow=deploy-prd.yml --limit 1 --json status,url
    - Ausgabe bei Erfolg: → "✅ Deployment-Workflow gestartet" → Link: <Workflow-URL>
    - Bei Timeout (kein neuer Run in 30s): → "⚠️ Workflow nicht automatisch erkannt" → Link:
      https://github.com/.../actions/workflows/deploy-prd.yml → "Bitte manuell prüfen" → Fortfahren
      (kein Error!)

11. **Close issue**: Schliesse das GitHub issue.

12. Cleanup & Abschluss
    - git checkout dev (zurück zum Arbeitsbranch)
    - Ausgabe Zusammenfassung:

      ✅ Production Deployment erfolgreich!

      📦 Commit: <SHA> (git rev-parse HEAD) 📋 Issue: #<id> (geschlossen) 🚀 Workflow: <URL> 🌿
      Branch: dev → main

      ℹ️ Du bist wieder auf dev für weitere Entwicklung

Rollback-Funktion (bei Fehler nach Merge):

1. git reset --hard origin/main
2. git checkout dev
3. Report:
   - "❌ Deployment fehlgeschlagen"
   - "🔄 main wurde zurückgesetzt"
   - "📍 Du bist wieder auf dev"
   - Fehlerdetails
