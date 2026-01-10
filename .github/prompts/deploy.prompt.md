---
agent: 'agent'
description: 'Deploy changes to dev and production environments.'
model: Gemini 3 Flash (Preview) (copilot)
---

Deploye die Änderungen. Frage mich auf jeden Fall, ob in Produktion (prd) deployed werden soll. Checke als erstes ob alle prerequsites erfüllt sind. Dies sind die folgenden: 

- npm muss installiert sein in version 24. 
- git muss installiert sein.
- gh CLI muss installiert sein und ich muss eingeloggt sein.

Führe dabei die folgenden Schritte aus:

1. Sollte aktuell der dev oder main Branch aktiv sein, wechsle zu einem neuen Feature-Branch basierend auf dev und übernimm alle aktuell offenen Änderungen.
2. Führe den linter aus und behebe alle gefundenen Probleme.
3. Führe prettier aus, um den Code zu formatieren.
4. Führe vale aus, um die Rechtschreibung und Grammatik zu prüfen. Behebe alle gefundenen Probleme.
5. Füge alle Änderungen zu git hinzu.
6. Erstelle einen Commit mit einer sinnvollen Commit-Nachricht. Sollte git noch nicht konfiguriert sein, nutze bitte Name = "David Koenig" und Email = "david.koenig09@gmail.com"
7. Pushe den Branch zu GitHub.
8. Öffne einen Pull Request (PR) zu dem Development-Branch (dev).
9. Warte bis alle PR Checks erfolgreich sind.
10. Merge den PR in den Development-Branch (dev). Sollte das nicht möglich sein, berichte mir darüber.
11. Frage mich, ob der Feature-Branch gelöscht werden soll, und lösche ihn gegebenenfalls. 