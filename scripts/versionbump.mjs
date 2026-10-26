#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Versions-Bump für dieses Single-Package-Repository.
 *
 * Ein Bump ist nur sinnvoll, wenn er zugleich eine passende `## [x.y.z]`-Sektion
 * in `CHANGELOG.md` öffnet, weil `.github/workflows/fd-deploy-prd.yml` vor dem
 * Promote genau nach dieser Überschrift grept. Ein Bump, der nur `package.json`
 * umschreibt, würde damit jedes Release blockieren; deshalb verschiebt dieses
 * Skript den aktuellen Inhalt von `## [Unreleased]` in die neue Release-Sektion
 * und lässt ein leeres `## [Unreleased]` zurück.
 *
 * Übernommen aus `no_sync/scripts/versionbump.mjs`, ohne die
 * Workspace-Erkennung (hier gibt es kein `apps/` oder `packages/`), mit
 * `node:readline/promises` statt `prompts` und mit ergänztem Changelog-Schritt.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, 'package.json');
const PACKAGE_LOCK_PATH = path.join(REPO_ROOT, 'package-lock.json');
const CHANGELOG_PATH = path.join(REPO_ROOT, 'CHANGELOG.md');

const UNRELEASED_HEADING = '## [Unreleased]';
const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/u;
const RELEASE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const NEXT_SECTION_PATTERN = /^## \[/mu;
const USAGE = 'Usage: node scripts/versionbump.mjs [x.y.z]';

/**
 * Liest das Feld `version` einer package.json.
 * @param {string} packageJsonPath
 */
export function readVersion(packageJsonPath) {
  const content = readFileSync(packageJsonPath, 'utf8');
  const parsed = JSON.parse(content);
  if (typeof parsed.version !== 'string') {
    throw new Error(`${packageJsonPath} has no string "version" field`);
  }
  return parsed.version;
}

/** @param {string} version */
export function isValidSemver(version) {
  return SEMVER_PATTERN.test(version);
}

/**
 * Vergleicht zwei `major.minor.patch`-Versionen. Liefert eine positive Zahl,
 * wenn `a` größer ist, eine negative, wenn kleiner, und Null bei Gleichstand.
 * Bewusst genauso streng wie die `is_semver`/`version_is_greater`-Bash-Helfer
 * des Workflows: Pre-Release- und Build-Metadata-Segmente werden nicht verstanden.
 * @param {string} a
 * @param {string} b
 */
export function compareSemver(a, b) {
  const partsA = SEMVER_PATTERN.exec(a);
  const partsB = SEMVER_PATTERN.exec(b);
  if (!partsA || !partsB) {
    throw new Error(`compareSemver requires two X.Y.Z versions, got "${a}" and "${b}"`);
  }
  for (let index = 1; index <= 3; index += 1) {
    const difference = Number(partsA[index]) - Number(partsB[index]);
    if (difference !== 0) return difference;
  }
  return 0;
}

/** @param {string} candidate @param {string} current */
export function isVersionGreater(candidate, current) {
  return compareSemver(candidate, current) > 0;
}

/**
 * Liefert eine Fehlermeldung, wenn `candidate` nicht als nächste Version taugt,
 * sonst null.
 * @param {string} candidate
 * @param {string} currentVersion
 */
export function validateTargetVersion(candidate, currentVersion) {
  if (!isValidSemver(candidate)) {
    return 'Version must look like X.Y.Z (numbers only, no pre-release/build suffix).';
  }
  if (!isVersionGreater(candidate, currentVersion)) {
    return `New version must be greater than the current version (${currentVersion}).`;
  }
  return null;
}

/**
 * Lokales Kalenderdatum in der Form `YYYY-MM-DD`, wie sie die Release-Überschriften
 * im Changelog nutzen.
 * @param {Date} date
 */
export function formatReleaseDate(date = new Date()) {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * @param {{ currentVersion: string; newVersion: string; dateLabel: string }} input
 */
export function formatVersionOverview({ currentVersion, newVersion, dateLabel }) {
  return [
    `  package.json          ${currentVersion}  ->  ${newVersion}`,
    `  package-lock.json     refreshed via "npm install --package-lock-only"`,
    `  CHANGELOG.md          new section "## [${newVersion}] - ${dateLabel}",`,
    `                        "## [Unreleased]" stays behind but is empty`,
  ].join('\n');
}

/**
 * Wahr, wenn der Changelog `version` bereits dokumentiert, unabhängig vom
 * angehängten Datum.
 * @param {string} changelog
 * @param {string} version
 */
export function hasVersionSection(changelog, version) {
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return new RegExp(`^## \\[${escaped}\\]`, 'mu').test(changelog);
}

/**
 * Verschiebt alles unter `## [Unreleased]` in eine neue Sektion
 * `## [x.y.z] - <date>` und lässt ein leeres `## [Unreleased]` zurück.
 *
 * Reine String-Transformation: Bei jeder Eingabe, die sich nicht sauber
 * freigeben lässt, wirft sie, damit der Aufrufer entscheiden kann, gar nichts
 * zu schreiben.
 * @param {string} changelog
 * @param {string} version
 * @param {string} dateLabel
 */
export function transformChangelog(changelog, version, dateLabel) {
  if (!isValidSemver(version)) {
    throw new Error(`Cannot create a changelog section for version "${version}": expected X.Y.Z.`);
  }
  if (!RELEASE_DATE_PATTERN.test(dateLabel)) {
    throw new Error(`Invalid release date "${dateLabel}": expected YYYY-MM-DD.`);
  }
  if (hasVersionSection(changelog, version)) {
    throw new Error(
      `CHANGELOG.md already has a "## [${version}]" section; refusing to add a second one.`
    );
  }

  const unreleasedMatches = [...changelog.matchAll(/^## \[Unreleased\][ \t]*\r?$/gmu)];
  if (unreleasedMatches.length === 0) {
    throw new Error(`CHANGELOG.md has no "${UNRELEASED_HEADING}" section; nothing to release.`);
  }
  if (unreleasedMatches.length > 1) {
    throw new Error(
      `CHANGELOG.md has ${unreleasedMatches.length} "${UNRELEASED_HEADING}" sections; expected exactly one.`
    );
  }

  const [unreleasedMatch] = unreleasedMatches;
  const bodyStart = unreleasedMatch.index + unreleasedMatch[0].length;
  const remainder = changelog.slice(bodyStart);
  const nextSectionOffset = remainder.search(NEXT_SECTION_PATTERN);
  const bodyEnd = nextSectionOffset === -1 ? changelog.length : bodyStart + nextSectionOffset;

  const content = changelog.slice(bodyStart, bodyEnd).trim();
  if (content === '') {
    throw new Error(
      `The "${UNRELEASED_HEADING}" section is empty; add the release notes before bumping.`
    );
  }

  const preamble = changelog.slice(0, unreleasedMatch.index).replace(/\s+$/u, '');
  const tail = changelog.slice(bodyEnd).replace(/^[ \t]*\r?\n*/u, '');
  const eol = changelog.includes('\r\n') ? '\r\n' : '\n';

  const head = preamble === '' ? '' : `${preamble}${eol}${eol}`;
  const emptyUnreleased = `${UNRELEASED_HEADING}${eol}${eol}`;
  const releaseSection = `## [${version}] - ${dateLabel}${eol}${eol}${content}${eol}`;
  const trailingSection = tail === '' ? '' : `${eol}${tail}`;

  return `${head}${emptyUnreleased}${releaseSection}${trailingSection}`;
}

/**
 * Schreibt das Feld `version` an Ort und Stelle neu und lässt die übrige
 * Formatierung der Datei unangetastet.
 * @param {string} packageJsonPath
 * @param {string} newVersion
 */
export function writeVersion(packageJsonPath, newVersion) {
  const content = readFileSync(packageJsonPath, 'utf8');
  const updated = content.replace(
    /"version"\s*:\s*"(?:[^"\\]|\\.)*"/u,
    `"version": "${newVersion}"`
  );
  if (updated === content) {
    throw new Error(`Could not find a "version" field to replace in ${packageJsonPath}`);
  }
  writeFileSync(packageJsonPath, updated);
}

/**
 * Fragt die Zielversion ab, bis die Antwort gültig ist. Eine leere Antwort oder
 * ein geschlossener Eingabestrom bricht ab und liefert null.
 * @param {{ currentVersion: string; input?: NodeJS.ReadableStream; output?: NodeJS.WritableStream }} options
 */
export async function promptForVersion({
  currentVersion,
  input = process.stdin,
  output = process.stdout,
}) {
  const readline = createInterface({ input, output });
  const question = `Enter the new version (must be greater than ${currentVersion}, empty aborts): `;

  try {
    for (;;) {
      const rawAnswer = await readAnswer(readline, question);
      if (rawAnswer === null) {
        output.write('\nAborted: no version entered.\n');
        return null;
      }

      const answer = rawAnswer.trim();
      if (answer === '') {
        output.write('Aborted: no version entered.\n');
        return null;
      }

      const error = validateTargetVersion(answer, currentVersion);
      if (error === null) return answer;
      output.write(`${error}\n`);
    }
  } finally {
    readline.close();
  }
}

/**
 * `readline.question()` wird nie fertig, wenn der Eingabestrom endet; deshalb
 * läuft das Promise gegen das `close`-Event des Interface im Rennen.
 * @param {import('node:readline/promises').Interface} readline
 * @param {string} question
 */
function readAnswer(readline, question) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      readline.off('close', onClose);
      resolve(value);
    };
    const onClose = () => finish(null);

    readline.once('close', onClose);
    try {
      void readline.question(question).then(
        (value) => finish(value),
        () => finish(null)
      );
    } catch {
      finish(null);
    }
  });
}

/**
 * Schreibt package.json und die Changelog-Sektion und aktualisiert danach das
 * Lockfile. Liefert den Exit-Code des Prozesses.
 * @param {{ newVersion: string; updatedChangelog: string }} input
 */
function applyRelease({ newVersion, updatedChangelog }) {
  writeVersion(PACKAGE_JSON_PATH, newVersion);
  writeFileSync(CHANGELOG_PATH, updatedChangelog, 'utf8');

  console.log(`\nBumped package.json and CHANGELOG.md to ${newVersion}.`);

  if (!existsSync(PACKAGE_LOCK_PATH)) {
    console.log('No package-lock.json found - skipping the lockfile refresh.');
    return 0;
  }

  console.log('Regenerating package-lock.json...');
  const npmResult = spawnSync('npm', ['install', '--package-lock-only'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (npmResult.status !== 0) {
    console.error('\nnpm install --package-lock-only failed. Review the output above.');
    return 1;
  }
  return 0;
}

/** @param {string[]} argv */
export async function main(argv = process.argv.slice(2)) {
  if (argv.length > 1) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  const currentVersion = readVersion(PACKAGE_JSON_PATH);
  const dateLabel = formatReleaseDate();

  console.log(`Current version: ${currentVersion}\n`);

  /** @type {string | undefined} */
  let newVersion = argv[0];

  if (newVersion !== undefined) {
    const error = validateTargetVersion(newVersion, currentVersion);
    if (error) {
      console.error(`Invalid target version "${newVersion}": ${error}`);
      process.exitCode = 1;
      return;
    }
  } else {
    const answer = await promptForVersion({ currentVersion });
    if (answer === null) {
      process.exitCode = 1;
      return;
    }
    newVersion = answer;
  }

  // Vor dem ersten Schreibzugriff abbrechen, wenn der Changelog nicht freigegeben werden kann.
  const updatedChangelog = transformChangelog(
    readFileSync(CHANGELOG_PATH, 'utf8'),
    newVersion,
    dateLabel
  );

  console.log('Planned changes:\n');
  console.log(formatVersionOverview({ currentVersion, newVersion, dateLabel }));
  console.log('');

  const exitCode = applyRelease({ newVersion, updatedChangelog });
  if (exitCode !== 0) {
    process.exitCode = exitCode;
    return;
  }

  console.log(
    `\nDone. Review the diff, then commit and push manually - this script does not commit,\n` +
      `push, or trigger a deployment on its own.`
  );
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
