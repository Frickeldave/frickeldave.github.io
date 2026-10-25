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
- 2026-09-25 (Nutzerdirektive, via David Koenig): Agenten (inkl. Maria) dürfen GitHub-Issues nach Abschluss der Arbeit NICHT mehr eigenständig via `gh issue close` schließen. Der Abschluss-Kommentar (`## ✅ Abschluss-Zusammenfassung`) wird weiterhin gepostet, das eigentliche Schließen erfolgt erst nach explizitem Kommando des Nutzers. Gilt ab sofort für alle künftigen Issue-Abschlüsse.

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

#### 2026-09-11: Branch- und Commit-Naming-Konvention (Nutzerdirektive)

**By:** David Koenig (via Copilot)
**What:**
- Branch-Namen nach Conventional Branch Names vergeben: `<type>/<description>` — NICHT `squad/{issue}-{slug}` (der Husky-Pre-Push-Hook akzeptiert nur `<type>/<description>`; das ist gewollt).
- Commit-Messages nach Conventional Commits verfassen: `type(scope): description`.
- In die Charter von Nick (DevOps) aufgenommen.
**Why:** Husky-Pre-Push-Hook ist gewollt; Branch-/Commit-Namen sollen zur Conventional-Commits-Konvention passen.

#### 2026-09-13: Issue #267 — aiTransparency um `comment` erweitert & Box kompakter

**By:** Copilot Coding Agent
**What:**
- `aiTransparency`-Schema in `src/content.config.ts` um optionales Feld `comment: z.string().optional()` erweitert.
- `src/components/blog/AiTransparency.astro` zeigt `comment` als Text in der KI-Transparenz-Box an und reduziert Zeilenabstände/Paddings (Box kompakter).
- Für alle Blog-Artikel 2019-03-08 bis 2024-09-14 `comment: "Migration von Wordpress mit Hilfe KI"` gesetzt (38 Dateien).
- Für `2026-08-03-agile-coaches-in-der-ki-aera.mdx` und `2026-08-23-souveränität-jenseits-cloud-washing.mdx` `comment: "erstellt mit KI HIlfe"` gesetzt.
**Why:** Nutzeranforderung zu Ticket #267 — KI-Transparenz-Box schlanker machen und einen Kommentar-Eintrag als fünftes Frontmatter-Feld ergänzen.

#### 2026-09-14: CHANGELOG-Pflicht bei Issue-Abschluss (Issue #275)

**By:** David Koenig (via Copilot)
**What:**
- `CHANGELOG.md` muss beim Abschluss jedes Issues aktualisiert werden, das Code oder die Site verändert.
- Neuer Eintrag unter `## [Unreleased]` im Keep-a-Changelog-Format, Kategorien: `Added`, `Changed`, `Fixed`, `Removed`, `Security`.
- Jeder Eintrag referenziert das Issue als `(#123)`.
**Why:** Änderungen sollen für Nutzer und Team nachvollziehbar dokumentiert sein.

#### 2026-09-25: Issue #281 — Humanizer-Nacharbeit „Dark Software Factory“ (unabhängige KI-Anteil-Bewertung + Revision)

**By:** David Koenig (via Copilot Squad)
**What:**
- Tony triagiert Issue #281 ("Humanizer-Nacharbeit: Dark Software Factory Artikel"), Label `squad:maria` gesetzt, als "Ready to implement" freigegeben.
- Maria führte unabhängige KI-vs-Mensch-Autorenschafts-Bewertung von `src/content/blog/2026-09-25-dark-software-factory.md` durch (Ergebnis ~45–60 % Mensch vs. deklarierten 85 %).
- Nach Nutzerfreigabe überarbeitet: 2 Anapher-Ketten behoben, 6 von 7 „X, nicht Y"-Hedge-Wiederholungen variiert, ein LLM-schablonenhafter Satz umformuliert.
- `ai-content-score`-Skill erneut ausgeführt; `aiTransparency`-Frontmatter aktualisiert (`humanShare` 85 → 92, `confidence` mittel → hoch).
- Commit `0caa9e9` auf `dev`; Issue #281 geschlossen.
**Why:** Deklarierter KI-Anteil im Frontmatter wich signifikant von einer unabhängigen Bewertung ab — Nacharbeit zur Angleichung von Anspruch und tatsächlichem Text.

#### 2026-10-25: User directive — Branch/PR-Modell gilt

**By:** David Koenig (via Copilot)
**What:** Option **A** aus der Konfliktdarstellung: Das Branch/PR-Modell der portierten Start-Flow-Skripte (`start-work`, `start-reqeng`, `start-review`) wird übernommen. Issue-Branch, Worktree und Draft-PR sind damit der Standardweg für Squad-Arbeit.
**Konsequenz:** Der Abschnitt "Branching & Commit-Konvention" in `.squad/routing.md` (bisher: "Single-Developer-Workflow — Arbeit passiert direkt in `dev`", kein Feature-Branch, kein PR) widerspricht dem und muss an das Branch/PR-Modell angepasst werden.
**Why:** User-Entscheidung im Rahmen der Flow-Angleichung an Issue #282.

#### 2026-10-25: Squad-Upgrade auf v1.1.0 — lokale Anpassungen erhalten

**By:** Nick (DevOps / Infrastructure) · **Issue:** #282
**What:** `squad upgrade` (0.13.1 → 1.1.0) wurde durchgeführt. Der Upgrader clobbert bewusst Squad-eigene Dateien; alles, was Repo-Policy oder lokale Anpassung ist, wurde davor gesichert und danach byte-genau wiederhergestellt.
**Why:** Upgrade auf Squad v1.1.0 durchführen, ohne Repo-Policy und lokale Anpassungen zu verlieren.

##### Was der Upgrader nicht durfte

1. **Casting-Legacy-Daten normalisiert** (damit die CLI selbst migrieren kann):
   - `.squad/casting/registry.json`: `retired_at` für die 5 retired Agents ergänzt.
   - `.squad/casting/history.json`: `members: ["Tony", …]` → `agents: ["tony", …]`
     (1:1-Mapping Name → Registry-Id, verifiziert). 1.1.0 akzeptiert nur diese Form.
   - Originale liegen unter `.squad/casting/legacy-archive-*`.
2. **Workflows auf 0.13.1 zurückgesetzt.** Die 1.1.0-Templates haben `Mitglieder`
   aus dem `## …`-Regex entfernt; `team.md` ist deutsch, Label-Sync hätte 0 Member
   gefunden. Die 7 neu hinzugefügten Workflows wurden entfernt (Sicherung außerhalb des Repos).
3. **Capabilities-Block neu generiert.** 1.1.0 parst nur englische Headings
   (`## Members`, `## Work Type → Agent`), `team.md`/`routing.md` sind deutsch →
   Block kam leer (`specialists=0`). Neu erzeugt mit dem SDK-Generator aus echten Daten,
   nur mit heading-normalisierter Parse-Sicht; Repo-Dateien unverändert.

##### Offener Punkt (bewusst nicht "gefixt")

Englisch-only Parser + deutsche Charter-Prosa ⇒ `Capability boundaries` im generierten
Block ist konservativ/unvollständig (nennt Doku/CI/Security als "nicht beansprucht").
Bei jeder künftigen Cast-Änderung wird der Block erneut leer bzw. konservativ erzeugt.
Empfehlung: `## Members` als zusätzliche Heading-Zeile in `team.md` aufnehmen oder auf
SDK-Support für deutsche Headings warten. `team.md` wurde hier bewusst nicht verändert.

## Governance

- Alle bedeutenden Änderungen erfordern Teamkonsens
- Architektonische Entscheidungen hier dokumentieren
- History auf Arbeit fokussieren, Entscheidungen auf Richtung fokussieren
