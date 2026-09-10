'use strict';

/**
 * Smoke test for the OpenSCAD build pipeline.
 *
 * Runs `node scripts/build-scad.mjs` (the same command as `npm run scad:render`)
 * and verifies the generated artifacts are complete and internally consistent.
 *
 * Generated files live under `public/3dmodels/`, which is gitignored — running
 * this test never commits or alters tracked files.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MODELS_SRC = path.join(ROOT, 'src', 'assets', 'handmade', '3dmodels', 'models');
const PUBLIC_DIR = path.join(ROOT, 'public');
const MODELS_JSON = path.join(PUBLIC_DIR, '3dmodels', 'models.json');

test('scad render produces valid models.json and matching STL files', () => {
  // 1. Run the render pipeline. Exits non-zero (failing the test) on render errors.
  execFileSync(process.execPath, ['scripts/build-scad.mjs'], {
    cwd: ROOT,
    stdio: 'inherit',
  });

  // 2. models.json exists and is valid JSON.
  assert.ok(fs.existsSync(MODELS_JSON), 'models.json should exist after rendering');
  const models = JSON.parse(fs.readFileSync(MODELS_JSON, 'utf8'));
  assert.ok(Array.isArray(models), 'models.json should contain a JSON array');

  // 3. Every entry exposes the required fields.
  for (const entry of models) {
    assert.ok(entry && typeof entry === 'object', 'each entry must be an object');
    assert.strictEqual(typeof entry.id, 'string', `entry.id must be a string: ${JSON.stringify(entry)}`);
    assert.strictEqual(typeof entry.title, 'string', `entry.title must be a string: ${JSON.stringify(entry)}`);
    assert.strictEqual(typeof entry.scadFile, 'string', `entry.scadFile must be a string: ${JSON.stringify(entry)}`);
    assert.strictEqual(typeof entry.stlFile, 'string', `entry.stlFile must be a string: ${JSON.stringify(entry)}`);
    assert.ok(entry.id.length > 0, 'entry.id must be non-empty');
    assert.ok(entry.title.length > 0, 'entry.title must be non-empty');
    assert.ok(entry.scadFile.length > 0, 'entry.scadFile must be non-empty');
    assert.ok(entry.stlFile.length > 0, 'entry.stlFile must be non-empty');
  }

  // 4. Entry count matches the number of .scad source files.
  const scadFiles = fs.readdirSync(MODELS_SRC).filter((f) => f.endsWith('.scad'));
  assert.strictEqual(
    models.length,
    scadFiles.length,
    `models.json entry count (${models.length}) must equal .scad file count (${scadFiles.length})`
  );

  // 5. Each referenced STL file exists and is non-empty. stlFile is relative to public/.
  for (const entry of models) {
    const stlPath = path.resolve(PUBLIC_DIR, entry.stlFile);
    assert.ok(fs.existsSync(stlPath), `STL file should exist: ${entry.stlFile}`);
    const stat = fs.statSync(stlPath);
    assert.ok(stat.isFile() && stat.size > 0, `STL file should be non-empty: ${entry.stlFile}`);
  }
});
