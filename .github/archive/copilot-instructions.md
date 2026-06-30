---
description:
  "Zwingt Copilot, vor jeder File-Edit-Operation den Requirement Engineer Agent zu starten. Enthält
  Trigger-Liste und Approval-Workflow."
---

# Requirement Engineer Gatekeeping Instructions

## Trigger-Liste — WENN der User etwas von diesen Dingen vorschlägt ODER du selbst anfängst es zu planen, HÄLST DU SOFORT AN und forderst REQ-Approval:

> ⚠️ **WICHTIG**: Der Gatekeeping-Check erfolgt beim **ersten Auftreten einer Trigger-Action im
> Prompt** — nicht erst bei der File-Edit-Operation. Wenn du erkennst, dass deine geplante Antwort
> eine Trigger-Action enthält (auch nur als Plan, Analyse oder Vorschlag), stoppst du sofort und
> folgst dem Antwort-Protokoll.

- **Refactoring**: Umbenennungen, Neustrukturierung, Code-Modernisierung, Entfernen von Legacy-Code
- **Testing**: Hinzufügen von Test-Suites, Test-Konfiguration, CI/CD-Test-Pipelines
- **Config**: Änderungen an `package.json`, `tsconfig.json`, `astro.config.mjs`,
  `eslint.config.mjs`, `tailwind.config.*`, `wrangler.jsonc`, `.prettierrc`, `.gitignore`, oder
  jeder anderen Konfigurationsdatei
- **Dependencies**: Hinzufügen, Entfernen, Aktualisieren von npm-Paketen
- **Deployment**: Änderungen an Deploy-Pipelines, Netlify/Vercel/Railway-Konfiguration
- **Process**: Änderungen am RE-Gatekeeping-System selbst, Hook-Änderungen, Approval-Workflow
- **Content-Changes**: Neue Blog-Posts, neue Docs, neue Pages — ABER mit besonderer Ausnahme:

  > **Multi-Prompt Markdown-Verarbeitung**: Wenn der User erkennbar an einem längeren
  > Dokumentationsartikel oder Blog-Post arbeitet (über mehrere Prompts hinweg, mit schrittweiser
  > Vergrößerung des Contents), DARFST du File-Edit-Operationen für Markdown/MDX-Dateien OHNE
  > REQ-Approval — SOLANGE der User explizit sagt, dass er an einem Dokument arbeitet (z.B. "ich
  > arbeite jetzt an diesem Doc weiter" oder "bitte fahre fort mit ..."). Diese Ausnahme gilt NICHT
  > für:
  >
  > - Neue, völlig neue Seiten/Sections
  > - Änderungen an existing Templates/Komponenten
  > - Änderungen an bestehenden Docs ohne expliziten Fortsetzungskontext

## Was du vor jeder File-Modifikation prüfen MUSST:

1. Handelt es sich um eine der oben genannten Trigger-Actions?
2. Existiert ein gültiges Approval-File unter `.github/hooks/approvals/current`?
3. Referenziert das Approval-File ein gültiges Issue (Format: `issue: GH-XXX`)?
4. Ist das Approval noch gültig? (`expires:` Feld — wenn abgelaufen, kein Approval mehr gültig)
5. Passt der `scope:` zum aktuellen Task? (zur Information, kein harter Block)

## Antwort-Protokoll

### Wenn eine Trigger-Action erkannt wird:

🔒 **REQ-Approval erforderlich**

Dieser Vorschlag betrifft eine trigger-sensible Änderung.

Gemäß des Requirement Engineer Gatekeeping-Systems muss ich:

1. Mit dir das Ticket überarbeiten und finalisieren
2. Das Issue via GitHub Issue Tracker erfassen
3. Auf dein explizites "OK — Freigegeben" warten
4. Erst DANN das Approval-File erstellen und die Implementierung erlauben

Möchtest du, dass ich ein Issue erstelle?

### Wenn ein gültiges Approval existiert:

✅ **Approval gefunden**

Ein gültiges REQ-Engineer-Approval existiert. File-Edit-Operationen sind erlaubt.

### Wenn keine Trigger-Action erkannt wird:

✅ **Kein REQ-Approval erforderlich**

Diese Änderung fällt nicht unter die Trigger-Liste. Du kannst fortfahren.

## Post-Approval-Schritt (PreToolUse-Hook)

NACH der Freigabe durch den Requirement Engineer Agent:

1. Der REQ Engineer erstellt das Approval-File:

   ```bash
   printf "issue: GH-%s\ntitle: %s\nstatus: approved\nby: requirement-engineer\nexpires: %s\nscope: %s\n" \
     "$ISSUE_NUMBER" "$TICKET_TITLE" "$EXPIRES_ISO" "$SCOPE" > .github/hooks/approvals/current
   ```

   - `expires`: ISO-8601-Timestamp, maximal 24h in der Zukunft
   - `scope`: Kurzbezeichnung des Tasks (z.B. `image-fix`, `gatekeeping-fix`)

2. Der **PreToolUse-Hook** (`.github/hooks/validate-code-change.mjs`) wird VOR jeder
   File-Edit-Operation ausgeführt und prüft das Approval-File.

3. Nur wenn das Approval-File eine gültige Issue-Referenz enthält, werden `replace_string_in_file`,
   `create_file`, `multi_replace_string_in_file` und ähnliche Operationen erlaubt.

## WICHTIG

- **NIEMALS** File-Edit-Operationen für trigger-sensible Änderungen ohne Approval durchführen
- **NIEMALS** mit Analyse, Planung oder Erkundung einer Trigger-Action beginnen, bevor das
  Gatekeeping-Protokoll durchlaufen wurde
- **NIEMALS** ein vorhandenes Approval-File als Freifahrtschein für einen anderen Task verwenden —
  `scope:` und `expires:` prüfen
- **IMMER** den PreToolUse-Hook erwähnen, wenn File-Editionen involviert sind
- **IMMER** auf Deutsch antworten
- Der Requirement Engineer Agent ist unter `.github/agents/requirement-engineer.agent.md` definiert
