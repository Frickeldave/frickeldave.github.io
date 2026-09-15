/**
 * Formatting of euro amounts.
 *
 * Lives on its own so the catalog cards, the product detail page and the cart
 * all render prices identically ("35,00 €"). The site is German, so a plain
 * `toFixed(2)` is not good enough — it produces "35.00 €".
 */

/** Format a euro amount for the German locale. */
export const formatPrice = (value: number): string =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
