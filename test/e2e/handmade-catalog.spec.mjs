import { test, expect } from "@playwright/test";

/**
 * End-to-End-Prüfungen für das Rendering des Handmade-Katalogs.
 *
 * Sichert die deutsche Währungsformatierung ab: die Karten rendern Preise früher
 * mit `toFixed(2)`, was "35.00 €" ergab, während Detailseite und Warenkorb
 * "35,00 €" zeigten. Die Assertions unten schreiben gegen den gerenderten Text,
 * statt den Formatierungshelfer wiederzuverwenden, damit sich eine Regression
 * nicht hinter einer gemeinsamen Implementierung verstecken kann.
 */

test.describe("handmade catalog", () => {
  test("product cards render prices in German currency format", async ({
    page,
  }) => {
    await page.goto("/handmade/shop");

    const prices = page.locator("article [data-product-price]");
    await expect(prices.first()).toBeVisible();

    const rendered = await prices.allTextContents();
    expect(rendered.length).toBeGreaterThan(0);

    for (const price of rendered) {
      expect(price.trim()).toMatch(/^\d+(\.\d{3})*,\d{2}\s*€$/);
    }
  });

  test("the product detail page uses the same price format", async ({
    page,
  }) => {
    const addButton = page.locator("[data-add-to-cart]").first();
    await page.goto("/handmade/shop");
    const articleNumber = await addButton.getAttribute("data-article-number");

    await page.goto(`/handmade/${articleNumber}`);

    await expect(page.locator(".price-section")).toHaveText(
      /^\d+(\.\d{3})*,\d{2}\s*€$/
    );
  });

  test("the product grid lines up with the first sidebar box", async ({
    page,
  }) => {
    // Nur Desktop: unterhalb von `lg` wandert die Sidebar bewusst über das Raster.
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/handmade/shop");

    const grid = page.locator("#products-grid");
    const sidebar = page.locator("nav.space-y-6 > *").first();
    await expect(grid).toBeVisible();
    await expect(sidebar).toBeVisible();

    const gridBox = await grid.boundingBox();
    const sidebarBox = await sidebar.boundingBox();
    expect(gridBox).not.toBeNull();
    expect(sidebarBox).not.toBeNull();

    // `<section class="section">` fügt 3-4rem Top-Padding hinzu, was die
    // Produktkarten früher unter die Oberkante der Sidebar geschoben hat.
    expect(Math.abs(gridBox.y - sidebarBox.y)).toBeLessThanOrEqual(1);
  });
});
