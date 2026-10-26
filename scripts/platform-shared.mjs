/**
 * Kleine plattformübergreifende Helfer, die sich die Dev-/Flow-Skripte teilen.
 *
 * Unter Windows sind `npm`, `npx` und oft `copilot` `.cmd`-Shims. Seit Node
 * 20.12 (CVE-2024-27980) verlangt das Starten einer `.cmd`/`.bat`-Datei `shell: true`,
 * und dann muss der Aufrufer jedes Argument für cmd.exe quoten.
 */
import { existsSync } from 'node:fs';
import { win32 } from 'node:path';

// Diese Helfer bilden nur die Windows-Start-Semantik ab, deshalb darf die Pfadbehandlung nicht vom Host-OS abhängen.
const { delimiter, extname, join } = win32;

const DIRECT_EXTENSIONS = ['.exe', '.com'];
const SHELL_EXTENSIONS = ['.cmd', '.bat'];

/** @param {NodeJS.Platform} [platform] */
export function isWindows(platform = process.platform) {
  return platform === 'win32';
}

/**
 * Quotet ein Argument für cmd.exe, wenn ein Kommando mit `shell: true` gestartet wird.
 * Zeilenumbrüche werden zu Leerzeichen, weil cmd.exe ein Kommando am Zeilenende
 * beendet. `%` lässt sich auf einer cmd.exe-Kommandozeile nicht escapen, deshalb
 * würde `%NAME%` für eine definierte Umgebungsvariable weiterhin expandiert.
 * Argumente ohne Sonderzeichen werden unverändert durchgereicht.
 *
 * @param {string} value
 */
export function quoteCmdArg(value) {
  const flat = String(value).replace(/\s*\r?\n\s*/gu, ' ');
  if (flat !== '' && !/[\s"&|<>^%()!,;=]/u.test(flat)) {
    return flat;
  }

  // Nachgestellte Backslashes würden sonst das schließende Anführungszeichen escapen.
  const escaped = flat.replaceAll('"', '""').replace(/(\\+)$/u, '$1$1');
  return `"${escaped}"`;
}

/**
 * Findet heraus, wie ein Kommando unter Windows gestartet werden muss. Echte
 * Executables (`.exe`/`.com`) werden direkt gestartet; `.cmd`/`.bat`-Shims brauchen eine Shell.
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
    // Dieselbe Priorität, die CreateProcess anwendet: ein echtes Executable gewinnt gegen einen Shim.
    for (const extension of [...DIRECT_EXTENSIONS, ...SHELL_EXTENSIONS]) {
      if (existsFn(`${base}${extension}`)) {
        return DIRECT_EXTENSIONS.includes(extension) ? 'direct' : 'shell';
      }
    }
  }

  return 'unknown';
}

/**
 * Vollständiger Pfad eines echten `.exe` für einen bloßen Kommandonamen irgendwo im PATH, sonst null.
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
 * Liefert Kommando, Argumente und Spawn-Optionen, die zum Start von `command` auf
 * der aktuellen Plattform nötig sind. Auf POSIX und für echte Executables ändert sich nichts.
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

  // Ein Shim weiter vorne im PATH (z. B. VS Codes copilot.bat) startet powershell evtl. mit dem Benutzerprofil.
  const executable = findExecutableOnPath(command, options);
  if (executable !== null) {
    return { command: executable, args, options: {} };
  }

  // Eine vorab gequotete Kommandozeile: mit `shell: true` verkettet Node die Argumente
  // ohnehin nur (und warnt, DEP0190), deshalb quoten wir selbst und übergeben keine Argumente.
  const quotedCommand = /\s/u.test(command) ? `"${command}"` : command;
  return {
    command: [quotedCommand, ...args.map((arg) => quoteCmdArg(arg))].join(' '),
    args: [],
    options: { shell: true, windowsHide: true },
  };
}
