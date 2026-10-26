import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PassThrough, Readable } from 'node:stream';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  compareSemver,
  formatReleaseDate,
  formatVersionOverview,
  hasVersionSection,
  isValidSemver,
  promptForVersion,
  readVersion,
  transformChangelog,
  validateTargetVersion,
  writeVersion,
} from './versionbump.mjs';

const CHANGELOG_PATH = fileURLToPath(new URL('../CHANGELOG.md', import.meta.url));

const FIXTURE_CHANGELOG = `# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- New feature (#1).

### Fixed

- Bug fix (#2).

## [1.0.3] - 2026-09-14

### Added

- Older release (#3).
`;

const FIXTURE_RELEASED = `# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [1.0.4] - 2026-10-26

### Added

- New feature (#1).

### Fixed

- Bug fix (#2).

## [1.0.3] - 2026-09-14

### Added

- Older release (#3).
`;

/** Waits until `predicate()` is true so stream-driven prompt tests stay deterministic. */
async function waitFor(predicate, description) {
  const deadline = Date.now() + 2000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for: ${description}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test('isValidSemver accepts only plain X.Y.Z versions', () => {
  assert.equal(isValidSemver('1.0.4'), true);
  assert.equal(isValidSemver('0.0.1'), true);
  assert.equal(isValidSemver('12.34.56'), true);

  assert.equal(isValidSemver('1.0'), false, 'two segments are not enough');
  assert.equal(isValidSemver('1'), false);
  assert.equal(isValidSemver('1.0.4.5'), false);
  assert.equal(isValidSemver('1.0.4-beta.1'), false, 'pre-release suffixes are rejected');
  assert.equal(isValidSemver('1.0.4+build.7'), false, 'build metadata is rejected');
  assert.equal(isValidSemver('v1.0.4'), false);
  assert.equal(isValidSemver(' 1.0.4'), false);
  assert.equal(isValidSemver('1.0.x'), false);
});

test('compareSemver orders versions by major, minor and patch', () => {
  assert.ok(compareSemver('1.0.4', '1.0.3') > 0);
  assert.ok(compareSemver('1.1.0', '1.0.9') > 0);
  assert.ok(compareSemver('2.0.0', '1.99.99') > 0);
  assert.ok(compareSemver('1.0.3', '1.0.4') < 0);
  assert.ok(compareSemver('1.0.3', '1.1.0') < 0);
  assert.equal(compareSemver('1.0.3', '1.0.3'), 0);
  assert.equal(compareSemver('0.0.0', '0.0.0'), 0);
});

test('compareSemver rejects inputs that are not X.Y.Z', () => {
  assert.throws(() => compareSemver('1.0', '1.0.3'), /requires two X\.Y\.Z versions/u);
  assert.throws(() => compareSemver('1.0.3', '1.0.3-rc.1'), /requires two X\.Y\.Z versions/u);
});

test('validateTargetVersion accepts an increase and rejects everything else', () => {
  assert.equal(validateTargetVersion('1.0.4', '1.0.3'), null);
  assert.equal(validateTargetVersion('2.0.0', '1.0.3'), null);

  assert.match(
    validateTargetVersion('1.0.4-rc.1', '1.0.3'),
    /must look like X\.Y\.Z/u,
    'an invalid shape explains the expected format'
  );
  assert.match(
    validateTargetVersion('1.0.3', '1.0.3'),
    /must be greater than the current version \(1\.0\.3\)/u,
    'equal versions are not an increase'
  );
  assert.match(validateTargetVersion('1.0.2', '1.0.3'), /must be greater than the current version/u);
  assert.match(validateTargetVersion('0.9.9', '1.0.3'), /must be greater than the current version/u);
});

test('formatReleaseDate pads month and day to YYYY-MM-DD', () => {
  assert.equal(formatReleaseDate(new Date(2026, 9, 26)), '2026-10-26');
  assert.equal(formatReleaseDate(new Date(2026, 0, 5)), '2026-01-05');
  assert.match(formatReleaseDate(), /^\d{4}-\d{2}-\d{2}$/u);
});

test('hasVersionSection detects an existing release heading', () => {
  assert.equal(hasVersionSection(FIXTURE_CHANGELOG, '1.0.3'), true);
  assert.equal(hasVersionSection(FIXTURE_CHANGELOG, '1.0.4'), false);
  assert.equal(hasVersionSection(FIXTURE_CHANGELOG, 'Unreleased'), true);
});

test('transformChangelog moves the Unreleased content into the new release section', () => {
  assert.equal(transformChangelog(FIXTURE_CHANGELOG, '1.0.4', '2026-10-26'), FIXTURE_RELEASED);
});

test('transformChangelog leaves an empty but present Unreleased section behind', () => {
  const transformed = transformChangelog(FIXTURE_CHANGELOG, '1.0.4', '2026-10-26');
  const unreleasedIndex = transformed.indexOf('## [Unreleased]\n');
  const nextHeadingIndex = transformed.indexOf('\n## [1.0.4] - 2026-10-26', unreleasedIndex);

  assert.ok(unreleasedIndex >= 0, 'Unreleased heading is kept');
  assert.ok(nextHeadingIndex > unreleasedIndex, 'the new release section follows Unreleased');
  assert.equal(
    transformed.slice(unreleasedIndex + '## [Unreleased]'.length, nextHeadingIndex).trim(),
    '',
    'Unreleased contains neither leftover content nor subsections'
  );
  assert.equal(transformed.match(/^## \[Unreleased\]/gmu)?.length, 1);
});

test('transformChangelog releases the section when Unreleased is the last section', () => {
  const changelog = `# Changelog\n\n## [Unreleased]\n\n### Added\n\n- Only item.\n`;
  assert.equal(
    transformChangelog(changelog, '0.2.0', '2026-01-05'),
    `# Changelog\n\n## [Unreleased]\n\n## [0.2.0] - 2026-01-05\n\n### Added\n\n- Only item.\n`
  );
});

test('transformChangelog keeps CRLF line endings when the changelog uses them', () => {
  const crlf =
    '# Changelog\r\n\r\n## [Unreleased]\r\n\r\n### Added\r\n\r\n- Item.\r\n\r\n' +
    '## [1.0.0] - 2026-01-01\r\n\r\n### Added\r\n\r\n- Initial.\r\n';

  const transformed = transformChangelog(crlf, '1.0.1', '2026-02-02');

  assert.equal(
    transformed,
    '# Changelog\r\n\r\n## [Unreleased]\r\n\r\n## [1.0.1] - 2026-02-02\r\n\r\n### Added\r\n\r\n- Item.\r\n\r\n' +
      '## [1.0.0] - 2026-01-01\r\n\r\n### Added\r\n\r\n- Initial.\r\n'
  );
  assert.ok(!/[^\r]\n/u.test(transformed), 'no bare LF line endings are introduced');
});

test('transformChangelog refuses a version that already has a section', () => {
  assert.throws(
    () => transformChangelog(FIXTURE_CHANGELOG, '1.0.3', '2026-10-26'),
    /already has a "## \[1\.0\.3\]" section/u
  );
});

test('transformChangelog refuses a changelog without an Unreleased section', () => {
  const changelog = '# Changelog\n\n## [1.0.0] - 2026-01-01\n\n### Added\n\n- Initial.\n';
  assert.throws(
    () => transformChangelog(changelog, '1.0.1', '2026-10-26'),
    /has no "## \[Unreleased\]" section/u
  );
});

test('transformChangelog refuses an empty Unreleased section', () => {
  const changelog = '# Changelog\n\n## [Unreleased]\n\n## [1.0.0] - 2026-01-01\n\n### Added\n\n- Initial.\n';
  assert.throws(
    () => transformChangelog(changelog, '1.0.1', '2026-10-26'),
    /section is empty/u
  );
});

test('transformChangelog refuses to create the release section twice', () => {
  const released = transformChangelog(FIXTURE_CHANGELOG, '1.0.4', '2026-10-26');
  assert.throws(
    () => transformChangelog(released, '1.0.4', '2026-10-26'),
    /already has a "## \[1\.0\.4\]" section/u,
    'a second run on the released text fails instead of duplicating the section'
  );
  assert.equal(released, FIXTURE_RELEASED, 'the failed second run did not alter the input');
});

test('transformChangelog validates its version and date arguments', () => {
  assert.throws(
    () => transformChangelog(FIXTURE_CHANGELOG, '1.0', '2026-10-26'),
    /expected X\.Y\.Z/u
  );
  assert.throws(
    () => transformChangelog(FIXTURE_CHANGELOG, '1.0.4', '26.10.2026'),
    /expected YYYY-MM-DD/u
  );
});

test('formatVersionOverview names package.json, the lockfile and the changelog section', () => {
  const overview = formatVersionOverview({
    currentVersion: '1.0.3',
    newVersion: '1.0.4',
    dateLabel: '2026-10-26',
  });

  assert.match(overview, /package\.json\s+1\.0\.3\s+->\s+1\.0\.4/u);
  assert.match(overview, /package-lock\.json/u);
  assert.match(overview, /## \[1\.0\.4\] - 2026-10-26/u);
});

test('readVersion and writeVersion round-trip a package.json without touching the real one', () => {
  const directory = mkdtempSync(path.join(import.meta.dirname, '.versionbump-test-'));

  try {
    const packageJsonPath = path.join(directory, 'package.json');
    writeFileSync(packageJsonPath, '{\n  "name": "fixture",\n  "version": "1.0.3"\n}\n');

    assert.equal(readVersion(packageJsonPath), '1.0.3');

    writeVersion(packageJsonPath, '1.0.4');

    const updated = readFileSync(packageJsonPath, 'utf8');
    assert.equal(readVersion(packageJsonPath), '1.0.4');
    assert.match(updated, /"name": "fixture"/u, 'the surrounding fields survive the rewrite');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('promptForVersion re-asks after an invalid answer', async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  let printed = '';
  output.on('data', (chunk) => {
    printed += chunk.toString();
  });

  const answer = promptForVersion({ currentVersion: '1.0.3', input, output });

  await waitFor(() => countOccurrences(printed, 'Enter the new version') === 1, 'the first prompt');
  input.write('1.0.2\n');

  await waitFor(
    () => countOccurrences(printed, 'Enter the new version') === 2,
    'the re-prompt after the rejected answer'
  );
  assert.match(printed, /New version must be greater than the current version \(1\.0\.3\)\./u);

  input.write('1.0.4\n');

  assert.equal(await answer, '1.0.4');
});

test('promptForVersion aborts on an empty answer', async () => {
  const output = new PassThrough();
  let printed = '';
  output.on('data', (chunk) => {
    printed += chunk.toString();
  });

  const answer = await promptForVersion({
    currentVersion: '1.0.3',
    input: Readable.from(['\n']),
    output,
  });

  assert.equal(answer, null);
  assert.match(printed, /Aborted: no version entered/u);
});

test('promptForVersion aborts when the input stream ends', async () => {
  const output = new PassThrough();
  output.resume();

  const answer = await promptForVersion({
    currentVersion: '1.0.3',
    input: Readable.from([]),
    output,
  });

  assert.equal(answer, null);
});

test('the real CHANGELOG.md can be released without losing its Unreleased content', (t) => {
  const changelog = readFileSync(CHANGELOG_PATH, 'utf8');
  const unreleased = /^## \[Unreleased\][ \t]*\n([\s\S]*?)^## \[/mu.exec(changelog);

  assert.ok(unreleased, 'CHANGELOG.md keeps an Unreleased section above the released ones');
  if (unreleased[1].trim() === '') {
    t.skip('Unreleased is currently empty, so there is nothing to release');
    return;
  }

  const transformed = transformChangelog(changelog, '999.0.0', '2030-01-01');

  assert.ok(!changelog.includes('## [999.0.0]'), 'the fixture version is not used by the repository');
  assert.match(transformed, /^## \[Unreleased\]\n\n## \[999\.0\.0\] - 2030-01-01\n\n### /mu);
  assert.ok(
    transformed.includes(unreleased[1].trim()),
    'the previous Unreleased content lives on in the new release section'
  );
  assert.equal(
    transformed.match(/^## \[Unreleased\]/gmu)?.length,
    1,
    'exactly one Unreleased heading remains'
  );
});
