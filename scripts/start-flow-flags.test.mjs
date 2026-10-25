import assert from 'node:assert/strict';
import { test } from 'node:test';
import { testEach, vi } from './test-mock-support.mjs';

import { runReqEng } from './start-reqeng.mjs';

async function captureHelp(run) {
  const output = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  try {
    await run();
    return output.mock.calls.map(([chunk]) => String(chunk)).join('');
  } finally {
    output.mockRestore();
  }
}

testEach([
  ['start-work', './start-work.mjs'],
  ['start-review', './start-review.mjs'],
])('%s --help documents the shared flow flags', async (_name, modulePath) => {
  const { main } = await import(modulePath);
  const originalArgv = process.argv;
  try {
    process.argv = ['node', 'launcher', '--help'];
    const text = await captureHelp(main);
    assert.match(text, /--notmux/);
    assert.match(text, /--prompt/);
    assert.match(text, /--noprompt/);
  } finally {
    process.argv = originalArgv;
  }
});

test('start-reqeng --help documents the shared flow flags', async () => {
  const text = await captureHelp(() => runReqEng({ argv: ['--help'] }));
  assert.match(text, /--notmux/);
  assert.match(text, /--noprompt/);
});

function reqengOptions(argv, extra = {}) {
  const seen = { prepare: null, askedPrompt: 0, detected: 0, launchPrompt: undefined };
  const options = {
    argv,
    getMainCheckoutPathFn: () => '/tmp/ExampleProject',
    ensureProjectPropertyAccessFn: () => {},
    createInterfaceFn: () => ({ close: () => {} }),
    resolveIssueContextFn: (issueId) => ({
      issueId,
      requestedId: issueId,
      canonicalRefName: `IS_${issueId}`,
      issueTitle: 'T',
      branchSlug: 't',
    }),
    promptAdditionalPromptFn: async () => {
      seen.askedPrompt += 1;
      return null;
    },
    assignIssueToCurrentHumanFn: () => {},
    detectIdFromTmuxSessionFn: () => {
      seen.detected += 1;
      return { id: 99, sessionName: 'IS99' };
    },
    prepareWorkContextFn: async (_issue, _root, _prompt, flags) => {
      seen.prepare = flags;
      return {};
    },
    launchPreparedWorkFn: async (_ctx, _issue, initialPrompt) => {
      seen.launchPrompt = initialPrompt;
    },
    ...extra,
  };
  return { options, seen };
}

test('start-reqeng --notmux skips tmux detection and forwards notmux', async () => {
  const { options, seen } = reqengOptions(['--notmux', 'IS_5', '--noprompt']);
  await runReqEng(options);
  assert.deepEqual(seen.prepare, { notmux: true });
  assert.equal(seen.detected, 0);
  assert.equal(seen.askedPrompt, 0);
});

test('start-reqeng --prompt skips the question and reaches the launch prompt', async () => {
  const { options, seen } = reqengOptions(['IS_5', '--prompt', 'Continue please']);
  await runReqEng(options);
  assert.equal(seen.askedPrompt, 0);
  assert.deepEqual(seen.prepare, { notmux: false });
  assert.match(String(seen.launchPrompt), /Continue please/);
});

test('start-reqeng asks for the prompt without flags and rejects conflicting flags', async () => {
  const { options, seen } = reqengOptions(['IS_5']);
  await runReqEng(options);
  assert.equal(seen.askedPrompt, 1);

  const conflict = reqengOptions(['IS_5', '--prompt', 'x', '--noprompt']);
  await assert.rejects(() => runReqEng(conflict.options), /mutually exclusive/);
});
