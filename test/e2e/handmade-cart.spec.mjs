import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * End-to-end coverage for the client-side Handmade cart.
 *
 * Exercises the real built site: adding from the product grid, the nav counter,
 * the view-transition navigation to the cart page, quantity changes, and the
 * generated `mailto:` link. The link is asserted via its `href` so the test
 * never has to actually hand off to a mail client.
 */

const catalog = JSON.parse(
  readFileSync(new URL('../../public/data/handmade.json', import.meta.url), 'utf8')
);

const CART_STORAGE_KEY = 'frickeldave:handmade-cart';

/** Same formatting the cart page uses, so expectations stay in sync. */
const formatPrice = (value) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);

/** The cart formats prices with a non-breaking space; compare on plain spaces. */
const normalize = (value) => value.replace(/\u00a0/g, ' ');

const findProduct = (articleNumber) =>
  catalog.products.find((product) => product.articleNumber === articleNumber);

/** Decode the body of a `mailto:` link built by the cart. */
const mailBodyOf = (href) => {
  const body = href.split('&body=')[1];
  return body ? decodeURIComponent(body) : '';
};

test.describe('handmade cart', () => {
  test('shows the empty state without any items', async ({ page }) => {
    await page.goto('/handmade/warenkorb');

    await expect(page.locator('[data-cart-empty]')).toBeVisible();
    await expect(page.locator('[data-cart-list]')).toBeHidden();
    await expect(page.locator('[data-cart-summary]')).toBeHidden();
    await expect(page.locator('[data-cart-count]')).toBeHidden();
  });

  test('adds from the grid, updates quantity and builds the mail link', async ({
    page,
  }) => {
    await page.goto('/handmade/shop');

    const addButton = page.locator('[data-add-to-cart]').first();
    const articleNumber = await addButton.getAttribute('data-article-number');
    const productName = await addButton.getAttribute('data-product-name');
    const product = findProduct(articleNumber);
    expect(product, `product ${articleNumber} must exist in the catalog`).toBeTruthy();

    await addButton.click();

    // The nav counter reflects the new cart immediately.
    await expect(page.locator('[data-cart-count]')).toHaveText('1');

    // Only the article number and quantity are persisted — never the price.
    const stored = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      CART_STORAGE_KEY
    );
    expect(JSON.parse(stored)).toEqual([{ articleNumber, quantity: 1 }]);

    // Navigate through the nav link so the view transition path is covered too.
    await page.locator('[data-cart-link]').click();
    await expect(page).toHaveURL(/\/handmade\/warenkorb\/?$/);

    const line = page.locator('[data-cart-line]');
    await expect(line).toHaveCount(1);
    await expect(line.first()).toHaveAttribute('data-cart-line', articleNumber);

    const quantity = page.locator('[data-cart-quantity]').first();
    await expect(quantity).toHaveValue('1');
    await expect(page.locator('[data-cart-total]')).toHaveText(
      formatPrice(product.price)
    );

    // Raise the quantity and confirm both the line and the total follow.
    await page.locator('[data-cart-increase]').first().click();
    await expect(quantity).toHaveValue('2');
    await expect(page.locator('[data-cart-total]')).toHaveText(
      formatPrice(product.price * 2)
    );

    const mailto = page.locator('[data-cart-send]');
    const href = await mailto.getAttribute('href');
    expect(href.startsWith('mailto:handmade@frickeldave.de?')).toBe(true);

    const body = normalize(mailBodyOf(href));
    expect(body).toContain(`2 × ${productName} (${articleNumber})`);
    expect(body).toContain(`Gesamtsumme: ${normalize(formatPrice(product.price * 2))}`);

    // Contact details are folded into the link as they are typed.
    await page.locator('[data-cart-field="name"]').fill('Testkunde');
    const hrefWithName = await mailto.getAttribute('href');
    expect(normalize(mailBodyOf(hrefWithName))).toContain('Name: Testkunde');

    // Removing the last position falls back to the empty state.
    page.on('dialog', (dialog) => dialog.accept());
    await page.locator('[data-cart-clear]').click();
    await expect(page.locator('[data-cart-empty]')).toBeVisible();
    await expect(page.locator('[data-cart-count]')).toBeHidden();
  });

  test('adds from the product detail page', async ({ page }) => {
    const product = catalog.products.find((entry) => entry.visible);

    await page.goto(`/handmade/${product.articleNumber}`);
    await page.locator('[data-add-to-cart]').first().click();

    await expect(page.locator('[data-cart-count]')).toHaveText('1');
  });
});
