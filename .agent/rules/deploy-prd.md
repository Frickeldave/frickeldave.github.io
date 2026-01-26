---
trigger: manual
---

Deploye die Änderungen in prod. Checke als erstes ob alle prerequsites erfüllt sind. Dies sind die
folgenden:

- npm muss installiert sein.
- git muss installiert sein.
- gh CLI muss installiert sein und ich muss eingeloggt sein.

Führe dabei die folgenden Schritte aus:

1. Merke Dir, in welchem Branch du dich aktuell befindest.
2. Hole alle Updates für den dev und den main Branch.
3. Vergleiche alle Änderungen im Repository zwischen dev und main Branch und verstehe worum es geht.
4. Aktiviere den dev Branch.
5. Baue das Projekt lokal und stelle sicher, dass keine Fehler auftreten.
6. Öffne einen Pull Request (PR) vom Development-Branch (dev) in den main Branch.
7. Warte bis alle PR Checks erfolgreich sind.
8. Merge den PR in den Main-Branch. Sollte das nicht möglich sein, berichte mir darüber.
9. Ist der Merge erfolgreich, wird das Deployment in der prd-Umgebung automatisch durch den Job
   https://github.com/Frickeldave/frickeldave.github.io/actions/workflows/deploy-prd.yml ausgelöst.
   Bitte überprüfe nun auch den Status dieses Jobs und berichte mir, ob das Deployment erfolgreich
   war. Dass kann schon mal ein paar Minuten dauern.
10. Frage mich, ob du in den Branch zurück wechseln sollst, den du dir in Schritt 1 gemerkt hast.
