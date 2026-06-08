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
  const { figma, notifications } = createFigmaStub();
  globalThis.figma = figma;

  const { setBorder, toggleBorder } = await import('../src/implementations/borders.ts');

  const freshNode = createStrokeNode();
  figma.currentPage.selection = [freshNode];
  toggleBorder('left');

  assert.equal(freshNode.strokeAlign, 'INSIDE');
  assert.equal(freshNode.strokes.length, 1);
  assertSideWeights(freshNode, { top: 0, right: 0, bottom: 0, left: 1 });
  assert.equal(notifications.at(-1)?.message, 'Left border toggled');

  notifications.length = 0;

  const uniformNode = createStrokeNode({
    strokes: [createSolidPaint()],
    strokeWeight: 3,
    strokeAlign: 'CENTER',
  });
  figma.currentPage.selection = [uniformNode];
  toggleBorder('left');

  assert.equal(uniformNode.strokeAlign, 'INSIDE');
  assertSideWeights(uniformNode, { top: 3, right: 3, bottom: 3, left: 0 });
  assert.equal(notifications.at(-1)?.message, 'Left border toggled');

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

  console.log('borders implementation tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
