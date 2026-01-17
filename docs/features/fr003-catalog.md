# FR003 - Handmade Produktcatalog

## Übersicht

Das Handmade Produktcatalog-System ist ein Etsy-ähnlicher Online-Katalog, der handgefertigte Produkte präsentiert. Besucher können Produkte durchsuchen, filtern und sich über E-Mail über Produkte informieren, jedoch keine direkten Käufe tätigen.

**URL:** `/handmade`  
**Erstellt:** November 2025  
**Status:** Implementiert

## Architektur

### Datenquelle

- **Datei:** `public/data/handmade.json`
- **Format:** JSON mit Array von Produktobjekten
- **Eigenschaften:** Englische Keys, deutsche Anzeige auf der Website

### Seiten & Routen

1. **Übersichtsseite:** `/handmade`
   - Zeigt alle sichtbaren Produkte als Grid
   - Sidebar mit Filter- und Suchfunktionen (Desktop)
   - Mobile Filter-Bar (Mobile)
   - Datei: `src/pages/handmade.astro`

2. **Produktdetailseite:** `/handmade/[articleNumber]`
   - Dynamisch generierte Seiten für jedes Produkt
   - URL-Muster: `/handmade/<articleNumber>` (z.B. `/handmade/3DA8F3`)
   - Datei: `src/pages/handmade/[articleNumber].astro`
   - Static Site Generation (SSG) für alle sichtbaren Produkte

### Komponenten

| Komponente | Pfad | Beschreibung |
|------------|------|--------------|
| `Card.astro` | `src/components/handmade/Card.astro` | Produktkarte für Grid-Ansicht |
| `ProductGallery.astro` | `src/components/handmade/ProductGallery.astro` | Bildergalerie auf Detailseite |
| `ProductInfo.astro` | `src/components/handmade/ProductInfo.astro` | Produktinformationen auf Detailseite |
| `Sidebar.astro` | `src/components/handmade/Sidebar.astro` | Desktop-Filter-Sidebar |

## Datenstruktur

### Produkt-Objekt (HandmadeItem)

```typescript
type HandmadeItem = {
  articleNumber: string;      // Eindeutige Artikelnummer
  name: string;                // Produktname (Deutsch)
  description: string;         // Beschreibung (Deutsch)
  picture: string;             // Bildpfad (nicht mehr verwendet, Legacy)
  category: "3D-Druck" | "Holz" | "Laser" | "Epoxidharz";
  tags: string[];              // Array von Tags
  price: number;               // Preis in Euro
  size?: string;               // Optionale Größenangabe
  visible: boolean;            // Sichtbarkeit (nur visible=true werden angezeigt)
  customizable: boolean;       // Personalisierbar (zeigt ✨-Symbol)
};
```

### Beispiel-Produkt

```json
{
  "articleNumber": "3DA8F3",
  "name": "Weihnachtsbaum Deko",
  "description": "Festlicher 3D-gedruckter Weihnachtsbaum mit LED-Beleuchtung. Perfekt für die Weihnachtsdekoration.",
  "category": "3D-Druck",
  "tags": ["Weihnachten", "Dekoration", "LED"],
  "price": 15.99,
  "size": "15cm x 10cm",
  "visible": true,
  "customizable": false
}
```

## Kategorien

Das System unterstützt **vier feste Kategorien**, die die verschiedenen Herstellungsverfahren repräsentieren:

| Kategorie | Beschreibung | Beispiele |
|-----------|-------------|-----------|
| **3D-Druck** | 3D-gedruckte Produkte | Weihnachtsbaum Deko, Geschenkboxen, Namensschilder |
| **Holz** | Handgefertigte Holzprodukte | Schneidebretter, Schmuckkästchen |
| **Laser** | Lasergeschnittene Produkte | Osterhasen, Weihnachtsanhänger |
| **Epoxidharz** | Epoxidharz-Produkte | River Tables, Untersetzer |

## Tags

Tags sind **frei wählbar** und dienen der thematischen Zuordnung. Aktuell verwendete Tags:

- **Büro**
- **Dekoration**
- **Familie**
- **Geschenke**
- **Küche**
- **LED**
- **Möbel**
- **Ostern**
- **Personalisiert**
- **Rustikal**
- **Schmuck**
- **Weihnachten**
- **Wohnzimmer**

### Tag-Verwendung

- Mehrere Tags pro Produkt möglich
- Tags ermöglichen Filterung nach Themen/Anlässen
- Neue Tags können beliebig hinzugefügt werden

## Artikelnummer-System

### Format

Artikelnummern folgen einem **6-stelligen alphanumerischen Format**:
- Format: `[Präfix][Ziffern/Buchstaben]`
- Beispiele: `3DA8F3`, `WO52K9`, `LAH7M4`, `EPR6N8`

### Struktur & Bedeutung

Die ersten 2-3 Zeichen sind ein **Kategoriepräfix**:

| Präfix | Kategorie | Beispiele |
|--------|-----------|-----------|
| **3D** | 3D-Druck | 3DA8F3, 3DG4V7, 3DM5B8 |
| **WO** | Holz (Woodwork) | WO52K9, WOT3P5, WON4C6 |
| **LA** | Laser | LAH7M4, LAW9X2 |
| **EP** | Epoxidharz (Epoxy) | EPR6N8, EPQ8D6 |

Die restlichen Zeichen sind **zufällige alphanumerische Zeichen** zur eindeutigen Identifikation.

### Verwendung

- **URL-Routing:** `/handmade/<articleNumber>`
- **Bildpfad:** `src/assets/handmade/<category-folder>/<articleNumber>/`
- **Eindeutige Identifikation:** Primärschlüssel für Produkte

## Bilder & Assets

### Verzeichnisstruktur

```
src/assets/handmade/
├── 3d-druck/
│   ├── 3DA8F3/
│   │   └── 3DA8F3-000.png
│   ├── 3DG4V7/
│   │   └── 3DG4V7-000.png
│   └── 3DM5B8/
│       ├── 3DM5B8-000.png
│       ├── 3DM5B8-001.png
│       └── ...
├── holz/
│   ├── WO52K9/
│   └── ...
├── laser/
│   ├── LAH7M4/
│   └── ...
└── epoxidharz/
    ├── EPR6N8/
    └── ...
```

### Namenskonvention

- **Ordnername:** Kategorie in Kleinbuchstaben mit Bindestrichen (z.B. `3d-druck`, `holz`)
- **Unterordner:** Artikelnummer (z.B. `3DA8F3`)
- **Bilddateien:** `<articleNumber>-000.png`, `<articleNumber>-001.png`, etc.
- **Hauptbild:** `-000.png` wird als Vorschaubild verwendet

### Bildintegration

- Verwendet **Astro's Image-Komponente** für Optimierung
- Automatisches Glob-Import: `import.meta.glob('/src/assets/handmade/**/*.{png,jpg,jpeg,webp}')`
- Placeholder-Bild bei fehlenden Bildern: `src/assets/placeholder-product-notfound.png`

## Features & Funktionen

### Übersichtsseite (/handmade)

#### Desktop-Ansicht
- **Grid-Layout:** 2-spaltig (responsive)
- **Sidebar (rechts):**
  - Suchfeld (Name, Beschreibung, Artikelnummer)
  - Kategorie-Filter (exklusiv)
  - Tag-Filter (mehrfach wählbar)
  - Personalisierbar-Filter (Checkbox)
  - Sortierung (Name A-Z/Z-A, Preis auf/ab)
  - "Filter zurücksetzen"-Button

#### Mobile-Ansicht
- **Mobile Filter-Bar (oben):**
  - Suchfeld + Sortierung
  - Ausklappbare Kategorie-Filter
  - Ausklappbare Tag-Filter
  - Personalisierbar-Filter
  - Ergebniszähler
  - "Filter zurücksetzen"-Button

#### Produktkarten
- **Anzeige:**
  - Produktbild (quadratisch)
  - Artikelnummer (oben links, Monospace-Font)
  - ✨-Symbol bei `customizable: true`
  - Kategorie (oben rechts)
  - Produktname (Türkis/Cyan)
  - Gekürzte Beschreibung (max. 80 Zeichen)
  - Tags (kleine Badges)
  - Größe (optional)
  - Preis (groß, türkis)
- **Interaktion:**
  - Hover-Effekt (Scale-Up)
  - Klick öffnet Detailseite

#### Filter-Logik
- **Kategorien:** Mehrfachauswahl möglich (OR-Verknüpfung)
- **Tags:** Mehrfachauswahl möglich (AND-Verknüpfung - alle gewählten Tags müssen vorhanden sein)
- **Suche:** Durchsucht Name, Beschreibung, Artikelnummer und Tags
- **Sortierung:** Bleibt bei Filteränderungen erhalten
- **Sync:** Desktop- und Mobile-Filter sind synchronisiert

### Produktdetailseite (/handmade/[articleNumber])

#### Layout
- **Breadcrumb-Navigation:** Home > Handmade > Artikelnummer
- **Zweispaltig:**
  - **Links:** Bildergalerie (vertikale Thumbnails) + Hauptbild
  - **Rechts:** Produktinformationen

#### Bildergalerie
- **Thumbnails:** Vertikal untereinander angeordnet
- **Hauptbild:** Zeigt ausgewähltes Bild (Default: erstes Bild)
- **Interaktion:** Klick auf Thumbnail wechselt Hauptbild

#### Produktinformationen
1. **Header-Sektion:**
   - Produktname (groß)
   - Artikelnummer (Monospace)
   - Preis (groß, türkis)

2. **Beschreibung:**
   - Vollständige Produktbeschreibung

3. **Details (Key-Value-Liste):**
   - Kategorie (Badge)
   - Größe (falls vorhanden)
   - Tags (mehrere kleine Badges)
   - Anpassbar (✓ Ja / ✗ Nein)

4. **Kontakt-Sektion:**
   - E-Mail-Button mit vorausgefülltem Betreff
   - Link zur Portfolio-Seite

## Metaeigenschaften

| Eigenschaft | Typ | Pflicht | Beschreibung |
|-------------|-----|---------|--------------|
| `articleNumber` | string | ✓ | Eindeutige 6-stellige ID |
| `name` | string | ✓ | Produktname (Deutsch) |
| `description` | string | ✓ | Produktbeschreibung (Deutsch) |
| `category` | string | ✓ | Eine von 4 Kategorien |
| `tags` | string[] | ✓ | Array von Tags (kann leer sein) |
| `price` | number | ✓ | Preis in Euro (Decimal) |
| `visible` | boolean | ✓ | Sichtbarkeit (false = ausgeblendet) |
| `customizable` | boolean | ✓ | Personalisierbar (zeigt ✨) |
| `size` | string | - | Größenangabe (optional) |
| `picture` | string | - | Legacy-Feld (nicht mehr verwendet) |

## Technische Details

### TypeScript-Typen
- Definiert in: `src/types/index.d.ts`
- Typen: `HandmadeItem`, `HandmadeData`

### Styling
- **Design System:** Türkis/Cyan (`from-cyan-500 to-teal-500`)
- **Glass Morphism:** `.glass` Klassen für Karten
- **Responsive:** TailwindCSS Breakpoints
- **Dark Mode:** Unterstützt

### Client-Side Logic
- **Filtering & Sorting:** Inline `<script>` in `handmade.astro`
- **State Management:** Lokale Variablen (selectedCategories, selectedTags, etc.)
- **Event Handling:** Vanilla JavaScript mit Event Listeners
- **Re-initialization:** Astro Page Events (`astro:page-load`, `astro:after-swap`)

### Static Site Generation
- **getStaticPaths():** Generiert Pfade für alle visible Produkte
- **Build-Zeit:** Alle Seiten werden beim Build generiert
- **404 Handling:** Redirect zu /404 bei ungültiger Artikelnummer

## Wartung & Erweiterung

### Neues Produkt hinzufügen

1. **Bilder vorbereiten:**
   ```bash
   mkdir -p src/assets/handmade/<kategorie>/<articleNumber>/
   # Bilder kopieren: <articleNumber>-000.png, -001.png, etc.
   ```

2. **Produkt in JSON eintragen:**
   ```json
   {
     "articleNumber": "NEW123",
     "name": "Neues Produkt",
     "description": "Beschreibung...",
     "category": "3D-Druck",
     "tags": ["Tag1", "Tag2"],
     "price": 29.99,
     "size": "20cm x 10cm",
     "visible": true,
     "customizable": false
   }
   ```

3. **Build neu ausführen:**
   ```bash
   npm run build
   ```

### Neue Kategorie hinzufügen

1. **TypeScript-Typ erweitern:**
   ```typescript
   // src/types/index.d.ts
   category: "3D-Druck" | "Holz" | "Laser" | "Epoxidharz" | "Neue Kategorie";
   ```

2. **Ordnerstruktur anlegen:**
   ```bash
   mkdir -p src/assets/handmade/neue-kategorie/
   ```

3. **Artikelnummer-Präfix definieren:** (optional, aber empfohlen)
   - Z.B. `NC` für "Neue Kategorie"

### Neue Tags hinzufügen

- Tags können frei in der JSON hinzugefügt werden
- Keine Code-Änderungen notwendig
- Tags werden automatisch in Filter-Liste aufgenommen

## Bekannte Einschränkungen

1. **Keine echte E-Commerce-Funktionalität**
   - Kein Warenkorb
   - Keine Zahlungsabwicklung
   - Nur Kontakt per E-Mail

2. **Statische Produktliste**
   - Änderungen erfordern Rebuild
   - Kein CMS-Backend

3. **Manuelle Bildverwaltung**
   - Bilder müssen manuell in Ordnerstruktur abgelegt werden
   - Keine automatische Bildoptimierung außer Astro's Image-Komponente
   - 