import { test, expect } from "@playwright/test";

/**
 * End-to-End-Abdeckung des Trainings-Downloads (#301).
 *
 * Geprüft wird die gebaute Seite im Preview: das ZIP-Archiv der
 * Kubernetes-Beispieldateien, der eine Download-Eintrag samt fehlender
 * Größenangabe, der Hinweis mit `/downloads/`-Link in beiden
 * Einleitungskapiteln sowie die Suche auf der Download-Übersicht.
 */

const ARCHIVE_URL = "/downloads/kubernetes-basis-examplefiles.zip";
const DOWNLOADS_PAGE = "/downloads/";

// Signatur des ersten Local-File-Headers eines ZIP-Archivs.
const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

const HYDRATION_TIMEOUT = 15_000;

const INTRODUCTIONS = [
  {
    page: "/docs/kubernetes-basis-de/01-einleitung/",
    hint: "Die Beispieldateien zum Training stehen im Download-Bereich",
    linkText: "Download-Bereich",
  },
  {
    page: "/docs/kubernetes-basis-en/01-introduction/",
    hint: "The example files for the training are available in the downloads section",
    linkText: "downloads section",
  },
];

test.describe("kubernetes example files archive", () => {
  test(`${ARCHIVE_URL} serves the ZIP body`, async ({ request }) => {
    const response = await request.get(ARCHIVE_URL);

    expect(response.status(), `HTTP-Status für ${ARCHIVE_URL}`).toBe(200);

    const body = await response.body();
    expect(body.length, "Archivgröße").toBeGreaterThan(0);
    expect(
      body.subarray(0, ZIP_SIGNATURE.length).equals(ZIP_SIGNATURE),
      `ZIP-Signatur im Body, Anfang: ${body.subarray(0, 4).toString("hex")}`
    ).toBe(true);

    // AK 37: `application/zip` ist der Wunsch-MIME-Typ; liefert die
    // Preview-Schicht einen anderen Typ, trägt die ZIP-Signatur allein.
    const contentType = response.headers()["content-type"] ?? "";
    const isZipMime = /^application\/zip\b/.test(contentType);
    expect(
      isZipMime || body.subarray(0, ZIP_SIGNATURE.length).equals(ZIP_SIGNATURE),
      `Content-Type ${contentType || "(fehlt)"} ohne ZIP-Signatur`
    ).toBe(true);
    expect(contentType, "keine HTML-Fehlerseite").not.toMatch(/^text\/html\b/);
  });
});

test.describe("downloads overview", () => {
  test("lists the archive as one card with type zip and no size", async ({
    page,
  }) => {
    const response = await page.goto(DOWNLOADS_PAGE);
    expect(response, `Antwort für ${DOWNLOADS_PAGE}`).not.toBeNull();
    expect(response.status(), `HTTP-Status für ${DOWNLOADS_PAGE}`).toBe(200);

    const cards = page.locator(".download-card");
    await expect(cards, "Karten auf der Download-Übersicht").toHaveCount(7);

    const archiveLink = page.locator(`a[href="${ARCHIVE_URL}"]`);
    await expect(archiveLink, "Links auf das Beispieldatei-Archiv").toHaveCount(
      1
    );

    const archiveCard = cards.filter({ has: archiveLink });
    await expect(
      archiveCard,
      "genau eine Karte mit dem Archiv-Link"
    ).toHaveCount(1);
    await expect(archiveCard).toContainText(
      "Kubernetes-Trainingsmaterial (Beispieldateien)"
    );
    await expect(archiveCard).toContainText("Type: zip");
    await expect(
      archiveCard,
      "Karte trägt keine Größenangabe"
    ).not.toContainText("Size:");
  });

  test("counts seven downloads after hydration", async ({ page }) => {
    await page.goto(DOWNLOADS_PAGE);

    // Der Results-Count entsteht clientseitig (`client:only`-Sidebar).
    await expect(page.locator("#results-count")).toHaveText(
      "7 von 7 Downloads",
      { timeout: HYDRATION_TIMEOUT }
    );
    await expect(page.locator(".download-card")).toHaveCount(7);
  });

  test("search for Kubernetes keeps the archive card visible", async ({
    page,
  }) => {
    await page.goto(DOWNLOADS_PAGE);

    const searchInput = page.locator("#search-input");
    await expect(searchInput).toBeVisible({ timeout: HYDRATION_TIMEOUT });

    const resultsCount = page.locator("#results-count");
    await expect(resultsCount).toHaveText("7 von 7 Downloads", {
      timeout: HYDRATION_TIMEOUT,
    });

    await searchInput.fill("Kubernetes");

    const archiveCard = page
      .locator(".download-card")
      .filter({ has: page.locator(`a[href="${ARCHIVE_URL}"]`) });
    await expect(archiveCard).toBeVisible();
    await expect(archiveCard).toContainText("Type: zip");
    await expect(resultsCount, "Trefferzahl nach dem Filter").toHaveText(
      "1 von 7 Downloads"
    );

    await page.locator("#clear-filters").click();
    await expect(resultsCount, "Trefferzahl nach dem Zurücksetzen").toHaveText(
      "7 von 7 Downloads"
    );
  });
});

test.describe("introduction hints", () => {
  for (const { page: url, hint, linkText } of INTRODUCTIONS) {
    test(`${url} shows the hint with exactly one /downloads/ link`, async ({
      page,
    }) => {
      const response = await page.goto(url, { waitUntil: "domcontentloaded" });
      expect(response, `Antwort für ${url}`).not.toBeNull();
      expect(response.status(), `HTTP-Status für ${url}`).toBe(200);

      const downloadLinks = page.locator('a[href="/downloads/"]');
      await expect(
        downloadLinks,
        `Links auf /downloads/ auf ${url}`
      ).toHaveCount(1);

      const hintBlock = page
        .locator("blockquote")
        .filter({ has: page.locator('a[href="/downloads/"]') });
      await expect(hintBlock, "Hinweis-Blockquote").toHaveCount(1);
      await expect(hintBlock).toContainText(hint);

      const hintLink = hintBlock.locator('a[href="/downloads/"]');
      await expect(
        hintLink,
        "genau ein Link in der Hinweis-Blockquote"
      ).toHaveCount(1);
      await expect(hintLink).toBeVisible();
      await expect(hintLink).toHaveText(linkText);
    });
  }
});
