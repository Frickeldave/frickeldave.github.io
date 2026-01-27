# Product Catalog Sync - Dokumentation

## Übersicht

Das Product Catalog Sync Feature ermöglicht die automatisierte Synchronisierung von Produktdaten und
Bildern aus einem lokalen Verzeichnis in das GitHub Repository. Es stellt sicher, dass
`public/data/handmade.json` und die Bild-Assets unter `src/assets/handmade/` immer auf dem neuesten
Stand sind.

## Features

- ✅ **Automatischer Sync**: Liest Daten aus lokalen JSON-Dateien & Bildern.
- ✅ **Validierung**: Prüft Schema (Tags, Felder) und Dateinamen-Konventionen.
- ✅ **Clean-Up**: Löscht automatisch verwaiste Bilder und Produkte.
- ✅ **Change Detection**: Erkennt Änderungen basierend auf Datei-Hashes (Bilder) und Content
  (JSON).
- ✅ **Format Support**: Unterstützt `.png`, `.jpg` und `.jpeg` Bilder.
- ✅ **Git Integration**: Erstellt automatisch einen neuen Branch mit den Änderungen.

## Verwendung

### 1. Script Ausführen

Das Script kann über npm gestartet werden:

```bash
# Interaktiver Modus (fragt nach Pfad)
npm run sync-products

# Mit direktem Pfad-Argument
npm run sync-products "C:\Pfad\Zu\Deinem\Katalog"
```

### 2. Quell-Verzeichnis Struktur

Der Quell-Ordner muss folgende Struktur haben:

```text
Katalog/
├── tags.json                 # Liste erlaubter Tags
├── 3D/                       # Kategorie-Ordner (3D, EP, WO, LA)
│   ├── 3DND8D-raetselei/     # Produkt-Ordner (Muss mit Artikelnummer beginnen)
│   │   ├── 3DND8D.json       # Metadaten (Name muss Artikelnummer entsprechen)
│   │   ├── 3DND8D-01.jpg     # Bild 1
│   │   └── 3DND8D-02.png     # Bild 2
└── ...
```

### 3. Dateinamen Konventionen

- **Kategorien**: `3D`, `EP`, `WO`, `LA`
- **Artikelnummern**: 6 Zeichen (2 Großbuchstaben Kategorie + 4 Alphanumerisch). Beispiel: `3DND8D`
- **Bilder**: `<Artikelnummer>-<XX>.<ext>` (XX = 00-99). Beispiel: `3DND8D-01.jpg`

### 4. JSON Schema

Jede Produkt-JSON muss folgende Felder enthalten:

```json
{
  "name": "Produkt Name",
  "description": "Beschreibung...",
  "tags": ["Tag1", "Tag2"],
  "price": 10,
  "size": "10cm x 10cm",
  "visible": true,
  "customizable": false
}
```

> **Hinweis**: `articleNumber` und `category` werden vom Script anhand der Ordnerstruktur
> automatisch ergänzt.

## Ablauf der Synchronisierung

1.  **Scan**: Script liest alle Ordner und validiert gegen `tags.json` und Schema.
    - Ungültige Produkte werden **IGNORED** (Details im Log).
2.  **Diff**: Vergleicht mit `public/data/handmade.json`.
    - **CREATE**: Neues Produkt gefunden.
    - **UPDATE**: Metadaten haben sich geändert.
    - **DELETE**: Produkt existiert im Ziel, aber nicht mehr in der Quelle.
3.  **Propose**: Zeigt eine Zusammenfassung der geplanten Änderungen.
4.  **Execute** (nach Bestätigung):
    - Erstellt Branch `chore/synchronize-products-YYYY-MM-DD...`.
    - Kopiert/Löscht Bilder in `src/assets/handmade/`.
    - Aktualisiert `public/data/handmade.json`.
    - Schreibt Logfile nach `scripts/synchronize-products/`.

## Logs

Detaillierte Logs werden für jeden Lauf erstellt unter:
`scripts/synchronize-products/synchronize-products-<TIMESTAMP>.md`

Dort findest du auch Gründe, warum Produkte eventuell ignoriert wurden (z.B. falsche Tags oder
fehlende Bilder).

## Frontend Integration

Die Webseite lädt Bilder dynamisch anhand der Artikelnummer. Es wird automatisch nach dem ersten
verfügbaren Bild im Ordner `src/assets/handmade/<Kategorie>/<Artikelnummer>/` gesucht, unabhängig
von der Dateiendung (`.jpg`, `.png`, etc.).
