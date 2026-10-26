/**
 * Clientseitiger Warenkorb für den Handmade-Katalog.
 *
 * Der Warenkorb lebt vollständig im Browser — kein Server, kein Drittanbieter,
 * keine Netzwerkübertragung des Warenkorbinhalts. Der fertige Warenkorb wird über
 * einen `mailto:`-Link an das Mailprogramm des Besuchers übergeben.
 *
 * Nur `articleNumber` + `quantity` werden in `localStorage` gespeichert.
 * Produktdetails (Name, Preis) kommen zur Renderzeit aus `/data/handmade.json`,
 * damit der Warenkorb nach einem Katalog-Update nie veraltete Preise zeigt.
 *
 * Alle Funktionen sind während des SSR sicher aufrufbar — ohne `window` liefern
 * sie leere Ergebnisse, statt zu werfen.
 */

import { formatPrice } from "./formatPrice";

/** `localStorage`-Schlüssel für die serialisierten Warenkorbzeilen. */
export const CART_STORAGE_KEY = "frickeldave:handmade-cart";

/** Wird bei jeder Änderung des Warenkorbinhalts auf `window` ausgelöst. */
export const CART_UPDATED_EVENT = "handmade:cart-updated";

/** Empfänger der Warenkorb-Mail. */
export const CART_EMAIL = "handmade@frickeldave.de";

/** Kanonischer Pfad der Warenkorbseite, genutzt von Skripten und Navigation. */
export const CART_PAGE_PATH = "/handmade/warenkorb";

/** Obergrenze für die Menge einer einzelnen Zeile. */
export const MAX_LINE_QUANTITY = 99;

/**
 * Mailprogramme und Browser kürzen `mailto:`-URLs bei etwa 2000 Zeichen,
 * deshalb wird alles darüber als `tooLong` gemeldet, statt still abgeschnitten
 * zu werden.
 */
export const MAILTO_LENGTH_LIMIT = 1900;

/** Eine einzelne persistierte Warenkorbzeile. */
export interface CartLine {
  articleNumber: string;
  quantity: number;
}

/** Die Produktdaten, die zum Anzeigen und Bepreisen einer Warenkorbzeile nötig sind. */
export interface CartProduct {
  articleNumber: string;
  name: string;
  price: number;
}

/** Eine Warenkorbzeile zusammen mit ihren aufgelösten Produktdaten. */
export interface DetailedCartLine extends CartLine {
  product: CartProduct;
  lineTotal: number;
}

/** Vollständig aufgelöster Warenkorb, bereit zum Rendern. */
export interface CartSummary {
  lines: DetailedCartLine[];
  /** Summe aller Mengen. */
  itemCount: number;
  /** Summe aller Zeilensummen, in Euro. */
  total: number;
}

/** Optionale Besucherdaten für die Warenkorb-Mail. */
export interface CartMailtoOptions {
  name?: string;
  email?: string;
  message?: string;
}

/** Ergebnis des Baus des Warenkorb-Mail-Links. */
export interface CartMailtoResult {
  url: string;
  subject: string;
  body: string;
  /** Wahr, wenn die mailto-URL {@link MAILTO_LENGTH_LIMIT} überschreitet. */
  tooLong: boolean;
}

/** Minimale Form eines Eintrags in `/data/handmade.json`. */
interface RawHandmadeProduct {
  articleNumber?: unknown;
  name?: unknown;
  price?: unknown;
  visible?: unknown;
}

// ---------------------------------------------------------------------------
// Browser-Wächter
// ---------------------------------------------------------------------------

const hasWindow = (): boolean => typeof window !== "undefined";

/**
 * `localStorage`-Zugriffe werfen in manchen Privatsphäre-Modi und bei
 * erschöpftem Kontingent, deshalb ist jeder Zugriff gekapselt.
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
// Bereinigung
// ---------------------------------------------------------------------------

/** Begrenzt eine rohe Menge auf den unterstützten Ganzzahlbereich. */
export const clampQuantity = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  const int = Math.floor(parsed);
  if (int < 1) return 0;
  return Math.min(int, MAX_LINE_QUANTITY);
};

/** Reduziert einen unbekannten Wert auf eine gültige Warenkorbzeile oder `null`, wenn unbrauchbar. */
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

/** Führt doppelte Zeilen zusammen und verwirft ungültige. */
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
// Persistenz
// ---------------------------------------------------------------------------

/**
 * Liest den persistierten Warenkorb.
 *
 * Beschädigte oder fremde Payloads gelten als leerer Warenkorb statt zu werfen,
 * damit ein einzelner fehlerhafter Schreibvorgang nie den Katalog kaputt macht.
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

/** Persistiert den Warenkorb und benachrichtigt Listener. Liefert die normalisierten Zeilen. */
export const writeCart = (lines: CartLine[]): CartLine[] => {
  const normalized = normalizeLines(lines);

  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(CART_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // Speicher voll oder nicht verfügbar — der Warenkorb funktioniert für diesen Seitenaufruf trotzdem.
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
// Mutationen
// ---------------------------------------------------------------------------

/** Fügt `quantity` eines Produkts hinzu und führt mit einer bestehenden Zeile zusammen. */
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

/** Setzt eine absolute Menge. Werte unter 1 entfernen die Zeile. */
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

/** Entfernt ein Produkt aus dem Warenkorb. */
export const removeFromCart = (articleNumber: string): CartLine[] => {
  return writeCart(
    readCart().filter((line) => line.articleNumber !== articleNumber)
  );
};

/** Leert den Warenkorb. */
export const clearCart = (): CartLine[] => writeCart([]);

// ---------------------------------------------------------------------------
// Ableitung
// ---------------------------------------------------------------------------

/** Gesamtzahl der Artikel über alle Zeilen. */
export const getCartItemCount = (lines: CartLine[] = readCart()): number =>
  lines.reduce((sum, line) => sum + line.quantity, 0);

/**
 * Löst persistierte Zeilen gegen den Katalog auf.
 *
 * Zeilen, deren Artikelnummer nicht mehr im Katalog steht, werden aus der
 * Zusammenfassung entfernt, damit ein ausgelistetes Produkt die Bestell-Mail
 * nicht blockiert.
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
 * Pickt die Felder, die der Warenkorb braucht, aus dem rohen Katalog-Payload.
 *
 * `/data/handmade.json` enthält pro Produkt deutlich mehr; nur sichtbare
 * Einträge mit brauchbarem Preis nehmen am Warenkorb teil, ein verstecktes
 * Produkt fällt also still aus der Zusammenfassung.
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
// Mail-Übergabe
// ---------------------------------------------------------------------------

/** Baut die Betreffzeile der Warenkorb-Mail. */
export const buildCartMailSubject = (summary: CartSummary): string => {
  const count = summary.itemCount;
  return count === 1
    ? "Handmade Warenkorb — 1 Artikel"
    : `Handmade Warenkorb — ${count} Artikel`;
};

/** Baut den Plain-Text-Body der Warenkorb-Mail. */
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
 * Baut den `mailto:`-Link für den aktuellen Warenkorb.
 *
 * `tooLong` markiert Warenkörbe, die mehr enthalten, als Mailprogramme
 * verlässlich akzeptieren; Aufrufer sollten dann den Body zum Kopieren anbieten,
 * statt einen unbrauchbaren Link zu öffnen.
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
