'use strict';

/**
 * Smoke-Test für die OpenSCAD-Build-Pipeline.
 *
 * Führt `node scripts/build-scad.mjs` aus (dasselbe Kommando wie `npm run scad:render`)
 * und prüft, dass die erzeugten Artefakte vollständig und in sich konsistent sind.
 *
 * Die generierten Dateien liegen unter `public/3dmodels/`, das gitignored ist — der
 * Test committet nie und verändert keine getrackten Dateien.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const MODELS_SRC = path.join(ROOT, 'src', 'assets', 'handmade', '3dmodels', 'models');
const PUBLIC_DIR = path.join(ROOT, 'public');
const MODELS_JSON = path.join(PUBLIC_DIR, '3dmodels', 'models.json');

test('scad render produces valid models.json and matching STL files', () => {
  // 1. Render-Pipeline ausführen. Bricht bei Render-Fehlern mit Exit-Code ungleich Null ab (Test schlägt fehl).
  execFileSync(process.execPath, ['scripts/build-scad.mjs'], {
    cwd: ROOT,
    stdio: 'inherit',
  });

  // 2. models.json existiert und ist gültiges JSON.
  assert.ok(fs.existsSync(MODELS_JSON), 'models.json should exist after rendering');
  const models = JSON.parse(fs.readFileSync(MODELS_JSON, 'utf8'));
  assert.ok(Array.isArray(models), 'models.json should contain a JSON array');

  // 3. Jeder Eintrag liefert die erforderlichen Felder.
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

  // 4. Die Anzahl der Einträge entspricht der Zahl der .scad-Quelldateien.
  const scadFiles = fs.readdirSync(MODELS_SRC).filter((f) => f.endsWith('.scad'));
  assert.strictEqual(
    models.length,
    scadFiles.length,
    `models.json entry count (${models.length}) must equal .scad file count (${scadFiles.length})`
  );

  // 5. Jede referenzierte STL-Datei existiert und ist nicht leer. stlFile ist relativ zu public/.
  for (const entry of models) {
    const stlPath = path.resolve(PUBLIC_DIR, entry.stlFile);
    assert.ok(fs.existsSync(stlPath), `STL file should exist: ${entry.stlFile}`);
    const stat = fs.statSync(stlPath);
    assert.ok(stat.isFile() && stat.size > 0, `STL file should be non-empty: ${entry.stlFile}`);
  }
});
