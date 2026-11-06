// Klassifiziert geänderte Pfade für den Produktions-Deploy: Dürfen Katalogänderungen
// ohne Versions-Bump nach main? Zwei Fragen werden getrennt beantwortet:
//
//   catalog_only  — besteht der Diff ausschließlich aus verwaltetem Katalogmaterial?
//                   Die Allowlist spiegelt exakt `_is_managed_path`/`_MANAGED_IMAGE_RE`
//                   aus custom_components/frickeldave_store_syncfd/publish.py.
//   promote_safe  — enthält der Diff mindestens einen Katalogpfad und keinen
//                   seitenrelevanten Pfad? Deploy-neutrale Pfade (Docs, .squad,
//                   .github, Tests, Changelog …) sind erlaubt, weil sie das gebaute
//                   Seitenartefakt nicht verändern. Nur dieser Wert entscheidet im
//                   Workflow über den Fast-Path.
//
// Seitenrelevant (`isSitePath`) ist bewusst eine explizite Deny-List:
//   * `src/**` (Seitenquellen, Komponenten, Bilder) — vollständig.
//   * `public/**` außer `public/data/handmade.json` (verwaltet). Astro kopiert
//     `public/` unverändert ins Build-Ergebnis, jede Änderung dort ist sichtbar.
//   * Root-Build-Eingaben: `astro.config.mjs`, `tailwind.config.js`,
//     `tailwind.config.mjs`, `postcss.config.js`, `tsconfig.json`, `package.json`,
//     `package-lock.json`, `wrangler.jsonc`.
//   * `scripts/build-*` und `scripts/install-*` (erzeugen/installieren Build-Artefakte).
//
// Alles andere gilt als deploy-neutral (fail-open für bekanntes Repository-Tooling):
// `docs/**`, `.squad/**`, `.github/**`, `.husky/**`, `test/**`, `scripts/*` außer
// build-/install-Präfix, `README.md`, `CHANGELOG.md`, `.vale*`, ESLint-/Commitlint-/
// Prettier-Configs, `LICENSE`, `metadata.json`. Diese Liste ist die einzige
// Erweiterungsstelle: Ein neuer Build-Eingang muss oben ergänzt werden, sonst würde
// er als neutral durchgehen.
//
// Fail-closed gilt dagegen für Pfade, die gar nicht sicher ausgewertet werden können
// (Traversal, absolute Pfade, Backslashes): Sie sind weder verwaltet noch neutral und
// werden als seitenrelevant behandelt.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const CATALOG_PATH = "public/data/handmade.json";
export const CATEGORIES = ["3D", "EP", "LA", "SB", "WO"];

/** Root-Dateien, die den Build der Seite direkt beeinflussen. */
export const SITE_ROOT_FILES = new Set([
  "astro.config.mjs",
  "tailwind.config.js",
  "tailwind.config.mjs",
  "postcss.config.js",
  "tsconfig.json",
  "package.json",
  "package-lock.json",
  "wrangler.jsonc",
]);

/** Skript-Präfixe, deren Änderungen generierte Seitenassets beeinflussen. */
export const SITE_SCRIPT_PREFIXES = ["scripts/build-", "scripts/install-"];

/** Stabile Klassifikationen für Workflow-Ausgaben und Notices. */
export const CLASSIFICATIONS = {
  EMPTY: "kein-diff",
  NO_CATALOG: "kein-katalogpfad",
  SITE: "seitenrelevant",
  CATALOG: "nur-katalog",
  CATALOG_NEUTRAL: "katalog-plus-unkritisch",
};

const IMAGE_SUFFIX_PATTERN = "(?:jpg|jpeg|png|webp|gif)";

// `<kategorie>/<artikelnummer>/<artikelnummer>-NN.<endung>`: Die Artikelnummer muss
// mit ihrer Kategorie beginnen (Backreference), jede tiefere Ebene ist fremd.
const MANAGED_IMAGE_RE = new RegExp(
  `^src/assets/handmade/(?<category>${CATEGORIES.join("|")})` +
    `/(?<article>\\k<category>[A-Z0-9]{1,5})` +
    `/\\k<article>-\\d{2}\\.${IMAGE_SUFFIX_PATTERN}$`,
);

/**
 * Normalisiert einen von `git diff --name-only` gelieferten Pfad.
 * Gibt `null` zurück, wenn der Pfad nicht sicher ausgewertet werden darf.
 */
export function normalizePath(path) {
  if (typeof path !== "string" || path.length === 0) return null;
  if (path.includes("\\")) return null;
  if (path.startsWith("/")) return null;
  if (/^[A-Za-z]:/.test(path)) return null;

  const trimmed = path.replace(/\/+$/, "");
  if (trimmed.length === 0) return null;

  const segments = trimmed.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    return null;
  }

  return trimmed;
}

/** True, wenn der Pfad zur verwalteten Katalog-/Bildmenge gehört. */
export function isManagedPath(path) {
  const normalized = normalizePath(path);
  if (normalized === null) return false;
  return normalized === CATALOG_PATH || MANAGED_IMAGE_RE.test(normalized);
}

/**
 * True, wenn der Pfad das gebaute Seitenartefakt beeinflussen kann.
 * Nicht auswertbare Pfade gelten fail-closed als seitenrelevant.
 */
export function isSitePath(path) {
  const normalized = normalizePath(path);
  if (normalized === null) return true;
  if (isManagedPath(normalized)) return false;
  if (normalized === "src" || normalized.startsWith("src/")) return true;
  if (normalized === "public" || normalized.startsWith("public/")) return true;
  if (SITE_ROOT_FILES.has(normalized)) return true;
  if (SITE_SCRIPT_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return true;
  return false;
}

/** True, wenn der Pfad deploy-neutral ist (weder verwaltet noch seitenrelevant). */
export function isNeutralPath(path) {
  const normalized = normalizePath(path);
  if (normalized === null) return false;
  return !isManagedPath(normalized) && !isSitePath(normalized);
}

/** Teilt eine newline-separierte Pfadliste in einzelne Pfade. */
export function parseChangedPaths(text) {
  return String(text)
    .split("\n")
    .map((line) => line.replace(/\r$/, ""))
    .filter((line) => line.length > 0);
}

/** Klassifiziert eine Liste geänderter Pfade. */
export function classifyPaths(paths) {
  const list = Array.isArray(paths) ? paths : [];
  const managedPaths = list.filter((path) => isManagedPath(path));
  const sitePaths = list.filter((path) => isSitePath(path));
  const neutralPaths = list.filter((path) => !isManagedPath(path) && !isSitePath(path));

  const files = list.length;
  const catalog_only = files > 0 && managedPaths.length === files;
  const promote_safe = managedPaths.length > 0 && sitePaths.length === 0;

  let classification;
  if (files === 0) classification = CLASSIFICATIONS.EMPTY;
  else if (promote_safe) {
    classification = catalog_only ? CLASSIFICATIONS.CATALOG : CLASSIFICATIONS.CATALOG_NEUTRAL;
  } else if (managedPaths.length === 0) classification = CLASSIFICATIONS.NO_CATALOG;
  else classification = CLASSIFICATIONS.SITE;

  const result = {
    catalog_only,
    promote_safe,
    managed: managedPaths.length,
    neutral: neutralPaths.length,
    site: [...sitePaths].sort(),
    files,
    classification,
    // Kompatibilität für ältere Aufrufer von classifyPaths().
    count: files,
    catalogOnly: catalog_only,
    offending: list.filter((path) => !isManagedPath(path)),
  };
  result.summary = summarize(result);
  return result;
}

/** Einzeilige deutsche Zusammenfassung für Logs und CI-Notices. */
export function summarize(result) {
  if (!result || result.files === 0) {
    return "❌ Katalog-Check fehlgeschlagen: keine geänderten Pfade — kein Fast-Path, kein Katalog-Deploy.";
  }
  if (result.promote_safe) {
    if (result.catalog_only) {
      return (
        `✅ Katalog-Check: ${result.files} geänderte(r) Pfad(e), ausschließlich verwaltete ` +
        "Katalog- und Produktbilddateien — kein seitenrelevanter Pfad."
      );
    }
    return (
      `✅ Katalog-Check: ${result.files} geänderte(r) Pfad(e) — Katalog plus ` +
      `${result.neutral} unkritische Pfad(e), kein seitenrelevanter Pfad.`
    );
  }
  if (result.site.length > 0) {
    const preview = result.site.slice(0, 5).join(", ");
    const more = result.site.length > 5 ? ` … und ${result.site.length - 5} weitere` : "";
    return (
      `❌ Katalog-Check fehlgeschlagen: seitenrelevante Pfade: ${preview}${more} — ` +
      "Release erforderlich, kein Fast-Path."
    );
  }
  return (
    "❌ Katalog-Check fehlgeschlagen: kein Katalogpfad enthalten — " +
    "kein Katalog-Deploy ohne Versions-Bump."
  );
}

const MODES = new Set(["promote-safe", "is-managed"]);

/** Strengere Zusammenfassung für den Modus `is-managed` (nur reiner Katalog-Diff). */
export function summarizeManagedOnly(result) {
  if (!result || result.files === 0 || result.catalog_only) return summarize(result);
  const preview = result.offending.slice(0, 5).join(", ");
  const more = result.offending.length > 5 ? ` … und ${result.offending.length - 5} weitere` : "";
  return (
    `❌ Katalog-Check fehlgeschlagen (Modus is-managed): ${result.offending.length} nicht ` +
    `verwaltete(r) Pfad(e): ${preview}${more} — kein reiner Katalog-Diff.`
  );
}

function parseArgs(argv) {
  const options = { mode: "promote-safe", json: false };
  for (const arg of argv.slice(2)) {
    if (arg === "--json") options.json = true;
    else if (arg.startsWith("--mode=")) {
      const mode = arg.slice("--mode=".length);
      if (!MODES.has(mode)) throw new Error(`Unbekannter Modus: ${mode}`);
      options.mode = mode;
    } else {
      throw new Error(`Unbekanntes Argument: ${arg}`);
    }
  }
  return options;
}

export async function runCli(argv = process.argv) {
  const options = parseArgs(argv);
  const input = readFileSync(0, "utf8");
  const result = classifyPaths(parseChangedPaths(input));

  // `is-managed` bildet das alte, strengere Verhalten ab: nur der reine Katalog-Diff
  // gilt als Erfolg. Der Standardmodus ist der Fast-Path inklusive neutraler Pfade.
  const ok = options.mode === "is-managed" ? result.catalog_only : result.promote_safe;
  const summary = options.mode === "is-managed" ? summarizeManagedOnly(result) : result.summary;

  if (options.json) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return 0;
  }

  if (ok) {
    process.stdout.write(`${summary}\n`);
    return 0;
  }
  process.stderr.write(`${summary}\n`);
  return 1;
}

const isMain =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  runCli()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      process.stderr.write(`❌ Katalog-Check fehlgeschlagen: ${error?.message ?? error}\n`);
      process.exitCode = 1;
    });
}
