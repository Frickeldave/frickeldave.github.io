# FR003 - Handmade Produktcatalog

## Übersicht

Das Handmade Produktcatalog-System ist ein Etsy-ähnlicher Online-Katalog, der handgefertigte
Produkte präsentiert. Besucher können Produkte durchsuchen, filtern und sich über E-Mail über
Produkte informieren, jedoch keine direkten Käufe tätigen.

**URL:** `/handmade`  
**Erstellt:** November 2025  
**Status:** Implementiert

## Architektur

### Datenquelle

- **Datei:** `public/data/handmade.json`
- **Format:** JSON mit Array von Produktobjekten
- **Eigenschaften:** Englische Keys, deutsche Anzeige auf der Website

### Seiten & Routen

1. **Übersichtsseite:** `/handmade/shop`
   - Zeigt alle sichtbaren Produkte als Grid
   - Sidebar mit Filter- und Suchfunktionen (Desktop)
   - Mobile Filter-Bar (Mobile)
   - Datei: `src/pages/handmade/shop.astro`

2. **Produktdetailseite:** `/handmade/[articleNumber]`
   - Dynamisch generierte Seiten für jedes Produkt
   - URL-Muster: `/handmade/<articleNumber>` (z.B. `/handmade/3DA8F3`)
   - Datei: `src/pages/handmade/[articleNumber].astro`
   - Static Site Generation (SSG) für alle sichtbaren Produkte

3. **Warenkorb:** `/handmade/warenkorb`
   - Clientseitiger Warenkorb, siehe Abschnitt [Warenkorb](#warenkorb)
   - Datei: `src/pages/handmade/warenkorb.astro`

### Komponenten

| Komponente               | Pfad                                             | Beschreibung                                                  |
| ------------------------ | ------------------------------------------------ | ------------------------------------------------------------- |
| `Card.astro`             | `src/components/handmade/Card.astro`             | Produktkarte für Grid-Ansicht                                 |
| `ProductGallery.astro`   | `src/components/handmade/ProductGallery.astro`   | Bildergalerie auf Detailseite                                 |
| `ProductInfo.astro`      | `src/components/handmade/ProductInfo.astro`      | Produktinformationen auf Detailseite                          |
| `Sidebar.astro`          | `src/components/handmade/Sidebar.astro`          | Desktop-Filter-Sidebar                                        |
| `ScadModelDisplay.astro` | `src/components/handmade/ScadModelDisplay.astro` | 3D-Modell mit STL-Download und SCAD-Quelltext                 |
| `AddToCartButton.astro`  | `src/components/handmade/AddToCartButton.astro`  | "In den Warenkorb"-Button; in Karten kompakt als "Hinzufügen" |
| `CartNavLink.astro`      | `src/components/handmade/CartNavLink.astro`      | Warenkorb-Einstieg mit Zähler (Sidebar und Detailseite)       |

## Datenstruktur

### Produkt-Objekt (HandmadeItem)

```typescript
type HandmadeItem = {
  articleNumber: string; // Eindeutige Artikelnummer
  name: string; // Produktname (Deutsch)
  description: string; // Beschreibung (Deutsch)
  picture: string; // Bildpfad (nicht mehr verwendet, Legacy)
  category: "3D-Druck" | "Holz" | "Laser" | "Epoxidharz";
  tags: string[]; // Array von Tags
  price: number; // Preis in Euro
  size?: string; // Optionale Größenangabe
  visible: boolean; // Sichtbarkeit (nur visible=true werden angezeigt)
  customizable: boolean; // Personalisierbar (zeigt ✨-Symbol)
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

Das System unterstützt **vier feste Kategorien**, die die verschiedenen Herstellungsverfahren
repräsentieren:

| Kategorie      | Beschreibung                | Beispiele                                          |
| -------------- | --------------------------- | -------------------------------------------------- |
| **3D-Druck**   | 3D-gedruckte Produkte       | Weihnachtsbaum Deko, Geschenkboxen, Namensschilder |
| **Holz**       | Handgefertigte Holzprodukte | Schneidebretter, Schmuckkästchen                   |
| **Laser**      | Lasergeschnittene Produkte  | Osterhasen, Weihnachtsanhänger                     |
| **Epoxidharz** | Epoxidharz-Produkte         | River Tables, Untersetzer                          |

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

| Präfix | Kategorie          | Beispiele              |
| ------ | ------------------ | ---------------------- |
| **3D** | 3D-Druck           | 3DA8F3, 3DG4V7, 3DM5B8 |
| **WO** | Holz (Woodwork)    | WO52K9, WOT3P5, WON4C6 |
| **LA** | Laser              | LAH7M4, LAW9X2         |
| **EP** | Epoxidharz (Epoxy) | EPR6N8, EPQ8D6         |

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
  - Preis (groß, türkis) und "Hinzufügen"-Button nebeneinander
- **Interaktion:**
  - Hover-Effekt (Scale-Up)
  - Klick auf Karte öffnet Detailseite
  - Klick auf "Hinzufügen" fügt die Position hinzu, ohne die Detailseite zu öffnen
  - Bestätigung: das Warenkorb-Symbol wechselt kurz auf ein Häkchen und der Button wird grün

> Die Zeile aus Preis und Button ist der schmalste Bereich der Karte: bei `xl` rendert das Grid drei
> Spalten, wodurch nur rund 213 px zur Verfügung stehen (Preis bis 73 px, 8 px Abstand). Deshalb
> trägt der Button in Karten das kürzere Label. Das Label bleibt außerdem konstant — die Bestätigung
> tauscht nur das Icon, weil ein wechselnder Text die Buttonbreite und damit die ganze Zeile
> verschieben würde. Die Zeile bricht bei Bedarf um (`flex-wrap`), statt über den Rand zu laufen.

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

## Warenkorb

Der Warenkorb ist **rein clientseitig**. Es gibt kein Backend, keinen Formular-Dienst und keine
serverseitige Speicherung von Warenkörben.

### Ablauf

1. `AddToCartButton` auf Produktkarte oder Detailseite legt eine Position an bzw. erhöht die Menge.
2. Die Warenkorb-Zähler aktualisieren sich sofort: die Sidebar (`CartNavLink.astro`) und das
   Kurzsymbol im globalen Header (`Header.astro`), das erst erscheint, sobald der Warenkorb gefüllt
   ist.
3. Auf `/handmade/warenkorb` lässt sich die Menge ändern, entfernen oder der Warenkorb leeren;
   optional werden Name, E-Mail und Nachricht ergänzt.
4. „Warenkorb per E-Mail senden“ übergibt die Auswahl als vorformulierten Text an das
   E-Mail-Programm (`mailto:` an `handmade@frickeldave.de`). Erst dort wird die Mail tatsächlich
   versendet.

### Speicherung

- **Key:** `frickeldave:handmade-cart` in `localStorage`
- **Inhalt:** ausschließlich `articleNumber` + `quantity` je Position
- **Keine Preisduplikation:** Name und Preis werden zur Anzeigezeit aus `public/data/handmade.json`
  aufgelöst. Katalogänderungen wirken damit sofort auf den Warenkorb, ohne dass veraltete Preise
  angezeigt werden.
- **Vorhandener Storage wird bereinigt:** Positionen, deren Produkt nicht mehr sichtbar oder nicht
  mehr im Katalog ist, werden beim Rendern entfernt.
- **Ungültige Daten** (fremde oder beschädigte Payloads) werden wie ein leerer Warenkorb behandelt,
  damit ein fehlerhafter Eintrag den Shop nicht bricht.

### Module

| Datei                                | Aufgabe                                                                                                                                                          |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/cart.ts`                    | Speicherung, Mengenlogik, Summen, `mailto:`-Erzeugung. Läuft auch server-seitig (ohne `window` liefert es leere Ergebnisse).                                     |
| `src/lib/formatPrice.ts`             | Einheitliche Euro-Formatierung (`35,00 €`) für Karte, Detailseite und Warenkorb.                                                                                 |
| `src/lib/cart-dom.ts`                | DOM-Anbindung: Click-Delegation für die Buttons und Aktualisierung der Zähler-Badges. Idempotent, damit Astro-Scripts bei View-Transitions nicht doppelt binden. |
| `src/pages/handmade/warenkorb.astro` | Warenkorb-Seite (Rendering, Mengensteuerung, Kontaktfelder, Versand)                                                                                             |

`bindCartDom()` wird zentral aus `src/components/base/Header.astro` aufgerufen. Der Header liegt
über `BaseLayout` auf jeder Seite, damit das Header-Kurzsymbol auch außerhalb von `/handmade`
korrekt ist. Die Aufrufe in `AddToCartButton.astro` und `CartNavLink.astro` sind redundant, halten
die Komponenten aber eigenständig funktionsfähig — die Funktion ist idempotent.

### Grenzen des `mailto:`-Versands

E-Mail-Programme und Browser kürzen `mailto:`-URLs ab etwa 2000 Zeichen. Für sehr große Warenkörbe
zeigt die Seite deshalb statt des Links einen kopierbaren Text an (`MAILTO_LENGTH_LIMIT = 1900`).

### Nicht enthalten

- Zahlungsabwicklung, Bestell- oder Lagerverwaltung
- Serverseitige Speicherung von Warenkörben oder Kundendaten
- Versand-, Rabatt- oder Steuerlogik

## Metaeigenschaften

| Eigenschaft     | Typ      | Pflicht | Beschreibung                        |
| --------------- | -------- | ------- | ----------------------------------- |
| `articleNumber` | string   | ✓       | Eindeutige 6-stellige ID            |
| `name`          | string   | ✓       | Produktname (Deutsch)               |
| `description`   | string   | ✓       | Produktbeschreibung (Deutsch)       |
| `category`      | string   | ✓       | Eine von 4 Kategorien               |
| `tags`          | string[] | ✓       | Array von Tags (kann leer sein)     |
| `price`         | number   | ✓       | Preis in Euro (Decimal)             |
| `visible`       | boolean  | ✓       | Sichtbarkeit (false = ausgeblendet) |
| `customizable`  | boolean  | ✓       | Personalisierbar (zeigt ✨)         |
| `size`          | string   | -       | Größenangabe (optional)             |
| `picture`       | string   | -       | Legacy-Feld (nicht mehr verwendet)  |

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

1. **Eingeschränkte E-Commerce-Funktionalität**
   - Warenkorb vorhanden (rein clientseitig, siehe unten)
   - Keine Zahlungsabwicklung
   - Bestellabschluss nur per E-Mail

2. **Statische Produktliste**
   - Änderungen erfordern Rebuild
   - Kein CMS-Backend

3. **Manuelle Bildverwaltung**
   - Bilder müssen manuell in Ordnerstruktur abgelegt werden
   - Keine automatische Bildoptimierung außer Astro's Image-Komponente
   -
