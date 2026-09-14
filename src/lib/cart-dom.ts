/**
 * DOM glue for the Handmade cart.
 *
 * Kept separate from `cart.ts` so the storage logic stays free of browser
 * queries and can be reasoned about (and tested) on its own.
 *
 * `bindCartDom()` is idempotent: it guards against Astro re-executing the
 * bundled script on every view-transition navigation, which would otherwise
 * stack duplicate `document` click listeners and add items twice per click.
 */

import { CART_UPDATED_EVENT, addToCart, getCartItemCount } from "./cart";

/** How long the "Hinzugefügt" confirmation stays on a button. */
const FEEDBACK_DURATION_MS = 2000;

/** Global flag that makes the binding survive repeated script execution. */
const BOUND_FLAG = "__handmadeCartDomBound";

/** Label of the "add to cart" button while the confirmation is showing. */
const FEEDBACK_LABEL = "✓ Hinzugefügt";

/** Timers per button, so rapid clicks reset rather than stack the confirmation. */
const feedbackTimers = new WeakMap<HTMLElement, number>();

interface CartGlobal extends Window {
  [BOUND_FLAG]?: boolean;
}

/**
 * Reflect the current cart size in every `[data-cart-count]` badge and keep the
 * accessible name of `[data-cart-link]` in sync.
 */
export const refreshCartBadges = (): void => {
  const total = getCartItemCount();

  document
    .querySelectorAll<HTMLElement>("[data-cart-count]")
    .forEach((badge) => {
      badge.textContent = String(total);
      badge.hidden = total === 0;
    });

  document
    .querySelectorAll<HTMLAnchorElement>("[data-cart-link]")
    .forEach((link) => {
      const base = link.dataset.cartLinkLabel ?? "Warenkorb";
      link.setAttribute(
        "aria-label",
        total === 0 ? base : `${base} (${total} Artikel)`
      );
    });
};

/** Briefly swap the button label for a confirmation. */
const showButtonFeedback = (button: HTMLElement, productName: string): void => {
  const label = button.querySelector<HTMLElement>("[data-add-to-cart-label]");
  const status = button.querySelector<HTMLElement>("[data-add-to-cart-status]");

  if (status) {
    status.textContent = `${productName} wurde in den Warenkorb gelegt.`;
  }

  if (!label) return;

  button.dataset.defaultLabel ??= label.textContent ?? "";
  label.textContent = FEEDBACK_LABEL;

  const pending = feedbackTimers.get(button);
  if (pending !== undefined) window.clearTimeout(pending);

  feedbackTimers.set(
    button,
    window.setTimeout(() => {
      label.textContent = button.dataset.defaultLabel ?? "";
      feedbackTimers.delete(button);
    }, FEEDBACK_DURATION_MS)
  );
};

/** Delegated click handler for every "add to cart" button on the page. */
const handleCartClick = (event: MouseEvent): void => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const button = target.closest<HTMLElement>("[data-add-to-cart]");
  if (!button) return;

  const articleNumber = button.dataset.articleNumber;
  if (!articleNumber) return;

  event.preventDefault();

  const quantity = Number(button.dataset.quantity ?? "1");
  addToCart(
    articleNumber,
    Number.isFinite(quantity) && quantity > 0 ? quantity : 1
  );

  showButtonFeedback(button, button.dataset.productName ?? "Der Artikel");
};

/**
 * Wire up the cart UI once per document.
 *
 * Safe to call from any component script — repeated calls only refresh state.
 */
export const bindCartDom = (): void => {
  if (typeof window === "undefined") return;

  const globalObject = window as CartGlobal;

  if (!globalObject[BOUND_FLAG]) {
    globalObject[BOUND_FLAG] = true;

    document.addEventListener("click", handleCartClick);
    document.addEventListener("astro:page-load", refreshCartBadges);
    window.addEventListener(CART_UPDATED_EVENT, refreshCartBadges);
    // Keep other tabs in sync when the cart changes somewhere else.
    window.addEventListener("storage", refreshCartBadges);
  }

  refreshCartBadges();
};
