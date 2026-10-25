import { createHash } from 'node:crypto';
import { accessSync, constants, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { parseJsonc } from './copilot-environment.mjs';
import { prepareSpawn } from './platform-shared.mjs';

// The board of this repository is a user-owned GitHub Project V2; the same
// defaults are used by `scripts/sync-project-board.mjs`. Both values can be
// overridden for forks via PROJECT_OWNER / PROJECT_NUMBER.
export const DEFAULT_PROJECT_OWNER = process.env.PROJECT_OWNER || 'Frickeldave';
export const DEFAULT_PROJECT_NUMBER = Number(process.env.PROJECT_NUMBER || 2);
const TEAM_FILE = '.squad/team.md';

export function resolveIssueWorktreePath(
  repoRoot,
  canonicalName,
  { canWriteDirectoryFn = canWriteDirectory, homeDirectory = homedir() } = {}
) {
  const resolvedRepoRoot = resolve(repoRoot);
  const checkoutParent = dirname(resolvedRepoRoot);

  if (canWriteDirectoryFn(checkoutParent)) {
    return resolve(checkoutParent, canonicalName);
  }

  const checkoutKey = createHash('sha256').update(resolvedRepoRoot).digest('hex').slice(0, 12);
  return resolve(homeDirectory, '.cache', 'flow-worktrees', checkoutKey, canonicalName);
}

function canWriteDirectory(directory) {
  try {
    accessSync(directory, constants.W_OK | constants.X_OK);
    return true;
  } catch (error) {
    if (['EACCES', 'EPERM', 'EROFS'].includes(error.code)) {
      return false;
    }
    throw error;
  }
}

export function buildTmuxSessionName(canonicalRefName) {
  const match = String(canonicalRefName ?? '')
    .trim()
    .match(/^(IS|PR)_([1-9]\d*)$/i);
  if (!match) {
    throw new Error(`Cannot derive tmux session name from canonical ref "${canonicalRefName}".`);
  }

  return `${match[1].toUpperCase()}${match[2]}`;
}

/**
 * Reads the numeric ID from the current tmux session when its name is exactly
 * canonical (`IS<n>` for issues, `PR<n>` for pull requests); otherwise null.
 * @param {'issue' | 'pr'} kind
 * @param {{ env?: NodeJS.ProcessEnv, spawnFn?: typeof spawnSync }} [options]
 * @returns {{ id: number, sessionName: string } | null}
 */
export function detectIdFromTmuxSession(kind, { env = process.env, spawnFn = spawnSync } = {}) {
  if (!env.TMUX) {
    return null;
  }
  const result = spawnFn('tmux', ['display-message', '-p', '#S'], { encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    return null;
  }
  const sessionName = String(result.stdout ?? '').trim();
  const prefix = kind === 'issue' ? 'IS' : 'PR';
  const match = sessionName.match(new RegExp(`^${prefix}([1-9]\\d*)$`));
  if (!match || !Number.isSafeInteger(Number(match[1]))) {
    return null;
  }
  return { id: Number.parseInt(match[1], 10), sessionName };
}

/**
 * Extracts the shared flow flags (`--notmux`, `--prompt <message>`, `--noprompt`)
 * from argv and returns the remaining arguments untouched.
 * @param {string[]} argv
 * @returns {{ notmux: boolean, prompt: string | null, noprompt: boolean, rest: string[] }}
 */
export function parseFlowFlags(argv) {
  const rest = [];
  let notmux = false;
  let noprompt = false;
  let prompt = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--notmux') {
      notmux = true;
    } else if (arg === '--noprompt') {
      noprompt = true;
    } else if (arg === '--prompt' || arg.startsWith('--prompt=')) {
      const value = arg === '--prompt' ? argv[(index += 1)] : arg.slice('--prompt='.length);
      if (typeof value !== 'string' || !value.trim()) {
        throw new Error('--prompt requires a non-empty message, e.g. --prompt "Continue".');
      }
      prompt = value.trim();
    } else {
      rest.push(arg);
    }
  }

  if (prompt !== null && noprompt) {
    throw new Error('--prompt and --noprompt are mutually exclusive.');
  }

  return { notmux, prompt, noprompt, rest };
}

/**
 * Resolves the additional prompt: `--prompt` wins, `--noprompt` skips the
 * question, otherwise the interactive question is asked.
 */
export async function resolveAdditionalPrompt(flags, askFn) {
  if (flags.prompt !== null) {
    return flags.prompt;
  }
  if (flags.noprompt) {
    return null;
  }
  return askFn();
}

/**
 * Aborts when the canonical tmux session already exists while the flow runs
 * outside tmux. Does nothing without tmux, with `--notmux`, or inside tmux
 * (the current session is validated elsewhere).
 */
export function ensureTmuxSessionAvailable(
  sessionName,
  { tmuxAvailable, notmux = false, env = process.env, spawnFn = spawnSync } = {}
) {
  if (notmux || !tmuxAvailable || env.TMUX) {
    return;
  }
  const result = spawnFn('tmux', ['has-session', '-t', `=${sessionName}`], { encoding: 'utf8' });
  if (result.status === 0) {
    throw new Error(
      `tmux session "${sessionName}" already exists. Switch to it with \`tmux attach -t ${sessionName}\` and run the flow from there, or use --notmux.`
    );
  }
}

/**
 * Adds the folder to `trusted_folders` of the Copilot configuration.
 * @returns {boolean} true when the file was changed
 */
export function trustCopilotFolder(
  folderPath,
  { env = process.env, homeDirectory = homedir(), currentSchema = false } = {}
) {
  const configDirectory = env.COPILOT_HOME || resolve(homeDirectory, '.copilot');
  const configPath = resolve(configDirectory, 'config.json');
  let config = {};

  if (existsSync(configPath)) {
    const raw = readFileSync(configPath, 'utf8');
    if (raw.trim()) {
      try {
        config = parseJsonc(raw).value;
      } catch (error) {
        throw new Error(`Cannot parse Copilot config ${configPath}: ${error.message}`);
      }
    }
  }

  const key =
    currentSchema ||
    ['trustedFolders', 'lastLoggedInUser', 'loggedInUsers', 'authTokens'].some((name) =>
      Object.hasOwn(config, name)
    )
      ? 'trustedFolders'
      : 'trusted_folders';
  const trusted = Array.isArray(config[key]) ? config[key] : [];
  const folder = resolve(folderPath);
  if (trusted.includes(folder)) {
    return false;
  }

  mkdirSync(configDirectory, { recursive: true });
  writeFileSync(
    configPath,
    `${JSON.stringify({ ...config, [key]: [...trusted, folder] }, null, 2)}\n`,
    { mode: 0o600 }
  );
  return true;
}

/** Trusts the worktree; a failure only warns because Copilot then asks itself. */
export function trustWorktreeFolder(worktreePath, options = {}) {
  try {
    const spawnFn = options.spawnFn || spawnSync;
    const commandOptions = {
      encoding: 'utf8',
      timeout: 5000,
      env: options.env || process.env,
    };
    const launch = prepareSpawn('copilot', ['help', 'config'], {
      env: commandOptions.env,
    });
    const help = spawnFn(launch.command, launch.args, { ...commandOptions, ...launch.options });
    // 1.0.98 advertises trustedFolders, but `config trustedFolders` rejects it:
    // it is global state in config.json, not a user setting in settings.json.
    const currentSchema = help.status === 0 && help.stdout?.includes('`trustedFolders`');
    if (trustCopilotFolder(worktreePath, { ...options, currentSchema })) {
      console.log(`Added ${worktreePath} to Copilot trusted folders.`);
    }
  } catch (error) {
    console.warn(`Could not add ${worktreePath} to Copilot trusted_folders: ${error.message}`);
  }
}

/**
 * Creates the detached tmux session running `shellCommand` and attaches to it.
 * Copilot's own mouse capture must also be disabled before launching.
 * @returns {number} exit code of the attach
 */
export function launchInNewTmuxSession(
  sessionName,
  worktreePath,
  shellCommand,
  { spawnFn = spawnSync } = {}
) {
  const create = spawnFn(
    'tmux',
    ['new-session', '-d', '-s', sessionName, '-n', 'copilot', '-c', worktreePath, shellCommand],
    { encoding: 'utf8' }
  );
  if (create.error || create.status !== 0) {
    throw new Error(
      `Failed to create tmux session "${sessionName}": ${create.stderr?.trim() || create.error?.message || create.status}`
    );
  }
  const mouse = spawnFn('tmux', ['set-option', '-t', sessionName, 'mouse', 'off'], {
    encoding: 'utf8',
  });
  if (mouse.error || mouse.status !== 0) console.warn('Could not disable tmux mouse capture.');
  const attach = spawnFn('tmux', ['attach-session', '-t', sessionName], { stdio: 'inherit' });
  return attach.status ?? 1;
}

export function ensureProjectPropertyAccess(
  runCommand,
  { projectOwner = DEFAULT_PROJECT_OWNER, projectNumber = DEFAULT_PROJECT_NUMBER } = {}
) {
  const authStatus = runCommand('gh', ['auth', 'status'], {
    allowFailure: true,
    description: 'checking gh auth status',
  });

  if (authStatus.status !== 0) {
    throw new Error(
      'GitHub CLI is not authenticated. Run `gh auth login`, then `gh auth refresh -s read:project`, and rerun the flow.'
    );
  }

  const queryArgs = [
    'api',
    'graphql',
    '-f',
    'query=query($login:String!,$number:Int!){user(login:$login){projectV2(number:$number){id}}}',
    '-F',
    `login=${projectOwner}`,
    '-F',
    `number=${projectNumber}`,
  ];
  const result = runCommand('gh', queryArgs, {
    allowFailure: true,
    description: 'verifying GitHub Projects property access',
  });

  if (result.status === 0) {
    return;
  }

  const details = formatCommandFailure(result);
  if (/read:project|INSUFFICIENT_SCOPES|projectV2/i.test(details)) {
    throw new Error(
      'GitHub Projects property access is missing. Run `gh auth refresh -s read:project` and rerun the flow.'
    );
  }

  throw new Error(`GitHub Projects property access check failed. ${details}`);
}

export function resolveCurrentGitHubUser(runCommand) {
  const payload = readJsonCommand(
    runCommand,
    'gh',
    ['api', 'user'],
    'resolving current GitHub user'
  );
  const login =
    typeof payload?.login === 'string' && payload.login.trim() ? payload.login.trim() : null;
  const name =
    typeof payload?.name === 'string' && payload.name.trim() ? payload.name.trim() : null;

  if (!login) {
    throw new Error('GitHub CLI did not return a valid current user login.');
  }

  return { login, name };
}

export function assignIssueToUser(runCommand, issueNumber, login) {
  const result = runCommand('gh', ['issue', 'edit', String(issueNumber), '--add-assignee', login], {
    allowFailure: true,
    description: `assigning issue #${issueNumber} to ${login}`,
  });

  if (result.status !== 0) {
    throw new Error(
      `Failed to assign issue #${issueNumber} to "${login}". ${formatCommandFailure(result)}`
    );
  }
}

// Heading aliases: this repository writes German team files, imported Squad team
// files use English. Both spellings must yield the same roster. The agent roster
// headings (`## Mitglieder` / `## Members`) are *not* human members; they end the
// human section like any other heading.
export const HUMAN_MEMBERS_HEADING = /^##\s+(?:Human\s+Members|Menschliche\s+Mitglieder)\s*$/i;

const HUMAN_MEMBER_COLUMNS = {
  name: ['name'],
  nicknames: ['nicknames', 'nickname', 'spitznamen', 'spitzname'],
  role: ['role', 'rolle'],
  language: ['language', 'sprache'],
  github: ['github'],
};

const normalizeCell = (cell) =>
  String(cell ?? '')
    .replace(/^`|`$/g, '')
    .replace(/^@/, '')
    .trim();

function resolveColumnIndex(header, names) {
  return header.findIndex((cell) =>
    names.includes(
      cell
        .replace(/[*`]/g, '')
        .trim()
        .toLowerCase()
    )
  );
}

/**
 * Reads the human roster table (`## Human Members` / `## Menschliche Mitglieder`).
 * Columns are resolved from the header row, so the column order may differ
 * between team files; unknown columns are ignored.
 */
export function parseHumanMembers(teamMarkdown) {
  const lines = String(teamMarkdown ?? '').split('\n');
  const members = [];
  let inHumanMembers = false;
  let columns = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (HUMAN_MEMBERS_HEADING.test(trimmed)) {
      inHumanMembers = true;
      columns = null;
      continue;
    }

    if (inHumanMembers && /^##\s+/.test(trimmed)) {
      break;
    }

    if (!inHumanMembers || !trimmed.startsWith('|')) {
      continue;
    }

    const cells = trimmed
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());

    if (cells.every((cell) => /^:?-{2,}:?$/.test(cell))) {
      continue;
    }

    if (!columns) {
      const header = cells.map((cell) => cell.toLowerCase());
      const resolved = {};
      for (const [field, aliases] of Object.entries(HUMAN_MEMBER_COLUMNS)) {
        const index = resolveColumnIndex(header, aliases);
        if (index >= 0) {
          resolved[field] = index;
        }
      }
      if (resolved.name === undefined) {
        continue;
      }
      columns = resolved;
      continue;
    }

    const cellAt = (field) =>
      columns[field] === undefined ? '' : (cells[columns[field]] ?? '').trim();
    const name = normalizeCell(cellAt('name'));

    if (!name) {
      continue;
    }

    members.push({
      name,
      nicknames: cellAt('nicknames')
        .split(',')
        .map((nickname) => nickname.trim())
        .filter(Boolean),
      role: cellAt('role'),
      language: cellAt('language'),
      github: normalizeCell(cellAt('github')),
    });
  }

  return members;
}

export function loadHumanMembers(repoRoot, options = {}) {
  if (typeof options.teamMarkdown === 'string') {
    return parseHumanMembers(options.teamMarkdown);
  }

  return parseHumanMembers(readFileSync(resolve(repoRoot, TEAM_FILE), 'utf8'));
}

export function resolveHumanReviewerLogins(runCommand, repoRoot, options = {}) {
  const members = loadHumanMembers(repoRoot, options).filter((member) =>
    isDeveloperRole(member.role)
  );
  if (members.length === 0) {
    return [];
  }
  const currentUser = resolveCurrentGitHubUser(runCommand);
  const seenLogins = new Set();
  const resolvedReviewers = [];

  for (const member of members) {
    const login = resolveHumanMemberLogin(runCommand, member, currentUser);
    if (seenLogins.has(login)) {
      continue;
    }
    seenLogins.add(login);
    resolvedReviewers.push({ member, login });
  }

  return resolvedReviewers;
}

/**
 * Only Developer-role humans (including combined roles such as
 * "Techlead / Developer") are eligible reviewers. Manager/PM-only roles
 * (e.g. "Projektleiter ...") are excluded.
 */
function isDeveloperRole(role) {
  return /(?:^|[\s/(),;])Developer(?=$|[\s/(),;])/i.test(String(role ?? ''));
}

export function requestPullRequestReviewers(runCommand, prNumber, reviewers) {
  for (const reviewer of reviewers) {
    const result = runCommand(
      'gh',
      [
        'api',
        `repos/{owner}/{repo}/pulls/${prNumber}/requested_reviewers`,
        '--method',
        'POST',
        '--raw-field',
        `reviewers[]=${reviewer}`,
      ],
      {
        allowFailure: true,
        description: `requesting reviewer ${reviewer} on PR #${prNumber}`,
      }
    );

    if (
      result.status !== 0 &&
      !/already requested|is already a reviewer|review request already exists/i.test(
        formatCommandFailure(result)
      )
    ) {
      throw new Error(
        `Failed to request reviewer "${reviewer}" on PR #${prNumber}. ${formatCommandFailure(result)}`
      );
    }
  }
}

function resolveHumanMemberLogin(runCommand, member, currentUser) {
  if (matchesHumanIdentity(currentUser, member)) {
    return currentUser.login;
  }

  const exactNameMatches = searchUsersByQuery(runCommand, `"${member.name}" in:fullname`);
  const matchingNames = exactNameMatches.filter(
    (candidate) => normalizeIdentity(candidate.name) === normalizeIdentity(member.name)
  );

  if (matchingNames.length === 1) {
    return matchingNames[0].login;
  }

  for (const nickname of member.nicknames) {
    const nicknameMatches = searchUsersByQuery(runCommand, `"${nickname}"`);
    const candidate = nicknameMatches.find((entry) =>
      [entry.login, entry.name].some(
        (value) => normalizeIdentity(value) === normalizeIdentity(nickname)
      )
    );
    if (candidate) {
      return candidate.login;
    }
  }

  throw new Error(
    `Could not resolve a unique GitHub login for human member "${member.name}" from ${TEAM_FILE}.`
  );
}

function matchesHumanIdentity(currentUser, member) {
  const candidates = [currentUser.login, currentUser.name].filter(Boolean);
  const aliases = [member.name, ...member.nicknames];
  return candidates.some((candidate) =>
    aliases.some((alias) => normalizeIdentity(candidate) === normalizeIdentity(alias))
  );
}

function searchUsersByQuery(runCommand, searchQuery) {
  const payload = readJsonCommand(
    runCommand,
    'gh',
    [
      'api',
      'graphql',
      '-f',
      'query=query($searchQuery:String!){search(query:$searchQuery,type:USER,first:10){nodes{... on User{login name}}}}',
      '-F',
      `searchQuery=${searchQuery}`,
    ],
    `searching GitHub users for ${searchQuery}`
  );

  const nodes = payload?.data?.search?.nodes;
  return Array.isArray(nodes)
    ? nodes.filter(
        (node) =>
          node &&
          typeof node.login === 'string' &&
          node.login.trim() &&
          typeof node.name === 'string' &&
          node.name.trim()
      )
    : [];
}

function readJsonCommand(runCommand, command, args, description) {
  const result = runCommand(command, args, {
    allowFailure: true,
    description,
  });

  if (result.status !== 0) {
    throw new Error(formatCommandFailure(result));
  }

  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(
      `Command "${command} ${args.join(' ')}" did not return valid JSON. ${error.message}`
    );
  }
}

function normalizeIdentity(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function formatCommandFailure(result) {
  return [result?.stderr?.trim(), result?.stdout?.trim()].filter(Boolean).join(' ').trim();
}
