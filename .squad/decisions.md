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

#### 2026-10-25: Issue #282 Steps 9–16 — CI auf eigene Runner, Bootstrap, Promote

**By:** David Koenig (via Squad) · **Issue:** #282
**What:**
- **Alle `fd-ci`-Jobs laufen auf den self-hosted Runnern (`fd`)**. Runner-Limits 3 CPU / 8 GiB bei unveränderten Requests (100m/512Mi), weil die Worker-Nodes geteilt und fast ausreserviert sind; `webServer.timeout` 600 s wegen 376–493 s Cold-Build. Requests steuern das Scheduling, Limits die Nutzung.
- **Dev-Maschinen werden auch ohne SSH-Key angelegt.** Ohne Key: kein `sshd`, keine `authorized_keys`, PID 1 `sleep infinity`, Zugang `kubectl exec`; Readiness über `$HOME/.fd-ready` statt Port 22. Keys werden nie erfunden, nur eingetragen.
- **Neue RBAC-Rolle `dev-machines`** in `scripts/bootstrap/k8s/rbac.yaml` (statefulsets, services, pods delete, pods/exec). Ohne sie hätte der Runner 403 bekommen.
- **Dev-Machine-Manifeste liegen unter `.github/workflows/fd-bootstrap/k8s/`**, nicht in `scripts/bootstrap/k8s/`: dort steht nur, was `bootstrap.mjs` einmalig rendert (Portabilitäts-Guard), Dev-Machines sind Laufzeit-Objekte des Workflows.
- **`fd-promote-prd` ist in Phase 1 manuell** (`workflow_dispatch`). Ein automatischer Promote (`workflow_run` auf `fd-ci`) ist vorbereitet, aber nicht aktiv — ein Promote nach `main` bleibt eine menschliche Entscheidung, gekoppelt an einen Versions-Bump.
- **Ein Label-Workflow statt zwei:** `fd-configure` verwaltet seit Step 22 **alle** Labels (statische Namespaces `go:*`, `release:*`, `type:*`, `priority:*`, `bug`, `feedback`, Basis `squad`, dazu `squad:<member>` je Roster-Zeile und `squad:copilot`). `squad-sync-squad-labels.yml` wurde gelöscht; zwei Workflows dürfen nie unterschiedliche Werte für dasselbe Label schreiben. Farbstabilität ist Vertrag: die Roster-Reihenfolge bestimmt über Hash + Linear Probing die Farbe, Umsortieren verschiebt Farben.
- **PR-Template ohne das Original-Tooling:** keine `release:yes/no`, kein `check-release-label` — das Template verweist auf die echten Gates (`release:*`-Labels, `CHANGELOG.md`-Pflicht, Promote nur über den Workflow). Der Versionsbump läuft über die eigene Implementierung `npm run versionbump` (siehe Step 18), nicht über ein portiertes Fremd-Skript.
- **Image-Referenzen müssen kleingeschrieben sein.** `ghcr.io/<owner>/…` aus `github.repository_owner` erzeugt Großbuchstaben und damit `InvalidImageName`; Ableitung nur über lowercase + Guard, abgesichert durch Tests.
**Why:** Nutzerentscheidungen zu #282 (eigene Runner, Dev-Container für David Koenig) plus zwei im Betrieb gefundene Fehlerklassen (Windows-Installer, OCI-Groß-/Kleinschreibung), die ohne Testabdeckung erneut auftreten würden.

#### 2026-10-26T10-22-21: Aktivierungsmarker .frickeldave-active-issue wird vom Launcher geschrieben (Variante A)
**By:** Squad (Coordinator)
**What:** Aktivierungsmarker .frickeldave-active-issue wird vom Launcher geschrieben (Variante A)
**Why:** #### 2026-10-26: Aktivierungsmarker wird vom Launcher aktiviert

**By:** David Koenig (via Copilot), umgesetzt von Nick (DevOps), Issue #282
**What:** `npm run start-work` schreibt/aktualisiert `.frickeldave-active-issue` im Ziel-Worktree selbst, nachdem `validateIssueStartGate()` grün ist. `tony_approved: true` wird ausschließlich aus dem Gate-Ergebnis (`go:yes`, kein Konflikt-Label) abgeleitet; ohne bestätigte Freigabe wirft die Funktion. Der Schreibvorgang ist idempotent, `session_id` stammt aus der tmux-Session (`--notmux`: `<canonicalName>-notmux`). Agenten schreiben den Marker weiterhin nie; Pepper/`start-reqeng` bleiben ausgeschlossen.
**Why:** Der Marker wurde bisher von niemandem erzeugt. Das Skript prüfte ihn nicht, die Agent-Prompt verlangte ihn — in einem frischen Worktree fehlte er zwangsläufig (gitignored, worktree-lokal). Jeder `start-work`-Lauf endete im Dead-End „Marker fehlt, obwohl alle anderen Gates grün sind". Die menschliche Bestätigungshandlung (`npm run start-work`) und Tonys Freigabe (`go:yes`) fallen damit in einer Handlung zusammen; die Gate-Semantik bleibt erhalten, weil keine Agent-Rolle den Marker schreiben darf.
**Refs:** Issue #282, PR #286, `scripts/start-work.mjs`, `.squad/routing.md`, `docs/50-agent-setup.md`

#### 2026-10-26T15-04-34: Issue #285: Aktivierungsmarker per menschlicher Proxy-Freigabe angelegt; Release 1.0.6 gemergt und promotet
**By:** Squad Coordinator (via Copilot)
**What:** Issue #285: Aktivierungsmarker per menschlicher Proxy-Freigabe angelegt; Release 1.0.6 gemergt und promotet
**References:** #285, #287, 63c04e3, ae4f7bd, e01a623
**Why:** ##### 2026-10-26: Issue #285 — Marker-Proxy, Merge nach dev, Release 1.0.6

**By:** David Koenig (via Copilot/Squad Coordinator)

**What:**
1. **Aktivierungsmarker:** `.frickeldave-active-issue` fehlte in der frisch provisionierten Umgebung (gitignored, weder im Worktree noch im Hauptcheckout). `go:yes`, Projekt-Status `In Progress`, Implementer-Label und Pepper-Hand-off waren vorhanden. Nach ausdrücklicher menschlicher Bestätigung ("proxy") wurde der Marker für Issue 285 mit `tony_approved: true` angelegt. Agenten legen ihn weiterhin nicht eigenmächtig an — die Autorisierung kam vom Menschen, nicht vom Agenten.
2. **Versionierung:** Der ursprünglich gewünschte Bump `1.0.5` war bereits durch `07d5bd0` (Fix aus #282) belegt; freigegeben wurde `1.0.6` (Patch, kleinster Schritt über dem bestehenden Stand) als eigener Release-Commit `ae4f7bd` auf `dev`.
3. **Merge/Deploy:** Squash-Merge `feat/issue-285-deepseek-integration-in-github-copilot-cli` → `dev` als `63c04e3`; Promote `dev` → `main` als `e01a623` über `fd-promote-prd` → `fd-deploy-prd`; Release `v1.0.6` veröffentlicht.

**Why:** Das Gate-Marker-Protokoll braucht eine belastbare Spur, wer die Ausnahme autorisiert hat. Die Versionswahl folgt der menschlichen Vorgabe (Patch statt Minor), angepasst an den real belegten Versionsstand. Squash-Merge und Promote-Weg entsprechen `.squad/routing.md` und `.github/pull_request_template.md`.

#### 2026-11-03T14-25-47: Issue #303 — Dev-Container-Ressourcen sind über Dispatch-Parameter definiert (Paket B, Default 16 GiB)
**By:** Squad (Coordinator)
**What:** Issue #303 — Dev-Container-Ressourcen sind über Dispatch-Parameter definiert (Paket B, Default 16 GiB)
**References:** #303, #304, Option B
**Why:** **By:** David Koenig (via Copilot Squad) — Nutzerdirektive im StartWork-Lauf IS_303

**What:**
- Die CPU-/RAM-Ressourcen der von `fd-bootstrap` gespawnten Dev-Container sind keine Template-Konstanten mehr, sondern Parameter:
  - `workflow_dispatch`-Inputs: `dev_cpu_request`, `dev_memory_request`, `dev_cpu_limit`, `dev_memory_limit` (Typoskript-Inputs als `string`, leer = Default).
  - CLI: `dev-machines.mjs render --cpu-request/--memory-request/--cpu-limit/--memory-limit`.
  - Template-Platzhalter: `__CPU_REQUEST__`, `__MEMORY_REQUEST__`, `__CPU_LIMIT__`, `__MEMORY_LIMIT__`.
- Defaults (identisch mit dem Zustand nach Paket B): `100m` / `2Gi` / `4` / `16Gi`. Das Memory-Limit steigt damit von 8 GiB auf 16 GiB (OOMKill-Ursache aus #303), der Request bleibt bei 2 GiB.
- Eingaben werden gegen Kubernetes-Quantity-Formate validiert; ein ungültiger Wert bricht den Render-Schritt ab, **bevor** `kubectl apply` läuft. Leere Eingabe = Default, es wird kein leeres Argument erzeugt.
- Der Workflow rendert weiterhin **alle** Maschinen mit demselben Satz Ressourcen — ein Per-Developer-Override ist bewusst nicht Teil dieses Issues.
- Ergänzende Diagnose (Paket B, AC 8/9): `fd_memory_limit`, `fd_container_uptime`, `fd_restart_hint` sind rein offline ermittelbar; `fd_container_uptime` priorisiert die mtime von `~/.fd-ready` (Entrypoint setzt den Marker bei jedem Start neu), Fallback ist die PID-1-Laufzeit.
- Der Start-Flow verlangt keinen `npm run build` mehr im Dev-Pod; Build und e2e prüft `fd-ci` nach dem Push.

**Why:** Nutzerauftrag im StartWork-Lauf: Ressourcen sollen über Parameter definierbar sein, ohne Template-Änderung und ohne neuen Branch. Gleichzeitig behebt das Issue den bestätigten OOM-Restart (exitCode 137, restartCount 3) und hält schwere Builds aus dem Dev-Pod heraus.

**Rollout-Hinweis:** Wegen `updateStrategy: OnDelete` wirken neue Limits erst nach bewusstem Neustart der Maschine (`restart_machines` oder `kubectl delete pod`). Ein Neustart wurde in diesem Lauf nicht ausgelöst. AC 13 aus #303 ist damit erst nach dem Rollout abnehmbar.

#### 2026-11-03T15-31-41: fd-bootstrap Dispatch-Felder sind vorbelegt (build_image, restart_machines=frickeldave, force_restart, image, Ressourcen)
**By:** Squad (Coordinator)
**What:** fd-bootstrap Dispatch-Felder sind vorbelegt (build_image, restart_machines=frickeldave, force_restart, image, Ressourcen)
**References:** #303, fd-bootstrap
**Why:** **By:** David Koenig (via Copilot Squad) — Nutzerdirektive

**What:**
- Die `workflow_dispatch`-Felder von `.github/workflows/fd-bootstrap.yml` sind vorbelegt, damit ein einzelner Dispatch ein komplettes Refresh auslöst:
  - `build_image: true` (die Diagnose-Skripte `fd-status.sh`/`fd-welcome.sh` liegen im Image, nicht im Manifest)
  - `restart_machines: "frickeldave"` (einziger Entwickler)
  - `force_restart: true` (die Maschine hat praktisch immer eine offene SSH-Sitzung)
  - `image: "ghcr.io/frickeldave/fd-dev-full:latest"`
  - `dev_cpu_request: "100m"`, `dev_memory_request: "2Gi"`, `dev_cpu_limit: "4"`, `dev_memory_limit: "16Gi"` — identisch zu `DEFAULT_RESOURCES`, per Test gegen Drift geschützt
- Die Defaults gelten **nur** für `workflow_dispatch`. Push-Runs auf `dev` übergeben keine Inputs; dort bleibt `BUILD_REQUESTED` falsch und `if: inputs.restart_machines != ''` greift nicht — kein automatischer Image-Build und kein automatischer Neustart.
- Konsequenz, bewusst akzeptiert: Jeder manuelle Dispatch mit diesen Defaults startet die eigene Maschine neu und kostet `gh`-/Copilot-Login, SSH-Keys, Checkout und alle Worktrees; Recovery über `fd-setup`. Wer nur Manifeste anwenden will, leert `restart_machines`.
- `restart_machines` bleibt destruktiv beschrieben („ALL DATA IN THE CONTAINER IS LOST"); `force_restart` überspringt bewusst die Schutzprüfung auf aktive SSH-Sitzungen.

**Why:** Der Nutzer arbeitet allein am Projekt und will den Rollout von #303 (16 GiB, neue Diagnose) mit einem Klick auslösen können, statt Handle, Image und vier Ressourcenwerte jedes Mal zu tippen.

#### 2026-11-03T19:50:00Z: Layout und Terminologie der zweisprachigen Kubernetes-Schulung

**By:** Maria

**What:** Drei Festlegungen für die zweisprachige Kubernetes-Schulung (#301):

1. Sprachordner heißen `kubernetes-basis-de` und `kubernetes-basis-en` (Top-Level in
   `src/content/docs/`). Die Beispielmanifeste liegen sprachneutral unter
   `src/content/docs/examplefiles/` und enthalten keine Markdown-Dateien, damit der Glob-Loader sie
   nicht als Content lädt und die 3-Segment-IDs des Routing nicht entstehen.
2. Englische Kapitel behalten die Zahlenpräfixe (`01 Introduction` … `91 kubectl Reference`), weil
   `sortByTitle` per `localeCompare` sortiert. Die Kapitelliste im EN-Gruppenindex heißt
   `Chapter overview` -- `Table of contents` würde von `remarkToc`/`remarkCollapse` überschrieben.
3. Englische Glossaranker: `container-orchestration`, `scaling`, `labels-and-selectors` und
   `qos-classes` ersetzen die deutschen Anker; alle Verweise in beiden Sprachfassungen zeigen auf die
   jeweils eigene Fassung. Code-Fences bleiben in beiden Sprachen byte-identisch (402 Fences pro
   Sprache, inklusive deutscher Kommentare in Skripten und Manifesten) -- übersetzt werden nur
   Fließtext, Überschriften, Tabellenzellen, Bild-Alt-Texte und die Kommentare in
   `src/content/docs/examplefiles/`.

**Why:** Ordnername = URL-Segment; nur Top-Level-Ordner mit `-index.md` werden als Gruppe erkannt.
Sortier- und Remark-Verhalten sind im Repo verifiziert. Die Trennung zwischen übersetzbarer Prosa und
unveränderten technischen Blöcken hält Kommandos, Namespace, FQDNs, Images und Secret-Werte in beiden
Sprachen identisch und macht Diffs prüfbar.

#### 2026-11-03T20:45:00Z: Legacy /docs/kubernetes-basis URLs redirect via static Astro redirects

**By:** Nick

**What:** `astro.config.mjs` now carries a `redirects` block with eight keys (no trailing slash on the keys,
trailing slash on the targets) mapping the old Kubernetes training URLs to `/docs/kubernetes-basis-de/…`. With
`output: "static"` Astro emits meta-refresh stub pages (HTTP 200) that also carry `robots: noindex` and a canonical
link to the `-de` target. Sitemap and Pagefind exclude these stubs automatically (sitemap only sees page routes;
Pagefind skips documents without an `<html>` element).

**Why:** Old inbound links and bookmarks must keep working after the German course moved to `kubernetes-basis-de`
and an English twin (`kubernetes-basis-en`) was added. Real 301s would require hosting/Cloudflare redirect rules,
which the spec explicitly excludes from this issue; the static stubs are the in-repo mechanism and stay reversible.

#### 2026-11-03T20:55:00Z: Bilingual Kubernetes e2e tests — detector design and the literal-grep contradiction

**By:** Clint

**What:** `test/e2e/docs-kubernetes-bilingual.spec.mjs` covers chapter coverage (set equality of the seven slugs per
group), HTTP 200 plus exactly one `<h1>` for both group pages and all 14 chapters, the eight legacy redirects, link
hygiene, the docs overview and the sitemap. Two design decisions:

1. The "no German running prose" check removes `pre`, `code`, `script` and `style` before scanning `#main-content` and
   looks for unambiguous German function words plus umlauts. Code fences stay German by design (spec step 5), so
   scanning raw page text would produce false positives. A negative-control test runs the same detector against the
   German `10-tag-1` chapter and requires >20 marker hits — without it a broken selector would make the check pass
   vacuously.
2. Redirect tests accept both shapes the spec allows: 3xx with `location` starting `/docs/kubernetes-basis-de`, or
   200 with meta refresh, `robots noindex`, canonical link and no `<h1>`. Astro's static build emits the 200 variant,
   but the test documents and tolerates the 3xx variant.

**Why:** Deterministic assertions that cannot pass by accident, while keeping code blocks (untranslatable technical
payloads) out of the prose signal. The prose check and the redirect/navigation check are split into one test per page
so a single failure names the affected chapter instead of aborting a seven-page loop, and the 30 s default timeout
stays comfortable on a loaded shared host.

**Known contradiction in acceptance criterion 10:** `grep -rn "/docs/kubernetes-basis/" src/content` cannot be 0:
48 hits remain, all of them Vite asset specifiers `@assets/docs/kubernetes-basis/…`, which the spec explicitly keeps
unchanged (step 2 and "Nicht enthalten"). Zero non-asset hits hold, and the built-page test asserts that no rendered
DE/EN page contains `href="/docs/kubernetes-basis/` or `localhost:4321`, which is the meaningful version of the
criterion.

#### 2026-11-04T07:57:19+00:00: Nutzerfreigabe für Scope-Erweiterungen von #301

**By:** David Koenig (via Copilot Squad)

**What:** Alles, was die deutsch/englische Doku betrifft und in dieser Session aufkam, darf unter Ticket #301 bearbeitet werden. Konkret bestätigt: (1) Badge "Deutsch"/"Englisch" auf den Docs-Kacheln plus neues optionales Frontmatter-Feld `languageLabel`; (2) linke Doku-Navigation und rechtes ToC auf allen Gruppen-Landingpages (/docs, astro-workshop, kubernetes-basis-de, kubernetes-basis-en), ToC aus den Überschriften des Gruppen-Index.

**Why:** Der Nutzer reviewt die laufende #301-Implementierung und will Nacharbeiten am selben Ticket statt in neuen Issues; Tony muss die erweiterte Spec jeweils mit approven.

#### 2026-11-04T13:15:00+00:00: Sprach-Badge und Gruppen-Navigation auf den Docs-Landingpages

**By:** Natasha

**What:** (1) Neues optionales Schema-Feld `languageLabel` (`z.string().optional()`, ohne Default) in `src/content.config.ts`. (2) Badge in `Card.astro` als `<span class="glass-t ... absolute top-2 left-2 z-10 ..." data-language-label={languageLabel}>` innerhalb des bestehenden `<a>`, nur bei gesetztem Feld; zusätzlich `text-txt-h dark:text-darkmode-txt-h`, damit die Badge-Schrift exakt die Farbe der `h4`-Titelbox hat (#111 in Light, #fff in Dark) und über beliebigen Kachelbildern lesbar bleibt — kein `text-transform`, das Attribut trägt zusätzlich den Label-Wert für stabile e2e-Lokatoren. (3) `CollectionLayout.astro` baut `browserMenu` jetzt selbst: auf `/docs/` alle Gruppen mit ihren Kapiteln, auf einer Gruppen-Landingpage nur die eigene Gruppe (Filter über die Collection-ID, nicht über Props), Aufbau in einer sequenziellen `for`-Schleife statt `Promise.all` + `push`, damit die Menüreihenfolge deterministisch bleibt (die Page-Variante in `[...id].astro` bleibt unverändert). (4) Der Index-Body wird nur bei nicht-leerem `body` gerendert (`collectionIndex.body?.trim()`), damit `/docs/` keine leere Glas-Box und kein leeres ToC erhält; `headings` gehen mit `tocDepth = 3` an `TableOfContents`, die `hideNav`/`hideToc`-Staffelung ist 1:1 aus `EntryLayout` übernommen.

**Why:** Kriterien 13–24 verlangen Badge-Sichtbarkeit ohne Layout-Regress der Kachel, lesbare Beschriftung und ein ToC, dessen `#`-Links auf tatsächlich gerenderte IDs zeigen — daher Body-Rendering oberhalb des Kachel-Grids als Ankerquelle. Menüaufbau im Layout hält `src/pages/docs/**` unangetastet (Abgrenzung AK 25). Offen bis zur Content-Ebene (Maria): die Frontmatter-Werte `Deutsch`/`Englisch`, die Umbenennung der Index-Überschriften (`Überblick`/`Overview`) und die Entlinkung der Kapitellisten in den Gruppen-Indizes (AK 13/14/22/26).

#### 2026-11-04T13:23:00+00:00: Sprachlabels und entlinkte Kapitellisten in den drei Gruppen-Indizes

**By:** Maria

**What:** (1) `kubernetes-basis-de/-index.md` trägt `languageLabel: "Deutsch"`, `kubernetes-basis-en/-index.md` `languageLabel: "Englisch"` (je direkt nach `description`, alle übrigen Felder unverändert); `astro-workshop/-index.md` und `src/content/docs/-index.md` bleiben ohne Feld. (2) Überschriften umbenannt: `## Inhaltsverzeichnis` → `## Überblick` (DE), `## Chapter overview` → `## Overview` (EN), `## Inhaltsverzeichnis` → `## Workshop-Überblick` (Workshop). Die sechs bzw. zehn Einträge sind reiner Text ohne `href`; die beschreibenden Halbsätze und die vorhandenen Trenner (` -- ` in den Kubernetes-Indizes, `—` im Workshop) bleiben unverändert. (3) Workshop-Liste auf die zehn real vorhandenen Kapitel korrigiert: `31 Deployment` entfällt (Deployment steckt in `10-astro-setup`), `32 KI-Integration` wird zu `30 KI-Übersetzung`, neu ergänzt wird `40 Weiter lernen`; die vier `### Phase …`-Überschriften bleiben unverändert, `30`/`40` stehen unter `### Phase 3—Deployment & KI`.

**Why:** Nach dem Body-Rendering in `CollectionLayout.astro` würde jede manuelle Kapitelliste das Kachel-Grid duplizieren; als Text bleibt die didaktische Ordnung lesbar, ohne dritte Navigation und ohne 404-Ziele. Die Workshop-Korrektur hält die Liste mit dem tatsächlichen Kapitelbestand deckungsgleich (AC 22 erwartet sechs ToC-Einträge: zwei `h2` plus die vier Phasen-Überschriften). `src/content/docs/-index.md` bleibt unverändert, damit `/docs/` keine leere Body-Box und kein leeres ToC erhält (AC 22/26).

#### 2026-11-04T13:40:38Z: e2e-Abdeckung der Gruppen-Landingpages: Hydration abwarten, Link-Zählungen auf das Kachel-Grid begrenzen

- Navigation und Inhaltsverzeichnis liegen in `ScrollArea` (`client:only="react"`) und stehen im statischen HTML nur in `<template data-astro-template>`. Die neuen Helfer `navPanel`/`tocPanel` filtern `astro-island` nach der gerenderten `h2` („Documents“/„Contents“); `waitForHydratedNav`/`waitForHydratedToc` warten mit 15 s Timeout auf die sichtbare Überschrift. Dadurch prüfen die Tests den hydratisierten DOM statt des Template-Inhalts und sind nicht von Timing-Zufällen abhängig.
- Alle Link-Zählungen auf den Landingpages (Kapitelabdeckung beider Kubernetes-Gruppen sowie die Ein-Link-Prüfung auf `/docs/`) sind auf `section.section div.row` begrenzt. Die linke Navigation verwendet dieselben `href`-Werte; ohne Eingrenzung wären die Zahlen doppelt so hoch. Die Absicht der bisherigen Zusicherungen bleibt unverändert.
- Neue Fälle decken Sprachbadges (genau zwei, „Deutsch“/„Englisch“, keine an `astro-workshop`), Navigation aller vier Landingpages inkl. Auflösung jedes `href`, ToC-Einträge und Anker-Existenz, entlinkte Index-Bodies ohne `31-deployment`/`32-ki-integration` sowie die unveränderte Kapitelseite `/docs/kubernetes-basis-de/10-tag-1/` ab.

## Governance

- Alle bedeutenden Änderungen erfordern Teamkonsens
- Architektonische Entscheidungen hier dokumentieren
- History auf Arbeit fokussieren, Entscheidungen auf Richtung fokussieren
