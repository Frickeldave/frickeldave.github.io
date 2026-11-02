# Squad-Entscheidungen

## Aktive Entscheidungen

- Archivierte Einträge (ab 20 KB älter als 30 Tage, ab 50 KB älter als 7 Tage; Stand 2026-11-02): siehe [`decisions-archive.md`](decisions-archive.md).

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

#### 2026-11-02T11:24:46+0000: Datenverlust bei Update behoben

**By:** Bruce (Backend / Scripts / Komponenten)

**What:**

Issue #289, Datenverlust beim Einspielen einer neuen Integrationsversion:
Produkte waren nach jedem Update verschwunden.

- **Ursache:** `HassStoreBackend` las die Store-Datei über
  `homeassistant.helpers.storage.Store`. Dessen `_StoreManager` cached beim
  HA-Start die Dateiliste von `<config>/.storage`; für jeden Schlüssel, der dort
  nicht liegt, antwortet `async_fetch()` mit `(False, None)` — „existiert
  nicht“. Der Katalog liegt in `<config>/frickeldave_store/frickeldave_store.data`,
  also außerhalb `.storage`: `Store.async_load()` lieferte `None`,
  `CatalogStore.async_load()` setzte einen leeren Payload, der nächste
  `async_save` überschrieb die echte Datei mit `"products": []`. Reproduziert mit
  echter HA-Instanz inkl. initialisiertem Store-Manager: 2 Produkte auf Platte →
  0 in Memory → 0 auf Platte.
- **Fix:** `HassStoreBackend` liest und schreibt die Datei selbst (atomar,
  identisches HA-Umschlagformat `{"version", "minor_version", "key", "data"}`);
  keine Abhängigkeit mehr von HA-Storage-Interna. Migration richtet sich nach
  `data.schemaVersion` statt nach der Envelope-Version.
- **Sicherheitsnetz:** `CatalogStore.async_save` schreibt niemals einen Stand mit
  0 Produkten über eine Datei mit > 0 Produkten (`refuse_empty_overwrite`,
  `allow_empty=True` nur bei bewusstem Leeren). `coerce_payload` verwirft keine
  Produkte mehr stillschweigend, sondern bricht mit `products_unreadable` ab.
  Snapshots: `pre-load-v<n>` vor Migrationen, `pre-save` vor dem ersten
  Schreiben nach dem Laden (dedupliziert).
- **Version:** 0.1.11 (`const.py`, `manifest.json`, `pyproject.toml`).
  `STORAGE_VERSION` bleibt 2 — das Dateiformat ist unverändert, eine neue
  Migrationsstufe wäre unnötiges Risiko.
- **Tests:** `tests/test_upgrade_paths.py` mit echten HA-Store-Dateien der Tags
  0.1.7/0.1.8/0.1.9 (inkl. initialisiertem `_StoreManager`-Cache). Alle 10 Tests
  schlagen auf dem alten Code fehl (0 statt 3 Produkte) und sind mit dem Fix
  grün. Gesamtsuite: 203 passed.

**Why:**

HACS-Updates lösen einen HA-Neustart aus — der Fehler trat damit bei jedem
Update auf und kostete David Koenig den kompletten Katalog. Die Regression war
im Test nicht sichtbar, weil die `hass_storage`-Fixture HA-Storage mockt und den
Manager-Cache damit umgeht. Der Fix entfernt die Abhängigkeit von diesem
internen Cache, statt ihn zu umgehen, und baut zwei unabhängige Netze
(Datei-Snapshot, Leer-Overwrite-Schutz) gegen künftige Varianten desselben
Fehlers ein.

#### 2026-11-02T12:13:49+0000: Lagerstätten-Filter

**By:** Natasha (Frontend Developer / UI-Spezialistin)

**What:**

Issue #289, Filter „Lagerstätte“ im Store-Panel: Die Auswahl einer Lagerstätte
filterte nicht, solange die zusätzliche Checkbox „Nur mit Bestand in …“ nicht
aktiv war. `_loadProducts()` sendete nur `location=<id>`; `in_location=true`
wurde erst durch die Checkbox gesetzt. Der Hinweistext behauptete dagegen
bereits eine Bestandsfilterung.

Umsetzung (reiner Frontend-Fix in `frontend/frickeldave-store-panel.js`):

- **Opt-out statt Opt-in.** `_inLocationOnly` → `_includeWithoutStock`. Sobald
  `_locationFilter` gesetzt ist, wird immer `location=<id>` **und**
  `in_location` gesendet: `"true"` als Standard, `"false"` nur mit aktivem
  Opt-out „Auch Produkte ohne Bestand anzeigen“. Die API bleibt unverändert;
  `ProductFilter`/`product_matches()` konnten das bereits.
- **Checkbox** sitzt jetzt beim Auswahlfeld „Lagerstätte“ (statt in „Bestand und
  Status“), ist implizit per `<label>` verknüpft, hat `aria-describedby` auf den
  Hinweis, ist ohne gewählte Lagerstätte deaktiviert (gedämpft, `not-allowed`)
  und wird beim Wechsel auf „Alle Lagerstätten“ sowie beim Verschwinden der
  gewählten Lagerstätte (`_loadLocations`) zurückgesetzt.
- **Hinweistext** nennt den tatsächlichen Effekt: gewählte Lagerstätte = nur
  Produkte mit Bestand > 0 in dieser Lagerstätte; der Opt-out erweitert um
  Produkte ohne Bestand. Kein Versprechen mehr, das der Request nicht einlöst.
- **Zustand:** `_resetFilters()` setzt `_includeWithoutStock` mit zurück;
  `_hasActiveFilters()` zählt weiterhin die gewählte Lagerstätte (nicht den
  Opt-out allein) — damit bleibt „Filter aktiv“ im zugeklappten Filterkopf
  sichtbar und „Filter zurücksetzen“ korrekt aktiviert.
- **Konsistenzprüfung:** `in_stock`/`in_cabinet` werden im Panel nicht mehr
  verwendet (seit der Lagerstätten-Migration in 0.1.10 entfallen); alle übrigen
  Filter (`customizable`, `visibility`, `archived`, Suche, Kategorie, Tags)
  senden genau dann einen Parameter, wenn sie aktiv sind — keine weitere
  Doppel-Logik gefunden, daher keine weiteren Änderungen.
- **Version:** bleibt 0.1.11 (kein Bump); CHANGELOG-Abschnitt `## [0.1.11]` um
  einen `### Changed`-Punkt ergänzt.

**Why:**

Der Filter versprach im UI mehr, als der Request tat: „Lager“ oder
„Verkaufsschrank“ zeigten auch Artikel mit Bestand 0 in dieser Lagerstätte
(z. B. „Adventskalender personalisiert“), weil der Server ohne `in_location`
nicht nach Bestand filtert. Eine Lagerstätte ist eine Bestandsfrage — die
Bestandsbedingung muss der Standard sein, nicht eine zweite Checkbox. Der
Opt-out deckt den bewusst breiteren Blick („was liegt hier alles im Sortiment?“)
ab, ohne den häufigen Fall zu verstecken.

#### 2026-11-02T12:13:49+0000: Doku für 0.1.11 (Datenverlust-Fix und Lagerstätten-Filter)

**By:** Maria (Technische Redakteurin / Dokumentationsspezialistin)

**What:**

Issue #289, Website-Doku auf Integrationsversion 0.1.11 (02.11.2026) gehoben. Geändert sind nur
`docs/features/fr008-ha-manager.md` und `CHANGELOG.md` (Abschnitt `## [Unreleased]`, jeweils
`(#289)`).

`docs/features/fr008-ha-manager.md`:

- Statuszeile auf 0.1.11; Versionsbeispiele im Drei-Punkte-Menü und in der Browser-Cache-Prüfung
  auf `v0.1.11`.
- Datenhaltung: Metadaten-Zeile von „HA-`Store`“ auf `frickeldave_store.data` umgestellt, Zeile für
  `backups/` ergänzt; Mermaid-Knoten heißt „Store-Datei“.
- Neuer Abschnitt „Persistenz und Datenverlust (bis 0.1.10)“ unter Datenhaltung: eigene,
  atomare Lese-/Schreiblogik im gleichen Envelope-Format, Migration über `data.schemaVersion`,
  Symptom, Ursache (`Store`-Cache der `.storage`-Dateiliste), Behebung, Sicherheitsnetze
  (`refuse_empty_overwrite`, Snapshots, lauter Fehler) und Regressionstests
  `tests/test_upgrade_paths.py` (0.1.7/0.1.8/0.1.9 → aktuell, 0 statt 3 Produkte auf dem alten Code).
- „Migrationen“ verweist auf `data.schemaVersion` statt Envelope-Version.
- „Aktualisierung und Browser-Cache“: Hinweis, dass Updates ab 0.1.11 den Katalog nicht mehr leeren.
- „Suche, Filter und Sortierung“: Lagerstätten-Auswahl filtert standardmäßig auf Bestand > 0
  (`in_location=true`), Checkbox „Auch Produkte ohne Bestand anzeigen“ (Standard aus) schaltet auf
  `in_location=false`; gewählte Lagerstätte zählt als aktiver Filter, der Opt-out allein nicht.
- „Backup und Wiederherstellung“: neuer Unterabschnitt „Wiederherstellung nach dem
  Datenverlust-Bug (bis 0.1.10)“ als abarbeitbare Sieben-Schritte-Anleitung (Update auf 0.1.11,
  Backup-Datei und `images/` entnehmen, HA stoppen, aktuelle Datei als
  `…data.vor-restore-<Datum>` sichern, Backup-Datei einspielen, HA starten, Produktanzahl und
  Stichprobenbild prüfen) samt Hinweis auf den automatischen `backups/<zeitstempel>-pre-save.json`.

`CHANGELOG.md` unter `## [Unreleased]`: je ein Eintrag unter Added (Doku 0.1.11), Changed
(Lagerstätten-Filter) und Fixed (Datenverlust bei jedem Update). Der bestehende 0.1.10-Eintrag
bleibt unverändert stehen.

Validierung: `npx markdownlint-cli@0.44.0 docs/features/fr008-ha-manager.md CHANGELOG.md` → nur die
beiden vorbestehenden Befunde im Abschnitt `[1.0.7]` (MD032 auf der `release:`-Zeile, MD022 vor
`### Fixed`), jetzt bei Zeile 54/55 statt 51/52; keine neuen Befunde, fremde Abschnitte nicht
umformatiert. `npm run prose` → 0 errors, 0 warnings, 0 suggestions in 104 files.
`npm run format:check` → „All matched files use Prettier code style!“ (prüft nur `./src`).

**Why:**

Der Fehler hat David bei jedem Update den Katalog gelöscht; ohne dokumentierte Ursache, Sicherheitsnetze
und Wiederherstellungsanleitung wäre die Wiederholung nur eine Frage der Zeit. Der Filtertext im
Dokument hätte ohne Anpassung weiter eine Filterung versprochen, die erst über die zweite Checkbox
aktiv war — genau die Diskrepanz, die Natasha im UI behoben hat. Beides ist versionsabhängiges
Verhalten und gehört damit in die Doku, nicht nur in den CHANGELOG.

#### 2026-11-02T12:13:49+0000: Release 0.1.11 veröffentlicht

**By:** Nick (DevOps / Infrastruktur)

**What:**

`0.1.11` ist als **kritischer Bugfix-Release sofort** veröffentlicht — ohne
Wartezeit auf den regulären prd-Deploy-Pfad.

- **Tag:** annotiert `0.1.11` → `f2d39fc32930eb1732ce770bdd56fd09fd14b831`
  (HEAD von `main`), Annotation „Frickeldave Store 0.1.11“.
- **Release:** https://github.com/Frickeldave/frickeldave.home.net/releases/tag/0.1.11
  — kein Draft, kein Pre-Release, **Latest**. Notes unverändert aus
  `CHANGELOG.md`, Abschnitt `## [0.1.11] - 2026-11-02`.
- **Inhalt:** Datenverlust beim Update behoben (`a61022d`), Lagerstätten-Filter
  standardmäßig nach Bestand > 0 (`f2d39fc`), Regressionstests in
  `tests/test_upgrade_paths.py` im Tag enthalten.
- **CI:** grün für `f2d39fc` —
  https://github.com/Frickeldave/frickeldave.home.net/actions/runs/41443333213
- **Ältere Releases** `0.1.8` / `0.1.9` / `0.1.10` unverändert.

**Why:**

`0.1.11` behebt einen Datenverlust: `HassStoreBackend` las den Katalog über
`homeassistant.helpers.storage.Store`, dessen `_StoreManager` nur
`<config>/.storage` kennt. Der Katalog liegt in
`<config>/frickeldave_store/`, `async_load()` lieferte `None` und der nächste
`async_save` überschrieb die echte Datei mit `"products": []`. Da HACS-Updates
einen HA-Neustart auslösen, trat der Fehler bei **jedem** Update auf —
betroffene Installationen haben bereits jetzt leere Kataloge. Jeder weitere Tag
auf `0.1.10` würde den Schaden bei weiteren Nutzern reproduzieren, deshalb
sofortige Veröffentlichung statt Einreihung in den normalen Deploy-Zyklus.

**Nutzer-Hinweis (in Release Notes enthalten):**

Bereits verlorene Daten lassen sich **nicht** durch das Update zurückholen. Nach
dem Update die Produkte **aus dem Home-Assistant-Backup zurückspielen** (HA
stoppen, `config/frickeldave_store/frickeldave_store.data` aus dem Backup
wiederherstellen, HA starten). Ab `0.1.11` legt der Store zusätzlich Snapshots
unter `config/frickeldave_store/backups/` an
(`*-pre-load-v*.json`, `*-pre-save.json`) und verweigert das Schreiben von null
Produkten ohne ausdrückliche Bestätigung. Details: `docs/backup-restore.md`.

#### 2026-11-02T12:35:45+0000: Badges an den Veröffentlichungs-Icons

**By:** Natasha (Frontend Developer / UI-Spezialistin)

**What:**

Issue #289, App-Bar des Store-Panels: Beide Veröffentlichungs-Buttons
(`_openPublish("dev")` / `_openPublish("prod")`) nutzen jetzt dasselbe
Branch-Split-Symbol; das Raketen-`<path>` des Prod-Buttons ist entfernt.
Unterschieden werden sie durch ein rein visuelles Kürzel in der unteren rechten
Ecke des 48-px-Buttons (`.fd-bar-badge`, `aria-hidden="true"`): „dev“ am
Dev-Button, „prd“ am Prod-Button. Größe 12 px hoch, `--ha-font-size-xs` (10 px),
Pill-Radius, Fläche `--fd-surface`, Text `--fd-text`, 1-px-Rahmen `--fd-divider`
— keine Rohfarbwerte, kein `innerHTML`. Die Badges bleiben innerhalb der
48 × 48 px, damit Klickziel, Fokusring und das horizontale Scrollen der
Aktionsgruppe auf schmalen Viewports nichts abschneiden; im `disabled`-Zustand
werden sie über die Button-Opacity (0.38) mitgedämpft, nicht ausgeblendet.
Für das Scroll-Verhalten auf ≤ 640 px bekam `.fd-bar-actions` `padding-block:
5px; margin-block: -5px`, damit der 2-px-Fokusring samt 2-px-Offset nicht
beschnitten wird. Zugänglichkeit unverändert: `aria-label`/`title` heißen
weiter „Nach dev veröffentlichen“ bzw. „Nach prod veröffentlichen“, der Badge
wird von Screenreadern ignoriert.

**Why:**

Der Nutzerwunsch war ausdrücklich „beide Symbole gleich, Unterschied über ein
Badge dev/prd“. Ein Badge ist reine Dekoration — die Bedeutung muss im
zugänglichen Namen stehen, sonst liest ein Screenreader „dev dev“ vor und
Tastatur-/Sprachnutzer verlieren die Unterscheidung. Die Beschriftung trägt die
Information, nicht die Farbe (WCAG 1.4.1). Ein überstehender Badge hätte im
horizontal scrollenden Container (`overflow-x: auto`) abgeschnitten werden
können und den Fokusring überdeckt; die Variante innerhalb der Button-Fläche
vermeidet beides ohne Einbußen beim Touch-Ziel. Regressionstest
`tests/test_frontend_assets.py::test_publish_buttons_share_icon_and_differ_by_badge`
hält Icon-Gleichheit und Badge-Texte fest.

#### 2026-11-02T12:54:51+0000: Sortierschlüssel und Artikelnummer-Vorschlag

**By:** Bruce (Backend / Scripts / Komponenten)

**What:**

Issue #289, `frickeldave.home.net` (Commit `1b7d63f`, `main`). Zwei Ergänzungen
am Backend der Integration `frickeldave_store`:

1. **Sortierung.** `sort` kennt neben `name` und `price` jetzt `category`, `stock`
   und `status` (`SORT_KEYS` in `products.py`); HTTP- und WebSocket-API nutzen
   denselben `ProductFilter` und akzeptieren die Werte damit automatisch. Die
   Fehlermeldung nennt alle erlaubten Werte:
   `sort muss 'name', 'price', 'category', 'stock' oder 'status' sein.`
   - `category`: nach dem **sichtbaren Label** (alphabetisch, casefold):
     3D-Druck, Epoxidharz, Holz, Laser, Steinmasse — also `WO` (Holz) vor `LA`
     (Laser), nicht Rohcode-Reihenfolge. Unbekannte Codes (Altbestände) landen
     hinter allen bekannten Kategorien und sind dort nach Rohcode stabil.
   - `stock`: nach **Gesamtbestand** (`Product.total_stock()`, Summe aller
     Lagerstätten) und damit unabhängig von `location`/`in_location`.
   - `status`: `(archived, not visible)` als Schlüssel, also **aktiv vor
     archiviert**, innerhalb aktiv **sichtbar vor unsichtbar**. Die
     Sichtbarkeit bleibt als zweites Kriterium auch bei archivierten Produkten
     stehen (schadet nicht, hält die Reihenfolge aber in jeder Kombination
     deterministisch).
   - Tiebreaker: bei `category`/`stock`/`status` Name (casefold), dann
     Artikelnummer; bei `name`/`price` wie bisher nur die Artikelnummer.

2. **Artikelnummer-Vorschlag.** `GET /api/frickeldave_store/products/article-number?category=LA`
   (Recht `product`) antwortet
   `{"articleNumber": "LAH3K3", "category": "LA", "reserved": false}`. Die Nummer
   entsteht über `generate_article_number(category)` (Kategoriepräfix +
   Zufallszeichen, 6 Zeichen) und wird gegen `store.article_numbers()` geprüft —
   das umfasst **auch archivierte** Produkte. Unbekannte oder fehlende Kategorie
   → `ValidationError` (400, `validation_error`) aus der bestehenden
   Kategorievalidierung. Die Route ist in `VIEWS` **vor** `ProductView`
   registriert; aiohttp matcht in Registrierungsreihenfolge, der statische Pfad
   gewinnt also gegen `/products/{article_number}`.

**Why:**

- **Kategorie nach Label, nicht nach Rohcode:** die Rohcodes (`3D`, `EP`, `LA`,
  `SB`, `WO`) sind Zufallskürzel; eine Sortierung danach wirkt für Nutzer
  willkürlich. Labels sind das, was im Panel sichtbar ist. Alphabetisch nach
  Label ist die Erwartung an eine Sortierfunktion und bleibt stabil, wenn später
  Kategorien dazukommen (keine Pflege einer Ordnungsliste nötig).
- **Bestand als Gesamtsumme:** die Liste zeigt je Produkt den Gesamtbestand; eine
  Sortierung nach der gerade gefilterten Lagerstätte würde bei aktivem Filter
  anders ordnen als die angezeigten Zahlen und wäre nicht nachvollziehbar. Die
  Summe ist unabhängig vom Filter reproduzierbar.
- **Status-Reihenfolge aktiv/sichtbar zuerst:** die Standardansicht zeigt aktive,
  sichtbare Produkte — die „normalen“ Einträge stehen damit oben, Sonderfälle
  (unsichtbar, archiviert) sammeln sich unten, statt die Liste zu durchmischen.
- **Tiebreaker bei `desc` bewusst korrigiert:** bisher drehte `reverse=True` auch
  die Artikelnummer mit, gleiche Namen/Preise waren in `asc` und `desc`
  gegenläufig sortiert. Jetzt wird zweistufig sortiert (erst Tiebreaker
  aufsteigend, dann Hauptkriterium mit `reverse`), sodass `desc` ausschließlich
  das Hauptkriterium dreht. Das ist eine bewusste Verhaltensänderung für
  `name`/`price` (Dokumentreihenfolge bei Gleichstand), bestehende Tests bleiben
  gültig, weil sie keine Tiebreaker-Richtung bei `desc` festhielten.
- **Vorschlag reserviert nicht:** eine Reservierung bräuchte einen
  Lebenszyklus (TTL, Aufräumen, Konflikte bei abgebrochenen Dialogen) und würde
  bei mehreren geöffneten Dialogen Nummern verbrauchen. Da die Nummer erst beim
  Speichern verbindlich ist, bleibt `POST /products` maßgeblich: kollidiert der
  Vorschlag in der Zwischenzeit, erzeugt der Server eine andere Nummer und die
  Antwort von `POST` enthält die tatsächlich vergebene. Der Client muss also die
  Nummer aus der POST-Antwort übernehmen, nicht die angezeigte Vorschau
  festschreiben.
- **Routen-Vorrang geprüft:** `tests/test_views.py::test_article_number_route_wins_over_product_route`
  baut die echte aiohttp-Route-Tabelle in `VIEWS`-Reihenfolge auf und prüft, dass
  `/products/article-number` auf die statische Ressource und
  `/products/LA3K3X` auf `{article_number}` matcht.

**Für Frontend (Natasha):** `GET /products/article-number?category=<code>` liefert
`{"articleNumber", "category", "reserved"}`; nach `POST /products` die
`articleNumber` aus der Antwort übernehmen. `sort=category|stock|status` sind
zusätzlich erlaubt, `order=desc` dreht nur das Hauptkriterium. Keine
`frontend/*.js`-Änderung in diesem Commit.

#### 2026-11-02T13:30:51+0000: Sortier-Umschalter in der Filterleiste bleibt — synchron zu den Spaltenköpfen

**By:** Natasha (Frontend Developer / UI-Spezialistin)

**What:**

Issue #289, Produktliste. Die fünf Datenspaltenköpfe (`Produkt`, `Kategorie`,
`Preis`, `Bestand`, `Status`) sind jetzt echte Buttons in den `<th>`-Zellen mit
`aria-sort` (`ascending`/`descending`/`none`) und einem `aria-label` aus
Spaltenname und aktueller Richtung. Erster Klick auf eine neue Spalte sortiert
aufsteigend, erneuter Klick dreht nur die Richtung. `Aktionen` bleibt
unsortierbar und trägt kein `aria-sort`. Der Seitenoffset wird bei jedem
Sortierwechsel zurückgesetzt.

Der bestehende Sortier-Umschalter in der Filterleiste (`<select>` +
Richtungs-Button) bleibt erhalten, wird aber auf dieselben fünf Felder
erweitert und liest/schreibt ausschließlich `_sort`/`_order` — es gibt keinen
zweiten Zustand. Der Richtungs-Button nennt das aktive Feld im `aria-label`
(„Sortierrichtung für Preis: aufsteigend. Richtung wechseln.“), und ein Hinweis
unter der Auswahl erklärt, dass in der Listenansicht auch die Spaltenköpfe
sortieren.

**Why:**

Der Umschalter ist in der Kachelansicht die einzige Möglichkeit, Sortierfeld
und -richtung zu ändern — dort gibt es keine Spaltenköpfe. Ihn zu entfernen
hätte die Sortierung in einer von zwei Ansichten unbrauchbar gemacht. Da beide
Bedienelemente denselben Zustand verwenden, können sie nicht widersprüchliche
Anzeigen erzeugen; der `aria-sort`-Wert der Köpfe und der Text des Buttons
leiten sich aus derselben Quelle ab. Eine zusätzliche Zustandskopie (z. B.
eigener Spaltensortier-State) wäre die eigentliche Redundanz gewesen.

#### 2026-11-02T13:30:51+0000: „Weiter“-Semantik im Produktdialog (Anlegen beim ersten Schritt)

**By:** Natasha (Frontend Developer / UI-Spezialistin)

**What:**

Issue #289, Produktdialog des Store-Panels. Beim Anlegen heißt der Footer-Button
auf `Grunddaten`, `Bilder` und `Beschreibung` jetzt „Weiter“ und wechselt zum
nächsten Tab; auf `Bestand` heißt er „Speichern“ und schließt den Dialog. Damit
Bilder im Tab `Bilder` überhaupt hochgeladen werden können (die Bild-API braucht
ein existierendes Produkt), legt „Weiter“ auf `Grunddaten` das Produkt per
`POST /products` an und wechselt danach in den Bearbeiten-Modus. Der Editor
führt dafür zwei getrennte Marken: `editor.mode` (`create` nur bis zum ersten
POST, danach `edit`) und `editor.createFlow` (bleibt für den gesamten
Anlege-Ablauf `true`). Die Button-Beschriftung hängt an `createFlow` +
`tab === "stock"`, nicht an `mode` — sonst würde nach dem Anlegen wieder
„Speichern“ erscheinen und den Dialog schließen.

Auf den Folgetabs speichert „Weiter“ die Änderungen und wechselt weiter. Die
Bestands-API des Panels nutzt `PATCH /products/{articleNumber}` (nicht `PUT`);
dieses Verhalten bleibt unverändert, damit die bestehende Teil-Update-Semantik
erhalten bleibt. Nach dem Anlegen übernimmt das Badge die `articleNumber` aus
der Server-Antwort, ein laufender Vorschau-Request wird über
`_articlePreviewRequestId` verworfen. Validierungsfehler verhindern den
Tabwechsel, wechseln auf den Tab des ersten fehlerhaften Feldes
(`EDITOR_FIELD_TABS`) und fokussieren das Feld. Ein Hinweis im Footer stellt
klar, dass das Produkt nach dem ersten Schritt bereits gespeichert ist und
„Schließen“ nur den Dialog beendet. Im reinen Bearbeiten-Modus bleibt der
Footer unverändert bei „Speichern“.

**Why:**

Ohne verbindliche Artikelnummer kann die Bild-API nicht angesprochen werden;
jeder andere Weg hätte einen zweiten Dialog oder ein temporäres Produkt
gebraucht. Das Anlegen beim ersten Schritt ist der kleinste Ablauf, der die
vorgegebene Tab-Reihenfolge (Grunddaten → Bilder → Beschreibung → Bestand)
einhält und Bilder direkt nach dem Anlegen ermöglicht. Die Trennung von `mode`
und `createFlow` verhindert einen Zustandsfehler genau an der Stelle, an der
das Produkt schon existiert, der Nutzer aber noch im Anlege-Ablauf ist. Der
Footer-Hinweis verhindert die falsche Erwartung „Abbrechen = nichts
gespeichert“ — das Produkt ist ab dem ersten „Weiter“ real vorhanden.

#### 2026-11-02T13:30:51+0000: Katalogimport mit Dry-Run und Überschreiben

**By:** Bruce (Backend / Scripts / Komponenten)

**What:**

Issue #289, `frickeldave.home.net` (Basis `8c209f2`, `main`). Der bestehende
Endpunkt `POST /api/frickeldave_store/import/catalog` erhält zwei optionale
Body-Felder, beide Standard `false`:

| Feld | Typ | Default | Wirkung |
| --- | --- | --- | --- |
| `dry_run` | bool | `false` | Katalog wird geladen und geprüft, aber nichts geschrieben; Antwort ist die Vorschau |
| `overwrite` | bool | `false` | vorhandene, nicht archivierte Produkte werden mit dem Katalogstand überschrieben |

Nicht-boolesche Werte → `ValidationError` (400, `validation_error`) mit
`dry_run muss ein Wahrheitswert sein.` bzw. `overwrite muss ein Wahrheitswert sein.`
Die Allowlist der erlaubten Felder umfasst jetzt
`source_url`, `image_base_url`, `import_images`, `dry_run`, `overwrite`; alles
andere bleibt „Unbekannte Felder: …“.

**Antwortvertrag** (`ImportResult.to_dict()`):

| Feld | Typ | Bedeutung |
| --- | --- | --- |
| `created` | int | tatsächlich neu angelegte Produkte |
| `skipped` | int | vorhandene Produkte, die unverändert bleiben (inkl. archivierter und inhaltsgleicher) |
| `failed` | int | ungültige Produkte bzw. doppelte Artikelnummern im Dokument |
| `images_imported` | int | in diesem Lauf geschriebene Bilddateien; im Dry-Run die Zahl, die geschrieben würde |
| `products_total` | int | Produkte im gelieferten Dokument |
| `errors` | list | `{"articleNumber", "message"}` je Fehler |
| `dry_run` | bool | ob es eine Vorschau war |
| `would_create` | int | nur Dry-Run: würde angelegt |
| `would_overwrite` | int | nur Dry-Run: würde überschrieben (Inhalt weicht ab) |
| `overwritten` | int | nur echter Lauf: tatsächlich überschrieben |
| `unchanged` | int | nur Dry-Run: vorhandene Produkte, die unverändert blieben (== `skipped`) |
| `summary` | str | deutsche Zusammenfassung |

Ohne `dry_run`/`overwrite` bleiben `created`, `skipped`, `failed`,
`images_imported`, `products_total` und `errors` exakt wie bisher; die neuen
Zähler sind dann `0`. Bestehende Aufrufer (Panel, Skripte) funktionieren
unverändert; nur exakte Dict-Vergleiche in zwei Tests wurden um die neuen
Schlüssel ergänzt.

**Schreibfreiheit im Dry-Run (strukturell):**

1. `async_import_catalog` baut zuerst einen `ImportPlan` (nur Lesezugriffe:
   `article_numbers()`, `get_raw_product()`, `location_ids()`). Es gibt keinen
   Schreibaufruf im Planungspfad.
2. Store-Änderungen existieren ausschließlich in `_async_apply_plan` (unter
   `store.lock`, `put_product`, `add_tag`, `async_save`). Diese Funktion wird nur
   aufgerufen, wenn `dry_run` falsch ist.
3. Bildschreiben läuft über einen expliziten `sink`. Im Dry-Run wird
   `sink=None` übergeben; `_async_product_images` prüft Bildsignatur und Größe,
   ruft aber kein `async_write` auf. Ohne Sink existiert kein Schreibziel.
4. Snapshot und `updatedAt` entstehen ausschließlich in `CatalogStore.async_save`;
   ohne `_async_apply_plan` wird `async_save` nie erreicht.
5. Netzwerkzugriff bleibt erlaubt und nötig: Katalog und (bei `import_images`)
   Bilder werden auch im Dry-Run geladen, damit die Vorschau die realen
   Bildzahlen zeigt.

Nachweis: `tests/test_importer.py::test_dry_run_writes_nothing_and_reports_full_preview`
hasht vor/nach dem Dry-Run **jede** Datei unter dem Datenordner (Store-Datei,
Bilder, Snapshots) per SHA-256 und prüft zusätzlich, dass für ein neues Produkt
kein Bildverzeichnis entsteht und ein frisch geladener Store den alten Stand
zeigt. `test_dry_run_without_overwrite_never_proposes_overwrites` und
`test_dry_run_reports_archived_products_as_unchanged` prüfen dasselbe für die
beiden anderen Vorschau-Varianten.

**Feld-Übernahmeregeln beim Überschreiben** (`OVERWRITE_FIELDS` in
`importer.py`, zentrale Stelle `_merge_catalog_product`):

| Feld | Quelle | Begründung |
| --- | --- | --- |
| `name`, `description`, `price`, `size`, `tags`, `visible`, `customizable`, `stock`/`salesCabinet` | Katalog | fachlich im Website-Katalog gepflegt |
| `articleNumber` | lokal | stabiler Primärschlüssel, Bilder/Buchungen hängen daran |
| `createdAt` | lokal | Anlagezeitpunkt im Store bleibt erhalten |
| `updatedAt` | Zeitpunkt des Überschreibens | `put_product` setzt ihn |
| `images` | lokal, nur Ergänzung | bestehende Bilder werden nicht gelöscht; fehlende Indizes 01…10 werden nachgeladen, bereits belegte Indizes nicht erneut geholt |
| `archived` | lokal | archivierte Produkte werden übersprungen, nie reaktiviert |
| Buchungen (`bookings`) | bleiben | separater Speicher, wird nicht angefasst |
| `category` | **lokal** | bewusste Ausnahme: die Artikelnummer kodiert die Kategorie, und `validate_update_payload` behandelt sie als unveränderlich. Ein Katalogwechsel der Kategorie würde die Nummer entwerten; das Produkt bleibt deshalb in seiner lokalen Kategorie. |
| `schemaVersion` | aktuell | Normalisierung auf das Store-Schema |

Ein Produkt gilt nur dann als überschreibbar, wenn sich mindestens eines der
Katalogfelder (ohne Kategorie) vom lokalen Stand unterscheidet
(`_catalog_signature`; Tags case-insensitiv, Bestand je Lagerstätte). Inhaltsgleiche
Produkte zählen als `skipped` und werden nicht geschrieben — ein zweiter Lauf mit
`overwrite` ist damit idempotent und lässt `updatedAt` unverändert.

Bestände: der Katalogwert ersetzt den lokalen Bestand. Die Buchungshistorie bleibt
erhalten und kann dadurch vom neuen Bestand abweichen; das ist die vom Nutzer
gewünschte Semantik („Katalogstand übernehmen“), wird aber in README und
`docs/data-model.md` ausdrücklich benannt.

**Rechteentscheidung: `overwrite` bleibt bei Rolle `product`.** Überschreiben ist
kein neuer Berechtigungsumfang, sondern ein Sammel-Update auf genau die Felder,
die `product` über `PATCH /products/{article_number}` bereits einzeln ändern darf
(Name, Beschreibung, Preis, Größe, Tags, Sichtbarkeit, Personalisierbarkeit,
Bestand). Ein `app_admin`-Zwang würde die tägliche Katalogpflege ohne
Sicherheitsgewinn blockieren. Die bestehenden Schutzlinien bleiben: eigene
`source_url`/`image_base_url` erfordern weiterhin `app_admin`, es gibt keinen
Hard-Delete-Pfad, und `CatalogStore.async_save` legt vor dem ersten Schreiben
einen Snapshot an. `dry_run` ändert die Rechte ohnehin nicht, weil es nichts
schreibt.

**Why:**

- **Vorschau vor dem Import:** der Import kann hunderte Produkte und Bilder
  anfassen. Eine Vorschau mit `would_create`/`would_overwrite`/`unchanged` macht
  die Wirkung vorab sichtbar, ohne dass ein Fehlgriff Daten kostet.
- **Überschreiben auswählbar, Standard aus:** das bisherige Verhalten bleibt der
  Default; niemand verliert durch ein Update unerwartet lokale Änderungen. Wer
  den Katalog als Quelle der Wahrheit will, entscheidet das pro Lauf.
- **Strukturelle statt nachgelagerte Schreibsperre:** ein „am Ende nicht
  speichern“ würde Bilddateien und Snapshots trotzdem anlegen. Die Trennung in
  Plan (nur lesend) und Apply (nur schreibend) plus `sink=None` macht den
  Dry-Run prüfbar und verhindert Seiteneffekte unabhängig vom weiteren Code.
- **Artikelnummer/Kategorie stabil:** Artikelnummern sind der Bezug für Bilder,
  Buchungen und Export; eine Änderung würde Verweise brechen. Die Kategorie ist
  zudem laut Produktvalidierung unveränderlich.
- **Archiv bleibt Archiv:** ein Import darf keine bewusst stillgelegten Produkte
  wieder sichtbar machen. Sie werden als `skipped` gemeldet (in der Vorschau
  unter `unchanged`) und in der `summary` separat ausgewiesen.
- **Bilder nur ergänzen:** lokale Bildpflege (Reihenfolge, Hauptbild, Uploads)
  ist wertvoller als ein erneuter Katalogabruf; Löschen wäre nicht umkehrbar.
- **Zähler getrennt:** `created` und `overwritten` sind fachlich verschieden; der
  Nutzer soll in der Antwort sehen, wie viele Produkte neu sind und wie viele
  bestehende Daten ersetzt wurden.

**Summary-Beispiele:**

```
Vorschau: 63 Produkte im Katalog, 2 neu, 3 zu überschreiben, 58 unverändert,
0 fehlerhaft, 4 Bilder würden importiert. Es wurde nichts geschrieben.

Import abgeschlossen: 2 neu angelegt, 3 überschrieben, 58 unverändert,
0 fehlerhaft, 4 Bilder importiert. Davon archiviert und übersprungen: 1.
```

**Für Frontend (Natasha):** Vor dem Import `{"dry_run": true}` senden und
`would_create`/`would_overwrite`/`unchanged` plus `summary` anzeigen; die
Überschreiben-Checkbox ist standardmäßig aus und sendet `overwrite: true` nur,
wenn der Nutzer sie aktiviert. Nach dem Lauf `created`, `overwritten`, `skipped`,
`failed` und `images_imported` getrennt darstellen — `overwritten` ist neu.
Fehler kommen als `{"error": {"code", "message"}}` mit deutscher Meldung; die
Vorschau selbst kann `errors` je Artikelnummer enthalten, ohne dass der Lauf
scheitert.

#### 2026-11-02T13:30:51+0000: Import-Dialog warnt sachlich vor dem Überschreiben

**By:** Natasha (Frontend Developer / UI-Spezialistin)

**What:**

Issue #289, Katalogimport-Dialog. Beim Öffnen läuft automatisch ein Dry-Run
(`{"dry_run": true}`); angezeigt werden `would_create`, `would_overwrite`,
`unchanged`, `failed`, `images_imported` und die `summary`. Die neue Checkbox
„Bestehende Produkte überschreiben“ ist standardmäßig aus; der Hinweis darunter
sagt korrekt: „Standardmäßig aus. Vorhandene Produkte bleiben dann unverändert.“
Damit ist die frühere Aussage „wird niemals überschrieben“ ersetzt, die mit der
neuen Option falsch geworden wäre.

Erst bei aktiver Checkbox erscheint ein Warnbanner (Icon + Text, nicht nur
Farbe): überschrieben werden Name, Beschreibung, Preis, Größe, Tags,
Sichtbarkeit, Personalisierbarkeit und Bestand; erhalten bleiben Artikelnummer,
Anlagedatum, Bilder, Buchungen, Archiv-Status und Kategorie. Beim Umschalten
wird die Vorschau mit `{"dry_run": true, "overwrite": true}` neu geladen, damit
die Zahlen zur gewählten Option passen. Der Bestätigungs-Button startet den
echten Import mit `dry_run: false` und dem gewählten `overwrite`; das Ergebnis
zeigt `created`, `overwritten`, `skipped`, `failed`, `images_imported` und die
Fehlerliste je Artikelnummer. Während Vorschau oder Import läuft, sind
Bestätigungs-Button und Schließen gesperrt (`busy`/`previewLoading`), damit
Doppelklicks keinen zweiten Lauf starten. API-Fehler erscheinen als deutsche
Meldung im offenen Dialog, die Vorschau hat einen eigenen Fehlerzustand mit
„Vorschau erneut laden“.

**Why:**

Die Vorschau zeigt nur dann die Wahrheit, wenn sie mit denselben Optionen
läuft wie der spätere Import — sonst verspräche „0 zu überschreiben“ etwas,
das der Import nicht hält. Die Warnung muss die Felder nennen, weil
„überschreiben“ allein offen lässt, ob Artikelnummer oder Bilder verloren
gehen; genau diese Angaben stehen auch in der Server-Dokumentation. Ein Banner
statt einer roten Checkbox erfüllt „nicht nur Farbe“ und bleibt in Light und
Dark über HA-Tokens lesbar.

#### 2026-11-02T13:30:51+0000: Dokumentation 0.1.12 im Website-Repository

**By:** Maria (Technische Redakteurin / Dokumentationsspezialistin)

**What:**

Issue #289, Branch `feat/issue-289-management-tool-in-homeassistant` (Draft-PR
#296 gegen `dev`). Dokumentiert ist die Integration `frickeldave_store` in
Version `0.1.12` (02.11.2026). Geändert wurden ausschließlich zwei Dateien:

- `docs/features/fr008-ha-manager.md`
  - Statuszeile und die beiden Build-Beispiele auf `0.1.12` / `v0.1.12`
    gehoben; historische Aussagen „seit 0.1.10/0.1.11“ bleiben unverändert.
  - `Veröffentlichen`: beide Topbar-Buttons tragen dasselbe Branch-Symbol,
    unterschieden durch das Badge `dev` bzw. `prd`; Screenreader-Text und
    Tooltip nennen weiterhin das Ziel. Die frühere Rakete ist entfernt.
  - Neuer Abschnitt `Sortierung` unter `Produktpflege im Panel`: klickbare
    Spaltenköpfe Produkt, Kategorie, Preis, Bestand, Status samt
    Zuordnung, `aria-sort`, Aufsteigend/`desc`-Regel und Gleichständen
    (Name, Artikelnummer). Der Umschalter in der Filterleiste bleibt für die
    Kachelansicht, bietet alle fünf Felder und teilt den Zustand.
  - `Produktdialog`: vier Tabs in der Reihenfolge Grunddaten → Bilder →
    Beschreibung → Bestand, Feldumfang je Tab, Artikelnummern-Badge statt
    Untertitel, Live-Vorschlag über
    `GET /api/frickeldave_store/products/article-number?category=<Code>`
    mit Platzhaltern, „Weiter“/„Speichern“-Ablauf, Validierungssperre und
    Hinweis nach dem Anlegen.
  - Neuer Abschnitt `Katalogimport`: automatischer Dry-Run beim Öffnen,
    Zählungen und deutsche Zusammenfassung, Checkbox „Bestehende Produkte
    überschreiben“ (Standard aus) mit Warnbanner und `overwrite`-Neuladen,
    überschriebene gegenüber erhaltenen Feldern, Importergebnis samt
    Fehlerliste je Artikelnummer.
  - Datenmodell: Verweis von der Importquelle auf den neuen Abschnitt.
- `CHANGELOG.md`, unter `## [Unreleased]`: vier `Added`-Einträge
  (Sortierspalten, Katalogimport, Artikelnummern-Badge, 0.1.12-Doku) und drei
  `Changed`-Einträge (Produktdialog-Ablauf, Sortier-Umschalter,
  Veröffentlichungs-Icons). Der bestehende `Changed`-Eintrag zu den
  Veröffentlichungs-Icons und der `Added`-Eintrag zum Produktdialog wurden auf
  den 0.1.12-Stand gezogen, damit der Unreleased-Block sich nicht selbst
  widerspricht. Alle neuen und geänderten Einträge tragen `(#289)`.

Nicht committet.

**Why:**

Die Website ist die Nutzerdokumentation des Werkzeugs; ohne 0.1.12-Stand
beschreibt sie eine Oberfläche, die es nicht mehr gibt (Rakete,
Drei-Tab-Dialog, „Artikelnummer …“-Untertitel, Sortierung nur nach Name und
Preis). Die Sortier- und Importdetails sind verhaltensrelevant und deshalb
explizit dokumentiert: Bestand sortiert über alle Lagerstätten unabhängig vom
Filter, `desc` dreht nur das Hauptkriterium, und der Import schreibt ohne
`overwrite` nichts und überschreibt nie Artikelnummer, Anlagedatum, Bilder,
Buchungen, Archiv-Status oder Kategorie. Ältere Einträge im selben
Unreleased-Block zu korrigieren verhindert widersprüchliche Release-Notes beim
Promote. Validierung: `npx markdownlint-cli@0.44.0 docs/features/fr008-ha-manager.md
CHANGELOG.md` → nur die zwei vorbestehenden Baseline-Befunde `MD032` und
`MD022` im Abschnitt `[1.0.7]` (jetzt Zeilen 60/61, vorher 54/55); `npm run
prose` → 0 Fehler, 0 Warnungen, 0 Hinweise in 104 Dateien; `npm run
format:check` → „All matched files use Prettier code style!“. Keine Secrets,
keine Token-Werte. Offen: PR-Beschreibung und Review durch Tony.

#### 2026-11-02T13:30:51+0000: Release 0.1.12 veröffentlicht

**By:** Nick (DevOps / Infrastruktur)

**What:**

Issue #289, `Frickeldave/frickeldave.home.net`. Version `0.1.12` ist als
annotierter Tag und als GitHub-Release veröffentlicht.

- **Tag:** `0.1.12`, annotiert, Tag-Objekt `2961f30`, zeigt auf Commit
  `1d1b295cbea896fa1c84ff274be1ac14a2041e64` (`git rev-parse main`, `main`).
  Annotation: `Frickeldave Store 0.1.12`. Gepusht mit `git push origin
  refs/tags/0.1.12`; `1d1b295` blieb unverändert (kein Commit, kein Push auf `main`).
- **Release:** `gh release create 0.1.12 --title 0.1.12 --verify-tag`, kein Draft,
  kein Pre-Release, Latest (`gh api .../releases/latest` → `0.1.12`).
  URL: https://github.com/Frickeldave/frickeldave.home.net/releases/tag/0.1.12
- **Notes:** Abschnitt `## [0.1.12] - 2026-11-02` aus `git show
  1d1b295:CHANGELOG.md` (Zeilen 9–96) unverändert übernommen, inklusive
  Markdown-Struktur (`### Added`, Listen, Backticks). Unterschied zum
  Changelog-Text ist nur die von der API ergänzte Leerzeile am Ende.
- **HACS-Prüfungen am Tag:** `custom_components/frickeldave_store/manifest.json`
  → `"version": "0.1.12"`; `hacs.json` vorhanden;
  `custom_components/frickeldave_store/publish.py` vorhanden (26.474 Bytes). CI-Job
  „HACS validation“ im Lauf zu `1d1b295` grün.
- **Ältere Releases:** `0.1.8`, `0.1.9`, `0.1.10`, `0.1.11` unverändert — gleiche
  `publishedAt`-Zeitstempel wie vor der Veröffentlichung, weiterhin kein Draft und
  kein Pre-Release; `0.1.11` hat den `Latest`-Marker planmäßig an `0.1.12` abgegeben.
- **CI:** Lauf zu `1d1b295` grün (Ruff, hassfest, Frontend, HACS validation, mypy,
  pytest):
  https://github.com/Frickeldave/frickeldave.home.net/actions/runs/41456123525

**Why:**

Das Release schließt die Kette zu Issue #289 ab: Der Stand `1d1b295` enthält alle
in `0.1.12` dokumentierten Änderungen (gemeinsames Publish-Symbol mit
dev/prd-Badges, Sortierschlüssel `category`/`stock`/`status`, Artikelnummer-
Vorschau, Katalogimport mit Dry-Run und Überschreiben, sortierbare Spaltenköpfe,
überarbeiteter Produktdialog) und ist CI-grün. Der annotierte Tag macht den
Release-Zeitpunkt reproduzierbar und die Herkunft eindeutig; Changelog-Notes
unverändert zu übernehmen hält Release-Beschreibung und Repository-Changelog
deckungsgleich. Die Prüfung der älteren Releases stellt sicher, dass die
Veröffentlichung keine Historie umgeschrieben hat (keine bestehenden
Tags/Releases verändert, `Latest` nur weitergereicht).

#### 2026-11-02T14:21:10+0000: Veröffentlichen-Fehler eingegrenzt

**By:** Bruce (Backend / Scripts / Komponenten)

**What:**

Ursache belegt (Davids Traceback, `publish.py:552` → `publish.py:408`):

```
File ".../publish.py", line 552, in async_publish
    tree = await client.async_read_tree()
File ".../publish.py", line 408, in async_read_tree
    head_sha = str((ref.get("object") or {}).get("sha", ""))
AttributeError: 'NoneType' object has no attribute 'get'
```

`GitHubClient._async_json` verwarf den Antwort-Body bei
`if response.status == 204 or not response.content_length:`. Bei
`Transfer-Encoding: chunked` ist `content_length` `None`, `not None` ist `True` –
die Methode gab also bei HTTP 200 `None` zurück. GitHub liefert REST-Antworten
regelmäßig chunked, deshalb scheiterte schon der erste Aufruf
`GET git/ref/heads/dev`, noch vor Commit, Workflow-Dispatch oder Store-Zugriff.
Der `AttributeError` war keine `StoreError` und wurde von `PublishView` nicht
übersetzt: aiohttp lieferte ein nacktes 500 ohne unser Fehlerformat, das Panel
zeigte den Fallback „Der Server hat einen Fehler gemeldet.“. Betroffen war der
komplette Lesepfad, also auch der Dry-Run, seit der Einführung der
GitHub-Daten-API (0.1.9).

Warum die Tests das nicht fanden: `FakeGitHub` in `tests/test_publish.py`
umgeht HTTP vollständig, und `FakeHTTPResponse` setzte `content_length` auf
`2`/`0` – nie `None`. Der chunked-Fall war damit unsichtbar.

Fix (Version 0.1.13):

1. `_async_json` liest den Body immer (`response.read()`), prüft zuerst den
   Status, gibt nur bei 204/205/304 oder leerem Body `None` zurück und parst
   sonst `json.loads(raw)`. Ungültiges JSON → `GitHubError`
   (`github_unavailable`); 5xx von GitHub ebenfalls `github_unavailable`.
2. `_as_mapping` sichert Branch, Commit, Baum und Blob ab: unerwartete
   Antwortformen ergeben `GitHubError` statt `AttributeError`.
3. `PublishView` (und `CatalogImportView`) fangen unerwartete Exceptions,
   loggen den Traceback mit `_LOGGER.exception` und antworten mit
   `500 internal_error` plus deutscher Meldung (Verweis auf das HA-Protokoll).
4. `build_artifacts` meldet fehlende/unlesbare Bilddateien gesammelt als
   `409 publish_artifacts_unavailable` (vorher stilles Überspringen bzw.
   `PermissionError` als 500); `async_commit` wirft bei fehlendem Artefakt
   denselben fachlichen Fehler statt `KeyError`.
5. Leerer Katalog (0 veröffentlichbare Produkte, auch „nur archiviert“) ist
   gesperrt: Veröffentlichen → `409 publish_empty_catalog`, kein Commit.
   Dry-Run liefert weiter eine Vorschau, setzt aber `warning` (string|null) und
   ergänzt die `summary`. Notausgang: Body-Feld `allow_empty` (bool, Default
   `false`), nur über `POST /publish` mit `app_admin`; auch dann bleibt
   `warning` gesetzt. `publish_settings_from_store` verkraftet defekte
   Settings-Strukturen (`PublishNotConfigured` statt `AttributeError`).
6. Jede Publish-Antwort enthält jetzt `warning` (`string|null`, bei normalem
   Katalog `null`).

**Why:**

Ein leerer Antwort-Body wurde als „kein Inhalt“ fehlinterpretiert; der
resultierende `AttributeError` lag außerhalb jeder fachlichen Fehlerbehandlung
und machte die Veröffentlichung unbenutzbar, ohne verwertbare Meldung. Der Fix
behebt die Ursache (Body immer lesen), macht verbleibende Überraschungen
sichtbar (`internal_error` mit Traceback) und verhindert, dass ein leerer Store
nach einem Datenverlust den Website-Katalog löscht. Der Notausgang bleibt
bewusst eng: explizites `allow_empty`, nur für `app_admin`, mit sichtbarem
Warnhinweis.

#### 2026-11-02T14:53:17+0000: Publish-Warnungen im Panel

**By:** Natasha (Frontend-Entwicklerin / UI-Spezialistin)

**What:**

Panel `frontend/frickeldave-store-panel.js`, Publish-Dialog (#289, Version
bleibt 0.1.13):

1. `normalizePublishResult` übernimmt das neue Feld `warning` als
   `typeof payload.warning === "string" ? payload.warning : ""`. Der Hinweis
   erscheint als Warnblock (Symbol aus der bestehenden Banner-Maske plus Text)
   im Dialog oberhalb der Bestätigung — also vor Ergebnisdetails und Footer —
   und nach einem erfolgreichen Lauf zusätzlich im Ergebnis und im Toast.
2. `publish_empty_catalog` setzt im Dialog die Zustände `emptyCatalog: true`
   und `allowEmpty: false`. Der Dialog zeigt zuerst den Alert
   „Veröffentlichung abgelehnt.“ mit der deutschen Server-Meldung und dem
   Hinweis, dass die Website danach keine Produkte mehr zeigt. Darunter steht
   der Bestätigungsschritt „Leeren bestätigen“ mit der Checkbox
   „Ich verstehe, dass der Website-Katalog geleert wird“ (48 px Touch-Ziel,
   `aria-describedby` auf den Hilfetext). Der Button „Trotzdem veröffentlichen“
   (Danger-Variante) bleibt gesperrt, bis die Checkbox gesetzt ist; erst dann
   sendet `_requestPublish(false)` `allow_empty: true`. Ohne Häkchen enthält der
   Body das Feld gar nicht. Nach Abbruch (`_closePublish`), nach jedem Fehler
   und nach einem erneuten Dry-Run wird die Zustimmung auf `false`
   zurückgesetzt; sie wird nie vorausgewählt und nie gespeichert.
3. `publish_artifacts_unavailable` und `internal_error` zeigen die
   Server-`message` direkt. Bei `internal_error` ergänzt `_publishErrorText`
   zusätzlich „Details stehen im Home-Assistant-Protokoll (Filter:
   frickeldave_store).“
4. Statuswechsel laufen über eine `role="status"`-Region (sr-only) mit
   „Anfrage läuft …“, „Dry-Run abgeschlossen.“, „Veröffentlichung abgelehnt:
   Der Store ist leer.“, „Veröffentlichung abgeschlossen.“ bzw. „Dry-Run
   fehlgeschlagen.“. `busy` sperrt Aktions-, Abbrechen- und Schließen-Buttons;
   nach der Ablehnung wandert der Fokus auf die Checkbox, weil der bisher
   fokussierte Veröffentlichen-Button deaktiviert wird.
5. Nur vorhandene `--fd-*`-Tokens (Banner, Danger-Button, Flächen, Abstände)
   und deutsche Texte in ruhigem Ton; keine Rohfarben, keine neuen
   Abhängigkeiten, kein Versionsbump.

**Why:**

Der Fix an `_async_json` macht Antworten und Fehler erstmals auswertbar; das
Panel muss die neuen Signale auch zeigen. Ohne sichtbaren `warning`-Block wäre
der Dry-Run bei leerem Katalog eine unauffällige Vorschau, und der Nutzer
könnte den Notausgang versehentlich auslösen. Die zweistufige Bestätigung hält
die Sperre serverseitig wirksam und macht das Leeren zu einer bewussten,
widerruflichen Entscheidung im Dialog statt zu einem stillen Default. Die
direkte Anzeige von `message` beendet den bisherigen Fallback „Der Server hat
einen Fehler gemeldet.“, der keine Ursache nannte.

#### 2026-11-02T15:27:14+0000: Dokumentation 0.1.13 (Veröffentlichungsfehler, leerer Katalog)

**By:** Maria (Technische Redakteurin / Dokumentationsspezialistin)

**What:**

`docs/features/fr008-ha-manager.md` und `CHANGELOG.md` beschreiben jetzt Stand 0.1.13:

- Neuer Unterabschnitt **Fehlerbehandlung und leerer Katalog** unter „Veröffentlichen“:
  `publish_empty_catalog` (409, auch „nur archivierte“ zählt als leer), Notausgang `allow_empty`
  (Standard `false`, nur Anwendungsverwaltung) samt Bestätigung „Leeren bestätigen“ mit nicht
  vorausgewählter Checkbox und gesperrtem „Trotzdem veröffentlichen“,
  `publish_artifacts_unavailable` (409, Meldung nennt Artikelnummer und Datei), `internal_error`
  mit Traceback im HA-Protokoll (Filter `frickeldave_store`), `github_unavailable` für ungültiges
  JSON und 5xx sowie `warning` (`string|null`) in jeder Publish-Antwort.
- Die Ursache bis 0.1.12 steht als kurzer Absatz: `GitHubClient._async_json` verwarf Bodies ohne
  `Content-Length`, was bei `Transfer-Encoding: chunked` immer zutraf; der Aufrufer lief in
  `AttributeError` (publish.py:408) bis zum nackten HTTP 500. Der Dry-Run war schon über den
  Lesepfad betroffen, das Token nie die Ursache.
- Versionsangaben im Dokument auf 0.1.13 gezogen (Statuszeile, Versionsbeispiel im Drei-Punkte-Menü,
  Prüfschritt nach dem Update). `CHANGELOG.md` ergänzt unter `## [Unreleased]` drei Added- und einen
  Fixed-Eintrag, jeweils mit `(#289)`.

**Why:**

Wer nach dem Update auf „Trotzdem veröffentlichen“ oder ein leeres Panel schaut, braucht die
Bestätigung, dass beide Fälle bewusst behandelt sind. Die Ursache des chunked-Fehlers gehört in die
Doku, weil „das Token war schuld“ sonst als Erklärung stehen bleibt und beim nächsten 500er wieder zu
falscher Fehlersuche führt. Die Baseline-Befunde in `[1.0.7]` (MD032/MD022) bleiben unangetastet,
damit der Diff auf #289 beschränkt bleibt.

#### 2026-11-02T15:27:14+0000: Release 0.1.13 veröffentlicht

**By:** Nick (DevOps / Infrastruktur)

**What:**

Release `0.1.13` des HACS-Repos `Frickeldave/frickeldave.home.net` ist
veröffentlicht.

- Annotierter Tag `0.1.13` → Commit `62af03fb0dea175127974a34891f4ecbe19107eb`
  (`git rev-parse main` = `62af03f`), Tag-Objekt `56d6c2577dff9a320c333dddbccffc00bd189667`,
  Nachricht „Frickeldave Store 0.1.13“.
- GitHub-Release `0.1.13`: **kein Draft, kein Pre-Release, Latest**,
  Datum 2026-11-02T15:28:22Z.
  <https://github.com/Frickeldave/frickeldave.home.net/releases/tag/0.1.13>
- Release-Notes = unveränderter Abschnitt `## [0.1.13] - 2026-11-02` aus
  `CHANGELOG.md` (Markdown-Struktur mit `### Added`, `### Changed`, `### Fixed`
  erhalten); der Publish-Fix steht unter **Fixed** an erster Stelle.
- Manifest im Tag: `custom_components/frickeldave_store/manifest.json` →
  `"version": "0.1.13"`. `hacs.json` und
  `custom_components/frickeldave_store/publish.py` sind im Tag vorhanden.
- CI: Lauf
  <https://github.com/Frickeldave/frickeldave.home.net/actions/runs/41469501407>
  (Workflow `CI`, `headSha` `62af03f`, `conclusion` `success`).
- Bestehende Tags/Releases unangetastet: Tag-SHAs `0.1.8`–`0.1.12` unverändert
  (z. B. `0.1.11` → `a322219`, `0.1.12` → `1d1b295`), `publishedAt` von
  `0.1.8`–`0.1.12` unverändert, alle weiterhin weder Draft noch Pre-Release.

**Why:**

`0.1.13` behebt den kritischen Fehler, der die Veröffentlichung seit `0.1.9`
funktionsunfähig machte: `GitHubClient._async_json` verwarf chunked Antworten
(`Transfer-Encoding: chunked`, kein `Content-Length`) und gab `None` zurück; der
Aufrufer lief in einen `AttributeError`, der als nackter HTTP 500 ankam. Ohne
den Tag wäre der Fix für HACS-Nutzer nicht als Version verfügbar und der letzte
Latest-Stand (`0.1.12`) bliebe der defekte. Zusätzlich enthält `0.1.13`
strukturierte Fehler (`internal_error`), die Sperre gegen den leeren Katalog mit
`allow_empty`-Notausgang, das `warning`-Feld und die Panel-Warnungen.

Der Tag ist annotiert, damit Version, Datum und Tagger wie bei `0.1.8`–`0.1.12`
nachvollziehbar bleiben; Release-Notes wurden bewusst unverändert aus dem
Changelog übernommen, damit Release und `CHANGELOG.md` nicht auseinanderlaufen.
Kein Branch-Push, keine Commits, keine Dateiänderungen im Repo — nur Tag und
Release.

#### 2026-11-02T15:40:00+0000: Bildverkleinerung und Größenmetadaten

**By:** Bruce (Backend / Scripts / Komponenten)

**What:** Uploads und Bestandsbilder laufen durch ein neues Modul
`custom_components/frickeldave_store/imaging.py` (Verkleinerung, Formatwahl,
Metadaten, Cache). Der Upload verkleinert automatisch, `GET …/images`, die
Produktliste (HTTP + WebSocket) und das Produktdetail liefern je Bild `bytes`,
`width`, `height`, `content_type`, `oversized`; neu ist
`POST /products/{artikelnummer}/images/optimize` für die Sammel-Optimierung.
Version 0.1.14.

**Why:** Ein 12-MB-Handyfoto im Panel bremst Liste, Detailansicht und Website-
Export. Ohne Größenangaben konnte das Panel keine Warnung anzeigen. Die
Entscheidungen im Einzelnen:

**Format- und Qualitätsregeln**

- Lange Kante max. **1600 px**, `Image.thumbnail()` skaliert nie hoch.
- JPEG → JPEG, Qualität **82**, `optimize=True`, `progressive=True`, `info`
  wird geleert (kein EXIF/GPS/ICC/Kommentar).
- PNG/WebP **mit** Transparenz (RGBA/LA/P mit `transparency`) → **WebP**,
  Qualität **85**, Alpha bleibt erhalten.
- PNG/WebP **ohne** Transparenz → **JPEG**, Qualität **82**.
- GIF immer unverändert; animiertes WebP ebenfalls (`is_animated`/`n_frames`).
- Bereits passend (lange Kante ≤ 1600 px **und** ≤ 400 KiB) → Bytes werden
  unverändert übernommen, kein Re-Encoding, `resized: false`.
- Umbenennung: Die Dateiendung folgt dem Ergebnis (`…-03.png` → `…-03.webp`).
  Die Nummerierung bleibt eindeutig, weil `next_image_name()` nur Stämme zählt.
- Zusätzliche Idempotenz-Bremse: Liefert ein Re-Encoding byteweise dasselbe
  Ergebnis, meldet der Optimierer `resized: false` – so ist ein zweiter
  Optimize-Lauf garantiert ohne Änderung.

**Pillow-Handhabung**

- Pillow ist Core-Abhängigkeit von Home Assistant (11.x) und wird **nicht** in
  `manifest.json` unter `requirements` eingetragen – sonst installiert HA eine
  zweite, potenziell inkompatible Version.
- Kein Import auf Modulebene: `imaging.pillow()` importiert `PIL.Image` erst
  beim ersten Bild. Fehlt Pillow, antwortet der Upload mit `500
  pillow_missing` und deutscher Meldung statt mit einem `ImportError` beim
  Setup. Metadaten-Lesen degradiert dann auf `width/height = null` (Liste
  bleibt nutzbar).
- Defekte Dateien: `ValidationError` mit `code="image_invalid"` und deutscher
  Meldung, nie ein Stacktrace nach außen.

**Schutz vor Dekomprimierungsbomben**

- `MAX_IMAGE_PIXELS = 40_000_000` (40 MP): reicht für jede Kamera, begrenzt
  aber den Speicher (40 MP × 4 Byte ≈ 160 MB). Die Prüfung läuft nach dem
  Header-Lesen und **vor** `load()`; zusätzlich wird Pillows
  `DecompressionBombWarning` im Kontext als Fehler behandelt und
  `DecompressionBombError` in `image_invalid` übersetzt.

**Cache-Strategie (Metadaten)**

- Prozesslokal, threadsicher, LRU mit **4096 Einträgen**
  (`imaging.MetadataCache`). Schlüssel: `(Pfad, st_mtime_ns, st_size)` –
  geänderte oder ersetzte Dateien werden dadurch automatisch neu gelesen,
  ohne dass jemand den Cache invalidiert.
- Nur `Image.open()` liest den Header; es wird nie das ganze Bild dekodiert.
- Begründung Größe: 60 Produkte × 10 Bilder = 600 Einträge, ein Vielfaches
  davon deckt auch größere Kataloge ab, ohne unbegrenzt zu wachsen.
- Gemessen (60 Produkte × 10 Bilder, 1600×1200-JPEGs): kalt **153 ms**,
  warm **26 ms** für die komplette Liste. Kein sekundenlanges Blockieren.

**Schwellwerte**

- `MAX_LONG_EDGE = 1600`, `MAX_IMAGE_BYTES = 400 * 1024` (400 KiB).
- `oversized` = lange Kante > 1600 px **oder** Datei > 400 KiB. Achtung: Ein
  bereits auf 1600 px gebrachtes, detailreiches Foto kann weiterhin über
  400 KiB liegen; es bleibt dann `oversized: true` (die Liste warnt weiter),
  die Optimierung ändert aber nichts mehr (`resized: false`).

**Metadaten werden nicht persistiert**

- `Image.to_dict()` bleibt unverändert (nur `name`, `is_main`), damit der Store
  keine veralteten Werte speichert und keine Migration nötig ist. Die Felder
  entstehen beim Lesen in `ProductService.image_payloads()` /
  `async_serialise_products()`.

**Sammel-Optimierung**

- `POST /products/{artikelnummer}/images/optimize` (Recht `product`) arbeitet
  unter der Store-Sperre, damit kein paralleler Upload/Delete dazwischenläuft.
  Snapshot der Metadaten vor dem ersten Überschreiben über die bestehende
  Funktion `CatalogStore.async_snapshot("pre-image-optimize")`.
- Grenze dieser Sicherung: Der vorhandene Snapshot kopiert nur die Store-Datei,
  **nicht** die Bild-Bytes. Ein absichtlich verkleinertes Original ist damit
  nicht wiederherstellbar – bewusst akzeptiert, weil ein Bild-Backup pro Lauf
  bis zu 100 MB kosten würde. Wer das braucht, sichert den Bilderordner
  extern.

**Allgemeine Einstellungen**

- Kein neuer Mechanismus: `storage_payload()` lieferte bereits
  `data_path`, `effective_path`, `backup_included`, `exclude_from_backup`,
  `paths` und `choices` (deutsche Labels/Beschreibungen samt
  `backup_included` je Wahl). `PATCH /settings` akzeptiert genau
  `{"storage": {"data_path": "config|share|media"}}`. Für den Tab genügt es,
  diese Felder anzuzeigen; Backend-Änderungen waren nicht nötig.

#### 2026-11-02T15:40:00+0000: Platzierung des Bild-Warnzeichens in Liste und Kacheln

**By:** Natasha (Frontend / UI)

**What:** Produkte mit mindestens einem `oversized`-Bild tragen ein
Warndreieck als echten `<button>` mit `title` und `aria-label`
(„Mindestens ein Bild ist zu groß. Produkt öffnen und Bilder optimieren.“).
In der **Kachel** liegt es als rundes Badge am Bild oben rechts (44 × 44 px,
weiße Fläche, Warnrahmen), in der **Listenansicht** in der Statusspalte vor den
Status-Badges mit sichtbarem Text „Bilder zu groß“ (44 px hoch, Uppercase wie
die übrigen Badges). Ein Klick öffnet den Produktdialog direkt im Bilder-Tab
(`_openImagesFor`), damit die Warnung in die Handlung führt.

**Why:** Die Statusspalte ist der Ort, an dem die Liste bereits Zustände
sammelt; dort überlagert das Zeichen weder Produktname noch Preis und bleibt
trotzdem bei jeder Zeilenhöhe sichtbar. In der Kachel ist das Bild die einzige
Stelle, die ohne Scrollen auffällt – ein Badge im Textbereich würde mit
„Personalisierbar“/„Nicht sichtbar“ konkurrieren. Ein Button statt eines
bloßen `<span tabindex="0">` gibt Tastaturfokus, Enter/Space und ein
`stopPropagation`, ohne eine eigene Fokusfalle zu bauen; das Warndreieck ist
Form **und** Text, die Warnung hängt also nicht an der Farbe allein. Der Sprung
in den Bilder-Tab spart den Umweg über „Bearbeiten → Bilder“ und macht aus der
Warnung eine Ein-Klick-Aufgabe.

#### 2026-11-02T15:40:00+0000: Backup-Schalter leitet sich aus dem Speicherort ab

**By:** Natasha (Frontend / UI)

**What:** Der neue Tab „Allgemeine Einstellungen“ (erster Tab des
Konfigurationspanels, vor „Benutzerverwaltung“) zeigt einen Schalter
„Produktkatalog im Home-Assistant-Backup enthalten“, dessen Zustand **aus
`storage.data_path` abgeleitet** wird: `config` = enthalten, `share`/`media` =
nicht enthalten. Der Schalter ist kein eigenes Feld: Einschalten wählt
`data_path: "config"`, Ausschalten die erste Wahl mit
`backup_included: false` (also `share`). Der Hilfetext nennt den Zusammenhang
explizit (config liegt im Backup, share/media nicht) und wechselt mit der
Auswahl. Gespeichert wird ausschließlich
`PATCH /settings {"storage": {"data_path": …}}`; die Antwort aktualisiert
`effective_path`, `paths[]` und `choices[]`, `reload_required` erzeugt einen
Warnbanner mit dem Hinweis auf „Einstellungen → Geräte & Dienste →
Frickeldave Store → Neu laden“. Bei `409`/`400` erscheint die deutsche
Servermeldung, und die Auswahl springt auf den gespeicherten Speicherort
zurück.

**Why:** `backup_included` ist serverseitig eine reine Funktion des
Speicherorts (`storage_payload()`); ein zweiter, unabhängig schaltbarer Wert
würde eine Wahrheit vortäuschen, die es nicht gibt, und beim nächsten Laden
verworfen. Indem der Schalter nur den Speicherort setzt, bleiben Switch,
Auswahl und die angezeigten Pfade immer konsistent. Das Zurückrollen bei
Fehlern verhindert, dass das Panel einen Speicherort anzeigt, der nie
gespeichert wurde – besonders wichtig, weil ein Wechsel auf einen belegten
Ordner (`409`) oder einen fehlenden Mount (`400`) sonst wie eine gültige
Auswahl aussehen würde.

#### 2026-11-02T16:05:00+0000: Doku 0.1.14 - Bilder, Optimierung und Tab „Allgemeine Einstellungen“

**By:** Maria (Technische Redakteurin / Dokumentationsspezialistin)

**What:** `docs/features/fr008-ha-manager.md` beschreibt 0.1.14 und `CHANGELOG.md` führt zwei
Einträge unter `## [Unreleased]`. Geändert wurden ausschließlich diese beiden Dateien.

- Neuer Abschnitt „Bilder“ in „Produktpflege im Panel“, direkt vor „Katalogimport“: Tabelle der
  Verkleinerungsregeln (lange Kante max. 1600 px, JPEG 82 progressiv ohne EXIF/ICC, Transparenz als
  WebP 85, PNG ohne Alpha als JPEG 82, GIF und animiertes WebP unverändert, bereits passende Bytes
  unverändert), Modul `imaging.py` mit Pillow und 40-MP-Schutz, Endung folgt dem Ergebnis,
  Upload-Antwort mit `bytes`/`width`/`height`/`content_type`, `resized` und deutscher Meldung;
  Bild-Metadaten samt `oversized`, Ermittlung beim Lesen ohne Migration und LRU-Cache (26 ms warm,
  153 ms kalt für 600 Bilder); `POST …/images/optimize` mit Snapshot, erhaltener Reihenfolge und
  Hauptbild, Idempotenz, Vorher/Nachher je Bild und Statistik; Oberflächenverhalten mit
  Verkleinerungsmeldung, Bildgröße, Warnbanner, Button „Bilder optimieren“ und Warndreieck samt
  Tooltip und Sprung in den Bilder-Tab.
- Tab „Allgemeine“ heißt jetzt „Allgemeine Einstellungen“, steht an erster Stelle und beschreibt
  den abgeleiteten Backup-Schalter, die Speicherort-Auswahl, den schreibgeschützten effektiven Pfad
  mit drei Unterpfaden, `PATCH /settings`, den Hinweis auf das Neuladen sowie `409`/`400` mit
  zurückspringender Auswahl. Alle Querverweise und Anker (`#tab-allgemeine-einstellungen`),
  „Datenhaltung“ und „Backup und Wiederherstellung“ folgen der neuen Auswahl-Logik statt der
  früheren Option „Von Backup ausschließen“.
- Korrigiert: Der Abschnitt sagt jetzt offen, dass frühere Fassungen den Tab nannten, obwohl er im
  Code fehlte, und dass die Angaben seit 0.1.14 den tatsächlichen Stand beschreiben.
- Versionsstände im Dokument auf 0.1.14 gezogen (Statuszeile, Versionsanzeige im Drei-Punkte-Menü,
  Browser-Cache-Prüfung); historische Angaben zu 0.1.10 bis 0.1.13 bleiben unverändert.
- CHANGELOG: ein `Added`-Eintrag für Version 0.1.14 mit Bildverkleinerung, Metadaten, Endpunkt und
  Oberfläche, ein `Changed`-Eintrag für den Tab „Allgemeine Einstellungen“ samt Doku-Korrektur,
  beide mit `(#289)`.

**Why:** Die Regeln der Bildverkleinerung und die Sammel-Optimierung sind ohne Schwellwerte und
Formattabelle nicht nachvollziehbar, und die Warnzeichen im Panel brauchen eine Erklärung, was sie
auslöst und wohin der Klick führt. Der Tab „Allgemeine“ war zuvor dokumentiert, obwohl ihn der Code
nicht hatte; nach der Umsetzung wäre eine bloße Umbenennung zu wenig gewesen, weil der Inhalt von
einer Option auf eine Speicherort-Auswahl mit abgeleitetem Backup-Zustand wechselt. Die offene
Korrektur im Text verhindert, dass alte Leser die Abweichung zwischen Doku und Build erneut als
Fehler melden. Der Abschnitt bleibt im bestehenden Stil (deutsche Prosa, 90-110 Zeichen je Zeile,
Tabellen für Werte), ohne fremde Abschnitte umzuformatieren; die zwei vorbestehenden
markdownlint-Befunde im Abschnitt `[1.0.7]` bleiben bewusst unangetastet.

#### 2026-11-02T16:05:00+0000: Release 0.1.14 veröffentlicht

**By:** Nick (DevOps / Infrastructure)

**What:** Version `0.1.14` ist als annotierter Tag auf
`286096ef878afff0499e43b48655214948141bf0` gesetzt (Tag-Objekt
`90f148d48c2f2fc10cdc900e6de4ef45bec204ce`, Annotation „Frickeldave Store
0.1.14“) und als GitHub-Release veröffentlicht – kein Draft, kein
Pre-Release, `Latest`:
https://github.com/Frickeldave/frickeldave.home.net/releases/tag/0.1.14
Die Release-Notes stammen unverändert aus dem Abschnitt
`## [0.1.14] - 2026-11-02` der `CHANGELOG.md` (Markdown-Struktur mit
`### Added`, `### Changed`, `### Notes` erhalten). Im Tag zeigen
`manifest.json` `version: 0.1.14`, `hacs.json` und
`custom_components/frickeldave_store/imaging.py` den erwarteten Stand. Die
Releases `0.1.8`–`0.1.13` und ihre Tags blieben unverändert
(`publishedAt`/Remote-Tag-SHAs identisch zur Baseline). Der CI-Lauf für
`286096e` ist grün:
https://github.com/Frickeldave/frickeldave.home.net/actions/runs/41477537255
`main` steht weiterhin auf `286096e`, es gab keine Commits, keinen Push auf
`main` und keine Dateiänderung im Repository.

**Why:** Release und Tag werden erst nach grünem CI gesetzt, damit ein
fehlgeschlagener Lauf nicht als veröffentlichter Stand in HACS landet; der
annotierte Tag (statt lightweight) hält Version, Annotation und Commit
nachvollziehbar zusammen, und `--verify-tag` verhindert, dass der Release
einen abweichenden Tag anlegt. Die Notes werden wörtlich aus dem Changelog
übernommen, damit Release, Changelog und HACS-Update-Notiz dieselbe Quelle
haben und die bestehende Historie (`0.1.8`–`0.1.13`) unangetastet bleibt.

#### 2026-11-02T16:15:00+0000: ADR #289 — frickeldave-Synchronisation wird eigene HACS-Integration

**By:** Tony (Lead & Requirement Gatekeeper)

**What:** Die frickeldave-spezifische Synchronisation — Veröffentlichen nach `dev`/`prod`, GitHub-Token, Repository-/Workflow-Vorgaben und Katalogimport von `frickeldave.de` — wird in die zweite Custom Integration `frickeldave_store_sync` im Repository `Frickeldave/homeassistant-frickeldave-store-syncfd` ausgelagert. Die Basis `frickeldave_store` erhält dafür einen versionierten, dokumentierten Erweiterungspunkt (`custom_components.frickeldave_store.extension`, Contract 1), Feature-Flags in `GET /api/frickeldave_store/me` und `/settings`, eine generische Export-/Batch-Import-Fassade und verliert alle frickeldave-spezifischen Defaults. Basis `0.2.0` ist der Breaking Release; die Erweiterung startet mit `0.1.0`. Empfohlene Release-Reihenfolge: Basis `0.1.15` (additive Brücke) → Erweiterung `0.1.0` → Basis `0.2.0`. Der GitHub-Token wird nicht automatisch migriert: Der Bestandsnutzer legt einen neuen Fine-grained-Token an, trägt ihn im Options-Flow der Erweiterung ein und widerruft den alten.

**Why:** Die Basis soll für die Home-Assistant-Community generisch, prüfbar und ohne Frickeldave-Geheimnisse nutzbar sein. Ein loser Zugriff über `hass.data` oder ein Service-Aufruf würde die Grenze verwischen und die Erweiterung an private Interna binden. Ein expliziter, versionierter Vertrag mit einer schmalen Fassade hält die Abhängigkeit einseitig (Erweiterung → Basis), erlaubt der Basis, allein zu funktionieren, und gibt der Erweiterung genau die Fähigkeiten, die sie braucht: Export bauen, Produkte/Bilder/Lagerstätten lesen, Snapshot, Rechteprüfung und einen validierten Batch-Schreibpfad für den Import. Der Verzicht auf eine automatische Token-Übernahme ist bewusst: Der Token ist write-only, soll es bleiben, und ein neuer Token mit minimalen Rechten ist sicherer als ein Migrationspfad, der das Geheimnis durch die Basis schleust. Feature-Flags plus Reparatur-Issue verhindern, dass ein Nutzer nach einem halben Update mit sichtbaren, aber funktionslosen Buttons zurückbleibt.

**Status:** Accepted (Architektur). Release-Termine und die Brückenversion `0.1.15` stehen unter dem Vorbehalt der Abnahme durch David Koenig.

**Betrifft:** `Frickeldave/frickeldave.home.net` (Basis, Baseline `286096e`, Version `0.1.14`) und `Frickeldave/homeassistant-frickeldave-store-syncfd` (Erweiterung, Default-Branch `main`, bisher nur LICENSE/README).

**Ablage:** Dieses ADR liegt zunächst nur im Team-Root. Nach Abnahme wird es in beide Repositories als `docs/adr/0001-sync-extension.md` übernommen; die hier beschriebenen Verträge sind dann in der Basis zusätzlich als `docs/extension-api.md` zu dokumentieren.

---

#### 0. Bestehende Entscheidungen, die nicht stillschweigend überschrieben werden

Die folgenden Einträge aus `.squad/decisions.md` bleiben fachlich gültig. Dieses ADR ändert **nicht** ihr Verhalten, sondern nur den Ort der Umsetzung und — wo genannt — den HTTP-Pfad.

| Bestehende Entscheidung | Wirkung dieses ADRs |
| --- | --- |
| `2026-11-02T07:24:38+0000: Veröffentlichung nach dev und prod läuft ausschließlich über dev + fd-deploy-prd` | Wird **1:1 übernommen**: `dev` ist der einzige Schreibpunkt, `prod` committet auf `dev` und dispatcht `fd-deploy-prd.yml`; Dry-Run teilt Code und Antwortformat; die Integration committet nie direkt auf `main`. Verschoben werden nur `publish.py`, die Standardwerte und der Endpunkt (neu: `POST /api/frickeldave_store/features/publish`). |
| `2026-11-02T07:24:38+0000: Lagerstätten ersetzen stock/salesCabinet; Website-Abbildung bleibt stabil` | Bleibt in der Basis: `export.py::export_stock_fields` bildet weiterhin die erste Lagerstätte auf `stock`, die zweite auf `salesCabinet` ab. Die Erweiterung konsumiert dieses Exportformat, sie ersetzt es nicht. |
| `2026-11-02T13:30:51+0000: Katalogimport mit Dry-Run und Überschreiben` | Wird **1:1 übernommen**: `dry_run`, `overwrite`, die Zähler und die Feld-Übernahmeregeln bleiben. `overwrite` bleibt bei Rolle `product`; eigene `source_url`/`image_base_url` bleiben `app_admin` vorbehalten. Verschoben werden `importer.py`, die Quellen-Allowlist und der Endpunkt (neu: `POST /api/frickeldave_store/features/import`). |
| `2026-11-02T14:21:10+0000: Veröffentlichen-Fehler eingegrenzt` | Die Fixes (Body immer lesen, `_as_mapping`, `internal_error`, `publish_artifacts_unavailable`, `publish_empty_catalog`, `allow_empty`, `warning`) wandern mit `publish.py` und den Tests. Die Semantik bleibt unverändert. |
| `2026-11-02T11:24:46+0000: Datenverlust bei Update behoben` | Die Basis bleibt alleinige Eigentümerin von `frickeldave_store.data`, Bildern und Snapshots. Die Erweiterung liest und schreibt **nie** direkt im Datenordner; sie nutzt ausschließlich die Fassade. |
| `2026-11-02T16:05:00+0000: Doku 0.1.14 …` | `0.1.14` ist die Baseline. Die Panel-Funktionen aus 0.1.14 bleiben erhalten; nur Veröffentlichen/Import werden gegatet und die zugehörigen Einstellungen wandern. |

**Wichtig:** Die bestehende Entscheidung nennt den Endpunkt `POST /api/frickeldave_store/publish` und die Settings `settings.publish`. Dieses ADR ersetzt beides in `0.2.0` bewusst durch den generischen Feature-Endpunkt und den Options-Flow der Erweiterung. Das ist eine angekündigte Breaking Change, kein stiller Widerspruch; die fachlichen Regeln bleiben identisch.

---

#### 1. Erweiterungspunkt-Vertrag

##### 1.1 Entscheidung

Gewählt wird **(a): eine dokumentierte, versionierte Registrierungsfunktion in der Basis**, die die Erweiterung beim Setup aufruft und die eine stabile Fassade auf den Store erhält.

Die Erweiterung importiert ausschließlich `custom_components.frickeldave_store.extension`. Die Basis importiert **nie** die Erweiterung und kennt ihren Domainnamen nicht. Die Registrierung erfolgt in `async_setup_entry` der Erweiterung; die Abmeldung über `entry.async_on_unload`.

##### 1.2 Bewertung der Alternativen

| Variante | Bewertung | Entscheidung |
| --- | --- | --- |
| **(a) Dokumentierte Registrierungsfunktion + Fassade** | Klarer, prüfbarer Vertrag; eine Import-Richtung; die Basis kann allein laufen; Rechte, Export und Batch-Schreiben bleiben unter Kontrolle der Basis; versionierbar. | **Gewählt.** |
| **(b) Nur-lose Kopplung über `hass.data`/`hass.config.components`** | Die Erweiterung müsste private Runtime-Objekte (`FrickeldaveStoreRuntime`, `CatalogStore`) kennen; jede Änderung in der Basis bricht die Erweiterung; keine Rechte-/Snapshot-Garantien; `hass.config.components` sagt nur, dass die Integration geladen ist, nicht dass ein Config Entry eingerichtet ist. | Verworfen. |
| **(c) Eigener Service-Aufruf** | Services sind für Aktionen gedacht, nicht für das Lesen eines konsistenten Store-Snapshots oder das Schreiben eines validierten Batches. Rückgabewerte sind nicht typisiert, Fehler schwer zuzuordnen, und der Aufruf wäre ein zweiter, unversionierter Vertrag. | Verworfen. |

##### 1.3 Öffentliche Signatur (Contract 1)

`custom_components/frickeldave_store/extension.py` ist die einzige öffentliche Schnittstelle. Alle Namen in `__all__` sind Vertrag; alles andere ist privat.

```python
# custom_components/frickeldave_store/extension.py  — öffentlich, Contract 1

CONTRACT_VERSION: Final = 1
BASE_DOMAIN: Final = "frickeldave_store"

ROLE_PRODUCT: Final = "product"
ROLE_FINANCE: Final = "finance"
ROLE_APP_ADMIN: Final = "app_admin"

FEATURE_PUBLISH: Final = "publish"   # reservierter Feature-Name
FEATURE_IMPORT: Final = "import"     # reservierter Feature-Name

FeatureHandler = Callable[["FeatureRequest"], Awaitable["FeatureResponse"]]


@dataclass(frozen=True, slots=True)
class FeatureSpec:
    handler: FeatureHandler
    required_role: str | None = None   # None = jeder authentifizierte HA-Benutzer
    ready: bool = True                 # False = installiert, aber nicht eingerichtet
    reason: str = ""                   # maschinenlesbar, z. B. "token_missing"


@dataclass(frozen=True, slots=True)
class ExtensionRegistration:
    extension_id: str                  # HA-Domain, z. B. "frickeldave_store_sync"
    version: str                       # "0.1.0"
    contract_version: int              # 1
    features: Mapping[str, FeatureSpec]


@dataclass(frozen=True, slots=True)
class FeatureRequest:
    feature: str
    payload: Mapping[str, Any]
    user_id: str
    user_name: str
    facade: "StoreFacade"


@dataclass(frozen=True, slots=True)
class FeatureResponse:
    payload: Mapping[str, Any]
    status: int = 200


@dataclass(frozen=True, slots=True)
class FeatureStatus:
    available: bool
    configured: bool
    extension_id: str
    extension_version: str
    reason: str


async def async_register_extension(
    hass: HomeAssistant, registration: ExtensionRegistration
) -> Callable[[], None]:
    """Registriert eine Erweiterung; gibt eine idempotente Abmeldefunktion zurück."""


def async_get_facade(hass: HomeAssistant) -> "StoreFacade | None":
    """Fassade der aktuell eingerichteten Basis oder None."""


def async_feature_status(hass: HomeAssistant) -> Mapping[str, FeatureStatus]:
    """Status aller Features für /settings und die Repair-Logik."""
```

Die Fassade ist ein `Protocol`; die konkrete Implementierung bleibt privat:

```python
@dataclass(frozen=True, slots=True)
class ImageSnapshot:
    name: str
    is_main: bool
    order: int


@dataclass(frozen=True, slots=True)
class ProductSnapshot:
    article_number: str
    name: str
    description: str
    price: float
    size: str
    category: str
    tags: tuple[str, ...]
    visible: bool
    customizable: bool
    archived: bool
    stock: Mapping[str, int]           # location_id -> Menge
    images: tuple[ImageSnapshot, ...]
    created_at: str
    updated_at: str


@dataclass(frozen=True, slots=True)
class ExportArtifact:
    path: str                          # POSIX, relativ zum Ziel-Repository
    data: bytes
    kind: Literal["catalog", "image"]
    article_number: str = ""


@dataclass(frozen=True, slots=True)
class ExportBundle:
    catalog_path: str
    artifacts: tuple[ExportArtifact, ...]
    product_count: int
    image_count: int
    empty_catalog: bool
    generated_at: str


@dataclass(frozen=True, slots=True)
class ImageUpload:
    name: str
    data: bytes


@dataclass(frozen=True, slots=True)
class ImportItem:
    article_number: str | None         # None = neu anlegen
    payload: Mapping[str, Any]         # Felder wie POST/PATCH /products
    images: tuple[ImageUpload, ...] = ()


@dataclass(frozen=True, slots=True)
class ImportItemError:
    article_number: str
    message: str


@dataclass(frozen=True, slots=True)
class ImportBatchResult:
    created: tuple[str, ...]
    updated: tuple[str, ...]
    errors: tuple[ImportItemError, ...]
    images_written: int
    snapshot: str | None


class StoreFacade(Protocol):
    contract_version: int
    hass: HomeAssistant

    async def async_products(self) -> tuple[ProductSnapshot, ...]: ...
    async def async_locations(self) -> tuple[Mapping[str, str], ...]: ...
    async def async_article_numbers(self) -> frozenset[str]: ...

    def can(self, user_id: str, role: str) -> bool: ...
    def require(self, user_id: str, role: str) -> None: ...

    async def async_create_snapshot(self, reason: str) -> str | None: ...
    async def async_build_export(
        self,
        *,
        catalog_path: str,
        images_path: str,
        visible_only: bool = False,
    ) -> ExportBundle: ...
    async def async_apply_import_batch(
        self,
        items: Sequence[ImportItem],
        *,
        reason: str,
    ) -> ImportBatchResult: ...


class ExtensionError(Exception):
    """Vom Handler geworfener, strukturierter Fehler."""

    code: str
    status: int
    message: str
```

##### 1.4 Feature-Namen und Payloads

Die Basis interpretiert Feature-Namen nicht. `publish` und `import` sind für die Panel-Integration reserviert; ihre Payloads sind der Vertrag zwischen Basis-Panel und Erweiterung und werden in beiden Repositories dokumentiert.

| Feature | `required_role` | Request-Payload | Response-Payload |
| --- | --- | --- | --- |
| `publish` | `app_admin` | `{"target": "dev"\|"prod", "dry_run": bool, "message": str, "allow_empty": bool}` | Wie bisher: `counts`, `products`, `images`, `files`, `deployment`, `summary`, `warning`, `target`, `dry_run` |
| `import` | `product`; bei eigener `source_url`/`image_base_url` zusätzlich `app_admin` | `{"source_url"?: str, "image_base_url"?: str, "import_images": bool, "dry_run": bool, "overwrite": bool}` | Wie bisher: `created`, `overwritten`, `skipped`, `failed`, `images_imported`, `products_total`, `errors`, `dry_run`, `would_create`, `would_overwrite`, `unchanged`, `summary` |

Die Basis validiert nur, dass der Body ein JSON-Objekt ist. Die fachliche Validierung (erlaubte Felder, Typen, Werte) bleibt beim Handler der Erweiterung, damit die Basis keine frickeldave-Kenntnis enthält.

##### 1.5 Stabilitätszusage

**Öffentlicher Vertrag:**

- das Modul `custom_components.frickeldave_store.extension` und alle Namen in `__all__`;
- `CONTRACT_VERSION` und die Bedeutung der Datentypen/ Felder;
- die reservierten Feature-Namen `publish` und `import` samt Request-/Response-Payloads (dokumentiert in `docs/extension-api.md` und im Extension-README);
- `POST /api/frickeldave_store/features/{feature}`;
- `features` in `GET /api/frickeldave_store/me` und `/settings`;
- `feature_details` in `/settings` (nur `app_admin`);
- das Event `frickeldave_store_features_changed`.

**Privat:**

- alles andere unter `custom_components.frickeldave_store`, insbesondere `store.py`, `products.py`, `views.py`, `permissions.py`, `models.py`, `const.py`, `export.py`, `panel.py`, `frontend/`;
- die Runtime (`FrickeldaveStoreRuntime`), `runtime_for`, `hass.data[DOMAIN]`, der Datenordner, `frickeldave_store.data`, Bilder, Snapshots;
- die konkrete Implementierung der Fassade.

**Regeln für die Erweiterung:**

- Imports nur aus `custom_components.frickeldave_store.extension`. Keine Imports aus `const`, `models`, `store`, `products`, `views`, `permissions`, `export`.
- Kein Zugriff auf `hass.data["frickeldave_store"]`, keine Dateipfade, kein Monkeypatching.
- Keine eigenen HTTP-Views unter `/api/frickeldave_store/*`; die Erweiterung liefert Feature-Handler, die Basis routet und authentifiziert.
- Keine Persistenz der Store-Daten; die Basis bleibt alleinige Eigentümerin.

**Versionierung:**

- `CONTRACT_VERSION` ist eine Ganzzahl und wird bei jeder inkompatiblen Änderung erhöht. Additive, optionale Felder erhöhen sie nicht.
- Die Basis akzeptiert `registration.contract_version <= CONTRACT_VERSION` und lehnt neuere Verträge mit `contract_too_new` ab.
- Die Erweiterung deklariert `MIN_CONTRACT_VERSION = 1` und verweigert den Start, wenn die Basis älter ist.
- Offiziell getestet werden der aktuelle und der vorherige Vertrag (N und N-1); ein älterer Vertrag wird nur mit Warnung akzeptiert. Die Entfernung eines öffentlichen Namens erfolgt erst mit einem Contract-Bump und einer Deprecation über mindestens ein Minor-Release.

##### 1.6 Abhängigkeitsrichtung und Lebenszyklus

**Manifest der Erweiterung:** `dependencies: ["frickeldave_store"]`.

Begründung: Die Erweiterung ist ohne Basis funktionslos. `dependencies` stellt sicher, dass die Basis vor der Erweiterung eingerichtet wird, und macht die fehlende Installation zu einem klaren Fehler. `after_dependencies` allein garantiert nur die Reihenfolge, wenn die Basis vorhanden ist, und würde die Erweiterung halb funktionsfähig starten. Falls die Ziel-HA-Version eine Custom-zu-Custom-`dependencies` nicht auflöst, ist der Rückfall `after_dependencies: ["frickeldave_store"]` plus ein harter Runtime-Check in `async_setup_entry` (`ConfigEntryNotReady` mit klarer Meldung). HACS löst keine Abhängigkeiten auf; deshalb sind README, Release Notes und das Repair-Issue Teil des Vertrags.

**Import-Richtung:** Erweiterung → Basis. Die Basis importiert die Erweiterung nie. Die Basis kennt auch den Domainnamen der Erweiterung nicht; sie speichert nur, was registriert wurde.

**Registry-Lebenszyklus:**

- Die Registry liegt unter `hass.data[f"{DOMAIN}_extensions"]` und wird in `async_setup` der Basis angelegt. Sie wird beim Unload eines Config Entry **nicht** gelöscht, damit ein Basis-Reload die Registrierung der Erweiterung nicht verliert.
- Die Fassade löst die Runtime bei jedem Aufruf neu auf. Ein Basis-Reload macht eine gehaltene Fassade nicht ungültig; fehlt die Runtime, wirft sie `ExtensionError(code="base_unavailable")`.
- Registrierung derselben `extension_id` ersetzt atomar; die zurückgegebene Abmeldefunktion entfernt nur, wenn die aktuelle Registrierung dieselbe Identität hat.
- Ein Feature-Name darf nur von einer Erweiterung registriert werden. Ein zweiter Provider führt zu `ExtensionConflict` und wird abgelehnt. Die Built-in-Provider der Brückenversion `0.1.15` liegen in einer separaten Fallback-Map und werden von Erweiterungs-Providern überstimmt.
- Beim Unload der Basis-Instanz werden die Features nicht verfügbar; die Registry bleibt. Die Basis feuert das Feature-Event.
- Beim HA-Neustart richtet die Basis zuerst ein, dann die Erweiterung; die Erweiterung registriert in `async_setup_entry`.

**Fehlervertrag:**

- Der Handler darf `ExtensionError` werfen; die Basis antwortet mit `{"error": {"code", "message"}}` und `status`.
- Jede andere Exception wird mit Traceback geloggt und als `500 extension_error` mit generischer deutscher Meldung beantwortet. Der Request-Body wird nie geloggt.
- Ist das Feature nicht registriert oder `ready=false`, antwortet die Basis mit `409 feature_unavailable` und einer Meldung, die auf Installation/Konfiguration der Erweiterung verweist.
- Fehlt die Basis-Runtime, antwortet die Basis wie bisher mit `503 not_loaded`.

**Event:**

`frickeldave_store_features_changed` auf dem HA-Bus, Payload `{"features": {"publish": bool, "import": bool}}` (plus optional `extension_id`). Es wird bei Registrierung, Abmeldung, Statuswechsel und Basis-Unload gefeuert.

---

#### 2. Capability-Anzeige

##### 2.1 Entscheidung

Der Vorschlag wird übernommen, aber geschärft:

- `GET /api/frickeldave_store/me` liefert **nur Booleans**: `"features": {"publish": bool, "import": bool}`.
- `GET /api/frickeldave_store/settings` liefert dieselben Booleans **plus** `feature_details` für `app_admin`:

```json
{
  "features": {"publish": true, "import": true},
  "feature_details": {
    "publish": {
      "extension": "frickeldave_store_sync",
      "version": "0.1.0",
      "available": true,
      "configured": true,
      "reason": ""
    },
    "import": {
      "extension": "frickeldave_store_sync",
      "version": "0.1.0",
      "available": true,
      "configured": true,
      "reason": ""
    }
  }
}
```

`features` ist eine **Fähigkeitsanzeige, keine Rechteanzeige**. Die Basis meldet, ob ein Feature bereitsteht; die Rolle prüft weiterhin das Panel bzw. die Route.

##### 2.2 Semantik

- `available = provider_registered AND base_runtime_ready AND spec.ready`.
- `configured = spec.ready` (die Erweiterung meldet, ob ihre Voraussetzungen erfüllt sind).
- Kein Provider → `available=false`, `configured=false`, `extension=""`, `reason="not_installed"`.
- Provider vorhanden, aber nicht eingerichtet → `available=false`, `configured=false`, `reason` z. B. `"token_missing"` oder `"invalid_source_url"`.
- Provider vorhanden und eingerichtet → `available=true`.
- In der Brückenversion `0.1.15` können die Built-in-Provider der Basis als Fallback zählen; `feature_details.extension` ist dann `"frickeldave_store"` und `feature_details.version` die Basisversion. Ein Erweiterungs-Provider mit `ready=true` hat Vorrang; ein Erweiterungs-Provider mit `ready=false` verdrängt einen ready Built-in-Fallback nicht.
- Die strenge Anforderung „Buttons nur bei installierter und eingerichteter Erweiterung“ gilt ab Basis `0.2.0`. Die Brücke `0.1.15` ist die einzige, befristete Ausnahme: Dort bleiben die Buttons über den Built-in-Fallback auch ohne Erweiterung sichtbar, damit Bestandsnutzer vor dem Breaking Update weiterarbeiten und die Erweiterung in Ruhe verifizieren können.

##### 2.3 Panel-Gating

| UI-Element | Sichtbar, wenn | Verhalten bei Klick |
| --- | --- | --- |
| Topbar-Button „Katalog importieren“ | `can.product && features.import` | `POST /features/import` |
| Topbar-Buttons „Nach dev/prod veröffentlichen“ | `can.app_admin && features.publish` | `POST /features/publish` |
| Import-Dialog | nur über den Button; zusätzlich Guard in `_openImport()` | Bei `feature_unavailable`: schließen, Banner, `/me` neu laden |
| Publish-Dialog | nur über die Buttons; zusätzlich Guard in `_openPublish()` | Bei `feature_unavailable`: schließen, Banner, `/me` neu laden |
| Config-Panel-Tab „Veröffentlichen“ | entfällt in der Basis `0.2.0` | Einstellungen liegen im Options-Flow der Erweiterung |
| Config-Panel-Tab „Erweiterungen“ | immer für `app_admin` | Zeigt `features`/`feature_details`, Extension-Version, Grund und den Hinweis auf „Einstellungen → Geräte & Dienste → Frickeldave Store Sync → Konfigurieren“ |

Der Import-Dialog verliert den hartcodierten Satz „Der aktuelle Katalog von **frickeldave.de** …“ und spricht neutral von „dem konfigurierten Katalog“. Die übrigen Dialoginhalte (Dry-Run, Überschreiben, Dateiliste, Fehler) bleiben; sie sind bereits generisch.

##### 2.4 Erweiterung wird deinstalliert/deaktiviert, während das Panel offen ist

Drei Ebenen:

1. **Event:** Die Basis feuert `frickeldave_store_features_changed` bei Abmeldung/Unload. Das Panel abonniert das Event über `hass.connection.subscribeEvents` und lädt `/me` (debounced) neu. Wird ein Feature `false`, werden die Buttons entfernt und ein offener Dialog geschlossen.
2. **Fehlerpfad:** Ein veraltetes Panel, das noch einen Button zeigt, erhält beim Aufruf `409 feature_unavailable` (Code). Das Panel schließt den Dialog, setzt das Feature lokal auf `false`, zeigt einen Banner („Die Erweiterung ist nicht mehr installiert oder nicht eingerichtet. Bitte Installation prüfen.“) und lädt `/me` neu. Kein automatischer Retry.
3. **Revalidierung:** Das bestehende `_revalidateAccess` (bei `visibilitychange` und HA-Benutzerwechsel) liest `features` mit. Damit ist der Zustand spätestens beim nächsten Sichtbarwerden korrekt.

Ein HA-Neustart nach dem Entfernen der Integrationsdateien lädt das Panel ohnehin neu; der Event-Pfad deckt den Fall ab, dass nur der Config Entry deaktiviert oder die Erweiterung neu geladen wird. In-flight-Anfragen können nach der Abmeldung noch zu Ende laufen; die nächste Anfrage erhält `409`. Es gibt keinen Datenverlust, weil die Erweiterung den Store nicht besitzt.

##### 2.5 Warum keine losen Checks im Panel

`hass.config.components` oder ein direktes `hass.data`-Lesen im Panel wäre ein zweiter, unversionierter Vertrag und würde Installiert-Sein mit Eingerichtet-Sein verwechseln. Die Basis ist die einzige Stelle, die Provider, Runtime und `ready` kennt; das Panel konsumiert nur `features`.

---

#### 3. Aufteilung des Codes

##### 3.1 Dateien/Module: Basis `0.1.14` → Ziel

Die Tabelle beschreibt den **Zielzustand `0.2.0`**. In der Brückenversion `0.1.15` bleiben `publish.py` und `importer.py` vorübergehend in der Basis und werden dort als Built-in-Feature-Provider registriert; die Erweiterung kann sie überstimmen. Erst `0.2.0` entfernt die Dateien und die Built-in-Provider.

| Datei/Modul (Basis 0.1.14) | Ziel | Anmerkung |
| --- | --- | --- |
| `custom_components/frickeldave_store/publish.py` | Erweiterung: `custom_components/frickeldave_store_sync/publish.py` | 1:1 portieren. `build_artifacts` wird durch `facade.async_build_export(...)` ersetzt; `GitHubClient`, `PublishService`, `PublishSettings` und alle Fehlerklassen bleiben in der Erweiterung. |
| `custom_components/frickeldave_store/importer.py` | Erweiterung: `.../importer.py` | 1:1 portieren. Store-Zugriffe werden zu `facade.async_products()/async_locations()/async_article_numbers()`; Schreiben wird `facade.async_apply_import_batch(...)`. URL-Allowlist, Quell-URLs und Bildbasis wandern in die Extension-`const.py`. |
| `tests/test_publish.py` | Erweiterung: `tests/test_publish.py` | `FakeGitHub` bleibt; statt `CatalogStore` eine Fake-Fassade mit `async_build_export`. Die bestehenden Fälle (Dry-Run, dev/prod, leerer Katalog, chunked HTTP, Artefaktfehler) bleiben. |
| `tests/test_importer.py` | Erweiterung: `tests/test_importer.py` | Fake-Fetcher bleibt; Store-Assertions werden zu Fassaden-Assertions. Dry-Run-/Overwrite-/Bildfälle bleiben. |
| `views.py::PublishView` | Erweiterung: Feature-Handler `publish` | Kein eigener HTTP-View in der Erweiterung; die Basis routet. |
| `views.py::CatalogImportView` | Erweiterung: Feature-Handler `import` | Dito. |
| `views.py::ExportView` | Basis | Lokaler Export bleibt; er ist generisch und nicht frickeldave-spezifisch. |
| `views.py::MeView` | Basis | `features` ergänzen. |
| `views.py::SettingsView` | Basis | `publish` aus erlaubten Feldern entfernen; `features`/`feature_details` ergänzen; `_persist_publish_options` entfernen. |
| `const.py::DEFAULT_PUBLISH_REPOSITORY`, `DEFAULT_PUBLISH_DEV_BRANCH`, `DEFAULT_PUBLISH_PROD_BRANCH`, `DEFAULT_PUBLISH_PROD_WORKFLOW` | Erweiterung: `const.py` | Frickeldave-Defaults (`Frickeldave/frickeldave.github.io`, `dev`, `main`, `fd-deploy-prd.yml`). |
| `const.py::DEFAULT_CATALOG_URL`, `DEFAULT_IMAGE_BASE_URL`, `IMPORT_ALLOWED_HOSTS` | Erweiterung: `const.py` | `https://frickeldave.de/data/handmade.json`, `raw.githubusercontent.com/.../frickeldave.github.io`, Allowlist `frickeldave.de`/`raw.githubusercontent.com`. |
| `const.py::ISSUE_URL` | Basis: `const.py` | Auf `f"{REPOSITORY_URL}/issues"` umstellen; kein `#289` mehr. |
| `const.py::DEFAULT_AI_PROMPT` | Basis: `const.py` | Generischer Prompt, z. B. `"Write a concise, appealing product description for an online shop."`; bestehende gespeicherte Prompts bleiben unverändert. |
| `publish.py::build_artifacts` (aktuell in `publish.py`) | Basis: `export.py::async_build_export` | Generischer Export-Bundle-Builder; die Erweiterung ruft ihn über die Fassade. |
| `export.py::CATALOG_RELATIVE_PATH`, `IMAGES_RELATIVE_PATH` | Aufteilen | Basis: konfigurierbare Exportpfade mit generischen Defaults (`data/catalog.json`, `images`); Erweiterung: Website-Pfade (`public/data/handmade.json`, `src/assets/handmade`). |
| `config_flow.py`-Felder `github_repository`, `github_dev_branch`, `github_prod_workflow`, `github_token` | Erweiterung: `config_flow.py` | Basis entfernt die Felder; bestehende Optionswerte bleiben unangetastet (Rollback). |
| `frontend/frickeldave-store-config-panel.js` Tab „Veröffentlichen“ | Erweiterung: Options-Flow | Basis entfernt den Tab; der Options-Flow der Erweiterung ersetzt ihn. |
| `frontend/frickeldave-store-panel.js` Publish-/Import-Endpunkte | Basis, gegatet | URLs auf `/features/publish` und `/features/import` umstellen; Feature-State und Gating ergänzen. Die Dialoge bleiben in der Basis. |
| `translations/de.json`, `translations/en.json`, `strings.json` Publish-/Import-Schlüssel | Erweiterung: `translations/`, `strings.json` | Basis entfernt die Schlüssel; Erweiterung bringt eigene de/en-Übersetzungen mit. |
| `docs/*` Publish-/Import-Abschnitte | Erweiterung: README/Docs; Basis: Migrationsleitfaden | Basis-README wird generisch; die frickeldave-Spezifika stehen nur noch in der Erweiterung. |

**Neu in der Basis:**

- `custom_components/frickeldave_store/extension.py` (Contract, Registry, Fassade, Fehler);
- `tests/test_extension.py`, `tests/test_extension_facade.py`, `tests/test_legacy_settings.py`, `tests/test_no_extension_imports.py`;
- `docs/extension-api.md`, `docs/migration-0.2.md`;
- Repair-Issue-Übersetzungen.

**Neu in der Erweiterung:**

- `custom_components/frickeldave_store_sync/__init__.py`, `manifest.json`, `const.py`, `config_flow.py`, `publish.py`, `importer.py`, `strings.json`, `translations/de.json`, `translations/en.json`, `brand/icon.png`;
- `hacs.json`, `README.md`, `CHANGELOG.md` (MIT-Lizenz vorhanden), `.github/workflows/ci.yml`, Issue-Templates, `tests/`.

##### 3.2 Was in der Basis bleibt

`models.py`, `store.py`, `storage.py`, `products.py`, `permissions.py`, `ai.py`, `imaging.py`, `export.py` (generisch), `panel.py`, `websocket_api.py`, `config_flow.py` (ohne GitHub), `views.py` (ohne Publish/Import), `frontend/` (ohne Publish-Settings-Tab, mit Gating), `strings.json`/`translations/` (ohne Publish/Import), `docs/` (generisch), `tests/` (ohne die verschobenen Publish-/Import-Tests).

Die Basis bleibt damit ein vollständiges, eigenständig nutzbares Produkt-/Lagerverwaltungswerkzeug mit Panel, Rechten, KI, Bildoptimierung, lokalem Export und Backup.

##### 3.3 Generische Fähigkeiten der Basis (ohne Privatzugriff)

Die Erweiterung braucht genau diese Fassadenmethoden:

1. **Export bauen:** `async_build_export(catalog_path, images_path, visible_only=False) -> ExportBundle`.
   - Liefert den Katalog als Bytes und alle Bilder als `ExportArtifact` mit Zielpfad, inklusive `article_number` und `kind`.
   - Wirft `ExtensionError(code="export_artifacts_unavailable")` mit gesammelter Liste, wenn eine Bilddatei fehlt oder nicht lesbar ist — dieselbe Sicherheitslinie wie heute.
   - Setzt `empty_catalog=True`, wenn kein nicht-archiviertes Produkt existiert; die Publish-Politik (`allow_empty`, `warning`) bleibt bei der Erweiterung.
2. **Produkte lesen:** `async_products() -> tuple[ProductSnapshot, ...]` (konsistent unter dem Store-Lock, inklusive Bilder, Beständen je Lagerstätte, Archiv-Status, Zeitstempeln).
3. **Lagerstätten lesen:** `async_locations() -> tuple[Mapping[str, str], ...]`.
4. **Artikelnummern lesen:** `async_article_numbers() -> frozenset[str]` (inklusive archivierter Produkte).
5. **Snapshot:** `async_create_snapshot(reason) -> str | None`; der Batch legt zusätzlich automatisch einen Snapshot vor dem ersten Schreiben an.
6. **Rechteprüfung:** `can(user_id, role)` und `require(user_id, role)` mit denselben Rollen (`product`, `finance`, `app_admin`) und Default Deny.
7. **Validierter Batch-Schreibpfad für den Import:** `async_apply_import_batch(items, reason) -> ImportBatchResult`.
   - Validiert **alle** Items zuerst mit denselben Regeln wie `POST`/`PATCH /products` (Artikelnummer, Kategorie, Preise, Bestände, Bilder).
   - Legt bei gültigen Items **einen** Snapshot an, schreibt alle Produkte und Bilder unter dem Store-Lock und speichert **einmal**.
   - Ungültige Items landen in `errors` und werden übersprungen; gültige werden angewendet. Das entspricht der heutigen Import-Semantik (Fehler je Produkt sammeln, Lauf nicht abbrechen).
   - Bestehende Produkte werden nur aktualisiert, wenn das Item eine `article_number` trägt; Kategorie ist unveränderlich; archivierte Produkte werden nicht reaktiviert; `createdAt` bleibt, `updatedAt` wird gesetzt; Tags werden global ergänzt.
   - Bilder: maximal `MAX_IMAGES`, erlaubte Suffixe, Größenlimit, Signaturprüfung; Schreiben über `ImageStorage`.
   - Kein `dry_run` in der Fassade: Der Aufrufer (Erweiterung) ist für die Vorschau verantwortlich und ruft den Batch im Dry-Run **nicht** auf. Das verhindert versehentliche Schreibvorgänge.

**Nicht** Teil der Fassade: `CatalogStore`, `ProductService`, `ImageStorage`, `store.lock`, `data_dir`, `frickeldave_store.data`, `settings`, direkte Dateipfade, HTTP-Views, Panel-Interna.

##### 3.4 Was die Erweiterung nicht darf

- Keine Imports aus der Basis außer `extension`.
- Kein `hass.data["frickeldave_store"]`, kein `runtime_for`, kein `CatalogStore`.
- Keine direkten Dateizugriffe auf den Datenordner, Bilder, Snapshots oder die Store-Datei.
- Keine eigenen HTTP-Views unter dem Basis-API-Prefix; Feature-Handler genügen.
- Keine Persistenz von Produkten/Beständen; die Basis ist die einzige Quelle der Wahrheit.
- Kein Lesen oder Migrieren des Basis-Tokens. Die Erweiterung hat ihr eigenes Token.

##### 3.5 Tests, die die Grenze absichern

**Basis:**

- `test_extension.py`: Registrierung/Abmeldung, doppelte `extension_id`, doppelter Feature-Name, `contract_too_new`, `feature_unavailable`, Rollenprüfung, `ExtensionError`-Mapping, unerwartete Exception → 500, Event-Payload.
- `test_extension_facade.py`: `async_build_export` ist byte-identisch zum bisherigen `build_artifacts` (Golden-Test mit Fixture); fehlendes/unlesbares Bild → `export_artifacts_unavailable`; `async_apply_import_batch` validiert, snapshotet einmal, speichert einmal, sammelt Fehler, lehnt archivierte Updates/Kategorieänderungen ab, erzwingt Bildgrenzen.
- `test_legacy_settings.py`: Altbestand mit `settings.publish` lädt, `/settings` gibt `publish` nicht mehr aus, Speichern erhält den Schlüssel, `github_*`-Options bleiben.
- `test_no_extension_imports.py`: Die Basis importiert nie `frickeldave_store_sync`; im Paket `custom_components/frickeldave_store` kommen `frickeldave.de`, `frickeldave.github.io`, `fd-ci`, `fd-deploy-dev`, `fd-deploy-prd`, `raw.githubusercontent.com/Frickeldave` nicht mehr vor (Allowlist: Basis-Repo-URL, Markenname, Doku).
- `test_frontend_assets.py`: Gating-Markup verwendet `features.publish`/`features.import`; kein unbedingter Publish-/Import-Button; `feature_unavailable`-Behandlung vorhanden; Import-Dialog enthält kein `frickeldave.de`.

**Erweiterung:**

- Portierte `test_publish.py`/`test_importer.py` mit Fake-Fassade.
- `test_config_flow.py`: Basis fehlt/zu alt/nicht eingerichtet → Abbruch; Token write-only; `ready`-Flags; Options-Reload; unbekannte Options bleiben.
- `test_contract.py`: Registrierung mit Contract 1, Feature-Payloads, Fehler-Mapping.
- `test_compat.py`: läuft gegen Basis `0.1.15` und `0.2.0` (CI-Matrix, Base-Repo als Checkout).

**Querschnitt:** Installationsmatrix Basis-only, Erweiterung-only (muss klar fehlschlagen), beide, Basis `0.1.15` + Extension `0.1.0`, Basis `0.2.0` + Extension `0.1.0`, Rollback `0.2.0` → `0.1.14`.

---

#### 4. Einstellungen und Migration

##### 4.1 Neuer Config-/Options-Flow in der Erweiterung

Die Erweiterung ist eine zweite Custom Integration mit eigenem Config Entry. Sie hat **kein** Panel; die Einstellungen liegen im Standard-HA-Flow (Einrichtung + Optionen). Ein einziger Eintrag pro Instanz (`async_set_unique_id(DOMAIN)`).

**Einrichtung (`async_step_user`):**

| Feld | Pflicht | Default | Bedeutung |
| --- | --- | --- | --- |
| `repository` | ja | `Frickeldave/frickeldave.github.io` | Ziel-Repository (`owner/name`) |
| `dev_branch` | ja | `dev` | Integrationsbranch; Push löst CI/Dev-Deploy aus |
| `prod_branch` | ja | `main` | Produktionsbranch (nur Workflow schreibt) |
| `prod_workflow` | ja | `fd-deploy-prd.yml` | Workflow, der `dev` nach `main` promotet |
| `github_token` | nein | `""` | Fine-grained PAT; leer = Publish noch nicht bereit |
| `catalog_url` | nein | `https://frickeldave.de/data/handmade.json` | Importquelle |
| `image_base_url` | nein | `https://raw.githubusercontent.com/Frickeldave/frickeldave.github.io/dev/src/assets/handmade` | Bildbasis |

Vor dem Anlegen prüft der Flow:

- Basis vorhanden (`async_get_facade(hass) is not None`), sonst Abbruch `base_missing` / `base_not_configured`;
- Basis-Vertrag ausreichend (`CONTRACT_VERSION >= MIN_CONTRACT_VERSION`), sonst `base_too_old`;
- URLs sind `https` und liegen in der festen Allowlist der Erweiterung; sonst `invalid_source_url`.

**Optionen (`async_step_init`):** dieselben Felder. Ein leeres Token-Feld behält das gespeicherte Token; die UI zeigt `token_set` statt des Werts. Speichern schreibt die Optionen und lädt den Entry neu. Die Erweiterung registriert danach ihre Features neu (`ready` aktualisiert).

**Token-Speicherung:** Im Config Entry der Erweiterung (`.storage/core.config_entries`), wie bei HA-Integrationen üblich. Das Token wird nie über die API zurückgegeben, nie geloggt, nie in Fehlermeldungen oder Exporte geschrieben. Die UI zeigt nur `token_set`.

**`ready`-Definitionen:**

- `publish` ist bereit, wenn `repository`, `prod_workflow` und `token` gesetzt sind (Branches haben Defaults).
- `import` ist bereit, wenn `catalog_url` und `image_base_url` gültige `https`-URLs in der Allowlist sind (Defaults sind gültig).
- Ist ein Feature nicht bereit, wird es trotzdem mit `ready=false` und `reason` registriert, damit `/settings` den Grund zeigt und die Erweiterung ein Repair-Issue anlegen kann. Die Basis meldet `features.* = false`; die Buttons bleiben verborgen.

##### 4.2 Token-Migration: warum neu eingeben?

Der Token ist write-only und über die API nicht auslesbar. Dieses ADR führt **keinen** Migrationspfad ein, der das Geheimnis durch die Basis an die Erweiterung reicht. Begründung:

- Ein solcher Pfad wäre ein neuer, dauerhafter Secret-Exfiltrationspunkt in der Basis und würde die Open-Source-Hygiene untergraben.
- Ein neuer Fine-grained-Token mit minimalen Rechten ist sicherer als ein alter Token, dessen tatsächlicher Umfang unbekannt ist.
- Der Aufwand für den Bestandsnutzer ist einmalig: Repository/Branches/Workflow sind bekannt oder vorbelegt; nur der Token wird neu erzeugt.

**Empfohlene Token-Rechte:** Repository access nur `Frickeldave/frickeldave.github.io`; `Contents: Read and write` (Commit über die Git-Data-API), `Actions: Read and write` (Workflow-Dispatch), `Metadata: Read`. Keine Organisationsweite Freigabe.

**Optionaler Komfort (nicht Teil von Contract 1):** Ein „Verbindung testen“-Button im Options-Flow, der `GET /repos/{repository}` aufruft und die Push-/Actions-Rechte prüft. Er ist optional und blockiert die Einrichtung nicht.

##### 4.3 Was passiert mit den bisherigen Publish-Settings in der Basis?

**Entscheidung: ignorieren und unangetastet lassen, in `0.3.0` entfernen.**

- `settings.publish` bleibt im Datenfile erhalten. `coerce_payload` darf unbekannte Settings-Schlüssel nicht mehr verwerfen; `default_settings()` erzeugt für neue Stores kein `publish` mehr.
- `public_settings()` gibt `publish` nicht mehr aus; `SettingsView` akzeptiert `publish` nicht mehr; `_persist_publish_options` entfällt; `_async_apply_entry_config` wendet `settings.publish` nicht mehr an.
- Die alten Config-Entry-Options `github_repository`, `github_dev_branch`, `github_prod_workflow`, `github_token` bleiben in `.storage/core.config_entries` stehen. Der Options-Flow der Basis muss unbekannte Optionsschlüssel **erhalten** (Options-Dict kopieren und nur eigene Keys aktualisieren), damit ein Rollback auf `0.1.14` sie wiederfindet.
- Kein Store-Schema-Bump nur wegen des entfallenden `publish`-Blocks; `SCHEMA_VERSION` bleibt 2. Die Config-Entry-Version wird in `0.2.0` auf 2 erhöht, um die neuen Exportpfad-Optionen einmalig zu migrieren.
- In `0.3.0` kann ein expliziter Cleanup die veralteten Schlüssel entfernen; bis dahin sind sie inert. Die Migrationsanleitung empfiehlt, den alten PAT zu widerrufen; damit ist ein zurückbleibender Token wertlos.

##### 4.4 Nutzeranleitung (Schritt für Schritt)

1. **Vor dem Update:** In der Basis unter Einstellungen → Frickeldave Store → Veröffentlichen das Repository, die Branches und den Workflow notieren. Der Token wird nicht angezeigt; das ist beabsichtigt.
2. **Neuen Token erzeugen:** GitHub → Settings → Developer settings → Fine-grained tokens → Repository `Frickeldave/frickeldave.github.io`, Rechte `Contents: Read and write`, `Actions: Read and write`, `Metadata: Read`.
3. **Basis auf `0.1.15` aktualisieren** (Brückenversion, sofern freigegeben), neu starten. Veröffentlichen/Import funktionieren unverändert.
4. **Erweiterung installieren:** HACS → Integrationen → Benutzerdefinierte Repositories → `https://github.com/Frickeldave/homeassistant-frickeldave-store-syncfd`, Kategorie Integration → installieren → HA neu starten.
5. **Erweiterung einrichten:** Einstellungen → Geräte & Dienste → Integration hinzufügen → „Frickeldave Store Sync“. Repository/Branches/Workflow eintragen, neuen Token einfügen, speichern.
6. **Verifizieren:** Im Panel erscheinen die Veröffentlichungs-Buttons (wenn `app_admin`) und der Import-Button (wenn `product`). Zuerst Dry-Run für `dev`; Dateiliste und Zählungen prüfen. Danach optional echt veröffentlichen; Import ebenfalls zuerst als Dry-Run.
7. **Basis auf `0.2.0` aktualisieren**, neu starten. Die Features bleiben sichtbar, weil die Erweiterung registriert ist.
8. **Alten Token widerrufen.** Optional nach der Rollback-Frist `settings.publish` aus der Basis-Store-Datei entfernen (nur mit Backup; die Basis liest es nicht mehr).
9. **Wenn etwas fehlt:** Siehe 4.6 und Abschnitt 7.

**Wenn der Nutzer zuerst `0.2.0` installiert:** Veröffentlichen/Import-Buttons verschwinden, ein Repair-Issue erklärt den Schritt. Es geht kein Datenverlust einher; die Erweiterung kann jederzeit nachgezogen werden. Der alte Token wird nicht mehr verwendet.

##### 4.5 Repair-Issue statt stiller Degradierung

Die Basis legt nach `EVENT_HOMEASSISTANT_STARTED` (und erneut bei `frickeldave_store_features_changed`) ein Repair-Issue an, wenn:

- `settings.publish` einen `token_set` oder ein `repository` enthält **und**
- kein `publish`-Provider registriert ist (weder Erweiterung noch Built-in-Fallback).

Issue-ID: `publish_moved_to_extension`; `is_fixable=False`, `severity=WARNING`, `translation_key` in `strings.json`/`translations`. Text: Veröffentlichen/Import wurden in die Erweiterung ausgelagert; Installation über HACS; neuen Token anlegen; alten widerrufen. Das Issue wird gelöscht, sobald ein `publish`-Provider registriert ist oder die Legacy-Settings entfernt wurden.

Die Erweiterung legt ein eigenes Issue `publish_not_configured` an, wenn ihr Entry ohne Token läuft; es wird gelöscht, sobald `publish` bereit ist. So gibt es keine doppelten Issues: Die Basis meldet nur „kein Provider“, die Erweiterung meldet „Provider, aber unkonfiguriert“.

##### 4.6 Rollback

- Basis `0.1.14` über HACS installieren (Version auswählen), Erweiterung vorher deaktivieren/deinstallieren, HA neu starten.
- `settings.publish` und `github_*`-Options sind in `0.2.0` erhalten geblieben; `0.1.14` liest sie wieder. Ist der alte Token widerrufen, muss im alten Options-Flow ein gültiger Token eingetragen werden.
- Kein Store-Schema-Bump; die Store-Datei ist mit `0.1.14` kompatibel. Die neuen Exportpfad-Options werden von `0.1.14` ignoriert.
- Die Erweiterung kann installiert bleiben, ist mit Basis `0.1.14` aber funktionslos (kein `extension`-Modul); sie sollte deaktiviert werden, um Fehlermeldungen zu vermeiden.

---

#### 5. Versionierung und Verteilung

##### 5.1 Versionen

| Repository | Version | Charakter | Inhalt |
| --- | --- | --- | --- |
| Basis | `0.1.15` | Minor, additiv (Brücke) | Contract 1, Feature-Route, `features` in `/me`/`/settings`, Fassade, Built-in-Fallback für Publish/Import; bestehende Endpunkte bleiben vorerst |
| Erweiterung | `0.1.0` | Erstrelease | Verschobenes Publish/Import, Config-/Options-Flow, Token write-only |
| Basis | `0.2.0` | Major, breaking | Entfernt Publish/Import, Publish-Settings, GitHub-Options, frickeldave-Defaults; generische Basis |
| Basis | `0.3.0` (perspektivisch) | Minor/Major | Entfernt Legacy-Settings-Keys, ggf. Contract 2, ggf. Repo-/Produkt-Rename |

SemVer: Die Basis folgt SemVer; `0.2.0` ist der Breaking Release. Die Erweiterung startet bei `0.1.0` und bleibt in `0.x`, bis der Vertrag stabil ist. Git-Tag = Manifest-Version ohne `v`; HACS-Release ist kein Draft und kein Pre-Release.

##### 5.2 HACS-Metadaten

**Basis `Frickeldave/frickeldave.home.net`:**

- `manifest.json`: `domain: frickeldave_store`, `version: 0.2.0`, `config_flow: true`, `dependencies: [http, panel_custom, websocket_api]`, `documentation`/`issue_tracker` auf die Basis-URLs, `codeowners: ["@Frickeldave"]`.
- `hacs.json`: `name: "Frickeldave Store"`, `render_readme: true`, `homeassistant: "2024.6.0"`; `country` entfernen (Community-neutral).
- Release `0.2.0`, Notes aus `CHANGELOG.md`, Breaking-Hinweis mit Migrationslink.

**Erweiterung `Frickeldave/homeassistant-frickeldave-store-syncfd`:**

- `custom_components/frickeldave_store_sync/manifest.json`:
  - `domain: "frickeldave_store_sync"`, `name: "Frickeldave Store Sync"`, `version: "0.1.0"`;
  - `config_flow: true`, `integration_type: "service"`, `iot_class: "cloud_polling"`;
  - `dependencies: ["frickeldave_store"]`;
  - `documentation`/`issue_tracker` auf das Extension-Repo, `codeowners: ["@Frickeldave"]`;
  - `requirements: []`.
- `hacs.json`: `name: "Frickeldave Store Sync"`, `render_readme: true`, `homeassistant: "2024.6.0"`; kein `country`.
- Release `0.1.0`, Notes aus `CHANGELOG.md`, Installationsreihenfolge und Basis-Mindestversion (`>= 0.1.15`, kompatibel mit `0.2.0`).

Beide Repos: `brand/icon.png`, `LICENSE` (MIT), `README`, `CHANGELOG`, Topics (`home-assistant`, `hacs`, `integration`), Issue-Templates, PR-Template, CI mit `hassfest`, HACS-Action, `ruff`, `mypy`, `pytest`.

##### 5.3 Release-Reihenfolge (empfohlen, mit Brücke)

1. **Basis `0.1.15`** — additiv. Enthält Contract 1, Feature-Route, `features`-Flags und die Built-in-Fallback-Provider. Die bestehenden Endpunkte `/publish` und `/import/catalog` bleiben für externe Skripte vorerst erhalten (deprecated). Die Basis funktioniert allein unverändert.
2. **Erweiterung `0.1.0`** — nach grüner CI gegen Basis `0.1.15` und `0.2.0`. Der Nutzer kann sie installieren, konfigurieren und vor dem Breaking Update verifizieren. Wo die Erweiterung `ready` ist, übernimmt sie die Features; wo nicht, nutzt die Basis den Built-in-Fallback.
3. **Basis `0.2.0`** — entfernt Publish/Import, die alten Endpunkte, die Publish-Settings und die Built-in-Provider. Die Erweiterung ist bereits verfügbar; bestehende Installationen wechseln ohne Feature-Lücke.

Diese Reihenfolge verhindert das Zeitfenster, in dem Veröffentlichen/Import weder in der Basis noch in der Erweiterung verfügbar sind.

##### 5.4 Fallback ohne Brücke

Wenn David die Zwischenversion `0.1.15` ablehnt:

- Basis `0.2.0` zuerst veröffentlichen (enthält Contract 1), unmittelbar danach Erweiterung `0.1.0`.
- Für die Dauer zwischen den Releases sind die Buttons verborgen; das Repair-Issue erklärt es. Kein Datenverlust, aber eine sichtbare Feature-Lücke.
- Die Erweiterung darf nicht vor der Basis `0.2.0` veröffentlicht werden, weil sie das `extension`-Modul benötigt.

##### 5.5 Wie verhindert man die halbe Migration?

1. **Feature-Flags statt kaputter Aufrufe:** Ohne Erweiterung sind die Buttons nicht sichtbar; ein direkter Aufruf liefert `409 feature_unavailable` mit klarer Meldung.
2. **Repair-Issue:** Die Basis meldet Legacy-Settings ohne Provider; die Erweiterung meldet fehlenden Token. Beide verlinken auf die Migration.
3. **Extension-Guards:** Config Flow bricht bei fehlender/zu alter/nicht eingerichteter Basis ab; `async_setup_entry` wirft `ConfigEntryNotReady` mit klarer Meldung.
4. **Daten bleiben:** `0.2.0` löscht weder `settings.publish` noch `github_*`-Options. Ein Nutzer, der nur die Basis aktualisiert, verliert die UI, nicht die Daten; die Erweiterung kann später nachgezogen werden.
5. **Release Notes und README:** Explizite Reihenfolge, Token-Anleitung, Rollback. HACS kann keine Abhängigkeiten erzwingen; die Dokumentation und das Repair-Issue sind das Sicherheitsnetz.
6. **Installationsmatrix in CI/QA:** Basis-only, Extension-only, beide, alte/neue Kombinationen, Rollback.

##### 5.6 Kompatibilitätsmatrix

| Basis | Erweiterung | Erwartung |
| --- | --- | --- |
| `0.1.14` | nicht installiert | Alles wie bisher; keine Features-Flags. |
| `0.1.14` | `0.1.0` | Erweiterung startet nicht (kein `extension`-Modul); Config Flow `base_too_old`; klare Meldung. |
| `0.1.15` | nicht installiert | Built-in Publish/Import funktionieren; `features` true; keine Extension-Details. |
| `0.1.15` | `0.1.0` (konfiguriert) | Erweiterung übernimmt Publish/Import; Built-in bleibt Fallback. |
| `0.1.15` | `0.1.0` (ohne Token) | Publish nutzt Built-in-Fallback; Import ggf. Erweiterung; `/settings` zeigt `reason`. |
| `0.2.0` | nicht installiert | Publish/Import-Buttons weg; Repair-Issue; kein Datenverlust. |
| `0.2.0` | `0.1.0` (konfiguriert) | Voller Funktionsumfang über die Erweiterung. |
| `0.2.0` | `0.1.0` (ohne Token) | Import ggf. verfügbar; Publish weg; Repair-Issue der Erweiterung. |
| `0.2.0` | `0.2.x` (Contract 2) | Basis akzeptiert nur `<= CONTRACT_VERSION`; neuere Erweiterung wird abgelehnt. |

---

#### 6. Open-Source-Hygiene der Basis

##### 6.1 Muss aus der Basis verschwinden

- **Code:** `publish.py`, `importer.py`, `PublishView`, `CatalogImportView`, `PublishService` im Runtime, `_persist_publish_options`, Publish-/Import-Tests.
- **Konstanten:** `DEFAULT_PUBLISH_REPOSITORY`, `DEFAULT_PUBLISH_DEV_BRANCH`, `DEFAULT_PUBLISH_PROD_BRANCH`, `DEFAULT_PUBLISH_PROD_WORKFLOW`, `DEFAULT_CATALOG_URL`, `DEFAULT_IMAGE_BASE_URL`, `IMPORT_ALLOWED_HOSTS`, `ISSUE_URL` mit `#289`.
- **Frickeldave-URLs/Repo-/Workflow-Namen:** `frickeldave.de`, `frickeldave.github.io`, `raw.githubusercontent.com/Frickeldave/...`, `fd-ci`, `fd-deploy-dev`, `fd-deploy-prd`, `Frickeldave/frickeldave.github.io`.
- **Config-/Options-Flow:** `github_repository`, `github_dev_branch`, `github_prod_workflow`, `github_token`; die zugehörigen Übersetzungen.
- **Panel:** Der Tab „Veröffentlichen“ im Config-Panel; der hartcodierte Satz „Der aktuelle Katalog von **frickeldave.de** …“ im Import-Dialog; die Publish-Settings-Formulare.
- **Doku:** Publish-/Import-Abschnitte in Basis-README und `docs/`; sie werden durch einen Verweis auf die Erweiterung und `docs/migration-0.2.md` ersetzt.
- **Metadaten:** `country: ["DE"]` in `hacs.json` (optional; für eine internationale Community entfernen).

##### 6.2 Bleibt als sinnvoller Default

- Domain `frickeldave_store`, Storage-Keys, Datenordner `frickeldave_store`, Bildlayout `<artikelnummer>/<name>`, Rollen und Rechte, Default Deny, Soft-Delete, Buchungen, Lagerstätten.
- Der Katalogexport samt stabilem `stock`/`salesCabinet`-Mapping (Entscheidung vom 2026-11-02 bleibt gültig).
- KI-Anbieter-Abstraktion und DeepSeek-Defaults (Endpunkt/Modell bleiben konfigurierbar).
- Panel, Bildoptimierung, Backup/Snapshot, lokaler Export, deutsche/englische Übersetzungen.
- Markenname „Frickeldave Store“ für `0.2.0`. Ein neutraler Produktname ist eine separate Breaking Change (siehe offene Fragen).

##### 6.3 Generische Defaults

| Konstante/Einstellung | Neuer Default | Migration |
| --- | --- | --- |
| `DEFAULT_AI_PROMPT` | `"Write a concise, appealing product description for an online shop."` | Bestehende gespeicherte Prompts bleiben unverändert; nur neue Installationen sehen den neuen Default. |
| `CATALOG_DESCRIPTION` | `"Generated by Frickeldave Store"` | Einmaliger Katalog-Diff beim ersten Publish nach `0.2.0`; akzeptiert und in den Release Notes genannt. Alternativ als Export-Option konfigurierbar. |
| Export-Katalogpfad | `data/catalog.json` | Bestehende Entries erhalten in `async_migrate_entry` die Legacy-Werte `public/data/handmade.json`; neue Installationen bekommen den generischen Default. |
| Export-Bildpfad | `images` | Dito: bestehende Entries `src/assets/handmade`, neue `images`. |
| `ISSUE_URL` | `f"{REPOSITORY_URL}/issues"` | Kein `#289` mehr. |
| `REPOSITORY_URL` | Basis-Repo (`Frickeldave/frickeldave.home.net`) | Bei einem Repo-Rename in `0.3.0` an einer Stelle aktualisieren. |
| HACS `country` | entfernt | Keine funktionale Änderung. |

Die Erweiterung übergibt beim Publish explizit die Website-Pfade `public/data/handmade.json` und `src/assets/handmade`; damit bleibt der Website-Output byte-identisch, während die Basis generisch wird.

##### 6.4 Doku, Lizenz, Übersetzungen, Templates, CI

- **Lizenz:** MIT bleibt; `LICENSE` in beiden Repos, Lizenzabschnitt im README.
- **README Basis:** Was ist das, Features, Installation über HACS, Einrichtung, Optionen, Datenorte/Backup, Rechte-Matrix, KI, Exportformat, Erweiterungen (Verweis auf Sync), Migration `0.1.x → 0.2.0`, Support, Contributing, Lizenz. Beispiele mit `owner/repo`, nicht mit Frickeldave-URLs.
- **README Erweiterung:** Voraussetzung Basis, Installation über HACS, Einrichtung, Token-Rechte, Migration, Troubleshooting, Grenzen (kein Add-on, kein Supervisor), Rollback.
- **`docs/extension-api.md`:** Contract 1, Lebenszyklus, Feature-Payloads, Fehler, Event, Minimalbeispiel, Stabilitätszusage.
- **`docs/migration-0.2.md`:** Die Schritte aus 4.4 inkl. Token-Widerruf und Rollback.
- **Übersetzungen:** Basis de/en ohne Publish/Import-Keys, mit Repair-Issue-Texten; Erweiterung de/en mit Config-/Options-Flow, Fehlern, Repair-Issue.
- **Templates:** `.github/ISSUE_TEMPLATE/bug.yml` (HA-Version, Basis-Version, Extension-Version, Installationsart, Logs, Panel/App), `feature_request.yml`, `config.yml`; `.github/pull_request_template.md`; `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`.
- **CI:** Beide Repos: `ruff`, `mypy`, `pytest`, `hassfest`, HACS-Action. Erweiterung zusätzlich Cross-Repo-Matrix gegen Basis `0.1.15`/`0.2.0`. Basis zusätzlich Hygiene-Test (keine Frickeldave-Spezifika im Paket).

##### 6.5 Was nicht in `0.2.0` gehört (bewusst zurückgestellt)

- **Repo-/Produkt-Rename:** Ein Rename von `frickeldave.home.net` oder der Domain `frickeldave_store` ist eine eigene Breaking Change mit Datenmigration und HACS-URL-Wechsel. Empfehlung: `0.2.0` behält Namen und Domain; Rename in `0.3.0` prüfen.
- **Katalog-Schema generalisieren:** `stock`/`salesCabinet` bleiben, weil die Website und die bestehende Entscheidung daran hängen. Eine generische Lagerstätten-Repräsentation wäre ein Schema-Bump.
- **Extension-provided UI-Module:** Die Publish-/Import-Dialoge bleiben in der Basis und werden gegatet. Ein dynamisches UI-Modul der Erweiterung wäre ein zusätzlicher Vertrag und eine Sicherheitsfläche; erst bei Bedarf.
- **Token-Auto-Migration:** Nicht einführen (siehe 4.2).
- **API-i18n:** Die Basis-API-Meldungen bleiben in `0.2.0` deutsch; die stabilen `code`-Werte sind sprachneutral. Eine Übersetzung der Meldungen ist eine spätere Verbesserung.

---

#### 7. Risiken und Rückfallweg

##### 7.1 Risiken

| Risiko | Wirkung | Gegenmaßnahme | Absicherung |
| --- | --- | --- | --- |
| Nutzer aktualisiert nur die Basis auf `0.2.0` | Publish/Import-UI verschwindet | Repair-Issue, Release Notes, Brücke `0.1.15`, Daten bleiben | Basis-only-Test, manuelle Matrix |
| Nutzer installiert die Erweiterung ohne Basis | Setup schlägt fehl | `dependencies`, Config-Flow-Abbruch `base_missing`, README-Reihenfolge | Extension-only-Test |
| Basis zu alt für die Erweiterung | ImportError/Setup-Fehler | `base_too_old`, Contract-Check, Brücke | Kompatibilitätsmatrix |
| Token geht verloren/vergessen | Publish blockiert | Neue-PAT-Anleitung, Defaults vorbelegt, Repair-Issue, optionaler Verbindungstest | Config-Flow-Test |
| Halbe Migration / Verwirrung | Features fehlen ohne Erklärung | Feature-Flags, Repair-Issue, Migrationsdoku | Installationsmatrix |
| Veraltetes Panel zeigt Buttons | 409-Fehler beim Klick | Event + `feature_unavailable`-Behandlung + `/me`-Refresh | Frontend-Test |
| Publish-Regression (GitHub, leerer Katalog) | Falscher Commit/Deploy | Portierte Tests, Dry-Run zuerst, Feature-Flag | `test_publish.py` |
| Import schreibt teilweise | Inkonsistenter Store | Validate-then-apply, ein Snapshot, ein Save, Fehler je Item | Batch-Tests |
| Secret-Leak | Token in Logs/API | Write-only, keine Payload-Logs, Redaktion, eigener Token | Tests + Review |
| Contract-Drift | Erweiterung bricht nach Basis-Update | Versionierter Contract, N/N-1, CI-Matrix | `test_compat.py` |
| Rollback scheitert | Nutzer kann nicht zurück | Legacy-Settings/Options erhalten, kein Schema-Bump | Rollback-Test |
| HACS installiert keine Abhängigkeiten | Falsche Reihenfolge | Doku, Repair-Issue, Config-Flow-Guards | Manuelle Matrix |
| In-Process-Erweiterung hat volle HA-Rechte | Keine echte Sandbox | Code-Review, minimale Token-Rechte, klare Vertragsregeln; Sicherheitsgrenze dokumentieren | Review |

**Sicherheitshinweis:** Der Vertrag ist eine architektonische Grenze, keine Sandbox. Eine Custom Integration läuft im HA-Prozess und kann technisch alles; die Fassade verhindert versehentliche Kopplung, nicht böswilligen Code. Die Erweiterung wird wie jeder Custom-Integration-Code behandelt und reviewt.

##### 7.2 Rückfallweg

1. Erweiterung deaktivieren (Config Entry deaktivieren oder Integrationsdateien entfernen), HA neu starten.
2. Basis `0.1.14` über HACS installieren (Version auswählen), HA neu starten.
3. `settings.publish` und `github_*`-Options sind erhalten; bei widerrufenem Token einen gültigen Token im alten Options-Flow eintragen.
4. Store-Datei ist schema-kompatibel; die neuen Exportpfad-Options werden ignoriert.
5. Die Erweiterung kann installiert bleiben, ist mit `0.1.14` aber funktionslos; deaktivieren, um Fehler zu vermeiden.

##### 7.3 Tests, die die Grenze absichern

Die konkreten Testdateien stehen in 3.5. Zusätzlich als Abnahmekriterien:

- **Basis ohne Erweiterung:** `0.2.0` startet, Panel funktioniert, Publish/Import-Buttons sind weg, keine Exception, keine Frickeldave-URLs im Paket.
- **Basis mit Erweiterung:** `publish`/`import` erscheinen nur bei `ready` und Rolle; Dry-Run und echter Lauf funktionieren; Fehler werden als `{"error": {"code", "message"}}` angezeigt.
- **Deaktivierung bei offenem Panel:** Event oder 409 schließt den Dialog, entfernt die Buttons, zeigt einen Banner; kein Datenverlust.
- **Import:** Dry-Run schreibt nichts (Hash über alle Dateien), Overwrite-Semantik unverändert, Bilder nur ergänzt, Archiv bleibt Archiv.
- **Publish:** Dry-Run schreibt nichts, dev/prod-Semantik unverändert, leerer Katalog blockiert, chunked GitHub-Antworten funktionieren.
- **Migration:** Altbestand mit `settings.publish` lädt, `/settings` leakt nichts, Speichern erhält den Schlüssel, Rollback `0.2.0` → `0.1.14` liest die alten Werte.
- **Hygiene:** Keine `frickeldave.de`/`fd-deploy`/`frickeldave.github.io`-Strings im Basispaket; nur die zulässige Basis-Repo-URL und der Markenname.

---

#### Umsetzungsreihenfolge

Die Pakete sind so geschnitten, dass die Basis jederzeit standalone grün bleibt und die Erweiterung erst auf einen stabilen Contract aufsetzt. „Abhängig von“ meint inhaltliche Voraussetzung, nicht zwingend zeitliche Blockade.

| # | Rolle | Arbeitspaket | Ergebnis | Abhängig von |
| --- | --- | --- | --- | --- |
| 1 | **Nick** | Erweiterungs-Repo-Gerüst: `custom_components/frickeldave_store_sync/`, `manifest.json`, `hacs.json`, CI (ruff/mypy/pytest/hassfest/HACS), Issue-/PR-Templates, Topics, `brand/icon.png` | Installierbares Skelett, CI grün | — |
| 2 | **Bruce** | Basis-Contract: `extension.py` (Datentypen, Registry, Fassade-Protocol, `ExtensionError`), Feature-Route `POST /features/{feature}`, `features` in `/me`/`/settings`, Event, Tests | Contract 1 in Basis `0.1.15` | — |
| 3 | **Bruce** | Basis-Fassade: `async_build_export`, `async_apply_import_batch`, `async_create_snapshot`, `can/require`, konfigurierbare Exportpfade, Legacy-Settings-Pass-through, Hygiene-Test | Generische Fähigkeiten + Tests | 2 |
| 4 | **Natasha** | Panel: Feature-State aus `/me`, Gating Topbar/Dialoge, `feature_unavailable`-Behandlung, Event-Subscription, Import-Dialog neutralisieren, Config-Panel-Tab „Veröffentlichen“ entfernen, „Erweiterungen“-Status | Panel `0.2.0` UI | 2 (mit Mock) |
| 5 | **Bruce** | Erweiterung Publish: `publish.py` portieren, `async_build_export` nutzen, Config-/Options-Flow (Repo/Branches/Workflow/Token), Token write-only, Fehler-Mapping, Tests | Publish-Feature | 1, 2, 3 |
| 6 | **Bruce** | Erweiterung Import: `importer.py` portieren, Allowlist/Defaults, Dry-Run/Overwrite, `async_apply_import_batch`, Tests | Import-Feature | 1, 2, 3 |
| 7 | **Maria** | Basis-Doku: README generisch, `docs/extension-api.md`, `docs/migration-0.2.md`, CHANGELOG `0.1.15`/`0.2.0`, Architektur aktualisieren | Doku Basis | 2, 3 |
| 8 | **Maria** | Erweiterungs-Doku: README, Token-Anleitung, Installationsreihenfolge, Troubleshooting, CHANGELOG `0.1.0` | Doku Erweiterung | 1, 5, 6 |
| 9 | **Nick** | CI/HACS: Cross-Repo-Matrix (Basis `0.1.15`/`0.2.0`), Tag/Manifest-Check, Release-Checkliste, HACS-Validierung | Grüne Pipelines | 1, 5, 6 |
| 10 | **Bruce** | Basis `0.2.0`: Publish/Import entfernen, Settings/Config-Flow bereinigen, Repair-Issue, Legacy-Daten erhalten, Exportpfad-Migration, Tests | Breaking Release | 3, 4, 5, 6 |
| 11 | **Natasha** | Panel-Feinschliff: Fehlertexte, Barrierefreiheit, Dialog-/Tab-Verhalten, Frontend-Tests | Finale UI | 4, 10 |
| 12 | **Maria** | Open-Source-Hygiene: Übersetzungen, Issue-Templates, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, Release Notes | Community-Readiness | 7, 8 |
| 13 | **Nick** | Releases: Basis `0.1.15` → Erweiterung `0.1.0` → Basis `0.2.0`; Installations-/Rollback-Matrix | Veröffentlichte Versionen | 9, 10, 11, 12 |
| 14 | **Clint / Tony** | QA/Abnahme: Upgrade, Rollback, Feature-Gating, Publish/Import, Token, Contract-Kompatibilität | Abnahme | 13 |

**Kritischer Pfad:** 2 → 3 → 5/6 → 10 → 13. Parallel laufen 1 (Repo), 4 (Panel gegen Mock), 7/8 (Doku) und 9 (CI). Der Contract-Review durch Tony und Natasha ist ein Gate nach Paket 2; die Fassade wird nach Paket 3 gegen die alten `build_artifacts`/Importer-Tests golden geprüft.

**Release-Gates:**

- **Gate A (nach 2):** Contract dokumentiert, Tests grün, Natasha kann das Panel gegen Mocks bauen.
- **Gate B (nach 3):** Basis standalone grün; `async_build_export` byte-identisch; Batch-Tests grün; Hygiene-Test grün.
- **Gate C (nach 5/6):** Erweiterung grün gegen Basis `0.1.15` und `0.2.0`; Publish-/Import-Tests portiert.
- **Gate D (nach 10):** Basis `0.2.0` ohne Erweiterung grün; Repair-Issue getestet; keine Frickeldave-Spezifika im Paket.
- **Gate E (nach 13):** Installationsmatrix und Rollback manuell bestätigt; HACS-Release nicht Draft/Pre-Release; Tag = Manifest-Version.

---

#### Offene Fragen mit Empfehlung

1. **Brückenversion `0.1.15` oder nur zwei Releases?**
   *Empfehlung:* Brücke. Sie ist additiv, ermöglicht die Verifikation vor dem Breaking Update und vermeidet das Feature-Lücken-Fenster. Fallback: `0.2.0` zuerst, Extension unmittelbar danach, Repair-Issue als Netz.

2. **Token automatisch migrieren?**
   *Empfehlung:* Nein. Der Token ist write-only und soll es bleiben. Neuer Fine-grained-Token + Widerruf des alten ist sicherer und vermeidet einen dauerhaften Secret-Pfad in der Basis. Ein optionaler Einmal-Migrationsleser wäre nur mit expliziter David-Entscheidung und befristet auf `0.2.x` zu bauen.

3. **Basis-Repo oder Produkt umbenennen?**
   *Empfehlung:* In `0.2.0` nicht. Domain `frickeldave_store` und Repo `frickeldave.home.net` bleiben, um HACS-Installationen und Daten nicht zu brechen. Ein neutraler Name/Repo-Rename ist eine eigene Breaking Change für `0.3.0` (GitHub-Redirects helfen, HACS-URLs und Doku müssen mit).

4. **Exportpfade in `0.2.0` generisch machen?**
   *Empfehlung:* Ja, mit Migration: bestehende Entries behalten `public/data/handmade.json`/`src/assets/handmade`, neue bekommen `data/catalog.json`/`images`. Wenn der Release-Umfang zu groß wird, ist die Minimalvariante, die Legacy-Defaults zu behalten und die Optionen erst in `0.3.0` einzuführen.

5. **Katalog-Schema (`stock`/`salesCabinet`) generalisieren?**
   *Empfehlung:* Nein in `0.2.0`. Die bestehende Entscheidung und die Website hängen daran. Eine generische Lagerstätten-Repräsentation wäre ein Schema-Bump und ein separates ADR.

6. **Extension-provided UI-Module?**
   *Empfehlung:* Nein in `0.1.0`. Die Publish-/Import-Dialoge bleiben in der Basis und werden gegatet. Das ist weniger Vertrag, weniger Sicherheitsfläche und erfüllt die Anforderung „Buttons nur bei installierter/eingerichteter Erweiterung“.

7. **API-Meldungen internationalisieren?**
   *Empfehlung:* `0.2.0` behält deutsche Meldungen und stabile `code`-Werte. Eine Übersetzung nach `hass.config.language` ist eine spätere Verbesserung; die Erweiterung kann ihre Meldungen selbst lokalisieren.

8. **Feature-Namen namespacen (`sync.publish`)?**
   *Empfehlung:* `publish`/`import` bleiben für `0.2.0` reserviert. Wenn weitere Erweiterungen eigene Features anbieten, in Contract 2 auf `namespace.feature` wechseln.

9. **Import-Rolle `product` beibehalten?**
   *Empfehlung:* Ja, entsprechend der bestehenden Entscheidung vom 2026-11-02. `overwrite` ist ein Sammel-Update auf Felder, die `product` ohnehin ändern darf; eigene Quellen bleiben `app_admin`.

10. **Legacy-Hinweise (Repo/Branches) für die Vorbelegung lesen?**
    *Empfehlung:* Nein für Contract 1. Die Defaults der Erweiterung entsprechen den bisherigen Werten; ein zusätzlicher Lesezugriff auf `settings.publish` wäre nur Komfort und würde die Grenze unnötig aufweichen.

---

#### Referenzen

- `.squad/decisions.md`: `2026-11-02T07:24:38+0000: Veröffentlichung nach dev und prod läuft ausschließlich über dev + fd-deploy-prd`
- `.squad/decisions.md`: `2026-11-02T07:24:38+0000: Lagerstätten ersetzen stock/salesCabinet; Website-Abbildung bleibt stabil`
- `.squad/decisions.md`: `2026-11-02T13:30:51+0000: Katalogimport mit Dry-Run und Überschreiben`
- `.squad/decisions.md`: `2026-11-02T14:21:10+0000: Veröffentlichen-Fehler eingegrenzt`
- `.squad/decisions.md`: `2026-11-02T11:24:46+0000: Datenverlust bei Update behoben`
- `.squad/decisions.md`: `2026-11-02T16:05:00+0000: Doku 0.1.14 — Bilder, Optimierung und Tab „Allgemeine Einstellungen“`
- Basis-Repository `Frickeldave/frickeldave.home.net`, Commit `286096e`, `custom_components/frickeldave_store/` (`__init__.py`, `const.py`, `publish.py`, `importer.py`, `views.py`, `store.py`, `products.py`, `permissions.py`, `export.py`, `config_flow.py`, `frontend/frickeldave-store-panel.js`, `frontend/frickeldave-store-config-panel.js`)
- Erweiterungs-Repository `Frickeldave/homeassistant-frickeldave-store-syncfd`, Default-Branch `main`, aktuell nur `LICENSE` und `README.md`
- Issue #289 „Management Tool in HomeAssistant“ (gelesen, nicht verändert)

#### 2026-11-02T17:05:00+0000: Veröffentlichung löschte 3D-Modelle

**By:** Bruce (Backend / Scripts / Komponenten)

**What:** Die Integration veröffentlicht nach `dev`, indem sie ihren kompletten
Dateisatz (`public/data/handmade.json` + Produktbilder) mit dem GitHub-Baum
vergleicht und alles, was im Store fehlt, als `removed` committet. Maßgeblich war
`_is_managed_path`; es stufte **jeden** Pfad unter `src/assets/handmade` als
verwaltetes Produktbild ein. Mit dem Publish `d13cb2f` (Integration 0.1.13)
verschwanden dadurch `src/assets/handmade/3dmodels/includes/roundedcube.scad`
und `src/assets/handmade/3dmodels/models/Verteilerdose.scad` aus `dev`; `fd-ci`
(Lauf `41475789176`) wurde rot (`scad-smoke-test`, `e2e-test`), `fd-deploy-dev`
(`41476094701`) übersprungen.

Entscheidungen (Integration 0.1.15, Issue #289):

1. **Verwaltete Pfade sind abschließend definiert:** `public/data/handmade.json`
   und ausschließlich
   `src/assets/handmade/<Kategorie>/<Artikelnummer>/<Artikelnummer>-NN.<Endung>`
   mit Kategorie aus `models.CATEGORIES` (`3D`, `EP`, `LA`, `SB`, `WO`), einer
   Artikelnummer, die mit ihrer Kategorie beginnt, und einer zweistelligen
   Bildnummer. Alles andere unter `src/assets/handmade` – `3dmodels/**`,
   `.gitkeep`, Unterordner ohne Artikelmuster, fremde Artikelnummern – gehört der
   Website und wird **nie** als entfernt gemeldet. Das gilt auch dann, wenn die
   Datei im Store nicht existiert.
2. **Bilddateinamen bleiben stabil.** Das Hauptbild heißt weiterhin
   `<Artikelnummer>-01` (die Website zeigt das lexikografisch erste Bild als
   Hauptbild, siehe `src/pages/handmade/[articleNumber].astro`). Alle übrigen
   Bilder behalten ihre eigene Nummer aus dem Store, solange sie frei ist; nur
   eine Kollision vergibt die nächste freie Nummer. Die bisherige
   Durchnummerierung nach Position verschob beim Löschen eines Bildes alle
   folgenden Namen (im Vorfall `LAKBCD-08.jpg` → `LAKBCD-04.jpg` bei
   gleichzeitigem `D LAKBCD-05.jpg`). Diese Umbenennungen waren inhaltlich
   unschädlich, aber unnötig; sie sind damit beendet.
3. **Löschschutz `publish_removal_guard`.** Würde ein Lauf mehr als 10 Bilder
   oder mehr als ein Drittel des bestehenden Bildbestands entfernen (mindestens
   3 Löschungen), bricht er mit `409 publish_removals_blocked` und deutscher
   Meldung ab. Im Dry-Run erscheint dieselbe Meldung als Warnung. Übergehen nur
   mit `"confirm_removals": true` (`POST /publish`, `app_admin`), je Lauf, nicht
   gespeichert. Begründung der Schwellen: ein normaler Publish ändert einzelne
   Bilder; zehn gleichzeitige Löschungen übersteigen jeden realistischen
   manuellen Vorgang, während die Anteilsgrenze zusätzlich kleine Kataloge
   schützt, in denen zehn Dateien fast alles wären. Die Mindestzahl 3 verhindert,
   dass gezielte Einzellöschungen (z. B. 1 von 2 Bildern eines Produkts) in
   kleinen Beständen blockieren.
4. **Gleiche Bildbytes bei zwei Produkten sind kein Zuordnungsfehler.**
   `ImageStorage` legt Bilder je Artikelverzeichnis ab (`images/<Artikel>/`), ein
   Überschreiben über Produktgrenzen ist konstruktiv ausgeschlossen. Im Vorfall
   hatten `3DHP42` (Produkt „Test“) und `LA6BPS` („Herbstkürbis“) dasselbe Foto;
   derselbe Fall existiert bereits länger zwischen `SBAPRV` und `SBIXS4`. Das ist
   eine Entscheidung des Nutzers, keine Fehlfunktion.

**Why:** Ein Publish darf nur die Dateien anfassen, die der Store selbst erzeugt.
Die pauschale Ordnerregel hat das verletzt und die Website unbaubar gemacht; die
Wiederherstellung (`57b9d95`) hat `dev` sofort reparieren können. Die präzise
Pfadregel, die stabilen Namen und der Löschschutz sichern denselben Fehler doppelt
ab: die Regel verhindert falsche Kandidaten, der Schutz stoppt massenhafte
Löschungen, die aus einem unvollständigen Store entstehen. Einmalige Folge: beim
nächsten Publish werden die aktuell in `dev` liegenden, komprimierten Namen von
`LAKBCD` (`-01`…`-04`) auf die historischen Store-Nummern (`-01`, `-03`, `-05`,
`-08`) zurückgeführt – ein einzelner Rename-Lauf, danach stabil.

#### 2026-11-02T17:20:00+0000: FR008-Doku beschreibt Integration 0.1.15 mit verwalteten Pfaden und Löschschutz

**By:** Maria (Technische Redakteurin / Dokumentationsspezialistin)

**What:** `docs/features/fr008-ha-manager.md` beschreibt Version 0.1.15 (02.11.2026). Neu sind im
Abschnitt „Veröffentlichen“ die Unterabschnitte „Verwaltete Pfade“ und „Löschschutz“; die stabilen
Bilddateinamen stehen im Abschnitt „Website-Export“. Die Statuszeile nennt 0.1.15.

- „Verwaltete Pfade“ begrenzt die Löschlogik auf `public/data/handmade.json` und Bilder nach dem
  Muster `src/assets/handmade/<Kategorie>/<Artikelnummer>/<Artikelnummer>-NN.<Endung>` mit einer der
  fünf bekannten Kategorien. `.scad`-Quellen, `3dmodels/`, `.gitkeep` und fremde Unterordner gelten
  nie als verwaltet. Der Vorfall ist dort dokumentiert: Commit `d13cb2f` löschte
  `3dmodels/includes/roundedcube.scad` und `3dmodels/models/Verteilerdose.scad`, weil
  `_is_managed_path()` jeden Pfad unter `src/assets/handmade/` als Produktbild einstufte; `fd-ci`
  wurde rot und `fd-deploy-dev` übersprungen. Commit `57b9d95` stellte beide Dateien wieder her,
  seit 0.1.15 prüft die Funktion nur die beiden Muster, und ein Regressionstest belegt, dass
  `3dmodels/**` unangetastet bleibt.
- „Löschschutz“ nennt die Schwellen (mehr als zehn Bilder oder mehr als ein Drittel des Bestands,
  ab drei Löschungen), die Warnung im Dry-Run, die Antwort `publish_removals_blocked` (HTTP 409)
  mit Feld `removal_guard` und die Bestätigung `confirm_removals` (nur Anwendungsverwaltung, je
  Lauf, nicht gespeichert).
- „Website-Export“ erklärt die stabilen Bilddateinamen: Hauptbild bleibt `-01`, weitere Bilder
  behalten ihre Store-Nummer, solange sie frei ist; ein gelöschtes Bild erzeugt nur `removed`, keine
  Umbenennung wie `LAKBCD-08 → LAKBCD-04`. Identische Fotos zweier Produkte liegen getrennt unter
  `images/<Artikelnummer>/` und sind kein Fehler.
- `CHANGELOG.md` führt unter `## [Unreleased]` je einen Eintrag unter Added (Doku 0.1.15, Löschschutz),
  Changed (stabile Bilddateinamen) und Fixed (verwaltete Pfade samt Vorfall), alle mit `(#289)`.

**Why:** Die beiden Website-Dateien waren bereits auf `dev` verschwunden; ohne dokumentierte Grenze
der verwalteten Pfade wiederholt sich der Fehler beim nächsten Publish. Der Vorfall steht bewusst
mit Commits, Dateiliste und CI-Folge im Dokument, damit die Regel prüfbar bleibt und niemand sie
später als übervorsichtig zurücknimmt. Der Löschschutz braucht die Schwellen und den Notausgang in
der Doku, weil `confirm_removals` sonst wie ein stiller Datenverlust wirkt. Die
Bild-Namensstabilität gehört fachlich zum Export, nicht zum Veröffentlichen: Sie ändert, welche
Dateien im Repository entstehen, nicht den Transport.

**Offene Punkte:** Die bestehende Zeile im Website-Export nennt weiterhin das Muster
`<artikelnummer>-NN.jpg`; bei Bedarf auf `<endung>` vereinheitlichen, sobald der Export auch WebP
offiziell dokumentiert. Die Beispielversionen `v0.1.14` in „Navigation“ und „Aktualisierung und
Browser-Cache“ bleiben als geladene Builds unverändert.

#### 2026-11-02T17:20:00+0000: Release 0.1.15 veröffentlicht

**By:** Nick (DevOps / Infrastruktur)

**What:** Der Fix aus #289 (`_is_managed_path` löschte 3D-Modellquellen,
stabile Bildnamen, `publish_removal_guard`) ist als Home-Assistant-Integration
**0.1.15** veröffentlicht.

- Annotierter Tag `0.1.15` (`a16ad6446cde60753ad5dfc425f783543d3a05ee`,
  Nachricht „Frickeldave Store 0.1.15“) auf Commit
  `396103bbfc5b7b1dd9070187bae3db02a25972ff` = `origin/main`.
- GitHub-Release `0.1.15` als Latest: kein Draft, kein Pre-Release,
  `targetCommitish: main`, keine Assets.
  <https://github.com/Frickeldave/frickeldave.home.net/releases/tag/0.1.15>
- Release-Notes sind der unveränderte Abschnitt `## [0.1.15] - 2026-11-02` aus
  `CHANGELOG.md` (byte-gleich bis auf die abschließende Leerzeile).
- Manifest `custom_components/frickeldave_store/manifest.json` = `0.1.15`,
  `hacs.json` vorhanden (HACS-fähig).
- CI für `396103b`: Lauf `41483802530`, `success`
  (<https://github.com/Frickeldave/frickeldave.home.net/actions/runs/41483802530>).
- Releases `0.1.8`–`0.1.14` unverändert (gleiche `publishedAt`, Namen, Targets,
  weiterhin je 0 Assets; `0.1.14` bleibt nicht mehr Latest).
- Website `dev` ist gesund: `fd-ci` `41481531676` (SHA `57b9d95`, `success`) und
  `fd-deploy-dev` `41482415072` (`success`, deployt genau `57b9d95`; der
  `dev-v1.0.11`-Release-Job war erwartungsgemäß ein No-Op-`notice`, weil die
  Version schon existiert). Der Incident-Lauf `41475789176` (`d13cb2f`,
  `failure`) ist damit überholt.

**Why:** `0.1.15` ist der erste Release, der den Datenverlust-Vorfall
(`d13cb2f` löschte `3dmodels/**/*.scad` und brach `fd-ci`) behebt. HACS-Nutzer
und das Panel dürfen nicht weiter auf `0.1.14` mit dem zerstörerischen
Publish-Verhalten bleiben; der Release musste daher als Latest ohne
Pre-Release-Kennzeichnung erscheinen. Veröffentlicht wurde ausschließlich per
Tag-Push und `gh release create` — kein Commit, kein Push auf `main`, keine
Änderung an bestehenden Tags oder Releases, damit die Release-Historie
nachvollziehbar und unverändert bleibt.

## Governance

- Alle bedeutenden Änderungen erfordern Teamkonsens
- Architektonische Entscheidungen hier dokumentieren
- History auf Arbeit fokussieren, Entscheidungen auf Richtung fokussieren
