# Squad-Entscheidungen

## Aktive Entscheidungen

- Archivierte Einträge (älter als 30 Tage, Stand 2026-11-02): siehe [`decisions-archive.md`](decisions-archive.md).

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

### 2026-11-02T07:24:38+0000: Lagerstätten ersetzen `stock`/`salesCabinet`; Website-Abbildung bleibt stabil

**By:** Bruce (Backend / Scripts / Komponenten)

**What:**
Bestände liegen ab Store-Schema 2 als Zuordnung `stock: {"<locationId>": <stueck>}` am
Produkt; `Product.sales_cabinet` entfällt. Die Lagerstätten selbst stehen als
`locations: [{"id", "name"}]` im Store-Payload, Standard sind exakt
`lager`/„Lager“ und `verkaufsschrank`/„Verkaufsschrank“ (bisheriges Verhalten).
`StockBooking` referenziert mit `locationId` die betroffene Lagerstätte und bei
`transfer` zusätzlich `targetLocationId`.

IDs sind stabil und werden aus dem Namen abgeleitet (Slug, Umlaute transliteriert,
Kollisionssuffix). **Umbenennen behält die ID und damit den Bestand.** Löschen ist nur
erlaubt, wenn dort kein Bestand > 0 gebucht ist; sonst `409 conflict` mit Meldung
„… kann nicht gelöscht werden: N Produkte haben dort noch M Stück Bestand …“. Der
Options-Flow ordnet Zeile *n* der bisherigen Lagerstätte *n* zu (Umbenennen), das
Konfigurationspanel arbeitet über explizite IDs; beide schreiben dieselbe Options-Quelle
(`stock_locations`).

Die Migration 1→2 bildet verlustfrei ab: `stock` → erste Lagerstätte,
`salesCabinet` → zweite; bestehende Buchungen erhalten die implizite Lagerstätte
(Zugang/Abgang/Korrektur → erste, Umlagerung → erste + zweite). Vorher legt die
Integration einen Snapshot `backups/pre-load-v1-*.json` ab.

Export-Abbildung (Website-Kompatibilität, in `export.py` als
`export_stock_fields`): **Lagerstätte 1 → `stock`, Lagerstätte 2 → `salesCabinet`**,
ohne zweite Lagerstätte bleibt `salesCabinet` bei 0. Die Abbildung hängt an der
Reihenfolge, nicht an den Namen. Der Import liest die Website-Felder entsprechend
zurück.

API-Vertrag: `GET /locations` (`product`) liefert `{"locations": [{id, name, position,
stock_total, products_with_stock}]}`; `GET /settings` enthält dieselbe Liste.
`PATCH /settings` (`app_admin`) akzeptiert `{"locations": [{"id"?: "...", "name": "..."}]}`
— fehlende IDs legen neu an, fehlende bestehende IDs löschen (nur bei Bestand 0).
Produktfilter: `in_stock`/`in_cabinet` bleiben als Kompatibilitäts-Aliase für
Lagerstätte 1/2, neu sind `location=<id>` und `in_location=<bool>`.

**Why:**
Der Bestand muss beliebig viele Lagerstätten abbilden können, ohne die bestehende
Website zu brechen: `public/data/handmade.json` kennt nur `stock` und `salesCabinet`.
Eine reihenfolgeabhängige, namensunabhängige Abbildung hält den Export stabil, wenn
Lagerstätten umbenannt werden. Stabile IDs verhindern, dass ein Umbenennen Bestände
verliert; der Löschschutz verhindert stillen Datenverlust. Natasha rendert die
Nummernboxen aus `GET /locations` und schreibt `stock` als Objekt je `locationId`
zurück.

### 2026-11-02T07:24:38+0000: Veröffentlichung nach dev und prod läuft ausschließlich über `dev` + `fd-deploy-prd`

**By:** Bruce (Backend / Scripts / Komponenten)

**What:**
Der neue Endpunkt `POST /api/frickeldave_store/publish` (`app_admin`) hat genau zwei
Ziele:

- `target: "dev"` — der Export (Katalog + Bilder) wird über die GitHub-Git-Data-API als
  **ein** Commit auf den Integrationsbranch `dev` geschrieben. Der Push löst `fd-ci` aus,
  nach grünem Lauf deployt `fd-deploy-dev` und veröffentlicht das Pre-Release
  `dev-v<version>`.
- `target: "prod"` — derselbe Commit auf `dev`, danach `workflow_dispatch` von
  `fd-deploy-prd.yml` auf `ref: main`. `fd-deploy-prd` ist der einzige Workflow, der
  `dev` nach `main` merged und Pages deployt.

Die Integration committet **nie** direkt auf `main`. Ist der Dateistand auf `dev`
unverändert, entsteht kein zweiter Commit (idempotent); `prod` dispatcht trotzdem, damit
ein bereits gepushter, aber nicht promoteter Stand nachgezogen werden kann — `fd-deploy-prd`
selbst ist bei Gleichstand ein grüner No-Op.

Dry-Run ist derselbe Endpunkt mit `"dry_run": true`: Er liest Branch/Baum (und bei
Bedarf den entfernten Katalog), liefert den Datei-Diff, Zählungen für Produkte und
Bilder, Zielbranch, Deployment-Hinweis und eine deutsche Zusammenfassung — und verlässt
die Methode vor jedem Commit/Dispatch. Store-Schreibzugriffe gibt es im gesamten Pfad
nicht.

Konfiguration: `settings.publish` mit `repository`, `dev_branch`, `prod_branch`,
`prod_workflow`, `token`; in den Optionen `github_repository`, `github_dev_branch`,
`github_prod_workflow`, `github_token`. Das Token ist write-only (`token_set` in
`GET /settings`), wird nur im Authorization-Header verwendet und nie geloggt. Fehlt es,
antwortet der Endpunkt mit `400 publish_token_missing` und deutschem Text statt einer
Exception.

**Why:**
Die Website-Repo-Regel erlaubt `main` ausschließlich über `fd-deploy-prd`; ein direkter
Push würde die Branch-Protection und den Release-Ablauf umgehen. `dev` ist der einzige
Branch, dessen Push CI und Deployment automatisch auslöst, deshalb ist er für beide
Ziele der Schreibpunkt. Der Dry-Run teilt sich Code und Antwortformat mit dem echten
Lauf (nur der Schreibblock entfällt), damit die Vorschau nicht von der Realität
abweichen kann. Natasha (Frontend) braucht dafür nur `POST /publish` mit
`{target, dry_run, message}` und die Felder `counts`, `products`, `images`, `files`,
`deployment`, `summary`.

### 2026-11-02T07:24:38+0000: Ansichtswahl (Kacheln/Liste) liegt in `localStorage`

**By:** Natasha (Frontend / UI)

**What:**
Der Umschalter in der Filterleiste speichert „grid“ oder „list“ unter dem Schlüssel
`fd-store-view` in `localStorage`. Beim Initialisieren liest das Panel den Wert; bei
fehlendem, gesperrtem oder unbekanntem Speicher fällt es auf die Kachelansicht zurück.
Der Zustand ist bewusst geräte- und browserlokal, nicht Teil der Store-Settings.

**Why:**
Die Ansicht ist eine reine Darstellungspräferenz, keine fachliche Konfiguration. Sie
soll Neuladen und Seitenwechsel überleben, aber nicht alle Benutzer oder Geräte
gleichschalten und keinen zusätzlichen API-Aufruf oder Settings-Patch erzeugen.
`localStorage` ist dafür ausreichend und funktioniert ohne `app_admin`-Recht.

### 2026-11-02T07:24:38+0000: Buchungshistorie als Abschnitt im Bestand-Tab

**By:** Natasha (Frontend / UI)

**What:**
Die Buchungshistorie (`GET /products/{article_number}/stock`) erscheint als Abschnitt
„Buchungshistorie“ unter den Lagerstätten-Nummernboxen im Tab „Bestand“ des
Produktdialogs. Sie wird beim ersten Öffnen des Tabs geladen (und über „Neu laden“
aktualisiert) und zeigt Buchungsart, Menge, Zeitpunkt, Lagerstätte(n) und Notiz. Beim
Anlegen entfällt der Abschnitt mit dem Hinweis, dass die Historie nach dem Erstellen
verfügbar ist.

**Why:**
Der bisherige Bestandsdialog entfällt, damit Bestände direkt im Produktformular
gepflegt werden. Die Historie bleibt fachlich wichtig (Nachvollziehbarkeit), gehört
aber zum Bestand desselben Produkts. Ein eigener Dialog wäre ein zusätzlicher Einstieg
und würde die neue Tab-Struktur wieder aufbrechen; der Abschnitt ist ohne Persistenz
sofort erreichbar und teilt sich den Ladezustand mit dem Tab.

### 2026-11-02T07:24:38+0000: Bilder beim Anlegen über automatischen Tab-Wechsel nach dem ersten Speichern

**By:** Natasha (Frontend / UI)

**What:**
Der Produktdialog hat die Tabs „Grunddaten“, „Bilder“ und „Bestand“. Beim Anlegen
existiert noch keine Artikelnummer, deshalb zeigt der Bilder-Tab zunächst nur den
Hinweis, dass Bilder nach dem ersten Speichern verfügbar sind. Nach erfolgreichem
`POST /products` bleibt der Dialog offen, wechselt in den Modus „bearbeiten“, übernimmt
die neue Artikelnummer aus der Antwort und springt automatisch in den Bilder-Tab; die
Bildliste wird direkt geladen. Ein Toast bestätigt „Produkt wurde erstellt. Du kannst
jetzt Bilder hinzufügen.“ Erst danach schließt der Nutzer den Dialog selbst.

**Why:**
Ein eigener Bilder-Dialog vor dem Anlegen hätte eine künstliche Artikelnummer oder
einen zweiten Speicherschritt gebraucht. Der automatische Wechsel hält den Kontext,
verhindert verwaiste Uploads und macht die Reihenfolge „erst speichern, dann Bilder“
explizit. Der separate `#fd-images-dialog` und der Bilder-Button auf der Produktkarte
entfallen.

### 2026-11-02T08:39:46+0000: FR008-Doku beschreibt Version 0.1.9 als umgesetzt statt als Spezifikation

**By:** Maria (Technische Redakteurin / Dokumentationsspezialistin)

**What:**
`docs/features/fr008-ha-manager.md` führt die acht Funktionen aus Integration 0.1.9 in der
bestehenden Struktur nach:

- Kopf: Status von „geplant“ auf „umgesetzt in Version 0.1.9 (Backend und Oberfläche)“; der
  Hinweis auf geplante Finanz- und Kundenfunktionen bleibt.
- Neuer Abschnitt `## Produktpflege im Panel` mit `### Ansichten und Toolbar` (Kacheln/Liste,
  `localStorage`-Schlüssel `fd-store-view`), `### Produktdialog` (Tabs Grunddaten, Bilder, Bestand)
  und `### Aktualisieren` (lädt neu, überträgt nichts, löst kein Deployment aus).
- Neuer Abschnitt `## Veröffentlichen` samt `### Dry-Run` (dev per Git-Data-API-Commit, prod über
  `fd-deploy-prd`, Token write-only, Ergebnisanzeige, Zählungen und Dateiliste).
- `### Lagerstätten` unter Einrichtung und Optionen; Datenmodell auf Schema-Version 2 und
  `stock` als Objekt Lagerstätten-ID → Stückzahl umgestellt, `salesCabinet` entfällt dort.
- `## Bestandsmodell`, `## Website-Export`, `## KI-Beschreibungsvorschläge`, `## Berechtigungen`
  und `## Offene Fragen` an die neuen Fakten angepasst; die Transportfrage gilt als entschieden.
- `CHANGELOG.md` erhält unter `## [Unreleased]` sechs `### Added`- und eine `### Changed`-Zeile,
  jeweils mit `(#289)`.

**Why:**
Das Dokument beschrieb bisher ausdrücklich nur eine Spezifikation und enthielt Aussagen, die nach
0.1.9 falsch waren (eine Ansicht, ein Bestandsfeld, offener Export-Transport). Wer die Integration
heute installiert, muss die tatsächlichen Bedienwege und die Trennung zwischen „Aktualisieren“ und
„Veröffentlichen“ in der Doku finden. Die Struktur bleibt erhalten, das Datenmodell wird nicht
wiederholt, sondern nur korrigiert und auf die Detailabschnitte verwiesen.

### 2026-11-02T08:56:09+0000: Release 0.1.8 nachgezogen

**By:** Nick (DevOps / Infrastructure) · **Issue:** #289

**What:** Im Integrations-Repository `Frickeldave/frickeldave.home.net` wurde die fehlende Version **0.1.8** nachgezogen:

- Annotierter Tag `0.1.8` (Tag-Objekt `8c5977d48c04b92165532495ba1fee50576d9e66`) auf Commit **`ebb00bd6c2ce7014516c9309c4625ac5f1e28aaf`** (`feat(storage): make the catalog data path configurable`), Annotation „Frickeldave Store 0.1.8“.
- GitHub-Release `0.1.8` (Titel `0.1.8`), **kein Draft, kein Pre-Release**, veröffentlicht am 2026-11-02T08:57:13Z und damit jetzt „Latest“.
- Release Notes = CHANGELOG-Abschnitt `## [0.1.8] - 2026-10-28` aus dem getaggten Tree, unverändert übernommen (Struktur `### Added` / `### Changed` erhalten).
- HACS-Prüfung bestanden: Manifest-Version im Tag = `0.1.8`, `hacs.json` vorhanden, Release nicht als Pre-Release markiert.
- Keine bestehenden Tags/Releases verändert oder gelöscht; `0.1.0`–`0.1.7` unverändert.

**Why:** Die Release-/Tag-Historie war bis 0.1.7 lückenlos, `0.1.8` fehlte jedoch vollständig — obwohl der Commit `ebb00bd` bereits `"version": "0.1.8"` im Manifest und den passenden CHANGELOG-Abschnitt trug. Für HACS ist Tag = Manifest-Version zwingend; ohne Tag/Release wäre 0.1.8 für Nutzer nicht installierbar und die Versionskette unterbrochen.

**Warum genau `ebb00bd`:** Dieser Commit ist der einzige, dessen `custom_components/frickeldave_store/manifest.json` die Version `0.1.8` trägt, und er enthält den vollständigen CHANGELOG-Abschnitt `## [0.1.8]`. Alle späteren Commits (`7aa454c`, `d983f0c`) stehen bereits auf `0.1.9`. Ein Tag auf `main`-HEAD würde daher eine falsche Version ausliefern (Tag-Name ≠ Manifest-Version) und HACS brechen.

**Warum `0.1.9` unreleased bleibt:** `0.1.9` (`main`-Stand `d983f0c`, u. a. Lagerstätten, Veröffentlichung dev/prod, Listenansicht) ist bewusst noch nicht abgenommen — die Abnahme durch David Koenig steht aus. Es existiert weder Tag noch Release `0.1.9`; das bleibt so, bis die Freigabe erfolgt. Ein vorzeitiges Release würde die Latest-Markierung auf ungeprüften Code verschieben.

**Verifikation (ausgeführt):**
- `git ls-remote --tags origin 0.1.8` → `8c5977d… refs/tags/0.1.8` + `ebb00bd… refs/tags/0.1.8^{}` (annotiert, korrektes Ziel)
- `gh release view 0.1.8` → `isDraft: false`, `isPrerelease: false`, `targetCommitish: ebb00bd…`
- `gh release list` → `0.1.8  Latest`
- `git show 0.1.8:custom_components/frickeldave_store/manifest.json` → `"version": "0.1.8"`
- `gh release view 0.1.9` → `release not found`; `git ls-remote --tags origin 0.1.9` → leer

**Konsequenz:** Künftige Releases dieses Repos sollten wie bisher erst nach Abnahme erzeugt werden; 0.1.8 ist als Nachzieh-Release Sonderfall (Lücke in der Historie), kein Präzedenzfall für das Veröffentlichen unreifer Versionen.

#### 2026-11-02T09:15:47+0000: Release 0.1.9 veröffentlicht

**By:** Nick (DevOps / Infrastructure)

**What:**
Version `0.1.9` der Home-Assistant-Integration `Frickeldave Store` wurde als reguläres Release veröffentlicht.

- Annotierter Tag `0.1.9` (Tag-Objekt `8bc736b`) auf Commit `d983f0c01f5d3de3b34bcbf88c4c7863b16635c9` (`main`-HEAD).
  Annotation: „Frickeldave Store 0.1.9“.
- GitHub-Release `0.1.9`: https://github.com/Frickeldave/frickeldave.home.net/releases/tag/0.1.9
  - `isDraft: false`, `isPrerelease: false` → `Latest`
  - Release Notes = CHANGELOG-Abschnitt `## [0.1.9] - 2026-11-02` unverändert übernommen
    (Struktur `### Added` / `### Changed` beibehalten).
- Vorher geprüft: weder Tag noch Release `0.1.9` existierten → kein Überschreiben.
- `0.1.8` (Tag `8c5977d` → Commit `ebb00bd`) bleibt als Vorgänger-Release unangetastet und
  vollständig erhalten (Release-Datum unverändert `2026-11-02T08:57:13Z`).

**Why:**
David Koenig hat am 2026-11-02 um 09:15 UTC ausdrücklich entschieden, `0.1.9` **jetzt und als
reguläres Release** (nicht als Pre-Release) vor der formellen Abnahme zu veröffentlichen. `main`
enthielt bereits alle acht Detailanforderungen aus #289 (Backend `7aa454c` + UI `d983f0c`) sowie
den passenden CHANGELOG-Abschnitt; `manifest.json` im Tag führt `"version": "0.1.9"`.

Konsequenz für das Team: HACS-Installationen ziehen ab sofort `0.1.9` als neueste Version. Die
inhaltliche Abnahme von #289 erfolgt nachgelagert; sollte dabei eine Korrektur nötig werden, ist
eine neue Patch-Version (`0.1.10`) zu veröffentlichen — `0.1.9` wird nicht rückwirkend verändert
oder verschoben.

**Verifikation:**

- `git ls-remote --tags origin`: `refs/tags/0.1.9` (annotiert) → `0.1.9^{}` = `d983f0c`
- `git show 0.1.9:custom_components/frickeldave_store/manifest.json` → `"version": "0.1.9"`
- `hacs.json` und `custom_components/frickeldave_store/publish.py` im Tag vorhanden
- CI-Lauf für `d983f0c` (Push auf `main`): **success** —
  https://github.com/Frickeldave/frickeldave.home.net/actions/runs/41411379649
  (hassfest, pytest, HACS validation, Frontend, mypy, Ruff jeweils `success`)

#### 2026-11-02T09:35:22+0000: Cache-Bust für Panel-Module

**By:** Bruce (Backend / Scripts / Komponenten)

**What:**
Die Panel-Module werden wieder mit Versions-Query ausgeliefert — jetzt mit belastbarer
Begründung, Tests und einer zweiten Absicherung gegen Heuristik-Caching:

- `const.module_url(filename, version=VERSION)` erzeugt `/<FRONTEND_URL_PATH>/<datei>?v=<version>`;
  `PANEL_MODULE_URL` und `CONFIG_PANEL_MODULE_URL` nutzen sie (Version `0.1.10`).
- `panel.py` behält `cache_headers=False` bei und registriert zusätzlich `FrontendAssetView`
  für direkte Dateien des Frontend-Verzeichnisses (`/frickeldave_store_frontend/<filename>`).
  Der View ist spezifischer als der statische Präfix-Pfad, gewinnt daher für `lit.js` und die
  Panel-Module und setzt `Cache-Control: no-cache, must-revalidate`.
- `lit.js` bleibt ohne eigene Query (relativer Import in den Panel-Modulen, Datei gehört dem
  Frontend-Team), wird durch die no-cache-Kopfzeile aber bei jedem Laden revalidiert. Ein
  gemischter Zustand „neues Panel + altes Lit-Bundle“ kann damit nicht dauerhaft bestehen.
- `GET /me` liefert zusätzlich `version`, `storage_schema_version` (= `models.SCHEMA_VERSION`,
  das persistierte Katalogschema) und `panel_module_url`; `GET`/`PATCH /settings` führen
  `version`. Rechte und übrige Response-Form sind unverändert.
- Tests: `?v=<VERSION>` in beiden Modul-URLs, Versionswechsel erzeugt unterschiedliche URL,
  `Cache-Control` des Asset-Views inklusive Routen-Vorrang, `/me`- und `/settings`-Felder.

**Why:**
Die Ursache aus #289 ist eine feste Modul-URL ohne Versionsparameter: Browser behalten das
alte Panel-JS über ein HACS-Update hinweg im HTTP-Cache (die Android-App zeigte die neue
Oberfläche, weil sie ihren Cache anders verwaltet). `cache_headers=False` allein genügt nicht,
weil die aiohttp-`StaticResource` dann gar kein `Cache-Control` sendet und Browser heuristisch
cachen dürfen.

Der Revert `0658381` von `35671fa` enthält keine Begründung. In HA 2025.1.4 (`panel_custom`)
findet sich kein technisches Hindernis: `module_url` wird unverändert in `config["_panel_custom"]`
gelegt, das Frontend lädt den Wert als ES-Modul-URL (`import()` bzw. `<script type="module">`),
und aiohttp ignoriert die Query bei der statischen Pfadauflösung. Die Query erzeugt zusätzlich
eine eigene Modul-Identität im Modul-Registry-Cache des Frontends (Key = URL). Der Revert-Fall
wiederholt sich daher nicht; zusätzlich ist die Änderung diesmal durch Tests abgesichert und
die Version wird separat als `0.1.10` geführt (0.1.9 ist released und bleibt unangetastet).

**Verifikation:**
`ruff check .`, `ruff format --check .`, `mypy custom_components`, `pytest -q` (193 passed).

#### 2026-11-02T10:54:12+0000: Persistenz des Aufklapp-Zustands der Filterleiste

**By:** Natasha (Frontend / UI)

**What:**
Die ein- und ausklappbare Such-/Filterleiste speichert ihren Zustand unter dem
`localStorage`-Schlüssel `fd-store-filters-open` (Werte `open`/`closed`). Voreingestellt
ist `open`; fehlt der Schlüssel oder ist der Speicher gesperrt (privater Modus), bleibt
die Leiste offen und der Zustand gilt nur für die Sitzung. Das Muster entspricht dem
bereits genutzten `fd-store-view` (Kacheln/Liste).

**Why:**
David will die Leiste dauerhaft zuklappen können, ohne sie nach jedem Neuladen erneut
schließen zu müssen. Ein Default von „offen“ verhindert, dass Suche und Filter nach dem
ersten Laden unerwartet fehlen. Das Speichern ist best-effort gekapselt, damit ein
gesperrter `localStorage` die Oberfläche nie blockiert. Wichtig für alle, die weitere
Panel-Einstellungen ergänzen: `fd-*`-Schlüssel bleiben panel-lokal und werden nicht
zwischen Integrationen geteilt.

**Verifikation:**
DOM-Smoke-Test: Toggle setzt `aria-expanded`, blendet `#fd-filter-panel` aus und schreibt
`closed` in `localStorage`; erneutes Öffnen schreibt `open`.

#### 2026-11-02T10:54:12+0000: Platzierung der Versionsanzeige

**By:** Natasha (Frontend / UI)

**What:**
Die von `GET /api/frickeldave_store/me` gelieferte `version` wird als dezente Fußzeile
am Ende des Panel-Inhalts (`footer.fd-panel-footer`, Text `v0.1.10`) und analog im
Konfigurationspanel (`footer.fd-config-footer`) angezeigt. Fehlt das Feld in der Antwort,
wird kein Footer gerendert. Das Drei-Punkte-Menü bleibt unverändert, weil es nur bei
Produktberechtigung existiert und `app_admin` ohne Produktrolle die Version sonst nicht
sehen könnte.

**Why:**
Nach dem Cache-Vorfall in 0.1.9 soll David ohne Inkognito-Tab sofort erkennen, welcher
Build im Browser geladen ist. Eine Fußzeile ist in beiden Rollen erreichbar, stört die
Topbar-Metrik (56 px, Icon-Buttons) nicht und kollidiert nicht mit dem Menü, das nur
Produktverwaltern offensteht. Die Version ist rein informativ; es gibt bewusst keine
zusätzliche Fehlerbehandlung, wenn `/me` das Feld nicht liefert (ältere Serverstände).

**Verifikation:**
DOM-Smoke-Test: Panel- und Konfigurations-Fußzeile zeigen `v0.1.10`, wenn `_me.version`
gesetzt ist; ohne `version` entfällt der Footer.

#### 2026-11-02T10:54:12+0000: Doku für Integration 0.1.10 (Cache-Bust, UI-Korrekturen)

**By:** Maria (Technische Redakteurin / Dokumentationsspezialistin)

**What:**
`docs/features/fr008-ha-manager.md` und `CHANGELOG.md` beschreiben den Stand 0.1.10
(02.11.2026). Geändert wurden ausschließlich diese beiden Dateien.

- Statuszeile: Version 0.1.10 mit Release-Datum 02.11.2026.
- Neuer Abschnitt **Aktualisierung und Browser-Cache** (unter Installation): Ursache des
  Cache-Bugs nach 0.1.9 (Desktop-Browser alt, Android-App neu), die dauerhafte Lösung ab
  0.1.10 und die praktische Anleitung (`Strg+Shift+R`, Websitedaten löschen, angezeigte
  Version als Beleg für den geladenen Build).
- **Oberfläche**: Versionsparameter `?v=<Version>` via `module_url()` in `const.py` für
  `PANEL_MODULE_URL` und `CONFIG_PANEL_MODULE_URL`, `Cache-Control: no-cache, must-revalidate`
  durch den Frontend-View, Versionsanzeige in Panel und Konfigurationspanel sowie
  `version`/`storage_schema_version`/`panel_module_url` in `/me` und `version` in
  `GET`/`PATCH /settings`. Keine Token-Werte.
- **Navigation**: Drei-Punkte-Menü führt „Tags verwalten“ und zeigt die geladene Version.
- **Suche, Filter und Sortierung**: gemeinsame Steuerhöhe `--fd-control-height: 48px`,
  Screenreader-only-Suchlabel, zuklappbare Filterleiste (`aria-expanded`/`aria-controls`,
  `localStorage`-Schlüssel `fd-store-filters-open`, Standard offen, Badge „Filter aktiv“
  bleibt sichtbar).
- **Ansichten und Toolbar**: kompakte Liste (Thumbnail 40 px, Zell-Padding 4 px, einzeilige
  Tags), Bearbeiten/Archivieren als Icon-Buttons mit `aria-label`/`title` und 44 × 44 px.
- **Produktdialog**: Plus/Minus als gleich breite Symbolschaltflächen in einer Spalte je
  Lagerstätte, Minus bei 0 deaktiviert.
- **Veröffentlichen**: Icon-Buttons (Branch, Rakete) in der Topbar für Anwendungsverwaltung;
  die Karte „Website veröffentlichen“ entfällt, Dry-Run-Ablauf unverändert.
- CHANGELOG unter `## [Unreleased]`: ein Added-Eintrag (Doku), drei Changed-Einträge
  (Veröffentlichen, Produktliste/Filter, Bestands-Tab) und ein Fixed-Eintrag (Browser-Cache),
  jeweils mit `(#289)`.

**Why:**
Nach 0.1.9 zeigte der Desktop-Browser veraltete Panel-Controls; ohne dokumentierten Hard
Reload und ohne sichtbare Versionsanzeige ist für Anwender nicht unterscheidbar, ob das
Update wirkte oder der Cache greift. Die fünf UI-Korrekturen und die verlagerte
Veröffentlichung ändern beschriebene Oberflächenelemente, weshalb die bestehenden Abschnitte
angepasst statt ergänzt wurden — sonst stünden Karte, Einzel-Buttons und alte
Bestandsbedienung weiterhin als aktuell im Dokument. Das CHANGELOG bleibt die
Nutzer-Sicht auf denselben Stand.

**Validierung:**
`npx markdownlint-cli@0.44.0 docs/features/fr008-ha-manager.md CHANGELOG.md` → Exit 1 mit
genau zwei Baseline-Befunden im Abschnitt `[1.0.7]` (CHANGELOG.md:51 MD032, CHANGELOG.md:52
MD022, unverändert vorbestehend, nur durch die neuen Zeilen verschoben); `fr008` ohne Befund.
`npm run prose` → 0 errors, 0 warnings, 0 suggestions (104 Dateien). `npm run format:check`
→ „All matched files use Prettier code style!“.

**Offene Punkte:**
Die beiden MD032/MD022-Befunde in `[1.0.7]` (fehlende Leerzeile vor `### Fixed`) bleiben
bewusst stehen, um keinen fremden Abschnitt umzuformatieren; ein eigener Aufräum-Commit kann
sie beheben.

#### 2026-11-02T10:54:12+0000: Release 0.1.10 veröffentlicht

**By:** Nick (DevOps / Infrastruktur)

**What:**
`Frickeldave/frickeldave.home.net` ist als **0.1.10** veröffentlicht — annotierter Tag
auf `38f4136` (`feat(ui): kompakte Listen, einklappbare Filter und Publish-Icons`),
GitHub-Release `0.1.10` (kein Draft, kein Pre-Release, **Latest**) mit den unveränderten
Notes aus `## [0.1.10] - 2026-11-02`.

- Tag: annotiert (`tag`-Objekt), Annotation „Frickeldave Store 0.1.10“, peeled Commit
  `38f41369c2e9e9ba83e28f64f59168152eeb72ff` = `main` (unverändert, kein Push auf `main`,
  keine Commits, Working Tree clean).
- Release: https://github.com/Frickeldave/frickeldave.home.net/releases/tag/0.1.10
- Release-Inhalt geprüft: `manifest.json` → `"version": "0.1.10"`, `const.py` →
  `VERSION = "0.1.10"` und `module_url(filename, version=VERSION)` → `?v={version}`
  (genutzt von `PANEL_MODULE_URL` und `CONFIG_PANEL_MODULE_URL`), `hacs.json` vorhanden,
  `custom_components/frickeldave_store/publish.py` vorhanden.
- CI-Lauf zu `38f4136`: **success** —
  https://github.com/Frickeldave/frickeldave.home.net/actions/runs/41433449800
- Bestand unangetastet: Releases `0.1.8` (`ebb00bd`) und `0.1.9` (`d983f0c`) weiterhin
  vorhanden, Flags unverändert (`isDraft=false`, `isPrerelease=false`); `0.1.10` ist das
  einzige Latest.

**Why:**
David Koenig hat die Veröffentlichung des Cache-Bust-Fixes (`3906571`) plus der fünf
UI-Korrekturen (`38f4136`) angeordnet, nachdem er den Cache-Bug im Browser reproduziert
hatte. Ohne Release mit Latest-Markierung ziehen HACS-Installationen den Fix nicht, und
der veraltete Modul-Cache bliebe für Nutzer sichtbar. Der Tag-Inhalt wurde vor der
Freigabe geprüft, damit das ausgelieferte Artefakt die Version im Manifest trägt und die
Panel-Module tatsächlich mit `?v=0.1.10` ausgeliefert werden.

## Governance

- Alle bedeutenden Änderungen erfordern Teamkonsens
- Architektonische Entscheidungen hier dokumentieren
- History auf Arbeit fokussieren, Entscheidungen auf Richtung fokussieren
