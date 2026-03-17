#!/usr/bin/env node

/**
 * Unified Deployment Script
 *
 * Usage:
 *   node deploy.mjs dev [--auto-cleanup]
 *   node deploy.mjs prd [--issue-id <id>] [--skip-issue]
 *
 * Modes:
 *   dev — Commit, push, and optionally merge feature branches into dev.
 *   prd — Merge dev into main and trigger production deployment.
 */

import { execSync, execFileSync, spawnSync } from "child_process";
import { createInterface } from "readline";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { unlinkSync, existsSync } from "fs";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..", "..", "..");
const COPILOT_TMP = join(ROOT, ".copilot-prompt-analyze.txt");

const GITHUB_REPO_OWNER = "Frickeldave";
const GITHUB_REPO_PAGES = "frickeldave.github.io";
const HOMENET_REPO = "HomeNet";
const DEV_WORKFLOW = "host-waltraud.yaml";
const PRD_WORKFLOW = "deploy-prd.yml";

// ---------------------------------------------------------------------------
// CLI Argument Parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const mode = args[0]; // "dev" or "prd"

if (!["dev", "prd"].includes(mode)) {
  console.error("Usage: node deploy.mjs <dev|prd> [options]");
  process.exit(1);
}

const opts = {
  autoCleanup: args.includes("--auto-cleanup"),
  skipIssue: args.includes("--skip-issue"),
  issueId: null,
};

const issueIdx = args.indexOf("--issue-id");
if (issueIdx !== -1 && args[issueIdx + 1]) {
  opts.issueId = args[issueIdx + 1];
}

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

/** Run a command, return stdout. Throws on non-zero exit. */
function run(cmd, { silent = false, input } = {}) {
  try {
    const result = execSync(cmd, {
      encoding: "utf-8",
      stdio: silent ? ["pipe", "pipe", "pipe"] : ["pipe", "pipe", "pipe"],
      cwd: ROOT,
      input,
    });
    return result;
  } catch (err) {
    const stderr = err.stderr || "";
    const stdout = err.stdout || "";
    const output = (stderr + "\n" + stdout).trim();
    throw new Error(output || err.message);
  }
}

/** Run a command via execFileSync (no shell — safe for user-provided strings). */
function runFile(cmd, cmdArgs, { silent = false } = {}) {
  try {
    return execFileSync(cmd, cmdArgs, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      cwd: ROOT,
    });
  } catch (err) {
    const stderr = err.stderr || "";
    const stdout = err.stdout || "";
    const output = (stderr + "\n" + stdout).trim();
    throw new Error(output || err.message);
  }
}

/** Print a step header, execute fn, print result. Returns fn result. */
let totalSteps = 0;
let currentStep = 0;

async function step(label, fn) {
  currentStep++;
  const prefix = `[${currentStep}/${totalSteps}]`;
  process.stdout.write(`${prefix} ${label}...`);

  try {
    const result = await fn();
    console.log(" ✓");
    return result;
  } catch (err) {
    console.log(" ✗");
    console.error(`\n--- Error in: ${label} ---`);
    // Show last 30 lines of error output
    const lines = err.message.split("\n");
    const tail = lines.slice(-30).join("\n");
    console.error(tail);
    console.error("---\n");
    throw err;
  }
}

/** Fatal error — clean up and exit. */
function fatal(msg, rollbackFn) {
  console.error(`\n✗ FATAL: ${msg}`);
  if (rollbackFn) {
    try {
      rollbackFn();
    } catch {
      // ignore rollback errors
    }
  }
  cleanup();
  process.exit(1);
}

/** Remove temp files */
function cleanup() {
  try {
    if (existsSync(COPILOT_TMP)) unlinkSync(COPILOT_TMP);
  } catch {
    // ignore
  }
}

/** Prompt user for input (readline). */
function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ---------------------------------------------------------------------------
// Shared Steps
// ---------------------------------------------------------------------------

function checkPrereqs(extraChecks = []) {
  // npm
  run("npm --version", { silent: true });

  // git
  run("git --version", { silent: true });

  // git repo with origin
  const isRepo = run("git rev-parse --is-inside-work-tree", { silent: true }).trim();
  if (isRepo !== "true") throw new Error("Not inside a git repository");
  const remotes = run("git remote", { silent: true });
  if (!remotes.includes("origin")) throw new Error('No remote "origin" found');

  // gh CLI + auth
  run("gh auth status", { silent: true });

  // Extra checks (prd-specific)
  for (const check of extraChecks) check();
}

/** Check if copilot CLI is available. Returns boolean. */
function hasCopilot() {
  try {
    run("copilot --version", { silent: true });
    return true;
  } catch {
    return false;
  }
}

/** Run quality gates with auto-fix. Returns true if files were modified. */
function runQualityGates() {
  const statusBefore = run("git status --porcelain", { silent: true }).trim();

  // Format (auto-fix)
  run("npm run format", { silent: true });

  // Lint (auto-fix)
  run("npm run lint", { silent: true });

  // Prose (optional — may not be installed)
  try {
    run("npm run prose", { silent: true });
  } catch {
    // Vale not installed or prose errors — non-fatal for quality gate
  }

  const statusAfter = run("git status --porcelain", { silent: true }).trim();
  return statusBefore !== statusAfter;
}

/** Run build. */
function runBuild() {
  run("npm run build", { silent: true });
}

/** Ask Copilot CLI to generate commit message. Returns JSON or null. */
function askCopilot(promptText) {
  const result = spawnSync(
    "copilot",
    ["--model", "claude-haiku-4.5", "--no-ask-user", "--allow-all-tools", "--silent"],
    {
      input: promptText,
      encoding: "utf-8",
      cwd: ROOT,
      timeout: 120000,
    },
  );

  if (result.error || result.status !== 0) return null;

  const output = result.stdout || "";
  const jsonMatch = output.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

/** Generate a fallback commit message from diff stat. */
function fallbackCommitMessage() {
  const stat = run("git diff --cached --stat", { silent: true }).trim();
  const lines = stat.split("\n");
  const summary = lines[lines.length - 1] || "";
  // e.g. "5 files changed, 120 insertions(+), 30 deletions(-)"
  const fileCount = (summary.match(/(\d+) files? changed/) || [])[1] || "?";
  return `chore: update ${fileCount} files`;
}

/** Sleep helper (ms). */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check a GitHub Actions workflow run after push.
 * Polls for up to ~90s to find and monitor the triggered run.
 * Reports success/failure/error details.
 *
 * @param {string} repo - GitHub repo (owner/name format is handled via gh defaults)
 * @param {string} workflowFile - Workflow filename (e.g. "deploy-dev.yml")
 * @param {object} options
 * @param {string} [options.owner] - Repo owner (for cross-repo checks)
 * @param {string} [options.repoName] - Repo name (for cross-repo checks)
 */
async function checkDeployment(repo, workflowFile, { owner, repoName } = {}) {
  const repoFlag = owner && repoName ? `--repo ${owner}/${repoName}` : "";
  const maxWaitForStart = 30; // seconds to wait for run to appear
  const maxWaitForFinish = 120; // seconds to wait for run to complete
  const pushTime = Date.now();

  // Phase 1: Wait for the workflow run to appear
  let runData = null;
  for (let elapsed = 0; elapsed < maxWaitForStart; elapsed += 3) {
    await sleep(3000);
    try {
      const result = run(
        `gh run list ${repoFlag} --workflow=${workflowFile} --limit 1 --json databaseId,status,conclusion,url,createdAt`,
        { silent: true },
      );
      const runs = JSON.parse(result);
      if (runs.length > 0) {
        const created = new Date(runs[0].createdAt).getTime();
        // Only pick up runs created after our push (with 30s tolerance)
        if (created > pushTime - 30000) {
          runData = runs[0];
          break;
        }
      }
    } catch {
      // gh CLI error — retry
    }
  }

  if (!runData) {
    console.log(`  ⚠ No workflow run detected within ${maxWaitForStart}s.`);
    console.log(`  Check manually: https://github.com/${owner || GITHUB_REPO_OWNER}/${repoName || GITHUB_REPO_PAGES}/actions/workflows/${workflowFile}`);
    return;
  }

  console.log(`  Run: ${runData.url}`);

  // Phase 2: Poll until run completes or timeout
  for (let elapsed = 0; elapsed < maxWaitForFinish; elapsed += 5) {
    if (runData.status === "completed") break;

    await sleep(5000);
    try {
      const result = run(
        `gh run view ${runData.databaseId} ${repoFlag} --json status,conclusion,jobs`,
        { silent: true },
      );
      const updated = JSON.parse(result);
      runData.status = updated.status;
      runData.conclusion = updated.conclusion;

      if (updated.status === "completed") {
        // Check for failed jobs and extract error details
        if (updated.conclusion !== "success" && updated.jobs) {
          const failedJobs = updated.jobs.filter((j) => j.conclusion === "failure");
          if (failedJobs.length > 0) {
            runData.failedJobs = failedJobs.map((j) => j.name);
            // Try to get log snippet for the failed job
            try {
              const logResult = run(
                `gh run view ${runData.databaseId} ${repoFlag} --log-failed`,
                { silent: true },
              );
              // Take last 15 lines of the failed log
              const logLines = logResult.trim().split("\n");
              runData.errorLog = logLines.slice(-15).join("\n");
            } catch {
              // log fetch failed — non-critical
            }
          }
        }
        break;
      }
    } catch {
      // transient error — retry
    }
  }

  // Report result
  if (runData.status === "completed") {
    if (runData.conclusion === "success") {
      console.log(`  Status: ✓ success`);
    } else {
      console.log(`  Status: ✗ ${runData.conclusion}`);
      if (runData.failedJobs) {
        console.log(`  Failed jobs: ${runData.failedJobs.join(", ")}`);
      }
      if (runData.errorLog) {
        console.log(`  --- Error Log ---`);
        console.log(runData.errorLog);
        console.log(`  ---`);
      }
    }
  } else {
    console.log(`  Status: ${runData.status} (still running after ${maxWaitForFinish}s)`);
    console.log(`  Monitor: ${runData.url}`);
  }
}

// ---------------------------------------------------------------------------
// deploy:dev
// ---------------------------------------------------------------------------

async function deployDev() {
  totalSteps = 9; // prereqs, analyze, understand, quality, build, commit, push, merge/cleanup, deploy-check
  currentStep = 0;

  console.log("─── deploy:dev ───\n");

  // 1. Prereqs
  await step("Prerequisites", () => checkPrereqs());

  // 2. Analyze
  const analysis = await step("Analyze changes", () => {
    const status = run("git status --porcelain", { silent: true }).trim();
    const branch = run("git branch --show-current", { silent: true }).trim();

    // Allow empty status if we're on a feature branch that has unpushed commits
    if (!status) {
      // Check for unpushed commits
      try {
        const unpushed = run(`git log origin/${branch}..${branch} --oneline`, { silent: true }).trim();
        if (!unpushed) {
          throw new Error("No changes to deploy. Working tree is clean and all commits are pushed.");
        }
      } catch {
        // Remote tracking branch may not exist — that's fine, we have local commits
      }
    }

    const diff = run("git diff HEAD", { silent: true });
    return { status, diff, branch };
  });

  // 3. Understand (AI commit message)
  const commitInfo = await step("Generate commit message", () => {
    const copilotAvailable = hasCopilot();

    if (copilotAvailable) {
      const promptText = `Analyze the following git changes and respond with ONLY a JSON object. No explanation.

GIT STATUS:
${analysis.status}

GIT DIFF (truncated):
${analysis.diff.substring(0, 3000)}

Return JSON:
{"type":"feat|fix|docs|style|refactor|perf|test|ci|chore","commitMessage":"<type>: <short description>","branchName":"<type>/<kebab-case-description>"}`;

      const result = askCopilot(promptText);
      if (result && result.commitMessage) return result;
    }

    // Fallback: auto-generate from diff stat
    return { commitMessage: null, branchName: null, type: "chore" };
  });

  // 4. Quality Gates (auto-fix)
  const qualityChanged = await step("Quality gates (format, lint)", () => runQualityGates());

  // 5. Build
  await step("Build", () => runBuild());

  // 6. Commit
  const commitHash = await step("Commit", () => {
    // Stage all changes
    run("git add .", { silent: true });

    // Unstage temp files
    for (const f of [".copilot-prompt-analyze.txt", "scripts/workflows/ci/.state"]) {
      try {
        run(`git reset HEAD -- ${f}`, { silent: true });
      } catch {
        // not staged — fine
      }
    }

    // Check if there's anything to commit
    const staged = run("git diff --cached --name-only", { silent: true }).trim();
    if (!staged) {
      // Nothing to commit — maybe everything was already committed
      return run("git rev-parse --short HEAD", { silent: true }).trim();
    }

    // Determine commit message
    let msg = commitInfo.commitMessage || fallbackCommitMessage();

    // Commit using execFileSync to avoid shell escaping issues
    runFile("git", ["commit", "--no-verify", "-m", msg]);
    return run("git rev-parse --short HEAD", { silent: true }).trim();
  });

  // 7. Push
  await step("Push", () => {
    run(`git push -u origin ${analysis.branch}`, { silent: true });
  });

  // 8. Merge to dev + Cleanup (if on feature branch)
  if (analysis.branch !== "dev" && analysis.branch !== "main") {
    await step("Merge to dev & cleanup", () => {
      const mergeMsg = `merge: ${analysis.branch} into dev`;

      run("git checkout dev", { silent: true });
      run("git pull origin dev", { silent: true });
      runFile("git", ["merge", analysis.branch, "--no-ff", "--no-verify", "-m", mergeMsg]);
      run("git push origin dev", { silent: true });

      // Optional cleanup
      if (opts.autoCleanup) {
        try {
          run(`git push origin --delete ${analysis.branch}`, { silent: true });
        } catch {
          // remote branch may not exist
        }
        run(`git branch -D ${analysis.branch}`, { silent: true });
      }
    });
  } else {
    // Adjust step count since we skip merge
    totalSteps = 9;
  }

  // Deploy check (always runs — checks the deploy-dev.yml workflow on the pages repo)
  await step("Deploy check", async () => {
    await checkDeployment("pages", "deploy-dev.yml", {
      owner: GITHUB_REPO_OWNER,
      repoName: GITHUB_REPO_PAGES,
    });
  });

  // Summary
  const finalBranch = run("git branch --show-current", { silent: true }).trim();
  console.log(`\n─── Done ───`);
  console.log(`Branch:  ${finalBranch}`);
  console.log(`Commit:  ${commitHash}`);
}

// ---------------------------------------------------------------------------
// deploy:prd
// ---------------------------------------------------------------------------

async function deployPrd() {
  totalSteps = 11;
  currentStep = 0;

  console.log("─── deploy:prd ───\n");

  // 1. Prereqs (strict: must be on dev, clean, pushed)
  await step("Prerequisites", () =>
    checkPrereqs([
      () => {
        const branch = run("git branch --show-current", { silent: true }).trim();
        if (branch !== "dev") throw new Error(`Must be on 'dev' branch, currently on '${branch}'`);
      },
      () => {
        const status = run("git status --porcelain", { silent: true }).trim();
        if (status) throw new Error("Working tree is dirty. Commit or stash changes first.");
      },
      () => {
        run("git fetch origin dev", { silent: true });
        const local = run("git rev-parse dev", { silent: true }).trim();
        const remote = run("git rev-parse origin/dev", { silent: true }).trim();
        if (local !== remote) throw new Error("Local dev is not in sync with origin/dev. Push first.");
      },
    ]),
  );

  // 2. Issue check
  let issueId = opts.issueId ? parseInt(opts.issueId, 10) : null;

  await step("Issue check", () => {
    if (issueId) {
      // Validate existing issue
      const result = run(`gh issue view ${issueId} --json title,number`, { silent: true });
      const issue = JSON.parse(result);
      issueId = issue.number;
    }
    // If no issue and not skipping, ask interactively
    // (handled after this step for async prompt)
  });

  if (!issueId && !opts.skipIssue) {
    const answer = await prompt("GitHub Issue ID (Enter to skip): ");
    if (answer) {
      try {
        const result = run(`gh issue view ${answer} --json title,number`, { silent: true });
        issueId = JSON.parse(result).number;
      } catch {
        fatal(`Issue #${answer} not found.`);
      }
    }
  }

  // 3. Analyze changes
  const prdAnalysis = await step("Analyze changes (main..dev)", () => {
    run("git fetch origin", { silent: true });
    const diffStat = run("git diff origin/main..dev --stat", { silent: true });
    const log = run("git log origin/main..dev --oneline", { silent: true });
    const fullDiff = run("git diff origin/main..dev", { silent: true });
    return { diffStat, log, fullDiff };
  });

  // 4. AI understanding + Issue creation
  await step("Generate deployment summary", () => {
    const copilotAvailable = hasCopilot();
    let issueTitle = "deploy: production release";
    let issueBody = `Commits:\n${prdAnalysis.log}\n\nDiff:\n${prdAnalysis.diffStat}`;

    if (copilotAvailable) {
      const promptText = `Analyze these changes between main and dev. Respond with ONLY a JSON object.

COMMITS:
${prdAnalysis.log}

DIFF STAT:
${prdAnalysis.diffStat}

DIFF (truncated):
${prdAnalysis.fullDiff.substring(0, 5000)}

Return JSON:
{"issueTitle":"deploy: <short summary>","issueBody":"<markdown body listing key changes>"}`;

      const result = askCopilot(promptText);
      if (result) {
        issueTitle = result.issueTitle || issueTitle;
        issueBody = result.issueBody || issueBody;
      }
    }

    // Create issue if none exists
    if (!issueId) {
      const ghResult = runFile("gh", ["issue", "create", "--title", issueTitle, "--body", issueBody]);
      const match = ghResult.match(/\/issues\/(\d+)/);
      if (match) {
        issueId = parseInt(match[1], 10);
      }
    }
  });

  // 5. Merge dev → main
  let mergedToMain = false;

  await step("Merge dev → main", () => {
    run("git checkout main", { silent: true });
    run("git pull origin main", { silent: true });

    try {
      runFile("git", ["merge", "dev", "--no-ff", "--no-verify", "-m", "chore: deploy dev to production"]);
      mergedToMain = true;
    } catch (err) {
      // Rollback merge attempt
      try {
        run("git merge --abort", { silent: true });
      } catch {
        // no merge to abort
      }
      run("git checkout dev", { silent: true });
      throw new Error(`Merge failed. Rolled back to dev.\n${err.message}`);
    }
  });

  // From here on, errors require rollback of main
  const rollbackMain = () => {
    try {
      run("git reset --hard origin/main", { silent: true });
      run("git checkout dev", { silent: true });
      console.log("  ↩ Rolled back main to origin/main, switched to dev.");
    } catch {
      console.error("  ⚠ Manual rollback needed: git checkout main && git reset --hard origin/main && git checkout dev");
    }
  };

  try {
    // 6. Quality Gates (on main)
    await step("Quality gates (format, lint)", () => {
      const changed = runQualityGates();
      if (changed) {
        // Quality gates changed files on main — commit them
        run("git add .", { silent: true });
        runFile("git", ["commit", "--no-verify", "-m", "style: auto-fix formatting"]);
      }
    });

    // 7. Build
    await step("Build", () => runBuild());

    // 8. Push main
    await step("Push main", () => {
      run("git push origin main", { silent: true });
    });

    // 9. Deploy check
    await step("Deploy check", async () => {
      await checkDeployment("pages", PRD_WORKFLOW, {
        owner: GITHUB_REPO_OWNER,
        repoName: GITHUB_REPO_PAGES,
      });
    });

    // 10. Close issue
    await step("Close issue", () => {
      if (issueId) {
        try {
          runFile("gh", ["issue", "close", String(issueId), "--comment", "Deployed via deploy:prd"]);
        } catch {
          // non-fatal
        }
      }
    });

    // 11. Return to dev
    await step("Switch to dev", () => {
      run("git checkout dev", { silent: true });
    });
  } catch (err) {
    if (mergedToMain) {
      // Check if we already pushed
      try {
        const localMain = run("git rev-parse main", { silent: true }).trim();
        const remoteMain = run("git rev-parse origin/main", { silent: true }).trim();
        if (localMain !== remoteMain) {
          // Not pushed yet — safe to rollback
          rollbackMain();
        } else {
          console.error("  ⚠ Main was already pushed. Manual intervention may be needed.");
          run("git checkout dev", { silent: true });
        }
      } catch {
        rollbackMain();
      }
    }
    fatal(err.message);
  }

  // Summary
  console.log(`\n─── Done ───`);
  console.log(`Branch:  dev`);
  if (issueId) console.log(`Issue:   #${issueId}`);
  console.log(`Deploy:  https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_PAGES}/actions/workflows/${PRD_WORKFLOW}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  try {
    if (mode === "dev") {
      await deployDev();
    } else {
      await deployPrd();
    }
    cleanup();
  } catch (err) {
    cleanup();
    if (err.message !== "FATAL") {
      fatal(err.message);
    }
    process.exit(1);
  }
}

main();
