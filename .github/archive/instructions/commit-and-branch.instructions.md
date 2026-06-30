---
description:
  "Verwenden beim Vorschlagen von Commit-Messages, Anlegen von Git-Branches, Öffnen von PRs oder
  beim Ausführen von Git-Kommandos in diesem Repo. Erzwingt Conventional Commits und die per
  commitlint + Husky validierte type/scope-Branch-Namenskonvention."
---

# Commit-Messages & Branch-Namen

Dieses Repo erzwingt **Conventional Commits** per commitlint (Husky-Hook). Commits, die nicht zum
Format passen, werden beim Commit abgelehnt.

## Commit-Format (Kurzfassung)

```
<type>(<optional-scope>): <subject>
```

- `type` ∈ `feat | fix | docs | style | refactor | perf | test | ci | chore`
- `subject`: kleingeschrieben, Imperativ, kein Punkt am Ende, ≤ ~72 Zeichen.

✅ `feat(blog): add reading-time indicator` ✅ `fix(redirect): preserve query string on 301` ✅
`docs: clarify draft workflow` ❌ `Added new feature` — falsche Schreibweise, kein Type ❌
`feat: Add stuff.` — großgeschrieben, Punkt am Ende

Vollständige Regeln und die komplette Type-Tabelle:
[`docs/12-dev-messages.md`](../../docs/12-dev-messages.md).

## Branch-Namen

```
<type>/<optional-ticket-id>-<short-description>
```

- Gleiche `type`-Menge wie bei Commits.
- **kebab-case**, nur Kleinbuchstaben.
- Von `dev` abzweigen, in `dev` zurückmergen. Nur `dev` → `main` für Releases (siehe den
  VS-Code-Task `Deploy to Main`).

✅ `feat/podcast-rss-sync` ✅ `fix/gh-123-mobile-nav` ✅ `docs/update-design-system` ❌
`Feature-Branch` — falsche Schreibweise, kein Type ❌ `my-fix` — kein Type-Präfix

Vollständige Strategie:
[`docs/13-dev-branch-naming-strategy.md`](../../docs/13-dev-branch-naming-strategy.md).

## Wenn Du Commits/Branches generierst

- Wähle den **spezifischsten** passenden Type. Neuer Codepfad → `feat`, Verhaltenskorrektur → `fix`,
  reine Doku → `docs`, Abhängigkeits-Bump → `chore(deps)`.
- Verwende einen Scope, wenn die Änderung auf einen klaren Bereich begrenzt ist (`blog`, `sidebar`,
  `redirect`, `handmade`, `ci`, `deps`).
- Bündle niemals unzusammenhängende Änderungen in einen Commit, nur um den Working Tree zu leeren —
  teile sie auf.

## ⚠️ Requirement Engineer als Gatekeeper

Bevor Du Branches anlegst, Commits machst oder PRs öffnest — und bevor irgendeine Code-Änderung
getroffen wird:

1. **Konstruiere die Anforderung** — was soll geändert werden und warum?
2. **Konsultiere den Requirement Engineer** (`requirement-engineer` Agent) — er reviewt den
   Vorschlag, arbeitet das Ticket mit Dir zusammen und gibt ein explizites **OK**.
3. **Das Ticket MUSS als GitHub Issue erfasst sein**, bevor Code geschrieben wird.
4. **KEINE Code-Änderungen über den Chat** — nur das GitHub Issue autorisiert Implementation.

Branch-Namen enthalten idealerweise die Issue-Referenz (z. B. `feat/gh-42-podcast-rss`).

Siehe [`.github/agents/requirement-engineer.agent.md`](../agents/requirement-engineer.agent.md).

> **Kurzregel**: Kein Ticket → Kein Issue → Kein Branch → Kein Code.
