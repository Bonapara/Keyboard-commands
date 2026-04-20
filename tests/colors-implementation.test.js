import assert from 'node:assert/strict';
import { createFigmaStub } from './helpers/figma-stub.js';

function createColorVariable(id, name, color) {
  return {
    id,
    name,
    resolvedType: 'COLOR',
    variableCollectionId: 'collection-1',
    valuesByMode: {
      'mode-1': color,
    },
  };
}

function createSolidPaint(color, overrides = {}) {
  return {
    type: 'SOLID',
    color,
    opacity: 1,
    visible: true,
    ...overrides,
  };
}

async function main() {
  const sourceVariable = createColorVariable('var-source', 'Source Token', { r: 1, g: 0, b: 0 });
  const targetVariable = createColorVariable('var-target', 'Target Token', { r: 0, g: 0, b: 1 });
  const { figma, notifications } = createFigmaStub({
    localVariables: [sourceVariable, targetVariable],
    localVariableCollections: [{ id: 'collection-1', name: 'Theme' }],
  });

  figma.variables.setBoundVariableForPaint = (paint, field, variable) => ({
    ...paint,
    boundVariables: {
      ...(paint.boundVariables || {}),
      [field]: { id: variable.id },
    },
  });

  globalThis.figma = figma;

  const { swapSelectionColors, swapTwoSelectionColors } = await import('../src/implementations/colors.ts');

  const literalToVariableNode = {
    type: 'RECTANGLE',
    fills: [createSolidPaint({ r: 1, g: 0, b: 0 })],
    strokes: [],
    effects: [],
  };
  figma.currentPage.selection = [literalToVariableNode];
  await swapSelectionColors('#ff0000 : Target Token (Theme - Local)');
  assert.equal(literalToVariableNode.fills[0].boundVariables.color.id, 'var-target');
  assert.equal(notifications.at(-1)?.message, 'Swapped 1 color');

  notifications.length = 0;

  const autoSwapNode = {
    type: 'RECTANGLE',
    fills: [
      createSolidPaint({ r: 1, g: 0, b: 0 }),
      createSolidPaint({ r: 0, g: 0, b: 1 }, { boundVariables: { color: { id: 'var-target' } } }),
    ],
    strokes: [],
    effects: [],
  };
  figma.currentPage.selection = [autoSwapNode];
  await swapTwoSelectionColors();
  assert.equal(autoSwapNode.fills[0].boundVariables.color.id, 'var-target');
  assert.deepEqual(autoSwapNode.fills[1].color, { r: 1, g: 0, b: 0 });
  assert.equal(autoSwapNode.fills[1].boundVariables, undefined);
  assert.equal(notifications.at(-1)?.message, 'Swapped 2 colors');

  notifications.length = 0;

  const variableSpecificNode = {
    type: 'RECTANGLE',
    fills: [
      createSolidPaint({ r: 1, g: 0, b: 0 }, { boundVariables: { color: { id: 'var-source' } }, tag: 'variable-red' }),
      createSolidPaint({ r: 1, g: 0, b: 0 }, { tag: 'literal-red' }),
    ],
    strokes: [],
    effects: [],
  };
  figma.currentPage.selection = [variableSpecificNode];
  await swapSelectionColors('Source Token : Target Token (Theme - Local)');
  assert.equal(variableSpecificNode.fills[0].boundVariables.color.id, 'var-target');
  assert.deepEqual(variableSpecificNode.fills[1].color, { r: 1, g: 0, b: 0 });
  assert.equal(variableSpecificNode.fills[1].boundVariables, undefined);
  assert.equal(notifications.at(-1)?.message, 'Swapped 1 color');

  console.log('colors implementation tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
