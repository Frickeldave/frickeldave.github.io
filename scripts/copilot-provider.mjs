/**
 * BYOK-Provider-Plan für die Copilot-CLI (Issue #285), ohne Seiteneffekte.
 *
 * Das Modul liest die fd-Konfiguration (`~/.config/fd/copilot-provider.env`) und
 * die Key-Datei (`~/.config/fd/copilot-provider.key`), prüft beides fail-closed und
 * liefert daraus einen Launch-Plan. Es mutiert weder `process.env` noch startet es
 * Prozesse; `fs`, `env`, `homedir` und `geteuid` sind injizierbar.
 *
 * Der Key selbst wird nur zum Prüfen gelesen und danach verworfen. In den Plan
 * wandert ausschließlich der Pfad, als `COPILOT_PROVIDER_API_KEY_COMMAND`:
 * `cat '<pfad>'`. Damit steht der Key weder in `process.env` noch in `argv`,
 * `ps`, Logger-Ausgaben oder in der tmux-Session-Umgebung.
 *
 * Format der Konfigurationsdatei: reines `KEY=VALUE`, ganze Zeilen mit `#` sind
 * Kommentare, Werte dürfen in einfachen oder doppelten Quotes stehen. Es gibt
 * keine Shell: kein `export`, keine `$(...)`/Backticks/`${VAR}`-Expansion, keine
 * Zeilenfortsetzung, keine `\`-Escapes und keine Kommentare hinter dem Wert.
 */
import { lstatSync, readFileSync } from 'node:fs';
import { homedir as osHomedir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';

/** Provider-Typ, den DeepSeek für die Anthropic-kompatible API vorschreibt. */
export const COPILOT_PROVIDER_TYPE = 'anthropic';
/** Unterstützte Modelle; alles andere ist ein harter Fehler bzw. eine ungültige Konfiguration. */
export const COPILOT_PROVIDER_MODELS = Object.freeze(['deepseek-v4-flash', 'deepseek-v4-pro']);
export const DEFAULT_COPILOT_PROVIDER_MODEL = 'deepseek-v4-flash';
export const DEFAULT_COPILOT_PROVIDER_MAX_PROMPT_TOKENS = 840000;
export const DEFAULT_COPILOT_PROVIDER_MAX_OUTPUT_TOKENS = 128000;
/** Nur zur Anzeige, wenn keine gültige Base-URL vorliegt. */
export const DEFAULT_COPILOT_PROVIDER_HOST = 'api.deepseek.com';

const CONFIG_MAX_BYTES = 8 * 1024;
const CONFIG_MAX_LINE_BYTES = 4 * 1024;
const CONFIG_MAX_LINES = 64;
const KEY_MAX_BYTES = 512;
const KEY_PATTERN = /^sk-[A-Za-z0-9_-]{16,}$/;
const KEY_MODE = 0o600;
const CONFIG_MODE = 0o600;
const CONFIG_DIRECTORY_MODE = 0o700;
/** Absolut bewusst: Werte mit Leerzeichen, `~`, Expansion oder Escapes sind nicht erlaubt. */
const SAFE_VALUE_PATTERN = /^[A-Za-z0-9._:/@+-]+$/;
const KEY_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const LIMIT_PATTERN = /^[1-9]\d{0,8}$/;
const TOKEN_LIKE_KEY_NAMES = new Set([
  'COPILOT_PROVIDER_API_KEY',
  'COPILOT_PROVIDER_API_KEY_COMMAND',
  'COPILOT_PROVIDER_BEARER_TOKEN',
]);

/** Schlüssel, die die Datei höchstens enthalten darf; jeder andere ist ein Fehler. */
export const COPILOT_PROVIDER_CONFIG_KEYS = Object.freeze([
  'FD_COPILOT_PROVIDER',
  'COPILOT_PROVIDER_TYPE',
  'COPILOT_PROVIDER_BASE_URL',
  'COPILOT_MODEL',
  'COPILOT_PROVIDER_MODEL_ID',
  'COPILOT_PROVIDER_WIRE_MODEL',
  'COPILOT_PROVIDER_MAX_PROMPT_TOKENS',
  'COPILOT_PROVIDER_MAX_OUTPUT_TOKENS',
  'COPILOT_PROVIDER_API_KEY_FILE',
]);
const CONFIG_KEYS = new Set(COPILOT_PROVIDER_CONFIG_KEYS);

/**
 * Schlüssel, die im Provider-Modus ausschließlich der Plan bestimmt. Was der Plan
 * nicht setzt, wird aus dem Kind-Env entfernt (`envUnset`), damit z. B. ein altes
 * `COPILOT_PROVIDER_TYPE=openai` aus der Shell nicht durchschlägt.
 */
export const COPILOT_MANAGED_ENV_KEYS = Object.freeze([
  'COPILOT_PROVIDER_TYPE',
  'COPILOT_PROVIDER_BASE_URL',
  'COPILOT_PROVIDER_MODEL_ID',
  'COPILOT_PROVIDER_WIRE_MODEL',
  'COPILOT_PROVIDER_MAX_PROMPT_TOKENS',
  'COPILOT_PROVIDER_MAX_OUTPUT_TOKENS',
  'COPILOT_PROVIDER_API_KEY_FILE',
  'COPILOT_PROVIDER_API_KEY_COMMAND',
  'COPILOT_PROVIDER_API_KEY',
  'COPILOT_PROVIDER_BEARER_TOKEN',
  'COPILOT_MODEL',
]);

/** Fasst eine ungültige Konfiguration/einen ungültigen Key zusammen; die Meldung enthält nie Werte. */
export class CopilotProviderError extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'CopilotProviderError';
    this.reason = reason;
  }
}

/** Quotet ein Argument für `sh`; nur der Key-Pfad und Env-Werte laufen hier durch. */
export function quoteShellArgument(value) {
  return `'${String(value).replaceAll("'", `'\\''`)}'`;
}

/** `${XDG_CONFIG_HOME:-$HOME/.config}/fd/...` – Basis für Konfiguration und Key. */
export function resolveCopilotConfigDirectory({ env = process.env, homeDirectory } = {}) {
  const home = homeDirectory ?? osHomedir();
  const base = env.XDG_CONFIG_HOME ? resolve(env.XDG_CONFIG_HOME) : join(home, '.config');
  return join(base, 'fd');
}

/** Pfad der Konfigurationsdatei; `FD_COPILOT_PROVIDER_CONFIG` gewinnt (Tests/CI). */
export function resolveCopilotConfigPath({ env = process.env, homeDirectory } = {}) {
  const override = env.FD_COPILOT_PROVIDER_CONFIG;
  if (typeof override === 'string' && override.trim()) {
    return resolve(override.trim());
  }
  return join(resolveCopilotConfigDirectory({ env, homeDirectory }), 'copilot-provider.env');
}

/** Pfad der Key-Datei; `FD_COPILOT_API_KEY_FILE` gewinnt (Tests/CI). */
export function resolveCopilotKeyPath({ env = process.env, homeDirectory } = {}) {
  const override = env.FD_COPILOT_API_KEY_FILE;
  if (typeof override === 'string' && override.trim()) {
    return resolve(override.trim());
  }
  return join(resolveCopilotConfigDirectory({ env, homeDirectory }), 'copilot-provider.key');
}

/**
 * Parst den Inhalt der Konfigurationsdatei. Wirft `CopilotProviderError` mit
 * Schlüsselnamen bzw. Zeilennummer, aber niemals mit einem Wert.
 * @param {string} text
 * @returns {Map<string, string>}
 */
export function parseCopilotProviderConfig(text) {
  const source = String(text ?? '');
  if (Buffer.byteLength(source, 'utf8') > CONFIG_MAX_BYTES) {
    throw new CopilotProviderError(`configuration is larger than ${CONFIG_MAX_BYTES} bytes`);
  }

  const lines = source.split(/\r?\n/);
  if (lines.length > CONFIG_MAX_LINES) {
    throw new CopilotProviderError(`configuration has more than ${CONFIG_MAX_LINES} lines`);
  }

  const values = new Map();
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    if (Buffer.byteLength(line, 'utf8') > CONFIG_MAX_LINE_BYTES) {
      throw new CopilotProviderError(
        `line ${lineNumber} is longer than ${CONFIG_MAX_LINE_BYTES} bytes`
      );
    }

    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }

    const separator = trimmed.indexOf('=');
    if (separator < 0) {
      throw new CopilotProviderError(`line ${lineNumber} is not KEY=VALUE`);
    }

    const key = trimmed.slice(0, separator).trim();
    if (!KEY_NAME_PATTERN.test(key)) {
      throw new CopilotProviderError(
        `line ${lineNumber} uses unsupported syntax; only KEY=VALUE lines are allowed (no export, no shell syntax)`
      );
    }
    if (!CONFIG_KEYS.has(key)) {
      if (TOKEN_LIKE_KEY_NAMES.has(key)) {
        throw new CopilotProviderError(
          `key "${key}" is not accepted in the configuration; the loader passes the key file itself`
        );
      }
      throw new CopilotProviderError(`unknown key "${key}"`);
    }
    if (values.has(key)) {
      throw new CopilotProviderError(`duplicate key "${key}"`);
    }

    let value = trimmed.slice(separator + 1).trim();
    const quoted =
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")));
    if (quoted) {
      value = value.slice(1, -1);
    }
    if (!SAFE_VALUE_PATTERN.test(value)) {
      throw new CopilotProviderError(
        `invalid value for "${key}"; no spaces, quotes, escapes or shell expansion`
      );
    }

    values.set(key, value);
  });

  return values;
}

function formatMode(mode) {
  return `0${(mode & 0o777).toString(8).padStart(3, '0')}`;
}

function assertSecurePath(fs, path, { label, directory = false, mode, geteuid }) {
  let stats;
  try {
    stats = fs.lstatSync(path);
  } catch (error) {
    if (['ENOENT', 'ENOTDIR'].includes(error?.code)) {
      return false;
    }
    throw new CopilotProviderError(
      `${label} ${path} cannot be inspected${error?.code ? ` (${error.code})` : ''}`
    );
  }

  if (stats.isSymbolicLink()) {
    throw new CopilotProviderError(`${label} ${path} must not be a symbolic link`);
  }
  const expected = directory ? stats.isDirectory() : stats.isFile();
  if (!expected) {
    throw new CopilotProviderError(
      `${label} ${path} must be a ${directory ? 'directory' : 'regular file'}`
    );
  }
  const effectiveUid = typeof geteuid === 'function' ? geteuid() : undefined;
  if (Number.isInteger(effectiveUid) && stats.uid !== effectiveUid) {
    throw new CopilotProviderError(
      `${label} ${path} must be owned by uid ${effectiveUid} (chmod ${formatMode(mode)} ${path})`
    );
  }
  if ((stats.mode & 0o777) !== mode) {
    throw new CopilotProviderError(
      `${label} ${path} must have mode ${formatMode(mode)} (chmod ${formatMode(mode)} ${path})`
    );
  }
  return true;
}

function readTextFile(fs, path, { label }) {
  try {
    return fs.readFileSync(path, 'utf8');
  } catch (error) {
    if (['ENOENT', 'ENOTDIR'].includes(error?.code)) {
      return null;
    }
    throw new CopilotProviderError(
      `${label} ${path} cannot be read${error?.code ? ` (${error.code})` : ''}`
    );
  }
}

/**
 * Liest und prüft die Konfigurationsdatei. Eine fehlende Datei ist der Opt-out und
 * liefert `null`; jede andere Abweichung wirft einen `CopilotProviderError`.
 */
export function loadCopilotProviderConfig({
  fs = { lstatSync, readFileSync },
  configPath,
  geteuid = process.geteuid?.bind(process),
} = {}) {
  // Erst die Datei prüfen: ohne Konfigurationsdatei bleibt das Verhalten unverändert,
  // auch wenn ein fremdes Verzeichnis ~/.config/fd mit anderen Rechten existiert.
  const present = assertSecurePath(fs, configPath, {
    label: 'Configuration file',
    mode: CONFIG_MODE,
    geteuid,
  });
  if (!present) {
    return null;
  }
  assertSecurePath(fs, dirname(configPath), {
    label: 'Configuration directory',
    directory: true,
    mode: CONFIG_DIRECTORY_MODE,
    geteuid,
  });

  const text = readTextFile(fs, configPath, { label: 'Configuration file' });
  if (text === null) {
    return null;
  }

  const values = parseCopilotProviderConfig(text);
  validateConfigValues(values);
  return values;
}

function validateConfigValues(values) {
  const providerType = values.get('COPILOT_PROVIDER_TYPE');
  if (providerType !== undefined && providerType !== COPILOT_PROVIDER_TYPE) {
    throw new CopilotProviderError(
      `COPILOT_PROVIDER_TYPE must be "${COPILOT_PROVIDER_TYPE}"; DeepSeek rejects the OpenAI-compatible mode with HTTP 400 (reasoning_content)`
    );
  }

  const baseUrl = values.get('COPILOT_PROVIDER_BASE_URL');
  if (baseUrl !== undefined && !isHttpsUrl(baseUrl)) {
    throw new CopilotProviderError('COPILOT_PROVIDER_BASE_URL must be an https:// URL');
  }

  for (const key of ['COPILOT_MODEL', 'COPILOT_PROVIDER_MODEL_ID']) {
    const model = values.get(key);
    if (model !== undefined && !COPILOT_PROVIDER_MODELS.includes(model)) {
      throw new CopilotProviderError(
        `${key} must be one of ${COPILOT_PROVIDER_MODELS.join(', ')}`
      );
    }
  }

  for (const key of ['COPILOT_PROVIDER_MAX_PROMPT_TOKENS', 'COPILOT_PROVIDER_MAX_OUTPUT_TOKENS']) {
    const limit = values.get(key);
    if (limit !== undefined && !LIMIT_PATTERN.test(limit)) {
      throw new CopilotProviderError(`${key} must be a positive integer`);
    }
  }

  const provider = values.get('FD_COPILOT_PROVIDER');
  if (provider !== undefined && provider !== 'deepseek' && provider !== 'github') {
    throw new CopilotProviderError('FD_COPILOT_PROVIDER must be "deepseek" or "github"');
  }

  const keyFile = values.get('COPILOT_PROVIDER_API_KEY_FILE');
  if (keyFile !== undefined && !isAbsolute(keyFile)) {
    throw new CopilotProviderError('COPILOT_PROVIDER_API_KEY_FILE must be an absolute path');
  }
}

function isHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.host);
  } catch {
    return false;
  }
}

/** Nur das Prüfergebnis; der Key-Inhalt verlässt diese Funktion nicht. */
function assertKeyFileReadable(fs, keyPath, geteuid) {
  const present = assertSecurePath(fs, keyPath, {
    label: 'Key file',
    mode: KEY_MODE,
    geteuid,
  });
  if (!present) {
    throw new CopilotProviderError(`missing key file ${keyPath} (create it with fd-setup)`);
  }
  assertSecurePath(fs, dirname(keyPath), {
    label: 'Key directory',
    directory: true,
    mode: CONFIG_DIRECTORY_MODE,
    geteuid,
  });

  const text = readTextFile(fs, keyPath, { label: 'Key file' });
  if (text === null) {
    throw new CopilotProviderError(`missing key file ${keyPath} (create it with fd-setup)`);
  }
  if (Buffer.byteLength(text, 'utf8') > KEY_MAX_BYTES) {
    throw new CopilotProviderError(
      `key file ${keyPath} is larger than ${KEY_MAX_BYTES} bytes (write the key with fd-setup)`
    );
  }

  const key = text.replace(/\r?\n$/, '');
  if (/[\r\n]/.test(key) || !KEY_PATTERN.test(key)) {
    throw new CopilotProviderError(
      `key file ${keyPath} does not contain exactly one sk-… key (rewrite it with fd-setup)`
    );
  }
}

function providerHost(baseUrl) {
  if (typeof baseUrl === 'string' && isHttpsUrl(baseUrl)) {
    return new URL(baseUrl).host;
  }
  return DEFAULT_COPILOT_PROVIDER_HOST;
}

function fallbackWarning(reason, host = DEFAULT_COPILOT_PROVIDER_HOST) {
  return `Copilot provider: ${reason}. Using GitHub Copilot models instead (provider host: ${host}).`;
}

function githubPlan(reason = null, { host = DEFAULT_COPILOT_PROVIDER_HOST } = {}) {
  return {
    mode: 'github',
    model: null,
    envDelta: {},
    // Ein ausgesprochener Fallback räumt Provider-Reste aus dem Kind-Env auf; der
    // stille Opt-out ohne Konfigurationsdatei fasst die Umgebung dagegen nicht an.
    envUnset: reason ? [...COPILOT_MANAGED_ENV_KEYS] : [],
    warnings: reason ? [fallbackWarning(reason, host)] : [],
  };
}

/**
 * Löst den Launch-Plan auf: `--model` (CLI) > Konfigurationsdatei > Shell-Env > Default.
 *
 * Liefert `{ mode, model, envDelta, envUnset, warnings }`. Ohne Konfigurationsdatei
 * und ohne `FD_COPILOT_PROVIDER=deepseek` bleibt `mode: 'github'` byte-identisch zum
 * bisherigen Verhalten: leeres `envDelta`, leeres `envUnset`, keine Warnzeile.
 * Ein per `--model` übergebenes unbekanntes Modell wirft immer, auch im GitHub-Modus.
 *
 * @param {{
 *   env?: NodeJS.ProcessEnv;
 *   modelFlag?: string | null;
 *   noProvider?: boolean;
 *   homeDirectory?: string;
 *   configPath?: string;
 *   keyPath?: string;
 *   fs?: { lstatSync: typeof lstatSync; readFileSync: typeof readFileSync };
 *   geteuid?: () => number;
 * }} [options]
 * @returns {{ mode: 'provider' | 'github'; model: string | null; envDelta: Record<string, string>; envUnset: string[]; warnings: string[] }}
 */
export function resolveCopilotLaunchPlan({
  env = process.env,
  modelFlag = null,
  noProvider = false,
  homeDirectory,
  configPath,
  keyPath,
  fs = { lstatSync, readFileSync },
  geteuid = process.geteuid?.bind(process),
} = {}) {
  const explicitModel = typeof modelFlag === 'string' ? modelFlag.trim() : null;
  if (explicitModel !== null && !COPILOT_PROVIDER_MODELS.includes(explicitModel)) {
    throw new Error(
      `Unsupported --model "${explicitModel}". Supported Copilot provider models: ${COPILOT_PROVIDER_MODELS.join(', ')}.`
    );
  }

  const resolvedConfigPath = configPath ?? resolveCopilotConfigPath({ env, homeDirectory });
  const shellSwitch =
    typeof env.FD_COPILOT_PROVIDER === 'string' ? env.FD_COPILOT_PROVIDER.trim() : '';
  if (shellSwitch && shellSwitch !== 'deepseek' && shellSwitch !== 'github') {
    return githubPlan('invalid FD_COPILOT_PROVIDER value (use "deepseek" or "github")');
  }

  let config;
  try {
    config = loadCopilotProviderConfig({ fs, configPath: resolvedConfigPath, geteuid });
  } catch (error) {
    if (!(error instanceof CopilotProviderError)) {
      throw error;
    }
    return githubPlan(`invalid configuration (${error.reason})`);
  }

  if (config === null) {
    // Ohne Datei ist der Provider nicht aktiviert: unverändertes Verhalten, keine Zeile.
    if (shellSwitch !== 'deepseek') {
      return githubPlan(null);
    }
    return githubPlan(`configuration file ${resolvedConfigPath} is missing`);
  }

  const configSwitch = config.get('FD_COPILOT_PROVIDER') ?? '';
  const baseUrl = config.get('COPILOT_PROVIDER_BASE_URL') ?? env.COPILOT_PROVIDER_BASE_URL;
  const host = providerHost(baseUrl);

  if (noProvider) {
    return githubPlan('provider disabled by --no-provider', { host });
  }
  if (shellSwitch === 'github' || configSwitch === 'github') {
    return githubPlan('provider disabled by FD_COPILOT_PROVIDER=github', { host });
  }
  if (!baseUrl) {
    return githubPlan('invalid configuration (COPILOT_PROVIDER_BASE_URL is missing)', { host });
  }
  if (!isHttpsUrl(baseUrl)) {
    return githubPlan('invalid configuration (COPILOT_PROVIDER_BASE_URL must be https://)', {
      host,
    });
  }

  const resolvedKeyPath =
    config.get('COPILOT_PROVIDER_API_KEY_FILE') ??
    keyPath ??
    resolveCopilotKeyPath({ env, homeDirectory });
  try {
    assertKeyFileReadable(fs, resolvedKeyPath, geteuid);
  } catch (error) {
    if (!(error instanceof CopilotProviderError)) {
      throw error;
    }
    return githubPlan(error.reason, { host });
  }

  const warnings = [];
  const model = explicitModel ?? pickModel({ config, env, warnings });
  const maxPromptTokens = pickLimit({
    config,
    env,
    key: 'COPILOT_PROVIDER_MAX_PROMPT_TOKENS',
    fallback: DEFAULT_COPILOT_PROVIDER_MAX_PROMPT_TOKENS,
    warnings,
  });
  const maxOutputTokens = pickLimit({
    config,
    env,
    key: 'COPILOT_PROVIDER_MAX_OUTPUT_TOKENS',
    fallback: DEFAULT_COPILOT_PROVIDER_MAX_OUTPUT_TOKENS,
    warnings,
  });

  const envDelta = {
    COPILOT_PROVIDER_TYPE: config.get('COPILOT_PROVIDER_TYPE') ?? COPILOT_PROVIDER_TYPE,
    COPILOT_PROVIDER_BASE_URL: baseUrl,
    COPILOT_PROVIDER_API_KEY_COMMAND: `cat ${quoteShellArgument(resolvedKeyPath)}`,
    COPILOT_MODEL: model,
    COPILOT_PROVIDER_MAX_PROMPT_TOKENS: String(maxPromptTokens),
    COPILOT_PROVIDER_MAX_OUTPUT_TOKENS: String(maxOutputTokens),
  };

  const wireModel = config.get('COPILOT_PROVIDER_WIRE_MODEL');
  if (wireModel !== undefined) {
    envDelta.COPILOT_PROVIDER_WIRE_MODEL = wireModel;
  }

  return {
    mode: 'provider',
    model,
    envDelta,
    envUnset: COPILOT_MANAGED_ENV_KEYS.filter((key) => !Object.hasOwn(envDelta, key)),
    warnings,
  };
}

function pickModel({ config, env, warnings }) {
  const fromConfig = config.get('COPILOT_MODEL') ?? config.get('COPILOT_PROVIDER_MODEL_ID');
  if (fromConfig !== undefined) {
    return fromConfig;
  }

  for (const key of ['COPILOT_MODEL', 'COPILOT_PROVIDER_MODEL_ID']) {
    const value = typeof env[key] === 'string' ? env[key].trim() : '';
    if (!value) {
      continue;
    }
    if (COPILOT_PROVIDER_MODELS.includes(value)) {
      return value;
    }
    warnings.push(
      `Copilot provider: ignoring unsupported ${key} from the shell; using ${DEFAULT_COPILOT_PROVIDER_MODEL}.`
    );
  }

  return DEFAULT_COPILOT_PROVIDER_MODEL;
}

function pickLimit({ config, env, key, fallback, warnings }) {
  const fromConfig = config.get(key);
  if (fromConfig !== undefined) {
    return Number.parseInt(fromConfig, 10);
  }

  const value = typeof env[key] === 'string' ? env[key].trim() : '';
  if (!value) {
    return fallback;
  }
  if (LIMIT_PATTERN.test(value)) {
    return Number.parseInt(value, 10);
  }

  warnings.push(`Copilot provider: ignoring invalid ${key} from the shell; using ${fallback}.`);
  return fallback;
}

/**
 * Einzeilige Provider-Zeile aus dem Offline-Status; Grundlage für `fd-status`,
 * `fd-welcome` und die Startzeile der Flows.
 */
export function describeCopilotProviderStatus({ state = 'unset', host = null, model = null } = {}) {
  if (state === 'invalid-permissions') {
    return 'Provider : invalid-permissions (GitHub Copilot in use)';
  }
  if (state !== 'set') {
    return 'Provider : GitHub Copilot (Standard)';
  }
  return `Provider : deepseek (${host}) | Modell: ${model}`;
}

/** Einzeilige Provider-Zeile aus dem Launch-Plan (Start-Flows). */
export function describeCopilotProviderPlan(plan) {
  if (!plan || plan.mode !== 'provider') {
    return describeCopilotProviderStatus({ state: 'unset' });
  }
  return describeCopilotProviderStatus({
    state: 'set',
    host: providerHost(plan.envDelta.COPILOT_PROVIDER_BASE_URL),
    model: plan.model,
  });
}

/**
 * Offline-Status für `fd-status`/`fd-welcome`:
 * `set`, `unset` oder `invalid-permissions`. Es wird kein API-Call gemacht und kein
 * Key-Inhalt ausgegeben. Ein ausdrückliches Opt-out (`FD_COPILOT_PROVIDER=github`,
 * `--no-provider`) zählt als `unset`, nicht als Fehler.
 */
export function copilotProviderStatus(options = {}) {
  const plan = resolveCopilotLaunchPlan(options);

  if (plan.mode === 'provider') {
    return {
      state: 'set',
      mode: 'provider',
      type: plan.envDelta.COPILOT_PROVIDER_TYPE,
      baseUrl: plan.envDelta.COPILOT_PROVIDER_BASE_URL,
      host: providerHost(plan.envDelta.COPILOT_PROVIDER_BASE_URL),
      model: plan.model,
      maxPromptTokens: plan.envDelta.COPILOT_PROVIDER_MAX_PROMPT_TOKENS,
      maxOutputTokens: plan.envDelta.COPILOT_PROVIDER_MAX_OUTPUT_TOKENS,
      warnings: plan.warnings,
    };
  }

  const disabled = plan.warnings.some((warning) => /provider disabled/.test(warning));
  return {
    state: plan.warnings.length === 0 || disabled ? 'unset' : 'invalid-permissions',
    mode: 'github',
    type: null,
    baseUrl: null,
    host: null,
    model: null,
    maxPromptTokens: null,
    maxOutputTokens: null,
    warnings: plan.warnings,
  };
}
