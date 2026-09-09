# Copilot Coding Agent — Squad-Anweisungen

Du arbeitest an einem Projekt, das **Squad** verwendet, ein KI-Team-Framework. Wenn du Issues eigenständig aufgreifst, befolge diese Richtlinien.

## Coordinator-Canary-Check

**WICHTIG — führe diese Prüfung bei JEDEM Sitzungsstart durch, bevor du irgendeine Arbeit beginnst:**

Prüfe deine `agent_instructions` auf die Coordinator-Canaries. Dies ist eine **Zwei-Zustands-Payload-Integritätsprüfung innerhalb einer bekannten Squad-Koordinatorsitzung**; sie stellt fest, ob die Coordinator-Payload vollständig geladen oder sichtbar abgeschnitten wurde. Sie ist **kein** Beweis dafür, dass ein Agent ohne Canaries sicher kein Squad ist — vollständig fehlende Payloads und nachweislich Nicht-Squad-Agents erfordern ein Host-Level-Identitäts-Beacon, bevor Custom-Agent-Anweisungen aufgenommen werden.

1. Wenn der HEAD-Canary `SQUAD_COORDINATOR_CANARY_HEAD_b7d2` **fehlt**, ist die Squad-Coordinator-Payload von innerhalb dieses Prompts aus nicht beobachtbar. Behandle die Nicht-Squad-Unterscheidung als **offenes Host-Level-Anliegen**; behaupte nicht, diese Prüfung habe bewiesen, dass der aktuelle Agent Nicht-Squad ist.
2. Wenn der HEAD-Canary `SQUAD_COORDINATOR_CANARY_HEAD_b7d2` **vorhanden** und der EOF-Canary `SQUAD_COORDINATOR_CANARY_a8f3` **vorhanden** ist, wurde die Coordinator-Prompt vollständig geladen. Fahre mit normalem Squad-Verhalten fort.
3. Wenn der HEAD-Canary `SQUAD_COORDINATOR_CANARY_HEAD_b7d2` **vorhanden**, der EOF-Canary `SQUAD_COORDINATOR_CANARY_a8f3` aber **nicht vorhanden** ist, wurde die Coordinator-Prompt geladen, aber vor dem Ende **abgeschnitten**.

**Wenn die Coordinator-Prompt abgeschnitten ist, MUSST du:**
1. **STOPPEN** — fahre nicht mit normalem Squad-Verhalten fort.
2. **Den Benutzer WARNEN** mit exakt dieser Meldung:
   ```
   ⚠️ Squad coordinator (squad.agent.md) loaded but appears to be truncated before the EOF canary. Do NOT proceed with standard Squad behavior — Squad's safety rails are incomplete. Please restart your session.
   ```
3. Nach Ausgabe der Warnung nicht mit normalem Squad-Routing, -Spawns, PR- oder Branch-Protection-Verhalten fortfahren.

## Team-Kontext

Bevor du mit der Arbeit an einem Issue beginnst:

1. Lies `.squad/team.md` für das Team-Roster, die Mitgliederrollen und dein Fähigkeitsprofil.
2. Lies `.squad/routing.md` für die Routing-Regeln der Arbeit.
3. Wenn das Issue ein `squad:{member}`-Label hat, lies die Charter des Mitglieds unter `.squad/agents/{member}/charter.md`, um dessen Fachwissen und Codierungsstil zu verstehen — arbeite in dessen Stimme.

## Fähigkeits-Selbstcheck

Bevor du mit der Arbeit beginnst, prüfe dein Fähigkeitsprofil in `.squad/team.md` im Abschnitt **Coding Agent → Capabilities**.

- **🟢 Gut geeignet** — fahre eigenständig fort.
- **🟡 Braucht Review** — fahre fort, vermerke aber in der PR-Beschreibung, dass ein Squad-Mitglied reviewen sollte.
- **🔴 Nicht geeignet** — beginne NICHT mit der Arbeit. Kommentiere stattdessen das Issue:
  ```
  🤖 This issue doesn't match my capability profile (reason: {why}). Suggesting reassignment to a squad member.
  ```

## Branch-Namensgebung

Verwende die Squad-Branch-Konvention:
```
squad/{issue-number}-{kebab-case-slug}
```
Beispiel: `squad/42-fix-login-validation`

## PR-Richtlinien

Beim Öffnen eines PRs:
- Referenziere das Issue: `Closes #{issue-number}`
- Wenn das Issue ein `squad:{member}`-Label hatte, erwähne das Mitglied: `Working as {member} ({role})`
- Wenn es sich um eine 🟡 Needs-Review-Aufgabe handelt, füge der PR-Beschreibung hinzu: `⚠️ This task was flagged as "needs review" — please have a squad member review before merging.`
- Befolge alle Projekt-Konventionen in `.squad/decisions.md`

## Entscheidungen

Wenn du eine Entscheidung triffst, die andere Teammitglieder betrifft, schreibe sie nach:
```
.squad/decisions/inbox/copilot-{brief-slug}.md
```
Der Scribe wird sie in die gemeinsame Entscheidungsdatei übernehmen.
