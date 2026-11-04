/**
 * DOM-Anbindung für den globalen Kopierknopf an Codeblöcken.
 *
 * `bindCodeCopy()` ist idempotent und folgt dem Muster von `cart-dom.ts`: Astro
 * führt das gebündelte Skript bei jeder View-Transition-Navigation erneut aus.
 * Ohne Schutz würden Listener doppelt registriert und bereits aufbereitete
 * Codeblöcke ein zweites Mal umhüllt. Ein globales Flag überlebt die
 * Navigationen, der `astro:page-load`-Listener hält neue Seiten aktuell.
 */

/** Nur Blöcke mit echter Code-Auszeichnung bekommen einen Knopf (kein Inline-Code). */
const COPYABLE_CODE_SELECTOR = "pre > code";

/** Mermaid rendert seinen Inhalt clientseitig in ein `pre` – dort gehört kein Knopf hin. */
const MERMAID_SELECTOR = "pre.mermaid";

/** Opt-out für Blöcke, deren Inhalt nicht in die Zwischenablage gehört. */
const OPT_OUT_SELECTOR = "[data-no-copy]";

/** Inerte Markup-Vorlage aus `CopyCode.astro`. */
const TEMPLATE_SELECTOR = "template[data-code-copy-template]";

const WRAPPER_SELECTOR = "[data-code-copy-wrapper]";
const BUTTON_SELECTOR = "[data-code-copy-button]";
const LABEL_SELECTOR = "[data-code-copy-label]";
const STATUS_SELECTOR = "[data-code-copy-status]";

/** Beschriftung im Ruhezustand und während der Bestätigung (beide gleich breit). */
const IDLE_LABEL = "Kopieren";
const COPIED_LABEL = "Kopiert!";

/** Wert von `data-state`, solange ein Knopf seine Bestätigung zeigt. */
const FEEDBACK_STATE = "copied";

/** Wie lange die Bestätigung stehen bleibt; die E2E-Toleranz liegt bei 4000 ms. */
const FEEDBACK_DURATION_MS = 2000;

/** Globales Flag, das die Bindung wiederholte Skriptausführungen überleben lässt. */
const BOUND_FLAG = "__codeCopyDomBound";

/** Timer je Knopf, damit schnelle Klicks die Bestätigung zurücksetzen statt zu stapeln. */
const feedbackTimers = new WeakMap<HTMLElement, number>();

interface CodeCopyGlobal extends Window {
  [BOUND_FLAG]?: boolean;
}

/**
 * Prüft, ob der Browser überhaupt in die Zwischenablage schreiben kann.
 *
 * `navigator.clipboard` existiert nur in sicheren Kontexten; fehlt die API,
 * bleibt die Seite ohne Knöpfe statt mit einem wirkungslosen Knopf.
 */
const supportsClipboard = (): boolean =>
  typeof navigator !== "undefined" &&
  typeof navigator.clipboard?.writeText === "function";

/** Setzt die Bestätigung auf Knopf und Live-Region und plant das Zurücksetzen. */
const showFeedback = (button: HTMLElement, status: HTMLElement): void => {
  const label = button.querySelector<HTMLElement>(LABEL_SELECTOR);

  if (label) label.textContent = COPIED_LABEL;
  status.textContent = COPIED_LABEL;
  button.dataset.state = FEEDBACK_STATE;

  const pending = feedbackTimers.get(button);
  if (pending !== undefined) window.clearTimeout(pending);

  feedbackTimers.set(
    button,
    window.setTimeout(() => {
      if (label) label.textContent = IDLE_LABEL;
      status.textContent = "";
      delete button.dataset.state;
      feedbackTimers.delete(button);
    }, FEEDBACK_DURATION_MS)
  );
};

/** Kopiert den sichtbaren Text des Codeblocks; ohne Clipboard-API passiert nichts. */
const copyCode = async (
  pre: HTMLPreElement,
  button: HTMLElement,
  status: HTMLElement
): Promise<void> => {
  if (!supportsClipboard()) return;

  const text = pre.querySelector("code")?.textContent ?? pre.textContent ?? "";

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Verweigerte Berechtigung: kein Feedback, damit der Knopf ehrlich bleibt.
    return;
  }

  showFeedback(button, status);
};

/** Entscheidet, ob ein Codeblock einen Kopierknopf bekommen darf. */
const isCopyable = (pre: HTMLPreElement): boolean => {
  if (pre.matches(MERMAID_SELECTOR)) return false;
  if (pre.closest(OPT_OUT_SELECTOR)) return false;
  // Bereits aufbereitet (erneuter Lauf nach einer View-Transition).
  if (pre.closest(WRAPPER_SELECTOR)) return false;

  return true;
};

/** Klont die Vorlage, hängt den Codeblock hinein und verdrahtet den Klick. */
const enhancePre = (
  pre: HTMLPreElement,
  template: HTMLTemplateElement
): void => {
  const parent = pre.parentElement;
  if (!parent) return;

  const fragment = template.content.cloneNode(true) as DocumentFragment;
  const wrapper = fragment.querySelector<HTMLElement>(WRAPPER_SELECTOR);
  const button = fragment.querySelector<HTMLButtonElement>(BUTTON_SELECTOR);
  const status = fragment.querySelector<HTMLElement>(STATUS_SELECTOR);

  if (!wrapper || !button || !status) return;

  button.addEventListener("click", () => {
    void copyCode(pre, button, status);
  });

  parent.insertBefore(wrapper, pre);
  wrapper.append(pre);
};

/** Rüstet alle noch nicht aufbereiteten Codeblöcke der aktuellen Seite aus. */
const enhanceCodeBlocks = (): void => {
  if (!supportsClipboard()) return;

  const template =
    document.querySelector<HTMLTemplateElement>(TEMPLATE_SELECTOR);
  if (!template) return;

  document
    .querySelectorAll<HTMLElement>(COPYABLE_CODE_SELECTOR)
    .forEach((code) => {
      const pre = code.parentElement;
      if (!(pre instanceof HTMLPreElement)) return;
      if (!isCopyable(pre)) return;

      enhancePre(pre, template);
    });
};

/**
 * Verdrahtet den Kopierknopf einmal pro Dokument.
 *
 * Aus dem Komponenten-Skript sicher aufrufbar — wiederholte Aufrufe rüsten nur
 * neue Codeblöcke nach.
 */
export const bindCodeCopy = (): void => {
  if (typeof window === "undefined") return;

  const globalObject = window as CodeCopyGlobal;

  if (!globalObject[BOUND_FLAG]) {
    globalObject[BOUND_FLAG] = true;
    document.addEventListener("astro:page-load", enhanceCodeBlocks);
  }

  enhanceCodeBlocks();
};
