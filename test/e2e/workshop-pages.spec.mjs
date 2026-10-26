import { test, expect } from '@playwright/test';

/**
 * End-to-End-Smoke-Test für den Docs-Bereich der gebauten Seite.
 *
 * Prüft, dass die beiden Workshop-Landingpages mit HTTP 200 ausgeliefert werden und
 * die erwartete Hauptüberschrift (h1) rendern. Die Seiten sind Gruppen-Indexseiten,
 * gerendert von `src/pages/docs/[...id].astro` → `CollectionLayout`.
 */

const workshopPages = [
  {
    path: '/docs/astro-workshop/',
    heading: 'Astro Workshop',
  },
  {
    path: '/docs/kubernetes-basis/',
    heading: 'Kubernetes Basis',
  },
];

test.describe('docs workshops', () => {
  for (const { path, heading } of workshopPages) {
    test(`${path} responds with HTTP 200 and the correct heading`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response, `expected a response for ${path}`).not.toBeNull();
      expect(response.status(), `expected HTTP 200 for ${path}`).toBe(200);

      const h1 = page.locator('h1').first();
      await expect(h1, `expected h1 on ${path} to contain "${heading}"`).toContainText(heading);
    });
  }
});
