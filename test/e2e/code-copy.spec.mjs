import { test, expect } from "@playwright/test";

/**
 * End-to-End-Abdeckung für den globalen Kopierknopf an Codeblöcken.
 *
 * Geprüft wird die gebaute Seite: pro `pre > code` genau ein Knopf, keine Knöpfe
 * für `pre.mermaid`, Inline-Code und `[data-no-copy]`, der kopierte Text, das
 * Feedback-Timing und die Idempotenz über View-Transition-Navigationen.
 *
 * Der Knopf entsteht clientseitig aus einem inerten `<template>` (siehe
 * `src/lib/code-copy.ts`), deshalb ist die Bindung selbst der erste
 * Bereitschafts-Marker: `window.__codeCopyDomBound` wird gesetzt, bevor die
 * Blöcke aufgerüstet werden, und übersteht die Navigationen.
 */

const DOCS_PAGE = "/docs/kubernetes-basis/10-tag-1";
const NEXT_DOCS_PAGE = "/docs/kubernetes-basis/20-tag-2";
const SCAD_PAGE = "/handmade/3d-druck";

const WRAPPER = "[data-code-copy-wrapper]";
const BUTTON = "[data-code-copy-button]";
const LABEL = "[data-code-copy-label]";
const STATUS = "[data-code-copy-status]";

const IDLE_LABEL = "Kopieren";
const COPIED_LABEL = "Kopiert!";

/** Implementierung wartet 2000 ms; die Obergrenze deckt Timer-/Rendering-Jitter. */
const FEEDBACK_MIN_MS = 2000;
const FEEDBACK_MAX_MS = 4000;

/** Wartet, bis das Kopier-Skript gebunden hat (Flag aus `code-copy.ts`). */
const waitForBinding = (page) =>
  page.waitForFunction(() => Boolean(window.__codeCopyDomBound));

/** Wartet auf der Seite, die Knöpfe rendert, bis der erste Knopf sichtbar ist. */
const waitForButtons = async (page) => {
  await expect(page.locator(BUTTON).first()).toBeVisible();
};

/** Zählt `<pre>`, Mermaid-Blöcke, erwartbare Blöcke, Wrapper und Knöpfe. */
const collectCounts = (page) =>
  page.evaluate(
    ({ wrapperSelector, buttonSelector }) => {
      const pres = [...document.querySelectorAll("pre")];
      const copyable = pres.filter(
        (pre) =>
          pre.querySelector(":scope > code") &&
          !pre.matches("pre.mermaid") &&
          !pre.closest("[data-no-copy]")
      );

      return {
        pre: pres.length,
        mermaid: pres.filter((pre) => pre.matches("pre.mermaid")).length,
        copyable: copyable.length,
        wrappers: document.querySelectorAll(wrapperSelector).length,
        buttons: document.querySelectorAll(buttonSelector).length,
      };
    },
    { wrapperSelector: WRAPPER, buttonSelector: BUTTON }
  );

test.describe("code copy button", () => {
  test("renders one button per code block and skips mermaid and inline code", async ({
    page,
  }) => {
    await page.goto(DOCS_PAGE);
    await waitForButtons(page);

    const counts = await collectCounts(page);
    expect(counts.mermaid, "expected one mermaid block on the docs page").toBe(
      1
    );
    expect(counts.copyable).toBeGreaterThan(0);
    expect(counts.buttons).toBe(counts.copyable);
    expect(counts.wrappers).toBe(counts.copyable);

    // Der Knopf steht im Wrapper, das Original-`pre` bleibt das letzte Kind.
    const contract = await page.evaluate(() => {
      const problems = [];

      document
        .querySelectorAll("[data-code-copy-wrapper]")
        .forEach((wrapper) => {
          const button = wrapper.querySelector("[data-code-copy-button]");
          const last = wrapper.lastElementChild;

          if (wrapper.querySelectorAll("pre").length !== 1) {
            problems.push("wrapper does not hold exactly one pre");
          }
          if (
            wrapper.querySelectorAll("[data-code-copy-button]").length !== 1
          ) {
            problems.push("wrapper does not hold exactly one button");
          }
          if (!(last instanceof HTMLPreElement)) {
            problems.push("wrapper last child is not a pre");
            return;
          }
          if (!last.classList.contains("astro-code")) {
            problems.push("pre lost its astro-code class");
          }
          if (button && last.contains(button)) {
            problems.push("button is inside the scrolling pre");
          }
        });

      return problems;
    });
    expect(contract).toEqual([]);

    // `pre.mermaid` rendert clientseitig und bleibt ohne Wrapper.
    await expect(page.locator("pre.mermaid")).toHaveCount(1);
    const mermaidWrapped = await page
      .locator("pre.mermaid")
      .evaluate(
        (element) => element.closest("[data-code-copy-wrapper]") !== null
      );
    expect(mermaidWrapped).toBe(false);

    // Inline-Code (`code` ohne `pre`-Eltern) ist vorhanden und ohne Knopf.
    const inlineCode = await page.evaluate(
      () =>
        [...document.querySelectorAll("code")].filter(
          (code) => !code.closest("pre")
        ).length
    );
    expect(inlineCode).toBeGreaterThan(0);

    // Ruhezustand von Knopf und Live-Region.
    const wrapper = page.locator(WRAPPER).first();
    const button = wrapper.locator(BUTTON);
    await expect(button).toHaveAttribute("aria-label", "Code kopieren");
    await expect(button.locator(LABEL)).toHaveText(IDLE_LABEL);
    await expect(button).not.toHaveAttribute("data-state", /.*/);

    const status = wrapper.locator(STATUS);
    await expect(status).toHaveAttribute("role", "status");
    await expect(status).toHaveClass(/\bsr-only\b/);
    await expect(status).toHaveText("");
  });

  test("copies the code text of the clicked block into the clipboard", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(DOCS_PAGE);
    await waitForButtons(page);

    // Zwei Blöcke prüfen, damit jeder Knopf seinen eigenen Block kopiert.
    for (const index of [0, 1]) {
      const wrapper = page.locator(WRAPPER).nth(index);
      const button = wrapper.locator(BUTTON);
      const expected = (await wrapper.locator("code").textContent()).trim();
      expect(expected.length).toBeGreaterThan(0);

      // Vor dem Klick ist keine Live-Region mehr in der Bestätigung.
      await expect(
        page.locator(STATUS).filter({ hasText: COPIED_LABEL })
      ).toHaveCount(0);

      await button.click();
      await expect(button.locator(LABEL)).toHaveText(COPIED_LABEL);
      await expect(button).toHaveAttribute("data-state", "copied");

      // Live-Region genau dieses Blocks meldet die Bestätigung.
      await expect(wrapper.locator(STATUS)).toHaveText(COPIED_LABEL);
      await expect(
        page.locator(STATUS).filter({ hasText: COPIED_LABEL })
      ).toHaveCount(1);

      const clipboard = await page.evaluate(() =>
        navigator.clipboard.readText()
      );
      expect(clipboard.trim()).toBe(expected);
    }
  });

  test("shows Kopiert! and resets to Kopieren within 4000 ms", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(DOCS_PAGE);
    await waitForButtons(page);

    const wrapper = page.locator(WRAPPER).first();
    const button = wrapper.locator(BUTTON);
    const label = button.locator(LABEL);
    const status = wrapper.locator(STATUS);

    // Die Dauer wird im Seitenkontext gemessen: MutationObserver-Zeitstempel
    // bleiben unabhängig davon, wie stark die Testmaschine ausgelastet ist.
    await page.evaluate(
      ({ idleLabel, copiedLabel, timeoutMs }) => {
        const labelNode = document.querySelector(
          "[data-code-copy-wrapper] [data-code-copy-label]"
        );
        const startedAt = performance.now();

        window.__codeCopyTiming = new Promise((resolve) => {
          let copiedAt = null;
          const observer = new MutationObserver(() => {
            const text = labelNode.textContent;

            if (copiedAt === null) {
              if (text === copiedLabel) copiedAt = performance.now();
              return;
            }

            if (text === idleLabel) {
              observer.disconnect();
              resolve({
                copiedAt: copiedAt - startedAt,
                resetAt: performance.now() - startedAt,
              });
            }
          });

          observer.observe(labelNode, {
            childList: true,
            characterData: true,
            subtree: true,
          });

          setTimeout(() => {
            observer.disconnect();
            resolve({
              copiedAt: copiedAt === null ? null : copiedAt - startedAt,
              resetAt: null,
            });
          }, timeoutMs);
        });
      },
      {
        idleLabel: IDLE_LABEL,
        copiedLabel: COPIED_LABEL,
        timeoutMs: FEEDBACK_MAX_MS * 2,
      }
    );

    await button.click();

    await expect(label).toHaveText(COPIED_LABEL);
    await expect(status).toHaveText(COPIED_LABEL);
    await expect(button).toHaveAttribute("data-state", "copied");

    // Der Knopf fällt innerhalb der Toleranz auf die Ruhebeschriftung zurück.
    await expect(label).toHaveText(IDLE_LABEL, { timeout: FEEDBACK_MAX_MS });

    const timing = await page.evaluate(() => window.__codeCopyTiming);
    expect(timing.copiedAt, "Kopiert! must appear after the click").not.toBe(
      null
    );
    expect(timing.resetAt, "Kopieren must come back").not.toBeNull();
    expect(
      timing.resetAt - timing.copiedAt,
      "feedback must last at least 2000 ms"
    ).toBeGreaterThanOrEqual(FEEDBACK_MIN_MS);
    expect(
      timing.resetAt - timing.copiedAt,
      "feedback must be reset within the 4000 ms tolerance"
    ).toBeLessThanOrEqual(FEEDBACK_MAX_MS);

    await expect(status).toHaveText("");
    await expect(button).not.toHaveAttribute("data-state", /.*/);
  });

  test("respects data-no-copy on the OpenSCAD block", async ({ page }) => {
    await page.goto(SCAD_PAGE);
    await waitForBinding(page);

    const pre = page.locator("pre[data-no-copy]");
    await expect(pre).toHaveCount(1);

    const source = (await pre.locator("code").textContent()).trim();
    expect(source.length).toBeGreaterThan(0);

    await expect(page.locator(WRAPPER)).toHaveCount(0);
    await expect(page.locator(BUTTON)).toHaveCount(0);
    const wrapped = await pre.evaluate(
      (element) => element.closest("[data-code-copy-wrapper]") !== null
    );
    expect(wrapped).toBe(false);
  });

  test("keeps the button in place when the code block scrolls horizontally", async ({
    page,
  }) => {
    await page.goto(DOCS_PAGE);
    await waitForButtons(page);

    const wrapper = page.locator(WRAPPER).first();
    const button = wrapper.locator(BUTTON);
    const pre = wrapper.locator("pre").first();

    // Der erste Codeblock liegt weit unten auf der Seite.
    await button.scrollIntoViewIfNeeded();
    await expect(button).toBeInViewport();

    const before = await button.boundingBox();
    expect(before).not.toBeNull();

    // Nur das `<pre>` scrollt: Überbreite erzwingen und ganz nach rechts scrollen.
    const scroll = await pre.evaluate((element) => {
      element.style.width = "180px";
      element.scrollLeft = element.scrollWidth;

      return {
        scrollLeft: element.scrollLeft,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      };
    });
    expect(scroll.scrollWidth).toBeGreaterThan(scroll.clientWidth);
    expect(scroll.scrollLeft).toBeGreaterThan(0);

    const after = await button.boundingBox();
    expect(after).not.toBeNull();
    expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
    await expect(button).toBeInViewport();
  });

  test("view-transition navigation does not duplicate buttons", async ({
    page,
  }) => {
    await page.goto(DOCS_PAGE);
    await waitForButtons(page);

    const before = await collectCounts(page);
    expect(before.buttons).toBe(before.copyable);

    await page.locator(`a[href="${NEXT_DOCS_PAGE}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`${NEXT_DOCS_PAGE}/?$`));

    // Erwartbare Blöcke und Knöpfe bleiben nach der clientseitigen Navigation deckungsgleich.
    await expect
      .poll(
        async () => {
          const counts = await collectCounts(page);
          return (
            counts.copyable > 0 &&
            counts.buttons === counts.copyable &&
            counts.wrappers === counts.copyable
          );
        },
        { timeout: 5000 }
      )
      .toBe(true);

    const after = await collectCounts(page);
    const duplicates = await page.evaluate(() => ({
      nestedWrappers: document.querySelectorAll(
        "[data-code-copy-wrapper] [data-code-copy-wrapper]"
      ).length,
      statuses: document.querySelectorAll("[data-code-copy-status]").length,
      buttonsPerWrapper: [
        ...document.querySelectorAll("[data-code-copy-wrapper]"),
      ].map(
        (wrapper) => wrapper.querySelectorAll("[data-code-copy-button]").length
      ),
    }));
    expect(duplicates.nestedWrappers).toBe(0);
    expect(duplicates.statuses).toBe(after.wrappers);
    expect(duplicates.buttonsPerWrapper.every((count) => count === 1)).toBe(
      true
    );

    // Zurück zur Ausgangsseite: die Bindung bleibt einmalig.
    await page.locator(`a[href="${DOCS_PAGE}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`${DOCS_PAGE}/?$`));
    await expect
      .poll(
        async () => {
          const counts = await collectCounts(page);
          return (
            counts.buttons === counts.copyable &&
            counts.wrappers === counts.copyable
          );
        },
        { timeout: 5000 }
      )
      .toBe(true);

    const back = await collectCounts(page);
    expect(back.buttons).toBe(back.copyable);
    expect(back.wrappers).toBe(back.copyable);
  });

  test("renders no button when the clipboard API is unavailable", async ({
    page,
  }) => {
    // Unsicherer Kontext: ohne `navigator.clipboard` entstehen weder Wrapper noch Knöpfe.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        configurable: true,
      });
    });

    await page.goto(DOCS_PAGE);
    await waitForBinding(page);

    await expect(page.locator(WRAPPER)).toHaveCount(0);
    await expect(page.locator(BUTTON)).toHaveCount(0);
  });
});
