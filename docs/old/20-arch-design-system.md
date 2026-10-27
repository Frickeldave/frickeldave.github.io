# Design-System

Ziel ist ein einheitlich gestalteter Webauftritt ohne gestalterische Inkonsistenzen. Zusätzlich
sollen Home, Blog, Downloads, Portfolio, Handmade und News jeweils ein eigenes Teil-Design-System
erhalten, das auf dem zentralen Design-System der Website basiert.

Allgemeine Design-Vorgaben:
- Abstände, Margins, Schatten, abgerundete Ecken usw. bleiben wie im zentralen Design-System der Website.
- Schriftfamilien, Schriftgrößen, Zeilenhöhen usw. bleiben wie im zentralen Design-System der Website.
- Die Farbschemata der einzelnen Teil-Design-Systeme sollen sich klar unterscheiden und trotzdem zusammen harmonieren.

Header und Footer bleiben auf allen Seiten gleich.

Auf jeder Seite sollte eine Glass-Box-Komponente verwendet werden, um Inhalte hervorzuheben.

Auf jeder Seite sollte zuerst eine Glass-Box mit dem Seitentitel erscheinen. Zusätzlich sollte in
dieser Glass-Box eine Breadcrumb-Navigation integriert sein, die den Pfad zur aktuellen Seite zeigt
(z. B. `Home / Portfolio`).

## Design-System - Türkis - Startseite und Handmade-Seite

Die Startseite und die Handmade-Seite verwenden durchgängig ein **türkises** Farbschema für
Highlights und Akzente. Dieses Farbschema muss auch bei künftigen Änderungen erhalten bleiben.

### Farbpalette (Tailwind CSS)
- **Primärer Verlauf**: `from-cyan-500 to-teal-500` (Buttons, wichtige Akzente)
- **Hover-Verlauf**: `from-cyan-600 to-teal-600`
- **Text-Akzente**: `text-cyan-500`, `text-cyan-600`, `text-cyan-400` (dark)
- **Badge-Hintergrund**: `from-cyan-500/20 to-teal-500/20`
- **Badge-Text**: `text-cyan-700 dark:text-cyan-300`
- **Rahmen**: `border-cyan-500`, `border-cyan-500/30`, `border-teal-500/30`
- **Glow-Effekt (Profilbild)**: `from-cyan-500 via-teal -500 to-blue-500`

### Anwendung in Komponenten
| Element                              | Farbe                                                  |
| ------------------------------------ | ------------------------------------------------------ |
| CTA Buttons                          | `bg-gradient-to-r from-cyan-500 to-teal-500`           |
| Hover-Effekte                        | `hover:from-cyan-600 hover:to-teal-600`                |
| Badges/Tags                          | `from-cyan-500/20 to-teal-500/20` with `text-cyan-700` |
| Aufzählungspunkte                   | `text-cyan-500`                                        |
| Firmen/Links                         | `text-cyan-600 dark:text-cyan-400`                     |
| Linker Rahmen (Zitat/Bildung)        | `border-cyan-500`                                      |
| Social-Link-Icons                    | `text-cyan-500 group-hover:text-cyan-400`              |
| Timeline-Marker                      | `from-cyan-500 to-teal-500`                            |
| Sidebar-Icons (Suche, Filter usw.)   | `text-cyan-500`                                        |

### Nicht erlaubte Farben
- ❌ `orange-500`, `orange-600`, `red-500`, `red-600` für Highlights
- ❌ Keine anderen Primärfarben ausser Türkis für Akzente

## Design-System - Lila - Blog-Seite
Die Blog-Seite verwendet durchgängig ein **lila/violettes** Farbschema für Highlights und
Akzente. Dieses Farbschema muss auch bei künftigen Änderungen erhalten bleiben.

### Farbpalette (Tailwind CSS)
- **Primärer Verlauf**: `from-purple-500 to-violet-500` (Buttons, wichtige Akzente)
- **Hover-Verlauf**: `from-purple-600 to-violet-600`
- **Text-Akzente**: `text-purple-500`, `text-purple-600`, `text-purple-400` (dark)
- **Badge-Hintergrund**: `from-purple-500/20 to-violet-500/20`
- **Badge-Text**: `text-purple-700 dark:text-purple-300`
- **Rahmen**: `border-purple-500`, `border-purple-500/30`, `border-violet-500/30`
- **Glow-Effekt (Profilbild)**: `from-purple-500 via-violet-500 to-pink-500`

### Anwendung in Komponenten
| Element                              | Farbe                                                        |
| ------------------------------------ | ------------------------------------------------------------ |
| CTA Buttons                          | `bg-gradient-to-r from-purple-500 to-violet-500`             |
| Hover-Effekte                        | `hover:from-purple-600 hover:to-violet-600`                  |
| Badges/Tags                          | `from-purple-500/20 to-violet-500/20` with `text-purple-700` |
| Aufzählungspunkte                   | `text-purple-500`                                            |
| Firmen/Links                         | `text-purple-600 dark:text-purple-400`                       |
| Linker Rahmen (Zitat/Bildung)        | `border-purple-500`                                          |
| Social-Link-Icons                    | `text-purple-500 group-hover:text-purple-400`                |
| Timeline-Marker                      | `from-purple-500 to-violet-500`                              |
| Sidebar-Icons (Suche, Filter usw.)   | `text-purple-500`                                            |

### Nicht erlaubte Farben
- ❌ `green-500`, `green-600`, `yellow-500`, `yellow-600` für Highlights
- ❌ Keine anderen Primärfarben ausser Lila/Violett für Akzente

## Design-System - Grün - Download-Seite
Die Download-Seite verwendet durchgängig ein **grünes** Farbschema für Highlights und Akzente.
Dieses Farbschema muss auch bei künftigen Änderungen erhalten bleiben.
### Farbpalette (Tailwind CSS)
- **Primärer Verlauf**: `from-green-500 to-lime-500` (Buttons, wichtige Akzente)
- **Hover-Verlauf**: `from-green-600 to-lime-600`
- **Text-Akzente**: `text-green-500`, `text-green-600`, `text-green-400` (dark)
- **Badge-Hintergrund**: `from-green-500/20 to-lime-500/20`
- **Badge-Text**: `text-green-700 dark:text-green-300`
- **Rahmen**: `border-green-500`, `border-green-500/30`, `border-lime-500/30`
- **Glow-Effekt (Profilbild)**: `from-green-500 via-lime-500 to-yellow-500`

### Anwendung in Komponenten
| Element                              | Farbe                                                    |
| ------------------------------------ | -------------------------------------------------------- |
| CTA Buttons                          | `bg-gradient-to-r from-green-500 to-lime-500`            |
| Hover-Effekte                        | `hover:from-green-600 hover:to-lime-600`                 |
| Badges/Tags                          | `from-green-500/20 to-lime-500/20` with `text-green-700` |
| Aufzählungspunkte                   | `text-green-500`                                         |
| Firmen/Links                         | `text-green-600 dark:text-green-400`                     |
| Linker Rahmen (Zitat/Bildung)        | `border-green-500`                                       |
| Social-Link-Icons                    | `text-green-500 group-hover:text-green-400`              |
| Timeline-Marker                      | `from-green-500 to-lime-500`                             |
| Sidebar-Icons (Suche, Filter usw.)   | `text-green-500`                                         |

### Nicht erlaubte Farben
- ❌ `purple-500`, `purple-600`, `pink-500`, `pink-600` für Highlights
- ❌ Keine anderen Primärfarben ausser Grün für Akzente

## Design-System - Orange/Bernstein - Portfolio-Seite

Die Portfolio-Seite verwendet durchgängig ein **orange-/bernsteinfarbenes** Farbschema für
Highlights und Akzente. Dieses Farbschema muss auch bei künftigen Änderungen erhalten bleiben.

### Farbpalette (Tailwind CSS)
- **Primärer Verlauf**: `from-amber-500 to-orange-500` (Buttons, wichtige Akzente)
- **Hover-Verlauf**: `from-amber-600 to-orange-600`
- **Text-Akzente**: `text-amber-500`, `text-amber-600`, `text-amber-400` (dark)
- **Badge-Hintergrund**: `from-amber-500/20 to-orange-500/20`
- **Badge-Text**: `text-amber-700 dark:text-amber-300`
- **Rahmen**: `border-amber-500`, `border-amber-500/30`, `border-orange-500/30`
- **Glow-Effekt (Profilbild)**: `from-amber-500 via-orange-500 to-red-500`

### Anwendung in Komponenten
| Element                              | Farbe                                                      |
| ------------------------------------ | ---------------------------------------------------------- |
| CTA Buttons                          | `bg-gradient-to-r from-amber-500 to-orange-500`            |
| Hover-Effekte                        | `hover:from-amber-600 hover:to-orange-600`                 |
| Badges/Tags                          | `from-amber-500/20 to-orange-500/20` with `text-amber-700` |
| Aufzählungspunkte                   | `text-amber-500`                                           |
| Firmen/Links                         | `text-amber-600 dark:text-amber-400`                       |
| Linker Rahmen (Zitat/Bildung)        | `border-amber-500`                                         |
| Social-Link-Icons                    | `text-amber-500 group-hover:text-amber-400`                |
| Timeline-Marker                      | `from-amber-500 to-orange-500`                             |
| Sidebar-Icons (Suche, Filter usw.)   | `text-amber-500`                                           |

### Nicht erlaubte Farben
- ❌ `blue-500`, `blue-600`, `purple-500`, `purple-600` für Highlights
- ❌ Keine anderen Primärfarben ausser Orange/Bernstein für Akzente

## Design-System - Rot - News-Seite
Die News-Seite verwendet durchgängig ein **rotes** Farbschema für Highlights und Akzente. Dieses
Farbschema muss auch bei künftigen Änderungen erhalten bleiben.

### Farbpalette (Tailwind CSS)
- **Primärer Verlauf**: `from-red-500 to-pink-500` (Buttons, wichtige Akzente)
- **Hover-Verlauf**: `from-red-600 to-pink-600`
- **Text-Akzente**: `text-red-500`, `text-red-600`, `text-red-400` (dark)
- **Badge-Hintergrund**: `from-red-500/20 to-pink-500/20`
- **Badge-Text**: `text-red-700 dark:text-red-300`
- **Rahmen**: `border-red-500`, `border-red-500/30`, `border-pink-500/30`
- **Glow-Effekt (Profilbild)**: `from-red-500 via-pink-500 to-purple-500`

### Anwendung in Komponenten
| Element                              | Farbe                                                |
| ------------------------------------ | ---------------------------------------------------- |
| CTA Buttons                          | `bg-gradient-to-r from-red-500 to-pink-500`          |
| Hover-Effekte                        | `hover:from-red-600 hover:to-pink-600`               |
| Badges/Tags                          | `from-red-500/20 to-pink-500/20` with `text-red-700` |
| Aufzählungspunkte                   | `text-red-500`                                       |
| Firmen/Links                         | `text-red-600 dark:text-red-400`                     |
| Linker Rahmen (Zitat/Bildung)        | `border-red-500`                                     |
| Social-Link-Icons                    | `text-red-500 group-hover:text-red-400`              |
| Timeline-Marker                      | `from-red-500 to-pink-500`                           |
| Sidebar-Icons (Suche, Filter usw.)   | `text-red-500`                                       |

### Nicht erlaubte Farben
- ❌ `cyan-500`, `cyan-600`, `green-500`, `green-600` für Highlights
- ❌ Keine anderen Primärfarben ausser Rot für Akzente

## Richtlinien für Button-Design (für alle Seiten)

Alle Buttons auf der Website folgen einem einheitlichen Gestaltungsmuster, das je nach
Seitenkategorie mit dem passenden Farbschema kombiniert wird.

### Klickbare Buttons (Call-to-Actions)
Buttons, die eine Aktion auslösen, etwa Navigation, Formularversand oder externe Links,
verwenden **gefüllte Farbverläufe**:

**Eigenschaften:**
- **Hintergrund**: Gefüllter Verlauf in der jeweiligen Seitenfarbe (z. B. `bg-gradient-to-r from-cyan-500 to-teal-500` für Home/Handmade)
- **Text und Icons**: Immer weiss (`text-white`)
- **Hover-Effekt**: Dunklerer Verlauf (`hover:from-cyan-600 hover:to-teal-600`)
- **Hover-Animation**: Leichte Vergrößerung (`hover:scale-105`)
- **Transition**: `transition-all duration-300` für weiche Übergänge
- **Schatten**: Optional `hover:shadow-lg` für mehr Tiefe

**Beispiele nach Seitenkategorie:**
```html
<!-- Home/Handmade (Turquoise) -->
<button class="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white font-medium transition-all duration-300 hover:scale-105">
  Button-Beschriftung
</button>

<!-- Blog (Purple) -->
<button class="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-violet-500 hover:from-purple-600 hover:to-violet-600 text-white font-medium transition-all duration-300 hover:scale-105">
  Button-Beschriftung
</button>

<!-- Downloads (Green) -->
<button class="px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-lime-500 hover:from-green-600 hover:to-lime-600 text-white font-medium transition-all duration-300 hover:scale-105">
  Button-Beschriftung
</button>

<!-- Portfolio (Amber/Orange) -->
<button class="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium transition-all duration-300 hover:scale-105">
  Button-Beschriftung
</button>

<!-- News (Red) -->
<button class="px-4 py-2 rounded-lg bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-medium transition-all duration-300 hover:scale-105">
  Button-Beschriftung
</button>
```

### Nicht klickbare Elemente und Filter-Buttons
Elemente mit rein informativem Charakter oder für Filterfunktionen, etwa Tags, Skills oder
Kategorien, verwenden **Glass-Design**:

**Eigenschaften:**
- **Hintergrund**: Glass-Morphism (`glass-t` oder `glass`)
- **Text**: Standard-Textfarbe (`text-txt-p dark:text-darkmode-txt-p`)
- **Icons**: Farb-Akzent der jeweiligen Seite (z. B. `text-cyan-500` für Handmade)
- **Hover-Effekt**: Leicht aufgehellter Hintergrund (`hover:bg-white/20`)
- **KEIN Scaling**: Filter-Buttons skalieren nicht bei Hover
- **Rahmen**: Subtiler Rahmen in der Seitenfarbe (`border-cyan-500/20`)

**Beispiele:**
```html
<!-- Filter Button (Handmade) -->
<button class="glass px-3 py-2 rounded-lg hover:bg-white/20 border border-cyan-500/20 hover:border-cyan-500/40 transition-all">
  Kategorie
</button>

<!-- Tag/Skill (nicht klickbar) -->
<span class="glass-t px-3 py-1 rounded-full text-sm text-txt-p dark:text-darkmode-txt-p cursor-default">
  JavaScript
</span>

<!-- Social Link (Portfolio - Glass Style) -->
<a href="#" class="glass-t px-5 py-3 rounded-xl hover:bg-white/20 hover:shadow-lg transition-all duration-300">
  <IconComponent className="text-xl text-amber-500" />
  <span>LinkedIn</span>
</a>
```

### Komponente `Button.astro`
Die zentrale Komponente `Button.astro` unterstützt beide Varianten:

**Props:**
- `label: string` - Button-Text
- `link: string` - URL/Href
- `colorScheme: "cyan" | "purple" | "green" | "amber" | "red"` - Farbschema der Seite
- `glass: boolean` - `true` für Glass-Design, `false` für gefüllte Buttons (Standard: `false`)
- `newtab: boolean` - Öffnet den Link in einem neuen Tab

**Verwendung:**
```astro
<!-- Filled CTA Button -->
<Button label="Jetzt entdecken" link="/portfolio" colorScheme="amber" />

<!-- Glass-Design für nicht-primäre Links -->
<Button label="Mehr erfahren" link="/about" colorScheme="cyan" glass={true} />
```

### Wichtige Regeln
1. ✅ **Klickbare CTAs**: Immer gefüllt, mit weissem Text und `hover:scale-105`
2. ✅ **Informative Elemente**: Immer im Glass-Design und ohne Skalierung
3. ✅ **Farbkonsistenz**: Jede Seite verwendet ihr eigenes Farbschema für alle Buttons
4. ❌ **Nicht mischen**: Beide Stile nicht auf derselben Hierarchieebene vermischen
5. ❌ **Keine farbigen Icons in gefüllten Buttons**: Icons in gefüllten Buttons sind immer weiss
