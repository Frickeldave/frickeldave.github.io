#!/usr/bin/env node

/**
 * Startet die ReqEng-Arbeit an den GitHub-Issues dieses Projekts in einem
 * normalen Terminal, bevor die Copilot-CLI startet.
 *
 * Aufruf:
 *   node scripts/start-reqeng.mjs
 *   node scripts/start-reqeng.mjs IS_480
 *   node scripts/start-reqeng.mjs is480
 *   ./scripts/start-reqeng.mjs
 *
 * Vor einer Copilot-CLI-Session ausführen. Die verbindlichen Konventionen zu
 * Benennung, Worktree-Wiederverwendung und tmux-Gate stehen in:
 *   - `.github/skills/worktree-naming-conventions/SKILL.md`
 *   - `.github/skills/tmux-session-management/SKILL.md`
 *
 * ReqEng bereitet einen isolierten Issue-Worktree und optional ein tmux-Fenster
 * vor. Datenbanken, Service-Ports und Laufzeit-Abhängigkeiten werden nicht
 * provisioniert; es werden keine App-Services gestartet.
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { emitKeypressEvents } from 'node:readline';
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';
import { buildIssueBranchName, deriveBranchType } from './ensure-issue-branch.mjs';
import { isWindows, prepareSpawn } from './platform-shared.mjs';
import { prepareCopilotEnvironment } from './copilot-environment.mjs';
import {
  assignIssueToUser,
  buildTmuxSessionName,
  ensureProjectPropertyAccess,
  resolveIssueWorktreePath,
  resolveCurrentGitHubUser,
  detectIdFromTmuxSession,
  ensureTmuxSessionAvailable,
  launchInNewTmuxSession,
  parseFlowFlags,
  resolveAdditionalPrompt,
  trustWorktreeFolder,
} from './flow-shared.mjs';
import { ensureDependenciesReady } from './start-work.mjs';

const WORKFLOW_PROMPT_RELATIVE_PATH = '.github/prompts/startreqeng.prompt.md';
const HELP_TEXT = `Usage:
  node scripts/start-reqeng.mjs
  node scripts/start-reqeng.mjs IS_480
  node scripts/start-reqeng.mjs is480
  ./scripts/start-reqeng.mjs

Prepare an issue-specific ReqEng worktree, verify the issue exists, align with
the current tmux session when already inside tmux, and then launch GitHub
Copilot CLI as:

  copilot --agent Squad --yolo -i "<prompt>"

with an instruction that tells Copilot to read this workflow prompt itself:

  ${WORKFLOW_PROMPT_RELATIVE_PATH}

If that file is missing in the resolved worktree, the script offers a local-branch
single-file checkout recovery step before continuing.

Arrow-key menus are used on TTYs; plain prompts are used as a fallback.

Optional positional CLI argument:
  IS_123 / IS-123 / IS123

Flow flags:
  --notmux            Do not check or use tmux; run Copilot in the foreground.
  --prompt "<text>"   Start directly with this additional prompt (skips the question).
  --noprompt          Skip the question for an additional prompt.
  --prompt and --noprompt are mutually exclusive.

Outside tmux, the script creates the session IS<n> (aborts if it already exists,
e.g. attach with: tmux attach -t IS202) and continues there. Created sessions use
"mouse off" and disable Copilot mouse capture where supported; startup prints a copy hint. The worktree is
added to trusted_folders of the Copilot configuration automatically.

Windows has no tmux build: use --notmux, or let the script fall back to the
foreground automatically when tmux is missing.

Run this script before starting a Copilot CLI session.
`;

const COPILOT_COMMAND = 'copilot';
const COPILOT_ARGS = ['--agent', 'Squad', '--yolo'];

/**
 * @param {{
 *   argv?: string[];
 *   getMainCheckoutPathFn?: typeof getMainCheckoutPath;
 *   createInterfaceFn?: typeof createInterface;
 *   resolveIssueContextFn?: typeof resolveIssueContext;
 *   promptAdditionalPromptFn?: typeof promptAdditionalPrompt;
 *   prepareWorkContextFn?: typeof prepareWorkContext;
 *   launchPreparedWorkFn?: typeof launchPreparedWork;
 *   ensureProjectPropertyAccessFn?: typeof ensureProjectPropertyAccess;
 *   assignIssueToCurrentHumanFn?: typeof assignIssueToCurrentHuman;
 * }} [options]
 */
export async function runReqEng(options = {}) {
  const {
    argv = process.argv.slice(2),
    getMainCheckoutPathFn = getMainCheckoutPath,
    createInterfaceFn = createInterface,
    resolveIssueContextFn = resolveIssueContext,
    promptAdditionalPromptFn = promptAdditionalPrompt,
    prepareWorkContextFn = prepareWorkContext,
    launchPreparedWorkFn = launchPreparedWork,
    ensureProjectPropertyAccessFn = ensureProjectPropertyAccess,
    assignIssueToCurrentHumanFn = assignIssueToCurrentHuman,
    detectIdFromTmuxSessionFn = detectIdFromTmuxSession,
  } = options;
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(HELP_TEXT);
    return;
  }

  ensureProjectPropertyAccessFn(runCommand);

  const repoRoot = getMainCheckoutPathFn();
  const flowFlags = parseFlowFlags(argv);
  const cliSelection = parseCliSelection(flowFlags.rest);
  const prompt = createInterfaceFn({
    input: process.stdin,
    output: process.stdout,
  });

  let requestedId;
  let additionalPrompt;
  let issueContext;
  let initialCopilotPrompt;
  let preparedWorkContext;

  try {
    requestedId = cliSelection;
    if (requestedId == null) {
      const detected = flowFlags.notmux ? null : detectIdFromTmuxSessionFn('issue');
      if (detected) {
        console.log(`Using issue #${detected.id} from tmux session "${detected.sessionName}".`);
        requestedId = detected.id;
      }
    }
    requestedId ??= await promptNumericIssueId(prompt);
    issueContext = resolveIssueContextFn(requestedId);
    additionalPrompt = await resolveAdditionalPrompt(flowFlags, () =>
      promptAdditionalPromptFn(prompt)
    );
    issueContext = attachCanonicalNames(issueContext, repoRoot);
    assignIssueToCurrentHumanFn(issueContext);
    initialCopilotPrompt = buildInitialCopilotPrompt(additionalPrompt);
    preparedWorkContext = await prepareWorkContextFn(issueContext, repoRoot, prompt, {
      notmux: flowFlags.notmux,
    });
  } finally {
    prompt.close();
  }

  await launchPreparedWorkFn(preparedWorkContext, issueContext, initialCopilotPrompt);
}

/**
 * Ermittelt den Pfad des Haupt-Checkouts, indem die registrierten Worktrees geprüft werden.
 */
function getMainCheckoutPath() {
  const result = spawnSync('git', ['worktree', 'list', '--porcelain'], { encoding: 'utf8' });
  if (result.error || result.status !== 0 || !result.stdout) {
    throw new Error('Cannot determine the main Git checkout.');
  }
  const path = result.stdout
    .trim()
    .split(/\n\s*\n/)[0]
    ?.match(/^worktree (.+)$/m)?.[1];
  if (!path) {
    throw new Error('No main Git checkout is registered.');
  }
  return path;
}

async function prepareWorkContext(issueContext, repoRoot, prompt, { notmux = false } = {}) {
  const tmuxAvailable = !notmux && isTmuxAvailable();
  ensureTmuxSessionAvailable(issueContext.tmuxSessionName, { tmuxAvailable, notmux });
  const branchContext = resolveBranchContext(issueContext, repoRoot);
  ensureBranchReadyForWorktree(repoRoot, branchContext, issueContext);
  const tmuxContext = resolveCurrentTmuxContext(tmuxAvailable, issueContext.tmuxSessionName);
  const worktreeContext = await resolveWorktreeContext(issueContext, repoRoot, branchContext);

  await ensureWorkflowPromptAvailable(worktreeContext, repoRoot, prompt);
  ensureDependenciesReady(worktreeContext.repoRoot, worktreeContext.worktreePath);

  return {
    tmuxAvailable,
    tmuxContext,
    worktreeContext,
  };
}

async function launchPreparedWork(preparedWorkContext, issueContext, initialCopilotPrompt) {
  const { tmuxAvailable, tmuxContext, worktreeContext } = preparedWorkContext;
  const copilotPrompt = buildInitialCopilotPromptWithIssueContext(
    initialCopilotPrompt,
    issueContext
  );

  trustWorktreeFolder(worktreeContext.worktreePath);
  prepareCopilotEnvironment(worktreeContext.worktreePath, {
    tmuxAvailable,
    sessionName: issueContext.tmuxSessionName,
  });

  if (!tmuxAvailable) {
    const exitCode = await runForegroundCommand(COPILOT_COMMAND, buildCopilotArgs(copilotPrompt), {
      cwd: worktreeContext.worktreePath,
      env: process.env,
    });
    process.exitCode = exitCode;
    return;
  }

  if (tmuxContext.isInsideTmux) {
    const windowId = createCopilotWindow(
      issueContext.tmuxSessionName,
      worktreeContext.worktreePath,
      copilotPrompt
    );
    selectTmuxWindow(issueContext.tmuxSessionName, windowId);
    return;
  }

  process.exitCode = launchInNewTmuxSession(
    issueContext.tmuxSessionName,
    worktreeContext.worktreePath,
    buildCopilotShellCommand(copilotPrompt)
  );
}

/**
 * @param {string[]} argv
 * @returns {number | null}
 */
function parseCliSelection(argv) {
  const positionals = [];

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option "${arg}". See --help for supported usage.`);
    }

    positionals.push(arg);
  }

  if (positionals.length === 0) {
    return null;
  }

  if (positionals.length > 1) {
    throw new Error(
      `Expected at most one positional issue reference, but received ${positionals.length}: ${positionals.join(', ')}.`
    );
  }

  const parsedId = parseIssueRefToken(positionals[0]);
  if (parsedId === null) {
    throw new Error(
      `Invalid issue reference "${positionals[0]}". Use exactly one canonical token such as "IS_123", "IS-123", or "IS123". Bare numbers, "#123" and PR references are not supported as CLI arguments.`
    );
  }

  return parsedId;
}

/**
 * @param {string} value
 * @returns {number | null}
 */
function parseIssueRefToken(value) {
  const match = value.trim().match(/^is(?:[_-]?)(\d+)$/i);
  if (!match) {
    return null;
  }

  return Number.parseInt(match[1], 10);
}

/**
 * @param {import('node:readline/promises').Interface} prompt
 * @returns {Promise<number>}
 */
async function promptNumericIssueId(prompt) {
  while (true) {
    const answer = (await prompt.question('Enter the numeric issue ID: ')).trim();

    if (/^\d+$/.test(answer)) {
      return Number.parseInt(answer, 10);
    }

    console.log('Please enter a numeric issue ID.');
  }
}

/**
 * @param {import('node:readline/promises').Interface} prompt
 * @returns {Promise<string | null>}
 */
async function promptAdditionalPrompt(prompt) {
  const mode = await selectMenuOption(
    prompt,
    'Möchtest du noch einen zusätzlichen Prompt mitgeben?',
    [
      { value: 'direct', label: 'Direkt starten', aliases: ['1', 'direct', 'direkt'] },
      { value: 'extra', label: 'Zusätzlichen Prompt eingeben', aliases: ['2', 'extra', 'prompt'] },
    ]
  );

  if (mode === 'direct') {
    return null;
  }

  while (true) {
    const answer = (await prompt.question('Zusätzlichen Prompt eingeben: ')).trim();

    if (answer) {
      return answer;
    }

    console.log('Please enter a prompt or choose "Direkt starten".');
  }
}

/**
 * @template T
 * @param {import('node:readline/promises').Interface} prompt
 * @param {string} message
 * @param {{ value: T; label: string; aliases?: string[] }[]} options
 * @returns {Promise<T>}
 */
async function selectMenuOption(prompt, message, options) {
  if (!supportsInteractiveMenu()) {
    return selectMenuOptionFallback(prompt, message, options);
  }

  prompt.pause();

  try {
    return await selectMenuOptionInteractive(message, options);
  } finally {
    prompt.resume();
  }
}

function supportsInteractiveMenu() {
  return Boolean(
    process.stdin.isTTY && process.stdout.isTTY && typeof process.stdin.setRawMode === 'function'
  );
}

/**
 * @template T
 * @param {import('node:readline/promises').Interface} prompt
 * @param {string} message
 * @param {{ value: T; label: string; aliases?: string[] }[]} options
 * @returns {Promise<T>}
 */
async function selectMenuOptionFallback(prompt, message, options) {
  while (true) {
    console.log(message);
    for (const [index, option] of options.entries()) {
      console.log(`  ${index + 1}) ${option.label}`);
    }

    const answer = (await prompt.question('Select an option: ')).trim().toLowerCase();
    const selectedOption = options.find((option, index) => {
      const aliases = [
        String(index + 1),
        option.label.toLowerCase(),
        ...(option.aliases ?? []).map((alias) => alias.toLowerCase()),
      ];
      return aliases.includes(answer);
    });

    if (selectedOption) {
      return selectedOption.value;
    }

    console.log(`Please choose one of: ${options.map((option, index) => index + 1).join(', ')}.`);
  }
}

/**
 * @template T
 * @param {string} message
 * @param {{ value: T; label: string }[]} options
 * @returns {Promise<T>}
 */
function selectMenuOptionInteractive(message, options) {
  return new Promise((resolvePromise, rejectPromise) => {
    const input = process.stdin;
    const output = process.stdout;
    const totalLines = options.length + 1;
    let selectedIndex = 0;
    let cleanedUp = false;

    emitKeypressEvents(input);
    input.resume();
    input.setRawMode(true);

    const render = () => {
      if (cleanedUp) {
        return;
      }

      const lines = [
        `${message} (↑/↓, Enter)`,
        ...options.map((option, index) => `${index === selectedIndex ? '❯' : ' '} ${option.label}`),
      ];

      output.write('\x1B[?25l');
      output.write('\r');
      output.write('\x1B[0J');
      output.write(lines.join('\n'));
      output.write('\n');
      output.write(`\x1B[${totalLines}A`);
    };

    const cleanup = () => {
      if (cleanedUp) {
        return;
      }

      cleanedUp = true;
      input.off('keypress', handleKeypress);
      input.setRawMode(false);
      output.write('\r');
      output.write('\x1B[0J');
      output.write('\x1B[?25h');
    };

    /**
     * @param {string} _value
     * @param {{ ctrl?: boolean; name?: string }} key
     */
    const handleKeypress = (_value, key = {}) => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        rejectPromise(new Error('Aborted by user.'));
        return;
      }

      if (key.name === 'up') {
        selectedIndex = (selectedIndex - 1 + options.length) % options.length;
        render();
        return;
      }

      if (key.name === 'down') {
        selectedIndex = (selectedIndex + 1) % options.length;
        render();
        return;
      }

      if (key.name === 'return' || key.name === 'enter') {
        const selection = options[selectedIndex];
        cleanup();
        output.write(`${message}: ${selection.label}\n`);
        resolvePromise(selection.value);
      }
    };

    input.on('keypress', handleKeypress);
    render();
  });
}

/**
 * @param {number} requestedId
 */
function resolveIssueContext(requestedId) {
  const issue = readGhJson(['issue', 'view', String(requestedId), '--json', 'title,labels']);
  const slug = slugifyTitle(issue.title);
  const labels = Array.isArray(issue.labels)
    ? issue.labels.map((label) => label?.name).filter(Boolean)
    : [];

  return {
    requestedId,
    canonicalRefName: buildCanonicalRefName(requestedId),
    issueId: requestedId,
    issueTitle: issue.title,
    branchSlug: slug,
    labels,
  };
}

/**
 * @param {{
 *   issueId: number;
 *   canonicalRefName: string;
 * }} issueContext
 * @param {string} repoRoot
 */
function attachCanonicalNames(issueContext, repoRoot) {
  const repoName = basename(repoRoot);
  return {
    ...issueContext,
    repoName,
    canonicalName: buildCanonicalResourceName(repoName, issueContext.canonicalRefName),
    tmuxSessionName: buildTmuxSessionName(issueContext.canonicalRefName),
  };
}

function assignIssueToCurrentHuman(issueContext) {
  const currentUser = resolveCurrentGitHubUser(runCommand);
  assignIssueToUser(runCommand, issueContext.issueId, currentUser.login);
}

/**
 * @param {number} issueId
 */
function buildCanonicalRefName(issueId) {
  return `IS_${issueId}`;
}

/**
 * @param {string} repoName
 * @param {string} canonicalRefName
 */
function buildCanonicalResourceName(repoName, canonicalRefName) {
  return `${repoName}_${canonicalRefName}`;
}

function isTmuxAvailable() {
  // tmux gibt es nicht nativ für Windows; der Ablauf startet Copilot dann im Vordergrund.
  if (isWindows()) {
    return false;
  }

  const result = runCommand('sh', ['-lc', 'command -v tmux'], {
    allowFailure: true,
    description: 'checking tmux availability',
  });
  return result.status === 0;
}

/**
 * @param {string} sessionName
 */
function resolveCurrentTmuxContext(tmuxAvailable, sessionName) {
  const isInsideTmux = Boolean(process.env.TMUX);

  if (!tmuxAvailable) {
    return { isInsideTmux: false };
  }

  if (!isInsideTmux) {
    return { isInsideTmux: false };
  }

  const currentSessionResult = runCommand('tmux', ['display-message', '-p', '#S'], {
    allowFailure: true,
    description: 'reading current tmux session name',
  });

  if (currentSessionResult.status !== 0) {
    return { isInsideTmux: false };
  }

  const currentSessionName = currentSessionResult.stdout.trim();

  if (currentSessionName !== sessionName) {
    throw new Error(
      `Invalid tmux state: current session "${currentSessionName}" does not match canonical session "${sessionName}". Switch to tmux session "${sessionName}" or exit tmux before rerunning.`
    );
  }

  return {
    isInsideTmux: true,
    currentSessionName,
  };
}

/**
 * @param {{
 *   issueId: number;
 *   branchSlug: string;
 *   labels?: string[];
 * }} issueContext
 * @param {string} repoRoot
 */
export function resolveBranchContext(issueContext, repoRoot) {
  return {
    // Gemeinsam mit ensure-issue-branch.mjs und start-work.mjs genutzt, damit
    // jeder Ablauf die Conventional-Branch-Name-Form erzeugt, die
    // .husky/pre-push-validate.js verlangt. Der Typ kommt über deriveBranchType
    // aus den `type:*`-Labels des Issues und fällt auf `feat` zurück — wie der
    // Default von start-work; `squad` ist kein akzeptierter Typ und würde beim
    // Push abgelehnt.
    branchName: buildIssueBranchName({
      type: deriveBranchType(issueContext.labels ?? []),
      issueId: issueContext.issueId,
      slug: issueContext.branchSlug,
    }),
    baseBranch: resolveDefaultBranch(repoRoot).replace(/^origin\//, ''),
  };
}

/**
 * @param {string} repoRoot
 * @param {{ branchName: string; baseBranch: string }} branchContext
 * @param {{ issueId: number }} issueContext
 */
function ensureBranchReadyForWorktree(repoRoot, branchContext, issueContext) {
  if (localBranchExists(repoRoot, branchContext.branchName)) {
    return;
  }

  if (remoteBranchExists(repoRoot, branchContext.branchName)) {
    ensureLocalBranchAvailability(repoRoot, branchContext.branchName);
    return;
  }

  const baseRef = resolveBaseBranchRef(repoRoot, branchContext.baseBranch);
  createLocalBranchFromBase(repoRoot, branchContext.branchName, baseRef, issueContext.issueId);
}

/**
 * @param {string} repoRoot
 * @param {string} branchName
 * @param {string} baseRef
 * @param {number} issueId
 */
function createLocalBranchFromBase(repoRoot, branchName, baseRef, issueId) {
  runCommand('git', ['branch', branchName, baseRef], {
    cwd: repoRoot,
    description: `creating ReqEng branch ${branchName} for issue #${issueId} from ${baseRef}`,
  });
}

/**
 * @param {{
 *   canonicalName: string;
 *   repoName: string;
 * }} issueContext
 * @param {string} repoRoot
 * @param {{ branchName: string }} branchContext
 */
async function resolveWorktreeContext(issueContext, repoRoot, branchContext) {
  ensureGitWorktreeSupport(repoRoot);
  const canonicalWorktreePath = resolveIssueWorktreePath(repoRoot, issueContext.canonicalName);
  const existingWorktree = findExistingCanonicalWorktree(repoRoot, canonicalWorktreePath);
  const worktreePath = existingWorktree?.path ?? canonicalWorktreePath;

  if (!existingWorktree) {
    const creationAttempt = runCommand(
      'git',
      ['worktree', 'add', '--force', worktreePath, branchContext.branchName],
      {
        cwd: repoRoot,
        allowFailure: true,
        description: `creating worktree ${worktreePath}`,
      }
    );

    if (creationAttempt.status !== 0) {
      const racedWorktree = findExistingCanonicalWorktree(repoRoot, canonicalWorktreePath);
      if (!racedWorktree) {
        throw new Error(
          `Failed to create worktree at "${worktreePath}". ${extractFailureDetails(creationAttempt)}`
        );
      }
    }
  }

  ensureWorktreeBranch(worktreePath, branchContext.branchName);
  if (existingWorktree) {
    syncReusedWorktreeWithDev(worktreePath);
  }

  return {
    repoRoot,
    repoName: issueContext.repoName,
    worktreePath,
    branchName: branchContext.branchName,
  };
}

/**
 * @param {import('node:readline/promises').Interface} prompt
 * @param {string} repoRoot
 * @param {string} message
 */
async function promptLocalBranch(prompt, repoRoot, message) {
  const branches = listLocalBranches(repoRoot);
  const currentBranch = resolveCurrentBranch(repoRoot);
  const defaultBranch = resolveDefaultBranch(repoRoot).replace(/^origin\//, '');
  const preferredBranch =
    (currentBranch && branches.includes(currentBranch) && currentBranch) ||
    (branches.includes(defaultBranch) && defaultBranch) ||
    branches[0];
  const orderedBranches = [
    preferredBranch,
    ...branches.filter((branch) => branch !== preferredBranch),
  ];
  const options = orderedBranches.map((branchName) => {
    const suffixes = [];

    if (branchName === currentBranch) {
      suffixes.push('aktuell');
    }

    if (branchName === defaultBranch) {
      suffixes.push('default');
    }

    return {
      value: branchName,
      label: suffixes.length > 0 ? `${branchName} (${suffixes.join(', ')})` : branchName,
      aliases: [branchName],
    };
  });

  return selectMenuOption(prompt, message, options);
}

/**
 * @param {{ repoRoot: string; worktreePath: string; branchName: string }} worktreeContext
 * @param {string} repoRoot
 * @param {import('node:readline/promises').Interface} prompt
 */
async function ensureWorkflowPromptAvailable(worktreeContext, repoRoot, prompt) {
  const workflowPromptPath = resolve(worktreeContext.worktreePath, WORKFLOW_PROMPT_RELATIVE_PATH);

  if (existsSync(workflowPromptPath)) {
    return;
  }

  console.log(
    `Worktree branch "${worktreeContext.branchName}" at "${worktreeContext.worktreePath}" does not contain ${WORKFLOW_PROMPT_RELATIVE_PATH}; choose a local branch to check out that file from.`
  );
  const selectedBranch = await promptLocalBranch(
    prompt,
    repoRoot,
    `Der Branch im Worktree enthält ${WORKFLOW_PROMPT_RELATIVE_PATH} nicht. Von welchem Branch soll nur diese Datei übernommen werden?`
  );
  const checkoutResult = runCommand(
    'git',
    [
      '-C',
      worktreeContext.worktreePath,
      'checkout',
      selectedBranch,
      '--',
      WORKFLOW_PROMPT_RELATIVE_PATH,
    ],
    {
      allowFailure: true,
      description: `checking out ${WORKFLOW_PROMPT_RELATIVE_PATH} from ${selectedBranch} into ${worktreeContext.worktreePath}`,
    }
  );

  if (checkoutResult.status !== 0) {
    throw new Error(
      `Failed to check out ${WORKFLOW_PROMPT_RELATIVE_PATH} from branch "${selectedBranch}" into worktree "${worktreeContext.worktreePath}". ${extractFailureDetails(checkoutResult)}`
    );
  }

  if (!existsSync(workflowPromptPath)) {
    throw new Error(
      `${WORKFLOW_PROMPT_RELATIVE_PATH} is still missing in worktree "${worktreeContext.worktreePath}" after checking it out from branch "${selectedBranch}".`
    );
  }
}

function findExistingCanonicalWorktree(repoRoot, canonicalWorktreePath) {
  return (
    listGitWorktrees(repoRoot).find((worktree) => worktree.path === canonicalWorktreePath) ?? null
  );
}

function listGitWorktrees(repoRoot) {
  const result = runCommand('git', ['worktree', 'list', '--porcelain'], {
    cwd: repoRoot,
    description: 'listing git worktrees',
  });

  const worktrees = [];
  let current = { path: null, branch: null };

  for (const line of result.stdout.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (current.path) {
        worktrees.push({ path: current.path, branch: current.branch });
      }

      current = {
        path: resolve(line.slice('worktree '.length).trim()),
        branch: null,
      };
      continue;
    }

    if (line.startsWith('branch ')) {
      current.branch = line.slice('branch '.length).trim();
    }
  }

  if (current.path) {
    worktrees.push({ path: current.path, branch: current.branch });
  }

  return worktrees;
}

/**
 * @param {string} worktreePath
 * @param {string} branchName
 */
function ensureWorktreeBranch(worktreePath, branchName) {
  const currentBranch = resolveCurrentBranch(worktreePath);
  if (currentBranch === branchName) {
    return;
  }

  const checkoutResult = runCommand(
    'git',
    ['-C', worktreePath, 'checkout', '--ignore-other-worktrees', branchName],
    {
      allowFailure: true,
      description: `switching worktree ${worktreePath} to ${branchName}`,
    }
  );

  if (checkoutResult.status !== 0) {
    throw new Error(
      `Failed to switch worktree "${worktreePath}" to branch "${branchName}". ${extractFailureDetails(checkoutResult)}`
    );
  }
}

/**
 * Ein wiederverwendeter Worktree kann hinter `origin/dev` zurückliegen und dann
 * veraltete Prompts und Doku enthalten. `origin/dev` dann mergen, solange er
 * sauber ist; den Ablauf nie abbrechen, nur warnen.
 */
export function syncReusedWorktreeWithDev(worktreePath) {
  const git = (args, description) =>
    runCommand('git', ['-C', worktreePath, ...args], { allowFailure: true, description });

  git(['fetch', 'origin', 'dev'], `fetching origin/dev for ${worktreePath}`);
  const behind = git(
    ['rev-list', '--count', 'HEAD..origin/dev'],
    `checking whether ${worktreePath} is behind origin/dev`
  );
  if (behind.status !== 0 || Number.parseInt(behind.stdout.trim(), 10) === 0) {
    return;
  }

  const dirty = git(['status', '--porcelain'], `checking ${worktreePath} for local changes`);
  if (dirty.status !== 0 || dirty.stdout.trim() !== '') {
    console.warn(
      `Worktree ${worktreePath} is behind origin/dev but has local changes; not updating.`
    );
    return;
  }

  const merge = git(
    ['merge', '--no-edit', 'origin/dev'],
    `merging origin/dev into ${worktreePath}`
  );
  if (merge.status !== 0) {
    git(['merge', '--abort'], `aborting merge in ${worktreePath}`);
    console.warn(
      `Worktree ${worktreePath} could not be updated from origin/dev (conflicts); prompts and docs may be outdated.`
    );
    return;
  }
  console.log(`Updated worktree ${worktreePath} with origin/dev.`);
}

function ensureGitWorktreeSupport(repoRoot) {
  const result = runCommand('git', ['worktree', 'list', '--porcelain'], {
    cwd: repoRoot,
    allowFailure: true,
    description: 'checking git worktree support',
  });

  if (result.status !== 0) {
    throw new Error(
      `Git worktrees are not available in this repository context. ${extractFailureDetails(result)}`
    );
  }
}

function listLocalBranches(repoRoot) {
  const result = runCommand('git', ['branch', '--format=%(refname:short)'], {
    cwd: repoRoot,
    allowFailure: true,
    description: 'listing local git branches',
  });

  if (result.status !== 0) {
    throw new Error(`Failed to list local Git branches. ${extractFailureDetails(result)}`);
  }

  const branches = result.stdout
    .split('\n')
    .map((branch) => branch.trim())
    .filter(Boolean);

  if (branches.length === 0) {
    throw new Error('Failed to list local Git branches. No local branches were found.');
  }

  return branches;
}

function localBranchExists(repoRoot, branchName) {
  const result = runCommand(
    'git',
    ['rev-parse', '--verify', '--quiet', `refs/heads/${branchName}`],
    {
      cwd: repoRoot,
      allowFailure: true,
      description: `checking whether local branch ${branchName} exists`,
    }
  );

  return result.status === 0;
}

function resolveDefaultBranch(repoRoot) {
  const result = runCommand('git', ['symbolic-ref', 'refs/remotes/origin/HEAD'], {
    cwd: repoRoot,
    allowFailure: true,
    description: 'resolving default branch',
  });

  if (result.status !== 0) {
    return 'main';
  }

  const symbolicRef = result.stdout.trim();
  if (symbolicRef.startsWith('refs/remotes/')) {
    return symbolicRef.slice('refs/remotes/'.length);
  }

  return symbolicRef || 'main';
}

function resolveCurrentBranch(repoRoot) {
  const result = runCommand('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: repoRoot,
    allowFailure: true,
    description: 'resolving current branch',
  });

  if (result.status !== 0) {
    return null;
  }

  const branchName = result.stdout.trim();
  return branchName && branchName !== 'HEAD' ? branchName : null;
}

function resolveBaseBranchRef(repoRoot, baseBranch) {
  runCommand('git', ['fetch', 'origin', baseBranch], {
    cwd: repoRoot,
    allowFailure: true,
    description: `fetching origin/${baseBranch}`,
  });

  const remoteRef = `refs/remotes/origin/${baseBranch}`;
  if (gitRefExists(repoRoot, remoteRef)) {
    return remoteRef;
  }

  const localRef = `refs/heads/${baseBranch}`;
  if (gitRefExists(repoRoot, localRef)) {
    return localRef;
  }

  throw new Error(
    `Could not resolve the default/base branch "${baseBranch}" locally or on origin.`
  );
}

function gitRefExists(repoRoot, refName) {
  const result = runCommand('git', ['rev-parse', '--verify', '--quiet', refName], {
    cwd: repoRoot,
    allowFailure: true,
    description: `checking whether git ref ${refName} exists`,
  });

  return result.status === 0;
}

function ensureLocalBranchAvailability(repoRoot, branchName) {
  if (localBranchExists(repoRoot, branchName)) {
    return;
  }

  if (!remoteBranchExists(repoRoot, branchName)) {
    throw new Error(
      `Branch "${branchName}" does not exist locally or on origin, so no worktree can be created from it.`
    );
  }

  runCommand(
    'git',
    ['fetch', 'origin', `refs/heads/${branchName}:refs/remotes/origin/${branchName}`],
    {
      cwd: repoRoot,
      description: `fetching origin/${branchName}`,
    }
  );
  runCommand('git', ['branch', '--track', branchName, `origin/${branchName}`], {
    cwd: repoRoot,
    description: `creating local tracking branch ${branchName}`,
  });
}

function remoteBranchExists(repoRoot, branchName) {
  const result = runCommand('git', ['ls-remote', '--exit-code', '--heads', 'origin', branchName], {
    cwd: repoRoot,
    allowFailure: true,
    description: `checking whether origin/${branchName} exists`,
  });

  return result.status === 0;
}

function createCopilotWindow(sessionName, worktreePath, initialCopilotPrompt) {
  const result = runCommand(
    'tmux',
    [
      'new-window',
      '-P',
      '-F',
      '#I',
      '-t',
      sessionName,
      '-n',
      'copilot',
      '-c',
      worktreePath,
      buildCopilotShellCommand(initialCopilotPrompt),
    ],
    {
      description: `creating Copilot tmux window for session ${sessionName}`,
    }
  );

  return result.stdout.trim();
}

function selectTmuxWindow(sessionName, windowId) {
  runCommand('tmux', ['select-window', '-t', `${sessionName}:${windowId}`], {
    description: `selecting tmux window ${sessionName}:${windowId}`,
  });
}

function buildCopilotArgs(initialCopilotPrompt) {
  return [...COPILOT_ARGS, '-i', initialCopilotPrompt];
}

function buildInitialCopilotPrompt(additionalPrompt) {
  const basePrompt = `Lies die Datei ${WORKFLOW_PROMPT_RELATIVE_PATH} und führe den darin beschriebenen Workflow vollständig aus.`;

  if (!additionalPrompt) {
    return basePrompt;
  }

  return `${basePrompt}\n\n---\n\nZusätzlicher Kontext vom Nutzer:\n${additionalPrompt}`;
}

function buildInitialCopilotPromptWithIssueContext(initialCopilotPrompt, issueContext) {
  return [
    initialCopilotPrompt,
    '',
    `Issue-ID: ${issueContext.issueId}`,
    `Kanonischer Kontextname: ${issueContext.canonicalName}`,
  ].join('\n');
}

function buildCopilotShellCommand(initialCopilotPrompt) {
  const command = [COPILOT_COMMAND, ...buildCopilotArgs(initialCopilotPrompt)]
    .map(shellQuote)
    .join(' ');
  return `exec ${command}`;
}

function readGhJson(args) {
  const result = runCommand('gh', args, {
    allowFailure: true,
    description: `running gh ${args.slice(0, 3).join(' ')}`,
  });

  if (result.status !== 0) {
    throw new Error(`GitHub CLI command failed. ${extractFailureDetails(result)}`);
  }

  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(
      `GitHub CLI returned invalid JSON. ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * @param {string} title
 */
function slugifyTitle(title) {
  const slug = stripIssueTitleLabels(title)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');

  if (!slug) {
    throw new Error(`Could not derive a branch slug from title "${title}".`);
  }

  return slug;
}

function stripIssueTitleLabels(title) {
  return title.replace(/^(?:\s*\[[^\]]+\]\s*)+/u, '').trim();
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'\\''`)}'`;
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {{ cwd?: string; env?: NodeJS.ProcessEnv; stdio?: import('node:child_process').StdioOptions; allowFailure?: boolean; description?: string; input?: string }} [options]
 */
function runCommand(command, args, options = {}) {
  const {
    cwd,
    env,
    stdio = ['ignore', 'pipe', 'pipe'],
    allowFailure = false,
    description = `running ${command}`,
    input,
  } = options;

  const launch = prepareSpawn(command, args);
  const result = spawnSync(launch.command, launch.args, {
    cwd,
    env,
    encoding: 'utf8',
    input,
    stdio,
    ...launch.options,
  });

  if (result.error) {
    throw new Error(`Failed while ${description}: ${result.error.message}`);
  }

  if (!allowFailure && result.status !== 0) {
    throw new Error(`Failed while ${description}. ${extractFailureDetails(result)}`);
  }

  return {
    status: result.status ?? 0,
    stdout: typeof result.stdout === 'string' ? result.stdout : '',
    stderr: typeof result.stderr === 'string' ? result.stderr : '',
  };
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {{ cwd?: string; env?: NodeJS.ProcessEnv }} [options]
 */
function runForegroundCommand(command, args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const launch = prepareSpawn(command, args);
    const child = spawn(launch.command, launch.args, {
      cwd: options.cwd,
      env: options.env,
      stdio: 'inherit',
      ...launch.options,
    });

    child.once('error', (error) => {
      rejectPromise(new Error(`Failed to start ${command}: ${error.message}`));
    });

    child.once('exit', (code, signal) => {
      if (signal) {
        rejectPromise(new Error(`${command} exited due to signal ${signal}.`));
        return;
      }

      resolvePromise(code ?? 1);
    });
  });
}

function extractFailureDetails(result) {
  const output = [result.stderr, result.stdout]
    .map((value) => value?.trim())
    .find((value) => Boolean(value));

  if (output) {
    return output;
  }

  if (typeof result.status === 'number') {
    return `Command exited with status ${result.status}.`;
  }

  return 'Command failed without additional output.';
}

function formatError(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  runReqEng().catch((error) => {
    console.error(formatError(error));
    process.exit(1);
  });
}

export { buildCanonicalResourceName, buildCanonicalRefName, buildCopilotArgs, parseIssueRefToken };
