---
agent: 'agent'
description: 'Create inital startpage'
model: Claude Opus 4.5 (copilot)
---

Erstelle eine neue Startseite. Die Inhalte gehören in src/content/home/-index.md, die astro page landet unter src/pages/index.astro. 

### Technische Basis
- Die Seite soll das bestehende Layout und die Design-Patterns aus der aktuellen Website nutzen
- Verwende die vorhandenen Astro-Komponenten aus src/components/
- Halte dich an den bestehenden Stil und die Navigation der Website

### Sektion 1: Hero-Bereich
- Hero-Bereich mit Willkommenstext "Willkommen bei Frickeldave"
- Untertitel mit kurzer Beschreibung der Website-Inhalte (DIY/Handmade und IT/Professional)
- Call-to-Action Buttons zu den Hauptbereichen

### Sektion 2: Aktuelle Posts (mit Tab-Navigation)
Titel: "Aktuelle Posts"

Implementiere ein Tab-System mit drei Tabs:
1. Tab "DIY" - zeigt die letzten 6 Posts aus dem Blog mit der Kategorie/Tag "diy" oder "handmade"
2. Tab "IT" - zeigt die letzten 6 Posts aus dem Blog mit der Kategorie/Tag "it" oder "professional"
3. Tab "3D-Druck" - zeigt die letzten 6 Posts aus dem Blog mit der Kategorie/Tag "3d-druck" oder "3d-printing"

Technische Umsetzung:
- Verwende die Astro Content Collections API: const posts = await getCollection('blog')
- Filtere Posts nach Tags/Kategorien
- Sortiere nach Datum (neueste zuerst)
- Zeige für jeden Post: Thumbnail, Titel, Excerpt, Datum, Autor
- Tab-Wechsel soll mit bestehenden Technologien umgesetzt werden (z.B. mit Alpine.js, React, Svelte oder reinem JavaScript)
- Die Tabs sollen smooth zwischen den verschiedenen Post-Listen wechseln

### Sektion 3: Themenfelder (Feature Cards)
Titel: "Entdecke die Themen"

Zeige vier Cards nebeneinander (Grid Layout):
1. Card "DIY & Handmade"
   - Icon/Bild
   - Kurze Beschreibung: "Holzarbeiten, Laserprojekte und Epoxidharz-Kreationen"
   - Link zum Blog-Filter oder zur Handmade-Seite
   
2. Card "Professional IT"
   - Icon/Bild
   - Kurze Beschreibung: "DevOps, Cloud, Kubernetes und moderne Softwareentwicklung"
   - Link zu IT-Blog-Posts
   
3. Card "Portfolio"
   - Icon/Bild
   - Kurze Beschreibung: "Meine professionelle Laufbahn und Fähigkeiten"
   - Link zur Portfolio-Seite
   
4. Card "Frickeldave Handmade"
   - Icon/Bild
   - Kurze Beschreibung: "Handgefertigte Produkte und Kleingewerbe-Projekte"
   - Link zur Handmade-Seite (src/pages/handmade.astro)

### Sektion 4: Produktschaufenster (Carousel)
Titel: "Frickeldave Handmade - Unsere Produkte"

Implementiere ein Produktkarussell:
- Zeige Produkte von der Handmade-Seite
- Automatisches Durchlaufen (Auto-Scroll alle 3-5 Sekunden)
- Navigation mit Pfeilen links/rechts
- Dots-Navigation unten
- Pro Slide: 3-4 Produkte nebeneinander (responsive: 1 auf Mobile, 2 auf Tablet, 3-4 auf Desktop)
- Jedes Produkt zeigt: Bild, Produktname, Kurzbeschreibung
- Optional: Link zur Handmade-Detailseite

Technische Umsetzung:
Empfohlene Implementierung: HandmadeCarousel Component
Erstelle eine neue React-Komponente, die:

✅ Daten aus handmade.json lädt
✅ Bestehende Card.astro für Produkt-Display nutzt
✅ Swiper.js für Carousel-Funktionalität verwendet
✅ Typen aus types/index.d.ts:93-108 wiederverwendet

### Sektion 5: News
Titel: "Aktuelles & News"

Technische Anforderungen:
- Lade Daten aus public/data/news.json
- Die Sektion wird NUR angezeigt, wenn mindestens ein News-Item mit visible: true existiert
- Zeige NUR News-Items die visible: true haben
- Jedes News-Item hat folgende Struktur:
{
"visible": true,
"date": "2024-12-20",
"text": "News-Text hier",
"imageUrl": "/path/to/image.jpg"
}

Darstellung:
- Timeline- oder Card-Layout
- Sortierung nach Datum (neueste zuerst)
- Zeige maximal die 5 neuesten News
- Jedes Item zeigt: Bild (falls vorhanden), Datum formatiert, Text
- Responsive Design: Stacked auf Mobile, 2 Spalten auf Tablet, 3 Spalten auf Desktop

### Design & Styling
- Nutze das bestehende Theme und die Farbpalette der Website
- Responsive Design für Mobile, Tablet und Desktop
- Smooth Scrolling zwischen den Sektionen
- Hover-Effekte auf Cards und Buttons
- Konsistente Abstände und Schriftgrößen wie auf anderen Seiten

### Performance & Best Practices
- Lazy Loading für Bilder
- Optimierte Images (Astro Image Component)
- Semantic HTML
- Accessibility (ARIA-Labels, Keyboard-Navigation für Tabs und Carousel)
- SEO-optimiert (Meta-Tags, Structured Data)

---

## Chat-Verlauf: Implementierung Startseite & News-Feature (23.12.2025)

### Zusammenfassung der Implementierung

#### Erstellte/Geänderte Dateien:

**Startseite:**
- `src/components/home/EntryLayout.astro` - Komplettes Rewrite mit 5 Sektionen
- `src/components/home/TabPostsList.tsx` - Neue React-Komponente für Tab-Navigation der Blog-Posts
- `src/components/home/FeatureCards.astro` - Neue Komponente für Themenfelder-Cards
- `src/components/home/HandmadeCarousel.tsx` - Modifiziert für Props-basierte Produktübergabe
- `src/components/home/NewsCarousel.tsx` - Neue Komponente für News-Carousel auf Startseite
- `src/components/home/NewsSection.tsx` - Original News-Komponente (später durch Carousel ersetzt)

**News-Feature:**
- `public/data/news.json` - Erweitert auf 19 News-Items (9x 2025, 10x 2024)
- `src/pages/news.astro` - Neue Seite mit Such- und Filterfunktionalität
- `src/components/news/Sidebar.astro` - Neue Sidebar-Komponente mit Jahr-Filter
- `src/components/base/Header.astro` - News-Menüpunkt hinzugefügt

#### Technische Herausforderungen & Lösungen:

1. **Vite Glob Imports für Bilder:**
   - Problem: React-Komponenten mit `client:idle` können keine `import.meta.glob` verwenden
   - Lösung: Bilder werden in Astro zur Build-Zeit aufgelöst und als Props an React übergeben

2. **Logo-Pfad:**
   - Problem: `Logo_Flat-White-2000.png` existierte nicht
   - Lösung: Korrekter Pfad `Logo_Flat-Black-2000.png`

3. **React ScrollArea mit client:only="react":**
   - Problem: Event-Listener fanden die Buttons nicht, weil React sie erst später rendert
   - Lösung: Event Delegation auf `document` mit `closest()` für Button-Erkennung

4. **Jahr-Filter funktionierte nicht:**
   - Problem: Funktionen waren im falschen Scope (innerhalb `initializeFilters`)
   - Lösung: Alle Funktionen auf Top-Level des Scripts verschieben

#### Features der News-Seite:
- ✅ Textsuche (Desktop + Mobile synchronisiert)
- ✅ Jahr-Filter (2024/2025 Buttons)
- ✅ Filter zurücksetzen
- ✅ Ergebnis-Zähler
- ✅ Responsive Sidebar (identisch zu Handmade-Seite)
- ✅ Mobile Filter-Bar mit ausklappbarem Jahr-Dropdown

#### UI-Verbesserungen:
- Titel in Glass-Boxen integriert statt darüber
- Hero-Bereich mit Glass-Background für bessere Lesbarkeit
- Konsistente Sidebar-Breite (`w-full` in ScrollArea)
