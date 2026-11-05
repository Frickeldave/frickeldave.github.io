// Klassifiziert geänderte Pfade für den Produktions-Deploy: Ist die Änderung
// ausschließlich Katalog-/Produktbild-Material, darf sie ohne Versions-Bump nach
// main? Die Allowlist spiegelt exakt `_is_managed_path`/`_MANAGED_IMAGE_RE` aus
// custom_components/frickeldave_store_syncfd/publish.py (Home-Assistant-Integration).
// Alles andere — insbesondere `3dmodels/**`, `public/data/news.json` und
// `public/data/link-mappings.json` — gehört der Website selbst und ist kein
// Katalog-Deploy.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const CATALOG_PATH = "public/data/handmade.json";
export const CATEGORIES = ["3D", "EP", "LA", "SB", "WO"];

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
  const offending = list.filter((path) => !isManagedPath(path));
  return {
    count: list.length,
    managed: list.length - offending.length,
    offending,
    catalogOnly: list.length > 0 && offending.length === 0,
  };
}

function formatFailure(result) {
  if (result.count === 0) {
    return "❌ Katalog-Check fehlgeschlagen: keine geänderten Pfade — kein reiner Katalog-Deploy.\n";
  }
  const preview = result.offending.slice(0, 5);
  const lines = [
    `❌ Katalog-Check fehlgeschlagen: ${result.count} geänderte(r) Pfad(e), ` +
      `davon ${result.offending.length} nicht verwaltet — kein reiner Katalog-Deploy.`,
    "Nicht verwaltete Pfade (max. 5):",
    ...preview.map((path) => `  - ${path}`),
  ];
  if (result.offending.length > preview.length) {
    lines.push(`  … und ${result.offending.length - preview.length} weitere`);
  }
  return `${lines.join("\n")}\n`;
}

export async function runCli() {
  const input = readFileSync(0, "utf8");
  const result = classifyPaths(parseChangedPaths(input));
  if (result.catalogOnly) {
    process.stdout.write(
      `✅ Katalog-Check: ${result.count} geänderte(r) Pfad(e), ausschließlich verwaltete Katalog- und Produktbilddateien.\n`,
    );
    return 0;
  }
  process.stderr.write(formatFailure(result));
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
