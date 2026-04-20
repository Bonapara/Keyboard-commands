import assert from 'node:assert/strict';
import { createFigmaStub } from './helpers/figma-stub.js';

function createVariableAwareNode(base) {
  const boundVariables = new Map();
  const bindingCalls = [];

  return {
    ...base,
    boundVariables,
    bindingCalls,
    setBoundVariable(field, variable) {
      bindingCalls.push({ field, variableId: variable?.id ?? null });
      if (variable) {
        boundVariables.set(field, variable);
      } else {
        boundVariables.delete(field);
      }
    },
  };
}

function createFloatVariable(id, name = 'Spacing Token') {
  return {
    id,
    name,
    resolvedType: 'FLOAT',
    variableCollectionId: 'collection-1',
    valuesByMode: {
      'mode-1': 8,
    },
  };
}

async function main() {
  const localVariable = createFloatVariable('var-local');
  const { figma, notifications } = createFigmaStub({
    localVariables: [localVariable],
    localVariableCollections: [{ id: 'collection-1', name: 'Spacing' }],
  });
  globalThis.figma = figma;

  const { setPrimaryGap, setCounterGap } = await import('../src/implementations/layout.ts');
  const { setOpacity, toggleOpacity } = await import('../src/implementations/visibility.ts');
  const { maxDimension } = await import('../src/implementations/sizing.ts');
  const { setLetterSpacing, setLineHeight } = await import('../src/implementations/text.ts');
  const { setBorder, toggleBorder } = await import('../src/implementations/borders.ts');

  const bindingValue = 'Spacing Token (Spacing - Local)';

  const gapNode = createVariableAwareNode({
    type: 'FRAME',
    layoutMode: 'HORIZONTAL',
    primaryAxisAlignItems: 'MIN',
    itemSpacing: 8,
  });
  figma.currentPage.selection = [gapNode];
  await setPrimaryGap(bindingValue);
  assert.equal(gapNode.boundVariables.get('itemSpacing')?.id, 'var-local');
  await setPrimaryGap('+4');
  assert.equal(gapNode.boundVariables.has('itemSpacing'), false);
  assert.equal(gapNode.itemSpacing, 12);

  notifications.length = 0;

  const gridNode = createVariableAwareNode({
    type: 'FRAME',
    layoutMode: 'GRID',
    gridColumnGap: 6,
    gridRowGap: 4,
  });
  figma.currentPage.selection = [gridNode];
  await setPrimaryGap(bindingValue);
  assert.equal(gridNode.boundVariables.get('gridColumnGap')?.id, 'var-local');
  await setPrimaryGap('10');
  assert.equal(gridNode.boundVariables.has('gridColumnGap'), false);
  assert.equal(gridNode.gridColumnGap, 10);

  await setCounterGap(bindingValue);
  assert.equal(gridNode.boundVariables.get('gridRowGap')?.id, 'var-local');
  await setCounterGap('+3');
  assert.equal(gridNode.boundVariables.has('gridRowGap'), false);
  assert.equal(gridNode.gridRowGap, 7);

  notifications.length = 0;

  const wrapNode = createVariableAwareNode({
    type: 'FRAME',
    layoutMode: 'HORIZONTAL',
    layoutWrap: 'WRAP',
    counterAxisAlignContent: 'AUTO',
    counterAxisSpacing: 5,
  });
  figma.currentPage.selection = [wrapNode];
  await setCounterGap(bindingValue);
  assert.equal(wrapNode.boundVariables.get('counterAxisSpacing')?.id, 'var-local');
  await setCounterGap('AUTO');
  assert.equal(wrapNode.boundVariables.has('counterAxisSpacing'), false);
  assert.equal(wrapNode.counterAxisAlignContent, 'SPACE_BETWEEN');

  notifications.length = 0;

  const opacityNode = createVariableAwareNode({
    type: 'RECTANGLE',
    opacity: 0.4,
  });
  figma.currentPage.selection = [opacityNode];
  await setOpacity(bindingValue);
  assert.equal(opacityNode.boundVariables.get('opacity')?.id, 'var-local');
  await setOpacity('+10');
  assert.equal(opacityNode.boundVariables.has('opacity'), false);
  assert.equal(opacityNode.opacity, 0.5);

  await setOpacity(bindingValue);
  opacityNode.opacity = 1;
  toggleOpacity();
  assert.equal(opacityNode.boundVariables.has('opacity'), false);
  assert.equal(opacityNode.opacity, 0);

  notifications.length = 0;

  const sizeNode = createVariableAwareNode({
    type: 'FRAME',
    width: 100,
    height: 80,
    minWidth: null,
    maxWidth: null,
    minHeight: null,
    maxHeight: null,
  });
  figma.currentPage.selection = [sizeNode];
  await maxDimension({ type: 'max', direction: 'width', null: false, value: bindingValue });
  assert.equal(sizeNode.boundVariables.get('maxWidth')?.id, 'var-local');
  await maxDimension({ type: 'max', direction: 'width', null: false, value: '+20' });
  assert.equal(sizeNode.boundVariables.has('maxWidth'), false);
  assert.equal(sizeNode.maxWidth, 120);
  await maxDimension({ type: 'max', direction: 'width', null: true });
  assert.equal(sizeNode.boundVariables.has('maxWidth'), false);
  assert.equal(sizeNode.maxWidth, null);

  notifications.length = 0;

  const textNode = createVariableAwareNode({
    type: 'TEXT',
    name: 'Label',
    fontName: { family: 'Inter', style: 'Regular' },
    letterSpacing: { value: 1, unit: 'PIXELS' },
    lineHeight: { value: 18, unit: 'PIXELS' },
  });
  figma.currentPage.selection = [textNode];
  await setLetterSpacing(bindingValue);
  assert.equal(textNode.boundVariables.get('letterSpacing')?.id, 'var-local');
  await setLetterSpacing('12');
  assert.equal(textNode.boundVariables.has('letterSpacing'), false);
  assert.deepEqual(textNode.letterSpacing, { value: 12, unit: 'PIXELS' });

  await setLineHeight(bindingValue);
  assert.equal(textNode.boundVariables.get('lineHeight')?.id, 'var-local');
  await setLineHeight('AUTO');
  assert.equal(textNode.boundVariables.has('lineHeight'), false);
  assert.deepEqual(textNode.lineHeight, { unit: 'AUTO' });

  notifications.length = 0;

  const strokeNode = createVariableAwareNode({
    type: 'RECTANGLE',
    strokes: [{
      type: 'SOLID',
      color: { r: 0, g: 0, b: 0 },
      opacity: 1,
    }],
    strokeWeight: 3,
    strokeTopWeight: 0,
    strokeRightWeight: 0,
    strokeBottomWeight: 0,
    strokeLeftWeight: 0,
    strokeAlign: 'CENTER',
  });
  strokeNode.boundVariables.set('strokeWeight', localVariable);
  figma.currentPage.selection = [strokeNode];
  toggleBorder('left');
  assert.equal(strokeNode.boundVariables.has('strokeWeight'), false);
  assert.equal(strokeNode.strokeAlign, 'INSIDE');
  assert.equal(strokeNode.strokeLeftWeight, 0);

  strokeNode.boundVariables.set('strokeLeftWeight', localVariable);
  strokeNode.strokeAlign = 'INSIDE';
  strokeNode.strokeLeftWeight = 4;
  await setBorder('all', '2');
  assert.equal(strokeNode.boundVariables.has('strokeLeftWeight'), false);
  assert.equal(strokeNode.boundVariables.has('strokeWeight'), false);
  assert.equal(strokeNode.strokeWeight, 2);

  console.log('variable binding implementation tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
