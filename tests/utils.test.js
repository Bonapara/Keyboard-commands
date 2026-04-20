import assert from 'node:assert/strict';
import { createFigmaStub } from './helpers/figma-stub.js';

async function main() {
  const { figma } = createFigmaStub();
  globalThis.figma = figma;

  const [{ COMMANDS }, utils] = await Promise.all([
    import('../src/commands.ts'),
    import('../src/utils.ts'),
  ]);

  const {
    calculateExpression,
    parseDelta,
    applyDelta,
    resolveDelta,
    parseNumberList,
    extractValue,
    checkSpecialConditions,
    findCommand,
    getCommandSuggestions,
  } = utils;

  assert.equal(calculateExpression('1 + 2 x 3'), '7');
  assert.equal(calculateExpression('50%'), '50%');
  assert.throws(() => calculateExpression('1++2'), /Invalid calculation format/);

  assert.deepEqual(parseDelta('+10'), { op: '+', amount: 10 });
  assert.deepEqual(parseDelta('/2'), { op: '/', amount: 2 });
  assert.equal(parseDelta('10'), null);
  assert.equal(applyDelta(12, { op: '*', amount: 3 }), 36);
  assert.equal(resolveDelta('+8', 12), 20);
  assert.equal(resolveDelta('42', 12), 42);

  assert.deepEqual(parseNumberList('20, 30, , 40'), ['20', '30', '40']);
  assert.deepEqual(parseNumberList('12'), ['12']);

  assert.equal(extractValue('w+10', 'number'), '+10');
  assert.equal(extractValue('p20,30', 'number'), '20,30');
  assert.equal(extractValue('w 1 + 2 x 3', 'number'), '7');
  assert.equal(extractValue('bc Source : Target', 'string'), 'Source : Target');
  assert.equal(extractValue('rio Button -> Fill', 'string'), 'Button -> Fill');
  assert.equal(extractValue('ip State:Active', 'string'), 'State:Active');
  assert.equal(extractValue('f Blue (Library)', 'string'), 'Blue (Library)');
  assert.equal(extractValue('f #abcdef', 'hex'), '#abcdef');

  assert.equal(checkSpecialConditions({ layoutMode: 'HORIZONTAL' }, ['IsAutoLayout']), true);
  assert.equal(checkSpecialConditions({ parent: { layoutMode: 'HORIZONTAL' } }, ['IsInAutoLayout']), true);
  assert.equal(
    checkSpecialConditions(
      { parent: { layoutMode: 'VERTICAL' }, layoutPositioning: 'ABSOLUTE' },
      ['IsAbsoluteInAutoLayout']
    ),
    true
  );
  assert.equal(
    checkSpecialConditions({ type: 'TEXT', textStyleId: 'S:1' }, ['TextStyleApplied']),
    true
  );
  assert.equal(
    checkSpecialConditions({ type: 'TEXT', textStyleId: '' }, ['NoTextStyleApplied']),
    true
  );
  assert.equal(
    checkSpecialConditions({ parent: { layoutMode: 'NONE' } }, ['IsNotInAutoLayout']),
    true
  );
  assert.equal(
    checkSpecialConditions({ layoutMode: 'VERTICAL', layoutWrap: 'WRAP' }, ['IsAutoLayoutWrap']),
    true
  );
  assert.equal(
    checkSpecialConditions({ type: 'FRAME', inferredAutoLayout: { layoutMode: 'HORIZONTAL', layoutWrap: 'NO_WRAP' } }, ['HasInferredAutoLayout']),
    true
  );
  assert.equal(
    checkSpecialConditions({ type: 'FRAME', inferredAutoLayout: { layoutMode: 'HORIZONTAL', layoutWrap: 'WRAP' } }, ['HasInferredAutoLayoutWrap']),
    true
  );
  assert.equal(
    checkSpecialConditions({ parent: { layoutMode: 'NONE' } }, ['IsInAutoLayout', 'IsNotInAutoLayout']),
    true
  );
  assert.equal(
    checkSpecialConditions({ parent: { type: 'PAGE' } }, ['HasParent']),
    true
  );
  assert.equal(
    checkSpecialConditions(
      { layoutGrids: [{ pattern: 'GRID', visible: true, sectionSize: 8 }] },
      ['HasLayoutGrid']
    ),
    true
  );
  assert.equal(
    checkSpecialConditions(
      { layoutGrids: [{ pattern: 'COLUMNS', visible: true, alignment: 'STRETCH', count: 12, gutterSize: 20, offset: 0 }] },
      ['HasRowsOrColumnsLayoutGrid']
    ),
    true
  );
  assert.equal(checkSpecialConditions({ type: 'RECTANGLE' }, ['TextStyleApplied']), false);

  figma.currentPage.selection = [];
  assert.equal(findCommand('width')[0]?.name, 'Width');
  assert.equal(findCommand('hf')[0]?.name, 'HorizontalFill');
  assert.equal(findCommand('sp')[0]?.name, 'SelectParent');
  assert.equal(findCommand('sc')[0]?.name, 'SelectChildren');

  figma.currentPage.selection = [{ type: 'RECTANGLE' }];
  assert.equal(
    findCommand('fs').some((command) => command.name === 'FontSize'),
    false
  );

  figma.currentPage.selection = [{ type: 'TEXT', textStyleId: '' }];
  assert.equal(findCommand('fs')[0]?.name, 'FontSize');
  assert.equal(findCommand('swp').length, 0);

  figma.currentPage.selection = [
    { type: 'RECTANGLE', parent: { layoutMode: 'NONE' } },
    { type: 'RECTANGLE', parent: { layoutMode: 'NONE' } },
  ];
  assert.equal(findCommand('swp')[0]?.name, 'SwapPosition');

  figma.currentPage.selection = [
    { type: 'FRAME', parent: { type: 'PAGE' } },
    { type: 'FRAME', parent: { type: 'PAGE' } },
  ];
  assert.equal(findCommand('swp')[0]?.name, 'SwapPosition');

  figma.currentPage.selection = [{ type: 'FRAME', layoutMode: 'GRID' }];
  assert.equal(findCommand('g').some((command) => command.name === 'Gap'), false);
  assert.equal(findCommand('cg')[0]?.name, 'GridColumnGap');
  assert.equal(findCommand('vg').some((command) => command.name === 'VerticalGap'), false);
  assert.equal(findCommand('rg')[0]?.name, 'GridRowGap');

  const tidyParent = { type: 'PAGE' };
  figma.currentPage.selection = [
    { type: 'FRAME', x: 0, y: 0, width: 100, height: 100, parent: tidyParent },
    { type: 'FRAME', x: 140, y: 0, width: 100, height: 100, parent: tidyParent },
  ];
  assert.equal(findCommand('tg')[0]?.name, 'TidyGap');

  figma.currentPage.selection = [
    { type: 'FRAME', x: 0, y: 0, width: 100, height: 100, parent: tidyParent },
    { type: 'FRAME', x: 140, y: 0, width: 100, height: 100, parent: tidyParent },
    { type: 'FRAME', x: 0, y: 464, width: 100, height: 100, parent: tidyParent },
  ];
  assert.equal(findCommand('trg')[0]?.name, 'TidyRowGap');

  figma.currentPage.selection = [{ type: 'FRAME', layoutGrids: [] }];
  assert.equal(findCommand('lgg').length, 0);
  assert.equal(findCommand('lgm').length, 0);
  assert.equal(findCommand('lgrm').length, 0);

  figma.currentPage.selection = [{
    type: 'FRAME',
    layoutGrids: [{ pattern: 'GRID', visible: true, sectionSize: 8 }],
  }];
  assert.equal(findCommand('lgrm')[0]?.name, 'LayoutGridRemove');
  assert.equal(findCommand('lgm').length, 0);

  figma.currentPage.selection = [{
    type: 'FRAME',
    layoutGrids: [{ pattern: 'COLUMNS', visible: true, alignment: 'STRETCH', count: 12, gutterSize: 20, offset: 0 }],
  }];
  assert.equal(findCommand('lgg')[0]?.name, 'LayoutGridGutter');
  assert.equal(findCommand('lgm')[0]?.name, 'LayoutGridMargin');

  figma.currentPage.selection = [{ type: 'FRAME', parent: { type: 'PAGE' } }];
  assert.equal(findCommand('SelectParent').length, 0);
  assert.equal(findCommand('AlignTopLeftToParent').length, 0);
  assert.equal(findCommand('at').length, 0);

  figma.currentPage.selection = [
    { type: 'FRAME', parent: { type: 'PAGE' }, x: 10, y: 20, width: 100, height: 100 },
    { type: 'FRAME', parent: { type: 'PAGE' }, x: 80, y: 60, width: 120, height: 140 },
  ];
  assert.equal(findCommand('at')[0]?.name, 'AlignTop');
  assert.equal(findCommand('ab')[0]?.name, 'AlignBottom');
  assert.equal(findCommand('al')[0]?.name, 'AlignLeft');
  assert.equal(findCommand('ar')[0]?.name, 'AlignRight');

  figma.currentPage.selection = [{
    type: 'FRAME',
    parent: { type: 'FRAME', width: 400, height: 300 },
    x: 10,
    y: 20,
  }];
  assert.equal(findCommand('SelectParent')[0]?.name, 'SelectParent');
  assert.equal(findCommand('AlignTopLeftToParent')[0]?.name, 'AlignTopLeftToParent');

  figma.currentPage.selection = [{ type: 'RECTANGLE' }];
  assert.equal(findCommand('SelectChildren').length, 0);
  assert.equal(findCommand('Group').length, 0);
  assert.equal(findCommand('Union').length, 0);
  assert.equal(findCommand('OutlineStroke').length, 0);

  figma.currentPage.selection = [{
    type: 'FRAME',
    children: [{ id: 'child', type: 'RECTANGLE' }],
  }];
  assert.equal(findCommand('SelectChildren')[0]?.name, 'SelectChildren');

  const sharedParent = { id: 'parent-1', type: 'FRAME', layoutMode: 'NONE' };
  figma.currentPage.selection = [
    { type: 'RECTANGLE', parent: sharedParent },
    { type: 'ELLIPSE', parent: sharedParent },
  ];
  assert.equal(findCommand('Group')[0]?.name, 'Group');
  assert.equal(findCommand('Union')[0]?.name, 'Union');

  figma.currentPage.selection = [
    { type: 'RECTANGLE', parent: { id: 'parent-1', type: 'FRAME', layoutMode: 'NONE' } },
    { type: 'ELLIPSE', parent: { id: 'parent-2', type: 'FRAME', layoutMode: 'NONE' } },
  ];
  assert.equal(findCommand('Group').length, 0);

  figma.currentPage.selection = [{
    type: 'VECTOR',
    outlineStroke() {},
  }];
  assert.equal(findCommand('OutlineStroke')[0]?.name, 'OutlineStroke');

  figma.currentPage.selection = [{ type: 'RECTANGLE', parent: { layoutMode: 'NONE' } }];
  assert.equal(findCommand('ConstraintLeft').length, 0);

  figma.currentPage.selection = [{
    type: 'RECTANGLE',
    parent: { layoutMode: 'NONE' },
    constraints: { horizontal: 'MIN', vertical: 'MIN' },
  }];
  assert.equal(findCommand('ConstraintLeft')[0]?.name, 'ConstraintLeft');

  figma.currentPage.selection = [];
  const width = COMMANDS.find((command) => command.name === 'Width');
  assert.ok(width, 'Width command should exist');

  const widthSuggestions = getCommandSuggestions(COMMANDS, 'wid', undefined, true, { Width: '100' });
  assert.ok(widthSuggestions[0].includes("Width -- already set to '100'"));

  const noRelatedSuggestions = getCommandSuggestions(COMMANDS, '', width, false, {});
  assert.deepEqual(noRelatedSuggestions, []);

  figma.currentPage.selection = [{ type: 'RECTANGLE', parent: { layoutMode: 'NONE' } }];
  const rectangleSuggestions = getCommandSuggestions(COMMANDS, 'fs', undefined, false, {});
  assert.equal(
    rectangleSuggestions.some((suggestion) => suggestion.includes('· FontSize')),
    false
  );

  figma.currentPage.selection = [{ type: 'FRAME', layoutGrids: [] }];
  const gridSuggestionsWithoutGrids = getCommandSuggestions(COMMANDS, 'lg', undefined, false, {});
  assert.equal(
    gridSuggestionsWithoutGrids.some((suggestion) => suggestion.includes('· LayoutGridGutter')),
    false
  );
  assert.equal(
    gridSuggestionsWithoutGrids.some((suggestion) => suggestion.includes('· LayoutGridMargin')),
    false
  );
  assert.equal(
    gridSuggestionsWithoutGrids.some((suggestion) => suggestion.includes('· LayoutGridRemove')),
    false
  );

  figma.currentPage.selection = [{
    type: 'FRAME',
    layoutGrids: [{ pattern: 'ROWS', visible: true, alignment: 'STRETCH', count: 6, gutterSize: 20, offset: 0 }],
  }];
  const gridSuggestionsWithRows = getCommandSuggestions(COMMANDS, 'lg', undefined, false, {});
  assert.equal(
    gridSuggestionsWithRows.some((suggestion) => suggestion.includes('· LayoutGridGutter')),
    true
  );
  assert.equal(
    gridSuggestionsWithRows.some((suggestion) => suggestion.includes('· LayoutGridMargin')),
    true
  );
  assert.equal(
    gridSuggestionsWithRows.some((suggestion) => suggestion.includes('· LayoutGridRemove')),
    true
  );

  figma.currentPage.selection = [{ type: 'FRAME', parent: { type: 'PAGE' } }];
  const selectionSuggestions = getCommandSuggestions(COMMANDS, 'sel', undefined, false, {});
  assert.equal(
    selectionSuggestions.some((suggestion) => suggestion.includes('· SelectParent')),
    false
  );

  figma.currentPage.selection = [{ type: 'RECTANGLE' }];
  const booleanSuggestions = getCommandSuggestions(COMMANDS, 'uni', undefined, false, {});
  assert.equal(
    booleanSuggestions.some((suggestion) => suggestion.includes('· Union')),
    false
  );

  const singleSelectionSuggestions = getCommandSuggestions(COMMANDS, 'swp', undefined, false, {});
  assert.equal(
    singleSelectionSuggestions.some((suggestion) => suggestion.includes('· SwapPosition')),
    false
  );

  figma.currentPage.selection = [
    { type: 'RECTANGLE', parent: { layoutMode: 'NONE' } },
    { type: 'RECTANGLE', parent: { layoutMode: 'NONE' } },
  ];
  const doubleSelectionSuggestions = getCommandSuggestions(COMMANDS, 'swp', undefined, false, {});
  assert.equal(
    doubleSelectionSuggestions.some((suggestion) => suggestion.includes('· SwapPosition')),
    true
  );

  console.log('utils tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
