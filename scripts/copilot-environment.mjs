/**
 * Copilot CLI environment checks shared by the start flow scripts.
 *
 * `node scripts/copilot-environment.mjs auth|terminal|status` can be run on its
 * own; `status` reports on FLOW_REPO_ROOT (default: the current directory).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { prepareSpawn } from './platform-shared.mjs';

export const COPY_HINT =
  'Kopieren (VS Code/tmux): markieren → Rechtsklick; falls die TUI die Maus abfängt: Alt+Ziehen, dann Strg+Umschalt+C (macOS: Option+Ziehen mit macOptionClickForcesSelection, dann ⌘C).';

// Preserve offsets so callers can insert into JSONC without rewriting existing settings.
export function parseJsonc(text) {
  let clean = '';
  let quoted = false;
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      clean += ch;
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') quoted = false;
    } else if (ch === '"') {
      quoted = true;
      clean += ch;
    } else if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') {
        clean += ' ';
        i += 1;
      }
      if (i < text.length) clean += '\n';
    } else if (ch === '/' && text[i + 1] === '*') {
      clean += '  ';
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
        clean += text[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      if (i >= text.length) throw new Error('Unterminated JSON comment');
      clean += '  ';
      i += 1;
    } else {
      clean += ch === '\uFEFF' ? ' ' : ch;
    }
  }
  quoted = false;
  escaped = false;
  const chars = clean.split('');
  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') quoted = false;
    } else if (ch === '"') quoted = true;
    else if (ch === ',' && /^\s*[\]}]/.test(clean.slice(i + 1))) chars[i] = ' ';
  }
  return { value: JSON.parse(chars.join('')), clean };
}

function command(commandName, args, options = {}) {
  const launch = prepareSpawn(commandName, args, { env: options.env || process.env });
  return spawnSync(launch.command, launch.args, {
    encoding: 'utf8',
    timeout: 5000,
    maxBuffer: 1024 * 1024,
    windowsHide: true,
    ...options,
    ...launch.options,
  });
}

function fileStatus(path) {
  try {
    return statSync(path).isFile() ? 'yes' : 'no';
  } catch (error) {
    return ['ENOENT', 'ENOTDIR'].includes(error.code) ? 'no' : 'error';
  }
}

export function copilotStatus({
  env = process.env,
  homeDirectory = homedir(),
  spawnFn = command,
} = {}) {
  const version = spawnFn('copilot', ['--version'], { env });
  if (version.error?.code === 'ENOENT') return 'unavailable';
  if (version.error || version.status !== 0) return 'error';
  if (!/^(?:GitHub Copilot CLI\s+)?\d+\.\d+\.\d+(?:[.\w+-]*)[.\s]*$/m.test(version.stdout ?? '')) {
    return 'unsupported';
  }
  if (['COPILOT_GITHUB_TOKEN', 'GH_TOKEN', 'GITHUB_TOKEN'].some((key) => Boolean(env[key]))) {
    return 'yes';
  }
  const path = join(env.COPILOT_HOME || join(homeDirectory, '.copilot'), 'config.json');
  let config;
  try {
    config = parseJsonc(readFileSync(path, 'utf8')).value;
  } catch (error) {
    return error.code === 'ENOENT' ? 'no' : 'error';
  }
  if (!config || typeof config !== 'object' || Array.isArray(config)) return 'unsupported';
  const current =
    Object.hasOwn(config, 'lastLoggedInUser') || Object.hasOwn(config, 'loggedInUsers');
  const active = config[current ? 'lastLoggedInUser' : 'last_logged_in_user'];
  const users = config[current ? 'loggedInUsers' : 'logged_in_users'];
  const account = (user) =>
    user &&
    typeof user.host === 'string' &&
    Boolean(user.host.trim()) &&
    typeof user.login === 'string' &&
    Boolean(user.login.trim());
  if (users != null && (!Array.isArray(users) || !users.every(account))) return 'error';
  if (active == null) return 'no';
  if (!account(active)) return 'error';
  if (users && !users.some((user) => user.host === active.host && user.login === active.login)) {
    return 'no';
  }
  return 'yes';
}

const TOOL_COMMANDS = ['node', 'npm', 'gh', 'git', 'copilot'];

function toolStatus(spawnFn, commandName, env) {
  const result = spawnFn(commandName, ['--version'], { env });
  if (result?.error?.code === 'ENOENT') return 'no';
  if (result?.error || result?.status !== 0) return 'error';
  return 'yes';
}

/**
 * Resolves the repository this flow runs in. The start scripts also run inside
 * worktrees, so the main checkout is derived from the shared git directory.
 *
 * @param {string} repoPath
 * @param {{ spawnFn?: typeof command }} [options]
 */
export function resolveRepositoryRoots(repoPath, { spawnFn = command } = {}) {
  const checkoutPath = resolve(repoPath);
  const toplevel = spawnFn('git', ['-C', checkoutPath, 'rev-parse', '--show-toplevel']);
  const repoRoot =
    toplevel.status === 0 && toplevel.stdout?.trim()
      ? resolve(toplevel.stdout.trim())
      : checkoutPath;
  const common = spawnFn('git', [
    '-C',
    repoRoot,
    'rev-parse',
    '--path-format=absolute',
    '--git-common-dir',
  ]);
  const mainRoot =
    common.status === 0 && common.stdout?.trim()
      ? dirname(resolve(common.stdout.trim()))
      : repoRoot;
  const workTree = spawnFn('git', ['-C', repoRoot, 'rev-parse', '--is-inside-work-tree']);
  const gitWorkTree =
    workTree.status === 0 ? (workTree.stdout?.trim() === 'true' ? 'yes' : 'no') : 'error';
  return { checkoutPath, repoRoot, mainRoot, gitWorkTree };
}

export function readiness(repoPath, { env = process.env, spawnFn = command, notmux = false } = {}) {
  const { checkoutPath, repoRoot, mainRoot, gitWorkTree } = resolveRepositoryRoots(repoPath, {
    spawnFn,
  });
  const tools = Object.fromEntries(
    TOOL_COMMANDS.map((name) => [name, toolStatus(spawnFn, name, env)])
  );
  const tmux = notmux ? null : spawnFn('tmux', ['-V']);
  const envStatus = fileStatus(join(checkoutPath, '.env.local'));
  const mainEnvStatus = mainRoot !== checkoutPath ? fileStatus(join(mainRoot, '.env.local')) : null;
  return {
    checkoutPath,
    repoRoot,
    mainRoot,
    gitWorkTree,
    tools,
    envPath: join(checkoutPath, '.env.local'),
    envExists: envStatus === 'yes',
    envStatus,
    mainEnvPath: mainRoot !== checkoutPath ? join(mainRoot, '.env.local') : null,
    mainEnvExists: mainEnvStatus === 'yes',
    mainEnvStatus,
    tmux: notmux
      ? 'skipped (tmux not used)'
      : tmux.error?.code === 'ENOENT'
        ? 'no'
        : tmux.error || tmux.status !== 0
          ? 'error'
          : 'yes',
    copilot: copilotStatus({ env, spawnFn }),
  };
}

export function reportReadiness(repoPath, options = {}) {
  const state = readiness(repoPath, options);
  console.log(`  Repository root     : ${state.repoRoot}`);
  if (state.mainRoot !== state.checkoutPath) {
    console.log(`  Main checkout       : ${state.mainRoot} (checkout: ${state.checkoutPath})`);
  }
  console.log(`  Git work tree       : ${state.gitWorkTree}`);
  console.log(
    `  Toolchain           : ${TOOL_COMMANDS.map((name) => `${name}=${state.tools[name]}`).join(' ')}`
  );
  console.log(`  .env.local exists   : ${state.envStatus} (${state.envPath}; existence only)`);
  if (state.mainEnvPath) {
    console.log(
      `  Main .env.local     : ${state.mainEnvStatus} (${state.mainEnvPath}; existence only)`
    );
  }
  console.log(`  tmux installed      : ${state.tmux}`);
  if (state.tmux === 'no') {
    console.log(
      '  tmux is optional: without it the flow launches Copilot in the foreground (--notmux).'
    );
  }
  console.log(`  Copilot CLI logged in: ${state.copilot}`);
  console.log(
    '  Copilot auth is offline: yes = local account/token configured; validity/subscription not checked.'
  );
  return state;
}

/**
 * Equivalent to Copilot 1.0.98 /terminal-setup's VS Code binding.
 * Remote-SSH cannot change the local VS Code client's keybindings.
 */
export function configureMultiline({
  env = process.env,
  homeDirectory = homedir(),
  platformName = platform(),
  forceVscode = false,
} = {}) {
  if (!forceVscode && env.TERM_PROGRAM !== 'vscode') return 'skipped (not VS Code)';
  const app = env.VSCODE_INJECTION?.includes('insiders') ? 'Code - Insiders' : 'Code';
  const base =
    platformName === 'darwin'
      ? join(homeDirectory, 'Library', 'Application Support')
      : platformName === 'win32'
        ? env.APPDATA
        : join(homeDirectory, '.config');
  if (!base) return 'error (APPDATA missing)';
  const path = join(base, app, 'User', 'keybindings.json');
  try {
    const text = existsSync(path) ? readFileSync(path, 'utf8') : '[]\n';
    const { value, clean } = parseJsonc(text);
    if (!Array.isArray(value)) return 'error (keybindings must be an array; unchanged)';
    const binding = {
      key: 'shift+enter',
      command: 'workbench.action.terminal.sendSequence',
      when: 'terminalFocus',
      args: { text: '\u001b\r' },
    };
    const existing = value.filter((entry) => entry.key === binding.key);
    if (
      existing.some(
        (entry) =>
          entry.command !== binding.command ||
          entry.args?.text !== binding.args.text ||
          entry.when !== binding.when
      )
    ) {
      return 'conflict (existing Shift+Enter binding unchanged; use /terminal-setup)';
    }
    if (existing.length === 0) {
      const start = clean.indexOf('[') + 1;
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(
        path,
        `${text.slice(0, start)}\n  ${JSON.stringify(binding)}${value.length ? ',' : ''}${text.slice(start)}`
      );
    }
    const remote =
      forceVscode ||
      env.SSH_CONNECTION ||
      env.SSH_TTY ||
      env.VSCODE_IPC_HOOK_CLI?.includes('.vscode-server');
    return remote
      ? 'yes (CLI-side binding ready; Remote-SSH also needs this binding in the LOCAL VS Code client)'
      : 'yes (Shift+Enter configured)';
  } catch {
    return 'error (keybindings unreadable/invalid; unchanged)';
  }
}

export function prepareCopilotEnvironment(
  repoPath,
  { tmuxAvailable = false, sessionName, env = process.env, spawnFn = command, ...options } = {}
) {
  reportReadiness(repoPath, { env, spawnFn, notmux: !tmuxAvailable });
  console.log(`  Copilot multiline   : ${configureMultiline({ env, ...options })}`);
  configureCopilotMouse({ env, spawnFn });
  if (tmuxAvailable && env.TMUX && sessionName) {
    const result = spawnFn('tmux', ['set-option', '-t', sessionName, 'mouse', 'off']);
    if (result.error || result.status !== 0) console.warn('Could not disable tmux mouse capture.');
  }
  console.log(COPY_HINT);
}

export function configureCopilotMouse({ env = process.env, spawnFn = command } = {}) {
  // mouse=off alone does not stop a TUI from enabling mouse reporting.
  const help = spawnFn('copilot', ['--help'], { env });
  if (help.status === 0 && help.stdout?.includes('--no-mouse')) {
    const result = spawnFn('copilot', ['config', 'mouse', 'false'], { env });
    if (result.error || result.status !== 0) {
      console.warn(
        'Could not disable Copilot mouse capture; restart Copilot with --no-mouse (or use the copy hint below).'
      );
    }
  } else {
    console.warn(
      'Copilot mouse configuration unsupported/unavailable; upgrade the CLI or use the copy hint below.'
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const action = process.argv[2];
  if (action === 'auth') console.log(copilotStatus());
  else if (action === 'terminal') {
    console.log(`  Copilot multiline   : ${configureMultiline({ forceVscode: true })}`);
    configureCopilotMouse();
    console.log(COPY_HINT);
  } else if (action === 'status') {
    // FLOW_REPO_ROOT lets you report on another checkout; defaults to the current directory.
    reportReadiness(process.env.FLOW_REPO_ROOT || process.cwd());
  } else {
    console.error('Usage: copilot-environment.mjs auth|terminal|status');
    process.exitCode = 2;
  }
}
