# Work Routing

Wie man entscheidet, wer was bearbeitet.

## Mandatory GitHub Issue Gate

Dieses Gate ist verpflichtend für alle Content- und Code-Arbeiten.

- Keine Code- oder Dateiveränderungen ohne ein gültiges offenes GitHub Issue.
- Keine Squad-Arbeit, es sei denn, das Issue hat das Label `squad`.
- Content- und Code-Änderungen sind nur erlaubt, wenn Issue-Status genau einer der folgenden ist:
	- Ready to implement
	- In progress
- Metadata-only Issue-Wartung ist außerhalb dieser Status erlaubt.
- Keine Code-Generierung oder Quelldatei-Änderungen ohne explizite Tony-Genehmigung für genau dieses Issue.
- Jede Dateiveränderung erfordert vor der ersten Änderung alle folgenden Punkte:
	- Vorhandenes Issue öffnen
	- Status-Whitelist-Übereinstimmung
	- Explizite Tony-Genehmigung für genau dieses Issue
	- Explizite Nutzerbestätigung des Issues
	- Aktivierung via `.frickeldave-active-issue`
- Wenn Issue-Status oder Tony-Genehmigung fehlt, sofort stoppen ohne Code-Änderungen.

Erforderliches `.frickeldave-active-issue` YAML-Format:

```yaml
issue: 123
title: "Kurzes Issue-Titel"
status: "Ready to implement"
tony_approved: true
tony_approved_at: "2026-06-30T15:41:12+0200"
session_id: "session-or-chat-id"
```

Mechanischer Check vor jeder Dateiveränderung:

- `tony_approved` muss `true` sein.
- Fehlend oder `false` bedeutet sofortiges Stoppen ohne Code-Änderungen.

Workflow wenn Issue fehlt:

1. Nach Issue-Nummer fragen.
2. Über GitHub CLI prüfen, ob Issue existiert und offen ist.
3. Wenn kein gültiges Issue existiert, Angebot zur Erstellung über passendes Template in `.github/ISSUE_TEMPLATE`:
	- `bug_report.yml`
	- `feature_request.yml`
	- `content_creation.yml`
	- `documentation_improvement.yml`
4. `.github/ISSUE_TEMPLATE/config.yml` Anleitung bei Issue-Erstellung respektieren.
5. Sicherstellen, dass neues Issue mit `squad` gelabelt wird während Intake.
6. Wenn Nutzer Issue-Erstellung ablehnt, stoppen ohne Code-Änderungen.

Scope-Begrenzung:

- Nur Dateien ändern, die explizit vom Issue erwähnt oder klar vom stated Issue Scope abgeleitet sind.

## Directory Exclusions

| Pfad                                 | Policy                     | Enforcement                                                                   |
| ------------------------------------ | -------------------------- | ----------------------------------------------------------------------------- |
| `no_sync/`                           | Alle Änderungen ignorieren | Niemals für Entscheidungen lesen und niemals ändern                           |
| `docs/kadi-v2-derived-requirements/` | Read-only                  | Explizite Genehmigung erforderlich vor Verwendung als Wahrheitsquelle         |
| `docs/team/`                         | Read-only-Kontext          | Extrahierte Entscheidungen müssen in `.squad/decisions.md` geschrieben werden |

## Domain-Routing-Tabelle

| Domain                                         | Primär   | Sekundär | Reviewer |
| ---------------------------------------------- | -------- | -------- | -------- |
| Anforderungen, Scope, Prioritäten              | Tony     | Maria    | Tony     |
| Astro UI und Tailwind                          | Natasha  | Bruce    | Tony     |
| Services, Scripts, Integrationen               | Bruce    | Nick     | Tony     |
| Testing und QA                                 | Clint    | Bruce    | Tony     |
| Technische Dokumentation                       | Maria    | Natasha  | Tony     |
| Blog- und Content-Prosa (Artikel)              | Maria    | Tony     | Tony     |
| DevOps und Infrastructure                      | Nick     | Bruce    | Tony     |
| Rechtliche Compliance und editorial Governance | Jennifer | Maria    | Tony     |
| Sicherheitsreview                              | Jennifer | Tony     | Tony     |
| Session-Logging                                | Scribe   | Tony     | Tony     |

## Work-Type-Routing

Explizites Tony-Approval-Gate gilt für jeden Work-Typ.

| Work-Typ                                                      | Route zu | Tony-Approval-Gate                                                                            | Beispiele                                                                                           |
| ------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Anforderungen, Scope, Ticket-Qualität                         | Tony     | Erforderlich vor Dateiveränderungen                                                           | Akzeptanzkriterien klären, Scope-Grenzen definieren                                                 |
| Astro-Komponenten, UI, Tailwind                               | Natasha  | Erforderlich vor Dateiveränderungen                                                           | `src/components/**` aktualisieren, `src/pages/**` anpassen, Design-System ausrichten                |
| Services, Scripts, Integrationen                              | Bruce    | Erforderlich vor Dateiveränderungen                                                           | `src/lib/**`, `scripts/**`, Integrations-Flows aktualisieren                                        |
| Testing und QA                                                | Clint    | Erforderlich vor Test- oder Fixture-Datei-Änderungen                                          | Regression-Checks, Randfall-Tests, Release-Bereitschaft                                             |
| Technische Dokumentation                                      | Maria    | Erforderlich vor Content-Datei-Änderungen                                                     | `docs/**` pflegen, technische Guides verbessern                                                     |
| Blog-/Content-Prosa (Artikel verfassen/überarbeiten/de-KI-en) | Maria    | Erforderlich vor Content-Datei-Änderungen · Pflicht-Skills: `.squad/skills/humanizer/SKILL.md`, `.squad/skills/ai-content-score/SKILL.md` (immer als letzter Schritt) | `src/content/blog/**` verfassen/überarbeiten, KI-Marker entfernen, Frickeldave-Stimme sicherstellen, AI-Transparenz-Tabelle pflegen |
| DevOps und Infrastructure                                     | Nick     | Erforderlich vor Workflow/Config-Änderungen                                                   | CI/CD, Deployment, Monitoring, Release-Hardening                                                    |
| Rechtliche Compliance und editorial Governance                | Jennifer | Erforderlich vor Policy/Content-Änderungen                                                    | Privacy-Checks, editorial Struktur, Legal-Risk-Checks                                               |
| Code-Review und finales Gatekeeping                           | Tony     | Tony ist finaler Approver                                                                     | PR-Qualität und Scope-Adherence überprüfen                                                          |
| Sicherheitsreview                                             | Jennifer | Erforderlich vor sicherheitsrelevanten Änderungen                                             | Sicherheit, Bias, Credential-Exposure-Review                                                        |

## Issue-Routing und Triage-Labels

Harte Regel: Issues ohne Label `squad` sind außerhalb des Squad-Scopes und dürfen nicht bearbeitet werden.

| Label | Bedeutung | Owner |
| ----- | --------- | ----- |
