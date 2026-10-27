# Squad-Entscheidungen

## Aktive Entscheidungen

- Archivierte Einträge (älter als 30 Tage, Stand 2026-10-27): siehe [`decisions-archive.md`](decisions-archive.md).
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


### 2026-10-27T12-21-13: IS_289 integration MVP scaffold in frickeldave.home.net
**By:** Bruce
**What:** IS_289 integration MVP scaffold in frickeldave.home.net
**Why:**
#### Was gebaut wurde

Phase-1-Slice der HACS-Custom-Integration `frickeldave_store` im Repository
`Frickeldave/frickeldave.home.net` (Commit 05edd71, direkt auf `main` gepusht).

- Repo-Gerüst: `custom_components/frickeldave_store/`, `manifest.json` (0.1.0,
  domain frickeldave_store, dependencies http/panel_custom/websocket_api,
  iot_class local_polling), `hacs.json`, MIT-Lizenz, README (deutsch),
  CHANGELOG (`## [Unreleased]`, Refs #289), pyproject (ruff+mypy+pytest),
  CI-Workflow mit getrennten Jobs für ruff, mypy, pytest, hassfest und hacs/action.
- Datenschicht: HA-`Store` (Key `frickeldave_store.data`, Version 1/Minor 1) unter
  `config/frickeldave_store/`, Bilder unter
  `config/frickeldave_store/images/<artikelnummer>/`, atomare Writes, Executor-I/O,
  Snapshot vor Migration, `async_migrate_func` + `async_migrate_entry`.
- Produktdomain: eindeutige Artikelnummern (Kategorie + 4 Zeichen, Lock-geschützt),
  unveränderliche Kategorie, ausschließlich Soft-Delete, Tags, Bestandsbuchungen,
  Filter (Kategorie ODER, Tags UND, Rest UND), stabile Sortierung.
- Config-/Options-Flow (keine YAML), deutsche und englische Übersetzungen.
- Berechtigungen: Rollen product/finance/app_admin, Default Deny, Prüfung je
  HTTP-/WebSocket-Anfrage, sofortiger Entzug; `GET /me` liefert nur eigene Rechte.
- Panel via `panel_custom` (`frickeldave-store`, `embed_iframe=False`,
  `require_admin=False`), statische Assets unter `/frickeldave_store_frontend`.
  Das Verzeichnis `frontend/` bleibt Natasha vorbehalten.
- HTTP-API `/api/frickeldave_store/*` exakt nach dem mit Natasha abgestimmten
  Vertrag inkl. `image_limit` (409, keine Teilpersistenz) und Settings ohne API-Key.
- KI-Dienst mit Anbieter-Abstraktion, DeepSeek `deepseek-flash`, EXIF/GPS-Strip,
  Timeouts, lesbaren 429/5xx-Meldungen, Vorschlag ohne Persistenz.
- Export im Live-Schema der Website (idempotent, ohne archivierte Produkte) plus CLI.
- Dokumentation `docs/architecture.md`, `data-model.md`, `permissions.md`,
  `backup-restore.md`; 68 Tests.

#### Validierung

- `python3 -m compileall custom_components` → OK
- `.venv/bin/ruff check .` → All checks passed
- `.venv/bin/ruff format --check .` → 27 files already formatted
- `.venv/bin/mypy custom_components` → no issues in 12 source files
- `.venv/bin/pytest -q` → 68 passed
- `python3 -m json.tool` für manifest.json, hacs.json, translations/*.json, strings.json → OK
- Smoke-Test Export gegen `public/data/handmade.json`: 63 Produkte, identische Feldnamen

#### Abweichung von der Spezifikation

Repository-Name weicht auf ausdrückliche Anweisung von `Frickeldave/frickeldave-store`
ab: `Frickeldave/frickeldave.home.net`. Manifest, HACS-Metadaten, README und Doku
verweisen durchgehend auf dieses Repository.

#### Grenzen

PayPal, Kundenverwaltung, Website-Publish-Workflow, HACS-Default-Katalog und produktive
Migration sind bewusst nicht in diesem Slice (Roadmap im README). Restore-Test gegen eine
produktive Instanz steht noch aus.

### 2026-10-27T12-16-39: IS_289 panel: Lit web component with HA tokens
**By:** Natasha
**What:** IS_289 panel: Lit web component with HA tokens
**Why:** Deliverable: custom_components/frickeldave_store/frontend/frickeldave-store-panel.js (single file, `frickeldave-store-panel`, Shadow DOM, Lit via bare "lit" import, HA design tokens + --fd-* layer, German UI).

Implemented views:
1. Access gate: GET /me on first hass assignment, default deny, dedicated "Kein Zugriff" and connection-error states, revalidation on visibilitychange and HA user change; no protected fetch without can.product / can.app_admin.
2. Product list: search (debounced), category multi-select (OR), tag multi-select (AND), personalisierbar, Auf Lager, Im Schrank, Sichtbarkeit, "Nur archivierte", sort name/price with asc/desc that survives filter changes, result count, loading/empty/error states, pagination 24.
3. Create/edit dialog: name, description, price (EUR decimal with comma), size, tags (add/remove/free text), visible/customizable switches, category select only on create (disabled and explained afterwards), German validation, buttons disabled while saving.
4. Image management: max 10, count-aware rejection message before any upload, per-file multipart upload, move left/right (order endpoint), set main, two-step delete, main badge, alt text; images require the bearer token, so they are fetched once and rendered as object URLs.
5. Stock booking: Zugang/Abgang/Umlagerung/Korrektur, quantity, note, current stock/salesCabinet.
6. Archive confirmation dialog (soft delete only, no hard-delete UI).
7. AI description suggestion: suggestion shown in an editable textarea, "Übernehmen" only changes the local form value (saved by the normal PATCH), "Verwerfen" leaves the description untouched; loading and 429/timeout messages.
8. Tag management dialog (list/create/delete).
9. Settings (app_admin): KI-Endpunkt, Modell, Prompt, API-Key only as api_key_set plus write-only field; key is never rendered back.

API contract used: /me, /products (+ search/category/tags/customizable/in_stock/in_cabinet/visibility/archived/sort/order/limit/offset), /products POST, /products/{articleNumber} PATCH, /archive, /images GET/POST/order/main/DELETE, /tags GET/POST/DELETE, /stock, /description/suggest, /settings GET/PATCH. All requests send "Authorization: Bearer <access_token>" with base URL from hass.auth.data.hassUrl.

Assumptions recorded:
- Backend settings payload is nested as {"ai": {endpoint, model, prompt, api_key_set}}; PATCH sends {"ai": {...}} (aligned with the work-tree implementation; flat shapes are tolerated on read).
- Image upload uses one request per file with multipart field "file" (backend reads exactly one file per request).
- archived=true means "only archived"; label is "Nur archivierte anzeigen".
- Correction requires quantity >= 1 (backend rejects 0).
- Image URLs returned by the API are bearer-protected; HA has no cookie auth for /api, so previews are loaded via fetch + object URLs rather than plain img src.
- Tag catalog (/tags) and free-form product tags are separate; product tags are not auto-created in the catalog.

Validation: node --check passes; no browser/DOM test possible in this environment.

### 2026-10-27T12-13-24: IS_289 website docs: fr008 + fr003 update + types
**By:** Maria
**What:** IS_289 website docs: fr008 + fr003 update + types
**Why:** Doku-Paket für #289 (nur Website-Repo, keine Implementierung) abgeschlossen.

Geänderte Dateien:
- NEU docs/features/fr008-ha-manager.md: Zweck/Umfang, Architektur (HACS-Custom-Integration custom_components/frickeldave_store, panel_custom + Lit, HA-Store unter config/frickeldave_store/, Bilder unter config/frickeldave_store/images/<artikelnummer>/), Installation über HACS, Config-/Options-Flow, Datenmodell mit schemaVersion 1, Rollen (Produktpflege/Finanzen/Anwendungsverwaltung, Default Deny, serverseitige Prüfung), Backup/Restore, Website-Export, DeepSeek-Vorschläge, Bestandsmodell, Non-Goals, offene Fragen.
- docs/old/features/fr003-catalog.md: fünf Kategorien inkl. SB (Steinmasse) samt Codes und Label-Mapping, stock/salesCabinet als vorhandene, nicht ausgewertete Felder, Link auf fr008.
- src/types/index.d.ts: HandmadeItem um stock?: number und salesCabinet?: number ergänzt; zusätzlich die veraltete category-Union auf die fünf Live-Codes 3D/EP/LA/SB/WO korrigiert (eng mit der fr003-Korrektur verbunden, keine Vergleichsstellen im Code betroffen).
- CHANGELOG.md: ein Eintrag unter [Unreleased] mit (#289).

Abweichung: Repository der Integration ist laut Nutzerentscheidung vom 27.10.2026 Frickeldave/frickeldave.home.net, nicht Frickeldave/frickeldave-store; im Dokument einmal sachlich vermerkt.

Validierung:
- npm run format:check: "All matched files use Prettier code style!"
- npx prettier --check auf den drei geänderten Dateien: clean
- npm run lint:check: exit 0, keine Ausgabe
- npx markdownlint-cli@0.44.0: fr008 ohne Befund; fr003 nur die zwei vorbestehenden Befunde MD040 (Zeile 167) und MD031 (Zeile 437), Baseline identisch
- npx astro check: 51 errors / 0 warnings / 184 hints, exakt identisch zur Baseline ohne die Änderungen (vorbestehend, u. a. fehlendes Pflichtfeld picture im JSON)
- npm run build nicht ausgeführt: reine Doku-/Deklarationsänderung, Typprüfung über astro check abgedeckt.

Offen: Export-Transport zur Website, PayPal-Kunden-API-Umfang, Aufbewahrungsfrist, Rechnungsauswirkung, HA-Benutzer-IDs.

## Governance

- Alle bedeutenden Änderungen erfordern Teamkonsens
- Architektonische Entscheidungen hier dokumentieren
- History auf Arbeit fokussieren, Entscheidungen auf Richtung fokussieren
