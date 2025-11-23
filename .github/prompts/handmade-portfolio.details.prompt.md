Okay, lass uns das nächste Feature angehen. Wenn ich auf eines der Produkte klicke, soll eine Produkt-Detailseite aufgehen. Hierbei sollen folgende Anforderungen erfüllt werden: 

- jedes Produkt soll über eine Unique URL erreicht werden können. Diese URL soll heißen: <server>/handmade/<articleNumber> lauten, wobei <articleNumber> die Artikelnummer des Produktes ist. Z.B. für ein Produkt mit der Artikelnummer 12345 wäre die URL also <server>/handmade/12345
- Ich will nicht pro Produkt eine Seite manuell anlegen müssen, die muss dynamisch generiert werden
- Der Aufbau der Seite typisch für eine Produktseite sein. Im Detail wie folgt: 
- Links eine Gallery mit Bildern des Produktes. Die Bilder der gallery sind untereinander angeordnet.
- Rechts neben der Gallery soll das Bild angezeigt werden, auf das in der Gallery geklickt wurde. Standardmäßig ist das erste Bild der Gallery ausgewählt und wird angezeigt. 
- Die Bilder sind unter src/assets/handmade/<articleNumber>/ abgelegt. Z.B. für das Produkt mit der Artikelnummer 12345 wären die Bilder unter src/assets/handmade/12345/ zu finden. Die Bilder haben den Dateinamen <articleNumber>-000.png, <articleNumber>-001.png, etc.
- Rechts neben dem Bild soll der Produktname, die Artikelnummer, der Preis und die Beschreibung des Produktes angezeigt werden.
- Unterhalb der Beschreibung soll eine Details-Sektion angezeigt werden, die eine Liste von Key-Value Paaren anzeigt. Dies umfasst die Kategorie, die Tags und die Information ob das Produkt Customizable ist.