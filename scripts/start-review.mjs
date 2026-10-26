#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';
import { isWindows } from './platform-shared.mjs';
import { prepareCopilotEnvironment } from './copilot-environment.mjs';
import {
  detectIdFromTmuxSession,
  ensureProjectPropertyAccess,
  ensureTmuxSessionAvailable,
  launchInNewTmuxSession,
  parseFlowFlags,
  resolveAdditionalPrompt,
  trustWorktreeFolder,
} from './flow-shared.mjs';
import {
  attachCanonicalNames,
  buildCopilotShellCommand,
  createCopilotWindow,
  createPortEnvironment,
  ensureBranchReadyForWorktree,
  getMainCheckoutPath,
  logPortEnvironment,
  prepareWorktreeRuntime,
  readGhJson,
  resolveCurrentTmuxContext,
  resolveDefaultBranch,
  resolveWorktreeContext,
  runCommand,
  runForegroundCommand,
  selectTmuxWindow,
} from './start-work.mjs';

const WORKFLOW_PROMPT_RELATIVE_PATH = '.github/prompts/startreview.prompt.md';
const COPILOT_COMMAND = 'copilot';
const COPILOT_ARGS = ['--agent', 'Squad', '--yolo'];
const HELP_TEXT = `Usage:
  node scripts/start-review.mjs <pr-id>
  node scripts/start-review.mjs PR_107
  ./scripts/start-review.mjs 107

Review an existing ready-for-review pull request in its canonical PR<n> session
and <ProjectName>_PR_<n> worktree, reusing its head branch. A linked issue is optional.
No issue implementation gates, issue reassignment, draft creation or reviewer requests.
Dispatches ${WORKFLOW_PROMPT_RELATIVE_PATH}, not the implementation prompt.

Flow flags:
  --notmux            Do not check or use tmux; run Copilot in the foreground.
  --prompt "<text>"   Start directly with this additional prompt (skips the question).
  --noprompt          Skip the question for an additional prompt.
  --prompt and --noprompt are mutually exclusive.

Outside tmux, the script creates the session PR<n> (aborts if it already exists,
e.g. attach with: tmux attach -t PR107) and continues there. Created sessions use
"mouse off" and disable Copilot mouse capture where supported; startup prints a copy hint. The worktree is
added to trusted_folders of the Copilot configuration automatically.

Windows has no tmux build: use --notmux, or let the script fall back to the
foreground automatically when tmux is missing.
`;

/**
 * @param {{
 *   argv?: string[];
 *   getMainCheckoutPathFn?: typeof getMainCheckoutPath;
 *   createInterfaceFn?: typeof createInterface;
 *   resolveReviewContextFn?: typeof resolveReviewContext;
 *   promptAdditionalPromptFn?: typeof promptAdditionalPrompt;
 *   prepareReviewWorkContextFn?: typeof prepareReviewWorkContext;
 *   launchPreparedReviewFn?: typeof launchPreparedReview;
 *   ensureProjectPropertyAccessFn?: typeof ensureProjectPropertyAccess;
 * }} [options]
 *
 * StartReview weist das verknüpfte Issue bewusst nicht zu bzw. um (#116):
 * Das ersetzt die Zuweisung in allen drei Launcher-Abläufen, und ein Review darf
 * mit optionalem Issue-Kontext ohne Zuweisungs-Seiteneffekte laufen.
 */
async function runStartReview(options = {}) {
  const {
    argv = process.argv.slice(2),
    getMainCheckoutPathFn = getMainCheckoutPath,
    createInterfaceFn = createInterface,
    resolveReviewContextFn = resolveReviewContext,
    promptAdditionalPromptFn = promptAdditionalPrompt,
    prepareReviewWorkContextFn = prepareReviewWorkContext,
    launchPreparedReviewFn = launchPreparedReview,
    ensureProjectPropertyAccessFn = ensureProjectPropertyAccess,
    detectIdFromTmuxSessionFn = detectIdFromTmuxSession,
    findReadyPrForIssueSessionFn = findReadyPrForIssueSession,
  } = options;

  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(HELP_TEXT);
    return;
  }

  const flowFlags = parseFlowFlags(argv);
  const cliSelection = parseCliSelection(flowFlags.rest);
  ensureProjectPropertyAccessFn(runCommand);

  const repoRoot = getMainCheckoutPathFn();
  const prompt = createInterfaceFn({
    input: process.stdin,
    output: process.stdout,
  });

  let issueContext;
  let additionalPrompt;
  let preparedWorkContext;

  try {
    let requestedPrId = cliSelection;
    if (requestedPrId == null) {
      const detected = flowFlags.notmux ? null : detectIdFromTmuxSessionFn('pr');
      if (detected) {
        console.log(`Using PR #${detected.id} from tmux session "${detected.sessionName}".`);
        requestedPrId = detected.id;
      }
    }
    if (requestedPrId == null) {
      const found = findReadyPrForIssueSessionFn(detectIdFromTmuxSessionFn('issue'));
      if (found) {
        console.log(`Using PR #${found.prId} linked to issue #${found.issueId} (tmux session).`);
        requestedPrId = found.prId;
      }
    }
    requestedPrId ??= await promptPrId(prompt);
    issueContext = attachCanonicalNames(resolveReviewContextFn(requestedPrId), repoRoot);
    additionalPrompt = await resolveAdditionalPrompt(flowFlags, () =>
      promptAdditionalPromptFn(prompt)
    );
    preparedWorkContext = await prepareReviewWorkContextFn(issueContext, repoRoot, prompt, {
      notmux: flowFlags.notmux,
    });
  } finally {
    prompt.close();
  }

  await launchPreparedReviewFn(preparedWorkContext, issueContext, additionalPrompt);
}

export async function main() {
  return runStartReview();
}

function parseCliSelection(argv) {
  const positionals = argv.filter((arg) => arg !== '--help' && arg !== '-h');

  if (positionals.length === 0) {
    return null;
  }

  if (positionals.length > 1) {
    throw new Error(
      `Expected exactly one PR reference, but received ${positionals.length}: ${positionals.join(', ')}.`
    );
  }

  const token = positionals[0].trim();
  const match = token.match(/^(?:PR[_-]?)?([1-9]\d*)$/i);
  if (!match || !Number.isSafeInteger(Number(match[1]))) {
    throw new Error(
      `Invalid PR reference "${token}". Use a numeric PR id or a canonical token like "PR_107".`
    );
  }

  return Number.parseInt(match[1], 10);
}

async function promptPrId(prompt) {
  while (true) {
    const answer = (await prompt.question('Enter the pull request ID: ')).trim();
    if (/^[1-9]\d*$/.test(answer) && Number.isSafeInteger(Number(answer))) {
      return Number.parseInt(answer, 10);
    }
    console.log('Please enter a numeric pull request ID.');
  }
}

async function promptAdditionalPrompt(prompt) {
  const answer = (
    await prompt.question('Optional additional prompt (leave empty to skip): ')
  ).trim();
  return answer || null;
}

function resolveReviewContext(requestedPrId, readGhJsonImpl = readGhJson) {
  const pr = readGhJsonImpl([
    'pr',
    'view',
    String(requestedPrId),
    '--json',
    'title,number,isDraft,headRefName,baseRefName,body',
  ]);

  if (pr.isDraft) {
    throw new Error(
      `PR #${requestedPrId} is still a draft. start-review only works for ready PRs.`
    );
  }

  const headRefName =
    typeof pr.headRefName === 'string' && pr.headRefName.trim() ? pr.headRefName.trim() : null;
  if (!headRefName) {
    throw new Error(`PR #${requestedPrId} did not return a valid headRefName.`);
  }

  return {
    requestedType: 'pr',
    requestedId: requestedPrId,
    canonicalRefName: `PR_${requestedPrId}`,
    issueId: resolveLinkedIssueId(headRefName, pr.body),
    prTitle: pr.title,
    existingPrNumber: Number(pr.number),
    existingPrIsDraft: false,
    existingPrHeadRefName: headRefName,
    existingPrBaseRefName: typeof pr.baseRefName === 'string' ? pr.baseRefName : null,
  };
}

function resolveLinkedIssueId(headRefName, prBody) {
  const fromBranch = issueIdFromBranch(headRefName);
  if (fromBranch) {
    return fromBranch;
  }

  const matches = [
    ...String(prBody ?? '').matchAll(/(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi),
  ]
    .map((match) => Number.parseInt(match[1], 10))
    .filter((value) => Number.isSafeInteger(value) && value > 0);
  const uniqueMatches = [...new Set(matches)];

  if (uniqueMatches.length === 1) {
    return uniqueMatches[0];
  }

  return null;
}

function issueIdFromBranch(branchName) {
  const match =
    branchName?.match(/^squad\/([1-9]\d*)-[a-z0-9][a-z0-9-]*$/i) ??
    branchName?.match(/^feat\/issue-([1-9]\d*)-[a-z0-9][a-z0-9-]*$/i);
  const issueId = Number(match?.[1]);
  return Number.isSafeInteger(issueId) && issueId > 0 ? issueId : null;
}

function resolveReviewBranchContext(issueContext, repoRoot) {
  return {
    branchName: issueContext.existingPrHeadRefName,
    baseBranch:
      issueContext.existingPrBaseRefName || resolveDefaultBranch(repoRoot).replace(/^origin\//, ''),
    prNumber: issueContext.existingPrNumber ?? null,
  };
}

/** Wählt in einer IS<n>-tmux-Session den einen offenen, fertigen PR zum Issue n. */
function findReadyPrForIssueSession(detected, { readJson = readGhJson } = {}) {
  if (!detected) {
    return null;
  }
  try {
    const prs = readJson([
      'pr',
      'list',
      '--state',
      'open',
      '--limit',
      '100',
      '--json',
      'number,isDraft,headRefName,body',
    ]);
    const matches = prs.filter(
      (pr) => !pr.isDraft && resolveLinkedIssueId(pr.headRefName, pr.body) === detected.id
    );
    return matches.length === 1 ? { prId: matches[0].number, issueId: detected.id } : null;
  } catch {
    return null;
  }
}

/**
 * Ein PR-Review darf in der tmux-Session seines verknüpften Issues (IS<n>)
 * laufen. Die Session wird nur übernommen, wenn das verknüpfte Issue existiert,
 * damit sie weder umbenannt noch abgelehnt wird.
 */
function adoptLinkedIssueSession(
  issueContext,
  { detect = detectIdFromTmuxSession, readJson = readGhJson } = {}
) {
  const detected = detect('issue');
  if (!detected || !issueContext.issueId || detected.id !== issueContext.issueId) {
    return false;
  }
  try {
    const issue = readJson(['issue', 'view', String(detected.id), '--json', 'number']);
    if (Number(issue?.number) !== detected.id) {
      return false;
    }
  } catch {
    return false;
  }
  issueContext.tmuxSessionName = detected.sessionName;
  console.log(
    `Using tmux session "${detected.sessionName}" of linked issue #${detected.id} for PR #${issueContext.requestedId}.`
  );
  return true;
}

async function prepareReviewWorkContext(issueContext, repoRoot, prompt, { notmux = false } = {}) {
  const tmuxAvailable = !notmux && isTmuxAvailable();
  if (tmuxAvailable) {
    adoptLinkedIssueSession(issueContext);
  }
  ensureTmuxSessionAvailable(issueContext.tmuxSessionName, { tmuxAvailable, notmux });
  const tmuxContext = await resolveCurrentTmuxContext(tmuxAvailable, issueContext.tmuxSessionName);
  const branchContext = resolveReviewBranchContext(issueContext, repoRoot);
  ensureBranchReadyForWorktree(repoRoot, branchContext, { createIfMissing: false });
  const worktreeContext = await resolveWorktreeContext(issueContext, repoRoot, branchContext);

  await prepareWorktreeRuntime(issueContext, worktreeContext, repoRoot, prompt, {
    ensurePrompt: ensureReviewWorkflowPromptAvailable,
  });
  issueContext.reviewPromptPath = exportTrustedReviewPrompt(issueContext, repoRoot);
  const portEnv = createPortEnvironment(issueContext.canonicalName);
  logPortEnvironment(portEnv);

  return {
    tmuxAvailable,
    tmuxContext,
    worktreeContext,
    portEnv,
  };
}

async function launchPreparedReview(preparedWorkContext, issueContext, additionalPrompt) {
  const { tmuxAvailable, tmuxContext, worktreeContext, portEnv } = preparedWorkContext;
  const copilotPrompt = buildInitialCopilotPrompt(issueContext, additionalPrompt);
  trustWorktreeFolder(worktreeContext.worktreePath);
  prepareCopilotEnvironment(worktreeContext.worktreePath, {
    tmuxAvailable,
    sessionName: issueContext.tmuxSessionName,
  });

  if (!tmuxAvailable) {
    const exitCode = await runForegroundCommand(
      COPILOT_COMMAND,
      [...COPILOT_ARGS, '-i', copilotPrompt],
      {
        cwd: worktreeContext.worktreePath,
        env: { ...process.env, ...portEnv },
      }
    );
    process.exitCode = exitCode;
    return;
  }

  if (tmuxContext.isInsideTmux) {
    const windowId = createCopilotWindow(
      issueContext.tmuxSessionName,
      worktreeContext.worktreePath,
      portEnv,
      copilotPrompt
    );
    selectTmuxWindow(issueContext.tmuxSessionName, windowId);
    return;
  }

  process.exitCode = launchInNewTmuxSession(
    issueContext.tmuxSessionName,
    worktreeContext.worktreePath,
    buildCopilotShellCommand(portEnv, copilotPrompt)
  );
}

function buildInitialCopilotPrompt(issueContext, additionalPrompt) {
  const sections = [
    `Read ${issueContext.reviewPromptPath ?? WORKFLOW_PROMPT_RELATIVE_PATH} and perform its PR review workflow. Do not start issue implementation.`,
    '',
    `PR-ID: ${issueContext.requestedId}`,
    `Linked issue ID (optional, not DB authorization): ${issueContext.issueId ?? 'none'}`,
    `Canonical worktree context: ${issueContext.canonicalName}`,
    `PR head branch: ${issueContext.existingPrHeadRefName}`,
    `tmux session: ${issueContext.tmuxSessionName}`,
  ];

  if (additionalPrompt) {
    sections.push('', '---', '', `Additional user context:\n${additionalPrompt}`);
  }

  return sections.join('\n');
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
 * Der Review-Prompt kommt von origin/dev, nicht vom PR-Branch: der PR kann
 * älter sein als der aktuelle Prompt (oder ihn ändern). Fällt auf die
 * Worktree-Kopie zurück.
 */
function exportTrustedReviewPrompt(issueContext, repoRoot, { run = runCommand } = {}) {
  run('git', ['fetch', 'origin', 'dev'], {
    cwd: repoRoot,
    allowFailure: true,
    description: 'fetching origin/dev for the review prompt',
  });
  const shown = run('git', ['show', `origin/dev:${WORKFLOW_PROMPT_RELATIVE_PATH}`], {
    cwd: repoRoot,
    allowFailure: true,
    description: 'reading the review prompt from origin/dev',
  });
  if (shown.status !== 0 || !String(shown.stdout ?? '').trim()) {
    return null;
  }
  const dir = join(tmpdir(), 'start-flow-review-prompts', issueContext.canonicalRefName);
  mkdirSync(dir, { recursive: true });
  const target = join(dir, 'startreview.prompt.md');
  writeFileSync(target, shown.stdout);
  return target;
}

async function ensureReviewWorkflowPromptAvailable(worktreeContext) {
  const workflowPromptPath = resolve(worktreeContext.worktreePath, WORKFLOW_PROMPT_RELATIVE_PATH);

  if (!existsSync(workflowPromptPath)) {
    throw new Error(
      `${WORKFLOW_PROMPT_RELATIVE_PATH} is missing in worktree "${worktreeContext.worktreePath}".`
    );
  }
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
  runStartReview().catch((error) => {
    console.error(formatError(error));
    process.exit(1);
  });
}

export {
  buildInitialCopilotPrompt,
  exportTrustedReviewPrompt,
  issueIdFromBranch,
  parseCliSelection,
  resolveLinkedIssueId,
  adoptLinkedIssueSession,
  findReadyPrForIssueSession,
  resolveReviewBranchContext,
  resolveReviewContext,
  runStartReview,
};
