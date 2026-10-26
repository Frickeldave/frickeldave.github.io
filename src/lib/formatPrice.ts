/**
 * Formatierung von Euro-Beträgen.
 *
 * Steht bewusst separat, damit Katalogkarten, Produktdetailseite und Warenkorb
 * alle Preise identisch rendern ("35,00 €"). Die Seite ist deutsch, deshalb
 * reicht ein blankes `toFixed(2)` nicht — es erzeugt "35.00 €".
 */

/** Formatiert einen Euro-Betrag für das deutsche Locale. */
export const formatPrice = (value: number): string =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
