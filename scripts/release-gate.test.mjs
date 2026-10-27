import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  BASE_REF_DEFAULT,
  DEV_RELEASE_TAG_PREFIX,
  LABEL_NO,
  LABEL_YES,
  evaluateReleaseGate,
  extractDevReleaseVersion,
  findHighestDevReleaseVersion,
  readRootVersion,
} from './release-gate.mjs';

test('die Konstanten beschreiben das Label-Modell', () => {
  assert.equal(LABEL_YES, 'release:yes');
  assert.equal(LABEL_NO, 'release:no');
  assert.equal(DEV_RELEASE_TAG_PREFIX, 'dev-v');
  assert.equal(BASE_REF_DEFAULT, 'dev');
});

test('extractDevReleaseVersion liest nur striktes X.Y.Z aus dev-v-Tags', () => {
  assert.equal(extractDevReleaseVersion(`${DEV_RELEASE_TAG_PREFIX}1.2.3`), '1.2.3');
  assert.equal(extractDevReleaseVersion('v1.2.3'), null);
  assert.equal(extractDevReleaseVersion(`${DEV_RELEASE_TAG_PREFIX}1.2.3-beta.1`), null);
  assert.equal(extractDevReleaseVersion(`${DEV_RELEASE_TAG_PREFIX}`), null);
  assert.equal(extractDevReleaseVersion(undefined), null);
});

test('findHighestDevReleaseVersion nimmt die höchste dev-v-Version (gh- und REST-Form)', () => {
  assert.equal(
    findHighestDevReleaseVersion([
      { tagName: 'dev-v0.1.9' },
      { tag_name: 'dev-v0.1.10' },
      { tagName: 'v9.9.9' },
      { tagName: 'dev-v1.0.0-beta.1' },
      { tagName: 'dev-v0.1.3' },
      null,
    ]),
    '0.1.10'
  );
});

test('findHighestDevReleaseVersion liefert null ohne dev-Release', () => {
  assert.equal(findHighestDevReleaseVersion([]), null);
  assert.equal(findHighestDevReleaseVersion([{ tagName: 'v1.0.0' }]), null);
  assert.equal(findHighestDevReleaseVersion(undefined), null);
});

test('readRootVersion liest die Version dieses Repositories', () => {
  assert.match(readRootVersion(), /^\d+\.\d+\.\d+$/u);
});

test('ohne Release-Label schlägt das Gate fehl und nennt beide Labels', () => {
  const result = evaluateReleaseGate({ labels: ['bug'], version: '1.0.6', highestDevVersion: '1.0.5' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /Kein Release-Label/u);
  assert.match(result.errors.join('\n'), /release:yes/u);
  assert.match(result.errors.join('\n'), /release:no/u);
});

test('beide Release-Labels zusammen schlagen fehl', () => {
  const result = evaluateReleaseGate({
    labels: [LABEL_YES, LABEL_NO],
    version: '1.0.6',
    highestDevVersion: '1.0.5',
    baseVersion: '1.0.6',
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /Beide Labels gesetzt/u);
});

test('eine ungültige Version schlägt fehl, ohne die Versionsvergleiche zu bewerten', () => {
  const result = evaluateReleaseGate({
    labels: [LABEL_YES],
    version: '1.0',
    highestDevVersion: '0.9.0',
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /strikt X\.Y\.Z/u);
});

test('release:yes besteht mit strikt höherer Version', () => {
  for (const [version, highest] of [
    ['1.0.1', '1.0.0'],
    ['2.0.0', '1.9.9'],
    ['1.10.0', '1.9.0'],
  ]) {
    assert.deepEqual(
      evaluateReleaseGate({ labels: [LABEL_YES], version, highestDevVersion: highest }),
      { ok: true, errors: [] }
    );
  }
});

test('release:yes scheitert bei gleicher Version und nennt den versionbump-Befehl', () => {
  const result = evaluateReleaseGate({
    labels: [LABEL_YES],
    version: '1.0.0',
    highestDevVersion: '1.0.0',
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /npm run versionbump -- x\.y\.z/u);
});

test('release:yes scheitert bei niedrigerer Version', () => {
  assert.equal(
    evaluateReleaseGate({ labels: [LABEL_YES], version: '0.9.9', highestDevVersion: '1.0.0' }).ok,
    false
  );
});

test('release:yes ohne dev-Release besteht allein über die Label-Regel', () => {
  assert.deepEqual(
    evaluateReleaseGate({ labels: [LABEL_YES], version: '0.0.1', highestDevVersion: null }),
    { ok: true, errors: [] }
  );
});

test('release:no besteht, solange die Version unverändert bleibt', () => {
  assert.deepEqual(
    evaluateReleaseGate({ labels: [LABEL_NO], version: '1.0.6', baseVersion: '1.0.6' }),
    { ok: true, errors: [] }
  );
});

test('release:no scheitert bei höherer Version und nennt das Basislabel', () => {
  const result = evaluateReleaseGate({
    labels: [LABEL_NO],
    version: '1.0.7',
    baseVersion: '1.0.6',
    baseRef: 'origin/dev',
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /ist höher als 1\.0\.6/u);
  assert.match(result.errors.join('\n'), /npm run versionbump -- 1\.0\.6/u);
  assert.match(result.errors.join('\n'), /'release:yes'/u);
});

test('release:no scheitert bei niedrigerer Version', () => {
  const result = evaluateReleaseGate({ labels: [LABEL_NO], version: '1.0.5', baseVersion: '1.0.6' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /ist niedriger als 1\.0\.6/u);
});

test('eine unlesbare Merge-Base-Version überspringt den Versionsvergleich bei release:no', () => {
  assert.deepEqual(evaluateReleaseGate({ labels: [LABEL_NO], version: '9.9.9', baseVersion: null }), {
    ok: true,
    errors: [],
  });
});
