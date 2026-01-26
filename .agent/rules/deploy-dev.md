---
trigger: manual
---

Deploye die Änderungen. Checke als erstes ob alle prerequsites erfüllt sind. Dies sind die
folgenden:

- npm muss installiert sein.
- git muss installiert sein.
- gh CLI muss installiert sein und ich muss eingeloggt sein.

Führe dabei die folgenden Schritte aus:

1. Analysiere alle offenen Änderungen im Repository und verstehe worum es geht.
2. Sollten Änderungen im aktuell offenen Branch nocht nicht committed sein, stoppen an dieser Stelle
   und lasse mich wissen, dass ich die Änderungen committen soll.
3. Sollte aktuell der dev oder main Branch aktiv sein, wechsle zu einem neuen Feature-Branch
   basierend auf dev und übernimm alle aktuell offenen Änderungen. Der Name sollte aus deiner
   Analyse aus Schritt 1 abgeleitet werden.
4. Führe den linter (npm run lint) aus und behebe alle gefundenen Probleme. Auf gar keinen Fall
   dürfen dabei Dateien gelöscht werden.
5. Führe prettier (npm run format) aus, um den Code zu formatieren. Auf gar keinen Fall dürfen dabei
   Dateien gelöscht werden.
6. Führe vale (npm run prose) aus, um die Rechtschreibung und Grammatik zu prüfen. Behebe alle
   gefundenen Probleme. Auf gar keinen Fall dürfen dabei Dateien gelöscht werden.
7. Baue das Projekt lokal und stelle sicher, dass keine Fehler auftreten.
8. Wenn du Änderungen aufgrund von Lintermeldungen, Prettier oder vale vorgenommen hast, fahre bitte
   nochmal den Dev-server hoch und lass mich prüfen ob alles funktioniert wie es soll.
9. Füge alle Änderungen zu git hinzu.
10. Erstelle einen Commit mit einer sinnvollen Commit-Nachricht. Sollte git noch nicht konfiguriert
    sein, nutze bitte Name = "David Koenig" und Email = "david.koenig09@gmail.com"
11. Pushe den Branch zu GitHub.
12. Öffne einen Pull Request (PR) zu dem Development-Branch (dev).
13. Warte bis alle PR Checks erfolgreich sind.
14. Merge den PR in den Development-Branch (dev). Sollte das nicht möglich sein, berichte mir
    darüber.
15. Ist der Merge erfogreich, switche lokal zum Development-Branch (dev) und pull die neuesten
    Änderungen.
16. Ist der Merge erfolgreich, wird das Deployment in der dev-Umgebung automatisch durch den Job
    https://github.com/Frickeldave/HomeNet/actions/workflows/host-waltraud.yaml ausgelöst. Da der
    Job ein paar Minuten und bis zu eienr halben Stunden laufen kann, überprüfe nur, ob der Job
    gestartet wurde. Das Ergebnis prüfe ich dann selber im Nachgang.
17. Frage mich, ob der Feature-Branch gelöscht werden soll, und lösche ihn gegebenenfalls.
