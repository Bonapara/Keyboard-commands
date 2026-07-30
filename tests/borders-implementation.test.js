import assert from 'node:assert/strict';
import { createFigmaStub } from './helpers/figma-stub.js';

function createSolidPaint() {
  return {
    type: 'SOLID',
    color: { r: 0, g: 0, b: 0 },
    opacity: 1,
  };
}

function createStrokeNode(overrides = {}) {
  return {
    type: 'RECTANGLE',
    strokes: [],
    strokeWeight: 0,
    strokeTopWeight: 0,
    strokeRightWeight: 0,
    strokeBottomWeight: 0,
    strokeLeftWeight: 0,
    strokeAlign: 'CENTER',
    ...overrides,
  };
}

function createUniformStrokeNode(overrides = {}) {
  return {
    type: 'ELLIPSE',
    name: 'Ellipse',
    strokes: [],
    strokeWeight: 0,
    strokeAlign: 'CENTER',
    ...overrides,
  };
}

function createVariableAwareStrokeNode(overrides = {}) {
  const boundVariables = new Map();
  const bindingCalls = [];

  return {
    ...createStrokeNode(overrides),
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

function createFloatVariable(id, name = 'Stroke Token') {
  return {
    id,
    name,
    resolvedType: 'FLOAT',
    variableCollectionId: 'collection-1',
    valuesByMode: {
      'mode-1': 1,
    },
  };
}

function createUniformCollapsingInstanceStrokeNode() {
  const node = createStrokeNode({
    type: 'INSTANCE',
    strokes: [createSolidPaint()],
    strokeAlign: 'INSIDE',
  });
  const state = {
    strokeWeight: 1,
    top: 1,
    right: 1,
    bottom: 1,
    left: 1,
  };

  function updateUniformWeight() {
    const uniform = state.top === state.right &&
      state.right === state.bottom &&
      state.bottom === state.left;
    state.strokeWeight = uniform ? state.top : globalThis.figma.mixed;
  }

  function setSide(side, value) {
    const isUniformOne = state.strokeWeight === 1 &&
      state.top === 1 &&
      state.right === 1 &&
      state.bottom === 1 &&
      state.left === 1;

    if (isUniformOne && value === 0) {
      state.strokeWeight = 0;
      state.top = 0;
      state.right = 0;
      state.bottom = 0;
      state.left = 0;
      return;
    }

    state[side] = value;
    updateUniformWeight();
  }

  Object.defineProperties(node, {
    strokeWeight: {
      get: () => state.strokeWeight,
      set: value => { state.strokeWeight = value; },
      enumerable: true,
      configurable: true,
    },
    strokeTopWeight: {
      get: () => state.top,
      set: value => setSide('top', value),
      enumerable: true,
      configurable: true,
    },
    strokeRightWeight: {
      get: () => state.right,
      set: value => setSide('right', value),
      enumerable: true,
      configurable: true,
    },
    strokeBottomWeight: {
      get: () => state.bottom,
      set: value => setSide('bottom', value),
      enumerable: true,
      configurable: true,
    },
    strokeLeftWeight: {
      get: () => state.left,
      set: value => setSide('left', value),
      enumerable: true,
      configurable: true,
    },
  });

  return node;
}

function assertSideWeights(node, expected) {
  assert.deepEqual(
    {
      top: node.strokeTopWeight,
      right: node.strokeRightWeight,
      bottom: node.strokeBottomWeight,
      left: node.strokeLeftWeight,
    },
    expected
  );
}

async function main() {
  const strokeVariable = createFloatVariable('var-stroke');
  const { figma, notifications } = createFigmaStub({
    localVariables: [strokeVariable],
    localVariableCollections: [{ id: 'collection-1', name: 'Stroke Tokens' }],
  });
  globalThis.figma = figma;

  const {
    setBorder,
    setBorderAll,
    setBorderExcept,
    setBorderNone,
    toggleBorder,
  } = await import('../src/implementations/borders.ts');

  const freshNode = createStrokeNode();
  figma.currentPage.selection = [freshNode];
  toggleBorder('left');

  assert.equal(freshNode.strokeAlign, 'CENTER');
  assert.equal(freshNode.strokes.length, 1);
  assertSideWeights(freshNode, { top: 0, right: 0, bottom: 0, left: 1 });
  assert.equal(notifications.at(-1)?.message, 'Left border toggled');

  notifications.length = 0;

  const zeroWidthStrokeNode = createStrokeNode({
    strokes: [createSolidPaint()],
    strokeAlign: 'INSIDE',
    strokeWeight: 0,
    strokeTopWeight: 0,
    strokeRightWeight: 0,
    strokeBottomWeight: 0,
    strokeLeftWeight: 0,
  });
  figma.currentPage.selection = [zeroWidthStrokeNode];
  toggleBorder('all');

  assert.equal(zeroWidthStrokeNode.strokes.length, 0);
  assert.equal(zeroWidthStrokeNode.strokeWeight, 0);
  assertSideWeights(zeroWidthStrokeNode, { top: 0, right: 0, bottom: 0, left: 0 });
  assert.equal(notifications.at(-1)?.message, 'All border toggled');

  notifications.length = 0;

  toggleBorder('all');

  assert.equal(zeroWidthStrokeNode.strokes.length, 1);
  assert.equal(zeroWidthStrokeNode.strokeWeight, 1);
  assertSideWeights(zeroWidthStrokeNode, { top: 1, right: 1, bottom: 1, left: 1 });
  assert.equal(notifications.at(-1)?.message, 'All border toggled');

  notifications.length = 0;

  const uniformNode = createStrokeNode({
    strokes: [createSolidPaint()],
    strokeWeight: 3,
    strokeAlign: 'CENTER',
  });
  figma.currentPage.selection = [uniformNode];
  toggleBorder('left');

  assert.equal(uniformNode.strokeAlign, 'CENTER');
  assertSideWeights(uniformNode, { top: 3, right: 3, bottom: 3, left: 0 });
  assert.equal(notifications.at(-1)?.message, 'Left border toggled');

  notifications.length = 0;

  const outsideRightNode = createStrokeNode({
    strokes: [createSolidPaint()],
    strokeWeight: figma.mixed,
    strokeAlign: 'OUTSIDE',
    strokeTopWeight: 0,
    strokeRightWeight: 2,
    strokeBottomWeight: 0,
    strokeLeftWeight: 0,
  });
  figma.currentPage.selection = [outsideRightNode];
  await setBorder('right', '1');

  assert.equal(outsideRightNode.strokeAlign, 'OUTSIDE');
  assertSideWeights(outsideRightNode, { top: 0, right: 1, bottom: 0, left: 0 });
  assert.equal(notifications.at(-1)?.message, 'Right stroke set to 1px');

  notifications.length = 0;

  const activeSideNode = createStrokeNode({
    strokes: [createSolidPaint()],
    strokeAlign: 'INSIDE',
    strokeTopWeight: 2,
    strokeRightWeight: 2,
    strokeBottomWeight: 2,
    strokeLeftWeight: 2,
  });
  figma.currentPage.selection = [activeSideNode];
  toggleBorder('left');

  assertSideWeights(activeSideNode, { top: 2, right: 2, bottom: 2, left: 0 });
  assert.equal(notifications.at(-1)?.message, 'Left border toggled');

  notifications.length = 0;

  const missingSideNode = createStrokeNode({
    strokes: [createSolidPaint()],
    strokeAlign: 'INSIDE',
    strokeTopWeight: 4,
    strokeRightWeight: 4,
    strokeBottomWeight: 0,
    strokeLeftWeight: 0,
  });
  figma.currentPage.selection = [missingSideNode];
  toggleBorder('bottom');

  assertSideWeights(missingSideNode, { top: 4, right: 4, bottom: 4, left: 0 });
  assert.equal(notifications.at(-1)?.message, 'Bottom border toggled');

  notifications.length = 0;

  const rightBorderPaint = {
    type: 'SOLID',
    color: { r: 0.8, g: 0.1, b: 0.2 },
    opacity: 0.75,
  };
  const rightOnlyNode = createStrokeNode({
    strokes: [rightBorderPaint],
    strokeStyleId: 'border-style-id',
    strokeWeight: figma.mixed,
    strokeAlign: 'INSIDE',
    strokeRightWeight: 3,
  });
  figma.currentPage.selection = [rightOnlyNode];
  await setBorderAll();

  assert.equal(rightOnlyNode.strokeWeight, 3);
  assertSideWeights(rightOnlyNode, { top: 3, right: 3, bottom: 3, left: 3 });
  assert.strictEqual(rightOnlyNode.strokes[0], rightBorderPaint);
  assert.equal(rightOnlyNode.strokeStyleId, 'border-style-id');
  assert.equal(notifications.at(-1)?.message, 'Border applied to all sides');

  notifications.length = 0;

  setBorderNone();

  assert.equal(rightOnlyNode.strokeWeight, 0);
  assertSideWeights(rightOnlyNode, { top: 0, right: 0, bottom: 0, left: 0 });
  assert.strictEqual(rightOnlyNode.strokes[0], rightBorderPaint);
  assert.equal(rightOnlyNode.strokeStyleId, 'border-style-id');
  assert.equal(notifications.at(-1)?.message, 'Border disabled on all sides');

  notifications.length = 0;

  await setBorderAll();

  assert.equal(rightOnlyNode.strokeWeight, 1);
  assertSideWeights(rightOnlyNode, { top: 1, right: 1, bottom: 1, left: 1 });
  assert.strictEqual(rightOnlyNode.strokes[0], rightBorderPaint);
  assert.equal(rightOnlyNode.strokeStyleId, 'border-style-id');
  assert.equal(notifications.at(-1)?.message, 'Border applied to all sides');

  notifications.length = 0;

  const ellipsePaint = createSolidPaint();
  const ellipseNode = createUniformStrokeNode({
    strokes: [ellipsePaint],
    strokeWeight: 1,
  });
  figma.currentPage.selection = [ellipseNode];
  await setBorder('all', '2');

  assert.equal(ellipseNode.strokeWeight, 2);
  assert.strictEqual(ellipseNode.strokes[0], ellipsePaint);
  assert.equal(notifications.at(-1)?.message, 'All stroke set to 2px');

  setBorderNone();
  assert.equal(ellipseNode.strokeWeight, 0);
  assert.strictEqual(ellipseNode.strokes[0], ellipsePaint);

  await setBorderAll();
  assert.equal(ellipseNode.strokeWeight, 1);
  assert.strictEqual(ellipseNode.strokes[0], ellipsePaint);

  toggleBorder('all');
  assert.equal(ellipseNode.strokeWeight, 0);
  assert.equal(ellipseNode.strokes.length, 0);

  toggleBorder('all');
  assert.equal(ellipseNode.strokeWeight, 1);
  assert.equal(ellipseNode.strokes.length, 1);

  notifications.length = 0;

  const insideUniformNodeA = createStrokeNode({
    strokes: [createSolidPaint()],
    strokeWeight: 1,
    strokeAlign: 'INSIDE',
  });
  const insideUniformNodeB = createStrokeNode({
    strokes: [createSolidPaint()],
    strokeWeight: 1,
    strokeAlign: 'INSIDE',
  });
  figma.currentPage.selection = [insideUniformNodeA, insideUniformNodeB];
  await setBorder('right', '0');

  assertSideWeights(insideUniformNodeA, { top: 1, right: 0, bottom: 1, left: 1 });
  assertSideWeights(insideUniformNodeB, { top: 1, right: 0, bottom: 1, left: 1 });
  assert.equal(notifications.at(-1)?.message, 'Right stroke set to 0px');

  notifications.length = 0;

  const collapsingInstanceNode = createUniformCollapsingInstanceStrokeNode();
  figma.currentPage.selection = [collapsingInstanceNode];
  toggleBorder('right');

  assertSideWeights(collapsingInstanceNode, { top: 1, right: 0, bottom: 1, left: 1 });
  assert.equal(notifications.at(-1)?.message, 'Right border toggled');

  notifications.length = 0;

  const exceptRightNode = createStrokeNode();
  figma.currentPage.selection = [exceptRightNode];
  await setBorderExcept('right', '2');

  assert.equal(exceptRightNode.strokeAlign, 'CENTER');
  assert.equal(exceptRightNode.strokes.length, 1);
  assertSideWeights(exceptRightNode, { top: 2, right: 0, bottom: 2, left: 2 });
  assert.equal(notifications.at(-1)?.message, 'All except right stroke set to 2px');

  notifications.length = 0;

  const collapsingExceptRightNode = createUniformCollapsingInstanceStrokeNode();
  figma.currentPage.selection = [collapsingExceptRightNode];
  await setBorderExcept('right', '0');

  assertSideWeights(collapsingExceptRightNode, { top: 0, right: 1, bottom: 0, left: 0 });
  assert.equal(notifications.at(-1)?.message, 'All except right stroke set to 0px');

  notifications.length = 0;

  const boundExceptRightNode = createVariableAwareStrokeNode({
    strokes: [createSolidPaint()],
    strokeAlign: 'INSIDE',
    strokeTopWeight: 3,
    strokeRightWeight: 7,
    strokeBottomWeight: 3,
    strokeLeftWeight: 3,
  });
  boundExceptRightNode.boundVariables.set('strokeTopWeight', strokeVariable);
  boundExceptRightNode.boundVariables.set('strokeRightWeight', strokeVariable);
  figma.currentPage.selection = [boundExceptRightNode];
  await setBorderExcept('right', '2');

  assertSideWeights(boundExceptRightNode, { top: 2, right: 7, bottom: 2, left: 2 });
  assert.equal(boundExceptRightNode.boundVariables.has('strokeTopWeight'), false);
  assert.equal(boundExceptRightNode.boundVariables.get('strokeRightWeight')?.id, 'var-stroke');
  assert.equal(notifications.at(-1)?.message, 'All except right stroke set to 2px');

  notifications.length = 0;

  const uniformBoundExceptRightNode = createVariableAwareStrokeNode({
    strokes: [createSolidPaint()],
    strokeWeight: 8,
    strokeAlign: 'CENTER',
  });
  uniformBoundExceptRightNode.boundVariables.set('strokeWeight', strokeVariable);
  figma.currentPage.selection = [uniformBoundExceptRightNode];
  await setBorderExcept('right', '2');

  assertSideWeights(uniformBoundExceptRightNode, { top: 2, right: 8, bottom: 2, left: 2 });
  assert.equal(uniformBoundExceptRightNode.boundVariables.has('strokeWeight'), false);
  assert.equal(uniformBoundExceptRightNode.boundVariables.get('strokeRightWeight')?.id, 'var-stroke');
  assert.equal(notifications.at(-1)?.message, 'All except right stroke set to 2px');

  console.log('borders implementation tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
