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

## Governance

- Alle bedeutenden Änderungen erfordern Teamkonsens
- Architektonische Entscheidungen hier dokumentieren
- History auf Arbeit fokussieren, Entscheidungen auf Richtung fokussieren
