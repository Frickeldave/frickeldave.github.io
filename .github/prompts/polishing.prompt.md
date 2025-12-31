---
agent: 'agent'
description: 'Add a combined portfolio and about-me page'
model: Claude Sonnet 4.5 (copilot)
---

Ziel ist es, die Website nun einheitlich zu gestalten und alle ungereimtheiten im Design zu beseitigen. Außerdem habe ich die Idee, dass Home, Blogs, Downloads, Portfolio, Handmade und News jeweils Ihr eigenes Design System bekommen, welches aber auf dem Hauptdesignsystem der Seite basiert.

Allgemeine Design Vorgaben:
- Abstände, Ränder, Schatten, abgerundete Ecken etc. bleiben wie im Hauptdesignsystem der Seite
- Schriftarten, Schriftgrößen, Zeilenhöhen etc. bleiben wie im Hauptdesignsystem der Seite
- Die Farbschemata der einzelnen Design Systeme müssen sich gut voneinander abheben, aber trotzdem harmonisch zusammenpassen

Headers und Footers bleiben bei allen Seiten gleich.

Auf jeder Seite ist eine Glass-Box Komponente zu verwenden, um Inhalte hervorzuheben.

Auf jeder Seite ist als erstes eine Glass-Box mit der Überschrift der Seite zu verwenden. Weiterhin ist in der Glas-Box eine Breadcrump Navigation zu integrieren, die den Pfad zur aktuellen Seite anzeigt (z.B. Home / Portfolio).

## Design System - Türkis - Home Page und Handmade Page

Die Home-Seite und die Handmade-Seite verwendet ein konsistentes **Türkis**-Farbschema für alle Highlights und Akzente. Dieses Farbschema muss bei allen zukünftigen Änderungen beibehalten werden.

### Farbpalette (Tailwind CSS)
- **Primär-Gradient**: `from-cyan-500 to-teal-500` (Buttons, wichtige Akzente)
- **Hover-Gradient**: `from-cyan-600 to-teal-600`
- **Text-Akzente**: `text-cyan-500`, `text-cyan-600`, `text-cyan-400` (dark)
- **Badge-Hintergrund**: `from-cyan-500/20 to-teal-500/20`
- **Badge-Text**: `text-cyan-700 dark:text-cyan-300`
- **Borders**: `border-cyan-500`, `border-cyan-500/30`, `border-teal-500/30`
- **Glow-Effekt (Profilbild)**: `from-cyan-500 via-teal -500 to-blue-500`

### Anwendung in Components
| Element | Farbgebung |
|---------|------------|
| CTA-Buttons | `bg-gradient-to-r from-cyan-500 to-teal-500` |
| Hover-Effekte | `hover:from-cyan-600 hover:to-teal-600` |
| Badges/Tags | `from-cyan-500/20 to-teal-500/20` mit `text-cyan-700` |
| Bullet Points | `text-cyan-500` |
| Firmen/Links | `text-cyan-600 dark:text-cyan-400` |
| Border-Left (Zitat/Education) | `border-cyan-500` |
| Social Link Icons | `text-cyan-500 group-hover:text-cyan-400` |
| Timeline-Indikatoren | `from-cyan-500 to-teal-500` |
| Sidebar Icons (Suche, Filter, etc.) | `text-cyan-500` |

### Verbotene Farben
- ❌ `orange-500`, `orange-600`, `red-500`, `red-600` für Highlights
- ❌ Andere Primärfarben außer Türkis für Akzente

## Design System - Purple - Blog Page
Die Blog-Seite verwendet ein konsistentes **Lila/Purple**-Farbschema für alle Highlights und Akzente. Dieses Farbschema muss bei allen zukünftigen Änderungen beibehalten werden.

### Farbpalette (Tailwind CSS)
- **Primär-Gradient**: `from-purple-500 to-violet-500` (Buttons, wichtige Akzente)
- **Hover-Gradient**: `from-purple-600 to-violet-600`
- **Text-Akzente**: `text-purple-500`, `text-purple-600`, `text-purple-400` (dark)
- **Badge-Hintergrund**: `from-purple-500/20 to-violet-500/20`
- **Badge-Text**: `text-purple-700 dark:text-purple-300`
- **Borders**: `border-purple-500`, `border-purple-500/30`, `border-violet-500/30`
- **Glow-Effekt (Profilbild)**: `from-purple-500 via-violet-500 to-pink-500`

### Anwendung in Components
| Element | Farbgebung |
|---------|------------|
| CTA-Buttons | `bg-gradient-to-r from-purple-500 to-violet-500` |
| Hover-Effekte | `hover:from-purple-600 hover:to-violet-600` |
| Badges/Tags | `from-purple-500/20 to-violet-500/20` mit `text-purple-700` |
| Bullet Points | `text-purple-500` |
| Firmen/Links | `text-purple-600 dark:text-purple-400` |
| Border-Left (Zitat/Education) | `border-purple-500` |
| Social Link Icons | `text-purple-500 group-hover:text-purple-400` |
| Timeline-Indikatoren | `from-purple-500 to-violet-500` |
| Sidebar Icons (Suche, Filter, etc.) | `text-purple-500` |

### Verbotene Farben
- ❌ `green-500`, `green-600`, `yellow-500`, `yellow-600` für Highlights
- ❌ Andere Primärfarben außer Lila/Purple für Akzente

## Design System - Green Highlight - Download Page
Die Download-Seite verwendet ein konsistentes **Grün**-Farbschema für alle Highlights und Akzente. Dieses Farbschema muss bei allen zukünftigen Änderungen beibehalten werden.
### Farbpalette (Tailwind CSS)
- **Primär-Gradient**: `from-green-500 to-lime-500` (Buttons, wichtige Akzente)
- **Hover-Gradient**: `from-green-600 to-lime-600`
- **Text-Akzente**: `text-green-500`, `text-green-600`, `text-green-400` (dark)
- **Badge-Hintergrund**: `from-green-500/20 to-lime-500/20`
- **Badge-Text**: `text-green-700 dark:text-green-300`
- **Borders**: `border-green-500`, `border-green-500/30`, `border-lime-500/30`
- **Glow-Effekt (Profilbild)**: `from-green-500 via-lime-500 to-yellow-500`

### Anwendung in Components
| Element | Farbgebung |
|---------|------------|
| CTA-Buttons | `bg-gradient-to-r from-green-500 to-lime-500` |
| Hover-Effekte | `hover:from-green-600 hover:to-lime-600` |
| Badges/Tags | `from-green-500/20 to-lime-500/20` mit `text-green-700` |
| Bullet Points | `text-green-500` |
| Firmen/Links | `text-green-600 dark:text-green-400` |
| Border-Left (Zitat/Education) | `border-green-500` |
| Social Link Icons | `text-green-500 group-hover:text-green-400` |
| Timeline-Indikatoren | `from-green-500 to-lime-500` |
| Sidebar Icons (Suche, Filter, etc.) | `text-green-500` |

### Verbotene Farben
- ❌ `purple-500`, `purple-600`, `pink-500`, `pink-600` für Highlights
- ❌ Andere Primärfarben außer Grün für Akzente

## Design System - Orange/Amber Highlight - Portfolio Page

Die Portfolio-Seite verwendet ein konsistentes **Orange/Amber**-Farbschema für alle Highlights und Akzente. Dieses Farbschema muss bei allen zukünftigen Änderungen beibehalten werden.

### Farbpalette (Tailwind CSS)
- **Primär-Gradient**: `from-amber-500 to-orange-500` (Buttons, wichtige Akzente)
- **Hover-Gradient**: `from-amber-600 to-orange-600`
- **Text-Akzente**: `text-amber-500`, `text-amber-600`, `text-amber-400` (dark)
- **Badge-Hintergrund**: `from-amber-500/20 to-orange-500/20`
- **Badge-Text**: `text-amber-700 dark:text-amber-300`
- **Borders**: `border-amber-500`, `border-amber-500/30`, `border-orange-500/30`
- **Glow-Effekt (Profilbild)**: `from-amber-500 via-orange-500 to-red-500`

### Anwendung in Components
| Element | Farbgebung |
|---------|------------|
| CTA-Buttons | `bg-gradient-to-r from-amber-500 to-orange-500` |
| Hover-Effekte | `hover:from-amber-600 hover:to-orange-600` |
| Badges/Tags | `from-amber-500/20 to-orange-500/20` mit `text-amber-700` |
| Bullet Points | `text-amber-500` |
| Firmen/Links | `text-amber-600 dark:text-amber-400` |
| Border-Left (Zitat/Education) | `border-amber-500` |
| Social Link Icons | `text-amber-500 group-hover:text-amber-400` |
| Timeline-Indikatoren | `from-amber-500 to-orange-500` |
| Sidebar Icons (Suche, Filter, etc.) | `text-amber-500` |

### Verbotene Farben
- ❌ `blue-500`, `blue-600`, `purple-500`, `purple-600` für Highlights
- ❌ Andere Primärfarben außer Orange/Amber für Akzente

## Design System - Red - News Page
Die News-Seite verwendet ein konsistentes **Rot**-Farbschema für alle Highlights und Akzente. Dieses Farbschema muss bei allen zukünftigen Änderungen beibehalten werden.

### Farbpalette (Tailwind CSS)
- **Primär-Gradient**: `from-red-500 to-pink-500` (Buttons, wichtige Akzente)
- **Hover-Gradient**: `from-red-600 to-pink-600`
- **Text-Akzente**: `text-red-500`, `text-red-600`, `text-red-400` (dark)
- **Badge-Hintergrund**: `from-red-500/20 to-pink-500/20`
- **Badge-Text**: `text-red-700 dark:text-red-300`
- **Borders**: `border-red-500`, `border-red-500/30`, `border-pink-500/30`
- **Glow-Effekt (Profilbild)**: `from-red-500 via-pink-500 to-purple-500`

### Anwendung in Components
| Element | Farbgebung |
|---------|------------|
| CTA-Buttons | `bg-gradient-to-r from-red-500 to-pink-500` |
| Hover-Effekte | `hover:from-red-600 hover:to-pink-600` |
| Badges/Tags | `from-red-500/20 to-pink-500/20` mit `text-red-700` |
| Bullet Points | `text-red-500` |
| Firmen/Links | `text-red-600 dark:text-red-400` |
| Border-Left (Zitat/Education) | `border-red-500` |
| Social Link Icons | `text-red-500 group-hover:text-red-400` |
| Timeline-Indikatoren | `from-red-500 to-pink-500` |
| Sidebar Icons (Suche, Filter, etc.) | `text-red-500` |

### Verbotene Farben
- ❌ `cyan-500`, `cyan-600`, `green-500`, `green-600` für Highlights
- ❌ Andere Primärfarben außer Rot für Akzente