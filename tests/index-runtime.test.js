import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Module } from 'node:module';
import path from 'node:path';

const REPO_ROOT = process.cwd();

function createRuntimeFigmaStub() {
  const parameterHandlers = new Map();
  const eventHandlers = new Map();
  const notifications = [];
  let closeCount = 0;

  const figma = {
    currentPage: { selection: [] },
    parameters: {
      on(event, handler) {
        parameterHandlers.set(event, handler);
      },
      off(event, handler) {
        if (parameterHandlers.get(event) === handler) {
          parameterHandlers.delete(event);
        }
      },
    },
    on(event, handler) {
      eventHandlers.set(event, handler);
    },
    notify(message, options) {
      const notification = {
        message,
        options: options ?? null,
        cancelled: false,
      };
      notifications.push(notification);
      return {
        cancel() {
          notification.cancelled = true;
        },
      };
    },
    closePlugin() {
      closeCount += 1;
    },
  };

  return {
    figma,
    notifications,
    reset() {
      notifications.length = 0;
      closeCount = 0;
      figma.currentPage.selection = [];
    },
    async input(query) {
      const handler = parameterHandlers.get('input');
      assert.ok(handler, 'expected index.ts to register an input handler');

      let suggestions;
      await handler({
        key: 'command',
        query,
        result: {
          setSuggestions(next) {
            suggestions = next;
          },
        },
      });
      return suggestions;
    },
    async run(command) {
      const handler = eventHandlers.get('run');
      assert.ok(handler, 'expected index.ts to register a run handler');
      await handler({
        parameters: command === undefined ? {} : { command },
      });
    },
    getCloseCount() {
      return closeCount;
    },
  };
}

function buildCommandsStubSource() {
  return `
import * as impl from 'virtual:impl-stub';

export const COMMANDS = [
  {
    name: 'Width',
    alias: ['w'],
    type: 'commandWithValue',
    valueFormat: 'number',
    suggestion: 'Enter width in pixels',
    functionWithParam: (value) => impl.recordCommand('Width', value),
  },
  {
    name: 'Padding',
    alias: ['p'],
    type: 'commandWithValue',
    valueFormat: 'number',
    suggestion: 'Padding in px',
    functionWithParam: (value) => impl.recordPadding(value),
  },
  {
    name: 'SelectParent',
    alias: ['selp', 'sp'],
    type: 'commandWithoutValue',
    suggestion: 'Select parent layer',
    functionWithoutParam: () => impl.selectParent(),
  },
  {
    name: 'SelectChildren',
    alias: ['selc', 'sc'],
    type: 'commandWithoutValue',
    suggestion: 'Select direct children',
    functionWithoutParam: () => impl.selectChildren(),
  },
  {
    name: 'StrokeBottom',
    alias: ['stb', 'bb'],
    type: 'commandWithoutValue',
    suggestion: 'Toggle bottom stroke',
    functionWithoutParam: () => impl.recordCommand('StrokeBottom', null),
  },
  {
    name: 'StrokeRight',
    alias: ['str', 'br'],
    type: 'commandWithoutValue',
    suggestion: 'Toggle right stroke',
    functionWithoutParam: () => impl.recordCommand('StrokeRight', null),
  },
  {
    name: 'StrokeTop',
    alias: ['stt', 'bt'],
    type: 'commandWithoutValue',
    suggestion: 'Toggle top stroke',
    functionWithoutParam: () => impl.recordCommand('StrokeTop', null),
  },
  {
    name: 'SelectionColorsSwapping',
    alias: ['scs', 'cs'],
    type: 'optionalValueCommand',
    valueFormat: 'string',
    suggestion: '?search colors in selection',
    functionWithoutParam: () => impl.recordCommand('SelectionColorsSwapping', null),
    functionWithParam: (value) => impl.recordCommand('SelectionColorsSwapping', value),
    bindingSupport: {
      styles: ['PAINT'],
      variables: ['COLOR'],
      libraryStyles: true,
      selectionColors: true,
    },
  },
  {
    name: 'InstanceProperty',
    alias: ['i', 'ip'],
    type: 'commandWithValue',
    valueFormat: 'string',
    suggestion: '?search instance properties',
    functionWithParam: (value) => impl.recordCommand('InstanceProperty', value),
    bindingSupport: {
      instanceProperties: true,
    },
  },
  {
    name: 'ResetInstanceOverrides',
    alias: ['rio'],
    type: 'commandWithValue',
    valueFormat: 'string',
    suggestion: '?select override to reset',
    functionWithParam: (value) => impl.recordCommand('ResetInstanceOverrides', value),
    bindingSupport: {
      instanceOverrides: true,
    },
  },
  {
    name: 'History',
    alias: ['z', 'hi'],
    type: 'commandWithoutValue',
    suggestion: 'Replay a recent command sequence',
    functionWithoutParam: () => figma.notify('Pick a recent sequence from the suggestions'),
  },
];
`;
}

function buildUtilsStubSource() {
  return `
import { COMMANDS } from 'virtual:commands-stub';

export const bindingSearches = [];

export function __reset() {
  bindingSearches.length = 0;
}

export const COMMAND_SPLITTER_REGEX = /\\s+|,\\s*(?=[a-zA-Z])/;
export const COMMAND_PART_REGEX = /^(-(?![\\d])|(-)?[\\p{L}]+(-[\\p{L}]+)*?)(?=\\s|[\\d+*/]|-[\\d]|-$|$|#|:|@)/u;
export const COMMAND_BREAK_PATTERN = /\\s{2,}/;
export const VALUE_FORMAT_REGEX = {
  number: /-?\\s*\\(?\\d+(?:\\.\\d+)?(?:\\s*[-+*/x]\\s*\\(?-?\\d+(?:\\.\\d+)?\\)?)*\\)?%?/,
  hex: /#[0-9a-fA-F]{0,6}/,
  string: /.+/,
};

function extractCommandPart(part) {
  const match = part.match(/^[A-Za-z]+/);
  return match ? match[0].toLowerCase() : '';
}

export function findCommand(part) {
  const commandPart = extractCommandPart(part);
  if (!commandPart) return [];

  const exactAlias = COMMANDS.find((command) =>
    command.alias.some((alias) => alias.toLowerCase() === commandPart)
  );
  if (exactAlias) return [exactAlias];

  const exactName = COMMANDS.find((command) => command.name.toLowerCase() === commandPart);
  if (exactName) return [exactName];

  const partialMatches = COMMANDS.filter((command) =>
    command.name.toLowerCase().startsWith(commandPart) ||
    command.alias.some((alias) => alias.toLowerCase().startsWith(commandPart))
  );
  return partialMatches;
}

export function getCommandSuggestions(
  commands,
  searchTerm = '',
  excludeCommand,
  includeSuggestion = false,
  previousCommands = {}
) {
  const lowerSearch = searchTerm.toLowerCase();
  return commands
    .filter((command) => !excludeCommand || command.name !== excludeCommand.name)
    .filter((command) => {
      if (!lowerSearch) return !excludeCommand;
      return (
        command.name.toLowerCase().includes(lowerSearch) ||
        command.alias.some((alias) => alias.toLowerCase().includes(lowerSearch))
      );
    })
    .map((command) => {
      const previousValue = previousCommands[command.name];
      let info = '';
      if (previousValue !== undefined) {
        info =
          command.type === 'commandWithoutValue'
            ? 'already set'
            : "already set to '" + previousValue + "'";
      } else if (includeSuggestion) {
        info = command.suggestion;
      }
      return command.alias.join(', ') + ' · ' + command.name + (info ? ' -- ' + info : '');
    });
}

export function extractValue(text, format) {
  if (format === 'number') {
    const candidate = text.includes(' ')
      ? text.slice(text.indexOf(' ') + 1).trim()
      : text.replace(/^[A-Za-z]+/, '').trim();
    const match = candidate.match(/[-+*/]?\\s*-?\\d+(?:\\.\\d+)?(?:,-?\\d+(?:\\.\\d+)?)*(?:%?)?$/);
    return match ? match[0].replace(/\\s+/g, '') : null;
  }

  if (format === 'hex') {
    const match = text.match(/#[0-9a-fA-F]{0,6}/);
    return match ? match[0] : null;
  }

  const value = text.includes(' ')
    ? text.slice(text.indexOf(' ') + 1).trim()
    : text.replace(/^[A-Za-z]+[?;]?/, '').trim();

  return value || null;
}

export function calculateExpression(expression) {
  const sanitized = expression.replace(/\\s+/g, '').replace(/x/gi, '*');
  return Function("return " + sanitized)().toString();
}

export function checkSpecialConditions() {
  return true;
}

export function isCommandAvailableForSelection(command, selection) {
  if (selection.length === 0) return true;

  const matchesSelectionCount =
    command.selectionCount === undefined || selection.length === command.selectionCount;
  const matchesSelectionPredicate =
    !command.selectionPredicate || command.selectionPredicate(selection);

  return matchesSelectionCount && matchesSelectionPredicate;
}

export async function searchStylesAndVariables(searchTerm, bindingSupport) {
  bindingSearches.push(searchTerm);

  if (!bindingSupport.selectionColors) {
    return [];
  }

  const delimiterIndex = searchTerm.indexOf(':');
  if (delimiterIndex === -1) {
    const normalized = searchTerm.trim().toLowerCase();
    if (!normalized) {
      return [{ name: 'Source Fill', data: 'Source Fill' }];
    }
    if (normalized.includes('old')) {
      return [{ name: 'Old Fill', data: 'Old Fill' }];
    }
    if (normalized.includes('source')) {
      return [{ name: 'Source Fill', data: 'Source Fill' }];
    }
    return [{ name: 'Fallback Source', data: 'Fallback Source' }];
  }

  const targetSearch = searchTerm.slice(delimiterIndex + 1).trim().toLowerCase();
  if (!targetSearch || targetSearch.includes('bl') || targetSearch.includes('targ')) {
    return [{ name: 'Target Blue', data: 'Target Blue' }];
  }

  return [];
}
`;
}

function buildHistoryStubSource() {
  return `
export let history = [];
export const recordedHistory = [];

export function __reset() {
  history = [];
  recordedHistory.length = 0;
}

export function __setHistory(next) {
  history = [...next];
}

export async function getHistory() {
  return history;
}

export async function recordHistory(sequence, getDedupKey = (value) => value.trim()) {
  recordedHistory.push({ sequence, key: getDedupKey(sequence) });

  const trimmed = sequence.trim();
  if (!trimmed) return;

  const newKey = getDedupKey(trimmed);
  history = [trimmed, ...history.filter((entry) => getDedupKey(entry) !== newKey)].slice(0, 10);
}
`;
}

function buildRecentValuesStubSource() {
  return `
export let recentValues = {};
export const recordedRecents = [];

export function __reset() {
  recentValues = {};
  recordedRecents.length = 0;
}

export function __setRecentValues(next) {
  recentValues = JSON.parse(JSON.stringify(next));
}

export async function getRecentValues(commandName) {
  return recentValues[commandName] || [];
}

export async function recordRecentValue(commandName, value) {
  recordedRecents.push({ commandName, value });

  const trimmed = value.trim();
  if (!trimmed) return;

  const existing = recentValues[commandName] || [];
  recentValues[commandName] = [trimmed, ...existing.filter((entry) => entry !== trimmed)].slice(0, 5);
}
`;
}

function buildImplementationStubSource() {
  return `
export const executionCalls = [];
export const helperCalls = [];

export function __reset() {
  executionCalls.length = 0;
  helperCalls.length = 0;
}

export function recordCommand(name, value) {
  executionCalls.push({ name, value });
}

export function recordPadding(value) {
  executionCalls.push({
    name: 'Padding',
    value,
    selection: figma.currentPage.selection.map((node) => node.id),
  });
}

export function selectParent() {
  const parents = [];
  const seen = new Set();

  for (const node of figma.currentPage.selection) {
    const parent = node.parent;
    if (!parent || parent.type === 'PAGE' || seen.has(parent.id)) continue;
    seen.add(parent.id);
    parents.push(parent);
  }

  figma.currentPage.selection = parents;
}

export function selectChildren() {
  const children = [];
  const seen = new Set();

  for (const node of figma.currentPage.selection) {
    if (!('children' in node)) continue;

    for (const child of node.children) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      children.push(child);
    }
  }

  figma.currentPage.selection = children;
}

export async function searchInstanceProperties(searchTerm) {
  helperCalls.push({ name: 'searchInstanceProperties', searchTerm });
  if (searchTerm.includes(',')) {
    return [];
  }
  if (!searchTerm) {
    return [{ name: 'Name:Primary', data: 'Name:Primary' }];
  }
  return [];
}

export async function searchComponentsForSwap(searchTerm) {
  helperCalls.push({ name: 'searchComponentsForSwap', searchTerm });
  return [];
}

export async function searchInstanceOverrides(searchTerm) {
  helperCalls.push({ name: 'searchInstanceOverrides', searchTerm });
  return [];
}

export async function getStoredLibraries() {
  return {};
}

export async function getActiveLibraries() {
  return [];
}
`;
}

function buildLibraryStubSource() {
  return `
export async function searchLibraries() {
  return [];
}
`;
}

async function loadIndexHarness(figma) {
  globalThis.figma = figma;

  const entrySource = `
import './src/index.ts';
import * as utilsStub from 'virtual:utils-stub';
import * as historyStub from 'virtual:history-stub';
import * as recentStub from 'virtual:recent-values-stub';
import * as implStub from 'virtual:impl-stub';

export { utilsStub, historyStub, recentStub, implStub };
`;

  const result = await build({
    stdin: {
      contents: entrySource,
      resolveDir: REPO_ROOT,
      sourcefile: 'tests/generated-index-runtime-entry.js',
    },
    bundle: true,
    format: 'cjs',
    platform: 'node',
    write: false,
    plugins: [
      {
        name: 'mock-index-runtime-dependencies',
        setup(buildContext) {
          buildContext.onResolve({ filter: /^virtual:commands-stub$/ }, () => ({ path: 'commands-stub', namespace: 'stub' }));
          buildContext.onResolve({ filter: /^virtual:utils-stub$/ }, () => ({ path: 'utils-stub', namespace: 'stub' }));
          buildContext.onResolve({ filter: /^virtual:history-stub$/ }, () => ({ path: 'history-stub', namespace: 'stub' }));
          buildContext.onResolve({ filter: /^virtual:recent-values-stub$/ }, () => ({ path: 'recent-values-stub', namespace: 'stub' }));
          buildContext.onResolve({ filter: /^virtual:impl-stub$/ }, () => ({ path: 'impl-stub', namespace: 'stub' }));
          buildContext.onResolve({ filter: /^virtual:library-stub$/ }, () => ({ path: 'library-stub', namespace: 'stub' }));

          buildContext.onResolve({ filter: /^\.\/commands$/ }, () => ({ path: 'commands-stub', namespace: 'stub' }));
          buildContext.onResolve({ filter: /^\.\/utils$/ }, () => ({ path: 'utils-stub', namespace: 'stub' }));
          buildContext.onResolve({ filter: /^\.\/history$/ }, () => ({ path: 'history-stub', namespace: 'stub' }));
          buildContext.onResolve({ filter: /^\.\/recent-values$/ }, () => ({ path: 'recent-values-stub', namespace: 'stub' }));
          buildContext.onResolve({ filter: /^\.\/implementations$/ }, () => ({ path: 'impl-stub', namespace: 'stub' }));
          buildContext.onResolve({ filter: /^\.\/implementations\/library$/ }, () => ({ path: 'library-stub', namespace: 'stub' }));

          buildContext.onLoad({ filter: /^commands-stub$/, namespace: 'stub' }, () => ({
            contents: buildCommandsStubSource(),
            loader: 'js',
          }));
          buildContext.onLoad({ filter: /^utils-stub$/, namespace: 'stub' }, () => ({
            contents: buildUtilsStubSource(),
            loader: 'js',
          }));
          buildContext.onLoad({ filter: /^history-stub$/, namespace: 'stub' }, () => ({
            contents: buildHistoryStubSource(),
            loader: 'js',
          }));
          buildContext.onLoad({ filter: /^recent-values-stub$/, namespace: 'stub' }, () => ({
            contents: buildRecentValuesStubSource(),
            loader: 'js',
          }));
          buildContext.onLoad({ filter: /^impl-stub$/, namespace: 'stub' }, () => ({
            contents: buildImplementationStubSource(),
            loader: 'js',
          }));
          buildContext.onLoad({ filter: /^library-stub$/, namespace: 'stub' }, () => ({
            contents: buildLibraryStubSource(),
            loader: 'js',
          }));
        },
      },
    ],
  });

  const filename = path.join(REPO_ROOT, '.tmp-index-runtime.cjs');
  const runtimeModule = new Module(filename);
  runtimeModule.filename = filename;
  runtimeModule.paths = Module._nodeModulePaths(REPO_ROOT);
  runtimeModule._compile(result.outputFiles[0].text, filename);
  return runtimeModule.exports;
}

function resetHarness(runtime, harness) {
  runtime.reset();
  harness.utilsStub.__reset();
  harness.historyStub.__reset();
  harness.recentStub.__reset();
  harness.implStub.__reset();
}

async function main() {
  const runtime = createRuntimeFigmaStub();
  const harness = await loadIndexHarness(runtime.figma);

  resetHarness(runtime, harness);
  harness.historyStub.__setHistory(['w100', 'cs;old : targ']);

  const pristineSuggestions = await runtime.input('');
  assert.deepEqual(
    pristineSuggestions.slice(0, 2).map((item) => item.data),
    ['w100', 'cs;old : targ'],
    'empty input should prepend recent history entries before command suggestions'
  );
  assert.match(
    pristineSuggestions[0].name,
    /^↻ Width:100$/,
    'history suggestions should be summarized for display'
  );

  resetHarness(runtime, harness);
  harness.historyStub.__setHistory(['bb br StrokeTop']);

  const aliasHistorySuggestions = await runtime.input('');
  assert.equal(
    aliasHistorySuggestions[0].name,
    '↻ StrokeBottom | StrokeRight | StrokeTop',
    'history suggestions should expand stored aliases to full command names for display'
  );

  const historySuggestions = await runtime.input('hi');
  assert.deepEqual(
    historySuggestions.map((item) => item.data),
    ['bb br StrokeTop'],
    'History command should show replayable recent sequences'
  );

  resetHarness(runtime, harness);
  harness.historyStub.__setHistory(['bb | br | StrokeTop']);

  const legacyHistorySuggestions = await runtime.input('hi');
  assert.deepEqual(
    legacyHistorySuggestions,
    [{
      name: 'StrokeBottom | StrokeRight | StrokeTop',
      data: 'StrokeBottom StrokeRight StrokeTop',
    }],
    'legacy pipe-separated history rows should display and replay as full command names'
  );

  await runtime.run('StrokeBottom StrokeRight StrokeTop');

  assert.deepEqual(
    harness.implStub.executionCalls,
    [
      { name: 'StrokeBottom', value: null },
      { name: 'StrokeRight', value: null },
      { name: 'StrokeTop', value: null },
    ],
    'legacy pipe-separated history rows should still replay after normalization'
  );

  resetHarness(runtime, harness);
  harness.historyStub.__setHistory(['cs;old : targ']);

  await runtime.input('hi');
  await runtime.run('cs;old : targ');

  assert.deepEqual(
    harness.implStub.executionCalls,
    [{ name: 'SelectionColorsSwapping', value: 'Old Fill : Target Blue' }],
    'history replay should clear dropdown params so bindings auto-resolve from the stored command'
  );
  assert.deepEqual(
    harness.utilsStub.bindingSearches,
    ['old', 'old : targ'],
    'history replay should resolve two-stage bindings from the stored source and target search terms'
  );

  resetHarness(runtime, harness);

  await runtime.input('w100  cs;old : bl');
  harness.utilsStub.__reset();
  await runtime.run('Target Blue');

  assert.deepEqual(
    harness.implStub.executionCalls,
    [
      { name: 'Width', value: '100' },
      { name: 'SelectionColorsSwapping', value: 'old : Target Blue' },
    ],
    'simple commands should execute before bindings, and dropdown target picks should preserve the typed source'
  );
  assert.deepEqual(
    harness.utilsStub.bindingSearches,
    [],
    'choosing a target from the dropdown should skip auto-resolution when the source is already present'
  );

  resetHarness(runtime, harness);

  const page = { id: 'page', type: 'PAGE' };
  const parent = { id: 'parent', type: 'FRAME', parent: page, children: [] };
  const child = { id: 'child', type: 'FRAME', parent };
  parent.children = [child];

  runtime.figma.currentPage.selection = [child];
  await runtime.input('p24 sp p32');
  await runtime.run();

  assert.deepEqual(
    harness.implStub.executionCalls,
    [
      { name: 'Padding', value: '24', selection: ['child'] },
      { name: 'Padding', value: '32', selection: ['parent'] },
    ],
    'selection transforms should update the active selection before later commands in the same chain'
  );

  resetHarness(runtime, harness);

  runtime.figma.currentPage.selection = [parent];
  await runtime.input('sc p24 sp p32');
  await runtime.run();

  assert.deepEqual(
    harness.implStub.executionCalls,
    [
      { name: 'Padding', value: '24', selection: ['child'] },
      { name: 'Padding', value: '32', selection: ['parent'] },
    ],
    'child and parent traversal commands should compose sequentially inside a single chain'
  );

  resetHarness(runtime, harness);

  await runtime.input('cs;:bl');
  harness.utilsStub.__reset();
  await runtime.run('Target Blue');

  assert.deepEqual(
    harness.implStub.executionCalls,
    [{ name: 'SelectionColorsSwapping', value: 'Source Fill : Target Blue' }],
    'an empty two-stage source should auto-fill from the first selection-color suggestion'
  );
  assert.deepEqual(
    harness.utilsStub.bindingSearches,
    [''],
    'empty-source dropdown resolution should only fetch stage-one suggestions once'
  );

  resetHarness(runtime, harness);

  await runtime.input('ip;size:lg, state:active');
  await runtime.run();

  assert.deepEqual(
    harness.implStub.executionCalls,
    [{ name: 'InstanceProperty', value: 'size:lg, state:active' }],
    'instance property bindings should execute with the typed comma-separated value when no exact suggestion is chosen'
  );
  assert.deepEqual(
    harness.recentStub.recordedRecents,
    [
      { commandName: 'InstanceProperty', value: 'size:lg' },
      { commandName: 'InstanceProperty', value: 'state:active' },
    ],
    'instance-property chains should record each pair separately in recent values'
  );

  resetHarness(runtime, harness);

  const heightOverrideRef = JSON.stringify({
    nodeId: '100094:76668',
    field: 'height',
    nodeName: 'Button/Light Icon Button',
  });
  const propertyOverrideRef = JSON.stringify({
    nodeId: '99656:321804;80899:342414',
    field: 'componentProperties',
    nodeName: 'Tabler icons',
    componentPropertyName: 'Icon',
  });
  harness.recentStub.__setRecentValues({
    ResetInstanceOverrides: [heightOverrideRef, propertyOverrideRef],
  });

  const overrideRecentSuggestions = await runtime.input('rio?');
  assert.deepEqual(
    overrideRecentSuggestions,
    [
      {
        name: 'Button/Light Icon Button -> Height (recent)',
        data: heightOverrideRef,
      },
      {
        name: 'Tabler icons -> Property: Icon (recent)',
        data: propertyOverrideRef,
      },
    ],
    'instance override recents should display human-readable labels while keeping JSON data'
  );

  resetHarness(runtime, harness);

  await runtime.input('Width:100');
  await runtime.run();

  assert.deepEqual(
    harness.implStub.executionCalls,
    [{ name: 'Width', value: '100' }],
    'summary-form command strings should normalize back to alias/value form before extraction'
  );

  console.log('index-runtime tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
