import { test, expect } from "@playwright/test";

/**
 * End-to-end checks for the Handmade catalog rendering.
 *
 * Guards the German currency formatting: the cards used to render prices with
 * `toFixed(2)`, which produced "35.00 €" while the detail page and the cart
 * showed "35,00 €". The assertions below are written against the rendered text
 * instead of reusing the formatting helper, so a regression cannot hide behind
 * a shared implementation.
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
    // Desktop only: below `lg` the sidebar moves above the grid by design.
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

    // `<section class="section">` adds 3-4rem of top padding, which used to
    // push the product cards below the top edge of the sidebar.
    expect(Math.abs(gridBox.y - sidebarBox.y)).toBeLessThanOrEqual(1);
  });
});
