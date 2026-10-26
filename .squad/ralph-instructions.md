# Ralph Instructions
<!-- Vom Nutzer verwaltet: Diese Datei überschreibt das autonome Ausführungsverhalten von Ralph.
     `squad init` legt sie bei der Erstinstallation an; `squad upgrade` überschreibt sie nie. -->

<!--
  ZWECK
  -----
  Existiert `.squad/ralph-instructions.md`, weist `squad watch --execute` die gestartete
  Copilot-Session an, diese Datei zu lesen und ALLE Abschnitte hier zu befolgen — statt des
  eingebauten Fallback-Prompts. Fehlt die Datei, wird der eingebaute Prompt verwendet.

  CONTRACT (stabil — darauf lässt sich aufbauen)
  ----------------------------------------------
  DAS KANNST du über diese Datei anpassen:
    • Zusätzliche Anweisungen, die Ralph beim Session-Start bekommt (Teams-/Slack-Benachrichtigungen,
      Kalender-Checks, Post-Task-Hooks, MCP-gestützte Seiteneffekte, Eskalationspfade)
    • Zusätzliche Eligibility-Regeln oder eine andere Prioritätsreihenfolge bei der Issue-Auswahl
    • Persona, Tonfall oder Ausführlichkeit der Agentin bzw. des Agenten in der Session-Ausgabe

  DAS KANNST du über diese Datei NICHT überschreiben:
    • Parallelismus — Ralph startet immer Agenten für alle umsetzbaren Issues gleichzeitig
    • Der zentrale Eligibility-Filter (Label `squad`/`squad:*` erforderlich, nicht blockiert,
      nicht zugewiesen)
    • Der zugrunde liegende `gh`-/Copilot-CLI-Befehl, mit dem jede Session gestartet wird

  VERTRAUENSFOLGEN
  -----------------
  Diese Datei wird von der gestarteten Copilot-Session mit vollen Agentenrechten gelesen.
  Behandle sie wie Code — füge hier niemals nicht vertrauenswürdige Inhalte ein. Wer Schreibzugriff
  auf diese Datei hat, kann beeinflussen, was der Agent in deinem Namen tut.

  Fehlt die Datei oder ist sie leer, fällt `squad watch --execute` ohne Verhaltensänderung auf den
  eingebauten Prompt zurück.

  PLATZHALTER
  -----------
  Die folgenden Werte injiziert `execute.ts`, bevor die Session diese Datei liest:
    (derzeit keine — Ralph baut die Issue-Liste zur Laufzeit dynamisch auf)

  FORMAT
  ------
  Reines Markdown. Gliederung über `##`-Abschnitte. Die gestartete Session liest die ganze Datei,
  halte sie also knapp — eine Bildschirmseite Anweisungen ist ideal.
-->

## Ralph, Go!

Read this file for your full instructions.  Follow ALL sections.
MAXIMIZE PARALLELISM — spawn agents for ALL actionable issues simultaneously.

### Issue Selection

Arbeite an jedem offenen, nicht blockierten und nicht zugewiesenen Issue mit dem Label `squad` oder
`squad:{member}`. Überspringe Issues, die einem Menschen zugewiesen, blockiert oder mit
`status:on-hold` markiert sind.

### Post-Task Actions

<!-- Einkommentieren und anpassen, um Post-Task-Hooks zu ergänzen, z. B. Teams-Benachrichtigungen:

After completing work on each issue:
- Post a brief summary to the team channel via your Teams MCP tool.
- Update the issue with a progress comment if no PR has been opened yet.
-->

### Escalation

Wenn du bei einem Issue blockiert bist, kommentiere es mit der Begründung, setze das Label
`status:blocked` und gehe zum nächsten umsetzbaren Punkt über. Halte die Schleife nicht an.
