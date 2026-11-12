# Squad-Entscheidungen

## Aktive Entscheidungen

- Archivierte Einträge (ab 20 KB älter als 30 Tage, ab 50 KB älter als 7 Tage; Stand 2026-11-12): siehe [`decisions-archive.md`](decisions-archive.md).

#### 2026-11-06T05:52:19+00:00: Prod-Dispatch rief den nicht existierenden Endpoint `/run` auf
**By:** Bruce
**What:** `GitHubClient.async_dispatch_workflow()` in der Erweiterung postete auf `actions/workflows/<workflow>/run`; die GitHub-API kennt nur `POST actions/workflows/<workflow>/dispatches` und antwortet auf `/run` mit 404. Ab 0.1.6 wird `/dispatches` aufgerufen (Payload, Retry-Semantik, Commit-Flow und `would_trigger` unverändert). Der 404-Fallback (`github_not_found`) nennt weiterhin Workflow, Branch und den Hinweis „Actions: Read and write“; die zuvor geplante Preflight-Logik (`GET actions/workflows/...`) wurde verworfen. Regressionstest prüft die exakte URL, den Body `{"ref": "main", "inputs": {"dry_run": false}}` und dass `/run` nicht mehr vorkommt. Version 0.1.6 in `manifest.json`, `pyproject.toml`, `const.py`; CHANGELOG `[Unreleased]`/`Fixed` beschreibt den Endpoint-Fix. Validierung: `ruff check .` ok, `ruff format --check .` ok, `mypy custom_components` ok, `pytest -q` 147 passed, Manifest-JSON gültig. Commit `ed2903e5aa1439b4426cdb82915f2a9c5b159673`, PR https://github.com/Frickeldave/homeassistant-frickeldave-store-syncfd/pull/6 (nicht gemerged).
**Why:** Der Live-Test mit demselben Token belegt `POST .../run` → 404 und `POST .../dispatches` → 204 bei `GET` Repository/Workflow → 200 und funktionierendem Contents-Write. Die Ursache war nie ein fehlendes `Actions: Read and write`, sondern der falsche Pfad; die alte 404-Meldung konnte das nicht unterscheiden, weil der Prod-Dispatch zuvor nie erfolgreich lief.

#### 2026-11-06T05:52:19+00:00: fr008 dokumentiert korrigierten Workflow-Dispatch-Endpoint
**By:** Maria
**What:** `docs/features/fr008-ha-manager.md` erklärt unter „Fehler beim Veröffentlichen nach prod“, dass die Erweiterung bis 0.1.5 `POST /repos/{repo}/actions/workflows/{workflow}/run` aufrief und GitHub diesen Pfad mit 404 beantwortet; ab 0.1.6 nutzt sie `/dispatches`. Dazu die kurze 404-Prüfliste (Workflow-Dateiname, Branch, WARNING-Zeile mit Methode/Pfad/Status, `Actions: Read and write` als Voraussetzung) und die korrigierte Endpoint-Angabe im Abschnitt „Token-Berechtigungen“. Statuszeile nennt 0.1.5 als released und 0.1.6 als in Vorbereitung, die Repository-Tabelle führt `0.1.6`. `CHANGELOG.md` nennt den Endpoint-Fix unter `[Unreleased]` → `Fixed` (#289).
**Why:** Der Live-Test mit demselben Token belegt `/run` → 404 und `/dispatches` → 204; der Token war nie die Ursache. Die zuvor geplante Preflight-Logik entfällt, die erste Fassung dieser Notiz (veralteter Token als Ursache) ist damit überholt.

#### 2026-11-06T08:21:37+00:00: Bildgrenze konfigurierbar, Store-Größe in /settings
**By:** Bruce
**What:** Backend/API in `homeassistant-frickeldave-store`, Branch `feat/289-image-limit-and-store-size`
(Commit `4ea6c26`, PR https://github.com/Frickeldave/homeassistant-frickeldave-store/pull/5, nicht gemerged).
Dateien: `store.py` (`settings.images.max_bytes`, Default `DEFAULT_IMAGE_MAX_BYTES = 500 * 1024 = 512000`,
Grenzen `MIN_IMAGE_MAX_BYTES = 51200` … `MAX_IMAGE_MAX_BYTES = 10485760`; bool ist kein int; deutsche
`ValidationError`-Texte; defensive Reads für Altbestände ohne `images`; `CatalogStore.image_max_bytes`),
`imaging.py` (`MAX_IMAGE_BYTES = 500 * 1024`, `is_oversized(width, height, size, max_bytes=...)`, Grenze
durch alle Pfade gefädelt: `read_info_sync`/`inspect_sync`/`inspect_paths`/`async_inspect_paths` inkl.
Cache-Key und `optimize_image_sync`/`async_optimize_image`; Call-Sites in `products.py` nutzen
`store.image_max_bytes`; harte Upload-Grenze bleibt 10 MiB), `storage.py` (`storage_usage()` →
`total_bytes`, `data_bytes`, `images_bytes`, `backups_bytes`, `files`; rekursiv, keine Symlinks, fehlende
Ordner 0), `views.py` (`PATCH /settings` erlaubt `images`, `GET`/`PATCH` liefern `storage.usage` einmal pro
Anfrage über `hass.async_add_executor_job`; `/me` unverändert), `websocket_api.py` (Listener nutzt
`async_list`). Zusätzlich Sortierung `size`: `SORT_KEYS` = name, price, category, stock, status, size;
`ProductFilter.from_query` akzeptiert `sort=size`; `ProductService.async_list` summiert die Bild-Bytes
über `_sync_images_all` + einen `async_inspect_paths`-Lauf (keine N+1-Aufrufe), sortiert numerisch vor
Limit/Offset, `total` = gefilterte Produkte, Gleichstand nach Name/Artikelnummer (auch bei `desc`).
API-Vertrag: `GET /api/frickeldave_store/settings` → `"images": {"max_bytes": 512000}` und
`"storage": {..., "usage": {"total_bytes", "data_bytes", "images_bytes", "backups_bytes", "files"}}`;
`PATCH` → `{"images": {"max_bytes": 614400}}`; `GET /products?sort=size&order=desc`. Produkt-Payloads
bleiben unverändert (`images[].bytes`), kein `image_bytes_total`. Version `0.2.5` in `manifest.json`,
`pyproject.toml`, `const.py`; CHANGELOG (`Added`: konfigurierbare Grenze, `storage.usage`, Sortierung
`size`; `Changed`: 400 → 500 KiB) und README aktualisiert. Tests: `pytest -q` → 267 passed,
`ruff check .` → clean, `ruff format --check .` → 44 formatted, `mypy custom_components` → Success,
`manifest.json` gültig.
**Why:** 400 KiB war zu streng (Default jetzt 500 KiB und pro Store einstellbar), die Belegung des
Datenordners soll ohne SSH sichtbar sein, und das Panel braucht einen stabilen, dokumentierten Vertrag
für Bildgrenze, `storage.usage` und die serverseitige Sortierung nach Produktgröße.

#### 2026-11-06T08:21:37+00:00: Panel zeigt Store-Größe, Bildgrenze einstellbar, kompakter Zeilen-Badge
**By:** Natasha
**What:** Konfigurationspanel: neue Gruppe „Bilder“ im Tab „Allgemeine Einstellungen“ mit Feld **Maximalgröße (kB)** (Default 500, validiert 50–10240, Inline-Fehler), gespeichert als `PATCH /api/frickeldave_store/settings {"images":{"max_bytes":kB*1024}}`; ältere Backends ohne `images` fallen auf 500 KiB zurück. Speicherbereich zeigt bei vorhandenem `settings.storage.usage` die Zeile `Belegt: … · Bilder … · Metadaten … · Snapshots …` plus gedämpfte Dateizahl. Listenansicht: neue sortierbare Spalte **Größe** (Summe `images[].bytes`, `—` ohne Bilder), Server-Sortierung über `sort=size`; Kachelansicht unverändert. Zeilen-Badge „Bilder zu groß“ exakt in Badge-Höhe (2 px Padding, 11 px Schrift, Badge-Zeilenhöhe, 14 px Icon, `align-self: center`, kein `min-height`), `.fd-badges` mit `align-items: center`; Karten-Badge unverändert. Client-Fallback der Bildgrenze 400 → 500 KiB. Gemeinsamer reiner Helfer `frontend/format-bytes.js` (binär, deutsches Dezimalkomma) inkl. `node --test` (12 Tests) und eigenem CI-Step. PR https://github.com/Frickeldave/homeassistant-frickeldave-store/pull/6, Commit `0ea5152`, Branch `feat/289-panel-image-limit-and-size`; kein Versionsbump. Validierung: `node --check` alle Panel-JS, `node --test tests/frontend/*.test.mjs` 12/12, `ruff check .`, `ruff format --check .`, `mypy custom_components`, `pytest -q` 238 passed.
**Why:** Die feste 400-KiB-Grenze war zu streng; die Bildgrenze muss ohne Deployment einstellbar sein. Speicherverbrauch (gesamt/Bilder/Metadaten/Snapshots) war im Panel unsichtbar. Das Zeilen-Badge „Bilder zu groß“ war höher als das „Personalisierbar“-Badge und zog dieses auf seine Höhe. Die Produktgröße fehlte in der Liste und ließ sich nicht sortieren; `sort=size` benötigt die Server-Seite aus Bruce' Backend-PR (`feat/289-image-limit-and-store-size`).

#### 2026-11-06T08:21:37+00:00: fr008 dokumentiert Bildgrenze 500 kB und Store-Größe
**By:** Maria
**What:** `docs/features/fr008-ha-manager.md` beschreibt Basis 0.2.5 (Statuszeile und Repository-Tabelle):
die einstellbare Bildgrenze im Tab Allgemeine Einstellungen → Bilder (Feld **Maximalgröße (kB)**,
50–10240 kB, Standard 500 kB, alte 400 KiB als historisch bis 0.2.4 markiert, lange Kante unverändert
1600 px), die Wirkung (`oversized`, Warnbanner, **Bilder optimieren**), `images.max_bytes` und
`storage.usage` (`total_bytes`, `data_bytes`, `images_bytes`, `backups_bytes`, `files`) aus
`GET /settings`, die kompakte Zeile **Belegt: …** samt Aufschlüsselung und den rekursiven Lauf ohne
symbolische Links über das effektive Datenverzeichnis (config/share/media). Dazu die
Höhenangleichung der Badges „Personalisierbar“ und „Bilder zu groß“ in der Listenansicht.
Nachtrag: Die Listenansicht führt die Spalte **Größe** (Summe aller Bild-Bytes je Produkt, alle Bilder
statt nur Hauptbild, deutsches Zahlenformat in KB/MB, `—` ohne Bilder), sortierbar wie die übrigen
Spalten; die Sortierung läuft serverseitig vor der Pagination, Gleichstände löst Name, dann
Artikelnummer. Die Sortierabschnitte nennen jetzt sechs Felder (Produkt, Kategorie, Preis, Größe,
Bestand, Status). `CHANGELOG.md` ergänzt unter `## [Unreleased]` die Abschnitte `### Added`
(einstellbare Bildgrenze, Speicherbelegung in den Einstellungen, Produktgröße als Spalte) und
`### Changed` (Standard 400 → 500 KiB, Konfigurationspanel zeigt die Store-Größe, Badge-Höhe) jeweils
mit `(#289)`.
Validierung: `npm run format:check` → „All matched files use Prettier code style!“;
`npx markdownlint-cli@0.44.0 docs/features/fr008-ha-manager.md` → Exit 0, keine Findings;
`npm run prose` → „0 errors, 0 warnings and 0 suggestions in 110 files“. Commits `1e819b7` und
`71cdaa2` auf `fix/issue-289-image-limit-size-docs`, nicht gepusht.
**Why:** Die „Bild zu groß“-Grenze ist nicht mehr fest, sondern konfigurierbar und liegt per Default
höher; die Speicherbelegung ist jetzt in den Einstellungen sichtbar; die Badge-Höhe in der Liste war
optisch ungleich; und der Speicherbedarf je Produkt ist als sortierbare Spalte direkt prüfbar, ohne
Produkte einzeln zu öffnen. Die Dokumentation muss den Stand 0.2.5 abbilden, ohne Releasedaten zu
erfinden.

#### 2026-11-06T08:05:34+00:00: Sync-README dokumentiert den gemeinsamen Dev-/Prod-Publish
**By:** Maria
**What:** Extension-`README.md` (frickeldave_store_syncfd) um den Abschnitt `## Veröffentlichen: dev und prod`
ergänzt: Tabelle Ziel/Vergleichsbasis/Commit-Branch/Workflows, Release nur bei Versions-Bump,
deploy-neutrale vs. seitenrelevante Pfade, Verhalten ohne Änderungen. `### publish` im
Feature-Vertrag beschreibt jetzt prod-Vergleich gegen `main`, Commit auf `dev` und Dispatch über
`POST /repos/{repo}/actions/workflows/{workflow}/dispatches`. Basis-URL auf
`Frickeldave/homeassistant-frickeldave-store` korrigiert, Überschrift auf `Funktionsumfang (0.1.6)`.
Validierung: `npx --yes markdownlint-cli@0.44.0 README.md` → 15 Findings, alle vorbestehend
(MD013), keine neuen; `git diff --check` → Exit 0. Commit `58194ba`, Branch
`docs/289-readme-publish-flow`, PR https://github.com/Frickeldave/homeassistant-frickeldave-store-syncfd/pull/7
(nicht gemergt, kein Release, kein Versions-Bump).
**Why:** Ein Prod-Publish committet ebenfalls auf `dev` und promotet danach `dev → main`;
ein separater Dev-Publish ist nicht nötig, die Dev-Vorschau folgt dem Push. Ein Release entsteht
nur bei einer höheren Website-Version in `package.json`, reine Katalog-/deploy-neutrale Änderungen
deployen ohne Release.


#### 2026-11-06T10:33:35+00:00: Fehlende Sitzung liefert 401 statt 403
**By:** Bruce
**What:** Neue Fehlerklasse `NotAuthenticated` (`code = "not_authenticated"`) in `models.py`; `STATUS_BY_CODE["not_authenticated"] = 401` und `_user()` wirft in `views.py` `NotAuthenticated("Die Sitzung ist abgelaufen. Bitte die Seite neu laden.")` statt `PermissionDenied`. Rollenbasierte `PermissionDenied` bleibt `403 forbidden`. Tests: `/me` und `/settings` ohne `hass_user` → `401 not_authenticated`, Benutzer ohne Rolle weiterhin `403 forbidden` (`tests/test_views.py`, `tests/test_users_api.py`). Version `0.2.6` in `manifest.json`, `pyproject.toml`, `const.py`; CHANGELOG `[Unreleased]`/`Fixed`. PR: https://github.com/Frickeldave/homeassistant-frickeldave-store/pull/7, Commit `d30b4a4d0463297f1cfaec864d5bfcf4885c302a` (Branch `fix/289-session-401`). Validierung: `ruff check .`, `ruff format --check .`, `mypy custom_components` grün, `pytest -q` 270 passed, `manifest.json` gültiges JSON.
**Why:** Eine fehlende/abgelaufene HA-Sitzung (`hass_user` fehlt) wurde als `forbidden` gemappt; Nutzer sahen „nicht freigegeben“ statt einer Sitzungsmeldung. `401` erlaubt dem Panel, die Ablaufmeldung korrekt anzuzeigen.

#### 2026-11-06T10:33:35+00:00: Panel erneuert abgelaufene Access-Tokens
**By:** Natasha
**What:** `_api()` nutzt jetzt bevorzugt `hass.fetchWithAuth` (roher `fetch` bleibt als Fallback für ältere HA-Versionen). Bei HTTP 401 wird `hass.auth.refreshAccessToken()` genau einmal aufgerufen und die Anfrage genau einmal wiederholt; 403 wird nie wiederholt und der Berechtigungspfad bleibt unverändert. Ein 401 zeigt nicht mehr die „nicht freigegeben“-Ansicht. Die reine Entscheidung liegt in `frontend/auth-retry.js` (`shouldRefreshToken`) und ist über `node --test` abgedeckt. Commit `7043e9c`, PR https://github.com/Frickeldave/homeassistant-frickeldave-store/pull/8. Validierung: 15 Frontend-Tests, ruff, ruff format, mypy und 267 pytest-Tests grün; kein Versionsbump.
**Why:** Der rohe fetch hat den 30-Minuten-Token nie erneuert; Nutzer sahen Sitzungsfehler statt einer nahtlosen Erneuerung.

#### 2026-11-06T10:33:35+00:00: fr008 erklärt Sitzungsablauf und Token-Refresh

**By:** Maria

**What:** `docs/features/fr008-ha-manager.md` hat den neuen Unterabschnitt „Sitzung abgelaufen und
fehlende Freigabe (ab 0.2.6)“ unter „Berechtigungen“: Access-Token 30 Minuten, Refresh-Token 90
Tage, bis 0.2.5 ohne Erneuerung per `fetch`, ab 0.2.6 `fetchWithAuth` mit einmaligem Refresh und
Wiederholung bei 401; eine Tabelle trennt die Meldung „Die Sitzung ist abgelaufen“ (`401
not_authenticated`, neu laden) von „Ihr Home-Assistant-Benutzer ist für diese Verwaltung nicht
freigegeben“ (`403 forbidden`, Rolle im Tab Benutzerverwaltung setzen). Die Versionstabelle führt
die Basis mit `0.2.6`, die Statuszeile nennt 0.2.5 als released und 0.2.6 als in Vorbereitung, ohne
Release-Datum. `CHANGELOG.md` ergänzt unter `## [Unreleased]` → `### Fixed` einen Punkt zur
einmaligen Token-Erneuerung und zum 401 statt des irreführenden 403 (#289).

**Why:** Der Access-Token läuft nach 30 Minuten ab, und das Panel erneuert ihn seit 0.2.6 einmal
und wiederholt die Anfrage; vorher traf Nutzende nach einer halben Stunde die Sitzungsmeldung. Eine
fehlende Sitzung antwortet jetzt mit 401, ein Rollenentzug bleibt 403 — nur so führt die Meldung zur
richtigen Abhilfe statt in die falsche Spur einer fehlenden Benutzerfreigabe.

#### 2026-11-06T11:26:55+00:00: fetchWithAuth bekommt relativen Pfad; ein Speichern-Button
**By:** Natasha
**What:** `_api()` im Seitenleisten-Panel reicht `hass.fetchWithAuth` jetzt den relativen Pfad durch; die absolute URL bleibt dem rohen `fetch`-Fallback. Die Entscheidung liegt als reiner Helper `authRequestUrl(path, baseUrl, useAuthFetch)` in `frontend/auth-retry.js` und ist mit vier neuen `node --test`-Fällen abgedeckt. Im Konfigurationspanel sind Speicherort und Bildgröße ein Formular mit `_saveGeneral()`/`_discardGeneralChanges()`; „Bildgröße speichern“ und `_saveImages`/`_saveStorage` entfallen, ein `PATCH` sendet nur die geänderten Abschnitte. Version 0.2.7 in `manifest.json`, `pyproject.toml`, `const.py`; CHANGELOG-Einträge unter `[Unreleased]`. Commit `ae9d1b4` auf `fix/289-fetchwithauth-and-save-button`, PR https://github.com/Frickeldave/homeassistant-frickeldave-store/pull/9 (nicht gemergt).
**Why:** `hass.fetchWithAuth` ist als `(path, init) => fetchWithAuth(auth, `${auth.data.hassUrl}${path}`, init)` gebunden und stellt die Instanz-URL selbst voran; die absolute URL aus 0.2.6 ergab `https://ha…https://ha…/api/…` und damit nur „Verbindung zum Server fehlgeschlagen“. Die Bildgröße brauchte keinen eigenen Speichern-Button neben „Einstellungen speichern“.

#### 2026-11-06T11:26:55+00:00: fr008 dokumentiert fetchWithAuth-Fix und gemeinsamen Speichern-Button
**By:** Maria
**What:** `docs/features/fr008-ha-manager.md` beschreibt im Tab Allgemeine Einstellungen den gemeinsamen Button **Einstellungen speichern** für Speicherort samt Backup-Schalter und Bild-Maximalgröße, die Wirkung von **Änderung verwerfen** auf beide Bereiche, den PATCH mit ausschließlich geänderten Abschnitten und den Reload nur bei geändertem Speicherort. Neuer Abschnitt „Verbindung zum Server fehlgeschlagen (0.2.6 bis 0.2.7)“ erklärt den URL-Fehler. Versionsbasis in Tabelle und Statuszeile auf 0.2.7 gehoben. `CHANGELOG.md` ergänzt unter `## [Unreleased]` je einen Eintrag in `### Fixed` und `### Changed`.
**Why:** Die absolute URL verdoppelte `auth.data.hassUrl` über `fetchWithAuth`, sodass jeder Panel-Aufruf mit „Verbindung zum Server fehlgeschlagen“ endete; ein separater Button für die Bildgröße war neben dem allgemeinen Speichern überflüssig.

#### 2026-11-12T07:32:41+00:00: QA finding: config-flow teardown flake is pre-existing (IS_322)

**Author:** Clint (Tester/QA) · **Date:** 2026-11-12 · **Worktree:** `homeassistant-frickeldave-store_IS_322`, branch `feat/322-bilder-drehen`

##### Decision

Do **not** change production or test code for the intermittent pytest teardown error. The flake is
pre-existing and unrelated to the image-rotation change; the PR proceeds unmodified, with the
residual risk documented in the PR description.

##### Evidence

- Symptom: `Failed: Lingering timer after test <TimerHandle ... Store._async_schedule_callback_delayed_write()
  created at homeassistant/helpers/storage.py:470>` at teardown of a `tests/test_config_flow.py` test.
  No assertion ever fails.
- Isolated `tests/test_config_flow.py` (unchanged file, unchanged production code) reproduces it:
  branch 10/115 runs (8.7 %), pristine `HEAD` baseline (uncommitted changes excluded) 6/60 runs (10 %).
- Full suite: branch 3/18 (16.7 %), baseline 1/8 (12.5 %) — statistically indistinguishable.
- Instrumented runs showed 6/240 Store timers were scheduled while `hass.state == FINAL_WRITE`;
  those 6 runs are exactly the 6 failing runs. The key is `'http'` with a 180 s delay, created by
  `homeassistant/components/http/__init__.py::start_http_server_and_save_config`.
- Mechanism: `hass.config_entries.flow.async_init(DOMAIN)` loads the integration's manifest
  dependencies, including `http`/`panel_custom`/`frontend`. The HTTP server start + config save runs
  from a fire-and-forget `async_when_setup_or_start(hass, "frontend", start_server)` callback. When the
  test finishes before that chain completes, `Store.async_delay_save(conf, 180)` runs after
  `EVENT_HOMEASSISTANT_FINAL_WRITE`; HA only skips scheduling when state is `stopping`, not `final_write`,
  so the 180 s timer is never cancelled and `verify_cleanup` fails at the next teardown.
- New image-rotation tests (`tests/test_imaging.py`, `tests/test_products.py`, `tests/test_views.py`)
  use `tmp_path` / `FakeHass` only and run after `tests/test_config_flow.py`; they cannot influence it.

##### Recommended follow-up (separate issue)

In `tests/test_config_flow.py`, await the dependency setup before the test ends
(`await hass.async_block_till_done()` after `flow.async_init`) or accept the documented HA-internal
timer, so the HTTP config save is scheduled while HA is still running. Out of scope for this PR.

## Governance

- Alle bedeutenden Änderungen erfordern Teamkonsens
- Architektonische Entscheidungen hier dokumentieren
- History auf Arbeit fokussieren, Entscheidungen auf Richtung fokussieren
