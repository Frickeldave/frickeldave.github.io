# Approvals for Code Changes

This directory stores Requirement Engineer approvals for code changes.

## Workflow

1. **User schlägt Änderung vor** → Requirement Engineer Agent
   (`.github/agents/requirement-engineer.agent.md`) reviewt die Anforderung, erstellt/aktualisiert
   ein GitHub Issue, arbeitet das Ticket mit dem User zusammen.

2. **REQ Engineer gibt frei** → Nach explizitem OK des Requirement Engineer Agents:

   ```bash
   # Approval-File erstellen (vom REQ Engineer Agent ausgeführt):
   printf "issue: GH-%s\ntitle: %s\nstatus: approved\nby: requirement-engineer\nexpires: %s\nscope: %s\n" \
     "$ISSUE_NUMBER" "$TICKET_TITLE" "$EXPIRES_ISO" "$SCOPE" > .github/hooks/approvals/current
   ```

   - `expires` ist ein ISO-8601-Timestamp (z.B. `2026-06-09T12:00:00Z`), maximal 24h in der Zukunft.
   - `scope` beschreibt den Task in einem Wort (z.B. `image-fix`, `gatekeeping-fix`).

3. **PreToolUse Hook prüft** → Der Hook (`.github/hooks/validate-code-change.mjs`) liest das
   Approval-File und erlaubt File-Edit-Operationen (`replace_string_in_file`, `create_file`, etc.)
   nur wenn eine `issue:`-Referenz im File enthalten ist und das Approval noch nicht abgelaufen ist.

## Files

| File      | Beschreibung                                                                  |
| --------- | ----------------------------------------------------------------------------- |
| `current` | Aktuell gültiges Approval (wird vom REQ Engineer Agent erstellt/aktualisiert) |

## PreToolUse Hook

Der Hook (`.github/hooks/validate-code-change.json` → `.github/hooks/validate-code-change.mjs`)
blockiert plattformübergreifend vor jeder File-Edit-Operation und fragt nach einem
REQ-Engineer-Approval:

- **Kein Approval-File** → `permissionDecision: "ask"` mit blockierender Message
- **Approval ohne Issue-Referenz** → `permissionDecision: "ask"` mit Warnung
- **Approval mit abgelaufenem `expires:`** → `permissionDecision: "ask"` mit Hinweis auf Ablauf
- **Gültiges Approval mit Issue-Referenz** → `permissionDecision: "allow"`

Das Node-Skript (`validate-code-change.mjs`) arbeitet auf allen Plattformen gleich (Linux, macOS,
Windows).

## Beispiel: REQ Engineer Agent erstellt Approval

```bash
# Nach freigegebenem Ticket (Issue #42: "Podcast RSS Sync"), gültig für 24h
printf "issue: GH-42\ntitle: Podcast RSS Sync Auto-Update\nstatus: approved\nby: requirement-engineer\nexpires: 2026-06-09T12:00:00Z\nscope: podcast-sync\n" \
  > .github/hooks/approvals/current
```
