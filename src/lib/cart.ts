/**
 * Client-side shopping cart for the Handmade catalog.
 *
 * The cart lives entirely in the browser — no server, no third-party service,
 * no network transfer of cart contents. The finished cart is handed to the
 * visitor's own mail client via a `mailto:` link.
 *
 * Only `articleNumber` + `quantity` are persisted to `localStorage`. Product
 * details (name, price) are resolved from `/data/handmade.json` at render time,
 * so the cart can never display stale prices after a catalog update.
 *
 * All functions are safe to call during SSR — without a `window` they degrade
 * to empty results instead of throwing.
 */

/** `localStorage` key holding the serialized cart lines. */
export const CART_STORAGE_KEY = "frickeldave:handmade-cart";

/** Dispatched on `window` whenever the cart contents change. */
export const CART_UPDATED_EVENT = "handmade:cart-updated";

/** Recipient of the cart mail. */
export const CART_EMAIL = "handmade@frickeldave.de";

/** Canonical cart page path, used by scripts and navigation. */
export const CART_PAGE_PATH = "/handmade/warenkorb";

/** Upper bound for a single line's quantity. */
export const MAX_LINE_QUANTITY = 99;

/**
 * Mail clients and browsers truncate `mailto:` URLs at roughly 2000 characters,
 * so anything above this threshold is reported as `tooLong` instead of being
 * silently cut off.
 */
export const MAILTO_LENGTH_LIMIT = 1900;

/** A single persisted cart line. */
export interface CartLine {
  articleNumber: string;
  quantity: number;
}

/** The product facts needed to display and price a cart line. */
export interface CartProduct {
  articleNumber: string;
  name: string;
  price: number;
}

/** A cart line joined with its resolved product data. */
export interface DetailedCartLine extends CartLine {
  product: CartProduct;
  lineTotal: number;
}

/** Fully resolved cart, ready for rendering. */
export interface CartSummary {
  lines: DetailedCartLine[];
  /** Sum of all quantities. */
  itemCount: number;
  /** Sum of all line totals, in euro. */
  total: number;
}

/** Optional visitor details added to the cart mail. */
export interface CartMailtoOptions {
  name?: string;
  email?: string;
  message?: string;
}

/** Result of building the cart mail link. */
export interface CartMailtoResult {
  url: string;
  subject: string;
  body: string;
  /** True when the mailto URL exceeds {@link MAILTO_LENGTH_LIMIT}. */
  tooLong: boolean;
}

/** Minimal shape of an entry in `/data/handmade.json`. */
interface RawHandmadeProduct {
  articleNumber?: unknown;
  name?: unknown;
  price?: unknown;
  visible?: unknown;
}

// ---------------------------------------------------------------------------
// Browser guards
// ---------------------------------------------------------------------------

const hasWindow = (): boolean => typeof window !== "undefined";

/**
 * `localStorage` access throws in some privacy modes and when the quota is
 * exhausted, so every access is wrapped.
 */
const getStorage = (): Storage | null => {
  if (!hasWindow()) return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Sanitizing
// ---------------------------------------------------------------------------

/** Clamp a raw quantity into the supported integer range. */
export const clampQuantity = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  const int = Math.floor(parsed);
  if (int < 1) return 0;
  return Math.min(int, MAX_LINE_QUANTITY);
};

/** Reduce an unknown value to a valid cart line, or `null` when unusable. */
const toCartLine = (value: unknown): CartLine | null => {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as { articleNumber?: unknown; quantity?: unknown };
  if (typeof candidate.articleNumber !== "string") return null;

  const articleNumber = candidate.articleNumber.trim();
  if (!articleNumber) return null;

  const quantity = clampQuantity(candidate.quantity);
  if (quantity < 1) return null;

  return { articleNumber, quantity };
};

/** Merge duplicate lines and drop invalid ones. */
const normalizeLines = (lines: CartLine[]): CartLine[] => {
  const merged = new Map<string, number>();

  for (const line of lines) {
    const next = (merged.get(line.articleNumber) ?? 0) + line.quantity;
    merged.set(line.articleNumber, Math.min(next, MAX_LINE_QUANTITY));
  }

  return [...merged].map(([articleNumber, quantity]) => ({
    articleNumber,
    quantity,
  }));
};

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/**
 * Read the persisted cart.
 *
 * Corrupted or foreign payloads are treated as an empty cart rather than
 * throwing, so a single bad write can never break the catalog.
 */
export const readCart = (): CartLine[] => {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const lines = parsed
      .map(toCartLine)
      .filter((line): line is CartLine => line !== null);

    return normalizeLines(lines);
  } catch {
    return [];
  }
};

/** Persist the cart and notify listeners. Returns the normalized lines. */
export const writeCart = (lines: CartLine[]): CartLine[] => {
  const normalized = normalizeLines(lines);

  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(CART_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // Storage full or unavailable — the cart still works for this page view.
    }
  }

  if (hasWindow()) {
    window.dispatchEvent(
      new CustomEvent<CartLine[]>(CART_UPDATED_EVENT, { detail: normalized })
    );
  }

  return normalized;
};

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Add `quantity` of a product, merging with an existing line. */
export const addToCart = (articleNumber: string, quantity = 1): CartLine[] => {
  const existing = readCart();
  const current = existing.find((line) => line.articleNumber === articleNumber);

  if (current) {
    return writeCart(
      existing.map((line) =>
        line.articleNumber === articleNumber
          ? { ...line, quantity: clampQuantity(line.quantity + quantity) }
          : line
      )
    );
  }

  return writeCart([...existing, { articleNumber, quantity }]);
};

/** Set an absolute quantity. Values below 1 remove the line. */
export const setLineQuantity = (
  articleNumber: string,
  quantity: number
): CartLine[] => {
  const clamped = clampQuantity(quantity);
  if (clamped < 1) return removeFromCart(articleNumber);

  return writeCart(
    readCart().map((line) =>
      line.articleNumber === articleNumber
        ? { ...line, quantity: clamped }
        : line
    )
  );
};

/** Remove a product from the cart. */
export const removeFromCart = (articleNumber: string): CartLine[] => {
  return writeCart(
    readCart().filter((line) => line.articleNumber !== articleNumber)
  );
};

/** Empty the cart. */
export const clearCart = (): CartLine[] => writeCart([]);

// ---------------------------------------------------------------------------
// Derivation
// ---------------------------------------------------------------------------

/** Total number of items across all lines. */
export const getCartItemCount = (lines: CartLine[] = readCart()): number =>
  lines.reduce((sum, line) => sum + line.quantity, 0);

/** Format a euro amount for the German locale. */
export const formatPrice = (value: number): string =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);

/**
 * Resolve persisted lines against the catalog.
 *
 * Lines whose article number is no longer in the catalog are dropped from the
 * summary so a discontinued product cannot stall the checkout mail.
 */
export const summarizeCart = (
  products: CartProduct[],
  lines: CartLine[] = readCart()
): CartSummary => {
  const byArticleNumber = new Map(
    products.map((product) => [product.articleNumber, product])
  );

  const detailed = lines.flatMap<DetailedCartLine>((line) => {
    const product = byArticleNumber.get(line.articleNumber);
    if (!product) return [];
    return [
      {
        articleNumber: line.articleNumber,
        quantity: line.quantity,
        product,
        lineTotal: product.price * line.quantity,
      },
    ];
  });

  return {
    lines: detailed,
    itemCount: detailed.reduce((sum, line) => sum + line.quantity, 0),
    total: detailed.reduce((sum, line) => sum + line.lineTotal, 0),
  };
};

/**
 * Pick the fields the cart needs out of the raw catalog payload.
 *
 * `/data/handmade.json` carries a lot more per product; only visible entries
 * with a usable price take part in the cart, so a hidden product silently
 * drops out of the summary.
 */
export const extractCartProducts = (payload: unknown): CartProduct[] => {
  if (typeof payload !== "object" || payload === null) return [];
  const products = (payload as { products?: unknown }).products;
  if (!Array.isArray(products)) return [];

  return products.flatMap<CartProduct>((entry: RawHandmadeProduct) => {
    if (typeof entry?.articleNumber !== "string") return [];
    if (typeof entry.name !== "string") return [];
    if (entry.visible === false) return [];

    const price = typeof entry.price === "number" ? entry.price : NaN;
    if (!Number.isFinite(price)) return [];

    return [
      {
        articleNumber: entry.articleNumber,
        name: entry.name,
        price,
      },
    ];
  });
};

// ---------------------------------------------------------------------------
// Mail hand-off
// ---------------------------------------------------------------------------

/** Build the subject line of the cart mail. */
export const buildCartMailSubject = (summary: CartSummary): string => {
  const count = summary.itemCount;
  return count === 1
    ? "Handmade Warenkorb — 1 Artikel"
    : `Handmade Warenkorb — ${count} Artikel`;
};

/** Build the plain-text body of the cart mail. */
export const buildCartMailBody = (
  summary: CartSummary,
  options: CartMailtoOptions = {}
): string => {
  const lines: string[] = [];

  lines.push("Hallo,");
  lines.push("");
  lines.push(
    "ich interessiere mich für folgende Artikel aus dem Handmade-Katalog:"
  );
  lines.push("");

  for (const line of summary.lines) {
    const unit = formatPrice(line.product.price);
    lines.push(
      `• ${line.quantity} × ${line.product.name} (${line.articleNumber}) — ${unit} je Stück = ${formatPrice(line.lineTotal)}`
    );
  }

  lines.push("");
  lines.push(
    `Gesamtsumme: ${formatPrice(summary.total)} — ${summary.itemCount} Artikel`
  );

  const hasDetails = Boolean(
    options.name?.trim() || options.email?.trim() || options.message?.trim()
  );

  if (hasDetails) {
    lines.push("");
    lines.push("---");
    if (options.name?.trim()) lines.push(`Name: ${options.name.trim()}`);
    if (options.email?.trim()) lines.push(`E-Mail: ${options.email.trim()}`);
    if (options.message?.trim()) {
      lines.push("");
      lines.push("Nachricht:");
      lines.push(options.message.trim());
    }
  }

  lines.push("");
  lines.push("--");
  lines.push("Gesendet über frickeldave.de");

  return lines.join("\n");
};

/**
 * Build the `mailto:` link for the current cart.
 *
 * `tooLong` flags carts that exceed what mail clients reliably accept; callers
 * should offer the body for copying instead of opening an unusable link.
 */
export const buildCartMailto = (
  summary: CartSummary,
  options: CartMailtoOptions = {}
): CartMailtoResult => {
  const subject = buildCartMailSubject(summary);
  const body = buildCartMailBody(summary, options);

  const url = `mailto:${CART_EMAIL}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;

  return { url, subject, body, tooLong: url.length > MAILTO_LENGTH_LIMIT };
};
