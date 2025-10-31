---
mode: 'agent'
description: 'Migrate WordPress article to Astro MDX format'
---

## Grundsätzliche Informationen

Migriere den Artikel von der URL ${input:url} in eine Astro-kompatible MDX-Datei mit Metadaten (Titel, Datum, Tags) und lokal eingebetteten Bildern. Der Artikel soll eine 4-stelligen Identifier aus Buchstaben und/oder Zahlen erhalten, der auch für die Bilder verwendet wird und aus dem Titel generiert wird (z.B. "DevOps Kultur, Organisation und Technologie" -> "DKOT"). Ich verwende nachfolgend DKOT als Beispiel.

Der Zielartikel soll unter src/content/blog liegen. Der Dateiname soll dem Schema YYYY-MM-DD-<slug>.mdx folgen, wobei das Datum aus dem Originalartikel übernommen wird und der Slug aus dem Titel generiert wird (Kleinbuchstaben, Bindestriche statt Leerzeichen, keine Sonderzeichen). 

Bilder werden lokal im Verzeichnis src/assets/blog/<category>/<dateiname>/ abgelegt, wobei <category> die Kategorien des Blogs ist (z.B. DevOps, IT, DIY, 3D Druck) und <dateiname> der generierte "YYYY-MM-DD-<slug>" Dateiname ist. Beachte aber, das Ordernamen klein geschrieben sein sollen. Die Bilder sollen nach dem Schema <identifier>-001.png, <identifier>-002.png usw. benannt werden. Nur das header image soll <identifier>-header.png heißen.

Da ich die Header Images alles neu generieren möchte, kopiere bitte das Bild src/assets/placeholder-header.png in den entsprechenden Ordner und benenne es in dkot-header.png um.


# Header / Frontmatter

```markdown

---
title: Titel wie in WordPress
description: Bitte generiere eine kurze Beschreibung des Artikels basierend auf dem Inhalt (maximal 150 Zeichen)
slug: generiere-einen-url-freundlichen-slug-aus-dem-titel
date: Hole das Datum aus dem Originalartikel und formatiere es als YYYY-MM-DD
image: "@assets/blog/<category>/<dateiname>/dkot-header.png" # Header-Bild für den Artikel
imageAlt: Header image für den Blog Artikel <Name des Artikels>
categories: Wähle aus folgenden einen aus: IT, DevOps, DIY, 3D Druck. Muss ein Array sein!
author: Frickeldave
tags: Wähle aus folgenden die passenden aus und hänge gerne noch weitere an:[DevOps, Team, Kultur, Motivation, Innovation, Leadership, New Work, Teamwork, Unternehmenskultur, Holzwerken, 3D Druck, DIY, Technologie, IT, Softwareentwicklung]
---

`````

Der Artikelinhalt in MDX Format folgt hier. Baue bitte folgende Imports ein:

Wenn Links verwendet werden 

```mdx 
import RedirectLink from "@components/common/RedirectLink.astro";
```

Wenn Bilder verwendet werden 

```mdx
import { Image } from "astro:assets";
import dkot001 from "@assets/blog/<category>/dkot-001.png";
```

# Bilder

Bitte füge auch die Bilder lokal ein, indem du sie in den Ordner src/assets/blog/<category>/<dateiname> kopierst und die Bildpfade im Artikel entsprechend anpasst. Durch einen Unfall in OneDrive, was die Quelle für den Wordpress Blog war, ist es möglich, dass einige Bilder nicht mehr korrekt verlinkt sind und du nur korrupte Daten erhälst. In diesem Fall trage bitte trotzdem die Bilder im MDX, lege sie aber nicht in src/assets/blog... ab, sondern kopiere die Datei src/assets/placeholder-blog-image.png für jedes korrupte Bild. Benenne die Bilder nach dem Schema <identifier>-001.png (z.B. dkot-001.png, dkot-002.png).

Um etwas Abwechslung reinzubringen, ordne die Bilder manchmal links vom Text, manchmal rechts vom Text an. Wenn es ein breites Bild ist, dann einfach mit Textfluss. Beispiel Bild links:

```mdx

<div className="my-6 flex flex-col items-start gap-6 lg:flex-row">
  <div className="lg:w-1/3">
    <Image src={dkot001} alt="Beschreibender Text" />
  </div>
  <div className="lg:w-2/3">
    Begleitender Text zum Bild...
  </div>
</div>
```

Beispiel Bild rechts:

```mdx

<div className="my-6 flex flex-col items-start gap-6 lg:flex-row">
  <div className="lg:w-2/3">
    Begleitender Text zum Bild...
  </div>
  <div className="lg:w-1/3">
    <Image src={dkot001} alt="Beschreibender Text" />
  </div>
</div>

```

# Links

Wenn links verwendet werden, ist wie folgt vorzugehen. Der Link soll mit dem RedirectLink Component eingebaut werden. Dafür ist dieser in der Datenbank unter public/data/link-mappings.json einzutragen, wenn dieser dort noch nicht existieren sollte. 


Beispiel affiliate Link (wenn ein Produkt verlinkt wird, insbesondere mit Amazon als Ziel):

    "rollei-lumis-key-light": {
      "targetUrl": "https://www.amazon.de/dp/B09BVLBX52",
      "description": "Produktbeschreibung",
      "affiliate": true,
      "category": "Videoequipment",
      "openInNewTab": true
    }

Beispiel normaler externer Link: 

    "obs": {
      "targetUrl": "https://obsproject.com/download",
      "description": "Open Broadcaster Software (OBS)...",
      "affiliate": false,
      "category": "Videoequipment",
      "openInNewTab": true
    }

Interne Links sollen nicht als RedirectLink eingebaut werden, sondern direkt im Markdown Format auf die entsprechende Seite verlinken. Beispiel interner Link. Da ich aber noch nicht weiß ob das Ziel wirklcih existiert, erstelle bitte eine TODO Kommentar bei jedem externen Linken, damit ich diese später überprüfen kann.


```mdx
{/* #TODO: Check internal link */}
[Testlink](https://frickeldave.github.io/test)
```


## Vollständiges Beispiel

```mdx
---
title: DevOps Kultur, Organisation und Technologie
description: Ein umfassender Blick auf die drei Säulen von DevOps und wie sie zusammenwirken
slug: devops-kultur-organisation-technologie
date: 2024-03-15
image: "@assets/blog/devops/dkot-header.png"
imageAlt: Header image für den Blog Artikel DevOps Kultur, Organisation und Technologie
categories: DevOps
author: Frickeldave
tags: [DevOps, Team, Kultur, Organisation, Technologie, Leadership]
---

import RedirectLink from "@components/common/RedirectLink.astro";
import { Image } from "astro:assets";
import dkot001 from "@assets/blog/devops/dkot-001.png";

# DevOps Kultur, Organisation und Technologie

<div className="my-6 flex flex-col items-start gap-6 lg:flex-row">
  <div className="lg:w-1/3">
    <Image src={dkot001} alt="DevOps Pyramide" />
  </div>
  <div className="lg:w-2/3">
    DevOps ist mehr als nur ein Buzzword - es ist eine Philosophie, die Kultur, Organisation und Technologie miteinander verbindet...
  </div>
</div>

Weitere Inhalte mit <RedirectLink id="example-link" text="externen Links" /> folgen hier.
```
