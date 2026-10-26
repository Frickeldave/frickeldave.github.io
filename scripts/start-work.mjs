#!/usr/bin/env node

/**
 * Startet die Issue-Umsetzung in einem normalen Terminal, bevor die Copilot-CLI startet.
 *
 * Aufruf:
 *   node scripts/start-work.mjs
 *   node scripts/start-work.mjs IS_480
 *   ./scripts/start-work.mjs
 *
 * Vor einer Copilot-CLI-Session ausführen. Die verbindlichen Konventionen zu
 * Benennung, Port, Worktree-Wiederverwendung und tmux-Gate stehen in:
 *   - `.github/skills/worktree-naming-conventions/SKILL.md`
 *   - `.github/skills/tmux-session-management/SKILL.md`
 *
 * Das Skript ermittelt den kanonischen Issue-Kontext, prüft bei Bedarf die
 * Issue-Gates, aktiviert danach den lokalen Marker `.frickeldave-active-issue`
 * im Ziel-Worktree, verwendet den kanonischen Worktree wieder oder legt ihn an,
 * prüft, ob `.github/prompts/startwork.prompt.md` dort existiert (und holt die
 * Datei per Single-File-Checkout nach, falls nicht), legt bei Bedarf vor dem
 * eigentlichen Copilot-Dispatch einen Draft-PR an, richtet sich in einer
 * bestehenden tmux-Session an dieser aus und startet anschließend
 * `copilot --agent Squad --yolo -i "<prompt>"` mit der Anweisung, dass Copilot
 * `.github/prompts/startwork.prompt.md` selbst im vorbereiteten Worktree liest.
 */

import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { platform } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { emitKeypressEvents } from 'node:readline';
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';
import {
  buildIssueBranchName,
  resolveGhHost,
} from './ensure-issue-branch.mjs';
import { isWindows, prepareSpawn } from './platform-shared.mjs';
import { prepareCopilotEnvironment } from './copilot-environment.mjs';
import {
  assignIssueToUser,
  buildCopilotArgs,
  buildCopilotChildEnv,
  buildCopilotShellCommand,
  buildTmuxSessionName,
  COPILOT_COMMAND,
  ensureProjectPropertyAccess,
  resolveIssueWorktreePath,
  requestPullRequestReviewers,
  resolveCurrentGitHubUser,
  resolveHumanReviewerLogins,
  detectIdFromTmuxSession,
  ensureTmuxSessionAvailable,
  launchInNewTmuxSession,
  parseFlowFlags,
  reportCopilotLaunchPlan,
  resolveAdditionalPrompt,
  trustWorktreeFolder,
} from './flow-shared.mjs';
import { resolveCopilotLaunchPlan } from './copilot-provider.mjs';

const WORKFLOW_PROMPT_RELATIVE_PATH = '.github/prompts/startwork.prompt.md';
const HELP_TEXT = `Usage:
  node scripts/start-work.mjs
  node scripts/start-work.mjs IS_480
  ./scripts/start-work.mjs

Prepare an issue-specific worktree, verify the issue
gates before any branch/worktree mutation, ensure a
draft PR exists before the actual Copilot implementation dispatch when required,
confirm renaming a related current tmux session to IS<n> when necessary,
offer an issue ID prompt plus optional extra context, and launch GitHub Copilot CLI as:

  copilot --agent Squad --yolo -i "<prompt>"

with an instruction that tells Copilot to read this workflow prompt itself:

  ${WORKFLOW_PROMPT_RELATIVE_PATH}

If that file is missing in the resolved worktree, the script offers a local-branch
single-file checkout recovery step before continuing.

Arrow-key menus are used on TTYs; plain prompts are used as a fallback.

Optional positional CLI argument:
  IS_123 / IS-123 / IS123

For existing pull requests, use npm run start-review -- PR_456 instead.

Run this script before starting a Copilot CLI session.

Flow flags:
  --notmux            Do not check or use tmux; run Copilot in the foreground.
  --prompt "<text>"   Start directly with this additional prompt (skips the question).
  --noprompt          Skip the question for an additional prompt.
  --prompt and --noprompt are mutually exclusive.
  --model <id>        Copilot provider model for this run (deepseek-v4-flash|deepseek-v4-pro).
  --no-provider       Ignore the DeepSeek provider configuration for this run.

Outside tmux, the script creates the session IS<n> (aborts if it already exists,
e.g. attach with: tmux attach -t IS202) and continues there. Created sessions use
"mouse off" and disable Copilot mouse capture where supported; startup prints a copy hint. The worktree is
added to trusted_folders of the Copilot configuration automatically.

Windows has no tmux build: use --notmux, or let the script fall back to the
foreground automatically when tmux is missing.
`;

const PORT_ENV_NAMES = ['DEV_SERVER_PORT'];

export async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    process.stdout.write(HELP_TEXT);
    return;
  }

  const flowFlags = parseFlowFlags(process.argv.slice(2));
  // Der Plan wird genau einmal pro Lauf aufgelöst; ein ungültiges --model bricht hier ab.
  const copilotPlan = resolveCopilotLaunchPlan({
    modelFlag: flowFlags.model,
    noProvider: flowFlags.noProvider,
  });
  const cliSelection = parseCliSelection(flowFlags.rest);
  console.log('Checking GitHub authentication and project access...');
  ensureProjectPropertyAccess(runCommand);
  console.log('GitHub authentication and project access verified.');

  const repoRoot = getMainCheckoutPath();
  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const workType = 'issue';
  let requestedId;
  let additionalPrompt;
  let issueContext;
  let initialCopilotPrompt;
  let preparedWorkContext;
  let branchContext;
  let dispatchContext;
  let gateResult;

  try {
    if (cliSelection) {
      ({ requestedId } = cliSelection);
    } else {
      const detected = flowFlags.notmux ? null : detectIdFromTmuxSession('issue');
      if (detected) {
        console.log(`Using issue #${detected.id} from tmux session "${detected.sessionName}".`);
        requestedId = detected.id;
      } else {
        requestedId = await promptNumericId(prompt, workType);
      }
    }
    issueContext = resolveIssueContext(workType, requestedId);
    console.log(`Selected issue #${requestedId}: ${issueContext.issueTitle}`);
    issueContext = attachCanonicalNames(issueContext, repoRoot);
    issueContext = preflightStartWorkTarget(issueContext, repoRoot);
    branchContext = await runGateThenAssignAndResolveBranch(issueContext, repoRoot, prompt, {
      onGatePassed: (result) => {
        gateResult = result;
      },
    });
    const tmuxAvailable = !flowFlags.notmux && isTmuxAvailable();
    ensureTmuxSessionAvailable(issueContext.tmuxSessionName, {
      tmuxAvailable,
      notmux: flowFlags.notmux,
    });
    const tmuxContext = await resolveCurrentTmuxContext(
      tmuxAvailable,
      issueContext.tmuxSessionName,
      { prompt }
    );
    ensureBranchReadyForWorktree(repoRoot, branchContext);
    dispatchContext = ensureDispatchPrContext(issueContext, repoRoot, branchContext);
    ensurePullRequestReviewers(issueContext, dispatchContext, repoRoot);
    additionalPrompt = await resolveAdditionalPrompt(flowFlags, () =>
      promptAdditionalPrompt(prompt)
    );
    initialCopilotPrompt = buildInitialCopilotPrompt(additionalPrompt, issueContext);
    preparedWorkContext = await prepareWorkContext(issueContext, repoRoot, prompt, {
      branchContext,
      tmuxAvailable,
      tmuxContext,
    });
    // Erst nach dem Gate und im fertig aufgelösten Ziel-Worktree: der Marker ist
    // worktree-lokal, die Copilot-Session liest ihn gleich in genau diesem Ordner.
    activateActiveIssueMarker(
      {
        worktreePath: preparedWorkContext.worktreeContext.worktreePath,
        issueId: issueContext.issueId,
        issueTitle: issueContext.issueTitle,
        projectStatus: gateResult?.projectStatus ?? null,
        sessionId: preparedWorkContext.tmuxAvailable
          ? issueContext.tmuxSessionName
          : `${issueContext.canonicalName}-notmux`,
        tonyApproved: gateResult?.tonyApproved === true,
      }
    );
  } finally {
    prompt.close();
  }

  preparedWorkContext.dispatchContext = dispatchContext;
  await launchPreparedWork(preparedWorkContext, issueContext, initialCopilotPrompt, copilotPlan);
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

export function preflightStartWorkTarget(issueContext) {
  if (issueContext.requestedType === 'pr') {
    throw new Error('start-work only implements issues. Use npm run start-review for PR contexts.');
  }
  return issueContext;
}

function assignIssueToCurrentHuman(issueContext) {
  if (!Number.isInteger(issueContext.issueId)) {
    return;
  }

  const currentUser = resolveCurrentGitHubUser(runCommand);
  console.log(`Assigning issue #${issueContext.issueId} to ${currentUser.login}...`);
  assignIssueToUser(runCommand, issueContext.issueId, currentUser.login);
  console.log(`Issue #${issueContext.issueId} assigned to ${currentUser.login}.`);
}

function ensurePullRequestReviewers(issueContext, dispatchContext, repoRoot) {
  if (issueContext.requestedType !== 'issue' || !Number.isInteger(dispatchContext?.prNumber)) {
    console.log('Skipping reviewer requests: no issue-start PR to configure.');
    return;
  }

  console.log(`Checking Developer reviewers for PR #${dispatchContext.prNumber}...`);
  const prInfo = readGhJson([
    'pr',
    'view',
    String(dispatchContext.prNumber),
    '--json',
    'author,reviewRequests',
  ]);
  const prAuthorLogin =
    typeof prInfo?.author?.login === 'string' && prInfo.author.login.trim()
      ? prInfo.author.login.trim()
      : null;
  const requestedReviewers = new Set(
    Array.isArray(prInfo?.reviewRequests)
      ? prInfo.reviewRequests
          .map((request) => request?.login)
          .filter((login) => typeof login === 'string' && login.trim())
      : []
  );
  const resolvedReviewers = [
    ...new Set(
      resolveHumanReviewerLogins(runCommand, repoRoot)
        .map((entry) => entry.login)
        .filter((login) => login !== prAuthorLogin && !requestedReviewers.has(login))
    ),
  ];

  if (resolvedReviewers.length === 0) {
    console.log(
      `Skipping reviewer requests for PR #${dispatchContext.prNumber}: no eligible Developer reviewers remain after excluding the author and existing requests.`
    );
    return;
  }

  console.log(
    `Requesting reviewers for PR #${dispatchContext.prNumber}: ${resolvedReviewers.join(', ')}...`
  );
  requestPullRequestReviewers(runCommand, dispatchContext.prNumber, resolvedReviewers);
  console.log(`Reviewer requests completed for PR #${dispatchContext.prNumber}.`);
}

/**
 * Erzwingt die von #116 geforderte Reihenfolge „erst Gates, dann Zuweisung“:
 * Gates müssen vor jeder Zuweisung und vor Seiteneffekten an Branch, PR,
 * Worktree oder Laufzeit kommen. Ein fehlgeschlagenes Gate wirft, bevor
 * `assign` oder `resolveBranch` überhaupt laufen.
 */
async function runGateThenAssignAndResolveBranch(
  issueContext,
  repoRoot,
  prompt,
  {
    validateGate = validateIssueStartGate,
    assign = assignIssueToCurrentHuman,
    resolveBranch = resolveBranchContext,
    onGatePassed = () => {},
  } = {}
) {
  const gateResult = await validateGate(issueContext, prompt);
  onGatePassed(gateResult);
  const branchContext = resolveBranch(issueContext, repoRoot);
  assign(issueContext);
  return branchContext;
}

const ACTIVE_ISSUE_MARKER_FILENAME = '.frickeldave-active-issue';
const FALLBACK_MARKER_STATUS = 'Ready to implement';

/**
 * Schreibt den Inhalt des Aktivierungsmarkers im dokumentierten YAML-Format
 * aus `.squad/routing.md`.
 */
function buildActiveIssueMarkerContent({
  issueId,
  issueTitle,
  status,
  sessionId,
  approvedAt,
}) {
  const quote = (value) => `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  return [
    `issue: ${issueId}`,
    `title: ${quote(issueTitle)}`,
    `status: ${quote(status)}`,
    'tony_approved: true',
    `tony_approved_at: ${quote(approvedAt)}`,
    `session_id: ${quote(sessionId)}`,
    '',
  ].join('\n');
}

/**
 * Zeitstempel im Doku-Format `2026-06-30T15:41:12+0200` (lokale Zeit mit
 * Offset, ohne Doppelpunkt im Offset).
 */
function formatActiveIssueTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const hours = pad(Math.floor(Math.abs(offsetMinutes) / 60));
  const minutes = pad(Math.abs(offsetMinutes) % 60);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${hours}${minutes}`;
}

/**
 * Aktiviert den lokalen Marker `.frickeldave-active-issue` im Ziel-Worktree.
 *
 * Der Marker ist gitignored und damit maschinen- und worktree-lokal: ein frisch
 * angelegter Worktree hat ihn nie. `npm run start-work` ist die ausdrückliche
 * menschliche Bestätigungshandlung (Gate „Nutzerbestätigung“), und Tony hat über
 * `go:yes` autorisiert; deshalb schreibt ausschließlich der Launcher den Marker,
 * und zwar erst auf dem bereits gate-geprüften Pfad. Agenten lesen ihn nur.
 *
 * Der Aufruf ist idempotent: bei unverändertem Issue, Titel, Status und
 * Session-Kontext bleibt die Datei samt ursprünglichem `tony_approved_at`
 * unberührt. Erst abweichender Inhalt führt zu einem sichtbaren Überschreiben.
 */
function activateActiveIssueMarker(
  {
    worktreePath,
    issueId,
    issueTitle,
    projectStatus,
    sessionId,
    tonyApproved = false,
  },
  {
    readFile = (path) => readFileSync(path, 'utf8'),
    writeFile = (path, content) => writeFileSync(path, content, 'utf8'),
    fileExists = existsSync,
    now = new Date(),
    log = console.log,
  } = {}
) {
  if (tonyApproved !== true) {
    throw new Error(
      `Aktivierungsmarker ${ACTIVE_ISSUE_MARKER_FILENAME} darf ohne bestätigte Tony-Freigabe (go:yes, kein Konflikt-Label) nicht geschrieben werden.`
    );
  }

  const markerPath = join(worktreePath, ACTIVE_ISSUE_MARKER_FILENAME);
  const markerContext = {
    issueId,
    issueTitle,
    status: projectStatus || FALLBACK_MARKER_STATUS,
    sessionId,
    approvedAt: formatActiveIssueTimestamp(now),
  };
  const content = buildActiveIssueMarkerContent(markerContext);

  if (fileExists(markerPath)) {
    let existing;
    try {
      existing = readFile(markerPath);
    } catch (error) {
      throw new Error(
        `Aktivierungsmarker ${markerPath} ist vorhanden, aber nicht lesbar: ${error?.message ?? error}. Bitte den Marker im Ziel-Worktree prüfen.`
      );
    }

    const existingApprovedAt = existing.match(/^tony_approved_at: "([^"]*)"$/m)?.[1];
    if (existing === content) {
      log(`Aktivierungsmarker ${ACTIVE_ISSUE_MARKER_FILENAME} für #${issueId} ist bereits aktuell.`);
      return markerPath;
    }
    if (
      existingApprovedAt &&
      buildActiveIssueMarkerContent({ ...markerContext, approvedAt: existingApprovedAt }) ===
        existing
    ) {
      log(
        `Aktivierungsmarker ${ACTIVE_ISSUE_MARKER_FILENAME} für #${issueId} ist bereits aktuell (tony_approved_at bleibt ${existingApprovedAt}).`
      );
      return markerPath;
    }

    const previousIssue = existing.match(/^issue: (\d+)$/m)?.[1];
    try {
      writeFile(markerPath, content);
    } catch (error) {
      throw new Error(
        `Aktivierungsmarker ${markerPath} konnte nicht geschrieben werden: ${error?.message ?? error}. Ohne Marker darf die Copilot-Session nicht starten.`
      );
    }
    log(
      previousIssue && previousIssue !== String(issueId)
        ? `Aktivierungsmarker ${ACTIVE_ISSUE_MARKER_FILENAME} für #${issueId} aktiviert (vorher #${previousIssue}).`
        : `Aktivierungsmarker ${ACTIVE_ISSUE_MARKER_FILENAME} für #${issueId} aktualisiert.`
    );
    return markerPath;
  }

  try {
    writeFile(markerPath, content);
  } catch (error) {
    throw new Error(
      `Aktivierungsmarker ${markerPath} konnte nicht geschrieben werden: ${error?.message ?? error}. Ohne Marker darf die Copilot-Session nicht starten.`
    );
  }
  log(`Aktivierungsmarker ${ACTIVE_ISSUE_MARKER_FILENAME} für #${issueId} aktiviert.`);
  return markerPath;
}

async function prepareWorkContext(issueContext, repoRoot, prompt, options = {}) {
  const tmuxAvailable = options.tmuxAvailable ?? isTmuxAvailable();
  const branchContext = options.branchContext ?? resolveBranchContext(issueContext, repoRoot);
  const tmuxContext =
    options.tmuxContext ??
    (await resolveCurrentTmuxContext(tmuxAvailable, issueContext.tmuxSessionName, { prompt }));
  const worktreeContext = await resolveWorktreeContext(issueContext, repoRoot, branchContext);

  await prepareWorktreeRuntime(issueContext, worktreeContext, repoRoot, prompt);
  const portEnv = createPortEnvironment(issueContext.canonicalName);
  logPortEnvironment(portEnv);

  return {
    branchContext,
    tmuxAvailable,
    tmuxContext,
    worktreeContext,
    portEnv,
  };
}

export async function prepareWorktreeRuntime(
  issueContext,
  worktreeContext,
  repoRoot,
  prompt,
  {
    ensurePrompt = ensureWorkflowPromptAvailable,
    prepareDependencies = ensureDependenciesReady,
  } = {}
) {
  console.log(`Preparing workflow prompt and dependencies in ${worktreeContext.worktreePath}...`);
  await ensurePrompt(worktreeContext, repoRoot, prompt);
  prepareDependencies(worktreeContext.repoRoot, worktreeContext.worktreePath);
  console.log('Workflow prompt and dependencies ready.');
}

async function launchPreparedWork(
  preparedWorkContext,
  issueContext,
  initialCopilotPrompt,
  copilotPlan = null
) {
  const { dispatchContext, tmuxAvailable, tmuxContext, worktreeContext, portEnv } =
    preparedWorkContext;
  const sessionName = issueContext.tmuxSessionName;
  const copilotPrompt = buildInitialCopilotPromptWithDispatchContext(
    initialCopilotPrompt,
    dispatchContext
  );

  reportCopilotLaunchPlan(copilotPlan);
  trustWorktreeFolder(worktreeContext.worktreePath);
  prepareCopilotEnvironment(worktreeContext.worktreePath, {
    tmuxAvailable,
    sessionName: issueContext.tmuxSessionName,
  });

  if (!tmuxAvailable) {
    console.log(`Starting Copilot in ${worktreeContext.worktreePath} (tmux unavailable)...`);
    const exitCode = await runForegroundCommand(
      COPILOT_COMMAND,
      buildCopilotArgs(copilotPrompt, copilotPlan),
      {
        cwd: worktreeContext.worktreePath,
        env: buildCopilotChildEnv(process.env, copilotPlan, portEnv),
      }
    );
    process.exitCode = exitCode;
    return;
  }

  if (tmuxContext.isInsideTmux) {
    console.log(`Starting Copilot window in tmux session ${sessionName}...`);
    setTmuxSessionEnvironment(sessionName, portEnv);
    const windowId = createCopilotWindow(
      sessionName,
      worktreeContext.worktreePath,
      portEnv,
      copilotPrompt,
      copilotPlan
    );
    selectTmuxWindow(sessionName, windowId);
    console.log(`Copilot window ${windowId} selected in tmux session ${sessionName}.`);
    return;
  }

  console.log(`Starting Copilot in new tmux session ${sessionName}...`);
  process.exitCode = launchInNewTmuxSession(
    sessionName,
    worktreeContext.worktreePath,
    buildCopilotShellCommand(portEnv, copilotPrompt, copilotPlan)
  );
}

/**
 * @param {string[]} argv
 * @returns {{ workType: 'issue' | 'pr'; requestedId: number } | null}
 */
function parseCliSelection(argv) {
  const positionals = [];

  for (const arg of argv) {
    if (arg === '--pr' || arg.startsWith('--pr=')) {
      throw new Error(
        'start-work only implements issues. Use npm run start-review for PR contexts.'
      );
    }
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
      `Expected at most one positional work reference, but received ${positionals.length}: ${positionals.join(', ')}.`
    );
  }

  const parsed = parseCanonicalRefToken(positionals[0]);
  if (!parsed) {
    throw new Error(
      `Invalid issue reference "${positionals[0]}". Use exactly one canonical token such as "IS_123", "IS-123", or "IS123". Bare numbers and "#123" are not supported as CLI arguments.`
    );
  }

  return parsed;
}

/**
 * @param {string} value
 * @returns {{ workType: 'issue'; requestedId: number } | null}
 */
function parseCanonicalRefToken(value) {
  if (/^pr(?:[_-]?)(\d+)$/i.test(value.trim())) {
    throw new Error('start-work only implements issues. Use npm run start-review for PR contexts.');
  }
  const match = value.trim().match(/^is(?:[_-]?)([1-9]\d*)$/i);
  if (!match) {
    return null;
  }

  return {
    workType: 'issue',
    requestedId: Number.parseInt(match[1], 10),
  };
}

/**
 * @param {import('node:readline/promises').Interface} prompt
 * @param {'issue' | 'pr'} workType
 * @returns {Promise<number>}
 */
async function promptNumericId(prompt, workType) {
  const label = workType === 'issue' ? 'issue' : 'PR';

  while (true) {
    const answer = (await prompt.question(`Enter the numeric ${label} ID: `)).trim();

    if (/^\d+$/.test(answer)) {
      return Number.parseInt(answer, 10);
    }

    console.log(`Please enter a numeric ${label} ID.`);
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
 * @param {'issue' | 'pr'} workType
 * @param {number} requestedId
 */
function resolveIssueContext(workType, requestedId) {
  preflightStartWorkTarget({ requestedType: workType });
  const canonicalRefName = buildCanonicalRefName(workType, requestedId);

  const issue = readGhJson(['issue', 'view', String(requestedId), '--json', 'title']);
  return {
    requestedType: workType,
    requestedId,
    canonicalRefName,
    issueId: requestedId,
    issueTitle: issue.title,
    branchSlug: slugifyTitle(issue.title),
  };
}

const ACCEPTED_PROJECT_STATUSES = ['Ready to Implement', 'In Progress'];

/**
 * Ermittelt das Feld „Status“ eines Issues in GitHub Projects v2 per GraphQL
 * und umgeht damit `gh issue view --json projectItems`, das ältere
 * `gh`-CLI-Versionen (z. B. 2.23.0) mit „Unknown JSON field“ ablehnen. Das ist
 * robuster als ein Fallback nur über Labels, weil der Status weiterhin
 * automatisch geprüft wird, statt eine manuelle Bestätigung zu verlangen.
 *
 * @param {{ issueId: number }} issueContext
 * @param {{ env?: NodeJS.ProcessEnv; readGhJson?: (args: string[]) => any; repositoryContext?: { owner: string; repo: string; repository: string; host?: string } }} [options]
 */
function loadProjectItemsViaGraphql(issueContext, options = {}) {
  const readGhJsonImpl = options.readGhJson ?? readGhJson;
  const repositoryContext = options.repositoryContext ?? resolveGhRepositoryContext(options);
  const query = `query StartWorkIssueProjectItems($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) {
        projectItems(first: 20) {
          nodes {
            id
            fieldValueByName(name: "Status") {
              __typename
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
              }
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
    `owner=${repositoryContext.owner}`,
    '-F',
    `repo=${repositoryContext.repo}`,
    '-F',
    `number=${issueContext.issueId}`,
  ];

  if (repositoryContext.host) {
    args.push('--hostname', repositoryContext.host);
  }

  const payload = readGhJsonImpl(args);
  return payload?.data?.repository?.issue?.projectItems?.nodes ?? [];
}

/**
 * @param {{ env?: NodeJS.ProcessEnv; readGhJson?: (args: string[]) => any }} [options]
 */
function resolveGhRepositoryContext(options = {}) {
  const readGhJsonImpl = options.readGhJson ?? readGhJson;
  const env = options.env ?? process.env;
  const repository =
    normalizeRepositoryName(env.GITHUB_REPOSITORY) ?? loadRepositoryFromGh(readGhJsonImpl);
  const host = resolveGhHost(env);
  const [owner, repo] = repository.split('/');

  if (!owner || !repo) {
    throw new Error(`Invalid GitHub repository context: ${repository}`);
  }

  return { owner, repo, repository, host };
}

/**
 * @param {(args: string[]) => any} readGhJsonImpl
 */
function loadRepositoryFromGh(readGhJsonImpl) {
  const repoInfo = readGhJsonImpl(['repo', 'view', '--json', 'owner,name']);
  const owner = repoInfo?.owner?.login;
  const repo = repoInfo?.name;

  if (typeof owner !== 'string' || !owner || typeof repo !== 'string' || !repo) {
    throw new Error('GitHub CLI did not return a valid repository owner/name payload.');
  }

  return `${owner}/${repo}`;
}

/**
 * @param {unknown} repository
 */
function normalizeRepositoryName(repository) {
  if (typeof repository !== 'string') {
    return null;
  }

  const trimmed = repository.trim();
  return trimmed && trimmed.includes('/') ? trimmed : null;
}

/**
 * @param {{ requestedType: 'issue' | 'pr'; issueId: number }} issueContext
 * @param {import('node:readline/promises').Interface} prompt
 * @param {{ readGhJson?: (args: string[]) => any; log?: (message: string) => void }} [options]
 */
async function validateIssueStartGate(issueContext, prompt, options = {}) {
  const log = options.log ?? console.log;
  if (issueContext.requestedType !== 'issue') {
    log('Skipping issue-start gates for the existing PR context.');
    return { tonyApproved: false, projectStatus: null };
  }

  const readGhJsonImpl = options.readGhJson ?? readGhJson;
  log(`Checking issue #${issueContext.issueId} go and squad gates...`);

  const issue = readGhJsonImpl(['issue', 'view', String(issueContext.issueId), '--json', 'labels']);
  const labels = Array.isArray(issue.labels)
    ? issue.labels.map((label) => label?.name).filter(Boolean)
    : [];
  const goLabels = labels.filter((label) => label.startsWith('go:'));
  const squadLabels = labels.filter((label) => label.startsWith('squad:'));

  if (!goLabels.includes('go:yes')) {
    throw new Error(
      `Issue #${issueContext.issueId} is not ready: missing required "go:yes" label. Aborting before branch/PR creation.`
    );
  }

  const conflictingGoLabels = goLabels.filter((label) => label !== 'go:yes');
  if (conflictingGoLabels.length > 0) {
    throw new Error(
      `Issue #${issueContext.issueId} is not ready: conflicting go labels present (${conflictingGoLabels.join(', ')}). Aborting before branch/PR creation.`
    );
  }

  const implementerLabels = squadLabels.filter(
    (label) => label !== 'squad:tony' && label !== 'squad:pepper'
  );
  if (implementerLabels.length === 0) {
    throw new Error(
      `Issue #${issueContext.issueId} is not ready: missing implementer squad:* label (e.g. squad:natasha for frontend); squad:tony and squad:pepper alone do not qualify. Aborting before branch/PR creation.`
    );
  }

  log(`Issue #${issueContext.issueId}: go:yes and squad gates passed; checking project status...`);
  let projectItems = [];
  try {
    projectItems = loadProjectItemsViaGraphql(issueContext, { readGhJson: readGhJsonImpl });
  } catch {
    projectItems = [];
  }

  const projectStatus = resolveProjectStatus(projectItems);

  if (projectStatus) {
    log(`Issue #${issueContext.issueId}: project status is "${projectStatus}".`);
    if (!ACCEPTED_PROJECT_STATUSES.includes(projectStatus)) {
      throw new Error(
        `Issue #${issueContext.issueId} is not ready: project status is "${projectStatus}" instead of one of [${ACCEPTED_PROJECT_STATUSES.join(', ')}]. Aborting before branch/PR creation.`
      );
    }
    log(`Issue #${issueContext.issueId}: start gates passed.`);
    return { tonyApproved: true, projectStatus };
  }

  // Auch die GraphQL-Auflösung ist fehlgeschlagen (z. B. kein Projekt-Zugriff
  // von dieser Maschine bzw. mit diesem Token). In diesem Fall darf es NICHT
  // stillschweigend weitergehen — ein Issue in „Backlog“ würde sonst unbemerkt
  // durchrutschen. Hart abbrechen und den Menschen den Board-Status explizit
  // bestätigen lassen, bevor es weitergeht.
  log(
    `Issue #${issueContext.issueId}: project status could not be verified automatically (no project access from this machine/token).`
  );

  const confirmation = await selectMenuOption(
    prompt,
    `Bitte im GitHub-Projektboard prüfen: Steht Issue #${issueContext.issueId} auf "Ready to Implement" oder "In Progress"?`,
    [
      { value: 'confirmed', label: 'Ja, bestätigt – weiter', aliases: ['1', 'yes', 'ja'] },
      { value: 'abort', label: 'Nein / unsicher – abbrechen', aliases: ['2', 'no', 'nein'] },
    ]
  );

  if (confirmation !== 'confirmed') {
    throw new Error(
      `Issue #${issueContext.issueId}: project status not confirmed by user. Aborting before branch/PR creation.`
    );
  }
  log(`Issue #${issueContext.issueId}: start gates passed with human project-status confirmation.`);
  return { tonyApproved: true, projectStatus: null };
}

/**
 * @param {{
 *   requestedType: 'issue' | 'pr';
 *   requestedId: number;
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

/**
 * @param {'issue' | 'pr'} workType
 * @param {number} requestedId
 */
function buildCanonicalRefName(workType, requestedId) {
  return `${workType === 'issue' ? 'IS' : 'PR'}_${requestedId}`;
}

/**
 * @param {string} repoName
 * @param {string} canonicalRefName
 */
function buildCanonicalResourceName(repoName, canonicalRefName) {
  return `${repoName}_${canonicalRefName}`;
}

function resolveProjectStatus(projectItems) {
  if (!Array.isArray(projectItems) || projectItems.length === 0) {
    return null;
  }

  for (const item of projectItems) {
    const graphqlStatus = item?.fieldValueByName?.name;
    if (typeof graphqlStatus === 'string' && graphqlStatus.trim()) {
      return graphqlStatus.trim();
    }

    const status = item?.status?.name;
    if (typeof status === 'string' && status.trim()) {
      return status.trim();
    }

    const fieldValues = Array.isArray(item?.fieldValues) ? item.fieldValues : [];
    for (const fieldValue of fieldValues) {
      const fieldName = fieldValue?.field?.name;
      const optionName = fieldValue?.name;
      if (fieldName === 'Status' && typeof optionName === 'string' && optionName.trim()) {
        return optionName.trim();
      }
    }
  }

  return null;
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
async function resolveCurrentTmuxContext(
  tmuxAvailable,
  sessionName,
  { prompt, run = runCommand, env = process.env } = {}
) {
  if (!tmuxAvailable || !env.TMUX) {
    return { isInsideTmux: false };
  }

  const execute = (args, description) => {
    const result = run('tmux', args, { description });
    if (result.error || result.status !== 0) {
      throw new Error(
        `Failed ${description}: ${result.error?.message ?? result.stderr ?? result.status}`
      );
    }
    return result.stdout.trim();
  };
  const [sessionId, currentSessionName] = execute(
    [
      'display-message',
      '-p',
      ...(env.TMUX_PANE ? ['-t', env.TMUX_PANE] : []),
      '#{session_id}\t#{session_name}',
    ],
    'reading current tmux session identity'
  ).split('\t');
  if (!/^\$\d+$/.test(sessionId) || !currentSessionName) {
    throw new Error('Cannot determine a stable current tmux session identity.');
  }

  if (currentSessionName !== sessionName) {
    if (sessionName.startsWith('IS') && /^PR[_-]?[1-9]\d*$/i.test(currentSessionName)) {
      throw new Error(
        'start-work cannot use a PR tmux context. Use npm run start-review or leave tmux before starting an issue.'
      );
    }
    const issueNumber = sessionName.match(/^IS([1-9]\d*)$/)?.[1];
    if (
      !issueNumber ||
      !new RegExp(`(?:^|[^0-9])${issueNumber}(?![0-9])`).test(currentSessionName)
    ) {
      throw new Error(
        `Invalid tmux state: current session "${currentSessionName}" does not match canonical session "${sessionName}". Switch to tmux session "${sessionName}" or exit tmux before rerunning.`
      );
    }
    const checkCollision = () => {
      const sessions = execute(
        ['list-sessions', '-F', '#{session_name}'],
        'checking tmux session collision'
      );
      if (sessions.split('\n').includes(sessionName)) {
        throw new Error(
          `Cannot rename tmux session: canonical session "${sessionName}" already exists.`
        );
      }
    };
    checkCollision();
    const answer = await prompt?.question(
      `Rename current tmux session "${currentSessionName}" to "${sessionName}"? [y/N]: `
    );
    if (!/^(?:y|yes)$/i.test(answer?.trim() ?? '')) {
      throw new Error('tmux session rename declined. Aborting before branch/worktree preparation.');
    }
    checkCollision();
    execute(['rename-session', '-t', sessionId, sessionName], 'renaming current tmux session');
    const verified = execute(
      ['display-message', '-p', '-t', sessionId, '#{session_id}\t#{session_name}'],
      'verifying renamed tmux session'
    );
    if (verified !== `${sessionId}\t${sessionName}`) {
      throw new Error(
        `Renamed tmux session verification failed: expected ${sessionId} "${sessionName}".`
      );
    }
  }

  return {
    isInsideTmux: true,
    currentSessionName: sessionName,
    sessionId,
  };
}

/**
 * Feature-Branches MÜSSEN von „dev“ abzweigen (dev-first-Policy, #116). Das ist
 * unabhängig von `resolveDefaultBranch()`, das den Default-Branch des
 * Repositories abbildet (z. B. „main“) und NICHT als stiller Fallback für neue
 * Feature-Branches dienen darf. Der Review-Modus (PR) ist nicht betroffen: Er
 * nutzt weiterhin das tatsächliche `baseRefName` des PRs, weil ein Review auf
 * der echten Basis eines bereits existierenden PRs arbeitet.
 */
const FEATURE_BRANCH_BASE = 'dev';

/**
 * Bricht hart ab („fail closed“), bevor Branch, Worktree oder PR entstehen,
 * wenn „dev“ lokal oder auf origin nicht auflösbar ist (#116).
 */
function ensureDevBaseBranchAvailable(
  repoRoot,
  baseBranch = FEATURE_BRANCH_BASE,
  {
    resolveRef = (root, branch) => {
      if (
        gitRefExists(root, `refs/remotes/origin/${branch}`) ||
        localBranchExists(root, branch) ||
        remoteBranchExists(root, branch)
      ) {
        return branch;
      }
      throw new Error(`Base branch "${branch}" is unavailable.`);
    },
  } = {}
) {
  try {
    resolveRef(repoRoot, baseBranch);
  } catch {
    throw new Error(
      `Dev-first policy violation: base branch "${baseBranch}" is unavailable locally and on origin. ` +
        'Feature branches must start from "dev"; create/push "dev" before starting new issue work.'
    );
  }
}

/**
 * @param {{
 *   issueId?: number;
 *   branchSlug?: string;
 * }} issueContext
 * @param {string} repoRoot
 */
function resolveBranchContext(
  issueContext,
  repoRoot,
  { ensureDevBaseAvailable = ensureDevBaseBranchAvailable } = {}
) {
  if (issueContext.requestedType === 'pr') {
    return {
      branchName: issueContext.existingPrHeadRefName,
      baseBranch:
        issueContext.existingPrBaseRefName ||
        resolveDefaultBranch(repoRoot).replace(/^origin\//, ''),
      prNumber: issueContext.existingPrNumber ?? null,
    };
  }

  // Hart abbrechen, bevor Branch, Worktree oder PR entstehen, wenn „dev“
  // lokal und auf origin nicht verfügbar ist (#116).
  ensureDevBaseAvailable(repoRoot, FEATURE_BRANCH_BASE);

  return {
    // Gemeinsam mit ensure-issue-branch.mjs genutzt, damit beide Abläufe exakt
    // dieselbe Conventional-Branch-Name-Form erzeugen, die
    // .husky/pre-push-validate.js verlangt.
    branchName: buildIssueBranchName({
      issueId: issueContext.issueId,
      slug: issueContext.branchSlug,
    }),
    baseBranch: FEATURE_BRANCH_BASE,
    prNumber: null,
  };
}

/**
 * @param {string} repoRoot
 * @param {{ branchName: string; baseBranch: string }} branchContext
 * @param {{ createIfMissing?: boolean }} options
 */
function ensureBranchReadyForWorktree(repoRoot, branchContext, { createIfMissing = true } = {}) {
  if (localBranchExists(repoRoot, branchContext.branchName)) {
    console.log(`Reusing local branch ${branchContext.branchName}.`);
    return;
  }

  if (remoteBranchExists(repoRoot, branchContext.branchName)) {
    console.log(`Preparing local tracking branch from origin/${branchContext.branchName}...`);
    ensureLocalBranchAvailability(repoRoot, branchContext.branchName);
    console.log(`Local tracking branch ${branchContext.branchName} ready.`);
    return;
  }

  if (!createIfMissing) {
    throw new Error(
      `Branch "${branchContext.branchName}" does not exist locally or on origin, so no worktree can be created from it.`
    );
  }

  const baseRef = resolveBaseBranchRef(repoRoot, branchContext.baseBranch);
  console.log(`Creating local branch ${branchContext.branchName} from ${baseRef}...`);
  createLocalBranchFromBase(repoRoot, branchContext.branchName, baseRef);
  console.log(`Local branch ${branchContext.branchName} created.`);
}

/**
 * @param {string} repoRoot
 * @param {string} branchName
 * @param {string} baseRef
 */
function createLocalBranchFromBase(repoRoot, branchName, baseRef) {
  runCommand('git', ['branch', branchName, baseRef], {
    cwd: repoRoot,
    description: `creating local branch ${branchName} from ${baseRef}`,
  });
}

/**
 * @param {{
 *   canonicalName: string;
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
    console.log(`Creating worktree ${worktreePath} for ${branchContext.branchName}...`);
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
      console.log(`Reusing concurrently created worktree ${worktreePath}.`);
    } else {
      console.log(`Worktree ${worktreePath} created.`);
    }
  } else {
    console.log(`Reusing worktree ${worktreePath}.`);
  }

  ensureWorktreeBranch(worktreePath, branchContext.branchName);

  return {
    repoRoot,
    repoName: issueContext.repoName,
    worktreePath,
    branchName: branchContext.branchName,
  };
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

function ensureDispatchPrContext(issueContext, repoRoot, branchContext) {
  preflightStartWorkTarget(issueContext);
  console.log(`Checking PR context for branch ${branchContext.branchName}...`);
  let prUrl = issueContext.existingPrUrl;
  let prNumber = null;

  if (prNumber === null) {
    const existingPr = findPullRequestForHeadBranch(branchContext.branchName);
    if (existingPr) {
      prNumber = existingPr.number;
      prUrl = existingPr.url;
      console.log(`Reusing ${existingPr.isDraft ? 'draft PR' : 'PR'} #${prNumber}: ${prUrl}`);
    } else {
      console.log(`Preparing branch ${branchContext.branchName} for a new draft PR...`);
      ensureBranchReadyForDraftPr(
        repoRoot,
        branchContext.branchName,
        branchContext.baseBranch,
        issueContext
      );
      console.log(`Creating draft PR for ${branchContext.branchName}...`);
      const wasCreated = createDraftPullRequest(
        issueContext,
        branchContext.branchName,
        branchContext.baseBranch
      );
      const createdPr = findPullRequestForHeadBranch(branchContext.branchName);

      if (!createdPr) {
        throw new Error(
          `Draft PR creation for branch "${branchContext.branchName}" reported success, but no PR could be resolved afterwards.`
        );
      }

      prNumber = createdPr.number;
      prUrl = createdPr.url;
      console.log(
        wasCreated
          ? `Draft PR #${prNumber} created: ${prUrl}`
          : `Reusing ${createdPr.isDraft ? 'draft PR' : 'PR'} #${prNumber}: ${prUrl}`
      );
    }
  }

  return {
    baseBranch: branchContext.baseBranch,
    branchName: branchContext.branchName,
    prNumber,
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
  const checkoutArgs = [
    '-C',
    worktreeContext.worktreePath,
    'checkout',
    selectedBranch,
    '--',
    WORKFLOW_PROMPT_RELATIVE_PATH,
  ];
  const checkoutResult = runCommand('git', checkoutArgs, {
    allowFailure: true,
    description: `checking out ${WORKFLOW_PROMPT_RELATIVE_PATH} from ${selectedBranch} into ${worktreeContext.worktreePath}`,
  });

  if (checkoutResult.status !== 0) {
    throw new Error(
      `Failed to check out ${WORKFLOW_PROMPT_RELATIVE_PATH} from branch "${selectedBranch}" into worktree "${worktreeContext.worktreePath}". The selected branch likely does not contain that file, or the branch ref could not be resolved. Pick a different local branch that actually contains ${WORKFLOW_PROMPT_RELATIVE_PATH} and rerun this script. ${extractFailureDetails(checkoutResult)}`
    );
  }

  if (!existsSync(workflowPromptPath)) {
    throw new Error(
      `${WORKFLOW_PROMPT_RELATIVE_PATH} is still missing in worktree "${worktreeContext.worktreePath}" after checking it out from branch "${selectedBranch}". Pick a branch that actually contains ${WORKFLOW_PROMPT_RELATIVE_PATH} and rerun this script.`
    );
  }

  console.log(
    `${WORKFLOW_PROMPT_RELATIVE_PATH} is now present in "${worktreeContext.worktreePath}" after being checked out from "${selectedBranch}".`
  );
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
  /** @type {{ path: string | null; branch: string | null }} */
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

export function ensureDependenciesReady(repoRoot, worktreePath) {
  ensureNodeModules(repoRoot, worktreePath);
  ensureHuskyHooks(worktreePath);
}

// .husky/_ wird generiert (gitignored) und core.hooksPath zeigt darauf, deshalb braucht jeder Worktree eine eigene Kopie.
function ensureHuskyHooks(worktreePath) {
  const huskyBin = resolve(worktreePath, 'node_modules', 'husky', 'bin.js');
  if (
    !existsSync(resolve(worktreePath, '.husky')) ||
    existsSync(resolve(worktreePath, '.husky', '_', 'pre-commit')) ||
    !existsSync(huskyBin)
  ) {
    return;
  }

  const result = runCommand(process.execPath, [huskyBin], {
    cwd: worktreePath,
    allowFailure: true,
    description: 'installing husky git hooks in worktree',
  });
  if (result.status !== 0 || !existsSync(resolve(worktreePath, '.husky', '_', 'pre-commit'))) {
    throw new Error(
      `Failed to install husky git hooks in "${worktreePath}". ${extractFailureDetails(result)}`
    );
  }
}

function ensureNodeModules(repoRoot, worktreePath) {
  const worktreeNodeModules = resolve(worktreePath, 'node_modules');
  if (existsSync(worktreeNodeModules)) {
    return;
  }

  const repoNodeModules = resolve(repoRoot, 'node_modules');

  if (existsSync(repoNodeModules)) {
    const linkResult =
      platform() === 'win32'
        ? runCommand('cmd', ['/c', 'mklink', '/J', worktreeNodeModules, repoNodeModules], {
            allowFailure: true,
            description: 'linking node_modules into worktree',
          })
        : runCommand('ln', ['-s', repoNodeModules, worktreeNodeModules], {
            allowFailure: true,
            description: 'symlinking node_modules into worktree',
          });

    if (linkResult.status === 0 && existsSync(worktreeNodeModules)) {
      return;
    }
  }

  const installResult = runCommand('npm', ['install'], {
    cwd: worktreePath,
    allowFailure: true,
    description: 'installing npm dependencies in worktree',
  });

  if (installResult.status !== 0) {
    throw new Error(
      `Failed to prepare dependencies in "${worktreePath}". ${extractFailureDetails(installResult)}`
    );
  }
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

function ensureBranchReadyForDraftPr(repoRoot, branchName, baseBranch, issueContext) {
  const baseRef = resolveBaseBranchRef(repoRoot, baseBranch);

  if (!localBranchExists(repoRoot, branchName)) {
    if (remoteBranchExists(repoRoot, branchName)) {
      ensureLocalBranchAvailability(repoRoot, branchName);
    } else {
      createLocalEmptyCommitBranch(
        repoRoot,
        branchName,
        baseRef,
        buildBootstrapCommitMessage(issueContext.issueId)
      );
    }
  }

  if (countCommitsAheadOfBase(repoRoot, branchName, baseRef) === 0) {
    appendEmptyCommitToBranch(
      repoRoot,
      branchName,
      buildBootstrapCommitMessage(issueContext.issueId)
    );
  }

  pushBranchToOrigin(repoRoot, branchName);
}

function remoteBranchExists(repoRoot, branchName) {
  const result = runCommand('git', ['ls-remote', '--exit-code', '--heads', 'origin', branchName], {
    cwd: repoRoot,
    allowFailure: true,
    description: `checking whether origin/${branchName} exists`,
  });

  return result.status === 0;
}

function countCommitsAheadOfBase(repoRoot, branchName, baseRef) {
  const result = runCommand(
    'git',
    ['rev-list', '--count', `${baseRef}..refs/heads/${branchName}`],
    {
      cwd: repoRoot,
      description: `counting commits ahead of ${baseRef} on ${branchName}`,
    }
  );

  return Number.parseInt(result.stdout.trim(), 10) || 0;
}

function createLocalEmptyCommitBranch(repoRoot, branchName, baseRef, message) {
  const parentSha = resolveCommitSha(repoRoot, baseRef);
  const treeSha = resolveTreeSha(repoRoot, baseRef);
  const commitSha = createEmptyCommitObject(repoRoot, treeSha, parentSha, message);

  runCommand('git', ['update-ref', `refs/heads/${branchName}`, commitSha], {
    cwd: repoRoot,
    description: `creating bootstrap branch ${branchName}`,
  });
}

function appendEmptyCommitToBranch(repoRoot, branchName, message) {
  const branchRef = `refs/heads/${branchName}`;
  const parentSha = resolveCommitSha(repoRoot, branchRef);
  const treeSha = resolveTreeSha(repoRoot, branchRef);
  const commitSha = createEmptyCommitObject(repoRoot, treeSha, parentSha, message);

  runCommand('git', ['update-ref', `refs/heads/${branchName}`, commitSha, parentSha], {
    cwd: repoRoot,
    description: `appending bootstrap commit to ${branchName}`,
  });
}

function resolveCommitSha(repoRoot, refName) {
  return runCommand('git', ['rev-parse', refName], {
    cwd: repoRoot,
    description: `resolving commit sha for ${refName}`,
  }).stdout.trim();
}

function resolveTreeSha(repoRoot, refName) {
  return runCommand('git', ['rev-parse', `${refName}^{tree}`], {
    cwd: repoRoot,
    description: `resolving tree sha for ${refName}`,
  }).stdout.trim();
}

function createEmptyCommitObject(repoRoot, treeSha, parentSha, message) {
  return runCommand('git', ['commit-tree', treeSha, '-p', parentSha], {
    cwd: repoRoot,
    input: `${message}\n`,
    description: 'creating empty bootstrap commit object',
  }).stdout.trim();
}

function pushBranchToOrigin(repoRoot, branchName) {
  runCommand(
    'git',
    ['push', '--set-upstream', 'origin', `refs/heads/${branchName}:refs/heads/${branchName}`],
    {
      cwd: repoRoot,
      description: `pushing branch ${branchName} to origin`,
    }
  );
}

function findPullRequestForHeadBranch(branchName) {
  const prs = readGhJson([
    'pr',
    'list',
    '--head',
    branchName,
    '--state',
    'all',
    '--json',
    'number,url,isDraft,headRefName,baseRefName,title',
    '--limit',
    '10',
  ]);

  const matchingPrs = Array.isArray(prs)
    ? prs.filter((pr) => pr?.headRefName === branchName && Number.isInteger(pr?.number))
    : [];

  if (matchingPrs.length > 1) {
    throw new Error(
      `Expected at most one PR for branch "${branchName}", but found ${matchingPrs.length}.`
    );
  }

  if (matchingPrs.length === 0) {
    return null;
  }

  return {
    number: matchingPrs[0].number,
    url: matchingPrs[0].url,
    isDraft: Boolean(matchingPrs[0].isDraft),
    baseRefName: typeof matchingPrs[0].baseRefName === 'string' ? matchingPrs[0].baseRefName : null,
  };
}

function createDraftPullRequest(issueContext, branchName, baseBranch) {
  const result = runCommand(
    'gh',
    [
      'pr',
      'create',
      '--draft',
      '--base',
      baseBranch,
      '--head',
      branchName,
      '--title',
      buildDraftPrTitle(issueContext),
      '--body',
      buildDraftPrBody(issueContext),
    ],
    {
      allowFailure: true,
      description: `creating draft PR for ${branchName}`,
    }
  );

  if (result.status === 0) {
    return true;
  }

  const existingPr = findPullRequestForHeadBranch(branchName);
  if (existingPr) {
    return false;
  }

  throw new Error(`Failed to create draft PR. ${extractFailureDetails(result)}`);
}

function buildBootstrapCommitMessage(issueId) {
  return `chore: bootstrap draft pr for issue #${issueId}`;
}

function buildDraftPrTitle(issueContext) {
  return `#${issueContext.issueId} ${stripIssueTitleLabels(issueContext.issueTitle)}`;
}

function buildDraftPrBody(issueContext) {
  return [
    `Closes #${issueContext.issueId}`,
    '',
    `Bootstrap Draft-PR angelegt durch \`scripts/start-work.mjs\`, nachdem Worktree/DB/tmux unter "${issueContext.canonicalName}" vorbereitet wurden.`,
    'Implementierungsdetails, Testergebnisse und DoD-Status folgen in späteren Commits und PR-Updates.',
  ].join('\n');
}

/**
 * @param {string} canonicalName
 */
function createPortEnvironment(canonicalName) {
  const hash = createHash('md5').update(canonicalName).digest('hex').slice(0, 8);
  const offset = Number.parseInt(hash, 16) % 1000;
  const base = 40000;

  return {
    DEV_SERVER_PORT: String(base + offset),
  };
}

/**
 * @param {Record<string, string>} portEnv
 * @param {(line: string) => void} [log] Ausgabekanal, damit andere Skripte (z. B.
 *   `scripts/start-review.mjs`) dieselbe Formatierung wiederverwenden können.
 */
function logPortEnvironment(portEnv, log = console.log) {
  log(`Ports: ${PORT_ENV_NAMES.map((envName) => `${envName}=${portEnv[envName]}`).join(', ')}`);
}

function setTmuxSessionEnvironment(sessionName, portEnv) {
  for (const envName of PORT_ENV_NAMES) {
    runCommand('tmux', ['set-environment', '-t', sessionName, envName, portEnv[envName]], {
      description: `setting tmux environment ${envName}`,
    });
  }
}

function createCopilotWindow(
  sessionName,
  worktreePath,
  portEnv,
  initialCopilotPrompt,
  copilotPlan = null
) {
  // Copilot startet als Fensterkommando, statt nach dem Attach Tastendrücke zu senden;
  // so startet die Session deterministisch, ohne Race mit Shell-Start oder History-Zustand.
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
      buildCopilotShellCommand(portEnv, initialCopilotPrompt, copilotPlan),
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

function buildInitialCopilotPrompt(additionalPrompt, issueContext) {
  const basePrompt = `Read ${WORKFLOW_PROMPT_RELATIVE_PATH} and perform its issue implementation workflow.\nwork_ref: ${issueContext.canonicalRefName}\nCanonical worktree context: ${issueContext.canonicalName}\ntmux session: ${issueContext.tmuxSessionName}\nRules: never implement yourself - dispatch the squad:{member} implementer via the task tool; post a documentation comment on the issue (changes, validation, PR link) before reporting completion.`;

  if (!additionalPrompt) {
    return basePrompt;
  }

  return `${basePrompt}\n\n---\n\nAdditional user context:\n${additionalPrompt}`;
}

function buildInitialCopilotPromptWithDispatchContext(initialCopilotPrompt, dispatchContext) {
  return [
    initialCopilotPrompt,
    '',
    `Vorbereiteter Branch: ${dispatchContext.branchName}`,
    `Draft-PR: #${dispatchContext.prNumber}`,
  ].join('\n');
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
  main().catch((error) => {
    console.error(formatError(error));
    process.exit(1);
  });
}

export {
  activateActiveIssueMarker,
  attachCanonicalNames,
  buildActiveIssueMarkerContent,
  buildCopilotArgs,
  buildCopilotChildEnv,
  buildCopilotShellCommand,
  createPortEnvironment,
  createCopilotWindow,
  ensureBranchReadyForWorktree,
  ensureDevBaseBranchAvailable,
  ensureDispatchPrContext,
  ensureWorkflowPromptAvailable,
  formatActiveIssueTimestamp,
  getMainCheckoutPath,
  loadProjectItemsViaGraphql,
  logPortEnvironment,
  parseCanonicalRefToken,
  parseCliSelection,
  readGhJson,
  resolveBranchContext,
  resolveCurrentTmuxContext,
  resolveDefaultBranch,
  resolveProjectStatus,
  resolveWorktreeContext,
  runCommand,
  runForegroundCommand,
  runGateThenAssignAndResolveBranch,
  selectTmuxWindow,
  validateIssueStartGate,
};
