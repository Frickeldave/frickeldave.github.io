# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Produktions-Deploy ohne Versions-Bump: `fd-deploy-prd` mergt `dev` nach `main` und deployt Pages jetzt auch dann, wenn `dev` dieselbe Version wie das letzte stabile Release trägt und der Diff `main..dev` ausschließlich verwaltete Katalog- und Produktbildpfade enthält (`public/data/handmade.json`, `src/assets/handmade/<3D|EP|LA|SB|WO>/<Artikel>/<Artikel>-NN.<Endung>`). Tag und GitHub-Release entstehen weiterhin nur, wenn die Version auf `main` höher ist als das letzte stabile Release; der neue Eingang `force_deploy` wiederholt einen fehlgeschlagenen Pages-Deploy ohne neuen Merge. `fd-promote-prd` behält vorerst das strenge Versions-Gate (#289).
- Katalog-Schnellweg für deploy-neutrale Pfade: Die Klassifikation `promote_safe` erlaubt bei gleicher Version neben Katalogmaterial auch Dokumentation, `.squad/`, `.github/`, `.husky/`, Tests, `CHANGELOG.md` und Tooling-Konfigurationen, weil sie das gebaute Seitenartefakt nicht verändern; `src/**`, `public/**` außer dem Katalog, Root-Build-Eingaben und `scripts/build-*`/`scripts/install-*` bleiben seitenrelevant und verlangen weiterhin ein Release. Die Promotion-Notice unterscheidet „nur Katalog“ von „Katalog plus unkritische Pfade“ und nennt die Klassifikation (#289).
- Veröffentlichungsdialog (Basis 0.2.4): Die Übersicht zeigt nur noch **Produkte** und **Bilder**; die filterbare **Dateiliste** bleibt die Dateisicht (#289).

### Fixed

- Prod-Publish: Ein 404 beim Workflow-Dispatch nennt jetzt den betroffenen Workflow, den Branch und das fehlende Recht `Actions: Read and write`, statt generisch „Repository oder Branch nicht gefunden“ zu melden; die Dokumentation erklärt die beiden Prüfungen im Options-Flow (Repository, Prod-Workflow `fd-deploy-prd.yml`) und am Fine-grained Token (#289).
- Dry-Run und Prod-Publish (Erweiterung 0.1.5): Ein Lauf ohne Änderungen meldet kein Deployment mehr, und `fd-deploy-prd` wird nur noch bei neuen, geänderten oder entfernten Dateien ausgelöst (#289).

## [1.0.12] - 2026-11-05

### Added

- Dokumentation des Verwaltungswerkzeugs in Home Assistant: `docs/features/fr008-ha-manager.md` beschreibt Architektur, Installation, Datenmodell, Rechte, Backup, Website-Export und Veröffentlichung der Integration `frickeldave_store`; `docs/old/features/fr003-catalog.md` nennt jetzt fünf Kategorien inklusive `SB` und die vorhandenen Bestandsfelder, `src/types/index.d.ts` ergänzt `stock` und `salesCabinet` als optionale Felder (#289).
- Veröffentlichen aus dem HA-Verwaltungspanel: neue Karte „Website veröffentlichen“ für die Rolle Anwendungsverwaltung mit den Aktionen „Nach dev veröffentlichen“ und „Nach prod veröffentlichen“. Beide starten einen Dry-Run und schreiben erst nach Bestätigung; `dev` wird per Commit über die Git-Data-API im Website-Repository `Frickeldave/frickeldave.github.io` aktualisiert, `prod` löst den Workflow `fd-deploy-prd` aus, den einzigen Weg zur Aktualisierung von `main`. Das Panel zeigt nach Erfolg Ziel, Commit und Deployment-Status; Voraussetzung ist ein write-only GitHub-Token (#289).
- Produktdialog in `docs/features/fr008-ha-manager.md`: Die Tabs „Grunddaten“, „Bilder“, „Beschreibung“ und „Bestand“ ersetzen den separaten Bilder-Dialog und den Bestand-Button der Produktkarte. „Grunddaten“ führt Name, Kategorie, Preis, Größe, Tags, Sichtbarkeit und Personalisierbar, „Bilder“ die Bildverwaltung, „Beschreibung“ das Beschreibungsfeld mit „Eigenen Hinweisen“ für die KI und „Beschreibung vorschlagen“ samt Vorschlagsübernahme, „Bestand“ je Lagerstätte eine Nummernbox mit Erhöhen/Verringern und die Buchungshistorie; beim Anlegen legt „Weiter“ auf Grunddaten das Produkt an, damit Bilder hochgeladen werden können, und wechselt in den Bearbeiten-Modus (#289).
- Listenansicht der Produktliste mit Umschalter „Kacheln“ / „Liste“ in der Toolbar; die Auswahl bleibt über `localStorage` (`fd-store-view`) erhalten, und die Liste bietet dieselben Aktionen wie die Kacheln (#289).
- Konfigurierbare Lagerstätten unter Einstellungen → Geräte & Dienste → Frickeldave Store: anlegen, umbenennen, löschen mit mindestens einer Lagerstätte, eindeutigen Namen und deutscher Fehlermeldung beim Löschen einer Lagerstätte mit Bestand. `stock` ist ein Objekt Lagerstätten-ID → Stückzahl, die Migration von Schema-Version 1 auf 2 erhält bestehende Bestände, alle Anzeigen folgen den konfigurierten Namen, und der Export bleibt mit `stock` und `salesCabinet` kompatibel (#289).
- Optionale Hinweise bis 2000 Zeichen beim „Beschreibung vorschlagen“ sowie Tag-Vorschläge ausschließlich aus bereits vorhandenen Tags; verworfene Vorschläge werden mit dem Hinweis angezeigt, dass neue Tags nicht automatisch angelegt werden (#289).
- `docs/features/fr008-ha-manager.md` beschreibt Version 0.1.10 der Integration `frickeldave_store` (02.11.2026): Version und Release-Datum, den neuen Abschnitt „Aktualisierung und Browser-Cache“, die Versionsanzeige in Panel und Konfigurationspanel, die kompakte Listenansicht, die zuklappbare Filterleiste, die Veröffentlichungs-Icon-Buttons in der Topbar und die überarbeiteten Bestands-Schaltflächen (#289).
- `docs/features/fr008-ha-manager.md` beschreibt Version 0.1.11 der Integration `frickeldave_store` (02.11.2026): die selbst verwaltete Persistenz mit ihren Sicherheitsnetzen im neuen Abschnitt „Persistenz und Datenverlust (bis 0.1.10)“, die Schritt-für-Schritt-Anleitung „Wiederherstellung nach dem Datenverlust-Bug (bis 0.1.10)“ für bereits Geschädigte, den Inhalt der Store-Ablage samt `backups/` in der Tabelle zur Datenhaltung sowie das Filterverhalten der Lagerstätten-Auswahl (#289).
- Sortierbare Spaltenköpfe in der HA-Listenansicht: Die Spalten Produkt, Kategorie, Preis, Bestand und Status sind klickbar und zeigen einen Sortierpfeil, `aria-sort` markiert die aktive Spalte und Richtung. Produkt sortiert nach Name, Kategorie nach Kategorie-Label, Preis nach Preis, Bestand nach dem Gesamtbestand über alle Lagerstätten (unabhängig vom Lagerstätten-Filter), Status nach aktiv vor archiviert und sichtbar vor unsichtbar. Der erste Klick sortiert aufsteigend, ein erneuter Klick dreht die Richtung; `desc` dreht nur das Hauptkriterium, Gleichstände bleiben aufsteigend (Name, Artikelnummer) (#289).
- Katalogimport im HA-Verwaltungspanel: Beim Öffnen des Dialogs läuft automatisch ein Dry-Run und zeigt, wie viele Produkte neu angelegt, überschrieben, unverändert gelassen und fehlerhaft wären, wie viele Bilder importiert würden, plus deutsche Zusammenfassung, ohne zu schreiben. Die neue Checkbox „Bestehende Produkte überschreiben“ (Standard aus) blendet ein Warnbanner ein und lädt die Vorschau mit `overwrite` neu; überschrieben werden Name, Beschreibung, Preis, Größe, Tags, Sichtbarkeit, Personalisierbarkeit und Bestand, erhalten bleiben Artikelnummer, Anlagedatum, Bilder, Buchungen, Archiv-Status und Kategorie. Nach dem Import zeigt der Dialog angelegte, überschriebene, übersprungene und fehlerhafte Produkte, importierte Bilder und die Fehlerliste je Artikelnummer (#289).
- Artikelnummer im Dialogkopf: Oben links im Produktdialog steht die Artikelnummer in einem farbigen Badge, der bisherige Untertitel „Artikelnummer …“ entfällt. Beim Anlegen wird die Nummer live über `GET /api/frickeldave_store/products/article-number?category=<Code>` vorgeschlagen (Platzhalter „…“ beim Laden, „—“ bei Fehler wie fehlender Kategorie), nach dem Speichern gilt die vom Server vergebene Nummer; die Vorschau ist nicht reserviert (#289).
- `docs/features/fr008-ha-manager.md` beschreibt Version 0.1.12 der Integration `frickeldave_store` (02.11.2026): die gemeinsamen Veröffentlichungs-Icons mit `dev`-/`prd`-Badge, den neuen Abschnitt „Sortierung“ mit den sortierbaren Spaltenköpfen der Listenansicht, den überarbeiteten Produktdialog mit dem Tab „Beschreibung“, dem „Weiter“-Ablauf und dem Artikelnummern-Badge sowie den Katalogimport mit automatischem Dry-Run, Überschreib-Option und Importergebnis (#289).
- `docs/features/fr008-ha-manager.md` beschreibt Version 0.1.13 der Integration `frickeldave_store` (02.11.2026): den neuen Unterabschnitt „Fehlerbehandlung und leerer Katalog“ mit den Fehlercodes `publish_empty_catalog` und `publish_artifacts_unavailable`, dem Notausgang `allow_empty` samt Bestätigung „Leeren bestätigen“, dem Feld `warning` im Dry-Run und der Ursache des Veröffentlichungsfehlers bis 0.1.12 (#289).
- Strukturierte Veröffentlichungsfehler: `publish_artifacts_unavailable` (409) meldet eine fehlende oder unlesbare lokale Bilddatei samt Artikelnummer und Datei, unerwartete Exceptions liefern `internal_error` mit Traceback im HA-Protokoll und deutscher Meldung samt Verweis auf das Protokoll (Filter `frickeldave_store`), und jede Publish-Antwort enthält ein Feld `warning` (`string|null`), das der Dry-Run-Dialog als Warnblock über der Bestätigung zeigt (#289).
- Leerer Katalog verhindert die Veröffentlichung: Enthält der Store keine veröffentlichbaren Produkte (auch „nur archivierte“ zählt als leer), antwortet die Integration mit `publish_empty_catalog` (409) und schreibt keinen Commit; der Notausgang ist das Body-Feld `allow_empty` (Standard `false`, nur Anwendungsverwaltung), das der Dry-Run-Dialog über die Bestätigung „Leeren bestätigen“ mit nicht vorausgewählter Checkbox und gesperrtem „Trotzdem veröffentlichen“ freigibt, und Fehler-, Abbruch- und Dry-Run-Pfade setzen die Zustimmung zurück (#289).
- `docs/features/fr008-ha-manager.md` beschreibt Version 0.1.14 der Integration `frickeldave_store` (02.11.2026): die automatische Bildverkleinerung beim Upload mit den Schwellwerten 1600 px lange Kante und 400 KiB, den Formaten (JPEG mit Qualität 82, progressiv, ohne EXIF und ICC; Transparenz als WebP mit Qualität 85 und erhaltenem Alpha; PNG ohne Transparenz als JPEG; GIF und animiertes WebP unverändert), unveränderten Bytes für bereits passende Bilder sowie dem Modul `imaging.py`, Pillow aus Home Assistant und dem Schutz gegen Dekomprimierungsbomben ab 40 MP; die Bild-Metadaten `bytes`, `width`, `height`, `content_type` und `oversized`, die beim Lesen aus den Dateien entstehen und über einen prozesslokalen LRU-Cache 26 ms warm beziehungsweise 153 ms kalt für 600 Bilder benötigen; den Endpunkt `POST /api/frickeldave_store/products/{artikelnummer}/images/optimize` mit Snapshot vor dem Lauf, erhaltener Reihenfolge und Hauptbild, idempotentem Verhalten und der Statistik `count`, `bytes_before`, `bytes_after` und `saved_percent`; und die Oberfläche mit Verkleinerungsmeldung nach dem Upload, Bildgröße je Bild, Warnbanner mit Anzahl und Schwellwerten, dem Button „Bilder optimieren“ und dem Warndreieck für Produkte mit zu großen Bildern in Liste und Kacheln (#289).
- `docs/features/fr008-ha-manager.md` beschreibt Version 0.1.15 der Integration `frickeldave_store` (02.11.2026): den neuen Unterabschnitt „Verwaltete Pfade“ mit der auf `public/data/handmade.json` und Bilder nach dem Muster `src/assets/handmade/<Kategorie>/<Artikelnummer>/<Artikelnummer>-NN.<Endung>` begrenzten Löschlogik samt dem Vorfall aus Commit `d13cb2f` und seiner Wiederherstellung, den neuen Unterabschnitt „Löschschutz“ mit den Schwellwerten, `confirm_removals`, `publish_removals_blocked` (409) und `removal_guard` sowie die stabilen Bilddateinamen im Abschnitt „Website-Export“ (#289).
- Löschschutz beim Veröffentlichen: Eine Veröffentlichung bricht ab, wenn sie mehr als zehn Bilder entfernen würde oder mehr als ein Drittel des bestehenden Bildbestands — ab drei Löschungen; der Dry-Run zeigt die Warnung und liefert sie im Feld `removal_guard`, die abgelehnte Antwort ist `publish_removals_blocked` (HTTP 409), und übergehen lässt sich die Sperre nur über das Body-Feld `confirm_removals` (Standard `false`, nur Rolle Anwendungsverwaltung, je Lauf) (#289).
- Erweiterungspunkt in der Integration 0.1.16 (02.11.2026): `extension.py` führt `CONTRACT_VERSION = 1` mit dem idempotenten `async_register_extension()` und `async_unregister_extension()` samt Vertragsprüfung sowie `async_get_feature_status()`; die `StoreFacade` gibt Erweiterungen Produkte, Lagerstätten, Artikelnummern, die Rechteprüfung über `can` und `require`, Snapshots, den Exportbau und das Anwenden eines Import-Batches, aber keinen Zugriff auf interne Store-Objekte oder Dateipfade. `GET /api/frickeldave_store/me` und `/settings` liefern `features`, `/settings` zusätzlich `feature_details` mit Titel, benötigter Rolle und Panel-Routen, die generische Route `POST /api/frickeldave_store/features/{feature}` fällt ohne registrierte Erweiterung auf das eingebaute Verhalten zurück, `/publish` und `/import/catalog` bleiben unverändert, und das HA-Event `frickeldave_store_features_changed` meldet Registrierung und Abmeldung. Neues Verhalten entsteht nicht: 0.1.16 ist rein additiv (#289).
- `docs/features/fr008-ha-manager.md` beschreibt Version 0.1.16 der Integration `frickeldave_store` (02.11.2026): den neuen Abschnitt „Erweiterungen“ mit dem Vertrag (`CONTRACT_VERSION = 1`, Registrierung und Abmeldung, Statusabfrage), der `StoreFacade`, den Feldern `features` und `feature_details`, der generischen Route `POST /api/frickeldave_store/features/{feature}`, dem Event `frickeldave_store_features_changed` und den Fehlercodes `contract_mismatch`, `already_registered`, `not_registered`, `invalid_registration`, `feature_unknown`, `feature_unavailable` und `handler_failed`; dazu der Hinweis, dass der Schritt rein additiv ist und die Auslagerung von Synchronisation und Katalogimport in eine eigene Integration erst geplant ist (#289).
- Auslagerung der frickeldave.de-Synchronisation in die eigenständige Custom Integration `frickeldave_store_syncfd` im Repository `Frickeldave/homeassistant-frickeldave-store-syncfd`: Veröffentlichen nach `dev` und `prod` sowie der Katalogimport liegen seit Basis `frickeldave_store` 0.2.0 (03.11.2026) dort, die Erweiterung 0.1.0 (02.11.2026) ist released. Auch sie wird über HACS als benutzerdefiniertes Repository verteilt und ist keine Add-on, weil Home Assistant hier im Container ohne Supervisor läuft (#289).
- `docs/features/fr008-ha-manager.md` beschreibt Basis 0.2.0 (03.11.2026) und Erweiterung `frickeldave_store_syncfd` 0.1.0 (02.11.2026): den neuen Abschnitt „Synchronisation als eigene Integration“ mit Aufteilung, Installationsreihenfolge, Token-Berechtigungen, Verhalten ohne und mit Erweiterung, Migrationsschritten und Rückfallweg, dazu den darauf verlinkten Abschnitt „Erweiterungen“ (#289).

### Changed

- Der Button „Aktualisieren“ lädt Produkte, Tags und Einstellungen neu aus der Integration und überträgt nichts an die Website; Veröffentlichung und Deployment laufen ausschließlich über die neuen Veröffentlichungs-Aktionen (#289).
- Produktdialog im HA-Verwaltungspanel: Beim Anlegen heißt der Footer-Button auf Grunddaten, Bilder und Beschreibung „Weiter“ und erst auf Bestand „Speichern“; „Weiter“ auf Grunddaten legt das Produkt an und wechselt in den Bearbeiten-Modus, auf den Folgetabs speichert es die Änderungen und wechselt weiter. Validierungsfehler blockieren den Tabwechsel und springen zum betroffenen Tab, und nach dem Anlegen weist der Dialog darauf hin, dass das Produkt bereits gespeichert ist und „Schließen“ nur den Dialog beendet (#289).
- Sortier-Umschalter in der Filterleiste: Er bleibt für die Kachelansicht und bietet jetzt alle fünf Felder bei gemeinsamem Zustand mit den Spaltenköpfen der Liste (#289).
- Konfigurierbare Datenablage in `docs/features/fr008-ha-manager.md`: Der neue Tab „Allgemeine“ im Konfigurationspanel hat als erste Option „Von Backup ausschließen“. Ist sie aktiv, liegen Store-Datei, Bilder und Snapshots unter `/share/frickeldave_store/` oder `/media/frickeldave_store/` statt unter `config/frickeldave_store/`, und das Panel listet die betroffenen Pfade. Ein Wechsel migriert die Dateien, lässt die alte Kopie zur manuellen Bereinigung stehen und lädt die Integration neu. Das Dokument beschreibt außerdem das Backup-Verhalten: Das eingebaute HA-Backup sichert `config/` vollständig, `share` und `media` sind nur bei einem Teil-Backup mit ausgewähltem Ordner oder einer Host-Sicherung enthalten (#289).
- Tags-Filter im HA-Verwaltungspanel: ausgewählte Tags sind jetzt mit ODER verknüpft, wie die Kategorien; alle übrigen Filter bleiben UND-verknüpft (#289).
- Panel-Navigation und Einstellungen in `docs/features/fr008-ha-manager.md`: HA-artige Topbar mit Hamburger-Menü für die Seitenleiste und Drei-Punkte-Menü, das nur noch „Tags verwalten“ (Produktpflege) führt; Kategorien und Tags stehen auf breiten Desktop-Monitoren nebeneinander, und die Einstellungen der Integration liegen vollständig im Konfigurationspanel unter **Einstellungen → Geräte & Dienste → Frickeldave Store → Zahnrad** mit dem Tab „Benutzerverwaltung“ (Freigabeliste mit echten HA-Namen, Rolleneditor, Schutz der letzten Anwendungsverwaltung), dem Tab „KI-Einstellungen“ (Endpunkt, Modell, write-only API-Key, Prompt) und dem Tab „Allgemeine“ (Option „Von Backup ausschließen“, siehe eigener Eintrag); der Eintrag „KI“ im Drei-Punkte-Menü entfällt (#289).
- Veröffentlichen im HA-Verwaltungspanel: „Nach dev veröffentlichen“ und „Nach prod veröffentlichen“ liegen als Icon-Buttons in der Topbar neben Aktualisieren, Katalog importieren und Produkt erstellen und erscheinen nur für die Rolle Anwendungsverwaltung; beide nutzen dasselbe Branch-Symbol und unterscheiden sich nur durch ein kleines Badge „dev“ beziehungsweise „prd“, während Screenreader-Text und Tooltip weiterhin das Ziel nennen („Nach dev veröffentlichen“/„Nach prod veröffentlichen“). Die Karte „Website veröffentlichen“ entfällt, der Ablauf über den Dry-Run-Dialog bleibt unverändert (#289).
- Produktliste und Filter im HA-Verwaltungspanel: Die Listenansicht ist kompakter (Thumbnail 40 px, Zell-Padding 4 px, einzeilige Tags mit Umbruch), Bearbeiten und Archivieren sind Icon-Buttons mit `aria-label`/`title` und 44 × 44 px Touch-Ziel, Suchfeld, Umschalter „Kacheln/Liste“ und „Filter zurücksetzen“ stehen auf gemeinsamer Höhe (`--fd-control-height: 48px`), und „Suche und Filter“ lässt sich zuklappen; der Zustand bleibt in `localStorage` (`fd-store-filters-open`, Standard offen) und das Badge „Filter aktiv“ bleibt zugeklappt sichtbar (#289).
- Bestands-Tab im HA-Verwaltungspanel: Plus und Minus sind Symbolschaltflächen in einer Spalte je Lagerstätte, gleich breit wie die Nummernbox; Minus ist bei Menge 0 deaktiviert (#289).
- Lagerstätten-Filter im HA-Verwaltungspanel: Die Auswahl einer Lagerstätte zeigt jetzt standardmäßig nur Produkte mit Bestand größer 0 in dieser Lagerstätte (`in_location=true`); die neue Checkbox **„Auch Produkte ohne Bestand anzeigen“** (Standard aus) erweitert auf alle Produkte der Lagerstätte (`in_location=false`). Der Hinweistext unter dem Auswahlfeld beschreibt genau dieses Verhalten, und eine gewählte Lagerstätte zählt als aktiver Filter („Filter aktiv“, „Filter zurücksetzen“), der Opt-out allein nicht (#289).
- Tab „Allgemeine Einstellungen“ im Konfigurationspanel: Der Tab steht jetzt an erster Stelle und zeigt einen aus dem Speicherort abgeleiteten Schalter für die Aufnahme in das HA-Backup (`config` enthalten, `share` und `media` nicht), die Auswahl des Speicherorts samt Beschreibung je Option und schreibgeschützt den effektiven Pfad mit den drei Unterpfaden für Metadaten, Bilder und Snapshots. Gespeichert wird über `PATCH /api/frickeldave_store/settings`; ein Speicherortwechsel verlangt ein Neuladen der Integration, belegte Zielordner (409) und fehlende Mounts (400) erscheinen mit der Servermeldung, und die Auswahl springt zurück. `docs/features/fr008-ha-manager.md` führt den Tab als „Allgemeine Einstellungen“ und korrigiert die frühere Angabe, die ihn schon vor seiner Umsetzung nannte (#289).
- Stabile Bilddateinamen beim Website-Export: Bisher nummerierte der Export die Bilder nach ihrer Position, sodass das Löschen eines Bildes alle folgenden Nummern verschob und Umbenennungen wie `LAKBCD-08 → LAKBCD-04` als `removed` plus `added` erzeugte. Seit 0.1.15 bleibt das Hauptbild `-01`, alle weiteren behalten ihre Store-Nummer, solange sie frei ist, und ein gelöschtes Bild hinterlässt nur einen `removed`-Eintrag; zwei Produkte mit demselben Foto liegen getrennt unter `images/<artikelnummer>/` (#289).
- `docs/features/fr008-ha-manager.md` stellt klar, dass Veröffentlichen und Katalogimport nicht mehr Teil der Basis sind: `POST /api/frickeldave_store/publish` und `/import/catalog` entfallen, `GET /api/frickeldave_store/me` und `/settings` melden `publish` und `import` ohne Erweiterung mit `available: false` und `provider: ""`, die generische Route antwortet mit `409 feature_unavailable` beziehungsweise `404 feature_unknown`, und im Panel fehlen die dev-/prd-Buttons und der Import-Button (#289).
- Der Erweiterungsvertrag `CONTRACT_VERSION = 1` bleibt in Basis 0.2.0 unverändert; der generische Import-Batch bleibt als Fassadenfunktion `async_apply_import_batch` erhalten, die Logik liegt in `batch_import.py` ohne Netzwerk- und SSRF-Teile. Mit installierter Erweiterung melden `GET /me` und `/settings` `provider: "frickeldave_store_syncfd"`, und die Buttons senden an `POST /api/frickeldave_store/features/publish` und `.../features/import` (#289).
- Token und Ziele der Synchronisation liegen im Options-Flow der Erweiterung unter **Einstellungen → Geräte & Dienste → Frickeldave Store Sync**. Der Fine-grained Token braucht `Contents: Read and write`, `Actions: Read and write` und `Metadata: Read`, beschränkt auf `Frickeldave/frickeldave.github.io` (#289).
- Das Integrations-Repository der Basis heißt jetzt `Frickeldave/homeassistant-frickeldave-store` und wurde zuvor von `Frickeldave/frickeldave.home.net` umbenannt; `docs/features/fr008-ha-manager.md` nennt überall den neuen Namen, erklärt die Umbenennung und aktualisiert Repository-Tabelle, Installationsschritt und Linkliste. Basis 0.2.0 ist released, 0.2.1 mit dem Gating-Fix ist in Vorbereitung (#289).
- Dev-Container: Die README beschreibt Datenverlust nach `OOMKilled` bzw. Neustart, die
  Erkennungssignale von `fd-status.sh` (Container-Uptime, Memory-Limit, Restart-Status) und die
  Recovery über `fd-setup`. CPU- und RAM-Werte der Dev-Container sind über
  `workflow_dispatch`-Parameter des `fd-bootstrap`-Workflows setzbar; die Dispatch-Felder sind
  vorbelegt (`build_image=true`, `restart_machines=frickeldave`, `force_restart=true`,
  `image=ghcr.io/frickeldave/fd-dev-full:latest`, `100m`/`2Gi` als Requests und `4`/`16Gi` als
  Limits), ein Dispatch mit diesen Defaults startet also das Image neu und kostet Login, Checkout
  und Worktrees (#303).
- Veröffentlichungsdialog im HA-Verwaltungspanel: Mehr Abstand zwischen Titelleiste und den
  Metadatenboxen Ziel, Zielbranch und Repository (`.fd-publish-meta`, 16 px), damit die Boxen nicht
  am Titel kleben (#289).
- Übersichten im Veröffentlichungsdialog: Die Abschnitte Dateien, Produkte und Bilder sind
  kompakter, und ihre Gesamtzahl steht rechts neben der Abschnittsüberschrift statt als
  Klammerzusatz hinter dem Titel (#289).
- Dateiliste im Veröffentlichungsdialog: Eine Knopfreihe Alle, Neu, Geändert, Entfernt und
  Unverändert filtert die Zeilen, jeweils mit Anzahl, `aria-pressed` für den aktiven Filter,
  Voreinstellung Alle, Rücksetzung beim Öffnen, bei neuem Ergebnis und beim Schließen sowie einem
  Hinweis, wenn kein Eintrag zum Filter passt; die Zahlen stammen aus `result.files` (#289).
- Doppelte Ausgabe im Veröffentlichungsdialog entfernt: Der Absatz mit `result.summary` und der
  Dry-Run-Untertitel in der Titelleiste entfallen, weil Übersichtskacheln und Deployment-Hinweis die
  Information bereits tragen; das API-Feld `summary` bleibt bestehen (#289).

### Removed

- `publish.py`, `importer.py` und ihre Tests aus der Basis `frickeldave_store` 0.2.0 (#289).
- Die Endpunkte `POST /api/frickeldave_store/publish` und `/import/catalog` sowie der eingebaute Feature-Fallback der generischen Route `POST /api/frickeldave_store/features/{feature}` (#289).
- Alle frickeldave-spezifischen Vorgaben der Basis: Standard-Repository, Branches, Workflow `fd-deploy-prd`, Katalog-URL `https://frickeldave.de/data/handmade.json`, Bildbasis auf `raw.githubusercontent.com` und die SSRF-Allowlist (#289).
- Die Publish-Felder im Options-Flow und der Publish-Tab im Konfigurationspanel der Basis; im Dokument der Abschnitt „Geplante Auslagerung“, der die Auslagerung als offen beschrieb (#289).

### Fixed

- Veröffentlichen scheiterte bis 0.1.12 bei jedem Versuch mit der Panel-Meldung „Der Server hat einen Fehler gemeldet. Bitte erneut versuchen.“: `GitHubClient._async_json` behandelte Antworten ohne `Content-Length` als leer, bei `Transfer-Encoding: chunked` ist `response.content_length` `None` und die Prüfung `not None` traf zu — der Body wurde verworfen, die Methode gab `None` zurück, der Aufrufer lief in `AttributeError: 'NoneType' object has no attribute 'get'` (publish.py:408) und Home Assistant antwortete mit einem nackten HTTP 500. Betroffen war schon der Lesepfad und damit auch der Dry-Run, das Token war nie die Ursache, und die bisherigen Tests verdeckten den Fehler, weil ihre Fake-Antworten immer ein `Content-Length` setzten. Seit 0.1.13 liest `_async_json` den Body immer und verzichtet nur bei echten Null-Body-Status (204/205/304) auf das Parsen; ungültiges JSON und 5xx werden zu `github_unavailable`, Aufrufer prüfen den Typ statt in `AttributeError` zu laufen, und Regressionstests decken chunked-Antworten sowie einen Dry-Run über den echten Client ab (#289).
- Datenverlust bei jedem Update behoben: Home Assistants `Store`-Helper cached beim Start die Dateiliste von `<config>/.storage`; der Katalog liegt aber unter `config/frickeldave_store/frickeldave_store.data` und damit außerhalb, sodass `Store.async_load()` „nicht vorhanden“ meldete, die Integration einen leeren Store erzeugte und der nächste Schreibvorgang die echte Datei mit `"products": []` überschrieb — bei jedem HACS-Update, weil es einen HA-Neustart auslöst. Seit 0.1.11 liest und schreibt die Persistenzschicht die Store-Datei selbst (atomar, gleiches Envelope-Format, Migration über `data.schemaVersion`, ohne HA-Storage-Interna), schützt vor dem Überschreiben eines gefüllten Stores mit 0 Produkten (`refuse_empty_overwrite`), legt vor Migrationen und vor dem ersten Schreiben nach dem Laden Snapshots unter `backups/` an und bricht bei einem nicht lesbaren Store laut ab statt eine leere Liste zu liefern; `tests/test_upgrade_paths.py` prüft die Upgrade-Pfade 0.1.7 → aktuell, 0.1.8 → aktuell und 0.1.9 → aktuell mit echten Store-Dateien und schlug auf dem alten Code fehl (0 statt 3 Produkte) (#289).
- Browser-Cache nach einem Integrations-Update: `PANEL_MODULE_URL` und `CONFIG_PANEL_MODULE_URL` tragen über die Hilfsfunktion `module_url()` in `const.py` den Versionsparameter `?v=<Version>`, und ein eigener Frontend-View liefert die Dateien mit `Cache-Control: no-cache, must-revalidate`; `GET /api/frickeldave_store/me` liefert `version`, `storage_schema_version` und `panel_module_url`, `GET` und `PATCH /api/frickeldave_store/settings` liefern `version`, und Panel (Drei-Punkte-Menü) sowie Konfigurationspanel (Fußzeile) zeigen die geladene Version. Nach dem Update auf 0.1.9 zeigte der Desktop-Browser weiterhin die alten Panel-Controls, während die Android-App die neuen zeigte (#289).
- Verwaltete Pfade beim Veröffentlichen: `_is_managed_path()` stufte jede Datei unterhalb von `src/assets/handmade/` als verwaltetes Produktbild ein, weshalb der Veröffentlichungs-Commit `d13cb2f` zwei 3D-Modellquellen löschte (`src/assets/handmade/3dmodels/includes/roundedcube.scad`, `src/assets/handmade/3dmodels/models/Verteilerdose.scad`). Die Dateien existieren nicht im Store und galten daher als entfernt; `build-scad.mjs` fand das Modellverzeichnis nicht, `scad-smoke-test` und `e2e-test` scheiterten, `fd-ci` wurde rot und `fd-deploy-dev` übersprungen. Commit `57b9d95` stellte beide Dateien wieder her, danach liefen `fd-ci` und `fd-deploy-dev` grün. Seit 0.1.15 erkennt `_is_managed_path` nur noch `public/data/handmade.json` und Bilder nach dem Muster `src/assets/handmade/<Kategorie>/<Artikelnummer>/<Artikelnummer>-NN.<Endung>` mit einer der fünf bekannten Kategorien; `.scad`, `3dmodels/`, `.gitkeep` und fremde Unterordner gelten nie als verwaltet, und ein Regressionstest bildet den Vorfall nach und belegt, dass `3dmodels/**` unangetastet bleibt (#289).
- Feature-Gating im HA-Panel: Das Panel behandelte einen Eintrag schon dann als vorhanden, wenn die Basis ihn mit `available: false` und `provider: ""` meldete, und zeigte die Buttons „Nach dev veröffentlichen“ und „Nach prod veröffentlichen“ deshalb deaktiviert an, obwohl die Erweiterung nicht installiert war. Seit Basis 0.2.1 blendet das Panel beide Buttons und „Katalog importieren“ vollständig aus, solange die Erweiterung nicht registriert ist; ist sie registriert, aber etwa der Token noch nicht hinterlegt, bleiben die dev-/prd-Buttons sichtbar, deaktiviert und nennen den Grund, während „Katalog importieren“ bereits aktiv ist (#289).
- Versionsabgleich für Fußzeile und Panel-Modul: `VERSION` in `const.py` blieb bis 0.2.1 auf `0.2.0`, während der Release nur `manifest.json` und `pyproject.toml` erhöhte. Nach dem Update auf 0.2.1 zeigte die Fußzeile des Konfigurationspanels deshalb weiterhin `0.2.0`, und die Modul-URL (`?v=<Version>`) blieb unverändert, sodass der Browser das alte Panel-Modul weiter aus seinem Cache laden konnte. Seit Basis 0.2.2 stimmt die Konstante mit dem Manifest überein, ein Test hält beide Werte zusammen, und Fußzeile wie Modul-URL tragen die veröffentlichte Version (#289).
- GitHub-Fehler beim Veröffentlichen in der Erweiterung: `github_unavailable` meldete bis `frickeldave_store_syncfd` 0.1.0 nur „Störung auf der GitHub-Seite“, ohne HTTP-Status, ohne Protokolleintrag und ohne Wiederholung. Seit 0.1.1 nennt die Meldung den HTTP-Status und GitHubs Text, jede fehlgeschlagene Antwort steht als WARNING-Zeile mit Methode, Pfad, Status und Meldung im Home-Assistant-Protokoll, und vorübergehende Fehler (Netzwerkfehler, 500/502/503/504) werden bis zu drei Versuche mit rund 0,5 s und 1,5 s Wartezeit wiederholt; der abschließende `PATCH git/refs/heads/{branch}` bleibt bewusst ohne Wiederholung, 401/403, 404 und 409/422 sind unverändert (#289).
- Produktzähler im Dry-Run der Erweiterung: Bis `frickeldave_store_syncfd` 0.1.1 las die Erweiterung den Remote-Katalog nur bei geänderter Katalogdatei, sodass ein unveränderter Katalog jedes lokale Produkt als neu meldete (`Produkte: neu = alle, unverändert = 0`), während der Dateivergleich 173 unveränderte Dateien zeigte; seit 0.1.2 meldet ein unveränderter Katalog alle lokalen Produkte als unverändert, ein neuer oder geänderter Katalog liest weiterhin den Remote-Katalog, und Dateizählungen, Löschschutz und die Meldung „nichts zu ändern“ bleiben unverändert (#289).
- Vergleichsbasis des Dry-Runs in der Erweiterung: Bis `frickeldave_store_syncfd` 0.1.2 las der Dry-Run den Änderungsbaum immer aus `dev`, sodass das Ziel `prod` gegen `dev` statt gegen `main` verglich und alles unverändert meldete, obwohl `main` die Testprodukte noch nicht enthielt. Seit 0.1.3 folgt die Vergleichsbasis dem Ziel: `dev` vergleicht gegen `dev`, `prod` gegen `settings.prod_branch` (`main`). Der Commit bleibt auf `dev` und erfolgt nur, wenn `dev` die Inhalte noch nicht enthält; danach läuft `fd-deploy-prd` und führt `dev → main` zusammen. Die Antwort führt `compare_branch` und `commit_branch`, `deployment.branch` bleibt der Zielbranch, die Zusammenfassung nennt die Vergleichsbasis, und Löschschutz sowie Oberfläche beziehen sich auf die Sicht des Zielbranchs (#289).

## [1.0.11] - 2026-10-30

### Added

- Interaktive Checkliste für die Abschlussaufgabe an Tag 2: Aufgaben lassen sich bis zum nächsten
  Seiten-Refresh an- und abhaken (#260).

## [1.0.10] - 2026-10-30

### Changed

- Kubernetes-Schulung Tag 2 und die Chromium-Beispielmanifeste ergänzen und korrigieren die Probe-Konfigurationen (#260).

## [1.0.9] - 2026-10-29

### Changed

- Git-Bash-Troubleshooting: die breite Drei-Spalten-Tabelle ist durch eine Definitionsliste aus Symptom, Ursache und Lösung ersetzt und passt damit in die rund 667 px breite Prose-Spalte (#260).
- § „api-resources“ der Vorbereitungsseite nennt den Befehl `kubectl api-resources | grep -E "(pods|services|deployments|ingress)"` samt Kurzerklärung über der Ausgabe (#260).

### Fixed

- Kubernetes-Schulung: Alle Deployment-Beispiele (`examplefiles/*deployment*.yaml`, die YAML-Blöcke in Tag 1 und Tag 2) setzen `resources.requests` und `resources.limits` und erfüllen damit die Kyverno-Policy `require-resource-requirements` der Firmen-Cluster; `code-server-deployment.yaml` und `code-server-deployment-configmap.yaml` sowie `code-server-pvc.yaml` stimmen wieder mit den Doku-Blöcken überein, das Passwort heißt überall `trainingk8s`; neu sind `create-namespace.yaml`, `ssh-bastion-deployment.yaml` und `ssh-bastion-service.yaml` (#260).
- Vorbereitungsseite: der LimitRange-Hinweis steht nur noch an Tag 2, wo er auftritt (#260).
- Der „Weiter“-Link der Vorbereitungsseite zeigt jetzt auf `/docs/kubernetes-basis/10-tag-1` statt auf den `.mdx`-Pfad und trägt das Label „Tag 1“ (#260).

## [1.0.8] - 2026-10-27

### Added

- Globaler Kopierknopf für Codeblöcke: `src/lib/code-copy.ts` bindet sich idempotent auf `astro:page-load` (Muster wie `cart-dom.ts`), `src/components/base/CopyCode.astro` liefert Markup und Script, `src/components/base/BaseLayout.astro` bindet beides einmalig ein; einen Knopf bekommt nur `pre > code`, ausgenommen sind `pre.mermaid`, Inline-Code und Blöcke mit `[data-no-copy]`; ohne `navigator.clipboard` (unsicherer Kontext) blendet sich der Knopf aus, das Feedback läuft über `role="status"` mit `Kopiert!` für 2000 ms (#260).
- Beispielmanifest `src/content/docs/kubernetes-basis/examplefiles/linuxserver-common-config-map.yaml`: zentrale linuxserver-ConfigMap mit den Keys `PUID`, `PGID` und `TZ` (#260).
- Beispielmanifest `src/content/docs/kubernetes-basis/examplefiles/database-deployment.yaml`: vollständiges MariaDB-+-phpMyAdmin-Deployment mit Init-Container `wait-for-mariadb`, PVC-Mount `mariadb-config` und den Container-Ports 3306 und 80 (#260).
- Glossareintrag `ACME` in `90-glossar.mdx` zwischen `Ingress Controller` und `ClusterIP` (#260).

### Changed

- Zeitplan und Rahmen der Kubernetes-Schulung Tag 2: Persistent Volumes (15:30–16:15), optionale Vertiefung MariaDB + phpMyAdmin (16:15–17:00) und Abschluss (17:00–17:15) statt des Ingress-Blocks; Frontmatter-`description` und § „Workloads & Networking“ nennen kein Ingress mehr (#260).
- Kubernetes-Schulung Tag 1: `kubectl port-forward deployment/chromium 4000:3000` steht jetzt in § „Chromium deployen“ → § „Imperativ“, § „Port-Forwarding“ schrumpft auf Referenzsätze und bekommt ein SSH-Container-Beispiel als „Harness“ mit `ClusterIP`-Service und `ssh_config` (#260).
- Ingress-Kapitel Tag 1: Hosts `chrome.k8s-training.frickeldave.de` und `code.k8s-training.frickeldave.de` statt der ungültigen `*.*.com`-Platzhalter, `ingressClassName` mit den Kandidaten `nginx`, `traefik` und `traefik-ingress-controller` samt Discovery über `kubectl get ingressclass`, § „Status prüfen“ heißt jetzt § „Ingress-URL ermitteln“ (#260).
- ConfigMaps Tag 2: neue zentrale ConfigMap `linuxserver-common`, `code-server-config` enthält nur noch `DEFAULT_WORKSPACE`, das Deployment bindet beide per `envFrom` ein; Reloader als kanonischer Link samt Installationssätzen und Annotation `reloader.stakater.com/auto: "true"` (#260).
- LimitRange Tag 2 und `examplefiles/limitrange.yaml`: Name `default-container-resources`, Defaults `cpu: "1"` / `memory: "1Gi"`, Requests `cpu: "100m"` / `memory: "256Mi"`, `max`/`min` unverändert; Rechte-Aussage auf Namespace-Admin korrigiert, Fehlerfall `exceeded quota` und `kubectl describe limitrange` ergänzt (#260).
- PV/PVC Tag 2: neue StorageClass-Sektion mit Default-Erkennung und Fehlerbild „PVC bleibt Pending“, auskommentierte `storageClassName` im PVC; § „Analogie: Das Logistiklager“ mit „schlecht erreichbares Regal (Festplatte)“, „Regalplatz auf Schulterhöhe am Eingang (SSD)“ und „Kühl-Regal (Archive)“ neu formuliert (#260).
- Vertiefung MariaDB + phpMyAdmin: NodePort als Alternative zum Ingress, Ingress-Route als freiwillige Zusatzaufgabe (#260).
- Ausblick Tag 1, Feinlernziele Tag 2 und Tag-2-Checkpoint: Code-Server mit PVC sowie MariaDB + phpMyAdmin statt Home Assistant, Nextcloud und Ingress-Routing für vier Anwendungen (#260).
- Beispielmanifests: Namespace `kw-b2824a-default` → `k8s-training`, interner Cluster-FQDN → `code.k8s-training.frickeldave.de` in `code-server-ingress.yaml` und `example_commands.txt` (#260).

### Fixed

- Doku nannte `vector-config.yaml` und `chromium-logging-configmap.yaml`; sie verweist jetzt auf die vorhandenen Dateien `vector-config-map.yaml` und `chromium-logging-config-map.yaml` (#260).
- `examplefiles/code-server-deployment.yaml` nutzt dieselben zwei `envFrom`-Referenzen wie die Doku und setzt `PUID`/`PGID`/`TZ` nicht mehr inline (#260).
- Warnhinweis auf die Dateinamen-Konvention `<app>-<kind>.yaml` samt Prüfritual `kubectl diff` vor dem ersten `kubectl apply -f` in § „Chromium deklarativ neu anlegen“ (#260).
- „Status prüfen“ im Ingress-Kapitel verweist nicht mehr auf den ungültigen Wildcard-Host, sondern auf den tatsächlich gesetzten HOST (#260).

## [1.0.7] - 2026-10-27

### Added

- Release-Gate für Pull Requests nach `dev`: `scripts/release-gate.mjs` bündelt die Regeln (genau eines von `release:yes` / `release:no`, Versionsvergleich gegen das höchste `dev-v*`-Release bzw. gegen die Merge-Base) und `scripts/check-release-label.mjs` liefert dazu den CI- und den lokalen Modus (#282).
- Workflow `fd-pr-release-label` mit dem Required-Status-Check `check-release-label` für Pull Requests nach `dev`; der Job läuft ohne `npm ci`, weil die Skripte nur `node:`-Module importieren (#282).
- Neue Seite `docs/workflow/versionierung und release.md` zu Label-Modell, Regeln, Deploy/Release und Promote (#282).
- Release-Version in der Fußzeile: `src/components/base/Footer.astro` rendert `v<version>` zur Build-Zeit aus `package.json` und verlinkt auf die GitHub-Releases (#282).

### Changed

- Das Label-Modell trennt Issue-Triage und Release-Schalter: `release:yes` / `release:no` hängen jetzt am Pull Request und werden von `fd-configure` verwaltet; der Husky-Hook `.husky/pre-push` ruft das Gate zusätzlich zum Branch-Namens-Check auf und blockiert nur, wenn ein offener PR gegen `dev` die Regeln verletzt (#282).
- Doku-Struktur: die bisherigen Seiten liegen unverändert unter `docs/old/`, die neue Struktur beginnt mit `docs/workflow/`; die Release-Doku führt beide Fassungen in `docs/workflow/versionierung und release.md` zusammen (#282).
- `docs/old/11-dev-usage.md` und `docs/old/features/fr006-autodeploy.md` beschreiben den PR-Schalter und den Versionsvergleich; `npm run test:scripts` führt die beiden neuen Testdateien mit aus (#282).

### Removed

- Die Issue-Ziel-Labels `release:v0.4.0`, `release:v0.5.0`, `release:v0.6.0`, `release:v1.0.0` und `release:backlog` ersatzlos — der Präfix `release:` gehört ausschließlich dem PR-Schalter, und `squad-label-enforce` setzt oder entfernt auf Issues keine `release:`-Labels mehr (#282).
### Fixed

- Das Freitextfeld `image` von `fd-bootstrap` akzeptiert jetzt ein von der GHCR-Paketseite kopiertes `docker pull …`: Umgebender Leerraum und die Präfixe `docker pull`, `docker image pull` und `podman pull` werden entfernt, leere Eingaben fallen unverändert auf `ghcr.io/<owner>/fd-dev-full:latest` zurück. Eine Referenz, die danach nicht der OCI-Form (Registry-Host, Repository-Pfad in Kleinbuchstaben, optionales Tag) entspricht, bricht den Lauf im Runner mit einer `::error::`-Meldung ab, die den Wert und die erwartete Form nennt — vor jedem `kubectl`-Aufruf und damit ohne Kaniko-Job, statt nach Minuten mit einer Registry-Fehlermeldung im Cluster (#282).

## [1.0.6] - 2026-10-26

### Added

- Optionale DeepSeek-Anbindung der Copilot CLI (BYOK über die Anthropic-kompatible API) mit Opt-in über den optionalen Schritt `7/7` von `fd-setup` oder eine Konfigurationsdatei unter `${XDG_CONFIG_HOME:-$HOME/.config}/fd/`; ohne Aktivierung bleibt das Verhalten unverändert (#285).
- `scripts/copilot-provider.mjs`: löst den Launch-Plan (`provider`/`github`) auf, prüft Konfiguration und Key-Datei fail-closed und liefert den Offline-Status für `fd-welcome` und die Start-Flows (#285).
- `--model <id>` und `--no-provider` in `start-work`, `start-reqeng` und `start-review`; `--model` gewinnt gegen Konfiguration und Shell-Env, ein unbekanntes Modell bricht den Flow mit Exit ≠ 0 ab (#285).
- Provider-Zeile im Login-Banner `fd-welcome` und im Offline-Status (`node scripts/copilot-environment.mjs provider`, im Container `node /usr/local/lib/fd-dev/copilot-environment.mjs provider`) sowie `fd-setup --reset-provider` zum Entfernen der Konfiguration inklusive Widerrufshinweis (#285).
- Neue Seite `docs/17-dev-copilot-provider.md` mit Aktivierung, Dateien und Rechten, Variablentabelle, Modellwahl, Fallback, Fehlersuche und Drittanbieter-Hinweis; verlinkt aus `scripts/README.md`, `docker-dev-full/README.md` und `docs/11-dev-usage.md` (#285).

### Changed

- Ein Provider-Fallback startet mit den GitHub-Copilot-Modellen, entfernt die Provider-Variablen aus dem Kind-Env, übergibt kein `--model` und gibt genau eine Warnzeile mit Grund und Host aus — ohne Key-Material (#285).
- Die Aussagen „Maschine enthält keine Secrets“ bzw. „Keine Secrets im Repository“ sind auf eine bewusst begrenzte Ausnahme umformuliert: Der optionale Key liegt als `0600`-Datei außerhalb des Repos (#285).

## [1.0.5] - 2026-10-26

### Fixed

- `npm run start-work` aktiviert den lokalen Marker `.frickeldave-active-issue` jetzt selbst im Ziel-Worktree, nachdem alle übrigen Gates grün sind: Der Launcher schreibt `issue`, `title`, `status`, `tony_approved: true`, `tony_approved_at` (lokaler Zeitstempel mit Offset) und `session_id` (tmux-Sessionname bzw. stabiler `--notmux`-Fallback), ist bei identischem Inhalt idempotent und bricht mit klarer Meldung ab, wenn der Marker nicht geschrieben werden kann; damit endet ein Lauf nicht mehr im toten Stopp der Copilot-Session, weil ein frischer Worktree den gitignorierten Marker nie enthält. Agenten und `npm run start-reqeng` schreiben ihn weiterhin nie (#282).

## [1.0.4] - 2026-10-26

### Added

- Runner-Bootstrap unter `scripts/bootstrap/` (Images, Kubernetes-Namespace, RBAC, Secrets, Deployment) inklusive `--kubeconfig`-Unterstützung für einen expliziten Ziel-Cluster (#282).
- npm-Scripts `bootstrap` und `test:bootstrap` (#282).
- Retry mit exponentiellem Backoff für `docker login` und `docker push` bei transienten Registry-Fehlern (Standard: 3 Versuche); jeder Wiederholungsversuch wird mit Grund geloggt, echte Credential-Fehler brechen sofort ab (#282).
- Abschnitt „In ein anderes Projekt übernehmen“ in `scripts/bootstrap/README.md`: Paket kopieren, `bootstrap.json` anpassen, ausführen (#282).
- Portabilitäts-Guard im Bootstrap-Test: außerhalb von `bootstrap.json` darf im gesamten Paket kein Projekt-Literal mehr stehen (#282).
- Start-Flow-Scripts unter `scripts/`: `start-work.mjs`, `start-reqeng.mjs`, `start-review.mjs`, `flow-shared.mjs`, `ensure-issue-branch.mjs`, `platform-shared.mjs` und `copilot-environment.mjs` inklusive Tests (#282).
- npm-Scripts `start-work`, `start-reqeng`, `start-review` und `test:scripts` (#282).
- Skills `.github/skills/tmux-session-management/` und `.github/skills/worktree-naming-conventions/`, auf die die Start-Scripts verweisen (#282).
- Workflow `fd-configure`, der sämtliche Labels verwaltet: die statischen Namespaces (`go:*`, `release:*`, `type:*`, `priority:*`, `bug`, `feedback`), das Basislabel `squad`, `squad:<member>` je Roster-Zeile und `squad:copilot`; er validiert dabei das deutsche Roster aus `.squad/team.md`, und `go:spec-finished` wird ebenfalls verwaltet. Die 31 verwalteten Labels blieben beim Zusammenlegen unverändert, keine Farbe hat sich verschoben (#282).
- Workflow `fd-bootstrap` samt `.github/workflows/fd-bootstrap/` (Dev-Machine-Renderer, Tests, Dev-Image `docker-dev-full`, Kubernetes-Manifeste, Restart-, Session- und Report-Skripte): legt pro menschlichem Mitglied mit GitHub-Handle ein `fd-dev-full`-StatefulSet plus Service an, baut das Image bei Bedarf mit einem wegwerfbaren Kaniko-Job und startet laufende Maschinen nie automatisch neu (#282).
- Abschnitt `## Menschliche Mitglieder` in `.squad/team.md` (David Koenig, `dave@frickeldave.de`) als Roster-Quelle für die Dev-Machines; `parseHumanMembers` in `scripts/flow-shared.mjs` liest die Tabelle header-getrieben und akzeptiert auch die englische Überschrift (#282).
- `dev-machines`-Role und -RoleBinding in `scripts/bootstrap/k8s/rbac.yaml`, damit der ServiceAccount des Runners StatefulSets, Services und `pods/exec` der Dev-Machines verwalten darf (#282).
- Workflow `fd-promote-prd` als manueller Promote von `dev` nach `main`: prüft dieselben Versions- und CHANGELOG-Gates wie `fd-deploy-prd`, verlangt zusätzlich einen grünen `fd-ci`-Lauf auf der `dev`-Spitze und stößt danach `fd-deploy-prd` an (#282).
- `.github/pull_request_template.md` mit den Gates dieses Repositories: `release:*`-Label am Issue, CHANGELOG-Eintrag unter `## [Unreleased]`, Versionsbump nur in Release-PRs, Basisbranch `dev` (#282).
- `.dockerignore` begrenzt den Build-Kontext der Dev-Images auf die Dateien, die der Dockerfile tatsächlich kopiert (#282).
- Öffentlicher SSH-Schlüssel von `Frickeldave` in `.squad/team.md` unter `## Developer SSH Keys` eingetragen; die doppelte Nennung der Überschrift und der veraltete Satz „für David Koenig ist hier kein Schlüssel hinterlegt“ sind entfernt, und `dev-machines.test.mjs` prüft den registrierten Schlüssel statt des schlüssellosen Zustands (#282).
- npm-Script `versionbump` mit `scripts/versionbump.mjs` und `scripts/versionbump.test.mjs`: hebt `package.json` an und öffnet gleichzeitig die Release-Sektion in `CHANGELOG.md`, indem der Inhalt von `## [Unreleased]` nach `## [x.y.z] - <Datum>` wandert und ein leeres `Unreleased` zurückbleibt; ohne neue Abhängigkeit (`node:readline/promises`), mit allen Prüfungen vor dem ersten Schreibzugriff, 21 Tests und einem um das neue Testfile erweiterten `test:scripts` (#282).
- Job `release` in `fd-deploy-dev`, der für den CI-Commit das Pre-Release `dev-v<version>` veröffentlicht; der Lauf ist idempotent und nutzt `--prerelease --latest=false` (#282).

### Changed

- Bootstrap-Zielwerte auf dieses Repository umgestellt: Label `fd`, 2 Runner-Replicas, Images `ghcr.io/frickeldave/fd-dev-*`; der Namespace kommt ausschließlich aus `scripts/bootstrap/bootstrap.json` (#282).
- Bootstrap, PowerShell-Wrapper und Kubernetes-Templates enthalten kein Namespace-Literal mehr; das Paket ist damit in ein anderes Repository kopierbar (#282).
- Kaniko-Bausteine (Image, Build-/Push-Steps, RBAC) bleiben für ein künftiges `fd-deploy.yaml` erhalten; nicht mehr benötigte App-Deploy-RBAC-Objekte wurden entfernt (#282).
- Kubernetes-Templates auf neutrale Dateinamen umbenannt: `namespace.yaml`, `rbac.yaml`, `runner-secrets.yaml`, `runner-deployment.yaml` (#282).
- Image-Referenzen kommen ausschließlich aus `bootstrap.json` bzw. den Umgebungsvariablen `DEV_BASE_IMAGE`, `GH_RUNNER_IMAGE` und `KANIKO_IMAGE` (vormals `FD_KANIKO_IMAGE`) und brechen sonst mit einer klaren Meldung ab; bei `SKIP_IMAGE_BUILD=true` werden die Build-only-Images nicht mehr verlangt (#282).
- Das Label `app.kubernetes.io/part-of` wird aus `partOf` (Fallback `githubRunnerRepo`) gerendert und vor dem Apply gegen die Kubernetes-Label-Regeln validiert (#282).
- Das Runner-Image-Dockerfile hat keinen Default für `DEV_BASE_IMAGE` mehr; `bootstrap.mjs` übergibt den Wert immer per `--build-arg` (#282).
- Dokumentation (README, `bootstrap.md`, Docker-READMEs) beschreibt durchgängig die konfigurationsgetriebenen Werte statt Projekt-Literale (#282).
- Issue-Templates auf eine einzige Standardvorlage `.github/ISSUE_TEMPLATE/standard.yaml` zusammengeführt (Ziel, Technik, Akzeptanzkriterien, Scope, betroffene Komponenten, offene Fragen, Risiko); Labels setzt der Triage-Workflow (#282).
- Start-Flow-Scripts auf dieses Einzel-Repository angepasst: `readiness()` prüft Repo-Root, Git-Work-Tree und Toolchain statt vier Schwester-Repositories; nur noch `DEV_SERVER_PORT` statt der fünf Service-Ports; GitHub-Projects-Prüfung nutzt `PROJECT_OWNER`/`PROJECT_NUMBER` (Default `Frickeldave`/`2`) mit `user(login:)`; Worktree-Fallback liegt unter `~/.cache/flow-worktrees` (#282).
- Die Start-Flow-Tests laufen mit `node --test` (inkl. `--experimental-test-module-mocks`) statt vitest; gemeinsame Helfer in `scripts/test-mock-support.mjs` (#282).
- `fd-ci` führt `lint-checks` und `scad-smoke-test` auf den selbst gehosteten `fd`-Runnern aus; die Actions sind auf `actions/checkout@v7` und `actions/setup-node@v7` mit vollständigen Commit-SHAs gepinnt (#282).
- Runner-Limits in `scripts/bootstrap/k8s/runner-deployment.yaml` von 1 CPU / 2 GiB auf 3 CPU / 8 GiB angehoben, die Requests bleiben bei 100m CPU / 512Mi; der e2e-Job läuft ebenfalls auf den `fd`-Runnern, und `playwright.config.js` wartet 600 s statt 300 s auf den `webServer`-Build (#282).
- `scripts/prose-install.mjs` und `scripts/install-openscad.mjs` brauchen unter Windows kein `unzip`, `cp` und `mv` mehr: entpackt wird mit `Expand-Archive`, kopiert und verschoben mit `Copy-Item` und `Move-Item`; der Download-Stream ist vor dem Entpacken geschlossen, und das OpenSCAD-Payload wird unabhängig von der Schreibweise seines Ordnernamens gefunden (#282).
- `fd-podcast-update` läuft mit beiden Jobs auf den `fd`-Runnern; der nvm-Import und die Login-Shell entfallen, `GITHUB_OUTPUT` wird vor dem RSS-Vergleich geleert, und die Actions sind auf volle Commit-SHAs gepinnt (#282).
- `yaml` ist jetzt devDependency, weil die Tests des Dev-Machine-Workflows die gerenderten Manifeste parsen (#282).
- Die Entscheidungen aus `.squad/decisions/inbox/` sind in die gemeinsame `.squad/decisions.md` übernommen (#282).
- `fd-deploy-dev` lässt beide Jobs auf `[self-hosted, fd]` laufen (#282).
- `fd-deploy-prd` vergleicht nur noch mit dem neuesten **stabilen** GitHub-Release (`isPrerelease == false`, `dev-v*` zusätzlich defensiv ausgeschlossen); neues Gate: `dev <= latest_stable` überspringt den Merge, `main <= latest_stable` überspringt Deploy und Release mit einem `::notice::`, `main > latest_stable` deployt und veröffentlicht (#282).
- Der Kaniko-Build von `fd-dev-full` nutzt einen Layer-Cache (`--cache=true`, `--cache-repo=ghcr.io/<owner>/fd-dev-kaniko-cache`, `--cache-ttl=336h` in `.github/workflows/fd-bootstrap/k8s/fd-k8s-kaniko-build-job.yaml`); `CACHE_REPO` leitet `fd-bootstrap.yml` aus dem kleingeschriebenen Owner ab. Gemessen: kalt 437 s, warm 237 s, deshalb steigt das Job-Timeout von 600 s auf 900 s (#282).
- Dokumentation, Charters und Code-Kommentare sind auf Deutsch umgestellt: `docs/**`, `README.md`, `scripts/README.md` (neu geschrieben, weil er Dateien dokumentierte, die es nie gab), `.github/pull_request_template.md`, `.squad/routing.md`, die Charters (`rai` aus den ausgelieferten Vorlagen neu aufgebaut, `ralph`, `fact-checker`, `tony`) und `.squad/ralph-instructions.md` sowie die Kommentare in `scripts/**`, `test/**`, `src/**` und allen Workflows. Veraltete Aussagen zu Workflow-Namen, `postinstall`-Kette, ESLint-Flat-Config, Vale-Einstellungen und toten Links sind dabei korrigiert (#282).

### Removed

- Eingebaute Projekt-Defaults in `bootstrap.mjs` (Namespace-, Repository-, Label- und Image-Literale) (#282).
- Die vier getrennten Issue-Templates für Bug-, Feature-, Content- und Dokumentationsarbeit (#282).
- Der Schritt `npx playwright install --with-deps chromium` im e2e-Job; Browser und Systembibliotheken liegen im `fd-dev-base`-Image, und der Runner-Benutzer hat kein `sudo` (#282).
- Workflow `.github/workflows/squad-sync-squad-labels.yml`; seine Labels `squad:<member>` und `squad:copilot` pflegt jetzt `fd-configure`, damit nie zwei Workflows unterschiedliche Werte an dasselbe Label schreiben (#282).

### Fixed

- Runner-Registrierung verwendet keine doppelt präfigierten Namen mehr (`github-actions-runner-github-actions-runner-*`); der Entrypoint stellt `RUNNER_NAME_PREFIX` nur voran, wenn der Pod-Name es nicht bereits enthält (#282).
- `fd-podcast-update` schlug seit dem 15.09.2026 bei jedem Schedule-Lauf fehl, weil `ubuntu-latest` Node 22 ausliefert, der Workflow aber Node 24 verlangte; die `fd`-Runner liefern Node 24 (#282).
- `.vscode/tasks.json` hatte einen Task „Deploy to Main“, der direkt nach `main` pushte und damit Versions-Gate, CHANGELOG-Pflicht und `fd-ci` umging; er startet jetzt `fd-promote-prd.yml` per `gh workflow run` (#282).

## [1.0.3] - 2026-09-14

### Added

- Social-Share: Label „Share via..." vor den Buttons, neue Instagram- und TikTok-Buttons sowie echte Artikel-URLs statt Platzhalter-Domain (#273).

### Changed

- Footer-Link `© Frickeldave` verweist jetzt auf `/aboutme` statt `/terms` (#274).

### Removed

- Terms-Seite (`/terms`) samt Content, Layout und Content-Collection entfernt (#274).

### Security

- `smol-toml` per npm-Override auf `1.8.0` angehoben (behebt DoS-Schwachstelle) (#276).

## [1.0.2] - 2026-09-13

### Fixed

- Pages-Deploy: `package-manager` für `withastro/action` explizit auf `npm` gesetzt (kein Lockfile im Repo).

## [1.0.1] - 2026-09-13

### Changed

- CI/Workflows: auf GitHub-Hosted Runner umgestellt, Workflows umbenannt und mit Kurzbeschreibungen versehen.
- `main` in `dev` gemergt (Branch-Reconciliation).

## [1.0.0] - 2026-09-10

### Added

- Initial release of Astrogon.
