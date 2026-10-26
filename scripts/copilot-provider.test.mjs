import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { testEach } from './test-mock-support.mjs';

import {
  COPILOT_MANAGED_ENV_KEYS,
  COPILOT_PROVIDER_MODELS,
  DEFAULT_COPILOT_PROVIDER_MAX_OUTPUT_TOKENS,
  DEFAULT_COPILOT_PROVIDER_MAX_PROMPT_TOKENS,
  DEFAULT_COPILOT_PROVIDER_MODEL,
  CopilotProviderError,
  copilotProviderStatus,
  describeCopilotProviderStatus,
  parseCopilotProviderConfig,
  quoteShellArgument,
  resolveCopilotLaunchPlan,
} from './copilot-provider.mjs';

const UID = 1000;
const DIR = '/home/tester/.config/fd';
const CONFIG_PATH = `${DIR}/copilot-provider.env`;
const KEY_PATH = `${DIR}/copilot-provider.key`;
const BASE_URL = 'https://api.deepseek.com/anthropic';
// Assembled at runtime so the tracked file never contains a key-shaped literal.
const SENTINEL_KEY = ['sk', 'SENTINEL0123456789abcdef'].join('-');
const SENTINEL_VALUE = 'sentinel-value-must-never-be-printed';

function fakeStats({ mode = 0o600, uid = UID, type = 'file', symlink = false } = {}) {
  return {
    uid,
    mode,
    isSymbolicLink: () => symlink,
    isDirectory: () => type === 'directory',
    isFile: () => type === 'file',
  };
}

/** lstat/readFileSync-Stub: nur registrierte Pfade existieren, alles andere ist ENOENT. */
function fakeFs(entries) {
  const missing = (path) => {
    const error = new Error(`ENOENT: no such file or directory, lstat '${path}'`);
    error.code = 'ENOENT';
    return error;
  };
  return {
    lstatSync(path) {
      const entry = entries[path];
      if (!entry) throw missing(path);
      return entry.stats ?? fakeStats();
    },
    readFileSync(path) {
      const entry = entries[path];
      if (!entry || entry.text === undefined) throw missing(path);
      return entry.text;
    },
  };
}

const configText = (...lines) => lines.join('\n');
const validConfig = configText(
  'FD_COPILOT_PROVIDER=deepseek',
  `COPILOT_PROVIDER_BASE_URL=${BASE_URL}`
);

function entriesFor({ config = validConfig, key = `${SENTINEL_KEY}\n`, overrides = {} } = {}) {
  return {
    [DIR]: { stats: fakeStats({ mode: 0o700, type: 'directory' }) },
    [CONFIG_PATH]: { stats: fakeStats(), text: config },
    [KEY_PATH]: { stats: fakeStats(), text: key },
    ...overrides,
  };
}

function resolvePlan({ entries = entriesFor(), env = {}, geteuid = () => UID, ...rest } = {}) {
  return resolveCopilotLaunchPlan({
    env,
    configPath: CONFIG_PATH,
    keyPath: KEY_PATH,
    fs: fakeFs(entries),
    geteuid,
    ...rest,
  });
}

const warningsOf = (plan) => plan.warnings.join('\n');

describe('parseCopilotProviderConfig', () => {
  test('reads plain KEY=VALUE lines and ignores whole-line comments and blank lines', () => {
    const values = parseCopilotProviderConfig(
      configText(
        '# fd copilot provider',
        '',
        '   ',
        '  # indented comment',
        `COPILOT_PROVIDER_BASE_URL=${BASE_URL}`,
        'COPILOT_MODEL=deepseek-v4-pro'
      )
    );
    assert.deepEqual([...values], [
      ['COPILOT_PROVIDER_BASE_URL', BASE_URL],
      ['COPILOT_MODEL', 'deepseek-v4-pro'],
    ]);
  });

  testEach([
    ['an unknown key', 'UNKNOWN_KEY=value', /unknown key "UNKNOWN_KEY"/],
    ['an export prefix', 'export COPILOT_MODEL=deepseek-v4-pro', /only KEY=VALUE lines/],
    ['a command substitution', 'COPILOT_MODEL=$(whoami)', /shell expansion/],
    ['a backtick', 'COPILOT_MODEL=`whoami`', /shell expansion/],
    ['a variable expansion', 'COPILOT_PROVIDER_BASE_URL=${HOME}', /shell expansion/],
    ['a backslash escape', 'COPILOT_MODEL=deepseek\\-v4-flash', /no spaces, quotes, escapes/],
    ['a value with shell space', 'COPILOT_MODEL=deepseek-v4-flash extra', /no spaces/],
    ['an inline comment', `COPILOT_PROVIDER_BASE_URL=${BASE_URL} # note`, /no spaces/],
    ['a line without a separator', 'just-some-text', /is not KEY=VALUE/],
  ])('rejects %s', (_name, text, expected) => {
    assert.throws(() => parseCopilotProviderConfig(text), (error) => {
      assert.ok(error instanceof CopilotProviderError);
      assert.match(error.message, expected);
      assert.ok(!error.message.includes(SENTINEL_KEY));
      return true;
    });
  });

  testEach(['COPILOT_PROVIDER_API_KEY', 'COPILOT_PROVIDER_API_KEY_COMMAND'])(
    'rejects %s in the configuration file',
    (key) => {
      assert.throws(
        () => parseCopilotProviderConfig(`${key}=${SENTINEL_KEY}`),
        (error) => {
          assert.ok(error instanceof CopilotProviderError);
          assert.match(error.message, /is not accepted in the configuration/);
          assert.ok(!error.message.includes(SENTINEL_KEY));
          return true;
        }
      );
    }
  );

  test('strips matching single and double quotes and accepts CRLF line endings', () => {
    const values = parseCopilotProviderConfig(
      `COPILOT_PROVIDER_BASE_URL="${BASE_URL}"\r\nCOPILOT_MODEL='deepseek-v4-pro'\r\n`
    );
    assert.equal(values.get('COPILOT_PROVIDER_BASE_URL'), BASE_URL);
    assert.equal(values.get('COPILOT_MODEL'), 'deepseek-v4-pro');
  });

  test('enforces the 8 KiB file limit before anything else', () => {
    const block = (lines, width) =>
      Array.from({ length: lines }, () => '#'.repeat(width)).join('\n');
    assert.throws(() => parseCopilotProviderConfig(block(64, 200)), /larger than 8192 bytes/);
    assert.equal(parseCopilotProviderConfig(block(64, 100)).size, 0);
  });

  test('enforces the 4 KiB per-line limit', () => {
    assert.throws(
      () => parseCopilotProviderConfig(`#${'#'.repeat(4 * 1024)}`),
      /line 1 is longer than 4096 bytes/
    );
    assert.equal(parseCopilotProviderConfig(`#${'#'.repeat(4 * 1024 - 1)}`).size, 0);
  });

  test('accepts 64 lines and rejects 65', () => {
    const lines = (count) => Array.from({ length: count }, () => '# comment').join('\n');
    assert.equal(parseCopilotProviderConfig(lines(64)).size, 0);
    assert.throws(
      () => parseCopilotProviderConfig(lines(65)),
      /more than 64 lines/
    );
  });
});

describe('resolveCopilotLaunchPlan provider selection', () => {
  test('builds the provider plan with env delta and managed env keys', () => {
    const plan = resolvePlan();

    assert.equal(plan.mode, 'provider');
    assert.equal(plan.model, DEFAULT_COPILOT_PROVIDER_MODEL);
    assert.deepEqual(plan.envDelta, {
      COPILOT_PROVIDER_TYPE: 'anthropic',
      COPILOT_PROVIDER_BASE_URL: BASE_URL,
      COPILOT_PROVIDER_API_KEY_COMMAND: `cat ${quoteShellArgument(KEY_PATH)}`,
      COPILOT_MODEL: DEFAULT_COPILOT_PROVIDER_MODEL,
      COPILOT_PROVIDER_MAX_PROMPT_TOKENS: String(DEFAULT_COPILOT_PROVIDER_MAX_PROMPT_TOKENS),
      COPILOT_PROVIDER_MAX_OUTPUT_TOKENS: String(DEFAULT_COPILOT_PROVIDER_MAX_OUTPUT_TOKENS),
    });
    assert.equal(plan.envDelta.COPILOT_PROVIDER_API_KEY_COMMAND, `cat '${KEY_PATH}'`);
    assert.deepEqual(plan.envUnset, [
      'COPILOT_PROVIDER_MODEL_ID',
      'COPILOT_PROVIDER_WIRE_MODEL',
      'COPILOT_PROVIDER_API_KEY_FILE',
      'COPILOT_PROVIDER_API_KEY',
      'COPILOT_PROVIDER_BEARER_TOKEN',
    ]);
    assert.deepEqual(plan.warnings, []);
  });

  test('keeps the key out of the plan, argv, warnings and status lines', () => {
    const plan = resolvePlan();
    const status = copilotProviderStatus({
      env: {},
      configPath: CONFIG_PATH,
      keyPath: KEY_PATH,
      fs: fakeFs(entriesFor()),
      geteuid: () => UID,
    });
    const rendered = [
      JSON.stringify(plan),
      JSON.stringify(status),
      describeCopilotProviderStatus(status),
      warningsOf(plan),
      plan.envDelta.COPILOT_PROVIDER_API_KEY_COMMAND,
    ].join('\n');

    assert.ok(!rendered.includes(SENTINEL_KEY), 'the key value must never be rendered');
    assert.ok(rendered.includes(KEY_PATH), 'only the key path is exposed');
  });

  test('is a silent opt-out without a configuration file', () => {
    const plan = resolvePlan({ entries: {} });
    assert.deepEqual(plan, {
      mode: 'github',
      model: null,
      envDelta: {},
      envUnset: [],
      warnings: [],
    });
  });

  test('--no-provider falls back and unsets every managed key', () => {
    const plan = resolvePlan({ noProvider: true });
    assert.equal(plan.mode, 'github');
    assert.deepEqual(plan.envUnset, [...COPILOT_MANAGED_ENV_KEYS]);
    assert.equal(plan.warnings.length, 1);
    assert.match(warningsOf(plan), /provider disabled by --no-provider/);
    assert.match(warningsOf(plan), /api\.deepseek\.com/);
  });

  test('--no-provider needs no configuration file and still unsets every managed key', () => {
    const plan = resolvePlan({ entries: {}, noProvider: true });
    assert.equal(plan.mode, 'github');
    assert.deepEqual(plan.envDelta, {});
    assert.deepEqual(plan.envUnset, [...COPILOT_MANAGED_ENV_KEYS]);
    assert.equal(plan.warnings.length, 1);
    assert.match(warningsOf(plan), /provider disabled by --no-provider/);
    assert.match(warningsOf(plan), /api\.deepseek\.com/);
  });

  test('a shell opt-out needs no configuration file and still unsets every managed key', () => {
    const plan = resolvePlan({ entries: {}, env: { FD_COPILOT_PROVIDER: 'github' } });
    assert.equal(plan.mode, 'github');
    assert.deepEqual(plan.envDelta, {});
    assert.deepEqual(plan.envUnset, [...COPILOT_MANAGED_ENV_KEYS]);
    assert.equal(plan.warnings.length, 1);
    assert.match(warningsOf(plan), /provider disabled by FD_COPILOT_PROVIDER=github/);
    assert.match(warningsOf(plan), /api\.deepseek\.com/);
  });

  test('a configuration-file opt-out wins before the key file is checked', () => {
    const plan = resolvePlan({
      entries: entriesFor({
        config: configText('FD_COPILOT_PROVIDER=github'),
        overrides: { [KEY_PATH]: undefined },
      }),
    });
    assert.equal(plan.mode, 'github');
    assert.deepEqual(plan.envDelta, {});
    assert.deepEqual(plan.envUnset, [...COPILOT_MANAGED_ENV_KEYS]);
    assert.equal(plan.warnings.length, 1);
    assert.match(warningsOf(plan), /provider disabled by FD_COPILOT_PROVIDER=github/);
    assert.match(warningsOf(plan), /api\.deepseek\.com/);
    assert.ok(!warningsOf(plan).includes('missing key file'));
  });

  testEach([
    [
      'the configuration file',
      { entries: entriesFor({ config: configText('FD_COPILOT_PROVIDER=github') }) },
    ],
    ['the shell', { env: { FD_COPILOT_PROVIDER: 'github' } }],
  ])('honours an explicit github opt-out in %s', (_name, options) => {
    const plan = resolvePlan(options);
    assert.equal(plan.mode, 'github');
    assert.match(warningsOf(plan), /provider disabled by FD_COPILOT_PROVIDER=github/);
  });

  test('warns instead of throwing on an invalid FD_COPILOT_PROVIDER shell value', () => {
    const plan = resolvePlan({ env: { FD_COPILOT_PROVIDER: 'openai' } });
    assert.equal(plan.mode, 'github');
    assert.match(warningsOf(plan), /invalid FD_COPILOT_PROVIDER value/);
    assert.ok(!warningsOf(plan).includes('openai'));
  });

  test('keeps COPILOT_PROVIDER_WIRE_MODEL only when the file sets it', () => {
    const withWire = resolvePlan({
      entries: entriesFor({
        config: configText(validConfig, 'COPILOT_PROVIDER_WIRE_MODEL=deepseek-chat'),
      }),
    });
    assert.equal(withWire.mode, 'provider');
    assert.equal(withWire.envDelta.COPILOT_PROVIDER_WIRE_MODEL, 'deepseek-chat');
    assert.ok(!withWire.envUnset.includes('COPILOT_PROVIDER_WIRE_MODEL'));
    assert.ok(!('COPILOT_PROVIDER_WIRE_MODEL' in resolvePlan().envDelta));
  });
});

describe('resolveCopilotLaunchPlan permission matrix', () => {
  const discarded = (plan) => {
    assert.equal(plan.mode, 'github');
    assert.equal(plan.model, null);
    assert.equal(plan.warnings.length, 1);
    assert.match(warningsOf(plan), /^Copilot provider: /);
    assert.match(warningsOf(plan), /Using GitHub Copilot models instead/);
    assert.ok(!warningsOf(plan).includes(SENTINEL_KEY));
    assert.ok(!warningsOf(plan).includes(SENTINEL_VALUE));
    assert.equal(Object.keys(plan.envDelta).length, 0);
  };

  test('accepts mode 0600 files and a 0700 directory', () => {
    assert.equal(resolvePlan().mode, 'provider');
  });

  testEach([
    ['0644', 0o644],
    ['0755', 0o755],
    ['0640', 0o640],
    ['0604', 0o604],
  ])('discards a configuration file with mode %s', (_label, mode) => {
      const plan = resolvePlan({
        entries: entriesFor({
          config: configText(validConfig, `COPILOT_MODEL=deepseek-v4-pro`),
          overrides: { [CONFIG_PATH]: { stats: fakeStats({ mode }), text: validConfig } },
        }),
      });
      discarded(plan);
    assert.match(warningsOf(plan), /invalid configuration \(Configuration file .*must have mode 0600/);
  });

  test('discards a configuration file with a foreign owner', () => {
    const plan = resolvePlan({
      entries: entriesFor({
        overrides: { [CONFIG_PATH]: { stats: fakeStats({ uid: 0 }), text: validConfig } },
      }),
    });
    discarded(plan);
    assert.match(warningsOf(plan), /must be owned by uid 1000/);
  });

  test('discards a symbolic-linked configuration file', () => {
    const plan = resolvePlan({
      entries: entriesFor({
        overrides: { [CONFIG_PATH]: { stats: fakeStats({ symlink: true }), text: validConfig } },
      }),
    });
    discarded(plan);
    assert.match(warningsOf(plan), /must not be a symbolic link/);
  });

  test('discards a directory where the configuration file is expected', () => {
    const plan = resolvePlan({
      entries: entriesFor({
        overrides: {
          [CONFIG_PATH]: { stats: fakeStats({ mode: 0o700, type: 'directory' }), text: validConfig },
        },
      }),
    });
    discarded(plan);
    assert.match(warningsOf(plan), /must be a regular file/);
  });

  test('discards a group/world readable configuration directory', () => {
    const plan = resolvePlan({
      entries: entriesFor({
        overrides: { [DIR]: { stats: fakeStats({ mode: 0o755, type: 'directory' }) } },
      }),
    });
    discarded(plan);
    assert.match(warningsOf(plan), /Configuration directory .*must have mode 0700/);
  });

  test('discards a configuration file with an unknown key', () => {
    const plan = resolvePlan({
      entries: entriesFor({ config: configText(validConfig, `UNKNOWN=${SENTINEL_VALUE}`) }),
    });
    discarded(plan);
    assert.match(warningsOf(plan), /invalid configuration \(unknown key "UNKNOWN"\)/);
  });

  testEach([
    ['0644', 0o644],
    ['0755', 0o755],
  ])('discards a key file with mode %s', (_label, mode) => {
    const plan = resolvePlan({
      entries: entriesFor({
        overrides: { [KEY_PATH]: { stats: fakeStats({ mode }), text: `${SENTINEL_KEY}\n` } },
      }),
    });
    discarded(plan);
    assert.match(warningsOf(plan), /Key file .*must have mode 0600/);
  });

  test('discards a symbolic-linked or foreign-owned key file', () => {
    const symlink = resolvePlan({
      entries: entriesFor({
        overrides: {
          [KEY_PATH]: { stats: fakeStats({ symlink: true }), text: `${SENTINEL_KEY}\n` },
        },
      }),
    });
    discarded(symlink);
    assert.match(warningsOf(symlink), /Key file .*must not be a symbolic link/);

    const foreign = resolvePlan({
      entries: entriesFor({
        overrides: { [KEY_PATH]: { stats: fakeStats({ uid: 0 }), text: `${SENTINEL_KEY}\n` } },
      }),
    });
    discarded(foreign);
    assert.match(warningsOf(foreign), /Key file .*must be owned by uid 1000/);
  });

  testEach([
    ['an empty key file', ''],
    ['a key file without the sk- prefix', 'not-a-key-0123456789abcdef\n'],
    ['a key file with two lines', `${SENTINEL_KEY}\n${SENTINEL_KEY}\n`],
    ['a key file with a too short key', 'sk-short\n'],
    ['a key file larger than 512 bytes', `sk-${'a'.repeat(600)}\n`],
  ])('discards %s', (_name, key) => {
    const plan = resolvePlan({ entries: entriesFor({ key }) });
    discarded(plan);
    assert.match(warningsOf(plan), /^(Copilot provider: (key file .*|missing key file ))/);
  });

  test('discards the provider when the key file is missing', () => {
    const plan = resolvePlan({
      entries: entriesFor({ overrides: { [KEY_PATH]: undefined } }),
    });
    discarded(plan);
    assert.match(warningsOf(plan), /missing key file /);
  });

  testEach([
    ['a missing base URL', configText('FD_COPILOT_PROVIDER=deepseek'), /BASE_URL is missing/],
    [
      'a non-https base URL',
      configText('COPILOT_PROVIDER_BASE_URL=http://api.deepseek.com'),
      /must be an https:\/\/ URL/,
    ],
    [
      'an OpenAI-compatible provider type',
      configText(validConfig, 'COPILOT_PROVIDER_TYPE=openai'),
      /COPILOT_PROVIDER_TYPE must be "anthropic"/,
    ],
    [
      'an unsupported model in the file',
      configText(validConfig, 'COPILOT_MODEL=gpt-4.1'),
      /COPILOT_MODEL must be one of deepseek-v4-flash, deepseek-v4-pro/,
    ],
    [
      'a non-numeric token limit',
      configText(validConfig, 'COPILOT_PROVIDER_MAX_PROMPT_TOKENS=lots'),
      /must be a positive integer/,
    ],
    [
      'a relative key file path',
      configText(validConfig, 'COPILOT_PROVIDER_API_KEY_FILE=copilot-provider.key'),
      /COPILOT_PROVIDER_API_KEY_FILE must be an absolute path/,
    ],
  ])('discards the provider for %s', (_name, config, expected) => {
    const plan = resolvePlan({ entries: entriesFor({ config }) });
    discarded(plan);
    assert.match(warningsOf(plan), expected);
  });
});

describe('resolveCopilotLaunchPlan model and limit precedence', () => {
  const modelOf = (options) => resolvePlan(options).model;

  test('--model wins over the configuration file, the shell and the default', () => {
    assert.equal(
      modelOf({
        modelFlag: 'deepseek-v4-pro',
        entries: entriesFor({
          config: configText(validConfig, 'COPILOT_MODEL=deepseek-v4-flash'),
        }),
        env: { COPILOT_MODEL: 'deepseek-v4-flash' },
      }),
      'deepseek-v4-pro'
    );
  });

  test('the configuration file wins over the shell environment', () => {
    assert.equal(
      modelOf({
        entries: entriesFor({
          config: configText(validConfig, 'COPILOT_PROVIDER_MODEL_ID=deepseek-v4-flash'),
        }),
        env: { COPILOT_MODEL: 'deepseek-v4-pro' },
      }),
      'deepseek-v4-flash'
    );
  });

  test('the shell environment wins over the default', () => {
    assert.equal(modelOf({ env: { COPILOT_MODEL: 'deepseek-v4-pro' } }), 'deepseek-v4-pro');
    assert.equal(
      modelOf({ env: { COPILOT_PROVIDER_MODEL_ID: 'deepseek-v4-pro' } }),
      'deepseek-v4-pro'
    );
  });

  test('ignores an unsupported shell model with a warning and uses the default', () => {
    const plan = resolvePlan({ env: { COPILOT_MODEL: 'gpt-4.1' } });
    assert.equal(plan.model, DEFAULT_COPILOT_PROVIDER_MODEL);
    assert.match(warningsOf(plan), /ignoring unsupported COPILOT_MODEL from the shell/);
    assert.ok(!warningsOf(plan).includes('gpt-4.1'));
  });

  testEach(['gpt-4.1', 'deepseek-v3', 'DeepSeek-V4-Pro', ''])(
    'throws for the unsupported --model value %j',
    (modelFlag) => {
      assert.throws(
        () => resolvePlan({ modelFlag }),
        (error) => {
          assert.ok(!(error instanceof CopilotProviderError));
          assert.match(error.message, /--model requires a model id|Unsupported --model/);
          return true;
        }
      );
      // Auch ohne Provider-Konfiguration ist ein fremdes --model ein Fehler.
      assert.throws(() => resolvePlan({ modelFlag, entries: {} }), /--model/);
    }
  );

  test('uses the documented default token limits', () => {
    const { envDelta } = resolvePlan();
    assert.equal(envDelta.COPILOT_PROVIDER_MAX_PROMPT_TOKENS, '840000');
    assert.equal(envDelta.COPILOT_PROVIDER_MAX_OUTPUT_TOKENS, '128000');
  });

  test('the configuration file overrides both token limits', () => {
    const { envDelta } = resolvePlan({
      entries: entriesFor({
        config: configText(
          validConfig,
          'COPILOT_PROVIDER_MAX_PROMPT_TOKENS=1000000',
          'COPILOT_PROVIDER_MAX_OUTPUT_TOKENS=64000'
        ),
      }),
    });
    assert.equal(envDelta.COPILOT_PROVIDER_MAX_PROMPT_TOKENS, '1000000');
    assert.equal(envDelta.COPILOT_PROVIDER_MAX_OUTPUT_TOKENS, '64000');
  });

  test('the shell environment overrides both token limits', () => {
    const { envDelta } = resolvePlan({
      env: {
        COPILOT_PROVIDER_MAX_PROMPT_TOKENS: '500000',
        COPILOT_PROVIDER_MAX_OUTPUT_TOKENS: '32000',
      },
    });
    assert.equal(envDelta.COPILOT_PROVIDER_MAX_PROMPT_TOKENS, '500000');
    assert.equal(envDelta.COPILOT_PROVIDER_MAX_OUTPUT_TOKENS, '32000');
  });

  testEach([['COPILOT_PROVIDER_MAX_PROMPT_TOKENS', '840000'], ['COPILOT_PROVIDER_MAX_OUTPUT_TOKENS', '128000']])(
    'ignores an invalid shell %s with a warning',
    (key, fallback) => {
      const plan = resolvePlan({ env: { [key]: '-1' } });
      assert.equal(plan.envDelta[key], fallback);
      assert.match(warningsOf(plan), new RegExp(`ignoring invalid ${key} from the shell`));
    }
  );

  test('exposes only the supported models', () => {
    assert.deepEqual([...COPILOT_PROVIDER_MODELS], ['deepseek-v4-flash', 'deepseek-v4-pro']);
  });
});
