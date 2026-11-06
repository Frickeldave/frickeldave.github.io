import { test, expect } from '@playwright/test';

/**
 * End-to-End-Abdeckung der zweisprachigen Kubernetes-Schulung (#301).
 *
 * Geprüft wird die gebaute Seite: Kapitelabdeckung beider Gruppen, HTTP-Status und
 * `<h1>`-Struktur aller 14 Kapitel, fehlende deutsche Fließprosa in der
 * englischen Fassung, die acht Legacy-Weiterleitungen, Link-Hygiene, die
 * Docs-Übersicht und die Sitemap. Zusätzlich deckt die Spec die
 * Sprachbeschriftung der Kacheln und die vier Landingpages ab. Seit der
 * Rücknahme vom 2026-11-05 rendern `/docs/` und die drei Gruppen-Indizes nur
 * noch `PageHeader` und das Kachel-Grid – ohne Navigation, Inhaltsverzeichnis
 * und Index-Body. Die Kapitelseiten behalten Navigation, ToC und einen
 * gerenderten Body.
 *
 * Link-Zählungen gelten wieder für die ganze Seite: Ohne die Navigation
 * verdoppelt kein zweiter Linkpfad die `href`-Werte. Das Kachel-Grid wird
 * zusätzlich separat gezählt, damit Kapitel-Links außerhalb des Grids
 * auffallen.
 *
 * Navigation und Inhaltsverzeichnis der Kapitelseiten liegen in
 * `<ScrollArea client:only="react">` und damit zunächst in
 * `<template data-astro-template>`; die Locator-Helfer warten auf die
 * hydratisierte Überschrift, statt das statische Markup zu lesen.
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

const WORKSHOP_SLUGS = [
  '01-einleitung',
  '02-ziele-methoden',
  '03-vorbereitung',
  '10-astro-setup',
  '20-linting-eslint',
  '21-linting-prettier',
  '22-linting-vale',
  '30-ki-translation',
  '40-weiter-lernen',
  '90-glossar',
];

/**
 * Die vier Landingpages rendern seit der Rücknahme vom 2026-11-05 nur
 * `PageHeader` und das Kachel-Grid. `tileHrefs` sind die einzigen Links auf
 * Kachel-Ziele, `languageLabels` die sichtbaren Sprachbadges und
 * `indexHeadings` die Überschriften des früheren Index-Bodys, die nicht mehr
 * gerendert werden dürfen.
 */
const LANDING_PAGES = [
  {
    path: '/docs/',
    heading: 'Documentation',
    tileHrefs: ['/docs/astro-workshop', DE_BASE, EN_BASE],
    languageLabels: ['Deutsch', 'Englisch'],
    indexHeadings: ['Workshop-Überblick', 'Überblick', 'Overview'],
  },
  {
    path: '/docs/astro-workshop/',
    heading: 'Astro Workshop',
    tileHrefs: WORKSHOP_SLUGS.map((slug) => `/docs/astro-workshop/${slug}`),
    languageLabels: [],
    indexHeadings: ['Workshop-Überblick'],
  },
  {
    path: `${DE_BASE}/`,
    heading: 'Kubernetes Basis',
    tileHrefs: DE_SLUGS.map((slug) => `${DE_BASE}/${slug}`),
    languageLabels: [],
    indexHeadings: ['Überblick'],
  },
  {
    path: `${EN_BASE}/`,
    heading: 'Kubernetes Basics',
    tileHrefs: EN_SLUGS.map((slug) => `${EN_BASE}/${slug}`),
    languageLabels: [],
    indexHeadings: ['Overview'],
  },
];

/** Timeout für die Hydration der React-Inseln mit Navigation und Inhaltsverzeichnis. */
const HYDRATION_TIMEOUT = 15_000;

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

/**
 * Navigation und Inhaltsverzeichnis werden von `ScrollArea` (`client:only="react"`)
 * umschlossen. Astro liefert ihre Kinder in `<template data-astro-template>`;
 * erst nach der Hydration stehen sie als echte DOM-Knoten zur Verfügung.
 * Die Filterung nach der gerenderten Überschrift wartet genau auf diesen Zustand.
 */
const navPanel = (page) =>
  page.locator('astro-island').filter({
    has: page.locator('h2', { hasText: /^Documents$/ }),
  });

const tocPanel = (page) =>
  page.locator('astro-island').filter({
    has: page.locator('h2', { hasText: /^Contents$/ }),
  });

const waitForHydratedNav = (page) =>
  expect(
    navPanel(page).getByRole('heading', { name: 'Documents', exact: true })
  ).toBeVisible({ timeout: HYDRATION_TIMEOUT });

const waitForHydratedToc = (page) =>
  expect(
    tocPanel(page).getByRole('heading', { name: 'Contents', exact: true })
  ).toBeVisible({ timeout: HYDRATION_TIMEOUT });

/** Liest Top-Level-Einträge, aktuelle Markierung und Kapitel-Kinder der Navigation. */
const readNavStructure = (page) =>
  navPanel(page)
    .locator('li.ml-0')
    .evaluateAll((items) =>
      items.map((item) => {
        const link = item.querySelector(':scope > a');
        return {
          href: link?.getAttribute('href') ?? '',
          bold: link?.classList.contains('font-bold') ?? false,
          children: [...item.querySelectorAll(':scope > ul > li > a')].map(
            (child) => child.getAttribute('href')
          ),
        };
      })
    );

const sorted = (values) => [...values].sort();

for (const group of GROUPS) {
  test.describe(`kubernetes training - ${group.name}`, () => {
    test(`${group.base}/ links exactly its own seven chapters`, async ({ page }) => {
      const response = await page.goto(`${group.base}/`);
      expect(response, `expected a response for ${group.base}/`).not.toBeNull();
      expect(response.status(), `expected HTTP 200 for ${group.base}/`).toBe(200);

      // Seit dem Rückzug der Navigation gibt es keinen zweiten Linkpfad: Die
      // Kapitelabdeckung gilt wieder für die ganze Seite (AK 7).
      const hrefs = await page.$$eval(
        `a[href^="${group.base}/"]`,
        (links) => links.map((link) => link.getAttribute('href'))
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

      // Alle sieben Links liegen im Kachel-Grid; außerhalb gibt es keine (AK 22).
      await expect(
        page.locator(`section.section div.row a[href^="${group.base}/"]`),
        `chapter tiles in the grid on ${group.base}/`
      ).toHaveCount(7);
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

    // Die Zählung gilt wieder für die ganze Seite (AK 8): Ohne Navigation
    // verlinkt kein zweiter Pfad dieselben Gruppen.
    await expect(
      page.locator('a[href="/docs/kubernetes-basis-de"]')
    ).toHaveCount(1);
    await expect(
      page.locator('a[href="/docs/kubernetes-basis-en"]')
    ).toHaveCount(1);
    await expect(page.locator('a[href="/docs/kubernetes-basis"]')).toHaveCount(0);
    await expect(
      page.locator('a[href^="/docs/kubernetes-basis/"]')
    ).toHaveCount(0);
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

test.describe('docs overview - language labels', () => {
  test('the two Kubernetes tiles carry exactly the Deutsch and Englisch badge', async ({
    page,
  }) => {
    const response = await page.goto('/docs/');
    expect(response, 'expected a response for /docs/').not.toBeNull();
    expect(response.status(), 'expected HTTP 200 for /docs/').toBe(200);

    const badges = page.locator('[data-language-label]');
    await expect(badges).toHaveCount(2);

    // Die Kacheln werden seitenweit adressiert: ohne Navigation gibt es keinen
    // zweiten Link mit denselben `href`-Werten (AK 13).
    const deTile = page.locator('a[href="/docs/kubernetes-basis-de"]');
    const enTile = page.locator('a[href="/docs/kubernetes-basis-en"]');
    const workshopTile = page.locator('a[href="/docs/astro-workshop"]');
    await expect(deTile).toHaveCount(1);
    await expect(enTile).toHaveCount(1);
    await expect(workshopTile).toHaveCount(1);

    const deBadge = deTile.locator('[data-language-label]');
    const enBadge = enTile.locator('[data-language-label]');
    await expect(deBadge).toHaveCount(1);
    await expect(enBadge).toHaveCount(1);
    await expect(deBadge).toHaveText('Deutsch');
    await expect(enBadge).toHaveText('Englisch');
    await expect(deBadge).toBeVisible();
    await expect(enBadge).toBeVisible();

    await expect(workshopTile.locator('[data-language-label]')).toHaveCount(0);
    await expect(workshopTile).not.toContainText('Deutsch');
    await expect(workshopTile).not.toContainText('Englisch');

    // Kein leerer Badge-Knoten irgendwo auf der Seite.
    await expect(page.locator('[data-language-label]:empty')).toHaveCount(0);

    // Jeder Badge liegt in der Kachel seines Sprachordners.
    const badgeTiles = await badges.evaluateAll((nodes) =>
      nodes.map((node) => ({
        text: (node.textContent ?? '').trim(),
        href: node.closest('a')?.getAttribute('href') ?? null,
      }))
    );
    expect(
      badgeTiles.sort((left, right) =>
        (left.href ?? '').localeCompare(right.href ?? '')
      )
    ).toEqual([
      { text: 'Deutsch', href: '/docs/kubernetes-basis-de' },
      { text: 'Englisch', href: '/docs/kubernetes-basis-en' },
    ]);
  });

  test('/docs/ exposes exactly the three group tiles page-wide', async ({ page }) => {
    await page.goto('/docs/');

    // Zählung für die ganze Seite (AK 15/24): genau drei Kachel-Links,
    // jeder genau einmal. Der Header-Link auf `/docs` beginnt nicht mit `/docs/`.
    await expect(page.locator('a[href^="/docs/"]')).toHaveCount(3);
    for (const href of ['/docs/astro-workshop', DE_BASE, EN_BASE]) {
      await expect(page.locator(`a[href="${href}"]`)).toHaveCount(1);
    }
    await expect(page.locator('a[href="/docs/kubernetes-basis"]')).toHaveCount(0);

    // Kacheltitel unverändert (AK 15), in der Sortierung nach `title`.
    await expect(page.locator('section.section div.row h4')).toHaveText([
      'Astro Workshop',
      'Kubernetes Basics',
      'Kubernetes Basis',
    ]);
  });
});

test.describe('landing pages - no navigation, table of contents or index body', () => {
  for (const landing of LANDING_PAGES) {
    test(`${landing.path} renders only PageHeader and the tile grid`, async ({
      page,
      request,
    }) => {
      const response = await page.goto(landing.path);
      expect(
        response,
        `expected a response for ${landing.path}`
      ).not.toBeNull();
      expect(response.status(), `expected HTTP 200 for ${landing.path}`).toBe(
        200
      );

      // Keine Client-Inseln und kein Template-Markup: Die Abwesenheit von
      // Navigation und ToC ist kein Hydrationsartefakt, sondern gilt bereits
      // für das statische Dokument (AK 21).
      await expect(page.locator('astro-island')).toHaveCount(0);
      await expect(
        page.locator('template[data-astro-template]')
      ).toHaveCount(0);
      await expect(
        navPanel(page),
        `navigation panel on ${landing.path}`
      ).toHaveCount(0);
      await expect(
        tocPanel(page),
        `toc panel on ${landing.path}`
      ).toHaveCount(0);
      await expect(
        page.getByRole('heading', { name: 'Documents', exact: true }),
        `Documents heading on ${landing.path}`
      ).toHaveCount(0);
      await expect(
        page.getByRole('heading', { name: 'Contents', exact: true }),
        `Contents heading on ${landing.path}`
      ).toHaveCount(0);

      // Keine Spalten und kein Body-Kasten: weder Navigation noch ToC noch ein
      // gerenderter Index-Body (AK 21/23).
      await expect(
        page.locator('.max-h-static_sidemenu'),
        `sidebar wrappers on ${landing.path}`
      ).toHaveCount(0);
      await expect(
        page.locator('section.content'),
        `index body box on ${landing.path}`
      ).toHaveCount(0);
      await expect(
        page.locator('.content.glass'),
        `glass content box on ${landing.path}`
      ).toHaveCount(0);

      // Genau eine Überschrift aus dem PageHeader, keine weitere aus dem Body.
      await expect(
        page.locator('h1'),
        `h1 count on ${landing.path}`
      ).toHaveCount(1);
      await expect(page.locator('h1')).toHaveText(landing.heading);

      // Das Kachel-Grid ist der einzige Inhaltsblock unter <main>; ohne linke
      // Spalte steht der Header in voller Breite (AK 20/21).
      await expect(
        page.locator('#main-content > section.section'),
        `tile grid blocks on ${landing.path}`
      ).toHaveCount(1);

      // Die Überschriften des früheren Index-Bodys werden nicht gerendert (AK 23).
      for (const heading of landing.indexHeadings) {
        await expect(
          page.locator('body'),
          `"${heading}" must not be rendered on ${landing.path}`
        ).not.toContainText(heading);
      }

      // Kachel-Links: genau die erwarteten Ziele, je genau einmal und
      // ausschließlich im Grid (AK 22/24).
      await expect(
        page.locator('section.section div.row a[href]'),
        `tiles on ${landing.path}`
      ).toHaveCount(landing.tileHrefs.length);
      for (const href of landing.tileHrefs) {
        await expect(
          page.locator(`a[href="${href}"]`),
          `links to ${href} on ${landing.path}`
        ).toHaveCount(1);
        await expect(
          page.locator(`section.section div.row a[href="${href}"]`),
          `tile link ${href} on ${landing.path}`
        ).toHaveCount(1);
      }

      // Sprachbadges nur auf /docs/, sonst nirgends (AK 13/14/24).
      const badges = page.locator('[data-language-label]');
      await expect(
        badges,
        `language labels on ${landing.path}`
      ).toHaveCount(landing.languageLabels.length);
      if (landing.languageLabels.length > 0) {
        const labelTexts = (await badges.allTextContents()).map((text) =>
          text.trim()
        );
        expect(
          sorted(labelTexts),
          `language labels on ${landing.path}`
        ).toEqual(sorted(landing.languageLabels));
      }
      await expect(page.locator('[data-language-label]:empty')).toHaveCount(0);

      // Auch die ausgelieferte HTML-Antwort enthält kein Navigations-Markup.
      const htmlResponse = await request.get(landing.path);
      expect(htmlResponse.status()).toBe(200);
      const html = await htmlResponse.text();
      expect(
        html,
        `served Documents heading on ${landing.path}`
      ).not.toContain('>Documents<');
      expect(
        html,
        `served Contents heading on ${landing.path}`
      ).not.toContain('>Contents<');
    });
  }
});

test.describe('chapter pages - unchanged layout', () => {
  test(`${DE_BASE}/10-tag-1/ keeps navigation, ToC and exactly one h1`, async ({
    page,
  }) => {
    const url = `${DE_BASE}/10-tag-1/`;
    const response = await page.goto(url);
    expect(response, `expected a response for ${url}`).not.toBeNull();
    expect(response.status(), `expected HTTP 200 for ${url}`).toBe(200);

    await expect(page.locator('h1'), `h1 count on ${url}`).toHaveCount(1);
    await waitForHydratedNav(page);
    await waitForHydratedToc(page);

    const items = await readNavStructure(page);
    expect(items, `expected only the German group in the nav on ${url}`).toHaveLength(1);
    expect(items[0].href).toBe(DE_BASE);
    expect(sorted(items[0].children)).toEqual(
      sorted(DE_SLUGS.map((slug) => `${DE_BASE}/${slug}`))
    );
    await expect(
      navPanel(page).locator(`a[href="${DE_BASE}/10-tag-1"]`)
    ).toHaveClass(/font-bold/);
    await expect(tocPanel(page).locator('a[href^="#"]').first()).toBeVisible();
  });
});
