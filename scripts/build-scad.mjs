#!/usr/bin/env node

/**
 * OpenSCAD Build Pipeline
 *
 * Discovers SCAD files, renders STL outputs, generates metadata JSON,
 * and caches by file hash.
 *
 * Usage:
 *   node scripts/build-scad.mjs          # Standalone
 *   npm run scad:render                  # Via npm
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { getOpenSCADPath } from './get-openscad-path.mjs';

// ============================================================================
// Configuration
// ============================================================================

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const MODELS_SRC = path.join(PROJECT_ROOT, 'src/assets/handmade/3dmodels/models');
const INCLUDES_SRC = path.join(PROJECT_ROOT, 'src/assets/handmade/3dmodels/includes');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'public/3dmodels');
const CACHE_FILE = path.join(OUTPUT_DIR, '.build-cache.json');

// ============================================================================
// Utilities
// ============================================================================

/**
 * Compute SHA-256 hash of a file and all its includes
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

    // Include hashes of any files referenced by use <...>
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
 * Parse use <...> statements from SCAD file
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
 * Resolve include path relative to the SCAD file location
 * Handles both explicit paths and module lookups
 * @param {string} includePath - Path from use <...> statement
 * @param {string} baseDir - Directory containing the SCAD file
 * @returns {string|null} - Resolved filesystem path or null
 */
function resolveIncludePath(includePath, baseDir) {
  // Try direct relative resolution first
  const relativePath = path.resolve(baseDir, includePath);
  if (fs.existsSync(relativePath)) {
    return relativePath;
  }

  // Handle incorrect module paths: ./../modules/scad/roundedcube.scad
  // → resolve to includes/roundedcube.scad
  if (includePath.includes('modules/scad/')) {
    const filename = path.basename(includePath);
    const includesPath = path.resolve(INCLUDES_SRC, filename);
    if (fs.existsSync(includesPath)) {
      return includesPath;
    }
  }

  // Try looking in includes directory directly
  const inIncludesDir = path.resolve(INCLUDES_SRC, path.basename(includePath));
  if (fs.existsSync(inIncludesDir)) {
    return inIncludesDir;
  }

  return null;
}

/**
 * Resolve OpenSCAD binary (PATH or project-local install)
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
 * Create a temporary working copy of a SCAD file with absolute include paths.
 * OpenSCAD 2021.01 does not support the -L library path flag, so we rewrite
 * `use <...>` statements to point to the resolved include files directly.
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

  // Replace each use <...> with the absolute path to the resolved include
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
 * Build OpenSCAD command for STL export
 * @param {string} scadFile - Path to SCAD file
 * @param {string} outputFile - Path to output STL
 * @returns {string} - Command to execute
 */
function buildOpenSCADCommand(scadFile, outputFile) {
  const openscadBinary = resolveOpenSCADBinary();
  return `"${openscadBinary}" -o "${outputFile}" "${scadFile}"`;
}

/**
 * Execute OpenSCAD command
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
 * Derive human-readable title from filename
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
 * Load cache from previous build
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
 * Save cache for next build
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
// Main Build Process
// ============================================================================

async function buildSCADModels() {
  console.log('🏗️  Building OpenSCAD models...\n');

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Created output directory: ${OUTPUT_DIR}`);
  }

  // Discover SCAD files
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

  // Load cache
  const cache = loadCache();
  const newCache = {};
  const models = [];
  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  // Process each SCAD file
  for (const scadFile of scadFiles) {
    const modelName = path.basename(scadFile, '.scad');
    const scadPath = path.join(MODELS_SRC, scadFile);
    const stlPath = path.join(OUTPUT_DIR, `${modelName}.stl`);
    let tempDir = null;

    // Compute hash
    const hash = computeFileHash(scadPath);
    newCache[scadFile] = hash;

    // Check if cached and unchanged
    if (cache[scadFile] === hash && fs.existsSync(stlPath)) {
      console.log(`⏭️  ${scadFile} (cached, unchanged)`);
      skipCount++;

      // Still add to models even if cached
      models.push({
        id: modelName,
        title: deriveTitle(modelName),
        scadFile: `src/assets/handmade/3dmodels/models/${scadFile}`,
        stlFile: `3dmodels/${modelName}.stl`,
      });

      continue;
    }

    try {
      // OpenSCAD 2021.01 does not support -L; create a temporary SCAD file
      // with absolute include paths so includes can still be resolved.
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-scad-'));
      const tempScadPath = prepareTemporaryScadFile(scadPath, tempDir);

      // Render STL
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

  // Save cache
  saveCache(newCache);

  // Generate models.json
  const modelsJsonPath = path.join(OUTPUT_DIR, 'models.json');
  try {
    fs.writeFileSync(modelsJsonPath, JSON.stringify(models, null, 2));
    console.log(`\n📄 Generated ${modelsJsonPath}`);
  } catch (err) {
    console.error(`❌ Failed to write models.json: ${err.message}`);
  }

  // Summary
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
// Entry Point
// ============================================================================

buildSCADModels().catch((err) => {
  console.error(`\n❌ Unexpected error: ${err.message}`);
  process.exit(1);
});
