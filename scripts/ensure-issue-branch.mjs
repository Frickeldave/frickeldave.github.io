import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * Automatisierung der Issue-Branches.
 *
 * Branches folgen der Conventional-Branch-Name-Policy des Repositories —
 * `<type>/issue-<n>-<slug>` (z. B. `feat/issue-482-dark-software-factory`) —
 * weil `.husky/pre-push-validate.js` alles ablehnt, was nicht
 * `<type>/<optional-id>-<description>` mit einem Conventional-Commits-Typ ist.
 * Das frühere Schema `squad/<issue>-<type>` ist bewusst entfallen.
 */

export const DEFAULT_BASE_BRANCH = 'dev';
const ISSUE_TYPE_SLUGS = ['feature', 'bug', 'task', 'docs', 'chore', 'spike', 'epic'];

/**
 * Branch-Typen, die `.husky/pre-push-validate.js` akzeptiert. `squad` fehlt
 * bewusst: der Pre-Push-Hook lehnt `squad/<id>-<type>`-Branches ab, Issue-Branches
 * müssen deshalb `<type>/issue-<n>-<slug>` nutzen.
 */
export const CONVENTIONAL_BRANCH_TYPES = Object.freeze([
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'ci',
  'chore',
]);

export const DEFAULT_BRANCH_TYPE = 'feat';

const BRANCH_DESCRIPTION_MAX_LENGTH = 48;

const ISSUE_TYPE_TO_BRANCH_TYPE = Object.freeze({
  feature: 'feat',
  bug: 'fix',
  docs: 'docs',
  chore: 'chore',
  task: 'feat',
  spike: 'feat',
  epic: 'feat',
});

export async function run(env = process.env) {
  const repository = env.GITHUB_REPOSITORY;
  const issueNumber = Number(env.ISSUE_NUMBER);

  if (!repository) fail('Missing GITHUB_REPOSITORY');
  if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
    fail(`Invalid ISSUE_NUMBER: ${env.ISSUE_NUMBER ?? '(missing)'}`);
  }

  const [owner, repo] = repository.split('/');
  if (!owner || !repo) fail(`Invalid GITHUB_REPOSITORY: ${repository}`);

  const host = resolveGhHost(env);

  const issue = await loadIssueContext({ owner, repo, issueNumber, env, host });
  const labels = (issue.labels?.nodes ?? []).map((label) => label.name);

  if (!isSquadIssue(labels)) {
    log(`Issue #${issueNumber} is not a Squad-managed issue; skipping branch automation`);
    return;
  }

  const linkedBranchNames = collectLinkedBranchNames(issue);
  if (linkedBranchNames.length > 0) {
    log(`Issue #${issueNumber} already has linked branch(es): ${linkedBranchNames.join(', ')}`);
    return;
  }

  const branchName = buildIssueBranchName({
    type: deriveBranchType(labels),
    issueId: issueNumber,
    slug: issue.title || deriveIssueTypeSlug(labels),
  });
  await gh(
    [
      'issue',
      'develop',
      String(issueNumber),
      '--repo',
      hostQualifiedRepo(repository, host),
      '--base',
      DEFAULT_BASE_BRANCH,
      '--name',
      branchName,
    ],
    env
  );

  log(`Created and linked ${branchName} for issue #${issueNumber} from ${DEFAULT_BASE_BRANCH}`);
}

export function isSquadIssue(labels = []) {
  return labels.includes('squad') || labels.some((label) => label.startsWith('squad:'));
}

export function deriveIssueTypeSlug(labels = []) {
  for (const typeSlug of ISSUE_TYPE_SLUGS) {
    if (labels.includes(`type:${typeSlug}`)) {
      return typeSlug;
    }
  }

  const firstTypeLabel = labels.find((label) => label.startsWith('type:'));
  if (firstTypeLabel) {
    const candidate = firstTypeLabel.slice('type:'.length).trim();
    if (candidate) return candidate;
  }

  return 'work-item';
}

/**
 * Bildet das `type:*`-Label des Issues auf einen Conventional-Branch-Name-Typ ab.
 * Unbekannte oder fehlende Typ-Labels fallen auf `feat` zurück.
 */
export function deriveBranchType(labels = []) {
  return ISSUE_TYPE_TO_BRANCH_TYPE[deriveIssueTypeSlug(labels)] ?? DEFAULT_BRANCH_TYPE;
}

/**
 * Baut einen Issue-Branch-Namen, der die Conventional-Branch-Name-Policy des
 * Repositories erfüllt: `<type>/issue-<n>-<slug>`, z. B.
 * `feat/issue-482-dark-software-factory`.
 *
 * Das ist die eine gemeinsame Quelle mit `scripts/start-work.mjs`, damit die beiden
 * Abläufe nicht auseinanderlaufen. `.husky/pre-push-validate.js` akzeptiert nur
 * `<type>/<optional-id>-<description>` mit einem Conventional-Commits-Typ; `squad`
 * wird deshalb hier abgelehnt, statt einen Branch zu erzeugen, der sich nicht
 * pushen lässt.
 */
export function buildIssueBranchName({ type = DEFAULT_BRANCH_TYPE, issueId, slug }) {
  const branchType = normalizeBranchType(type);
  const numericId = Number(issueId);

  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new Error(`Invalid issue number for a branch name: ${issueId ?? '(missing)'}`);
  }

  const description = slugifyBranchDescription(slug);
  if (!description) {
    throw new Error(`Could not derive a branch description from "${slug ?? ''}".`);
  }

  return `${branchType}/issue-${numericId}-${description}`;
}

/**
 * Normalisiert beliebigen Text (Issue-Titel oder bereits geslugten Wert) zu einem
 * Branch-Beschreibungssegment: ASCII-Kebap-Schreibweise in Kleinbuchstaben ohne
 * führende oder nachgestellte Bindestriche, auf 48 Zeichen begrenzt.
 */
export function slugifyBranchDescription(value = '') {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, BRANCH_DESCRIPTION_MAX_LENGTH)
    .replace(/-+$/g, '');
}

function normalizeBranchType(type) {
  const normalizedType = String(type ?? '')
    .trim()
    .toLowerCase();

  if (!CONVENTIONAL_BRANCH_TYPES.includes(normalizedType)) {
    throw new Error(
      `Invalid branch type "${type ?? '(missing)'}" — expected one of: ${CONVENTIONAL_BRANCH_TYPES.join(', ')}`
    );
  }

  return normalizedType;
}

export function collectLinkedBranchNames(issue) {
  return (issue.linkedBranches?.nodes ?? []).map((node) => node?.ref?.name).filter(Boolean);
}

async function loadIssueContext({ owner, repo, issueNumber, env, host }) {
  const query = `query IssueBranchContext($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) {
        number
        title
        labels(first: 20) {
          nodes {
            name
          }
        }
        linkedBranches(first: 20) {
          nodes {
            ref {
              name
            }
          }
        }
      }
    }
  }`;

  const args = [
    'api',
    'graphql',
    '-f',
    `query=${query}`,
    '-F',
    `owner=${owner}`,
    '-F',
    `repo=${repo}`,
    '-F',
    `number=${issueNumber}`,
  ];
  if (host) args.push('--hostname', host);

  const payload = JSON.parse(await gh(args, env));

  const issue = payload.data?.repository?.issue;
  if (!issue) fail(`Issue #${issueNumber} not found in ${owner}/${repo}`);
  return issue;
}

// Die `gh`-CLI zielt nur dann automatisch auf github.com, wenn explizit ein
// `--repo` (oder `--hostname`) ohne Host angegeben wird. Auf GitHub-Enterprise-
// Server- / GHEC-Hosts (z. B. *.ghe.com) schickt sie das host-gebundene Token
// still an github.com und scheitert mit „Bad credentials (HTTP 401)“ — derselbe
// Fehlermodus, der für die Promote-Workflows in #575/#577 behoben wurde. Actions
// injiziert `GITHUB_SERVER_URL` immer mit dem echten Host, deshalb leiten wir ihn
// daraus ab und geben ihn bei jedem `gh`-Aufruf explizit mit (`--repo host/owner/repo`,
// `--hostname host`), statt uns auf `GH_HOST`/Env-Variablen zu verlassen.
export function resolveGhHost(env = process.env) {
  if (!env.GITHUB_SERVER_URL) return undefined;
  try {
    return new URL(env.GITHUB_SERVER_URL).host;
  } catch {
    return undefined;
  }
}

export function hostQualifiedRepo(repository, host) {
  return host ? `${host}/${repository}` : repository;
}

async function gh(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn('gh', args, {
      env: {
        ...process.env,
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }

      reject(
        new Error(
          stderr.trim() || stdout.trim() || `gh ${args.join(' ')} failed with exit code ${code}`
        )
      );
    });
  });
}

function log(message) {
  console.log(`[ensure-issue-branch] ${message}`);
}

function fail(message) {
  throw new Error(`[ensure-issue-branch] ${message}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
