#!/usr/bin/env node

/**
 * Erzeugt das ZIP-Archiv der Trainings-Beispieldateien.
 *
 * Liest `src/content/docs/examplefiles/` rekursiv ein und schreibt alle
 * Dateien (ohne Markdown) unter dem Präfix `examplefiles/` in
 * `public/downloads/kubernetes-basis-examplefiles.zip`.
 *
 * Das Archiv wird ohne Fremdbibliothek geschrieben: Deflate kommt aus
 * `node:zlib`, die Prüfsummen aus `zlib.crc32`. Alle Einträge tragen den
 * festen DOS-Zeitstempel 1980-01-01 00:00, damit zwei Läufe byte-gleiche
 * Archive erzeugen.
 *
 * Aufruf:
 *   node scripts/build-examplefiles-zip.mjs
 *   npm run zip:examples
 *
 * Optionale Umgebungsvariablen (für Tests/Fehlerfälle):
 *   EXAMPLEFILES_SRC_DIR     Quellverzeichnis
 *   EXAMPLEFILES_ZIP_TARGET  Zielpfad des Archivs
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

export const DEFAULT_SOURCE_DIR = path.join(PROJECT_ROOT, 'src/content/docs/examplefiles');
export const DEFAULT_TARGET_PATH = path.join(
  PROJECT_ROOT,
  'public/downloads/kubernetes-basis-examplefiles.zip',
);
export const ARCHIVE_PREFIX = 'examplefiles';

// Fester Zeitstempel für alle Einträge: 1980-01-01 00:00 (DOS-Format).
const DOS_TIME = 0x0000;
const DOS_DATE = 0x0021;

const MARKDOWN_PATTERN = /\.mdx?$/i;

const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const EOCD_SIGNATURE = 0x06054b50;
const VERSION_NEEDED = 20;
const COMPRESSION_DEFLATE = 8;
const UTF8_NAME_FLAG = 0x0800;
const UNIX_FILE_MODE = 0o100644;

function isMarkdown(relativePath) {
  const baseName = path.posix.basename(relativePath);
  return MARKDOWN_PATTERN.test(baseName) || baseName.endsWith('-index.md');
}

/**
 * Sammelt alle nicht-Markdown-Dateien unter `sourceDir` rekursiv.
 * Rückgabe sind `/`-getrennte, nach Codepoints sortierte relative Pfade.
 */
export function collectSourceFiles(sourceDir) {
  const files = [];

  const walk = (currentDir) => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(absolutePath);
      } else if (entry.isFile()) {
        const relativePath = path.relative(sourceDir, absolutePath).split(path.sep).join('/');
        if (!isMarkdown(relativePath)) {
          files.push(relativePath);
        }
      }
    }
  };

  walk(sourceDir);
  return files.sort();
}

/**
 * Baut ein ZIP-Archiv aus `{ name, data }`-Einträgen (ohne Zip64).
 */
export function createZipArchive(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, 'utf8');
    const isAsciiName = nameBuffer.every((byte) => byte < 0x80);
    const flags = isAsciiName ? 0 : UTF8_NAME_FLAG;
    const compressed = zlib.deflateRawSync(entry.data, { level: 9 });
    const crc = zlib.crc32(entry.data) >>> 0;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(LOCAL_HEADER_SIGNATURE, 0);
    localHeader.writeUInt16LE(VERSION_NEEDED, 4);
    localHeader.writeUInt16LE(flags, 6);
    localHeader.writeUInt16LE(COMPRESSION_DEFLATE, 8);
    localHeader.writeUInt16LE(DOS_TIME, 10);
    localHeader.writeUInt16LE(DOS_DATE, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuffer, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(CENTRAL_HEADER_SIGNATURE, 0);
    centralHeader.writeUInt16LE((3 << 8) | VERSION_NEEDED, 4); // version made by: Unix, 2.0
    centralHeader.writeUInt16LE(VERSION_NEEDED, 6);
    centralHeader.writeUInt16LE(flags, 8);
    centralHeader.writeUInt16LE(COMPRESSION_DEFLATE, 10);
    centralHeader.writeUInt16LE(DOS_TIME, 12);
    centralHeader.writeUInt16LE(DOS_DATE, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra field length
    centralHeader.writeUInt16LE(0, 32); // comment length
    centralHeader.writeUInt16LE(0, 34); // disk number start
    centralHeader.writeUInt16LE(0, 36); // internal attributes
    centralHeader.writeUInt32LE((UNIX_FILE_MODE << 16) >>> 0, 38); // external attributes
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuffer);

    offset += localHeader.length + nameBuffer.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(EOCD_SIGNATURE, 0);
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk with central directory
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localParts, centralDirectory, eocd]);
}

/**
 * Schreibt das Archiv atomar (temporäre Datei im Zielordner + rename).
 */
export function buildExamplefilesZip({
  sourceDir = DEFAULT_SOURCE_DIR,
  targetPath = DEFAULT_TARGET_PATH,
} = {}) {
  let stats;
  try {
    stats = fs.statSync(sourceDir);
  } catch (error) {
    throw new Error(`Quellverzeichnis nicht gefunden: ${sourceDir} (${error.code ?? error.message})`);
  }

  if (!stats.isDirectory()) {
    throw new Error(`Quellpfad ist kein Verzeichnis: ${sourceDir}`);
  }

  const files = collectSourceFiles(sourceDir);
  if (files.length === 0) {
    throw new Error(`Quellverzeichnis enthält keine Dateien: ${sourceDir}`);
  }

  const entries = files.map((relativePath) => ({
    name: `${ARCHIVE_PREFIX}/${relativePath}`,
    data: fs.readFileSync(path.join(sourceDir, ...relativePath.split('/'))),
  }));

  const archive = createZipArchive(entries);

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const tempPath = `${targetPath}.tmp`;
  try {
    fs.writeFileSync(tempPath, archive);
    try {
      fs.renameSync(tempPath, targetPath);
    } catch (error) {
      // Windows erlaubt kein rename über eine bestehende Datei.
      if (error.code !== 'EEXIST' && error.code !== 'EPERM') {
        throw error;
      }
      fs.rmSync(targetPath, { force: true });
      fs.renameSync(tempPath, targetPath);
    }
  } catch (error) {
    fs.rmSync(tempPath, { force: true });
    throw error;
  }

  return { fileCount: files.length, bytes: archive.length, targetPath, files };
}

function main() {
  const sourceDir = process.env.EXAMPLEFILES_SRC_DIR
    ? path.resolve(process.env.EXAMPLEFILES_SRC_DIR)
    : DEFAULT_SOURCE_DIR;
  const targetPath = process.env.EXAMPLEFILES_ZIP_TARGET
    ? path.resolve(process.env.EXAMPLEFILES_ZIP_TARGET)
    : DEFAULT_TARGET_PATH;

  try {
    const result = buildExamplefilesZip({ sourceDir, targetPath });
    console.log(
      `examplefiles-ZIP: ${result.fileCount} Dateien, ${result.bytes} Bytes -> ${path.relative(PROJECT_ROOT, result.targetPath)}`,
    );
  } catch (error) {
    console.error(`examplefiles-ZIP: ${error.message}`);
    process.exitCode = 1;
  }
}

const invokedDirectly =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (invokedDirectly) {
  main();
}
