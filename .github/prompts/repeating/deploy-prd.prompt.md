---
agent: 'agent'
description: 'Deploy changes to production environment.'
model: Claude Haiku 4.5 (copilot)
---

Deploye die Änderungen. Checke als erstes ob alle prerequsites erfüllt sind. Dies sind die folgenden: 

- npm muss installiert sein. 
- git muss installiert sein.
- gh CLI muss installiert sein und ich muss eingeloggt sein.

Führe dabei die folgenden Schritte aus:

1. Hole alle Updates für den dev und den main Branch.
2. Vergleiche alle Änderungen im Repository zwischen dev und main Branch und verstehe worum es geht.
3. Aktiviere den dev Branch.
4. Baue das Projekt lokal und stelle sicher, dass keine Fehler auftreten.
5. Öffne einen Pull Request (PR) vom Development-Branch (dev) in den main Branch.
6. Warte bis alle PR Checks erfolgreich sind.
7. Merge den PR in den Main-Branch. Sollte das nicht möglich sein, berichte mir darüber.
8. Ist der Merge erfogreich, switche lokal zum Main-Branch und pull die neuesten Änderungen.
9. Ist der Merge erfolgreich, wird das Deployment in der prd-Umgebung automatisch durch den Job https://github.com/Frickeldave/frickeldave.github.io/actions/workflows/deploy-prd.yml ausgelöst. Bitte überprüfe nun auch den Status dieses Jobs und berichte mir, ob das Deployment erfolgreich war. Dass kann schon mal ein paar Minuten dauern.

