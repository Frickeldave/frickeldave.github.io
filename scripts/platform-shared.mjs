/**
 * Small cross-platform helpers shared by the dev/flow scripts.
 *
 * On Windows `npm`, `npx` and often `copilot` are `.cmd` shims. Since Node
 * 20.12 (CVE-2024-27980) spawning a `.cmd`/`.bat` file requires `shell: true`,
 * and then every argument has to be quoted for cmd.exe by the caller.
 */
import { existsSync } from 'node:fs';
import { win32 } from 'node:path';

// These helpers only model Windows launch semantics, so path handling must not depend on the host OS.
const { delimiter, extname, join } = win32;

const DIRECT_EXTENSIONS = ['.exe', '.com'];
const SHELL_EXTENSIONS = ['.cmd', '.bat'];

/** @param {NodeJS.Platform} [platform] */
export function isWindows(platform = process.platform) {
  return platform === 'win32';
}

/**
 * Quotes one argument for cmd.exe when a command is spawned with `shell: true`.
 * Line breaks are flattened to spaces because cmd.exe ends a command at a
 * newline. `%` cannot be escaped on a cmd.exe command line, so `%NAME%` that
 * names a defined environment variable would still be expanded. Arguments
 * without special characters are passed through unchanged.
 *
 * @param {string} value
 */
export function quoteCmdArg(value) {
  const flat = String(value).replace(/\s*\r?\n\s*/gu, ' ');
  if (flat !== '' && !/[\s"&|<>^%()!,;=]/u.test(flat)) {
    return flat;
  }

  // Trailing backslashes would otherwise escape the closing quote.
  const escaped = flat.replaceAll('"', '""').replace(/(\\+)$/u, '$1$1');
  return `"${escaped}"`;
}

/**
 * Finds out how a command has to be launched on Windows. Real executables
 * (`.exe`/`.com`) are spawned directly; `.cmd`/`.bat` shims need a shell.
 *
 * @param {string} command
 * @param {{ env?: NodeJS.ProcessEnv; existsFn?: (path: string) => boolean }} [options]
 * @returns {'direct' | 'shell' | 'unknown'}
 */
export function resolveWindowsLaunchKind(command, options = {}) {
  const env = options.env ?? process.env;
  const existsFn = options.existsFn ?? existsSync;
  const explicitExtension = extname(command).toLowerCase();

  if (DIRECT_EXTENSIONS.includes(explicitExtension)) {
    return 'direct';
  }
  if (SHELL_EXTENSIONS.includes(explicitExtension)) {
    return 'shell';
  }

  const hasPath = /[\\/]/u.test(command);
  const directories = hasPath
    ? ['']
    : (env.PATH ?? env.Path ?? '').split(delimiter).filter((entry) => entry !== '');

  for (const directory of directories) {
    const base = directory === '' ? command : join(directory, command);
    // Same precedence CreateProcess applies: a real executable wins over a shim.
    for (const extension of [...DIRECT_EXTENSIONS, ...SHELL_EXTENSIONS]) {
      if (existsFn(`${base}${extension}`)) {
        return DIRECT_EXTENSIONS.includes(extension) ? 'direct' : 'shell';
      }
    }
  }

  return 'unknown';
}

/**
 * Full path of a real `.exe` for a bare command name anywhere on the PATH, or null.
 *
 * @param {string} command
 * @param {{ env?: NodeJS.ProcessEnv; existsFn?: (path: string) => boolean }} options
 */
function findExecutableOnPath(command, options) {
  if (extname(command) !== '' || /[\\/]/u.test(command)) {
    return null;
  }
  const env = options.env ?? process.env;
  const existsFn = options.existsFn ?? existsSync;
  const directories = (env.PATH ?? env.Path ?? '').split(delimiter).filter((entry) => entry !== '');
  for (const directory of directories) {
    const candidate = join(directory, `${command}.exe`);
    if (existsFn(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Returns the command, arguments and spawn options needed to launch `command`
 * on the current platform. On POSIX and for real executables nothing changes.
 *
 * @param {string} command
 * @param {string[]} args
 * @param {{ platform?: NodeJS.Platform; env?: NodeJS.ProcessEnv; existsFn?: (path: string) => boolean }} [options]
 * @returns {{ command: string; args: string[]; options: { shell?: true; windowsHide?: true } }}
 */
export function prepareSpawn(command, args, options = {}) {
  const platform = options.platform ?? process.platform;
  if (!isWindows(platform) || resolveWindowsLaunchKind(command, options) !== 'shell') {
    return { command, args, options: {} };
  }

  // A shim earlier on the PATH (e.g. VS Code's copilot.bat) may start powershell with the user profile.
  const executable = findExecutableOnPath(command, options);
  if (executable !== null) {
    return { command: executable, args, options: {} };
  }

  // One pre-quoted command line: with `shell: true` Node only concatenates args anyway
  // (and warns, DEP0190), so we do the quoting ourselves and pass no args.
  const quotedCommand = /\s/u.test(command) ? `"${command}"` : command;
  return {
    command: [quotedCommand, ...args.map((arg) => quoteCmdArg(arg))].join(' '),
    args: [],
    options: { shell: true, windowsHide: true },
  };
}
