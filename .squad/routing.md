# Work Routing

How to decide who handles what.

## Mandatory GitHub Issue Gate

This gate is mandatory for all content and code work.

- No code or file changes without a valid open GitHub issue.
- No Squad work unless the issue has label `squad`.
- Content and code changes are allowed only when issue status is exactly one of:
	- Ready to implement
	- In progress
- Metadata-only issue maintenance is allowed outside those statuses.
- No code generation or source file changes without explicit Tony approval for that exact issue.
- Every file change requires all of the following before the first change:
	- Open existing issue
	- Status whitelist match
	- Explicit Tony approval for the exact issue
	- Explicit user confirmation of the issue
	- Activation via `.frickeldave-active-issue`
- If issue status or Tony approval is missing, stop immediately with no code changes.

Required `.frickeldave-active-issue` YAML format:

```yaml
issue: 123
title: "Short issue title"
status: "Ready to implement"
tony_approved: true
tony_approved_at: "2026-06-30T15:41:12+0200"
session_id: "session-or-chat-id"
```

Mechanical check before any file change:

- `tony_approved` must be `true`.
- Missing or `false` means immediate stop with no code changes.

Workflow when issue is missing:

1. Ask user for issue number.
2. Verify issue exists and is open via GitHub CLI.
3. If no valid issue exists, offer to create one using the matching template in `.github/ISSUE_TEMPLATE`:
	- `bug_report.yml`
	- `feature_request.yml`
	- `content_creation.yml`
	- `documentation_improvement.yml`
4. Respect `.github/ISSUE_TEMPLATE/config.yml` guidance during issue creation.
5. Ensure the new issue is labeled `squad` during intake.
6. If user declines issue creation, stop with no code changes.

Scope limitation:

- Change only files explicitly mentioned by the issue or clearly derived from the stated issue scope.

## Directory Exclusions

| Path                                 | Policy             | Enforcement                                                  |
| ------------------------------------ | ------------------ | ------------------------------------------------------------ |
| `no_sync/`                           | Ignore all changes | Never read for decisions and never modify                    |
| `docs/kadi-v2-derived-requirements/` | Read-only          | Explicit approval required before using as source of truth   |
| `docs/team/`                         | Read-only context  | Extracted decisions must be written to `.squad/decisions.md` |

## Domain Routing Table

| Domain                                    | Primary  | Secondary | Reviewer |
| ----------------------------------------- | -------- | --------- | -------- |
| Requirements, scope, priorities           | Tony     | Maria     | Tony     |
| Astro UI and Tailwind                     | Natasha  | Bruce     | Tony     |
| Services, scripts, integrations           | Bruce    | Nick      | Tony     |
| Testing and QA                            | Clint    | Bruce     | Tony     |
| Technical documentation                   | Maria    | Natasha   | Tony     |
| DevOps and infrastructure                 | Nick     | Bruce     | Tony     |
| Legal compliance and editorial governance | Jennifer | Maria     | Tony     |
| RAI and safety review                     | Rai      | Jennifer  | Tony     |
| Session logging                           | Scribe   | Tony      | Tony     |

## Work Type Routing

Explicit Tony approval gate applies to every work type.

| Work Type                                 | Route To | Tony Approval Gate                           | Examples                                                               |
| ----------------------------------------- | -------- | -------------------------------------------- | ---------------------------------------------------------------------- |
| Requirements, scope, ticket quality       | Tony     | Required before file changes                 | Clarify acceptance criteria, define scope boundaries                   |
| Astro components, UI, Tailwind            | Natasha  | Required before file changes                 | Update `src/components/**`, adjust `src/pages/**`, align design system |
| Services, scripts, integrations           | Bruce    | Required before file changes                 | Update `src/lib/**`, `scripts/**`, integration flows                   |
| Testing and QA                            | Clint    | Required before test or fixture file changes | Regression checks, edge-case tests, release readiness                  |
| Technical documentation                   | Maria    | Required before content file changes         | Maintain `docs/**`, improve technical guides                           |
| DevOps and infrastructure                 | Nick     | Required before workflow/config changes      | CI/CD, deployment, monitoring, release hardening                       |
| Legal compliance and editorial governance | Jennifer | Required before policy/content changes       | Privacy checks, editorial structure, legal risk checks                 |
| Code review and final gatekeeping         | Tony     | Tony is final approver                       | Review PR quality and scope adherence                                  |
| RAI review                                | Rai      | Required before safety-sensitive changes     | Safety, bias, credential exposure review                               |

## Issue Routing and Triage Labels

Hard rule: issues without label `squad` are out of scope for Squad and must not be processed.

| Label            | Meaning                    | Owner    |
| ---------------- | -------------------------- | -------- |
| `squad`          | Intake queue, needs triage | Tony     |
| `squad:tony`     | Routed to Tony             | Tony     |
| `squad:natasha`  | Routed to Natasha          | Natasha  |
| `squad:bruce`    | Routed to Bruce            | Bruce    |
| `squad:clint`    | Routed to Clint            | Clint    |
| `squad:maria`    | Routed to Maria            | Maria    |
| `squad:nick`     | Routed to Nick             | Nick     |
| `squad:jennifer` | Routed to Jennifer         | Jennifer |
| `squad:rai`      | Routed to Rai              | Rai      |
| `squad:scribe`   | Routed to Scribe           | Scribe   |

## Issue Lifecycle

1. Intake: ensure the issue is created from a matching `.github/ISSUE_TEMPLATE` template and labeled `squad` (or add label during intake) before any work.
2. Triage: Tony validates scope, status, and routing label.
3. Gate: confirm status is `Ready to implement` or `In progress`.
4. Approval: Tony approves exact issue and timestamp is recorded.
5. Activation: create/update `.frickeldave-active-issue`.
6. Execution: only approved, in-scope files are changed.
7. Review: reviewer validates requirements and safety/compliance.
8. Closeout: update issue, remove or refresh active-issue marker for next task.

## Routing Logic Examples

- Explicit mention: "Natasha update card layout" routes to Natasha.
- Domain keyword: "CI pipeline failure" routes to Nick.
- Multi-domain fan-out: "new feature with UI plus integration plus tests" routes to Natasha, Bruce, and Clint.
- Architecture question: route to Tony first, then fan out after decision.
- Safety/compliance concern: route to Rai and Jennifer before implementation.

## Direct Mode

Use direct mode only when the request clearly targets one domain and all gate conditions are satisfied.

- Route to single primary owner.
- Keep execution in issue scope.
- Escalate to Tony if scope expands.

## Escalation Path

1. Primary owner handles work in scope.
2. If blocked or cross-domain, involve secondary owner.
3. If requirement conflict, scope drift, or approval ambiguity, escalate to Tony.
4. If safety, legal, or compliance risk appears, escalate to Rai and Jennifer, then Tony.

## Rules

1. Strict status whitelist: only `Ready to implement` or `In progress` can unlock content/code changes.
2. Strict Tony approval: exact issue must have explicit Tony approval before any source change or code generation.
3. Missing status, missing approval, or failed `tony_approved` check means immediate stop.
4. User must explicitly confirm the active issue before first change.
5. Apply smallest-possible change set and keep edits inside issue scope.
6. Scribe records substantive decisions after major work.
7. Strict Squad scope: only issues with label `squad` are processed by Squad.
