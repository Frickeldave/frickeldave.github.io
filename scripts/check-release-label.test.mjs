import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildHints,
  parseArgs,
  parseJson,
  parseLabelNames,
  parseTags,
  prLabelsArgs,
  readBaseVersion,
  releaseListArgs,
  resolveLabels,
  runCi,
  runHook,
} from './check-release-label.mjs';

const pr = (over = {}) => ({ number: 7, state: 'OPEN', baseRefName: 'dev', labels: [], ...over });
const labels = (...names) => names.map((name) => ({ name }));
const RELEASES = 'dev-v0.9.0\nv5.0.0\ndev-v1.0.0\n';

/**
 * Fake für `spawnSync`, der pro Befehl antwortet und die Aufrufe mitschreibt.
 * @param {Record<string, unknown>} handlers
 */
const fakeSpawn = (handlers) => {
  const calls = [];
  const spawn = (command, args) => {
    calls.push([command, args]);
    const handler = handlers[args[0]];
    if (typeof handler === 'function') return handler(args);
    return handler ?? { status: 0, stdout: '' };
  };
  spawn.calls = calls;
  return spawn;
};

/** @param {object} [over] */
const prOk = (over) => ({ status: 0, stdout: JSON.stringify(pr(over)) });

test('parseArgs liest den CI-Modus samt Optionen', () => {
  assert.deepEqual(
    parseArgs([
      '--ci',
      '--repo',
      'Frickeldave/frickeldave.github.io',
      '--base',
      'dev',
      '--labels',
      '["release:no"]',
      '--pr-number',
      '282',
    ]),
    {
      ci: true,
      repo: 'Frickeldave/frickeldave.github.io',
      base: 'dev',
      labels: '["release:no"]',
      'pr-number': '282',
    }
  );
  assert.deepEqual(parseArgs([]), { ci: false });
});

test('parseArgs bricht bei unbekannten Argumenten und fehlenden Werten ab', () => {
  assert.throws(() => parseArgs(['--wat']), /Unbekanntes Argument/u);
  assert.throws(() => parseArgs(['--repo']), /Fehlender Wert für --repo/u);
});

test('parseTags und parseLabelNames lesen die Zeilenform von gh --jq', () => {
  assert.deepEqual(parseTags('dev-v1.0.0\r\n\nv2.0.0\n'), [
    { tagName: 'dev-v1.0.0' },
    { tagName: 'v2.0.0' },
  ]);
  assert.deepEqual(parseLabelNames('release:yes\n\n bug\n'), ['release:yes', 'bug']);
  assert.deepEqual(parseTags(''), []);
});

test('parseJson liefert bei kaputtem JSON null', () => {
  assert.deepEqual(parseJson('["a"]'), ['a']);
  assert.equal(parseJson('kein json'), null);
});

test('releaseListArgs und prLabelsArgs zielen auf die passenden API-Pfade', () => {
  assert.deepEqual(releaseListArgs('o/r'), [
    'api',
    '--paginate',
    'repos/o/r/releases?per_page=100',
    '--jq',
    '.[].tag_name',
  ]);
  assert.deepEqual(prLabelsArgs('o/r', 282), ['api', 'repos/o/r/pulls/282', '--jq', '.labels[].name']);
});

test('readBaseVersion liest die Version an der Merge-Base', () => {
  const spawn = fakeSpawn({
    'merge-base': { status: 0, stdout: 'abc123\n' },
    show: { status: 0, stdout: JSON.stringify({ name: 'Astrogon', version: '1.0.6' }) },
  });
  assert.equal(readBaseVersion('dev', { spawn }), '1.0.6');
  assert.deepEqual(spawn.calls[0][1], ['merge-base', 'HEAD', 'origin/dev']);
  assert.deepEqual(spawn.calls[1][1], ['show', 'abc123:package.json']);
});

test('readBaseVersion liefert null, wenn git nicht weiterhilft', () => {
  assert.equal(
    readBaseVersion('dev', { spawn: fakeSpawn({ 'merge-base': { status: 128, stdout: '' } }) }),
    null
  );
  assert.equal(
    readBaseVersion('dev', {
      spawn: fakeSpawn({
        'merge-base': { status: 0, stdout: 'abc123\n' },
        show: { status: 128, stdout: '' },
      }),
    }),
    null
  );
  assert.equal(
    readBaseVersion('dev', {
      spawn: fakeSpawn({
        'merge-base': { status: 0, stdout: 'abc123\n' },
        show: { status: 0, stdout: '{"version":"1.0"}' },
      }),
    }),
    null
  );
  assert.equal(
    readBaseVersion('dev', {
      spawn: () => {
        throw new Error('kein git');
      },
    }),
    null
  );
});

test('buildHints nennt das passende gh-Kommando', () => {
  assert.deepEqual(buildHints(7, []), [
    '  gh pr edit 7 --add-label release:yes   (neue Version, dev-Release)',
    '  gh pr edit 7 --add-label release:no    (Version unverändert)',
  ]);
  assert.deepEqual(buildHints(7, ['release:yes', 'release:no']), [
    '  gh pr edit 7 --remove-label release:no   (oder --remove-label release:yes)',
  ]);
  assert.deepEqual(buildHints(7, ['release:yes']), []);
});

test('der Hook blockiert einen offenen dev-PR ohne Release-Label', () => {
  const logged = [];
  const result = runHook({
    spawn: fakeSpawn({ pr: prOk(), api: { status: 0, stdout: RELEASES } }),
    log: (message) => logged.push(message),
    readRootVersionFn: () => '1.0.1',
  });
  assert.equal(result.code, 1);
  assert.equal(logged.length, 1);
  assert.match(result.message, /Push blockiert/u);
  assert.match(result.message, /gh pr edit 7 --add-label release:yes/u);
  assert.match(result.message, /--no-verify/u);
});

test('der Hook blockiert release:yes ohne Versionsanstieg', () => {
  const result = runHook({
    spawn: fakeSpawn({ pr: prOk({ labels: labels('release:yes') }), api: { status: 0, stdout: RELEASES } }),
    log: () => {},
    readRootVersionFn: () => '1.0.0',
  });
  assert.equal(result.code, 1);
  assert.match(result.message, /npm run versionbump -- x\.y\.z/u);
});

test('der Hook blockiert release:no mit veränderter Version', () => {
  const spawn = fakeSpawn({
    pr: prOk({ labels: labels('release:no') }),
    'merge-base': { status: 0, stdout: 'abc123\n' },
    show: { status: 0, stdout: JSON.stringify({ version: '1.0.6' }) },
  });
  const result = runHook({ spawn, log: () => {}, readRootVersionFn: () => '1.0.7' });
  assert.equal(result.code, 1);
  assert.match(result.message, /ist höher als 1\.0\.6/u);
  assert.deepEqual(
    spawn.calls.map((call) => call[1][0]),
    ['pr', 'merge-base', 'show']
  );
});

test('der Hook besteht bei stimmiger Version und loggt nichts', () => {
  const logged = [];
  const yes = runHook({
    spawn: fakeSpawn({ pr: prOk({ labels: labels('release:yes') }), api: { status: 0, stdout: RELEASES } }),
    log: (message) => logged.push(message),
    readRootVersionFn: () => '1.0.1',
  });
  assert.deepEqual(yes, { code: 0, message: null });

  const no = runHook({
    spawn: fakeSpawn({
      pr: prOk({ labels: labels('release:no') }),
      'merge-base': { status: 0, stdout: 'abc123\n' },
      show: { status: 0, stdout: JSON.stringify({ version: '1.0.6' }) },
    }),
    log: (message) => logged.push(message),
    readRootVersionFn: () => '1.0.6',
  });
  assert.deepEqual(no, { code: 0, message: null });
  assert.deepEqual(logged, []);
});

test('der Hook besteht auch ohne vorhandenes dev-Release', () => {
  const result = runHook({
    spawn: fakeSpawn({ pr: prOk({ labels: labels('release:yes') }), api: { status: 0, stdout: '' } }),
    log: () => {},
    readRootVersionFn: () => '0.0.1',
  });
  assert.deepEqual(result, { code: 0, message: null });
});

test('der Hook blockiert nie bei Infrastrukturproblemen', () => {
  const cases = [
    () => fakeSpawn({ pr: { error: new Error('ENOENT'), status: null, stdout: '' } }),
    () => fakeSpawn({ pr: { status: 1, stdout: '' } }),
    () => fakeSpawn({ pr: { status: 0, stdout: 'kein json' } }),
    () => fakeSpawn({ pr: prOk({ baseRefName: 'main' }) }),
    () => fakeSpawn({ pr: prOk({ state: 'CLOSED' }) }),
    () => fakeSpawn({ pr: prOk({ labels: labels('release:yes') }), api: { status: 1, stdout: '' } }),
  ];

  for (const makeSpawn of cases) {
    const logged = [];
    const result = runHook({
      spawn: makeSpawn(),
      log: (message) => logged.push(message),
      readRootVersionFn: () => '1.0.0',
    });
    assert.deepEqual(result, { code: 0, message: null });
    assert.deepEqual(logged, []);
  }
});

test('der Hook schluckt auch werfende Abhängigkeiten', () => {
  const result = runHook({
    spawn: fakeSpawn({ pr: prOk({ labels: labels('release:yes') }), api: { status: 0, stdout: RELEASES } }),
    log: () => {},
    readRootVersionFn: () => {
      throw new Error('package.json fehlt');
    },
  });
  assert.deepEqual(result, { code: 0, message: null });
});

test('runCi besteht mit release:yes und höherer Version', () => {
  const result = runCi(
    { repo: 'o/r', labels: ['release:yes'], base: 'dev' },
    { spawn: fakeSpawn({ api: { status: 0, stdout: RELEASES } }), readRootVersionFn: () => '1.0.1' }
  );
  assert.deepEqual(result, {
    ok: true,
    errors: [],
    version: '1.0.1',
    highestDevVersion: '1.0.0',
    baseVersion: null,
  });
});

test('runCi scheitert mit release:yes ohne Versionsanstieg', () => {
  const result = runCi(
    { repo: 'o/r', labels: ['release:yes'], base: 'dev' },
    { spawn: fakeSpawn({ api: { status: 0, stdout: RELEASES } }), readRootVersionFn: () => '1.0.0' }
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /höchste dev-Release 1\.0\.0/u);
});

test('runCi vergleicht release:no gegen die Merge-Base-Version', () => {
  const result = runCi(
    { repo: 'o/r', labels: ['release:no'], base: 'dev' },
    {
      spawn: fakeSpawn({
        'merge-base': { status: 0, stdout: 'abc123\n' },
        show: { status: 0, stdout: JSON.stringify({ version: '1.0.6' }) },
      }),
      readRootVersionFn: () => '1.0.7',
    }
  );
  assert.equal(result.ok, false);
  assert.equal(result.baseVersion, '1.0.6');
  assert.match(result.errors.join('\n'), /Merge-Base mit dev/u);
});

test('runCi wirft, wenn die Merge-Base-Version fehlt oder die Releases unlesbar sind', () => {
  assert.throws(
    () =>
      runCi(
        { repo: 'o/r', labels: ['release:no'], base: 'dev' },
        {
          spawn: fakeSpawn({ 'merge-base': { status: 128, stdout: '' } }),
          readRootVersionFn: () => '1.0.6',
        }
      ),
    /fetch-depth: 0/u
  );

  assert.throws(
    () =>
      runCi(
        { repo: 'o/r', labels: ['release:yes'], base: 'dev' },
        {
          spawn: fakeSpawn({ api: { status: 1, stderr: 'HTTP 404' } }),
          readRootVersionFn: () => '1.0.6',
        }
      ),
    /nicht lesbar/u
  );
});

test('runCi nutzt auch bei fehlendem Label die Release-Liste', () => {
  const spawn = fakeSpawn({ api: { status: 0, stdout: RELEASES } });
  const result = runCi(
    { repo: 'o/r', labels: [], base: 'dev' },
    { spawn, readRootVersionFn: () => '1.0.1' }
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /Kein Release-Label/u);
  assert.deepEqual(
    spawn.calls.map((call) => call[1][0]),
    ['api']
  );
});

test('resolveLabels bevorzugt das übergebene JSON', () => {
  const spawn = fakeSpawn({ api: { status: 0, stdout: 'bug\n' } });
  assert.deepEqual(resolveLabels({ explicit: '["release:yes"]', repo: 'o/r', spawn }), ['release:yes']);
  assert.deepEqual(spawn.calls, []);
});

test('resolveLabels fragt sonst die GitHub-API', () => {
  const spawn = fakeSpawn({ api: { status: 0, stdout: 'release:no\nbug\n' } });
  assert.deepEqual(resolveLabels({ repo: 'o/r', prNumber: '282', spawn }), ['release:no', 'bug']);
  assert.deepEqual(spawn.calls[0][1], prLabelsArgs('o/r', '282'));
});

test('resolveLabels bricht ohne LABELS und ohne PR-Nummer ab', () => {
  assert.throws(() => resolveLabels({ repo: 'o/r' }), /Weder LABELS noch PR_NUMBER/u);
  assert.throws(
    () => resolveLabels({ repo: 'o/r', prNumber: '282', spawn: fakeSpawn({ api: { status: 1 } }) }),
    /nicht lesbar/u
  );
  assert.throws(
    () => resolveLabels({ repo: 'o/r', explicit: 'kein json' }),
    /JSON-Array von Label-Namen/u
  );
});
