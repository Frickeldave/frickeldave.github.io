import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const DEFAULT_BASE_BRANCH = 'dev';
const ISSUE_TYPE_SLUGS = ['feature', 'bug', 'task', 'docs', 'chore', 'spike', 'epic'];

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

  const branchName = buildIssueBranchName({ issueNumber, labels });
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

export function buildIssueBranchName({ issueNumber, labels = [] }) {
  return `squad/${issueNumber}-${deriveIssueTypeSlug(labels)}`;
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

// The `gh` CLI only auto-targets github.com when explicitly given a `--repo`
// (or `--hostname`) that lacks a host. On GitHub Enterprise Server / GHEC
// hosts (e.g. *.ghe.com) this silently sends the (host-scoped) token to
// github.com and fails with "Bad credentials (HTTP 401)" — the same failure
// mode fixed for the promote workflows in #575/#577. Actions always injects
// `GITHUB_SERVER_URL` for the real host, so derive it from there and pass it
// explicitly to each `gh` invocation (`--repo host/owner/repo`, `--hostname
// host`) rather than relying on ambient `GH_HOST`/env-var resolution.
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
