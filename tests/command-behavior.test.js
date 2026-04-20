import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { build } from 'esbuild';
import { Module } from 'node:module';
import path from 'node:path';
import expectedDigests from './command-behavior.snapshot.json';

const REPO_ROOT = process.cwd();
const SOURCE_PATH = path.join(REPO_ROOT, 'src/commands.ts');
const SAMPLE_VALUES = {
  number: '42',
  hex: '#abcdef',
  string: 'sample',
};

function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function buildImplementationStubSource(source) {
  const implementationNames = [...new Set([...source.matchAll(/impl\.(\w+)/g)].map((match) => match[1]))].sort();

  return `
export const calls = [];
export let librarySuggestions = [];

export function __reset() {
  calls.length = 0;
  librarySuggestions = [];
}

export function __setLibrarySuggestions(next) {
  librarySuggestions = next;
}

${implementationNames.map((name) => `export function ${name}(...args) {
  calls.push({ kind: 'impl', name: '${name}', args });
  return '${name}' === 'getLibrarySuggestions' ? librarySuggestions : undefined;
}`).join('\n\n')}
`;
}

function buildUtilsStubSource() {
  return `
export const notifications = [];

export function __resetNotifications() {
  notifications.length = 0;
}

export function notify(message, options) {
  notifications.push({ kind: 'notify', message, options: options ?? null });
  return { cancel() {} };
}

export function parseNumberList(value) {
  return value.split(',').map((part) => part.trim()).filter(Boolean);
}
`;
}

async function loadCommandHarness() {
  const source = fs.readFileSync(SOURCE_PATH, 'utf8');
  const implStubSource = buildImplementationStubSource(source);
  const utilsStubSource = buildUtilsStubSource();
  const entrySource = `
import { COMMANDS } from './src/commands.ts';
import * as implStub from 'virtual:impl-stub';
import * as utilsStub from 'virtual:utils-stub';

export { COMMANDS, implStub, utilsStub };
`;

  const result = await build({
    stdin: {
      contents: entrySource,
      resolveDir: REPO_ROOT,
      sourcefile: 'tests/generated-command-behavior-entry.js',
    },
    bundle: true,
    format: 'cjs',
    platform: 'node',
    write: false,
    plugins: [
      {
        name: 'mock-command-dependencies',
        setup(buildContext) {
          buildContext.onResolve({ filter: /^virtual:impl-stub$/ }, () => ({ path: 'impl-stub', namespace: 'stub' }));
          buildContext.onResolve({ filter: /^virtual:utils-stub$/ }, () => ({ path: 'utils-stub', namespace: 'stub' }));
          buildContext.onResolve({ filter: /^\.\/implementations$/ }, () => ({ path: 'impl-stub', namespace: 'stub' }));
          buildContext.onResolve({ filter: /^\.\/utils$/ }, () => ({ path: 'utils-stub', namespace: 'stub' }));
          buildContext.onLoad({ filter: /^impl-stub$/, namespace: 'stub' }, () => ({
            contents: implStubSource,
            loader: 'js',
          }));
          buildContext.onLoad({ filter: /^utils-stub$/, namespace: 'stub' }, () => ({
            contents: utilsStubSource,
            loader: 'js',
          }));
        },
      },
    ],
  });

  const filename = path.join(REPO_ROOT, '.tmp-command-behavior.cjs');
  const runtimeModule = new Module(filename);
  runtimeModule.filename = filename;
  runtimeModule.paths = Module._nodeModulePaths(REPO_ROOT);
  runtimeModule._compile(result.outputFiles[0].text, filename);

  return runtimeModule.exports;
}

function getSampleValue(command) {
  return SAMPLE_VALUES[command.valueFormat];
}

function captureEffects(implStub, utilsStub) {
  return [...implStub.calls, ...utilsStub.notifications];
}

function resetEffects(implStub, utilsStub, librarySuggestions = []) {
  implStub.__reset();
  utilsStub.__resetNotifications();
  implStub.__setLibrarySuggestions(librarySuggestions);
}

async function invokeCommand(commandMap, implStub, utilsStub, commandName, mode, value, librarySuggestions = []) {
  const command = commandMap.get(commandName);
  assert.ok(command, `Unknown command in test: ${commandName}`);

  resetEffects(implStub, utilsStub, librarySuggestions);

  if (mode === 'with') {
    await command.functionWithParam(value);
  } else {
    await command.functionWithoutParam();
  }

  return captureEffects(implStub, utilsStub);
}

async function buildRepresentativeEffects(commands, implStub, utilsStub) {
  const effects = {};

  for (const command of commands) {
    effects[command.name] = {};

    if (command.type !== 'commandWithoutValue') {
      resetEffects(implStub, utilsStub);
      await command.functionWithParam(getSampleValue(command));
      effects[command.name].with = captureEffects(implStub, utilsStub);
    }

    if (command.type !== 'commandWithValue') {
      resetEffects(implStub, utilsStub);
      await command.functionWithoutParam();
      effects[command.name].without = captureEffects(implStub, utilsStub);
    }
  }

  return effects;
}

function digestEffectMap(effectMap) {
  return Object.fromEntries(
    Object.entries(effectMap).map(([commandName, modes]) => [
      commandName,
      Object.fromEntries(
        Object.entries(modes).map(([mode, effects]) => [mode, sha256(effects)])
      ),
    ])
  );
}

async function main() {
  const { COMMANDS, implStub, utilsStub } = await loadCommandHarness();
  const commandMap = new Map(COMMANDS.map((command) => [command.name, command]));

  const representativeEffects = await buildRepresentativeEffects(COMMANDS, implStub, utilsStub);
  const actualDigests = digestEffectMap(representativeEffects);

  assert.deepEqual(
    Object.keys(actualDigests).sort(),
    Object.keys(expectedDigests).sort(),
    'The command behavior snapshot must cover every command.'
  );

  for (const [commandName, expectedModes] of Object.entries(expectedDigests)) {
    assert.deepEqual(
      actualDigests[commandName],
      expectedModes,
      `${commandName} representative behavior changed.\nActual effects:\n${JSON.stringify(representativeEffects[commandName], null, 2)}`
    );
  }

  const paddingCases = [
    ['20', { paddingTop: '20', paddingRight: '20', paddingBottom: '20', paddingLeft: '20' }],
    ['20,30', { paddingTop: '20', paddingRight: '30', paddingBottom: '20', paddingLeft: '30' }],
    ['20,30,40', { paddingTop: '20', paddingRight: '30', paddingBottom: '40', paddingLeft: '30' }],
    ['20,30,40,50', { paddingTop: '20', paddingRight: '30', paddingBottom: '40', paddingLeft: '50' }],
  ];

  for (const [value, expectedPadding] of paddingCases) {
    assert.deepEqual(
      await invokeCommand(commandMap, implStub, utilsStub, 'Padding', 'with', value),
      [{ kind: 'impl', name: 'setPadding', args: [expectedPadding] }],
      `Padding should expand "${value}" using CSS-style shorthand rules.`
    );
  }

  const radiusCases = [
    ['10', { topLeftRadius: '10', topRightRadius: '10', bottomRightRadius: '10', bottomLeftRadius: '10' }],
    ['10,20', { topLeftRadius: '10', topRightRadius: '20', bottomRightRadius: '10', bottomLeftRadius: '20' }],
    ['10,20,30', { topLeftRadius: '10', topRightRadius: '20', bottomRightRadius: '30', bottomLeftRadius: '20' }],
    ['10,20,30,40', { topLeftRadius: '10', topRightRadius: '20', bottomRightRadius: '30', bottomLeftRadius: '40' }],
  ];

  for (const [value, expectedRadius] of radiusCases) {
    assert.deepEqual(
      await invokeCommand(commandMap, implStub, utilsStub, 'RadiusAll', 'with', value),
      [{ kind: 'impl', name: 'setRadius', args: [expectedRadius] }],
      `RadiusAll should expand "${value}" using CSS-style shorthand rules.`
    );
  }

  const alignCommands = [
    ['AlignTopLeft', 'TOP_LEFT'],
    ['AlignTopCenter', 'TOP_CENTER'],
    ['AlignTopRight', 'TOP_RIGHT'],
    ['AlignCenterLeft', 'CENTER_LEFT'],
    ['AlignCenterCenter', 'CENTER'],
    ['AlignCenterRight', 'CENTER_RIGHT'],
    ['AlignBottomLeft', 'BOTTOM_LEFT'],
    ['AlignBottomCenter', 'BOTTOM_CENTER'],
    ['AlignBottomRight', 'BOTTOM_RIGHT'],
  ];

  for (const [commandName, anchor] of alignCommands) {
    assert.deepEqual(
      await invokeCommand(commandMap, implStub, utilsStub, commandName, 'with', 'parent'),
      [{ kind: 'impl', name: 'smartAlign', args: [anchor, 'PARENT'] }],
      `${commandName} should switch to parent alignment when the value starts with "p".`
    );

    assert.deepEqual(
      await invokeCommand(commandMap, implStub, utilsStub, commandName, 'with', 'auto'),
      [{ kind: 'impl', name: 'smartAlign', args: [anchor, 'AUTO'] }],
      `${commandName} should keep auto alignment for non-parent values.`
    );
  }

  assert.deepEqual(
    await invokeCommand(commandMap, implStub, utilsStub, 'ToggleLibrary', 'without', undefined, ['Core', 'UIKit']),
    [
      { kind: 'impl', name: 'getLibrarySuggestions', args: [] },
      { kind: 'notify', message: '📚 Available Libraries: \nCore\nUIKit\n\nUse: tlib ? to search', options: null },
    ],
    'ToggleLibrary should surface the available libraries when suggestions exist.'
  );

  assert.deepEqual(
    await invokeCommand(commandMap, implStub, utilsStub, 'Font', 'without'),
    [],
    'Font intentionally has no no-value action and should remain a no-op.'
  );

  console.log(`command-behavior tests passed (${COMMANDS.length} commands)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
