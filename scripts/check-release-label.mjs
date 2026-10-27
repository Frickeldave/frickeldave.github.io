import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { isValidSemver } from './versionbump.mjs';
import {
  BASE_REF_DEFAULT,
  DEV_RELEASE_TAG_PREFIX,
  LABEL_NO,
  LABEL_YES,
  REPO_ROOT,
  evaluateReleaseGate,
  findHighestDevReleaseVersion,
  readRootVersion,
} from './release-gate.mjs';

/**
 * CLI des Release-Gates. Zwei Betriebsarten, ein Regelwerk (`release-gate.mjs`):
 *
 * - CI-Modus (`--ci --repo <owner/repo> --base <ref>`): bindend. Labels kommen aus
 *   der `LABELS`-Env (der Workflow reicht `pull_request.labels.*.name` als JSON
 *   durch) oder ersatzweise über die GitHub-API aus `PR_NUMBER`. Infrastruktur-
 *   fehler werfen und lassen den Job sichtbar scheitern.
 * - Lokaler Modus (`.husky/pre-push`, ohne Argumente): liest Labels und Basisbranch
 *   des offenen PRs über `gh`. Fehlt `gh`, gibt es keinen PR, zeigt der PR nach
 *   `main` oder ist irgendetwas nicht lesbar, endet der Hook grün — er darf lokal
 *   nicht blockieren, wenn die Information fehlt; der PR-Check entscheidet dann.
 */

const GH_TIMEOUT_MS = 8000;

/**
 * @param {string[]} argv
 * @returns {{ ci: boolean; repo?: string; labels?: string; base?: string; 'pr-number'?: string }}
 */
export function parseArgs(argv) {
  /** @type {{ ci: boolean; repo?: string; labels?: string; base?: string; 'pr-number'?: string }} */
  const parsed = { ci: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--ci') {
      parsed.ci = true;
    } else if (arg === '--repo' || arg === '--labels' || arg === '--base' || arg === '--pr-number') {
      const value = argv[index + 1];
      if (!value) throw new Error(`Fehlender Wert für ${arg}`);
      parsed[/** @type {'repo'} */ (arg.slice(2))] = value;
      index += 1;
    } else {
      throw new Error(`Unbekanntes Argument: ${arg}`);
    }
  }
  return parsed;
}

/** @param {string} stdout */
function parseLines(stdout) {
  return String(stdout)
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * `gh api --jq '.[].tag_name'` gibt einen Tag pro Zeile aus (funktioniert auch mit
 * älteren `gh`-Versionen).
 * @param {string} stdout
 * @returns {{ tagName: string }[]}
 */
export function parseTags(stdout) {
  return parseLines(stdout).map((tagName) => ({ tagName }));
}

/**
 * Dieselbe Zeilenform für Label-Namen aus `gh api --jq '.labels[].name'`.
 * @param {string} stdout
 * @returns {string[]}
 */
export function parseLabelNames(stdout) {
  return parseLines(stdout);
}

/** @param {string} stdout */
export function parseJson(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

/**
 * Version der `package.json` an der Merge-Base von HEAD und `origin/<baseRef>`, oder
 * null wenn nicht lesbar. Verglichen wird bewusst die Merge-Base und nicht die
 * Spitze des Basisbranches: parallele Version-Bumps dort dürfen einen unberührten
 * `release:no`-PR nicht rot machen. Liest ausschließlich lokale Refs (kein Fetch).
 * @param {string} baseRef
 * @param {{ spawn?: typeof spawnSync; cwd?: string }} [deps]
 * @returns {string | null}
 */
export function readBaseVersion(baseRef, { spawn = spawnSync, cwd = REPO_ROOT } = {}) {
  try {
    const run = (/** @type {string[]} */ args) =>
      spawn('git', args, {
        cwd,
        encoding: 'utf8',
        timeout: GH_TIMEOUT_MS,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    const mergeBase = run(['merge-base', 'HEAD', `origin/${baseRef}`]);
    const commit = String(mergeBase.stdout ?? '').trim();
    if (mergeBase.error || mergeBase.status !== 0 || !commit) return null;
    const shown = run(['show', `${commit}:package.json`]);
    if (shown.error || shown.status !== 0 || typeof shown.stdout !== 'string') return null;
    const version = JSON.parse(shown.stdout)?.version;
    return typeof version === 'string' && isValidSemver(version) ? version : null;
  } catch {
    return null;
  }
}

/** @param {string} repo */
export function releaseListArgs(repo) {
  return ['api', '--paginate', `repos/${repo}/releases?per_page=100`, '--jq', '.[].tag_name'];
}

/** @param {string} repo @param {number | string} prNumber */
export function prLabelsArgs(repo, prNumber) {
  return ['api', `repos/${repo}/pulls/${prNumber}`, '--jq', '.labels[].name'];
}

/**
 * Hinweiszeilen für die Fehlermeldung des Hooks.
 * @param {number | string} nr
 * @param {string[]} labels
 */
export function buildHints(nr, labels) {
  const lines = [];
  if (labels.includes(LABEL_YES) && labels.includes(LABEL_NO)) {
    lines.push(`  gh pr edit ${nr} --remove-label ${LABEL_NO}   (oder --remove-label ${LABEL_YES})`);
  } else if (!labels.includes(LABEL_YES) && !labels.includes(LABEL_NO)) {
    lines.push(`  gh pr edit ${nr} --add-label ${LABEL_YES}   (neue Version, dev-Release)`);
    lines.push(`  gh pr edit ${nr} --add-label ${LABEL_NO}    (Version unverändert)`);
  }
  return lines;
}

/**
 * Logik des Husky-Hooks. Blockiert (Exit-Code 1) ausschließlich bei einem offenen
 * PR gegen den Zielbranch mit einem Regelverstoß; jedes Infrastrukturproblem endet
 * grün.
 * @param {{
 *   spawn?: typeof spawnSync;
 *   log?: (message: string) => void;
 *   readRootVersionFn?: typeof readRootVersion;
 *   readBaseVersionFn?: typeof readBaseVersion;
 * }} [deps]
 * @returns {{ code: 0 | 1; message: string | null }}
 */
export function runHook({
  spawn = spawnSync,
  log = console.error,
  readRootVersionFn = readRootVersion,
  readBaseVersionFn = readBaseVersion,
} = {}) {
  try {
    const gh = (/** @type {string[]} */ args) =>
      spawn('gh', args, {
        encoding: 'utf8',
        timeout: GH_TIMEOUT_MS,
        stdio: ['ignore', 'pipe', 'ignore'],
      });

    const prResult = gh(['pr', 'view', '--json', 'number,state,labels,baseRefName']);
    if (prResult.error || prResult.status !== 0 || !prResult.stdout) {
      return { code: 0, message: null };
    }
    const pr = parseJson(prResult.stdout);
    if (!pr || typeof pr !== 'object') return { code: 0, message: null };
    if (pr.baseRefName !== BASE_REF_DEFAULT || (pr.state && pr.state !== 'OPEN')) {
      return { code: 0, message: null };
    }

    const labels = (Array.isArray(pr.labels) ? pr.labels : [])
      .map((label) => label?.name)
      .filter((name) => typeof name === 'string');
    const onlyNo = labels.includes(LABEL_NO) && !labels.includes(LABEL_YES);

    // `release:no` vergleicht gegen die Merge-Base, alles andere gegen die Dev-Releases.
    // Eine unlesbare Basisversion oder Release-Liste blockiert den Push nie.
    /** @type {string | null} */
    let highestDevVersion = null;
    /** @type {string | null} */
    let baseVersion = null;
    if (onlyNo) {
      baseVersion = readBaseVersionFn(BASE_REF_DEFAULT, { spawn });
    } else {
      const releaseResult = gh(releaseListArgs('{owner}/{repo}'));
      if (
        releaseResult.error ||
        releaseResult.status !== 0 ||
        typeof releaseResult.stdout !== 'string'
      ) {
        return { code: 0, message: null };
      }
      highestDevVersion = findHighestDevReleaseVersion(parseTags(releaseResult.stdout));
    }

    const gate = evaluateReleaseGate({
      labels,
      version: readRootVersionFn(),
      highestDevVersion,
      baseVersion,
      baseRef: `origin/${BASE_REF_DEFAULT}`,
    });
    if (gate.ok) return { code: 0, message: null };

    const message = [
      `[release-gate] PR #${pr.number} -> ${BASE_REF_DEFAULT}: Push blockiert.`,
      ...gate.errors.map((error) => `  - ${error}`),
      ...buildHints(pr.number ?? '<nr>', labels),
      '  (umgehen: git push --no-verify; der PR-Check check-release-label bleibt bindend)',
    ].join('\n');
    log(message);
    return { code: 1, message };
  } catch {
    return { code: 0, message: null };
  }
}

/**
 * Logik des PR-Checks. Infrastrukturfehler werfen (der Job scheitert sichtbar).
 * Erwartet den PR-Head ausgecheckt und den Basisbranch gefetcht (`origin/<base>`).
 * @param {{ repo: string; labels: string[]; base?: string }} options
 * @param {{
 *   spawn?: typeof spawnSync;
 *   readRootVersionFn?: typeof readRootVersion;
 *   readBaseVersionFn?: typeof readBaseVersion;
 * }} [deps]
 */
export function runCi(
  { repo, labels, base = BASE_REF_DEFAULT },
  { spawn = spawnSync, readRootVersionFn = readRootVersion, readBaseVersionFn = readBaseVersion } = {}
) {
  const onlyNo = labels.includes(LABEL_NO) && !labels.includes(LABEL_YES);
  /** @type {string | null} */
  let highestDevVersion = null;
  /** @type {string | null} */
  let baseVersion = null;

  if (onlyNo) {
    baseVersion = readBaseVersionFn(base, { spawn });
    if (!baseVersion) {
      throw new Error(
        `Die package.json-Version an der Merge-Base mit origin/${base} ist nicht lesbar. ` +
          'PR-Head mit voller Historie auschecken (fetch-depth: 0).'
      );
    }
  } else {
    const result = spawn('gh', releaseListArgs(repo), { encoding: 'utf8' });
    if (result.error || result.status !== 0) {
      throw new Error(
        `Releases von ${repo} sind nicht lesbar: ${result.stderr || result.error || 'unbekannter Fehler'}`
      );
    }
    highestDevVersion = findHighestDevReleaseVersion(parseTags(result.stdout));
  }

  const version = readRootVersionFn();
  const gate = evaluateReleaseGate({ labels, version, highestDevVersion, baseVersion, baseRef: base });
  return { ...gate, version, highestDevVersion, baseVersion };
}

/**
 * Labels für den CI-Modus: `--labels`/`LABELS` gewinnt, sonst die GitHub-API über
 * `--pr-number`/`PR_NUMBER`.
 * @param {{ explicit?: string; prNumber?: string; repo: string; spawn?: typeof spawnSync }} options
 * @returns {string[]}
 */
export function resolveLabels({ explicit, prNumber, repo, spawn = spawnSync }) {
  if (explicit !== undefined && explicit !== '') {
    const parsed = parseJson(explicit);
    if (!Array.isArray(parsed)) throw new Error('--labels muss ein JSON-Array von Label-Namen sein.');
    return parsed.filter((name) => typeof name === 'string');
  }

  if (!prNumber) {
    throw new Error('Weder LABELS noch PR_NUMBER gesetzt — die PR-Labels sind nicht ermittelbar.');
  }

  const result = spawn('gh', prLabelsArgs(repo, prNumber), { encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    throw new Error(
      `Labels von PR #${prNumber} in ${repo} sind nicht lesbar: ` +
        `${result.stderr || result.error || 'unbekannter Fehler'}`
    );
  }
  return parseLabelNames(result.stdout);
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (!args.ci) {
    process.exitCode = runHook().code;
    return;
  }

  const repo = args.repo ?? process.env.GITHUB_REPOSITORY;
  if (!repo) throw new Error('Repository fehlt. --repo owner/name übergeben.');
  const base = args.base ?? process.env.BASE_REF ?? BASE_REF_DEFAULT;
  const labels = resolveLabels({
    explicit: args.labels ?? process.env.LABELS,
    prNumber: args['pr-number'] ?? process.env.PR_NUMBER,
    repo,
  });

  const result = runCi({ repo, labels, base });
  if (!result.ok) {
    for (const error of result.errors) console.error(`::error::${error.replace(/\n/gu, ' ')}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `Release-Gate bestanden: Version ${result.version}, höchstes dev-Release ` +
      `${result.highestDevVersion ? `${DEV_RELEASE_TAG_PREFIX}${result.highestDevVersion}` : 'keines'}, ` +
      `Merge-Base-Version ${result.baseVersion ?? 'n/a'}, Labels ${labels.join(', ') || 'keine'}.`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
