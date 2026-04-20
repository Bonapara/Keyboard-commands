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

  const { toggleBorder } = await import('../src/implementations/borders.ts');

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

  console.log('borders implementation tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
