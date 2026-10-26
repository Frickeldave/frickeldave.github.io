/**
 * DOM-Anbindung für den Handmade-Warenkorb.
 *
 * Bewusst getrennt von `cart.ts`, damit die Speicherlogik frei von Browser-Abfragen
 * bleibt und für sich betrachtet (und getestet) werden kann.
 *
 * `bindCartDom()` ist idempotent: es schützt davor, dass Astro das gebündelte Skript
 * bei jeder View-Transition-Navigation erneut ausführt, was sonst doppelte
 * `document`-Klick-Listener stapeln und Artikel pro Klick zweimal hinzufügen würde.
 */

import { CART_UPDATED_EVENT, addToCart, getCartItemCount } from "./cart";

/** Wie lange die Bestätigung auf einem Button stehen bleibt. */
const FEEDBACK_DURATION_MS = 2000;

/** Wert von `data-state`, solange ein Button seine Bestätigung zeigt. */
const FEEDBACK_STATE = "added";

/** Globales Flag, das die Bindung wiederholte Skriptausführungen überleben lässt. */
const BOUND_FLAG = "__handmadeCartDomBound";

/** Timer je Button, damit schnelle Klicks die Bestätigung zurücksetzen statt zu stapeln. */
const feedbackTimers = new WeakMap<HTMLElement, number>();

interface CartGlobal extends Window {
  [BOUND_FLAG]?: boolean;
}

/**
 * Spiegelt die aktuelle Warenkorbgröße in jedes `[data-cart-count]`-Badge, zeigt
 * `[data-cart-hide-when-empty]`-Elemente und hält den zugänglichen Namen von
 * `[data-cart-link]` synchron.
 */
export const refreshCartBadges = (): void => {
  const total = getCartItemCount();

  document
    .querySelectorAll<HTMLElement>("[data-cart-count]")
    .forEach((badge) => {
      badge.textContent = String(total);
      badge.hidden = total === 0;
    });

  // Header-Einträge, die erst Sinn ergeben, wenn der Warenkorb etwas enthält.
  document
    .querySelectorAll<HTMLElement>("[data-cart-hide-when-empty]")
    .forEach((element) => {
      element.hidden = total === 0;
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

/**
 * Schaltet einen Button zwischen Warenkorb-Icon und Häkchen um.
 *
 * Das Label bleibt bewusst unangetastet: ein Tausch würde die Buttonbreite ändern
 * und die Preiszeile neu umbrechen, die er sich in der Produktkarte teilt.
 */
const setIconState = (button: HTMLElement, added: boolean): void => {
  button
    .querySelector<SVGElement>('[data-add-to-cart-icon="cart"]')
    ?.classList.toggle("hidden", added);
  button
    .querySelector<SVGElement>('[data-add-to-cart-icon="done"]')
    ?.classList.toggle("hidden", !added);
};

/** Schaltet einen Button kurz in seinen Bestätigungszustand. */
const showButtonFeedback = (button: HTMLElement, productName: string): void => {
  const status = button.querySelector<HTMLElement>("[data-add-to-cart-status]");

  if (status) {
    status.textContent = `${productName} wurde in den Warenkorb gelegt.`;
  }

  setIconState(button, true);
  button.dataset.state = FEEDBACK_STATE;

  const pending = feedbackTimers.get(button);
  if (pending !== undefined) window.clearTimeout(pending);

  feedbackTimers.set(
    button,
    window.setTimeout(() => {
      setIconState(button, false);
      delete button.dataset.state;
      feedbackTimers.delete(button);
    }, FEEDBACK_DURATION_MS)
  );
};

/** Delegierter Klick-Handler für jeden „In den Warenkorb“-Button der Seite. */
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
 * Verdrahtet die Warenkorb-UI einmal pro Dokument.
 *
 * Aus jedem Komponenten-Skript sicher aufrufbar — wiederholte Aufrufe frischen nur den Zustand auf.
 */
export const bindCartDom = (): void => {
  if (typeof window === "undefined") return;

  const globalObject = window as CartGlobal;

  if (!globalObject[BOUND_FLAG]) {
    globalObject[BOUND_FLAG] = true;

    document.addEventListener("click", handleCartClick);
    document.addEventListener("astro:page-load", refreshCartBadges);
    window.addEventListener(CART_UPDATED_EVENT, refreshCartBadges);
    // Andere Tabs synchron halten, wenn der Warenkorb anderswo geändert wird.
    window.addEventListener("storage", refreshCartBadges);
  }

  refreshCartBadges();
};
