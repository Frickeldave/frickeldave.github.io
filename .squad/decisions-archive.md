# Squad-Entscheidungen — Archiv

Archivierte Einträge aus `.squad/decisions.md` (20-KB-Gate: Einträge älter als 30 Tage).
Inhalt unverändert übernommen.

## Archiviert am 2026-10-27

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
