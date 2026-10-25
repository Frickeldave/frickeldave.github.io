import { describe, it } from 'node:test';
import { expect } from './test-mock-support.mjs';
import {
  isWindows,
  prepareSpawn,
  quoteCmdArg,
  resolveWindowsLaunchKind,
} from './platform-shared.mjs';

const pathEnv = { PATH: ['C:\\tools', 'C:\\node'].join(';') };

/** @param {string[]} files */
const existsIn = (files) => (path) => files.includes(path);

describe('isWindows', () => {
  it('detects win32 only', () => {
    expect(isWindows('win32')).toBe(true);
    expect(isWindows('linux')).toBe(false);
    expect(isWindows('darwin')).toBe(false);
  });
});

describe('quoteCmdArg', () => {
  it('leaves plain arguments untouched', () => {
    expect(quoteCmdArg('run')).toBe('run');
    expect(quoteCmdArg('--json')).toBe('--json');
    expect(quoteCmdArg('C:\\repo\\file.txt')).toBe('C:\\repo\\file.txt');
  });

  it('quotes empty strings, spaces and cmd.exe metacharacters', () => {
    expect(quoteCmdArg('')).toBe('""');
    expect(quoteCmdArg('hello world')).toBe('"hello world"');
    expect(quoteCmdArg('a&b')).toBe('"a&b"');
    expect(quoteCmdArg('--workspace=@acme/x')).toBe('"--workspace=@acme/x"');
    expect(quoteCmdArg('a|b>c')).toBe('"a|b>c"');
  });

  it('doubles embedded quotes', () => {
    expect(quoteCmdArg('say "hi"')).toBe('"say ""hi"""');
  });

  it('keeps a trailing backslash from escaping the closing quote', () => {
    expect(quoteCmdArg('C:\\my dir\\')).toBe('"C:\\my dir\\\\"');
  });

  it('flattens line breaks because cmd.exe ends a command at a newline', () => {
    expect(quoteCmdArg('line one\nline two\r\n  line three')).toBe(
      '"line one line two line three"'
    );
  });

  it('keeps percent signs literal', () => {
    expect(quoteCmdArg('100%')).toBe('"100%"');
  });
});

describe('resolveWindowsLaunchKind', () => {
  it('treats explicit extensions as decided', () => {
    expect(resolveWindowsLaunchKind('tool.exe', { env: pathEnv, existsFn: () => false })).toBe(
      'direct'
    );
    expect(resolveWindowsLaunchKind('tool.CMD', { env: pathEnv, existsFn: () => false })).toBe(
      'shell'
    );
    expect(resolveWindowsLaunchKind('tool.bat', { env: pathEnv, existsFn: () => false })).toBe(
      'shell'
    );
  });

  it('finds .cmd shims on the PATH', () => {
    expect(
      resolveWindowsLaunchKind('npm', {
        env: pathEnv,
        existsFn: existsIn(['C:\\node\\npm.cmd']),
      })
    ).toBe('shell');
  });

  it('finds real executables on the PATH', () => {
    expect(
      resolveWindowsLaunchKind('gh', { env: pathEnv, existsFn: existsIn(['C:\\tools\\gh.exe']) })
    ).toBe('direct');
  });

  it('prefers a real executable over a shim in the same directory', () => {
    expect(
      resolveWindowsLaunchKind('copilot', {
        env: pathEnv,
        existsFn: existsIn(['C:\\tools\\copilot.cmd', 'C:\\tools\\copilot.exe']),
      })
    ).toBe('direct');
  });

  it('honours directory order on the PATH', () => {
    expect(
      resolveWindowsLaunchKind('tool', {
        env: pathEnv,
        existsFn: existsIn(['C:\\tools\\tool.cmd', 'C:\\node\\tool.exe']),
      })
    ).toBe('shell');
  });

  it('accepts the Path spelling Windows uses', () => {
    expect(
      resolveWindowsLaunchKind('npm', {
        env: { Path: 'C:\\node' },
        existsFn: existsIn(['C:\\node\\npm.cmd']),
      })
    ).toBe('shell');
  });

  it('checks a command with a directory component directly', () => {
    expect(
      resolveWindowsLaunchKind('C:\\bin\\tool', {
        env: pathEnv,
        existsFn: existsIn(['C:\\bin\\tool.cmd']),
      })
    ).toBe('shell');
  });

  it('reports unknown commands', () => {
    expect(resolveWindowsLaunchKind('nope', { env: pathEnv, existsFn: () => false })).toBe(
      'unknown'
    );
    expect(resolveWindowsLaunchKind('nope', { env: {}, existsFn: () => false })).toBe('unknown');
  });
});

describe('prepareSpawn', () => {
  it('never changes anything on POSIX', () => {
    const result = prepareSpawn('npm', ['run', 'dev', 'a b'], {
      platform: 'linux',
      env: pathEnv,
      existsFn: () => true,
    });
    expect(result).toEqual({ command: 'npm', args: ['run', 'dev', 'a b'], options: {} });
  });

  it('spawns real executables directly on Windows', () => {
    const result = prepareSpawn('git', ['status', 'a b'], {
      platform: 'win32',
      env: pathEnv,
      existsFn: existsIn(['C:\\tools\\git.exe']),
    });
    expect(result).toEqual({ command: 'git', args: ['status', 'a b'], options: {} });
  });

  it('passes unknown commands through so spawn reports ENOENT itself', () => {
    const result = prepareSpawn('nope', ['x'], {
      platform: 'win32',
      env: pathEnv,
      existsFn: () => false,
    });
    expect(result).toEqual({ command: 'nope', args: ['x'], options: {} });
  });

  it('builds one quoted command line for .cmd shims on Windows', () => {
    const result = prepareSpawn('npm', ['run', 'dev', '--workspace=@acme/x', 'hello world'], {
      platform: 'win32',
      env: pathEnv,
      existsFn: existsIn(['C:\\node\\npm.cmd']),
    });
    expect(result).toEqual({
      command: 'npm run dev "--workspace=@acme/x" "hello world"',
      args: [],
      options: { shell: true, windowsHide: true },
    });
  });

  it('prefers a real executable later on the PATH over an earlier shim', () => {
    const result = prepareSpawn('copilot', ['--agent', 'Squad'], {
      platform: 'win32',
      env: pathEnv,
      existsFn: existsIn(['C:\\tools\\copilot.bat', 'C:\\node\\copilot.exe']),
    });
    expect(result).toEqual({
      command: 'C:\\node\\copilot.exe',
      args: ['--agent', 'Squad'],
      options: {},
    });
  });

  it('quotes a shim path that contains spaces', () => {
    const result = prepareSpawn('C:\\Program Files\\tool\\tool.cmd', ['x'], {
      platform: 'win32',
      env: pathEnv,
    });
    expect(result.command).toBe('"C:\\Program Files\\tool\\tool.cmd" x');
    expect(result.options).toEqual({ shell: true, windowsHide: true });
  });
});
