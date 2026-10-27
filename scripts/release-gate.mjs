import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareSemver, isValidSemver, readVersion } from './versionbump.mjs';

/**
 * Gemeinsame Regel-Logik des Release-Gates.
 *
 * Dieselben Regeln gelten im PR-Check (`fd-pr-release-label.yml` →
 * `check-release-label.mjs --ci`) und im lokalen Husky-Hook (`.husky/pre-push`).
 * Dieses Modul ist rein: es liest keine Umgebung, ruft kein `git`/`gh` auf und
 * schreibt nichts. Alles, was von außen kommt (Labels, Versionen), wird hereingereicht.
 *
 * Regeln:
 * - genau eines der Labels `release:yes` / `release:no` am Pull Request;
 * - `release:yes` → Version in `package.json` strikt größer als das höchste
 *   `dev-v*`-Release (ohne vorhandenes Dev-Release entfällt der Vergleich);
 * - `release:no` → Version exakt die Version an der Merge-Base mit dem Basisbranch,
 *   damit der PR die Version nicht anfasst.
 */

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEV_RELEASE_TAG_PREFIX = 'dev-v';
export const LABEL_YES = 'release:yes';
export const LABEL_NO = 'release:no';
export const BASE_REF_DEFAULT = 'dev';

const BUMP_COMMAND = 'npm run versionbump -- x.y.z';

/**
 * Liefert die Version eines `dev-v<x.y.z>`-Tags oder null, wenn der Tag nicht zu
 * diesem Namensschema passt.
 * @param {string} tagName
 * @returns {string | null}
 */
export function extractDevReleaseVersion(tagName) {
  if (typeof tagName !== 'string' || !tagName.startsWith(DEV_RELEASE_TAG_PREFIX)) {
    return null;
  }

  const version = tagName.slice(DEV_RELEASE_TAG_PREFIX.length);
  return isValidSemver(version) ? version : null;
}

/**
 * Akzeptiert `gh release list --json tagName`- und REST-förmige (`tag_name`) Einträge.
 * Liefert die höchste `dev-v*`-Version oder null, wenn es noch kein Dev-Release gibt.
 * @param {{ tag_name?: unknown; tagName?: unknown }[]} releases
 * @returns {string | null}
 */
export function findHighestDevReleaseVersion(releases) {
  /** @type {string | null} */
  let highest = null;

  for (const release of Array.isArray(releases) ? releases : []) {
    const rawTag =
      typeof release?.tagName === 'string'
        ? release.tagName
        : typeof release?.tag_name === 'string'
          ? release.tag_name
          : null;
    if (!rawTag) continue;

    const version = extractDevReleaseVersion(rawTag);
    if (!version) continue;

    if (!highest || compareSemver(version, highest) > 0) {
      highest = version;
    }
  }

  return highest;
}

/**
 * Liest die Version aus der `package.json` eines Checkouts. Dieses Repository hat
 * keine npm-Workspaces, deshalb gibt es — anders als im Ursprungsprojekt — keine
 * Workspace-Konsistenzprüfung.
 * @param {string} [repoRoot]
 * @returns {string}
 */
export function readRootVersion(repoRoot = REPO_ROOT) {
  return readVersion(path.join(repoRoot, 'package.json'));
}

/**
 * Ein Regelwerk für Hook und PR-Check.
 *
 * Ein `null` bei `highestDevVersion` bzw. `baseVersion` überspringt den jeweiligen
 * Versionsvergleich: ohne Dev-Release ist bei `release:yes` nur die Label-Regel zu
 * erfüllen, und ohne lesbare Merge-Base-Version entscheidet der PR-Check.
 * @param {{
 *   labels: string[];
 *   version: string;
 *   highestDevVersion?: string | null;
 *   baseVersion?: string | null;
 *   baseRef?: string;
 * }} input
 * @returns {{ ok: boolean; errors: string[] }}
 */
export function evaluateReleaseGate({
  labels,
  version,
  highestDevVersion = null,
  baseVersion = null,
  baseRef = BASE_REF_DEFAULT,
}) {
  /** @type {string[]} */
  const errors = [];
  const names = Array.isArray(labels) ? labels : [];
  const yes = names.includes(LABEL_YES);
  const no = names.includes(LABEL_NO);

  if (yes && no) {
    errors.push(
      `Beide Labels gesetzt: '${LABEL_YES}' und '${LABEL_NO}' schließen sich aus. ` +
        `Entferne eines davon: gh pr edit <nr> --remove-label ${LABEL_NO}`
    );
  } else if (!yes && !no) {
    errors.push(
      `Kein Release-Label: setze genau eines von '${LABEL_YES}' (neue Version, dev-Release ` +
        `beim Deploy) oder '${LABEL_NO}' (Version bleibt unverändert).`
    );
  }

  if (!isValidSemver(version)) {
    errors.push(`Die Version in package.json muss strikt X.Y.Z sein, gefunden: "${version}".`);
    return { ok: false, errors };
  }

  if (yes && !no && highestDevVersion && compareSemver(version, highestDevVersion) <= 0) {
    errors.push(
      `'${LABEL_YES}' verlangt eine Version größer als das höchste dev-Release ` +
        `${highestDevVersion} (${DEV_RELEASE_TAG_PREFIX}${highestDevVersion}), ` +
        `package.json ist aber ${version}. Version anheben: ${BUMP_COMMAND}`
    );
  }

  if (no && !yes && baseVersion && version !== baseVersion) {
    const direction = compareSemver(version, baseVersion) > 0 ? 'höher' : 'niedriger';
    errors.push(
      `'${LABEL_NO}' darf die Version nicht ändern: package.json ${version} ist ${direction} ` +
        `als ${baseVersion} an der Merge-Base mit ${baseRef}. Entweder zurück auf ` +
        `${baseVersion} setzen (npm run versionbump -- ${baseVersion}) oder '${LABEL_YES}' setzen.`
    );
  }

  return { ok: errors.length === 0, errors };
}
