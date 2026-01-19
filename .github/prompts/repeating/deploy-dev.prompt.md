---
agent: 'agent'
description: 'Deploy changes to dev environments.'
model: Claude Haiku 4.5 (copilot)
---

Deploye die Änderungen. Checke als erstes ob alle prerequsites erfüllt sind. Dies sind die folgenden: 

- npm muss installiert sein. 
- git muss installiert sein.
- gh CLI muss installiert sein und ich muss eingeloggt sein.

Führe dabei die folgenden Schritte aus:

1. Analysiere alle offenen Änderungen im Repository und verstehe worum es geht.
2. Sollte aktuell der dev oder main Branch aktiv sein, wechsle zu einem neuen Feature-Branch basierend auf dev und übernimm alle aktuell offenen Änderungen. Der Name sollte aus deiner Analyse aus Schritt 1 abgeleitet werden.
3. Führe den linter (npm run lint) aus und behebe alle gefundenen Probleme.
4. Führe prettier (npm run format) aus, um den Code zu formatieren.
5. Führe vale (npm run prose) aus, um die Rechtschreibung und Grammatik zu prüfen. Behebe alle gefundenen Probleme.
6. Baue das Projekt lokal und stelle sicher, dass keine Fehler auftreten.
7. Wenn du Änderungen aufgrund von Lintermeldungen, Prettier oder vale vorgenommen hast, fahre bitte nochmal den Dev-server hoch und lass mich prüfen ob alles funktioniert wie es soll. 
8. Füge alle Änderungen zu git hinzu.
9. Erstelle einen Commit mit einer sinnvollen Commit-Nachricht. Sollte git noch nicht konfiguriert sein, nutze bitte Name = "David Koenig" und Email = "david.koenig09@gmail.com"
10. Pushe den Branch zu GitHub.
11. Öffne einen Pull Request (PR) zu dem Development-Branch (dev).
12. Warte bis alle PR Checks erfolgreich sind.
13. Merge den PR in den Development-Branch (dev). Sollte das nicht möglich sein, berichte mir darüber.
14. Ist der Merge erfogreich, switche lokal zum Development-Branch (dev) und pull die neuesten Änderungen.
15. Ist der Merge erfolgreich, wird das Deployment in der dev-Umgebung automatisch durch den Job https://github.com/Frickeldave/HomeNet/actions/workflows/host-waltraud.yaml ausgelöst. Bitte überprüfe nun auch den Status dieses Jobs und berichte mir, ob das Deployment erfolgreich war. Dass kann schon mal ein paar Minuten dauern.
16. Frage mich, ob der Feature-Branch gelöscht werden soll, und lösche ihn gegebenenfalls.