import assert from 'node:assert/strict';

function createFigmaStub() {
  return {
    mixed: Symbol('figma.mixed'),
    currentPage: { selection: [] },
    root: {
      name: 'Test Library',
      children: [],
      findOne() {
        return null;
      },
    },
    parameters: {
      on() {},
      off() {},
    },
    clientStorage: {
      async getAsync() {
        return null;
      },
      async setAsync() {},
    },
    teamLibrary: {
      async getAvailableLibraryVariableCollectionsAsync() {
        return [];
      },
      async getVariablesInLibraryCollectionAsync() {
        return [];
      },
    },
    variables: {
      async getVariableByIdAsync() {
        return null;
      },
      async importVariableByKeyAsync() {
        return null;
      },
      async getLocalVariablesAsync() {
        return [];
      },
      async getLocalVariableCollectionsAsync() {
        return [];
      },
      async getVariableCollectionByIdAsync() {
        return null;
      },
      setBoundVariableForPaint(paint) {
        return paint;
      },
    },
    notify() {
      return { cancel() {} };
    },
    on() {},
    closePlugin() {},
  };
}

function assertLookupByAlias(findCommand, command) {
  assert.equal(findCommand(command.name)[0]?.name, command.name, `${command.name} should resolve by name`);

  for (const alias of command.alias) {
    assert.equal(findCommand(alias)[0]?.name, command.name, `${command.name} should resolve alias "${alias}"`);
  }
}

function assertSuggestionCoverage(getCommandSuggestions, commands, command) {
  const suggestions = getCommandSuggestions(commands, command.alias[0], undefined, false, {});
  assert.ok(
    suggestions.some((suggestion) => suggestion.includes(`· ${command.name}`)),
    `${command.name} should appear in suggestions for "${command.alias[0]}"`
  );
}

function assertValueParsing(extractValue, command) {
  if (command.type === 'commandWithoutValue') {
    return;
  }

  const alias = command.alias[0];

  if (command.valueFormat === 'number') {
    assert.equal(extractValue(`${alias} 12`, 'number'), '12', `${command.name} should extract numeric values`);
    return;
  }

  if (command.valueFormat === 'hex') {
    assert.equal(extractValue(`${alias} #abcdef`, 'hex'), '#abcdef', `${command.name} should extract hex values`);
  }
}

async function main() {
  globalThis.figma = createFigmaStub();

  const [{ COMMANDS, COMMAND_DEFINITIONS }, { findCommand, getCommandSuggestions, extractValue }] = await Promise.all([
    import('../src/commands.ts'),
    import('../src/utils.ts'),
  ]);

  assert.equal(
    COMMANDS.length,
    Object.keys(COMMAND_DEFINITIONS).length,
    'COMMANDS should include every definition exactly once'
  );

  assert.equal(
    new Set(COMMANDS.map((command) => command.name)).size,
    COMMANDS.length,
    'command names should be unique'
  );

  const aliasOwners = new Map();
  const validSpecialConditions = new Set([
    'IsAutoLayout',
    'IsInAutoLayout',
    'IsAbsoluteInAutoLayout',
    'IsAutoLayoutWrap',
    'IsGridLayout',
    'HasInferredAutoLayout',
    'HasInferredAutoLayoutWrap',
    'TextStyleApplied',
    'NoTextStyleApplied',
    'IsNotInAutoLayout',
    'HasParent',
    'HasLayoutGrid',
    'HasRowsOrColumnsLayoutGrid',
  ]);

  for (const command of COMMANDS) {
    assert.ok(command.name.length > 0, 'commands should have a name');
    assert.ok(command.suggestion.length > 0, `${command.name} should have a suggestion`);
    assert.ok(command.alias.length > 0, `${command.name} should have at least one alias`);
    assert.equal(new Set(command.alias).size, command.alias.length, `${command.name} aliases should be unique`);

    for (const alias of command.alias) {
      const lowerAlias = alias.toLowerCase();
      assert.equal(aliasOwners.get(lowerAlias), undefined, `duplicate alias detected: ${alias}`);
      aliasOwners.set(lowerAlias, command.name);
    }

    if (command.supportedNodes) {
      assert.ok(command.supportedNodes.length > 0, `${command.name} supportedNodes should not be empty`);
      assert.equal(
        new Set(command.supportedNodes).size,
        command.supportedNodes.length,
        `${command.name} supportedNodes should not repeat`
      );
    }

    if (command.specialConditions) {
      assert.ok(command.specialConditions.length > 0, `${command.name} specialConditions should not be empty`);
      for (const condition of command.specialConditions) {
        assert.ok(validSpecialConditions.has(condition), `${command.name} uses unknown special condition ${condition}`);
      }
    }

    if (command.bindingSupport) {
      assert.ok(
        Object.values(command.bindingSupport).some(Boolean),
        `${command.name} bindingSupport should enable at least one capability`
      );
    }

    if (command.type === 'commandWithoutValue') {
      assert.equal(typeof command.functionWithoutParam, 'function', `${command.name} should expose functionWithoutParam`);
    } else if (command.type === 'commandWithValue') {
      assert.equal(typeof command.functionWithParam, 'function', `${command.name} should expose functionWithParam`);
      assert.ok(command.valueFormat, `${command.name} should declare a valueFormat`);
    } else {
      assert.equal(typeof command.functionWithParam, 'function', `${command.name} should expose functionWithParam`);
      assert.equal(typeof command.functionWithoutParam, 'function', `${command.name} should expose functionWithoutParam`);
      assert.ok(command.valueFormat, `${command.name} should declare a valueFormat`);
    }

    assertLookupByAlias(findCommand, command);
    assertSuggestionCoverage(getCommandSuggestions, COMMANDS, command);
    assertValueParsing(extractValue, command);
  }

  const topLevelSuggestions = getCommandSuggestions(COMMANDS, '', undefined, true, {});
  assert.equal(
    topLevelSuggestions.length,
    COMMANDS.length,
    'top-level suggestions should include every command when nothing is typed'
  );

  const commandByName = new Map(COMMANDS.map((command) => [command.name, command]));
  for (const commandName of [
    'Gap',
    'VerticalGap',
    'Padding',
    'PaddingHorizontal',
    'PaddingVertical',
    'PaddingLeft',
    'PaddingTop',
    'PaddingRight',
    'PaddingBottom',
    'Opacity',
    'MaxHeight',
    'MaxWidth',
    'MinHeight',
    'MinWidth',
  ]) {
    const command = commandByName.get(commandName);
    assert.ok(command?.bindingSupport?.variables?.includes('FLOAT'), `${commandName} should expose FLOAT variable binding`);
  }

  assert.deepEqual(
    commandByName.get('VerticalGap')?.specialConditions,
    ['IsAutoLayoutWrap'],
    'VerticalGap should only be available on wrap auto-layouts'
  );

  assert.deepEqual(
    commandByName.get('GridColumnGap')?.specialConditions,
    ['IsGridLayout'],
    'GridColumnGap should only be available on grid layouts'
  );

  assert.deepEqual(
    commandByName.get('GridRowGap')?.specialConditions,
    ['IsGridLayout'],
    'GridRowGap should only be available on grid layouts'
  );

  assert.equal(
    typeof commandByName.get('TidyGap')?.selectionPredicate,
    'function',
    'TidyGap should validate multi-selection tidy scenarios via selectionPredicate'
  );

  assert.equal(
    typeof commandByName.get('TidyRowGap')?.selectionPredicate,
    'function',
    'TidyRowGap should validate multi-selection tidy scenarios via selectionPredicate'
  );

  assert.deepEqual(
    commandByName.get('LayoutGridGutter')?.specialConditions,
    ['HasRowsOrColumnsLayoutGrid'],
    'LayoutGridGutter should require an existing row/column grid'
  );

  assert.deepEqual(
    commandByName.get('LayoutGridMargin')?.specialConditions,
    ['HasRowsOrColumnsLayoutGrid'],
    'LayoutGridMargin should require an existing row/column grid'
  );

  assert.deepEqual(
    commandByName.get('LayoutGridRemove')?.specialConditions,
    ['HasLayoutGrid'],
    'LayoutGridRemove should require an existing layout grid'
  );

  console.log(`command-registry tests passed (${COMMANDS.length} commands)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
