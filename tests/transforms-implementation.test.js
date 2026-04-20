import assert from 'node:assert/strict';
import { createFigmaStub } from './helpers/figma-stub.js';

function multiplyTransforms(left, right) {
  return [
    [
      left[0][0] * right[0][0] + left[0][1] * right[1][0],
      left[0][0] * right[0][1] + left[0][1] * right[1][1],
      left[0][0] * right[0][2] + left[0][1] * right[1][2] + left[0][2],
    ],
    [
      left[1][0] * right[0][0] + left[1][1] * right[1][0],
      left[1][0] * right[0][1] + left[1][1] * right[1][1],
      left[1][0] * right[0][2] + left[1][1] * right[1][2] + left[1][2],
    ],
  ];
}

function translationTransform(x, y) {
  return [
    [1, 0, x],
    [0, 1, y],
  ];
}

function createParent({ width = 300, height = 200, x = 0, y = 0, layoutMode = 'NONE', parent = null, absoluteTransform } = {}) {
  const node = {
    width,
    height,
    x,
    y,
    parent,
    layoutMode,
    children: [],
    insertChild(index, node) {
      const currentIndex = this.children.indexOf(node);
      if (currentIndex !== -1) {
        this.children.splice(currentIndex, 1);
      }
      this.children.splice(index, 0, node);
      node.parent = this;
    },
  };

  Object.defineProperty(node, 'absoluteTransform', {
    get() {
      if (absoluteTransform) return absoluteTransform;
      const parentTransform = parent?.absoluteTransform ?? translationTransform(0, 0);
      return multiplyTransforms(parentTransform, translationTransform(this.x, this.y));
    },
  });

  return node;
}

function createNode({
  type = 'RECTANGLE',
  x,
  y,
  width,
  height,
  parent,
  constraints,
  layoutPositioning,
}) {
  const node = {
    type,
    x,
    y,
    width,
    height,
    parent,
    constraints,
    layoutPositioning,
    resize(nextWidth, nextHeight) {
      this.width = nextWidth;
      this.height = nextHeight;
    },
  };

  Object.defineProperty(node, 'absoluteTransform', {
    get() {
      const parentTransform = parent?.absoluteTransform ?? translationTransform(0, 0);
      return multiplyTransforms(parentTransform, translationTransform(this.x, this.y));
    },
  });

  return node;
}

async function main() {
  const { figma, notifications } = createFigmaStub();
  globalThis.figma = figma;

  const { swapPosition } = await import('../src/implementations/transforms.ts');

  const parent = createParent();
  const firstNode = createNode({
    x: 10,
    y: 20,
    width: 40,
    height: 30,
    parent,
    constraints: { horizontal: 'MIN', vertical: 'MIN' },
  });
  const secondNode = createNode({
    x: 230,
    y: 120,
    width: 50,
    height: 20,
    parent,
    constraints: { horizontal: 'MAX', vertical: 'MAX' },
  });

  figma.currentPage.selection = [firstNode, secondNode];
  parent.children = [firstNode, secondNode];
  swapPosition();

  assert.equal(firstNode.x, 240);
  assert.equal(firstNode.y, 110);
  assert.deepEqual(firstNode.constraints, { horizontal: 'MAX', vertical: 'MAX' });
  assert.equal(secondNode.x, 10);
  assert.equal(secondNode.y, 20);
  assert.deepEqual(secondNode.constraints, { horizontal: 'MIN', vertical: 'MIN' });
  assert.equal(notifications.at(-1)?.message, 'Swapped positions for 2 selected items');

  notifications.length = 0;

  const responsiveParent = createParent({ width: 400, height: 240 });
  const centerNode = createNode({
    x: 150,
    y: 24,
    width: 100,
    height: 48,
    parent: responsiveParent,
    constraints: { horizontal: 'CENTER', vertical: 'SCALE' },
  });
  const stretchNode = createNode({
    x: 30,
    y: 86,
    width: 250,
    height: 80,
    parent: responsiveParent,
    constraints: { horizontal: 'STRETCH', vertical: 'CENTER' },
  });

  figma.currentPage.selection = [centerNode, stretchNode];
  responsiveParent.children = [centerNode, stretchNode];
  swapPosition();

  assert.equal(centerNode.x, 30);
  assert.equal(centerNode.width, 250);
  assert.equal(centerNode.y, 102);
  assert.deepEqual(centerNode.constraints, { horizontal: 'STRETCH', vertical: 'CENTER' });

  assert.equal(stretchNode.width, 250);
  assert.equal(stretchNode.x, 75);
  assert.equal(stretchNode.height, 48);
  assert.equal(stretchNode.y, 24);
  assert.deepEqual(stretchNode.constraints, { horizontal: 'CENTER', vertical: 'SCALE' });
  assert.equal(notifications.at(-1)?.message, 'Swapped positions for 2 selected items');

  notifications.length = 0;

  const orphanParent = createParent();
  const foreignParent = createParent({ x: 200, y: 100 });
  const orphanNode = createNode({
    x: 0,
    y: 0,
    width: 20,
    height: 20,
    parent: orphanParent,
    constraints: { horizontal: 'MIN', vertical: 'MIN' },
  });
  const foreignNode = createNode({
    x: 100,
    y: 100,
    width: 20,
    height: 20,
    parent: foreignParent,
    constraints: { horizontal: 'MIN', vertical: 'MIN' },
  });

  figma.currentPage.selection = [orphanNode, foreignNode];
  swapPosition();

  assert.equal(orphanNode.parent, orphanParent);
  assert.equal(foreignNode.parent, foreignParent);
  assert.equal(orphanNode.x, 300);
  assert.equal(orphanNode.y, 200);
  assert.equal(foreignNode.x, -200);
  assert.equal(foreignNode.y, -100);
  assert.equal(notifications.at(-1)?.message, 'Swapped positions for 2 selected items');

  notifications.length = 0;

  const rotatedParent = createParent({
    width: 300,
    height: 200,
    absoluteTransform: [
      [0, -1, 200],
      [1, 0, 100],
    ],
  });
  const translatedParent = createParent({
    width: 300,
    height: 200,
    absoluteTransform: [
      [1, 0, 300],
      [0, 1, 400],
    ],
  });
  const rotatedNode = createNode({
    x: 10,
    y: 20,
    width: 20,
    height: 20,
    parent: rotatedParent,
    constraints: { horizontal: 'MIN', vertical: 'MIN' },
  });
  const translatedNode = createNode({
    x: 30,
    y: 40,
    width: 20,
    height: 20,
    parent: translatedParent,
    constraints: { horizontal: 'MIN', vertical: 'MIN' },
  });

  figma.currentPage.selection = [rotatedNode, translatedNode];
  swapPosition();

  assert.equal(rotatedNode.x, 340);
  assert.equal(rotatedNode.y, -130);
  assert.equal(translatedNode.x, -120);
  assert.equal(translatedNode.y, -290);
  assert.deepEqual(rotatedNode.absoluteTransform, [
    [0, -1, 330],
    [1, 0, 440],
  ]);
  assert.deepEqual(translatedNode.absoluteTransform, [
    [1, 0, 180],
    [0, 1, 110],
  ]);
  assert.equal(notifications.at(-1)?.message, 'Swapped positions for 2 selected items');

  notifications.length = 0;

  const autoLayoutParent = createParent({ width: 320, height: 120, layoutMode: 'HORIZONTAL' });
  const anthropicNode = createNode({
    x: 0,
    y: 0,
    width: 40,
    height: 40,
    parent: autoLayoutParent,
    constraints: { horizontal: 'MIN', vertical: 'MIN' },
    layoutPositioning: 'AUTO',
  });
  const openAiNode = createNode({
    x: 60,
    y: 0,
    width: 50,
    height: 40,
    parent: autoLayoutParent,
    constraints: { horizontal: 'MIN', vertical: 'MIN' },
    layoutPositioning: 'AUTO',
  });
  const googleNode = createNode({
    x: 120,
    y: 0,
    width: 50,
    height: 40,
    parent: autoLayoutParent,
    constraints: { horizontal: 'MIN', vertical: 'MIN' },
    layoutPositioning: 'AUTO',
  });
  const microsoftNode = createNode({
    x: 180,
    y: 0,
    width: 50,
    height: 40,
    parent: autoLayoutParent,
    constraints: { horizontal: 'MIN', vertical: 'MIN' },
    layoutPositioning: 'AUTO',
  });
  const stripeNode = createNode({
    x: 60,
    y: 0,
    width: 50,
    height: 40,
    parent: autoLayoutParent,
    constraints: { horizontal: 'MIN', vertical: 'MIN' },
    layoutPositioning: 'AUTO',
  });
  autoLayoutParent.children = [anthropicNode, openAiNode, googleNode, microsoftNode, stripeNode];

  figma.currentPage.selection = [anthropicNode, stripeNode];
  swapPosition();

  assert.deepEqual(autoLayoutParent.children, [stripeNode, openAiNode, googleNode, microsoftNode, anthropicNode]);
  assert.equal(anthropicNode.x, 0);
  assert.equal(stripeNode.x, 60);
  assert.equal(notifications.at(-1)?.message, 'Swapped positions for 2 selected items');

  notifications.length = 0;

  const mixedAutoLayoutParent = createParent({ width: 320, height: 120, layoutMode: 'VERTICAL' });
  const absoluteChild = createNode({
    x: 10,
    y: 10,
    width: 40,
    height: 40,
    parent: mixedAutoLayoutParent,
    constraints: { horizontal: 'MIN', vertical: 'MIN' },
    layoutPositioning: 'ABSOLUTE',
  });
  const flowingChild = createNode({
    x: 0,
    y: 0,
    width: 50,
    height: 20,
    parent: mixedAutoLayoutParent,
    constraints: { horizontal: 'MIN', vertical: 'MIN' },
    layoutPositioning: 'AUTO',
  });
  mixedAutoLayoutParent.children = [absoluteChild, flowingChild];

  figma.currentPage.selection = [absoluteChild, flowingChild];
  assert.throws(() => swapPosition(), /compatible positioning modes/);

  notifications.length = 0;

  const firstAutoParent = createParent({ width: 320, height: 120, layoutMode: 'HORIZONTAL' });
  const secondAutoParent = createParent({ width: 320, height: 120, layoutMode: 'VERTICAL' });
  const firstAutoPeer = createNode({
    x: 0,
    y: 0,
    width: 40,
    height: 40,
    parent: firstAutoParent,
    constraints: { horizontal: 'MIN', vertical: 'MIN' },
    layoutPositioning: 'AUTO',
  });
  const firstAutoTarget = createNode({
    x: 50,
    y: 0,
    width: 60,
    height: 40,
    parent: firstAutoParent,
    constraints: { horizontal: 'MIN', vertical: 'MIN' },
    layoutPositioning: 'AUTO',
  });
  const secondAutoTarget = createNode({
    x: 0,
    y: 0,
    width: 70,
    height: 40,
    parent: secondAutoParent,
    constraints: { horizontal: 'MIN', vertical: 'MIN' },
    layoutPositioning: 'AUTO',
  });
  const secondAutoPeer = createNode({
    x: 0,
    y: 50,
    width: 80,
    height: 40,
    parent: secondAutoParent,
    constraints: { horizontal: 'MIN', vertical: 'MIN' },
    layoutPositioning: 'AUTO',
  });
  firstAutoParent.children = [firstAutoPeer, firstAutoTarget];
  secondAutoParent.children = [secondAutoTarget, secondAutoPeer];

  figma.currentPage.selection = [firstAutoTarget, secondAutoTarget];
  assert.throws(() => swapPosition(), /same parent/);

  figma.currentPage.selection = [orphanNode];
  assert.throws(() => swapPosition(), /Select exactly 2 items/);

  console.log('transforms implementation tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
