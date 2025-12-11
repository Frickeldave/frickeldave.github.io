Als Familie erstellen wir verschiedene Objekte aus Holz, Epoxidharz und 3D-Druck. Die Holzgegenstände sind entweder manuell gefertigt oder gelasert. Daraus ergeben sich 4 Kategorien, die im folgenden als <category> bezeichnet sind. Bitte erstelle mir eine Handmade Seite die auch in der Hauptnavigation auftaucht. In dieser soll in die 4 Kategorieren "3D Druck", "Holz", "Laser" und Epoxidharz unterschieden werden. Zusätzliche soll jeder Eintrag mit einem Tag versehen werden können, damit auch Themen wie "Weihnachten", "Ostern", "Geschenke", u.ä. zugeordnet werden können. Folgend sind alle Eigenschaften gelistet, die jedes Objekt haben soll: 
- Name oder Title
- Description
- Picture (Link)
- Category
- Tags
- Price
- Size (optional)

Der Katalog der Objekte soll in public/data/handmade.json gepflegt werden. Eigenschaften in der JSON sind immer englisch, auf der Website aber Deutsch. Die Bilder sollen in srv/assets/handmade/<category> liegen. Die Bilder sollen über den normalen Import in die Seite integriert werden können, damit die Bildfeatures von Astro verwendet werden können. 
Der User soll die Möglichkeit haben, sowohl nach Kategorie als auch Tag filtern zu können. Außerdem soll er die Möglichkeit haben, nach Preis auf- und Absteigend zu sortieren (ohne den Filter zu verwerfen) und eine Freitextsuche auf der Seite haben.

Füge 8 Beispiel Artikel ein, die sich über die Kategorien und Taks verteilen. Nutze als Bild "src/assets/placeholder-product.png", was du für jedes Produkt einmal in das richtige Verzeichnis kopierst und entsprechend umbenennst.