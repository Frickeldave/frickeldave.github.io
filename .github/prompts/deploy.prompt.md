---
agent: 'agent'
description: 'Deploy changes to dev and production environments.'
model: Claude Sonnet 4.5 (copilot)
---

Deploye die Änderungen. Frage mich auf jeden Fall, ob in Produktion (prd) deployed werden soll. Führe dabei die folgenden Schritte aus:

1. Sollte aktuell der dev Branch aktiv sein, wechsle zu einem neuen Feature-Branch basierend auf dev und übernimm alle offenen Änderungen.
2. Führe den linter aus und behebe alle gefundenen Probleme.
3. Führe prettier aus, um den Code zu formatieren.
4. Führe vale aus, um die Rechtschreibung und Grammatik zu prüfen. Behebe alle gefundenen Probleme.
5. Füge alle Änderungen zu git hinzu.
6. Erstelle einen Commit mit einer sinnvollen Commit-Nachricht. 
7. Pushe das Branch zu GitHub.
8. Öffne einen Pull Request (PR) zu dem Development-Branch (dev).
9. Warte bis alle PR Checks erfolgreich sind.
10. Merge den PR in den Development-Branch (dev).
11. Frage mich, ob der Feature-Branch gelöscht werden soll, und lösche ihn gegebenenfalls.