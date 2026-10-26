#!/usr/bin/env node

/**
 * OpenSCAD-Build-Pipeline
 *
 * Findet SCAD-Dateien, rendert STL-Ausgaben, erzeugt die Metadaten-JSON
 * und cached über den Datei-Hash.
 *
 * Aufruf:
 *   node scripts/build-scad.mjs          # alleinstehend
 *   npm run scad:render                  # über npm
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { getOpenSCADPath } from './get-openscad-path.mjs';

// ============================================================================
// Konfiguration
// ============================================================================

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const MODELS_SRC = path.join(PROJECT_ROOT, 'src/assets/handmade/3dmodels/models');
const INCLUDES_SRC = path.join(PROJECT_ROOT, 'src/assets/handmade/3dmodels/includes');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'public/3dmodels');
const CACHE_FILE = path.join(OUTPUT_DIR, '.build-cache.json');

// ============================================================================
// Hilfsfunktionen
// ============================================================================

/**
 * Berechnet den SHA-256-Hash einer Datei samt aller eingebundenen Dateien
 * @param {string} filePath - Path to SCAD file
 * @param {Set<string>} visited - Track visited files to avoid cycles
 * @returns {string} - Combined hash
 */
function computeFileHash(filePath, visited = new Set()) {
  if (visited.has(filePath)) return '';

  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  File not found for hashing: ${filePath}`);
      return '';
    }

    visited.add(filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    let hash = createHash('sha256').update(content).digest('hex');

    // Hashes aller über use <...> referenzierten Dateien einbeziehen
    const includes = parseIncludes(filePath);
    for (const incPath of includes) {
      const resolved = resolveIncludePath(incPath, path.dirname(filePath));
      if (resolved && fs.existsSync(resolved)) {
        hash += computeFileHash(resolved, visited);
      }
    }

    return createHash('sha256').update(hash).digest('hex');
  } catch (err) {
    console.warn(`⚠️  Error computing hash for ${filePath}: ${err.message}`);
    return '';
  }
}

/**
 * Liest use <...>-Anweisungen aus einer SCAD-Datei
 * @param {string} filePath - Path to SCAD file
 * @returns {string[]} - Array of include paths
 */
function parseIncludes(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const regex = /use\s*<([^>]+)>/g;
    const includes = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      includes.push(match[1]);
    }

    return includes;
  } catch (err) {
    console.warn(`⚠️  Error parsing includes from ${filePath}: ${err.message}`);
    return [];
  }
}

/**
 * Löst den Include-Pfad relativ zum Ort der SCAD-Datei auf.
 * Behandelt sowohl explizite Pfade als auch Modul-Lookups
 * @param {string} includePath - Path from use <...> statement
 * @param {string} baseDir - Directory containing the SCAD file
 * @returns {string|null} - Resolved filesystem path or null
 */
function resolveIncludePath(includePath, baseDir) {
  // Zuerst die direkte relative Auflösung versuchen
  const relativePath = path.resolve(baseDir, includePath);
  if (fs.existsSync(relativePath)) {
    return relativePath;
  }

  // Falsche Modulpfade behandeln: ./../modules/scad/roundedcube.scad
  // → auf includes/roundedcube.scad auflösen
  if (includePath.includes('modules/scad/')) {
    const filename = path.basename(includePath);
    const includesPath = path.resolve(INCLUDES_SRC, filename);
    if (fs.existsSync(includesPath)) {
      return includesPath;
    }
  }

  // Alternativ direkt im includes-Verzeichnis suchen
  const inIncludesDir = path.resolve(INCLUDES_SRC, path.basename(includePath));
  if (fs.existsSync(inIncludesDir)) {
    return inIncludesDir;
  }

  return null;
}

/**
 * Ermittelt das OpenSCAD-Binary (PATH oder projektlokale Installation)
 * @returns {string} - Path to OpenSCAD binary
 */
function resolveOpenSCADBinary() {
  const openscadBinary = getOpenSCADPath();
  if (!openscadBinary) {
    throw new Error(
      'OpenSCAD not found. Run "npm run scad:install" or install OpenSCAD manually and ensure it is in PATH.'
    );
  }
  return openscadBinary;
}

/**
 * Legt eine temporäre Arbeitskopie einer SCAD-Datei mit absoluten Include-Pfaden an.
 * OpenSCAD 2021.01 unterstützt das Flag -L für Bibliothekspfade nicht, deshalb
 * schreiben wir `use <...>`-Anweisungen direkt auf die aufgelösten Includes um.
 *
 * @param {string} scadFile - Path to original SCAD file
 * @param {string} tempDir - Temporary directory for the working copy
 * @returns {string} - Path to the temporary SCAD file
 */
function prepareTemporaryScadFile(scadFile, tempDir) {
  const baseDir = path.dirname(scadFile);
  const modelName = path.basename(scadFile);
  const tempScadPath = path.join(tempDir, modelName);

  let content = fs.readFileSync(scadFile, 'utf-8');

  // Jedes use <...> durch den absoluten Pfad des aufgelösten Includes ersetzen
  content = content.replace(/use\s*<([^>]+)>/g, (match, includePath) => {
    const resolved = resolveIncludePath(includePath, baseDir);
    if (resolved) {
      return `use <${resolved}>`;
    }
    console.warn(`⚠️  Could not resolve include: ${includePath}`);
    return match;
  });

  fs.mkdirSync(tempDir, { recursive: true });
  fs.writeFileSync(tempScadPath, content, 'utf-8');

  return tempScadPath;
}

/**
 * Baut das OpenSCAD-Kommando für den STL-Export
 * @param {string} scadFile - Path to SCAD file
 * @param {string} outputFile - Path to output STL
 * @returns {string} - Command to execute
 */
function buildOpenSCADCommand(scadFile, outputFile) {
  const openscadBinary = resolveOpenSCADBinary();
  return `"${openscadBinary}" -o "${outputFile}" "${scadFile}"`;
}

/**
 * Führt das OpenSCAD-Kommando aus
 * @param {string} command - Command to execute
 * @param {string} scadFile - SCAD filename (for logging)
 * @returns {boolean} - Success flag
 */
function executeCommand(command, scadFile) {
  try {
    execSync(command, {
      stdio: 'pipe',
      timeout: 120000, // 2 minutes per model
    });
    return true;
  } catch (err) {
    console.error(`❌ Failed to render ${scadFile}`);
    console.error(`   Command: ${command}`);
    if (err.stdout) console.error(`   Stdout: ${err.stdout.toString()}`);
    if (err.stderr) console.error(`   Stderr: ${err.stderr.toString()}`);
    return false;
  }
}

/**
 * Leitet einen lesbaren Titel aus dem Dateinamen ab
 * Format: CamelCase → Camel Case
 * @param {string} filename - Filename without extension
 * @returns {string} - Title
 */
function deriveTitle(filename) {
  return filename
    .replace(/([a-z])([A-Z])/g, '$1 $2') // CamelCase → Camel Case
    .replace(/([a-z])([0-9])/g, '$1 $2') // text123 → text 123
    .trim();
}

/**
 * Lädt den Cache des vorherigen Builds
 * @returns {object} - Cache object {filename: hash}
 */
function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    }
  } catch (err) {
    console.warn(`⚠️  Failed to load cache: ${err.message}`);
  }
  return {};
}

/**
 * Schreibt den Cache für den nächsten Build
 * @param {object} cache - Cache object
 */
function saveCache(cache) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (err) {
    console.error(`❌ Failed to save cache: ${err.message}`);
  }
}

// ============================================================================
// Haupt-Build-Ablauf
// ============================================================================

async function buildSCADModels() {
  console.log('🏗️  Building OpenSCAD models...\n');

  // Zielverzeichnis anlegen
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Created output directory: ${OUTPUT_DIR}`);
  }

  // SCAD-Dateien finden
  if (!fs.existsSync(MODELS_SRC)) {
    console.error(`❌ Models directory not found: ${MODELS_SRC}`);
    process.exit(1);
  }

  const scadFiles = fs.readdirSync(MODELS_SRC).filter((f) => f.endsWith('.scad')).sort();

  if (scadFiles.length === 0) {
    console.warn(`⚠️  No SCAD files found in ${MODELS_SRC}`);
    return;
  }

  console.log(`📋 Found ${scadFiles.length} SCAD file(s):\n`);

  // Cache laden
  const cache = loadCache();
  const newCache = {};
  const models = [];
  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  // Jede SCAD-Datei verarbeiten
  for (const scadFile of scadFiles) {
    const modelName = path.basename(scadFile, '.scad');
    const scadPath = path.join(MODELS_SRC, scadFile);
    const stlPath = path.join(OUTPUT_DIR, `${modelName}.stl`);
    let tempDir = null;

    // Hash berechnen
    const hash = computeFileHash(scadPath);
    newCache[scadFile] = hash;

    // Prüfen, ob gecached und unverändert
    if (cache[scadFile] === hash && fs.existsSync(stlPath)) {
      console.log(`⏭️  ${scadFile} (cached, unchanged)`);
      skipCount++;

      // Auch gecached ins Model-Verzeichnis aufnehmen
      models.push({
        id: modelName,
        title: deriveTitle(modelName),
        scadFile: `src/assets/handmade/3dmodels/models/${scadFile}`,
        stlFile: `3dmodels/${modelName}.stl`,
      });

      continue;
    }

    try {
      // OpenSCAD 2021.01 kennt kein -L; deshalb eine temporäre SCAD-Datei
      // mit absoluten Include-Pfaden erzeugen, damit Includes auflösbar bleiben.
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-scad-'));
      const tempScadPath = prepareTemporaryScadFile(scadPath, tempDir);

      // STL rendern
      const stlCmd = buildOpenSCADCommand(tempScadPath, stlPath);
      const stlOk = executeCommand(stlCmd, scadFile);

      if (stlOk) {
        console.log(`✅ ${scadFile}`);
        successCount++;

        models.push({
          id: modelName,
          title: deriveTitle(modelName),
          scadFile: `src/assets/handmade/3dmodels/models/${scadFile}`,
          stlFile: `3dmodels/${modelName}.stl`,
        });
      } else {
        console.log(`❌ ${scadFile}`);
        failCount++;
      }
    } finally {
      if (tempDir) {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (err) {
          console.warn(`⚠️  Failed to clean up temp dir ${tempDir}: ${err.message}`);
        }
      }
    }
  }

  // Cache speichern
  saveCache(newCache);

  // models.json erzeugen
  const modelsJsonPath = path.join(OUTPUT_DIR, 'models.json');
  try {
    fs.writeFileSync(modelsJsonPath, JSON.stringify(models, null, 2));
    console.log(`\n📄 Generated ${modelsJsonPath}`);
  } catch (err) {
    console.error(`❌ Failed to write models.json: ${err.message}`);
  }

  // Zusammenfassung
  console.log(`\n📊 Build Summary:`);
  console.log(`   ✅ Rendered: ${successCount}`);
  console.log(`   ⏭️  Cached:   ${skipCount}`);
  console.log(`   ❌ Failed:   ${failCount}`);
  console.log(`   📦 Total:    ${scadFiles.length}`);

  if (failCount > 0) {
    console.log(`\n⚠️  Build completed with ${failCount} error(s).`);
  } else {
    console.log(`\n✨ Build successful!`);
  }
}

// ============================================================================
// Einstiegspunkt
// ============================================================================

buildSCADModels().catch((err) => {
  console.error(`\n❌ Unexpected error: ${err.message}`);
  process.exit(1);
});
