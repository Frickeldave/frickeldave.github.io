---
description:
  "Verwenden beim Schreiben von Tailwind-CSS-Klassen, Auswählen von Farben, Gradienten, Badges,
  Buttons oder jeglichem visuellem Styling. Erzwingt die pro Bereich definierten Farbpaletten
  (türkis/lila/grün/amber/...) aus dem Design-System."
applyTo: ["src/**/*.astro", "src/**/*.tsx", "src/**/*.css", "src/styles/**"]
---

# Tailwind & Design-System

Die vollständige Palette und die pro Bereich geltenden Regeln leben in
[`docs/20-arch-design-system.md`](../../docs/20-arch-design-system.md). **Konsultiere sie immer, bevor Du eine
neue Farbe einführst.** Diese Datei ist die Kurzfassung für die tägliche Arbeit.

## Farbsysteme pro Bereich (harte Regel)

Jeder Top-Level-Bereich hat **eine** Farbfamilie. Niemals mischen.

| Bereich           | Familie          | Primärer Gradient               |
| ----------------- | ---------------- | ------------------------------- |
| Home, Handmade    | Türkis/Teal      | `from-cyan-500 to-teal-500`     |
| Blog              | Lila/Violett     | `from-purple-500 to-violet-500` |
| Downloads         | Grün/Lime        | `from-green-500 to-lime-500`    |
| Portfolio         | Amber/Orange     | `from-amber-500 to-orange-500`  |
| News, About, Docs | siehe Design-Doc | — (nicht raten, nachschlagen)   |

Wende die Familie konsistent an auf: CTA-Buttons, Hover-States, Badges, Borders, Bullet-Points,
Timeline-Indikatoren und Sidebar-Icons. Die genauen Utility-Klassen findest Du in den Tabellen in
[`docs/20-arch-design-system.md`](../../docs/20-arch-design-system.md).

## Gemeinsame Invarianten (alle Bereiche)

- Abstände, Radius, Schatten, Typografie (Font-Familien, -Größen, Zeilenhöhen) kommen aus dem
  **Haupt-Design-System** — **nicht** pro Bereich überschreiben.
- Header und Footer sind auf allen Seiten identisch.
- Jede Seite beginnt mit einer **Glass-Box**-Komponente, die den Seitentitel und ein **Breadcrumb**
  enthält.

## Dark Mode

Stelle immer eine `dark:`-Variante für Farb-Utilities bereit, z. B.
`text-cyan-600 dark:text-cyan-400`.

## Klassen-Reihenfolge

Folge Tailwinds empfohlener Reihenfolge: Layout → Box-Modell → Typografie → Visuelles → State. Das
Prettier-Plugin (falls konfiguriert) erledigt das automatisch — kämpfe nicht dagegen an.

## Verboten

- ❌ Hartkodierte Hex-Farben (`#06b6d4`) in Komponenten — verwende Tailwind-Tokens.
- ❌ Bereichsfremde Farben (z. B. `purple-*` auf der Downloads-Seite).
- ❌ Inline-`style="..."`-Attribute für alles, was Tailwind ausdrücken kann.
- ❌ Eine neue Farbfamilie hinzufügen, ohne
  [`docs/20-arch-design-system.md`](../../docs/20-arch-design-system.md) zu aktualisieren.
