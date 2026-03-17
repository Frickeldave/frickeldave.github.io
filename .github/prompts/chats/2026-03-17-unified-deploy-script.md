# Unified Deploy Script — Rewrite

## Prompt

Der Workflow zur Freigabe und zum deployment ist in scripte gegossen, genauer gesagt, npm run
deploy:dev und npm run deploy:prd. Diese scripte leigen alle in scripts/workflows/ci. Bitte führe
folgende Schritte aus:

- Anaylisiere die scripte
- Identifiziere mögliche stellen wo das fehlschlagen kann, aktuell ist mir der Vorgang zu
  unzuverlässig
- Baue die Scripte bitte komplett neu. Und zwar als 1 Script
- Vereinfache die Ausgabe radikal. ich will nicht die ganze Build Ausgabe, wenn ein Schritt
  funktioniert, dann nur eine Zeie, nur im fehlerfall will ich mehr details
- Aktualisiere die Doku
- teste ob das push und deployment in dev funktioniert
- teste ob das push und deployment in prd funktioniert

## Ergebnis

- 23 Einzelscripts durch ein einziges `scripts/workflows/ci/deploy.mjs` ersetzt
- Copilot CLI Fallback (optional statt Pflicht)
- Quality Gates mit Auto-Fix statt nur Check
- Minimale Ausgabe (1 Zeile pro Schritt, Details nur bei Fehler)
- Rollback-Strategie für deploy:prd
- Kein State-File mehr (alles im Speicher)
- `execFileSync` statt Shell-Escaping für Commit-Messages
- Doku aktualisiert: `fr006-autodeploy.md`, `copilot-instructions.md`
