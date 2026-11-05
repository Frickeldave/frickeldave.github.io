import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

import {
  CATALOG_PATH,
  CATEGORIES,
  classifyPaths,
  isManagedPath,
  normalizePath,
  parseChangedPaths,
} from "./catalog-only.mjs";

const SCRIPT = fileURLToPath(new URL("./catalog-only.mjs", import.meta.url));

// Reale Pfade aus dem Website-Repository (Kategorien und Artikelnummern-Schema
// wie in custom_components/frickeldave_store_syncfd/const.py bzw. publish.py).
const MANAGED_IMAGES = {
  "3D": "src/assets/handmade/3D/3D35Z5/3D35Z5-01.jpg",
  EP: "src/assets/handmade/EP/EP2OE2/EP2OE2-01.jpg",
  LA: "src/assets/handmade/LA/LA10ZY/LA10ZY-01.jpg",
  SB: "src/assets/handmade/SB/SB1RT1/SB1RT1-02.png",
  WO: "src/assets/handmade/WO/WO04A3/WO04A3-01.webp",
};

function runCli(input) {
  return spawnSync(process.execPath, [SCRIPT], { input, encoding: "utf8" });
}

describe("isManagedPath", () => {
  test("akzeptiert den Katalog", () => {
    assert.equal(isManagedPath(CATALOG_PATH), true);
  });

  test("akzeptiert verwaltete Produktbilder in allen fünf Kategorien", () => {
    assert.deepEqual(CATEGORIES, ["3D", "EP", "LA", "SB", "WO"]);
    for (const [category, imagePath] of Object.entries(MANAGED_IMAGES)) {
      assert.equal(isManagedPath(imagePath), true, `${category}: ${imagePath}`);
    }
  });

  test("normalisiert einen abschließenden Slash", () => {
    assert.equal(isManagedPath(`${CATALOG_PATH}/`), true);
    assert.equal(isManagedPath(`${MANAGED_IMAGES["3D"]}//`), true);
  });

  test("lehnt fremde Website-Pfade ab", () => {
    const foreign = [
      "src/assets/handmade/3dmodels/Voron/part.stl",
      "src/assets/handmade/3dmodels/3dmodels-01.jpg",
      ".github/workflows/fd-deploy-prd.yml",
      "docs/features/store-sync.md",
      "src/types/index.d.ts",
      "package.json",
      "public/data/link-mappings.json",
      "public/data/news.json",
    ];
    for (const path of foreign) {
      assert.equal(isManagedPath(path), false, path);
    }
  });

  test("lehnt Präfix-Treffer ab", () => {
    assert.equal(isManagedPath(`${CATALOG_PATH}.bak`), false);
    assert.equal(isManagedPath(`${CATALOG_PATH}/extra`), false);
    assert.equal(isManagedPath(`${MANAGED_IMAGES["3D"]}/extra`), false);
  });

  test("verlangt exakte Kategorie-Schreibweise", () => {
    assert.equal(isManagedPath("src/assets/handmade/3d/3D35Z5/3D35Z5-01.jpg"), false);
    assert.equal(isManagedPath("src/assets/handmade/Wo/WO04A3/WO04A3-01.jpg"), false);
  });

  test("verlangt Artikelnummer mit Kategorie-Präfix und NN-Endung", () => {
    assert.equal(isManagedPath("src/assets/handmade/3D/WO04A3/WO04A3-01.jpg"), false);
    assert.equal(isManagedPath("src/assets/handmade/3D/3d35Z5/3d35Z5-01.jpg"), false);
    assert.equal(isManagedPath("src/assets/handmade/3D/3D35Z5/3D35Z5-1.jpg"), false);
    assert.equal(isManagedPath("src/assets/handmade/3D/3D35Z5/3D35Z5-001.jpg"), false);
    assert.equal(isManagedPath("src/assets/handmade/3D/3D35Z5/3D35Z5-01.JPG"), false);
    assert.equal(isManagedPath("src/assets/handmade/3D/3D35Z5/3D35Z5-01.svg"), false);
  });

  test("lehnt Traversal, absolute Pfade und Backslashes ab", () => {
    const unsafe = [
      "src/assets/handmade/3D/3D35Z5/../../EP/EP2OE2/EP2OE2-01.jpg",
      "../public/data/handmade.json",
      `${CATALOG_PATH}/../news.json`,
      "/public/data/handmade.json",
      "public\\data\\handmade.json",
      "C:\\repo\\public\\data\\handmade.json",
    ];
    for (const path of unsafe) {
      assert.equal(isManagedPath(path), false, path);
      assert.equal(normalizePath(path), null, path);
    }
  });
});

describe("classifyPaths", () => {
  test("reiner Katalog-Deploy", () => {
    const result = classifyPaths([CATALOG_PATH, ...Object.values(MANAGED_IMAGES)]);
    assert.equal(result.catalogOnly, true);
    assert.equal(result.count, 6);
    assert.deepEqual(result.offending, []);
  });

  test("gemischte Liste ist kein Katalog-Deploy", () => {
    const result = classifyPaths([CATALOG_PATH, "docs/features/store-sync.md"]);
    assert.equal(result.catalogOnly, false);
    assert.equal(result.count, 2);
    assert.deepEqual(result.offending, ["docs/features/store-sync.md"]);
  });

  test("leere Liste ist kein Katalog-Deploy", () => {
    assert.equal(classifyPaths([]).catalogOnly, false);
    assert.equal(classifyPaths(undefined).catalogOnly, false);
  });

  test("parseChangedPaths ignoriert Leerzeilen und CRLF", () => {
    assert.deepEqual(parseChangedPaths(`${CATALOG_PATH}\r\n\n${MANAGED_IMAGES.EP}\n`), [
      CATALOG_PATH,
      MANAGED_IMAGES.EP,
    ]);
  });
});

describe("CLI", () => {
  test("exit 0 bei ausschließlich verwalteten Pfaden", () => {
    const result = runCli([CATALOG_PATH, MANAGED_IMAGES.WO, ""].join("\n"));
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Katalog-Check/);
  });

  test("exit 1 und stderr-Hinweis bei fremden Pfaden", () => {
    const result = runCli([CATALOG_PATH, "public/data/news.json"].join("\n"));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /nicht verwaltet/);
    assert.match(result.stderr, /public\/data\/news\.json/);
  });

  test("exit 1 bei leerer Liste", () => {
    const result = runCli("");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /keine geänderten Pfade/);
  });
});
