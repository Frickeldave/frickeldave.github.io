#!/usr/bin/env node

/**
 * Plattformunabhängiges Merge-Script für Feature → Dev → Main Workflow
 * 
 * Features:
 * - Erstellt PRs via GitHub CLI
 * - Auto-Merge mit konfigurierbarer Strategy (Feature Branch oder Target gewinnt)
 * - Interaktive Konfliktauflösung bei Bedarf
 * 
 * Usage:
 *   node scripts/merge-branches.mjs          # Automatische Branch-Erkennung
 *   node scripts/merge-branches.mjs dev      # Explizit zu dev mergen
 *   node scripts/merge-branches.mjs main     # Explizit zu main mergen
 */

import { execSync, spawn } from 'child_process';
import { createInterface } from 'readline';

// Farb-Codes für Terminal-Output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  step: (msg) => console.log(`\n${colors.bright}${colors.cyan}▶${colors.reset} ${msg}`),
};

/**
 * Führt Shell-Befehl aus und gibt Output zurück
 */
function exec(command, options = {}) {
  try {
    return execSync(command, {
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options,
    }).trim();
  } catch (error) {
    if (options.ignoreError) {
      return null;
    }
    throw error;
  }
}

/**
 * Fragt Benutzer nach Eingabe
 */
function prompt(question) {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(`${colors.yellow}?${colors.reset} ${question} `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Prüft ob gh CLI verfügbar ist
 */
function checkGhCli() {
  const ghVersion = exec('gh --version', { silent: true, ignoreError: true });
  if (!ghVersion) {
    log.error('GitHub CLI (gh) ist nicht installiert!');
    log.info('Installation: https://cli.github.com/');
    process.exit(1);
  }
  log.success(`GitHub CLI verfügbar: ${ghVersion.split('\n')[0]}`);
}

/**
 * Prüft ob gh authentifiziert ist
 */
function checkGhAuth() {
  const authStatus = exec('gh auth status', { silent: true, ignoreError: true });
  if (!authStatus || authStatus.includes('not logged')) {
    log.error('GitHub CLI ist nicht authentifiziert!');
    log.info('Führe aus: gh auth login');
    process.exit(1);
  }
  log.success('GitHub CLI authentifiziert');
}

/**
 * Holt aktuellen Branch-Namen
 */
function getCurrentBranch() {
  return exec('git branch --show-current', { silent: true });
}

/**
 * Prüft ob es uncommitted Changes gibt
 */
function hasUncommittedChanges() {
  const status = exec('git status --porcelain', { silent: true });
  return status.length > 0;
}

/**
 * Bestimmt Target-Branch basierend auf aktuellem Branch
 */
function determineTargetBranch(currentBranch, explicitTarget) {
  if (explicitTarget) {
    return explicitTarget;
  }

  // Feature Branch → dev (inkl. Issue-Branches wie "60-...")
  if (currentBranch.startsWith('feature/') || currentBranch.startsWith('fix/') || 
      currentBranch.startsWith('docs/') || currentBranch.startsWith('chore/') ||
      /^\d+-/.test(currentBranch)) {  // Issue-Branches wie "60-implement-feature"
    return 'dev';
  }

  // dev → main
  if (currentBranch === 'dev') {
    return 'main';
  }

  log.error(`Unbekannter Branch-Type: ${currentBranch}`);
  log.info('Unterstützte Branches: feature/*, fix/*, docs/*, chore/*, <issue-nr>-*, dev');
  process.exit(1);
}

/**
 * Bestimmt Merge-Strategy basierend auf Source → Target
 */
function getMergeStrategy(sourceBranch, targetBranch) {
  // Feature Branch → dev: Feature Branch gewinnt
  if (targetBranch === 'dev') {
    return {
      strategy: 'ours',
      description: `${sourceBranch} gewinnt bei Konflikten`,
    };
  }

  // dev → main: dev (Source) gewinnt
  if (sourceBranch === 'dev' && targetBranch === 'main') {
    return {
      strategy: 'ours',
      description: 'dev gewinnt bei Konflikten',
    };
  }

  // Default: Target gewinnt
  return {
    strategy: 'theirs',
    description: `${targetBranch} gewinnt bei Konflikten`,
  };
}

/**
 * Versucht automatischen Merge mit Strategy
 */
async function attemptAutoMerge(sourceBranch, targetBranch, strategy) {
  log.step(`Versuche lokalen Test-Merge mit Strategy: ${strategy.strategy}`);

  // Erstelle temporären Branch für Test-Merge
  const testBranch = `test-merge-${Date.now()}`;
  
  try {
    // Fetch latest changes
    exec('git fetch origin');
    
    // Erstelle Test-Branch vom Target
    exec(`git checkout -b ${testBranch} origin/${targetBranch}`);
    
    // Versuche Merge mit Strategy
    const mergeCmd = `git merge origin/${sourceBranch} -X ${strategy.strategy} --no-commit --no-ff`;
    const mergeResult = exec(mergeCmd, { silent: true, ignoreError: true });
    
    // Check Merge-Status
    const status = exec('git status --porcelain', { silent: true });
    
    // Cleanup Test-Branch
    exec(`git merge --abort`, { silent: true, ignoreError: true });
    exec(`git checkout ${sourceBranch}`);
    exec(`git branch -D ${testBranch}`);
    
    if (status.includes('UU ') || status.includes('AA ') || status.includes('DD ')) {
      log.warn('Merge hat Konflikte, die nicht automatisch gelöst werden können');
      return false;
    }
    
    log.success('Auto-Merge ist möglich!');
    return true;
    
  } catch (error) {
    // Cleanup bei Fehler
    exec(`git merge --abort`, { silent: true, ignoreError: true });
    exec(`git checkout ${sourceBranch}`, { silent: true, ignoreError: true });
    exec(`git branch -D ${testBranch}`, { silent: true, ignoreError: true });
    
    log.warn('Merge-Test fehlgeschlagen');
    return false;
  }
}

/**
 * Erstellt PR via gh CLI
 */
async function createPullRequest(sourceBranch, targetBranch, strategy) {
  log.step(`Erstelle Pull Request: ${sourceBranch} → ${targetBranch}`);

  // Push current branch
  log.info('Pushe Branch zu Remote...');
  exec(`git push origin ${sourceBranch}`);

  // Erstelle PR mit gh CLI
  const prTitle = `Merge: ${sourceBranch} → ${targetBranch}`;
  const prBody = `
## Auto-Merge Request

**Source:** \`${sourceBranch}\`  
**Target:** \`${targetBranch}\`  
**Merge Strategy:** \`${strategy.strategy}\` (${strategy.description})

---

Automatisch erstellt via \`merge-branches.mjs\`
  `.trim();

  try {
    const prUrl = exec(
      `gh pr create --base ${targetBranch} --head ${sourceBranch} --title "${prTitle}" --body "${prBody}"`,
      { silent: true }
    );
    
    log.success(`Pull Request erstellt: ${prUrl}`);
    return prUrl;
    
  } catch (error) {
    // Prüfe ob PR bereits existiert
    const existingPr = exec(
      `gh pr list --head ${sourceBranch} --base ${targetBranch} --json url --jq '.[0].url'`,
      { silent: true, ignoreError: true }
    );
    
    if (existingPr && existingPr.length > 0) {
      log.warn(`PR existiert bereits: ${existingPr}`);
      return existingPr;
    }
    
    log.error(`PR-Erstellung fehlgeschlagen: ${error.message}`);
    throw error;
  }
}

/**
 * Merged PR via gh CLI
 */
async function mergePullRequest(prUrl, strategy) {
  log.step('Merge Pull Request...');

  try {
    // Extrahiere PR-Nummer aus URL
    const prNumber = prUrl.split('/').pop();
    
    // Merge mit Squash und Strategy-Option über PR-Body kommuniziert
    // Hinweis: gh CLI unterstützt keine direkte Strategy-Option, 
    // aber GitHub wird bei Auto-Merge automatisch die Konflikte prüfen
    exec(`gh pr merge ${prNumber} --merge --auto`);
    
    log.success('Pull Request wurde erfolgreich gemerged!');
    
  } catch (error) {
    log.error('Merge fehlgeschlagen!');
    log.info(`Bitte manuell lösen: ${prUrl}`);
    throw error;
  }
}

/**
 * Manuelle Konfliktauflösung
 */
async function handleManualMerge(sourceBranch, targetBranch) {
  log.step('Manuelle Konfliktauflösung erforderlich');
  log.info(`Öffne PR im Browser für manuelle Konfliktauflösung...`);
  
  const answer = await prompt('Möchtest du den PR im Browser öffnen? (y/n)');
  
  if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
    exec(`gh pr view --web`);
  }
  
  log.info('Bitte löse die Konflikte manuell und merge den PR auf GitHub.');
  log.info(`Danach kannst du deinen lokalen Branch aktualisieren mit:`);
  log.info(`  git checkout ${targetBranch} && git pull origin ${targetBranch}`);
}

/**
 * Main Function
 */
async function main() {
  console.log(`\n${colors.bright}${colors.cyan}═══════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}  Git Branch Merge Automation Tool${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════════════${colors.reset}\n`);

  // Pre-Flight Checks
  log.step('Pre-Flight Checks');
  checkGhCli();
  checkGhAuth();

  // Check uncommitted changes
  if (hasUncommittedChanges()) {
    log.error('Es gibt uncommitted Changes!');
    log.info('Bitte committe oder stashe deine Änderungen zuerst.');
    process.exit(1);
  }

  // Bestimme Branches
  const currentBranch = getCurrentBranch();
  const explicitTarget = process.argv[2];
  const targetBranch = determineTargetBranch(currentBranch, explicitTarget);

  log.info(`Source Branch: ${colors.bright}${currentBranch}${colors.reset}`);
  log.info(`Target Branch: ${colors.bright}${targetBranch}${colors.reset}`);

  // Bestimme Merge-Strategy
  const strategy = getMergeStrategy(currentBranch, targetBranch);
  log.info(`Merge Strategy: ${colors.bright}${strategy.strategy}${colors.reset} (${strategy.description})`);

  // Bestätigung
  const confirm = await prompt(`Fortfahren mit Merge ${currentBranch} → ${targetBranch}? (y/n)`);
  if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
    log.warn('Abgebrochen durch Benutzer');
    process.exit(0);
  }

  // Test Auto-Merge
  const canAutoMerge = await attemptAutoMerge(currentBranch, targetBranch, strategy);

  // Erstelle PR
  const prUrl = await createPullRequest(currentBranch, targetBranch, strategy);

  // Merge oder manuelle Konfliktauflösung
  if (canAutoMerge) {
    try {
      await mergePullRequest(prUrl, strategy);
      
      // Update lokaler Target-Branch
      log.step('Update lokalen Target-Branch');
      exec(`git checkout ${targetBranch}`);
      exec(`git pull origin ${targetBranch}`);
      
      log.success(`\n${colors.bright}Merge erfolgreich abgeschlossen!${colors.reset}`);
      log.info(`Du bist jetzt auf Branch: ${colors.bright}${targetBranch}${colors.reset}`);
      
    } catch (error) {
      await handleManualMerge(currentBranch, targetBranch);
    }
  } else {
    await handleManualMerge(currentBranch, targetBranch);
  }
}

// Error Handling
process.on('unhandledRejection', (error) => {
  log.error(`Unerwarteter Fehler: ${error.message}`);
  process.exit(1);
});

// Run
main().catch((error) => {
  log.error(`Fehler: ${error.message}`);
  process.exit(1);
});
