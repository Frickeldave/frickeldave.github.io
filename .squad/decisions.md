# Squad-Entscheidungen

## Aktive Entscheidungen

- 2026-07-28: OpenSCAD Phase 1 — Output nach `dist/3dmodels/`, keine generierten Dateien im Git, `models.json` wird vom Build-Script erzeugt. WASM-basierter Live-Editor zurückgestellt.
- 2026-06-30: Squad-Roster neu zusammengestellt mit Marvel Cinematic Universe-Namensgebung und persistenten Namen (Stark, Peter, Banner, Romanoff, Strange).
- 2026-06-30: Team-Roster auf Anrede mit Vornamen für aktive Agenten umgestellt (Tony, Bruce, Natasha, Clint, Maria, Nick, Jennifer).
- 2026-06-30: Altes `.github/archive` Agent-Setup wird in `.squad/agents/*/charter.md` und `.squad/skills/*/SKILL.md` umgeschrieben statt wortwörtlich kopiert.
- 2026-06-30: Anforderungs-Gatekeeping bleibt aktiv durch Lead (Tony)-Workflow und dedizierte Skill-Führung.
- 2026-08-25: Issue #266 ("Humanizer Skill bauen und vertesten") von Tony (Lead) triagiert und mit 5 Bedingungen freigegeben (Labels `squad:maria` + `go:yes`).
- 2026-08-25: Humanizer Skill von Maria (Technical Writer) erstellt (`.squad/skills/humanizer/SKILL.md`) und von Tony final freigegeben (keine Änderungen erforderlich).
- 2026-08-28: Issue #267 ("[Feature] AI-Transparenz-Skill: KI-Anteil-Bewertung mit Tabelle & Diagramm in Blog-Artikeln") von Tony (Lead) triagiert und sync-gated — Verdict: APPROVE (no changes required). Scope: Pflicht-Skill `.squad/skills/ai-content-score/SKILL.md` (immer letzter Schritt nach Blog-Artikel-Anpassungen), KI-Anteil-Transparenztabelle am Ende jedes Blog-Eintrags (KI-Anteil %, bewertendes LLM, Konfidenz, Link zur Erklärseite), neue Blog-Seite + Kategorie "AI", horizontale Balken-Diagramm-Komponente (grün >70 %, gelb 30–70 %, rot <30 % menschlich), Anpassung von Marias Charter und `.squad/routing.md`.
- 2026-08-28: Issue #267 Scope-Klarstellungen (non-blocking, vom Nutzer bestätigt): Transparenz-Tabelle rückwirkend auf alle bestehenden Blog-Posts; Konfidenz-Format qualitativ — hoch | mittel | niedrig.

#### 2026-09-10: Deployment-Workflow-Strategie (Nutzerdirektive)

**By:** David Koenig (via Copilot)
**What:**
- `squad-release.yml` behalten (Versionierung + Release-Bau). `deploy-prd.yml` künftig über den Success-Lauf von `squad-release` triggern statt direkt über push auf `main`.
- `test/`-Ordner anlegen (Tests werden noch gebaut) und `CHANGELOG.md` einführen.
- `squad-ci.yml` behalten; ein erster simpler Test wird eingebaut.
- `squad-promote.yml`, `squad-preview.yml`, `squad-insider-release.yml`, `squad-docs.yml` löschen.
- Triage-Gruppe (`squad-triage`, `squad-issue-assign`, `squad-label-enforce`, `sync-squad-labels`, `squad-heartbeat`) bleibt.
- Offene Frage: Bauen der 3D-Modelle in `squad-ci` integrieren (bzw. indirekt den Deploy-Flow triggern)?
**Why:** Nutzerentscheidung zur Workflow-Konsolidierung — Squad-Release-Pipeline beibehalten statt entfernen.

## Governance

- Alle bedeutenden Änderungen erfordern Teamkonsens
- Architektonische Entscheidungen hier dokumentieren
- History auf Arbeit fokussieren, Entscheidungen auf Richtung fokussieren
# Squad Decisions

## Active Decisions

No decisions recorded yet.

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
