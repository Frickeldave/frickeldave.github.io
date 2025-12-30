---
agent: 'agent'
description: 'Add a combined portfolio and about-me page'
model: Claude Opus 4.5 (copilot)
---

## Design System - Orange/Amber Highlight

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

### Verbotene Farben
- ❌ `blue-500`, `blue-600`, `purple-500`, `purple-600` für Highlights
- ❌ Andere Primärfarben außer Orange/Amber für Akzente

---

## Inhaltliche Struktur

Erstelle eine kombinierte Portfolio- und Über-mich-Seite für eine persönliche Website. Die Seite sollte die folgenden Abschnitte enthalten:

1. **Einführung**: 

Links: 33% der Breite Name, Bild (nutze bitte src/assets/dave02.png)

Rechts: 66% Ein kurzer Abschnitt mit Begrüßung. Managing IT-Consultant; DevOps Evangelist; KI Enthusiast; DIY Maker; 3D Printing Fanatic; Woodworking Hobbyist

Eine Glass-Box darunter mit dem Zitat:
Frickeln: Sich an einer relativ kleinteiligen Sache, die man verbessern, um- oder ausbauen möchte, handwerklich oder technisch betätigen.”

Text darunter:

Ich bin Frickeldave – dein Experte für DIY-Projekte, handgemachte Kreationen und IT-Lösungen. Mit einer Leidenschaft für das Tüfteln und Verbessern bringe ich kreative Ideen und technische Expertise zusammen, um einzigartige Projekte zu realisieren. Ob Holzarbeiten, 3D-Druck oder komplexe DevOps-, KI und Cloud-Technologien – ich teile mein Wissen und meine Erfahrungen, um dich zu inspirieren und zu unterstützen.

Diese Erfahrung im handwerklichen Bereich überträgt sich auch auf meine IT-Projekte, bei denen Präzision, Kreativität und Problemlösungsfähigkeiten gefragt sind. Auf dieser Seite findest du eine Auswahl meiner Arbeiten sowie Einblicke in meine Fähigkeiten und Leidenschaften.

2. **Vernetze dich mit mir**: Eine Glass-Box mit der Überschrift "Vernetze dich mit mir" mit den Verlinkungen zu den wichtigsten Profilen und Kontaktmöglichkeiten.

- Instagram: [https://www.instagram.com/frickeldave/](https://www.instagram.com/frickeldave/)
- LinkedIn: [https://www.linkedin.com/in/frickeldave/](https://www.linkedin.com/in/frickeldave/)
- GitHub: [https://github.com/Frickeldave](https://github.com/Frickeldave)
- E-Mail: dave@frickeldave.de

3. **Portfolio Handmade**: Ein 4-Spalten-Grid mit Bildern und Beschreibungen von 4 zufälligen Handmade Projekten, die die Vielfalt der Fähigkeiten und Interessen zeigt. Es soll immer ein 3D Druck, ein Epoxidharz, ein Laser und ein Holzwerken Projekt enthalten sein. Jeder Eintrag soll zudem über einen Link auf den passenden Blog Artikel verweisen.

4. **Portfolio Veröffentlichungen**: Ein Karussell mit Bildern und Beschreibungen meiner Veröffentlichungen. Jeder Eintrag soll ein Bild und einen kurzen zusammenfassenden Text (maximal 2 Sätze) enthalten sowie einen Link zur jeweiligen Veröffentlichung sowie ein Link zu einem dazugehörigen Blog-Artikel. Die Blog Artikel existieren noch nicht, daher trage erstmal Platzhalter mit #TODO ein. 
Folgende Veröffentlichungen gibt es aktuell von mit: 

|Kategorie|Titel|Link|Bild|
|---|---|---|---|
|DIY| Testartikel über den Creality K2 Drucker| https://www.heise.de/select/make/2025/3/2512010252016731760| src\assets\placeholder-publications.png
|IT| Ist dein DevOps Qi im Einklang| https://www.informatik-aktuell.de/entwicklung/methoden/devops-ist-euer-qi-im-einklang.html| src\assets\placeholder-publications.png
|IT| Der definitige Guide in die ESP32 Welt| https://www.informatik-aktuell.de/entwicklung/methoden/der-definitive-guide-in-die-esp32-welt.html| src\assets\placeholder-publications.png
|IT| Symbiose von Handwerk und IT| https://www.informatik-aktuell.de/management-und-recht/digitalisierung/symbiose-von-informatik-und-handwerk.html| src\assets\placeholder-publications.png
|IT| Linting für NodeJS Projekte auf Basis von Astro| https://www.heise.de/hintergrund/Linting-Stack-fuer-Node-Projekte-Code-Qualitaet-Formatierung-und-Prosa-Linting-11110378.html| src\assets\placeholder-publications.png

5. **Podcast Host**:

Ein Abschnitt über meinen Podcast "DOAG Voices", inklusive Bild (src/assets/doag-voices.png), kurzer Beschreibung und Link zur Podcast-Seite. Alle Infos zu dem Podcast findest du unter der URL https://www.doag.org/de/home/news/doag-voices-ein-podcast-der-it-zum-klingen-bringt/. MAche aus dem Text eine kurze Zusammenfassung in 2-3 Sätzen.

Baue die Links als kleine Buttons ein:

Spotify: https://open.spotify.com/show/5U7lAyly41FMj6IM7OE4OB
Apple: https://podcasts.apple.com/de/podcast/doag-voices/id1847181531
Amazon: https://music.amazon.de/podcasts/5d145588-d877-467e-b3b2-bf3da6bf28cd/doag-voices
Deezer: https://www.deezer.com/de/show/1002294232
podcast.de: https://www.podcast.de/podcast/3651714/doag-voices
acast.de: https://shows.acast.com/doag-voices-arbeitstitel

6. **Technical Skills**: Wie auf der jetzigen Portfolio Seite src/content/portfolio/-index.md

7. **Berufserfahrung**: Wie auf der jetzigen Portfolio Seite src/content/portfolio/-index.md. Gleiche aber bitte ab mit meinem öffentlichen LinkedIn Profil unter https://www.linkedin.com/in/frickeldave/ ob dort alle Stationen korrekt und vollständig sind. 

8. **Featured projects**: Wie auf der jetzigen Portfolio Seite src/content/portfolio/-index.md