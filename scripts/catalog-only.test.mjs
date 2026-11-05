import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

import {
  CATALOG_PATH,
  CATEGORIES,
  CLASSIFICATIONS,
  SITE_ROOT_FILES,
  classifyPaths,
  isManagedPath,
  isNeutralPath,
  isSitePath,
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

function runCliWithArgs(input, args = []) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { input, encoding: "utf8" });
}

function runCli(input) {
  return runCliWithArgs(input);
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

describe("isSitePath", () => {
  test("alles unter src/ ist seitenrelevant", () => {
    const site = [
      "src/types/index.d.ts",
      "src/pages/index.astro",
      "src/assets/handmade/3dmodels/Voron/part.stl",
      "src/assets/handmade/unknown/x.jpg",
      "src",
    ];
    for (const path of site) {
      assert.equal(isSitePath(path), true, path);
    }
  });

  test("public/ ist seitenrelevant außer dem verwalteten Katalog", () => {
    const site = [
      "public/data/news.json",
      "public/data/link-mappings.json",
      "public/social-link-tree.json",
      "public/robots.txt",
      "public/CNAME",
      "public/downloads/rechnung.pdf",
      "public",
    ];
    for (const path of site) {
      assert.equal(isSitePath(path), true, path);
    }
    assert.equal(isSitePath(CATALOG_PATH), false);
    assert.equal(isManagedPath(CATALOG_PATH), true);
  });

  test("Root-Build-Eingaben sind seitenrelevant", () => {
    assert.deepEqual(
      [...SITE_ROOT_FILES].sort(),
      [
        "astro.config.mjs",
        "package-lock.json",
        "package.json",
        "postcss.config.js",
        "tailwind.config.js",
        "tailwind.config.mjs",
        "tsconfig.json",
        "wrangler.jsonc",
      ],
    );
    for (const path of SITE_ROOT_FILES) {
      assert.equal(isSitePath(path), true, path);
    }
  });

  test("scripts/build-* und scripts/install-* sind seitenrelevant", () => {
    const site = [
      "scripts/build-scad.mjs",
      "scripts/build-assets.mjs",
      "scripts/install-openscad.mjs",
      "scripts/build-",
      "scripts/install-x",
    ];
    for (const path of site) {
      assert.equal(isSitePath(path), true, path);
    }
    assert.equal(isSitePath("scripts/catalog-only.mjs"), false);
    assert.equal(isSitePath("scripts/README.md"), false);
    assert.equal(isSitePath("scripts/builder.mjs"), false);
    assert.equal(isSitePath("scripts/workflows/podcast-update/generate-metadata.mjs"), false);
  });

  test("Repository-Tooling, Dokumentation und Tests sind deploy-neutral", () => {
    const neutral = [
      "docs/features/fr008-ha-manager.md",
      ".squad/decisions.md",
      ".squad/agents/nick/charter.md",
      ".github/workflows/fd-deploy-prd.yml",
      ".husky/pre-push",
      "test/e2e/site.spec.ts",
      "README.md",
      "CHANGELOG.md",
      ".vale.ini",
      "eslint.config.mjs",
      "commitlint.config.js",
      "playwright.config.js",
      "LICENSE",
      "metadata.json",
      "test-deploy.txt",
    ];
    for (const path of neutral) {
      assert.equal(isSitePath(path), false, path);
      assert.equal(isNeutralPath(path), true, path);
    }
  });

  test("nicht auswertbare Pfade gelten fail-closed als seitenrelevant", () => {
    const unsafe = [
      "../src/types/index.d.ts",
      "src/../public/data/news.json",
      "/src/types/index.d.ts",
      "src\\types\\index.d.ts",
      "C:\\repo\\src\\types\\index.d.ts",
      "",
    ];
    for (const path of unsafe) {
      assert.equal(isSitePath(path), true, path);
      assert.equal(isNeutralPath(path), false, path);
    }
  });

  test("verwaltete Bilder sind keine seitenrelevanten Pfade", () => {
    for (const imagePath of Object.values(MANAGED_IMAGES)) {
      assert.equal(isSitePath(imagePath), false, imagePath);
      assert.equal(isNeutralPath(imagePath), false, imagePath);
    }
  });
});

describe("classifyPaths", () => {
  test("nur verwaltete Pfade: catalog_only und promote_safe", () => {
    const result = classifyPaths([CATALOG_PATH, ...Object.values(MANAGED_IMAGES)]);
    assert.equal(result.catalog_only, true);
    assert.equal(result.promote_safe, true);
    assert.equal(result.files, 6);
    assert.equal(result.managed, 6);
    assert.equal(result.neutral, 0);
    assert.deepEqual(result.site, []);
    assert.equal(result.classification, CLASSIFICATIONS.CATALOG);
  });

  test("Katalog plus Docs/.squad/.github/CHANGELOG: promote_safe, aber nicht catalog_only", () => {
    const paths = [
      CATALOG_PATH,
      "docs/features/fr008-ha-manager.md",
      ".squad/decisions.md",
      ".github/workflows/fd-deploy-prd.yml",
      "CHANGELOG.md",
    ];
    const result = classifyPaths(paths);
    assert.equal(result.promote_safe, true);
    assert.equal(result.catalog_only, false);
    assert.equal(result.files, 5);
    assert.equal(result.managed, 1);
    assert.equal(result.neutral, 4);
    assert.deepEqual(result.site, []);
    assert.equal(result.classification, CLASSIFICATIONS.CATALOG_NEUTRAL);
    assert.match(result.summary, /Katalog plus 4 unkritische Pfad/);
  });

  test("Katalog plus src/: kein Fast-Path", () => {
    const result = classifyPaths([CATALOG_PATH, "src/types/index.d.ts"]);
    assert.equal(result.catalog_only, false);
    assert.equal(result.promote_safe, false);
    assert.equal(result.managed, 1);
    assert.deepEqual(result.site, ["src/types/index.d.ts"]);
    assert.equal(result.classification, CLASSIFICATIONS.SITE);
    assert.match(result.summary, /seitenrelevante Pfade: src\/types\/index\.d\.ts/);
  });

  test("Katalog plus public/data/news.json: kein Fast-Path", () => {
    const result = classifyPaths([CATALOG_PATH, "public/data/news.json"]);
    assert.equal(result.catalog_only, false);
    assert.equal(result.promote_safe, false);
    assert.deepEqual(result.site, ["public/data/news.json"]);
  });

  test("Katalog plus Root-Build-Eingaben: kein Fast-Path", () => {
    const buildInputs = [
      "package.json",
      "package-lock.json",
      "astro.config.mjs",
      "tailwind.config.mjs",
      "tsconfig.json",
      "postcss.config.js",
      "tailwind.config.js",
      "wrangler.jsonc",
    ];
    for (const path of buildInputs) {
      const result = classifyPaths([CATALOG_PATH, path]);
      assert.equal(result.promote_safe, false, path);
      assert.equal(result.catalog_only, false, path);
      assert.equal(result.classification, CLASSIFICATIONS.SITE, path);
    }
  });

  test("Katalog plus scripts/build-scad.mjs: kein Fast-Path", () => {
    const result = classifyPaths([CATALOG_PATH, "scripts/build-scad.mjs"]);
    assert.equal(result.promote_safe, false);
    assert.deepEqual(result.site, ["scripts/build-scad.mjs"]);
  });

  test("nur Docs ohne Katalogpfad: kein Fast-Path", () => {
    const result = classifyPaths([
      ".squad/decisions.md",
      "CHANGELOG.md",
      "docs/features/fr008-ha-manager.md",
    ]);
    assert.equal(result.promote_safe, false);
    assert.equal(result.catalog_only, false);
    assert.equal(result.managed, 0);
    assert.equal(result.neutral, 3);
    assert.deepEqual(result.site, []);
    assert.equal(result.classification, CLASSIFICATIONS.NO_CATALOG);
    assert.match(result.summary, /kein Katalogpfad enthalten/);
  });

  test("leere Liste ist kein Katalog-Deploy", () => {
    for (const input of [[], undefined, null, ""]) {
      const result = classifyPaths(input);
      assert.equal(result.promote_safe, false);
      assert.equal(result.catalog_only, false);
      assert.equal(result.classification, CLASSIFICATIONS.EMPTY);
      assert.match(result.summary, /keine geänderten Pfade/);
    }
  });

  test("site-Liste ist sortiert, die Zusammenfassung zeigt maximal fünf Pfade", () => {
    const paths = [
      CATALOG_PATH,
      "src/z.ts",
      "src/a.ts",
      "public/robots.txt",
      "package.json",
      "scripts/build-x.mjs",
      "src/m.ts",
    ];
    const result = classifyPaths(paths);
    assert.deepEqual(result.site, [...result.site].sort());
    assert.equal(result.site.length, 6);
    assert.match(result.summary, /src\/a\.ts/);
    assert.match(result.summary, /und 1 weitere/);
  });

  test("nicht auswertbare Pfade machen den Fast-Path unmöglich", () => {
    const result = classifyPaths([CATALOG_PATH, "../src/types/index.d.ts"]);
    assert.equal(result.promote_safe, false);
    assert.deepEqual(result.site, ["../src/types/index.d.ts"]);
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
    assert.match(result.stdout, /ausschließlich verwaltete/);
  });

  test("exit 0 bei Katalog plus unkritischen Pfaden", () => {
    const result = runCli(
      [
        CATALOG_PATH,
        ".squad/decisions.md",
        "CHANGELOG.md",
        "docs/features/fr008-ha-manager.md",
      ].join("\n"),
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Katalog plus 3 unkritische Pfad/);
  });

  test("exit 1 und seitenrelevanter Pfad im stderr-Hinweis", () => {
    const result = runCli([CATALOG_PATH, "public/data/news.json"].join("\n"));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /seitenrelevante Pfade/);
    assert.match(result.stderr, /public\/data\/news\.json/);
  });

  test("exit 1 ohne Katalogpfad", () => {
    const result = runCli(["docs/features/fr008-ha-manager.md", "CHANGELOG.md"].join("\n"));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /kein Katalogpfad enthalten/);
  });

  test("exit 1 bei leerer Liste", () => {
    const result = runCli("");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /keine geänderten Pfade/);
  });

  test("--mode=is-managed verlangt weiterhin den reinen Katalog-Diff", () => {
    const mixed = runCliWithArgs(
      [CATALOG_PATH, "docs/features/fr008-ha-manager.md"].join("\n"),
      ["--mode=is-managed"],
    );
    assert.equal(mixed.status, 1, mixed.stderr);
    assert.match(mixed.stderr, /kein reiner Katalog-Diff/);
    assert.match(mixed.stderr, /docs\/features\/fr008-ha-manager\.md/);

    const pure = runCliWithArgs(CATALOG_PATH, ["--mode=is-managed"]);
    assert.equal(pure.status, 0, pure.stderr);
  });

  test("--json liefert die vollständige Klassifikation", () => {
    const result = runCliWithArgs(
      [CATALOG_PATH, "docs/features/fr008-ha-manager.md"].join("\n"),
      ["--json"],
    );
    assert.equal(result.status, 0, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.catalog_only, false);
    assert.equal(parsed.promote_safe, true);
    assert.equal(parsed.managed, 1);
    assert.equal(parsed.neutral, 1);
    assert.equal(parsed.files, 2);
    assert.equal(parsed.classification, CLASSIFICATIONS.CATALOG_NEUTRAL);
  });

  test("unbekanntes Argument bricht mit exit 1 ab", () => {
    const result = runCliWithArgs(CATALOG_PATH, ["--nope"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Unbekanntes Argument/);
  });
});
