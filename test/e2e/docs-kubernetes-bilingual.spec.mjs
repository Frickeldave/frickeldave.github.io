import { test, expect } from '@playwright/test';

/**
 * End-to-End-Abdeckung der zweisprachigen Kubernetes-Schulung (#301).
 *
 * Geprüft wird die gebaute Seite: Kapitelabdeckung beider Gruppen, HTTP-Status und
 * `<h1>`-Struktur aller 14 Kapitel, fehlende deutsche Fließprosa in der
 * englischen Fassung, die acht Legacy-Weiterleitungen, Link-Hygiene, die
 * Docs-Übersicht und die Sitemap.
 *
 * Prosa-Prüfung: Code-Fences bleiben laut Spezifikation in beiden Sprachen
 * unverändert (inklusive deutscher Kommentare in Skripten). Der Detektor liest
 * deshalb nur den Text innerhalb von `#main-content` und entfernt `pre`, `code`,
 * `script` und `style`, bevor er nach deutschen Funktionswörtern und Umlauten
 * sucht. Der Kontrolltest unten belegt, dass der Detektor die deutsche Fassung
 * tatsächlich anschlägt – die Prüfung ist damit nicht trivial grün.
 */

const DE_BASE = '/docs/kubernetes-basis-de';
const EN_BASE = '/docs/kubernetes-basis-en';
const LEGACY_BASE = '/docs/kubernetes-basis';

const DE_SLUGS = [
  '01-einleitung',
  '02-ziele-methoden',
  '03-vorbereitung',
  '10-tag-1',
  '20-tag-2',
  '90-glossar',
  '91-kubectl',
];

const EN_SLUGS = [
  '01-introduction',
  '02-goals-methods',
  '03-preparation',
  '10-day-1',
  '20-day-2',
  '90-glossary',
  '91-kubectl',
];

const GROUPS = [
  { name: 'German', base: DE_BASE, slugs: DE_SLUGS, heading: /kubernetes basis/i },
  { name: 'English', base: EN_BASE, slugs: EN_SLUGS, heading: /kubernetes basics/i },
];

/**
 * Die acht Legacy-URLs entsprechen exakt den `redirects`-Keys in
 * `astro.config.mjs` (ohne Trailing Slash); die Ziele dort enden mit Slash.
 */
const LEGACY_REDIRECTS = [
  { from: LEGACY_BASE, to: '/docs/kubernetes-basis-de/' },
  ...DE_SLUGS.map((slug) => ({
    from: `${LEGACY_BASE}/${slug}`,
    to: `${DE_BASE}/${slug}/`,
  })),
];

/**
 * Eindeutig deutsche Funktionswörter. Bewusst ohne mehrdeutige Formen wie
 * `die`, `hat`, `man`, `in`, `an` oder `so`, die auch in englischer Prosa
 * vorkommen. Deutsche Sätze enthalten praktisch immer mehrere dieser Wörter.
 */
const GERMAN_MARKERS = [
  'und',
  'oder',
  'nicht',
  'wird',
  'werden',
  'für',
  'über',
  'eine',
  'einen',
  'einem',
  'einer',
  'ist',
  'sind',
  'auch',
  'sich',
  'kann',
  'können',
  'muss',
  'müssen',
  'dieser',
  'diese',
  'dieses',
  'zur',
  'zum',
  'beim',
  'vom',
  'noch',
  'nur',
  'wenn',
  'dann',
  'dabei',
  'damit',
  'durch',
  'ohne',
  'unter',
  'zwischen',
  'nach',
  'vor',
  'bei',
  'haben',
  'gibt',
  'als',
  'wie',
  'wir',
  'sie',
  'des',
  'dem',
  'den',
  'dass',
  'daß',
  'sowie',
  'bereits',
  'jedoch',
  'allerdings',
  'während',
  'wegen',
];

/**
 * Sammelt die Fließprosa einer Seite und meldet deutsche Marker und Umlaute.
 * `#main-content` ist der Inhaltsbereich der Docs-Seiten; die Site-Navigation
 * bleibt damit außen vor.
 */
const analyseProse = (page) =>
  page.evaluate((markers) => {
    const main = document.querySelector('#main-content');

    if (!main) return null;

    const clone = main.cloneNode(true);
    clone
      .querySelectorAll('script, style, pre, code')
      .forEach((node) => node.remove());

    const text = clone.textContent.replace(/\s+/g, ' ').trim();
    const tokens = text.toLowerCase().match(/[a-zäöüß]+/g) ?? [];
    const markerSet = new Set(markers);

    return {
      length: text.length,
      markers: [...new Set(tokens.filter((token) => markerSet.has(token)))],
      umlauts: [...new Set(tokens.filter((token) => /[äöüß]/.test(token)))],
    };
  }, GERMAN_MARKERS);

/** Entfernt einen optionalen Trailing Slash, damit Link- und Sitemap-Vergleiche stabil sind. */
const withoutTrailingSlash = (value) => value.replace(/\/$/, '');

for (const group of GROUPS) {
  test.describe(`kubernetes training - ${group.name}`, () => {
    test(`${group.base}/ links exactly its own seven chapters`, async ({ page }) => {
      const response = await page.goto(`${group.base}/`);
      expect(response, `expected a response for ${group.base}/`).not.toBeNull();
      expect(response.status(), `expected HTTP 200 for ${group.base}/`).toBe(200);

      const hrefs = await page.$$eval(`a[href^="${group.base}/"]`, (links) =>
        links.map((link) => link.getAttribute('href'))
      );

      // Genau sieben Links, keine Dubletten, keine fremdsprachigen Kapitel.
      expect(
        hrefs,
        `expected exactly seven chapter links below ${group.base}/`
      ).toHaveLength(7);

      const slugs = hrefs.map((href) =>
        withoutTrailingSlash(href.slice(group.base.length + 1))
      );
      expect(new Set(slugs), `chapter set on ${group.base}/`).toEqual(
        new Set(group.slugs)
      );
    });

    test(`${group.base}/ serves HTTP 200 with exactly one matching h1`, async ({ page }) => {
      const response = await page.goto(`${group.base}/`);
      expect(response, `expected a response for ${group.base}/`).not.toBeNull();
      expect(response.status(), `expected HTTP 200 for ${group.base}/`).toBe(200);
      await expect(page.locator('h1'), `h1 count on ${group.base}/`).toHaveCount(1);
      await expect(page.locator('h1').first()).toContainText(group.heading);
    });

    for (const slug of group.slugs) {
      test(`${group.base}/${slug}/ serves HTTP 200 with exactly one h1`, async ({
        page,
      }) => {
        const url = `${group.base}/${slug}/`;
        const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
        expect(response, `expected a response for ${url}`).not.toBeNull();
        expect(response.status(), `expected HTTP 200 for ${url}`).toBe(200);
        await expect(page.locator('h1'), `h1 count on ${url}`).toHaveCount(1);
        await expect(page.locator('h1').first()).not.toBeEmpty();
      });
    }
  });
}

test.describe('kubernetes training - English prose', () => {
  for (const slug of EN_SLUGS) {
    test(`${EN_BASE}/${slug}/ contains no German running prose`, async ({ page }) => {
      const url = `${EN_BASE}/${slug}/`;
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      const prose = await analyseProse(page);
      expect(prose, `expected prose inside #main-content on ${url}`).not.toBeNull();

      // Untergrenze schützt davor, dass ein leerer Selektor den Test bestehen lässt.
      expect(prose.length, `expected substantial prose on ${url}`).toBeGreaterThan(
        1500
      );
      expect(prose.markers, `German function words on ${url}`).toEqual([]);
      expect(prose.umlauts, `umlauts in English prose on ${url}`).toEqual([]);
    });
  }

  test('the prose detector flags the German chapter (negative control)', async ({
    page,
  }) => {
    // Beweist, dass derselbe Detektor deutsche Fließprosa erkennt. Ohne diesen
    // Kontrolltest wäre ein grüner Prosa-Test auch bei kaputtem Selektor möglich.
    await page.goto(`${DE_BASE}/10-tag-1/`, {
      waitUntil: 'domcontentloaded',
    });

    const prose = await analyseProse(page);
    expect(prose).not.toBeNull();
    expect(prose.markers.length).toBeGreaterThan(20);
    expect(prose.umlauts.length).toBeGreaterThan(0);
  });
});

test.describe('legacy kubernetes URLs', () => {
  for (const { from, to } of LEGACY_REDIRECTS) {
    test(`${from} redirects to ${to} as a noindex stub`, async ({ page, request }) => {
      const response = await request.get(from, { maxRedirects: 0 });
      const status = response.status();

      if (status >= 300 && status < 400) {
        const location = response.headers()['location'] ?? '';
        expect(location, `location header for ${from}`).toMatch(
          /^\/docs\/kubernetes-basis-de/
        );
      } else {
        expect(status, `expected 200 or 3xx for ${from}`).toBe(200);

        const body = await response.text();
        expect(body, `expected a meta refresh on ${from}`).toContain(
          `http-equiv="refresh"`
        );
        expect(body, `expected the redirect target in the meta refresh on ${from}`).toContain(
          `url=${to}`
        );
        expect(body, `expected robots noindex on ${from}`).toContain(
          '<meta name="robots" content="noindex">'
        );
        expect(body, `expected a canonical link on ${from}`).toContain(
          `<link rel="canonical" href="https://frickeldave.github.io${to}">`
        );
        expect(body, `expected no h1 on the redirect stub ${from}`).not.toMatch(
          /<h1[\s>]/i
        );
      }

      await page.goto(from, { waitUntil: 'domcontentloaded' });

      // `page.goto` folgt dem Meta-Refresh; Trailing Slash bleibt optional.
      await expect(page).toHaveURL(new RegExp(`${withoutTrailingSlash(to)}/?$`));
      const h1 = page.locator('h1').first();
      await expect(h1, `expected a visible h1 at the redirect target of ${from}`).toBeVisible();
      await expect(h1).not.toBeEmpty();
    });
  }
});

test.describe('kubernetes training - link hygiene', () => {
  test('built German and English pages contain no legacy hrefs and no localhost URL', async ({
    request,
  }) => {
    const urls = GROUPS.flatMap((group) => [
      `${group.base}/`,
      ...group.slugs.map((slug) => `${group.base}/${slug}/`),
    ]);

    for (const url of urls) {
      const response = await request.get(url);
      expect(response.status(), `expected HTTP 200 for ${url}`).toBe(200);

      const html = await response.text();
      expect(html.length, `expected rendered HTML for ${url}`).toBeGreaterThan(
        1000
      );
      expect(html, `expected an h1 in ${url}`).toMatch(/<h1[\s>]/);
      expect(html, `stale href on ${url}`).not.toContain(
        'href="/docs/kubernetes-basis/'
      );
      expect(html, `localhost URL on ${url}`).not.toContain('localhost:4321');
    }
  });
});

test.describe('kubernetes training - docs overview and sitemap', () => {
  test('/docs/ links both language groups and no legacy group', async ({ page }) => {
    const response = await page.goto('/docs/');
    expect(response).not.toBeNull();
    expect(response.status()).toBe(200);

    await expect(page.locator('a[href="/docs/kubernetes-basis-de"]')).toHaveCount(
      1
    );
    await expect(page.locator('a[href="/docs/kubernetes-basis-en"]')).toHaveCount(
      1
    );
    await expect(page.locator('a[href="/docs/kubernetes-basis"]')).toHaveCount(0);
    await expect(page.locator('a[href^="/docs/kubernetes-basis/"]')).toHaveCount(
      0
    );
  });

  test('the sitemap lists both groups and no legacy course', async ({ request }) => {
    const response = await request.get('/sitemap-0.xml');
    expect(response.status()).toBe(200);

    const xml = await response.text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (match) => match[1]
    );
    expect(locs.length).toBeGreaterThan(0);

    const expected = GROUPS.flatMap((group) => [
      `https://frickeldave.github.io${group.base}/`,
      ...group.slugs.map(
        (slug) => `https://frickeldave.github.io${group.base}/${slug}/`
      ),
    ]).sort();

    expect(
      locs.filter((loc) => loc.includes('kubernetes')).sort(),
      'expected exactly the 16 course URLs in the sitemap'
    ).toEqual(expected);
    expect(
      locs.filter((loc) => loc.includes(`${LEGACY_BASE}/`)),
      'sitemap must not contain legacy course URLs'
    ).toEqual([]);
  });
});
