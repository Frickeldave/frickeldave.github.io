import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

import {
  ARCHIVE_PREFIX,
  DEFAULT_SOURCE_DIR,
  buildExamplefilesZip,
  collectSourceFiles,
} from "./build-examplefiles-zip.mjs";

const SCRIPT = fileURLToPath(
  new URL("./build-examplefiles-zip.mjs", import.meta.url)
);
const PROJECT_ROOT = fileURLToPath(new URL("..", import.meta.url));

// Parallele Testläufe bekommen ihr eigenes Verzeichnis, damit der Zielpfad
// nicht mit einem echten Build kollidiert. Liegt unter dem Projekt, damit
// keine Pfade außerhalb des Arbeitsverzeichnisses geschrieben werden.
const TMP_ROOT = path.join(
  PROJECT_ROOT,
  `.tmp-test-build-examplefiles-zip-${process.pid}`
);

const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const LOCAL_HEADER_SIGNATURE = 0x04034b50;

const MARKDOWN_PATTERN = /\.mdx?$/i;

function makeTempDir() {
  return fs.mkdtempSync(path.join(TMP_ROOT, "case-"));
}

function writeFile(root, relativePath, content) {
  const absolutePath = path.join(root, ...relativePath.split("/"));
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content);
}

function runScript(env) {
  const childEnv = { ...process.env };
  delete childEnv.EXAMPLEFILES_SRC_DIR;
  delete childEnv.EXAMPLEFILES_ZIP_TARGET;
  Object.assign(childEnv, env);
  return spawnSync(process.execPath, [SCRIPT], {
    encoding: "utf8",
    env: childEnv,
  });
}

/**
 * Minimaler ZIP-Leser: prüft die drei Signaturen, entpackt Deflate-Einträge
 * und verifiziert die CRC32 jeder Datei. So belegt der Test nicht nur die
 * Dateinamen, sondern dass die Einträge tatsächlich lesbar sind.
 */
function readZipEntries(archive) {
  assert.ok(
    archive.subarray(0, 4).equals(ZIP_SIGNATURE),
    `Archiv beginnt nicht mit PK\\x03\\x04: ${archive.subarray(0, 4).toString("hex")}`
  );

  const eocdOffset = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.notEqual(eocdOffset, -1, "End of central directory fehlt");
  assert.equal(archive.readUInt32LE(eocdOffset), EOCD_SIGNATURE);

  const entryCount = archive.readUInt16LE(eocdOffset + 10);
  const centralOffset = archive.readUInt32LE(eocdOffset + 16);
  const entries = [];

  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(
      archive.readUInt32LE(cursor),
      CENTRAL_HEADER_SIGNATURE,
      `Central-Directory-Signatur bei Eintrag ${index}`
    );

    const method = archive.readUInt16LE(cursor + 10);
    const crc = archive.readUInt32LE(cursor + 16);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const uncompressedSize = archive.readUInt32LE(cursor + 24);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const localOffset = archive.readUInt32LE(cursor + 42);
    const name = archive.toString(
      "utf8",
      cursor + 46,
      cursor + 46 + nameLength
    );

    assert.equal(
      archive.readUInt32LE(localOffset),
      LOCAL_HEADER_SIGNATURE,
      `Local-Header-Signatur für ${name}`
    );
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = archive.subarray(dataStart, dataStart + compressedSize);

    assert.equal(method, 8, `Kompressionsmethode für ${name}`);
    const data = zlib.inflateRawSync(compressed);
    assert.equal(data.length, uncompressedSize, `Größe für ${name}`);
    assert.equal(zlib.crc32(data) >>> 0, crc, `CRC32 für ${name}`);

    entries.push({ name, data });
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function createSourceFixture() {
  const root = makeTempDir();
  const sourceDir = path.join(root, "examplefiles");
  const contents = {
    "a.yaml": "kind: ConfigMap\nmetadata:\n  name: a\n",
    "nested/b.txt": "b\n",
    "nested/deep/c.yaml": "kind: Secret\n",
  };
  for (const [relativePath, content] of Object.entries(contents)) {
    writeFile(sourceDir, relativePath, content);
  }
  // Markdown gehört nicht ins Trainingsarchiv.
  writeFile(sourceDir, "notes.md", "# Notizen\n");
  writeFile(sourceDir, "page.mdx", "export const x = 1;\n");
  writeFile(sourceDir, "nested/topic-index.md", "# Thema\n");
  writeFile(sourceDir, "nested/UPPER.MD", "# Groß\n");

  return {
    root,
    sourceDir,
    contents,
    expected: Object.keys(contents)
      .sort()
      .map((relativePath) => `${ARCHIVE_PREFIX}/${relativePath}`),
  };
}

before(() => {
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  fs.mkdirSync(TMP_ROOT, { recursive: true });
});

after(() => {
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

describe("collectSourceFiles", () => {
  test("sammelt rekursiv nur Nicht-Markdown-Dateien in sortierter Reihenfolge", () => {
    const { sourceDir, expected } = createSourceFixture();
    const files = collectSourceFiles(sourceDir);
    assert.deepEqual(
      files,
      expected.map((name) => name.slice(ARCHIVE_PREFIX.length + 1))
    );
    for (const file of files) {
      assert.doesNotMatch(
        file,
        MARKDOWN_PATTERN,
        `Markdown in der Liste: ${file}`
      );
    }
  });

  test("das echte Quellverzeichnis enthält kein Markdown", () => {
    const files = collectSourceFiles(DEFAULT_SOURCE_DIR);
    assert.ok(files.length > 0, "keine Quelldateien gefunden");
    for (const file of files) {
      assert.doesNotMatch(
        file,
        MARKDOWN_PATTERN,
        `Markdown in der Liste: ${file}`
      );
    }
  });
});

describe("build-examplefiles-zip CLI", () => {
  test("schreibt die Quelldateien mit Präfix examplefiles/ in ein lesbares ZIP", () => {
    const { root, sourceDir, contents, expected } = createSourceFixture();
    const targetPath = path.join(root, "out", "downloads.zip");

    const result = runScript({
      EXAMPLEFILES_SRC_DIR: sourceDir,
      EXAMPLEFILES_ZIP_TARGET: targetPath,
    });

    assert.equal(result.status, 0, `Exit-Code, stderr: ${result.stderr}`);
    assert.match(result.stdout, new RegExp(`${expected.length} Dateien`));
    assert.ok(fs.existsSync(targetPath), "Archiv fehlt");
    assert.ok(
      !fs.existsSync(`${targetPath}.tmp`),
      "temporäre Datei blieb liegen"
    );

    const archive = fs.readFileSync(targetPath);
    const entries = readZipEntries(archive);

    assert.deepEqual(
      entries.map((entry) => entry.name),
      expected,
      "Dateiliste im Archiv"
    );
    for (const entry of entries) {
      const relativePath = entry.name.slice(ARCHIVE_PREFIX.length + 1);
      assert.equal(
        entry.data.toString("utf8"),
        contents[relativePath],
        `Inhalt von ${entry.name}`
      );
    }
  });

  test("zwei Läufe erzeugen byte-gleiche Archive", () => {
    const { root, sourceDir } = createSourceFixture();
    const firstTarget = path.join(root, "first.zip");
    const secondTarget = path.join(root, "second.zip");

    const first = runScript({
      EXAMPLEFILES_SRC_DIR: sourceDir,
      EXAMPLEFILES_ZIP_TARGET: firstTarget,
    });
    const second = runScript({
      EXAMPLEFILES_SRC_DIR: sourceDir,
      EXAMPLEFILES_ZIP_TARGET: secondTarget,
    });

    assert.equal(first.status, 0, `erster Lauf, stderr: ${first.stderr}`);
    assert.equal(second.status, 0, `zweiter Lauf, stderr: ${second.stderr}`);

    const firstArchive = fs.readFileSync(firstTarget);
    const secondArchive = fs.readFileSync(secondTarget);
    assert.ok(
      firstArchive.equals(secondArchive),
      "Archive unterscheiden sich trotz gleicher Quelle"
    );
    assert.equal(
      crypto.createHash("sha256").update(firstArchive).digest("hex"),
      crypto.createHash("sha256").update(secondArchive).digest("hex")
    );
  });

  test("fehlendes Quellverzeichnis endet mit Exit-Code 1 ohne Archiv", () => {
    const root = makeTempDir();
    const targetPath = path.join(root, "out", "downloads.zip");

    const result = runScript({
      EXAMPLEFILES_SRC_DIR: path.join(root, "does-not-exist"),
      EXAMPLEFILES_ZIP_TARGET: targetPath,
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Quellverzeichnis nicht gefunden/);
    assert.ok(
      !fs.existsSync(targetPath),
      "Archiv wurde trotz Fehler geschrieben"
    );
    assert.ok(
      !fs.existsSync(`${targetPath}.tmp`),
      "temporäre Datei blieb liegen"
    );
  });

  test("leeres Quellverzeichnis endet mit Exit-Code 1 ohne Archiv", () => {
    const root = makeTempDir();
    const sourceDir = path.join(root, "examplefiles");
    fs.mkdirSync(sourceDir, { recursive: true });
    const targetPath = path.join(root, "out", "downloads.zip");

    const result = runScript({
      EXAMPLEFILES_SRC_DIR: sourceDir,
      EXAMPLEFILES_ZIP_TARGET: targetPath,
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /enthält keine Dateien/);
    assert.ok(
      !fs.existsSync(targetPath),
      "Archiv wurde trotz Fehler geschrieben"
    );
    assert.ok(
      !fs.existsSync(`${targetPath}.tmp`),
      "temporäre Datei blieb liegen"
    );
  });

  test("baut aus dem echten Quellverzeichnis alle Nicht-Markdown-Dateien", () => {
    const root = makeTempDir();
    const targetPath = path.join(root, "downloads.zip");
    const expected = collectSourceFiles(DEFAULT_SOURCE_DIR).map(
      (file) => `${ARCHIVE_PREFIX}/${file}`
    );

    const result = runScript({ EXAMPLEFILES_ZIP_TARGET: targetPath });

    assert.equal(result.status, 0, `Exit-Code, stderr: ${result.stderr}`);
    const entries = readZipEntries(fs.readFileSync(targetPath));
    assert.deepEqual(
      entries.map((entry) => entry.name),
      expected
    );
  });
});

describe("buildExamplefilesZip", () => {
  test("liefert Dateizahl und Bytes des geschriebenen Archivs", () => {
    const { root, sourceDir, expected } = createSourceFixture();
    const targetPath = path.join(root, "api.zip");

    const result = buildExamplefilesZip({ sourceDir, targetPath });

    assert.equal(result.fileCount, expected.length);
    assert.equal(result.bytes, fs.statSync(targetPath).size);
    assert.deepEqual(
      result.files.map((file) => `${ARCHIVE_PREFIX}/${file}`),
      expected
    );
  });
});
