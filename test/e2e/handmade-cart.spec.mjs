import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

/**
 * End-to-End-Abdeckung für den clientseitigen Handmade-Warenkorb.
 *
 * Übt die echte gebaute Seite: Hinzufügen aus dem Produktraster, den Zähler im
 * Header, die View-Transition-Navigation zur Warenkorbseite, Mengenänderungen und
 * den erzeugten `mailto:`-Link. Der Link wird über sein `href` geprüft, damit der
 * Test nie wirklich an einen Mail-Client übergeben muss.
 */

const catalog = JSON.parse(
  readFileSync(
    new URL("../../public/data/handmade.json", import.meta.url),
    "utf8"
  )
);

const CART_STORAGE_KEY = "frickeldave:handmade-cart";

// Der Header trägt die seitenweite Warenkorb-Verknüpfung mit Zähler. Die
// Produktdetailseite rendert ihren eigenen „Zum Warenkorb“-Einstieg; die
// Handmade-Sidebar hat bewusst keinen.
const HEADER_CART = "header [data-cart-hide-when-empty]";
const HEADER_BADGE = "header [data-cart-count]";
const DETAIL_CART = "[data-cart-nav-link]";
const DETAIL_BADGE = "[data-cart-nav-link] [data-cart-count]";

/** Dieselbe Formatierung wie auf der Warenkorbseite, damit die Erwartungen synchron bleiben. */
const formatPrice = (value) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(
    value
  );

/** Der Warenkorb formatiert Preise mit geschütztem Leerzeichen; verglichen wird über normale Leerzeichen. */
const normalize = (value) => value.replace(/\u00a0/g, " ");

const findProduct = (articleNumber) =>
  catalog.products.find((product) => product.articleNumber === articleNumber);

/** Dekodiert den Body eines vom Warenkorb gebauten `mailto:`-Links. */
const mailBodyOf = (href) => {
  const body = href.split("&body=")[1];
  return body ? decodeURIComponent(body) : "";
};

test.describe("handmade cart", () => {
  test("shows the empty state without any items", async ({ page }) => {
    await page.goto("/handmade/warenkorb");

    await expect(page.locator("[data-cart-empty]")).toBeVisible();
    await expect(page.locator("[data-cart-list]")).toBeHidden();
    await expect(page.locator("[data-cart-summary]")).toBeHidden();
    // Die Header-Verknüpfung erscheint erst, wenn der Warenkorb etwas enthält.
    await expect(page.locator(HEADER_CART)).toBeHidden();
  });

  test("adds from the grid, updates quantity and builds the mail link", async ({
    page,
  }) => {
    await page.goto("/handmade/shop");

    const addButton = page.locator("[data-add-to-cart]").first();
    const articleNumber = await addButton.getAttribute("data-article-number");
    const productName = await addButton.getAttribute("data-product-name");
    const product = findProduct(articleNumber);
    expect(
      product,
      `product ${articleNumber} must exist in the catalog`
    ).toBeTruthy();

    await addButton.click();

    // Die Header-Verknüpfung erscheint zum ersten Mal und zeigt den Zähler.
    await expect(page.locator(HEADER_CART)).toBeVisible();
    await expect(page.locator(HEADER_BADGE)).toHaveText("1");

    // Nur Artikelnummer und Menge werden gespeichert — nie der Preis.
    const stored = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      CART_STORAGE_KEY
    );
    expect(JSON.parse(stored)).toEqual([{ articleNumber, quantity: 1 }]);

    // Über die Header-Verknüpfung navigieren, damit auch der View-Transition-Pfad
    // abgedeckt ist.
    await page.locator(HEADER_CART).click();
    await expect(page).toHaveURL(/\/handmade\/warenkorb\/?$/);

    // Die Header-Verknüpfung übersteht die clientseitige Navigation.
    await expect(page.locator(HEADER_CART)).toBeVisible();

    const line = page.locator("[data-cart-line]");
    await expect(line).toHaveCount(1);
    await expect(line.first()).toHaveAttribute("data-cart-line", articleNumber);

    const quantity = page.locator("[data-cart-quantity]").first();
    await expect(quantity).toHaveValue("1");
    await expect(page.locator("[data-cart-total]")).toHaveText(
      formatPrice(product.price)
    );

    // Menge erhöhen und prüfen, dass Zeile und Summe folgen.
    await page.locator("[data-cart-increase]").first().click();
    await expect(quantity).toHaveValue("2");
    await expect(page.locator("[data-cart-total]")).toHaveText(
      formatPrice(product.price * 2)
    );

    const mailto = page.locator("[data-cart-send]");
    const href = await mailto.getAttribute("href");
    expect(href.startsWith("mailto:handmade@frickeldave.de?")).toBe(true);

    const body = normalize(mailBodyOf(href));
    expect(body).toContain(`2 × ${productName} (${articleNumber})`);
    expect(body).toContain(
      `Gesamtsumme: ${normalize(formatPrice(product.price * 2))}`
    );

    // Kontaktdaten fließen beim Tippen in den Link ein.
    await page.locator('[data-cart-field="name"]').fill("Testkunde");
    const hrefWithName = await mailto.getAttribute("href");
    expect(normalize(mailBodyOf(hrefWithName))).toContain("Name: Testkunde");

    // Das Entfernen der letzten Position fällt auf den leeren Zustand zurück.
    page.on("dialog", (dialog) => dialog.accept());
    await page.locator("[data-cart-clear]").click();
    await expect(page.locator("[data-cart-empty]")).toBeVisible();
    await expect(page.locator(HEADER_CART)).toBeHidden();
  });

  test("adds from the product detail page", async ({ page }) => {
    const product = catalog.products.find((entry) => entry.visible);

    await page.goto(`/handmade/${product.articleNumber}`);
    await page.locator("[data-add-to-cart]").first().click();

    // Die Detailseite behält ihren eigenen Einstieg neben dem Add-to-Cart-Button.
    await expect(page.locator(DETAIL_BADGE)).toHaveText("1");
    await expect(page.locator(DETAIL_CART)).toBeVisible();
    await expect(page.locator(HEADER_CART)).toBeVisible();
  });

  test("keeps the header shortcut in sync across other sections", async ({
    page,
  }) => {
    await page.goto("/handmade/shop");
    await page.locator("[data-add-to-cart]").first().click();
    await expect(page.locator(HEADER_CART)).toBeVisible();

    // Ein Abschnitt ohne eigene Warenkorb-UI zeigt trotzdem den Header-Einstieg.
    await page.goto("/news");
    await expect(page.locator(HEADER_CART)).toBeVisible();
    await expect(page.locator(HEADER_BADGE)).toHaveText("1");
  });
});
