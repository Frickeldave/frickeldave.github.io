---
trigger: manual
---

# Anforderung

Die Pflege der Produktinformationen auf der Website, die in Form einer JSON Datei und Bildern
gespeichert sind, sollen auf Basis der Dateien in einer lokalen Ordnerstruktur automatisch mit Hilfe
eines Scriptes synchronisiert werden.

## Beschreibung der lokalen Ordnerstruktur

Unter einem definierbaren Pfad habe ich einen Produktkatalog aufgebaut. Dieser ist wie folgt
aufgebaut:

- Ordner: Katalog
  - Ordner: <kategorie>
    - Ordner: <artikelnummer-produkt>
      - Datei: <artikelnummer>.JSON
      - Datei(en): <artikelnummer>-<01-99>.PNG

Als Kategorie gibt es aktuell die folgenden:

- 3D: Steht für 3D-Druck
- EP: Epoxidharz
- WO: Holz
- LA: Laser

Jedes Produkt hat einen eigenen Ordner, bestehend aus der Artikelnummer und einer kurzen
Beschreibung. Die Artikelnummer setzt sich wie folgt zusammen:

- Das zweistellige Kategoriekürzel
- Gefolgt von einer zufälligen Reihe von 4 Buchstaben und Zahlen

Innerhalb des Produktordners ist eine JSON Datei mit folgenden Schema hinterlegt:

{ "$schema": "http://json-schema.org/draft-04/schema#", "description": "", "type": "object",
"properties": { "name": { "type": "string", "minLength": 1 }, "description": { "type": "string",
"minLength": 1 }, "tags": { "type": "array", "items": { "required": [], "properties": {} } },
"price": { "type": "number" }, "size": { "type": "string", "minLength": 1 }, "visible": { "type":
"boolean" }, "customizable": { "type": "boolean" } }, "required": [ "name", "description", "tags",
"price", "size", "visible", "customizable" ] }

Neben der JSON Datei liegen bis zu 99 Bilder des Produktes mit dem Dateinamen
<artikelnummer>-<01-99>.PNG.

## Beschreibung der Ordner und Dateien im Repo

Alle Bilder des Produktkatalogs sollen unter src/assets/handmade/<kategoriekürzel>/<artikelnummer>
liegen. Die Kategorien und Artikelnummer sind identisch wie oben aufgebaut.

Alle Metainformationen sollen unter public\data\handmade.json liegen. Das Schema der Datei ist wie
folgt definiert:

{ "$schema": "http://json-schema.org/draft-04/schema#", "description": "", "type": "object",
"properties": { "products": { "type": "array", "uniqueItems": true, "minItems": 1, "items": {
"required": [ "articleNumber", "name", "description", "category", "price", "size", "visible",
"customizable" ], "properties": { "articleNumber": { "type": "string", "minLength": 1 }, "name": {
"type": "string", "minLength": 1 }, "description": { "type": "string", "minLength": 1 }, "category":
{ "type": "string", "minLength": 1 }, "tags": { "type": "array", "items": { "required": [],
"properties": {} } }, "price": { "type": "number" }, "size": { "type": "string", "minLength": 1 },
"visible": { "type": "boolean" }, "customizable": { "type": "boolean" } } } } }, "required": [
"products" ] }

## Aufgaben

### Prüfung

- Es soll ein Script generiert werden, dass alle Informationen die in dem gegebenen Ordner abgelegt
  sind, mit dem Git Repository synchronisiert.
- Das Script soll Plattformübergreifend funktionieren, es bietet sich wohl Typescript an.
- Das Script soll in /scripts/synchronize-products.ts liegen
- Das Script muss gut kommentiert sein, bitte in englisch
- Folgende Schritte soll das Script durchführen:
  - Erstellen einer Liste aller Aktionen
    - Welche Produkte werden im Ziel aktualisiert
    - Welche Produkte werden im Ziel gelöscht. Es werden Produkte im Ziel gelöscht, die nicht in der
      Quellordnerstruktur vorhanden sind
    - Welche Produkte werden im Ziel angelegt
    - Welche Produkte werden ignoriert. Ignoriert werden Produkte unter folgenden Bedingungen:
      - Kategorieordner die nicht dem Schema entsprechen
      - Der Produktordner entspricht nicht dem gegebenen Schema <LA|EP|WO|3D...4stellen>
      - Die Tags in der Quell-JSON entsprechen nicht den tags, die im root des Quellordner in der
        Datei "tags.json" definiert sind.
      - Die Quell-JSON entspricht nicht dem Schema
      - Einzelne oder alle Quell-Bilddateien entsprechen nicht dem Dateinamensschema
        <artikelnummer>-<01-99>.PNG.
  - Ist die Liste erstellt, soll das Script eine summary ausgeben und der Benutzer muss entscheiden
    ob die sync-Aktion durchgeführt werden soll.

### Durchzuführende Aktionen durch das Script

Bestätigt der Benutzer, werden folgende Aktionen durchgeführt:

- Das Script soll einen Branch aus "main" erstellen. Der Branch soll heißen
  "chore/synchronize-products-yyyy-mm-dd_hh-mm-ss".
- In die Datei public\data\handmade.json sollen die Inhalte aller gefunden und gültigen JSON Dateien
  in den Produktordner eingetragen werden, sofern diese gültig sind.
- Ist in der public\data\handmade.json ein Produkt gelistet, was nicht im Quellordner enthalten ist,
  soll das Produkt aus der JSON Datei gelöscht werden.
- Die Bilder sollen unter
  src\assets\handmade\<kategoriekürzel>\<Artikelnummer>\<Artikelnummer>-<01-99>.png gespeichert
  werden.
- Ist das Zielbild schon mit gleichem Namen vorhanden, berechne die Hashwerte der Quellbilder und
  der Zielbilder, vergleiche diese und überschreibe das Zielbild wenn sich die Hashsumme
  unterscheidet.
- Bilder die nicht im Quellordner vorhanden sind, sollen gelöscht werden.
- Es sollen alle Aktionen in eine Logdatei geschrieben werden.

Die Log-Dateien sollen unter
/scripts/synchronize-products/synchronize-products-yyy-mmm-ddd_hh-mm-ss.md abeglegt werden.
