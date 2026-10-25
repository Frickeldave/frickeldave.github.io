/**
 * Small shared adapter that lets the start-flow tests run on `node --test`.
 *
 * The start-flow tests were written for vitest. Node's test runner has no
 * `expect`, no call-array mock semantics and no environment stubbing, so this
 * module provides exactly the subset those tests use:
 *
 *   - `vi.fn()` mocks whose `mock.calls` entries are plain argument arrays
 *   - `vi.spyOn()` spies with `mockRestore()`
 *   - `vi.stubEnv()` / `vi.unstubAllEnvs()` for `process.env`
 *   - `vi.resetAllMocks()`
 *   - `expect()` with `toBe`, `toEqual`, `toContain`, `toHaveLength`, `toMatch`
 *   - `testEach()` / `itEach()` as the `test.each()` / `it.each()` replacement
 *
 * Module mocking itself is done by the test files through `mock.module()` from
 * `node:test` (run the suite with `--experimental-test-module-mocks`).
 */
import nodeAssert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { it as nodeIt, mock as nodeMock, test as nodeTest } from 'node:test';

const requireModule = createRequire(import.meta.url);

const createdMocks = new Set();
const envStubs = [];

const describeValue = (value) => {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'function') return value.name || 'anonymous function';
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
};

const contains = (actual, expected) =>
  Array.isArray(actual) ? actual.includes(expected) : String(actual).includes(expected);

export function expect(actual, message) {
  const fail = (description) => {
    nodeAssert.fail(message ? `${description} (${message})` : description);
  };

  const matchers = {
    toBe: (expected) => nodeAssert.equal(actual, expected, message),
    toEqual: (expected) => nodeAssert.deepEqual(actual, expected, message),
    toContain: (expected) => {
      if (!contains(actual, expected)) {
        fail(`expected ${describeValue(actual)} to contain ${describeValue(expected)}`);
      }
    },
    toHaveLength: (expected) => nodeAssert.equal(actual?.length, expected, message),
    toMatch: (expected) => nodeAssert.match(String(actual), expected, message),
    toThrow: (expected) =>
      nodeAssert.throws(
        () => actual(),
        expected instanceof RegExp ? expected : new RegExp(String(expected)),
        message
      ),
  };

  matchers.not = {
    toBe: (expected) => nodeAssert.notEqual(actual, expected, message),
    toContain: (expected) => {
      if (contains(actual, expected)) {
        fail(`expected ${describeValue(actual)} not to contain ${describeValue(expected)}`);
      }
    },
  };

  return matchers;
}

export function fn(implementation) {
  const calls = [];
  const once = [];
  let impl = implementation;

  const mockFn = function mockFunction(...args) {
    calls.push(args);
    const current = once.length > 0 ? once.shift() : impl;
    return current === undefined ? undefined : current.apply(this, args);
  };

  mockFn.mock = { calls };
  mockFn.mockClear = () => {
    calls.length = 0;
    return mockFn;
  };
  mockFn.mockReset = () => {
    calls.length = 0;
    once.length = 0;
    impl = undefined;
    return mockFn;
  };
  mockFn.mockRestore = () => {
    mockFn.mockReset();
    mockFn.restore?.();
    return mockFn;
  };
  mockFn.mockImplementation = (next) => {
    impl = next;
    return mockFn;
  };
  mockFn.mockReturnValue = (value) => {
    impl = () => value;
    return mockFn;
  };
  mockFn.mockResolvedValue = (value) => {
    impl = () => Promise.resolve(value);
    return mockFn;
  };
  mockFn.mockReturnValueOnce = (value) => {
    once.push(() => value);
    return mockFn;
  };
  mockFn.mockResolvedValueOnce = (value) => {
    once.push(() => Promise.resolve(value));
    return mockFn;
  };

  createdMocks.add(mockFn);
  return mockFn;
}

export function spyOn(target, method) {
  const original = target[method];
  const spy = fn((...args) => original.apply(target, args));
  target[method] = spy;
  spy.restore = () => {
    target[method] = original;
    spy.restore = undefined;
  };
  return spy;
}

export function stubEnv(name, value) {
  envStubs.push({
    name,
    had: Object.hasOwn(process.env, name),
    value: process.env[name],
  });
  process.env[name] = String(value);
}

export function unstubAllEnvs() {
  while (envStubs.length > 0) {
    const { name, had, value } = envStubs.pop();
    if (had) process.env[name] = value;
    else delete process.env[name];
  }
}

export function resetAllMocks() {
  for (const mockFn of createdMocks) mockFn.mockReset();
}

/**
 * Replaces a module for the rest of this test process, like `vi.mock()` with
 * `importOriginal`: the real exports stay available and the overrides are
 * applied on top.
 *
 * Non-configurable builtin exports (e.g. `fs.constants`) are copied with their
 * original property descriptor, because that is the only way Node's module
 * mock can redefine them; such exports cannot be overridden.
 *
 * Must run before the module under test is imported, therefore the dynamic
 * `await import(...)` in the test files.
 */
export async function mockModule(specifier, overrides = {}) {
  const real = specifier.startsWith('node:') ? requireModule(specifier) : await import(specifier);
  const isNamespace = Object.prototype.toString.call(real) === '[object Module]';
  const exported = {};
  const fixed = new Set();
  for (const [name, value] of Object.entries(real)) {
    const descriptor = Object.getOwnPropertyDescriptor(real, name);
    if (!isNamespace && descriptor?.configurable === false) {
      Object.defineProperty(exported, name, descriptor);
      fixed.add(name);
    } else {
      exported[name] = value;
    }
  }
  for (const [name, value] of Object.entries(overrides)) {
    if (!fixed.has(name)) exported[name] = value;
  }
  nodeMock.module(specifier, { exports: exported });
}

function formatCaseName(template, args, index, entry) {
  let argIndex = 0;
  return String(template)
    .replace(/%([sj#%])/g, (_match, token) => {
      if (token === '%') return '%';
      if (token === '#') return String(index);
      const value = args[argIndex];
      argIndex += 1;
      return token === 'j' ? JSON.stringify(value) : String(value);
    })
    .replace(/\$([A-Za-z_]\w*)/g, (match, property) =>
      entry !== null && typeof entry === 'object' && property in entry
        ? String(entry[property])
        : match
    );
}

function makeEach(register) {
  return (cases) => (nameTemplate, ...rest) =>
    cases.forEach((entry, index) => {
      const args = Array.isArray(entry) ? entry : [entry];
      register(formatCaseName(nameTemplate, args, index, entry), () => rest[0](...args));
    });
}

export const testEach = makeEach(nodeTest);
export const itEach = makeEach(nodeIt);

export const vi = {
  fn,
  spyOn,
  stubEnv,
  unstubAllEnvs,
  resetAllMocks,
  mocked: (mockFn) => mockFn,
};
