import assert from 'node:assert/strict';
import { createFigmaStub } from './helpers/figma-stub.js';

function createFrameNode({
  x = 0,
  y = 0,
  width = 100,
  height = 100,
  parent = null,
  fills = [],
  layoutMode = 'NONE',
  itemSpacing = 0,
} = {}) {
  return {
    type: 'FRAME',
    x,
    y,
    width,
    height,
    parent,
    fills,
    layoutMode,
    itemSpacing,
    children: [],
    insertChild(index, node) {
      const currentIndex = this.children.indexOf(node);
      if (currentIndex !== -1) {
        this.children.splice(currentIndex, 1);
      }
      this.children.splice(index, 0, node);
      node.parent = this;
    },
    appendChild(node) {
      this.insertChild(this.children.length, node);
    },
  };
}

function createNode({ x, y, width, height, parent }) {
  return {
    type: 'RECTANGLE',
    x,
    y,
    width,
    height,
    parent,
  };
}

async function main() {
  const { figma, notifications } = createFigmaStub();
  globalThis.figma = figma;

  const { createAutoLayout, layoutSizing, setPadding, setPaddingExcept, setPrimaryGap, setCounterGap, setTidyGap, setTidyRowGap } = await import('../src/implementations/layout.ts');
  const { smartAlign } = await import('../src/implementations/alignment.ts');

  const paddingNode = {
    type: 'FRAME',
    paddingLeft: 10,
    paddingRight: 15,
    paddingTop: 20,
    paddingBottom: 5,
  };
  figma.currentPage.selection = [paddingNode];
  await setPadding({
    paddingLeft: '+5',
    paddingRight: '-20',
    paddingTop: '+3',
    paddingBottom: '-100',
  });

  assert.deepEqual(
    {
      left: paddingNode.paddingLeft,
      right: paddingNode.paddingRight,
      top: paddingNode.paddingTop,
      bottom: paddingNode.paddingBottom,
    },
    { left: 15, right: 0, top: 23, bottom: 0 }
  );
  assert.equal(notifications.at(-1)?.message, 'Padding updated for all selected items');

  notifications.length = 0;

  const slotPaddingNode = {
    type: 'SLOT',
    paddingLeft: 4,
    paddingRight: 6,
    paddingTop: 8,
    paddingBottom: 10,
  };
  figma.currentPage.selection = [slotPaddingNode];
  await setPadding({
    paddingLeft: '+4',
    paddingRight: '16',
    paddingTop: '12',
    paddingBottom: '-5',
  });

  assert.deepEqual(
    {
      left: slotPaddingNode.paddingLeft,
      right: slotPaddingNode.paddingRight,
      top: slotPaddingNode.paddingTop,
      bottom: slotPaddingNode.paddingBottom,
    },
    { left: 8, right: 16, top: 12, bottom: 5 }
  );
  assert.equal(notifications.at(-1)?.message, 'Padding updated for all selected items');

  notifications.length = 0;

  const paddingExceptBottomNode = {
    type: 'FRAME',
    paddingLeft: 10,
    paddingRight: 15,
    paddingTop: 20,
    paddingBottom: 5,
  };
  figma.currentPage.selection = [paddingExceptBottomNode];
  await setPaddingExcept('bottom', '24');

  assert.deepEqual(
    {
      left: paddingExceptBottomNode.paddingLeft,
      right: paddingExceptBottomNode.paddingRight,
      top: paddingExceptBottomNode.paddingTop,
      bottom: paddingExceptBottomNode.paddingBottom,
    },
    { left: 24, right: 24, top: 24, bottom: 5 }
  );
  assert.equal(notifications.at(-1)?.message, 'Padding updated for all selected items');

  notifications.length = 0;

  const primaryGapNode = {
    type: 'FRAME',
    layoutMode: 'HORIZONTAL',
    primaryAxisAlignItems: 'MIN',
    itemSpacing: 8,
  };
  figma.currentPage.selection = [primaryGapNode];
  await setPrimaryGap('AUTO');

  assert.equal(primaryGapNode.primaryAxisAlignItems, 'SPACE_BETWEEN');
  assert.equal(primaryGapNode.itemSpacing, 8);
  assert.equal(notifications.at(-1)?.message, 'Primary gap set to AUTO');

  notifications.length = 0;

  await setPrimaryGap('-20');

  assert.equal(primaryGapNode.primaryAxisAlignItems, 'MIN');
  assert.equal(primaryGapNode.itemSpacing, 0);
  assert.equal(notifications.at(-1)?.message, 'Primary gap set to -20');

  notifications.length = 0;

  const centeredPrimaryGapNode = {
    type: 'FRAME',
    layoutMode: 'VERTICAL',
    primaryAxisAlignItems: 'CENTER',
    counterAxisAlignItems: 'CENTER',
    itemSpacing: 8,
  };
  figma.currentPage.selection = [centeredPrimaryGapNode];
  await setPrimaryGap('80');

  assert.equal(centeredPrimaryGapNode.primaryAxisAlignItems, 'CENTER');
  assert.equal(centeredPrimaryGapNode.counterAxisAlignItems, 'CENTER');
  assert.equal(centeredPrimaryGapNode.itemSpacing, 80);
  assert.equal(notifications.at(-1)?.message, 'Primary gap set to 80');

  notifications.length = 0;

  const spaceBetweenAlignmentNode = {
    type: 'FRAME',
    layoutMode: 'HORIZONTAL',
    primaryAxisAlignItems: 'SPACE_BETWEEN',
    counterAxisAlignItems: 'MIN',
    itemSpacing: 8,
  };
  figma.currentPage.selection = [spaceBetweenAlignmentNode];
  await smartAlign('CENTER');

  assert.equal(spaceBetweenAlignmentNode.primaryAxisAlignItems, 'SPACE_BETWEEN');
  assert.equal(spaceBetweenAlignmentNode.counterAxisAlignItems, 'CENTER');
  assert.equal(spaceBetweenAlignmentNode.itemSpacing, 8);
  assert.equal(notifications.at(-1)?.message, 'Aligned 1 item(s) to center');

  notifications.length = 0;

  await smartAlign('BOTTOM_CENTER');

  assert.equal(spaceBetweenAlignmentNode.primaryAxisAlignItems, 'SPACE_BETWEEN');
  assert.equal(spaceBetweenAlignmentNode.counterAxisAlignItems, 'MAX');
  assert.equal(spaceBetweenAlignmentNode.itemSpacing, 8);
  assert.equal(notifications.at(-1)?.message, 'Aligned 1 item(s) to bottom center');

  notifications.length = 0;

  const parentAlignFrame = {
    type: 'FRAME',
    layoutMode: 'NONE',
    width: 320,
    height: 200,
  };
  const parentAlignChild = createNode({ x: 20, y: 30, width: 80, height: 40, parent: parentAlignFrame });
  figma.currentPage.selection = [parentAlignChild];
  await smartAlign('CENTER', 'PARENT');

  assert.equal(parentAlignChild.x, 120);
  assert.equal(parentAlignChild.y, 80);
  assert.equal(notifications.at(-1)?.message, 'Aligned 1 item(s) to center (to parent)');

  notifications.length = 0;

  const flowAutoLayoutParent = {
    type: 'FRAME',
    layoutMode: 'HORIZONTAL',
    width: 320,
    height: 200,
    children: [],
  };
  const flowSibling = createNode({ x: 100, y: 0, width: 80, height: 40, parent: flowAutoLayoutParent });
  let flowCoordinateWrites = 0;
  const flowChild = {
    type: 'RECTANGLE',
    width: 80,
    height: 40,
    parent: flowAutoLayoutParent,
    layoutPositioning: 'AUTO',
    _x: 20,
    _y: 30,
    get x() {
      return this._x;
    },
    set x(value) {
      flowCoordinateWrites++;
      this._x = value;
      flowAutoLayoutParent.children = [flowSibling, this];
    },
    get y() {
      return this._y;
    },
    set y(value) {
      flowCoordinateWrites++;
      this._y = value;
      flowAutoLayoutParent.children = [flowSibling, this];
    },
  };
  flowAutoLayoutParent.children = [flowChild, flowSibling];
  figma.currentPage.selection = [flowChild];
  await smartAlign('CENTER', 'PARENT');

  assert.equal(flowCoordinateWrites, 0, 'parent alignment should not write coordinates for auto-layout flow children');
  assert.equal(flowChild.x, 20);
  assert.equal(flowChild.y, 30);
  assert.deepEqual(flowAutoLayoutParent.children, [flowChild, flowSibling]);
  assert.equal(notifications.at(-1)?.message, 'No items could be aligned');

  notifications.length = 0;

  const absoluteAutoLayoutChild = createNode({
    x: 10,
    y: 20,
    width: 80,
    height: 40,
    parent: flowAutoLayoutParent,
  });
  absoluteAutoLayoutChild.layoutPositioning = 'ABSOLUTE';
  figma.currentPage.selection = [absoluteAutoLayoutChild];
  await smartAlign('CENTER', 'PARENT');

  assert.equal(absoluteAutoLayoutChild.x, 120);
  assert.equal(absoluteAutoLayoutChild.y, 80);
  assert.equal(notifications.at(-1)?.message, 'Aligned 1 item(s) to center (to parent)');

  notifications.length = 0;

  const tidyParent = { type: 'PAGE' };
  const tidyPrimarySelection = [
    createNode({ x: 0, y: 0, width: 100, height: 100, parent: tidyParent }),
    createNode({ x: 140, y: 0, width: 120, height: 100, parent: tidyParent }),
    createNode({ x: 300, y: 0, width: 100, height: 100, parent: tidyParent }),
  ];
  figma.currentPage.selection = tidyPrimarySelection;
  await setTidyGap('+10');

  assert.equal(tidyPrimarySelection[0].x, 0);
  assert.equal(tidyPrimarySelection[1].x, 150);
  assert.equal(tidyPrimarySelection[2].x, 320);
  assert.equal(notifications.at(-1)?.message, 'Tidy gap set to 50');

  notifications.length = 0;

  const tidyAutoSelection = [
    createNode({ x: 0, y: 0, width: 100, height: 100, parent: tidyParent }),
    createNode({ x: 140, y: 0, width: 100, height: 100, parent: tidyParent }),
    createNode({ x: 280, y: 0, width: 100, height: 100, parent: tidyParent }),
    createNode({ x: 440, y: 0, width: 100, height: 100, parent: tidyParent }),
  ];
  figma.currentPage.selection = tidyAutoSelection;
  await setTidyGap();

  assert.equal(tidyAutoSelection[0].x, 0);
  assert.equal(tidyAutoSelection[1].x, 140);
  assert.equal(tidyAutoSelection[2].x, 280);
  assert.equal(tidyAutoSelection[3].x, 420);
  assert.equal(notifications.at(-1)?.message, 'Tidy gap set to 40');

  notifications.length = 0;

  const tidyGridSelection = [
    createNode({ x: 0, y: 0, width: 100, height: 100, parent: tidyParent }),
    createNode({ x: 240, y: 0, width: 100, height: 100, parent: tidyParent }),
    createNode({ x: 480, y: 0, width: 100, height: 100, parent: tidyParent }),
    createNode({ x: 260, y: 220, width: 100, height: 100, parent: tidyParent }),
    createNode({ x: 500, y: 220, width: 100, height: 100, parent: tidyParent }),
  ];
  figma.currentPage.selection = tidyGridSelection;
  await setTidyGap();

  assert.equal(tidyGridSelection[0].x, 0);
  assert.equal(tidyGridSelection[1].x, 240);
  assert.equal(tidyGridSelection[2].x, 480);
  assert.equal(tidyGridSelection[3].x, 240);
  assert.equal(tidyGridSelection[4].x, 480);
  assert.equal(notifications.at(-1)?.message, 'Tidy gap set to 140');

  notifications.length = 0;

  const gridColumnGapNode = {
    type: 'FRAME',
    layoutMode: 'GRID',
    gridColumnGap: 40,
  };
  figma.currentPage.selection = [gridColumnGapNode];
  await setPrimaryGap('+8');

  assert.equal(gridColumnGapNode.gridColumnGap, 48);
  assert.equal(notifications.at(-1)?.message, 'Grid column gap set to +8');

  notifications.length = 0;

  const wrapGapNode = {
    type: 'FRAME',
    layoutMode: 'HORIZONTAL',
    layoutWrap: 'WRAP',
    counterAxisAlignContent: 'AUTO',
    counterAxisSpacing: 6,
  };
  figma.currentPage.selection = [wrapGapNode];
  await setCounterGap('AUTO');

  assert.equal(wrapGapNode.counterAxisAlignContent, 'SPACE_BETWEEN');
  assert.equal(wrapGapNode.counterAxisSpacing, 6);
  assert.equal(notifications.at(-1)?.message, 'Counter gap set to AUTO');

  notifications.length = 0;

  await setCounterGap('+4');

  assert.equal(wrapGapNode.counterAxisAlignContent, 'AUTO');
  assert.equal(wrapGapNode.counterAxisSpacing, 10);
  assert.equal(notifications.at(-1)?.message, 'Counter gap set to +4');

  notifications.length = 0;

  const tidyWrapParent = { type: 'PAGE' };
  const tidyWrapSelection = [
    createNode({ x: 0, y: 0, width: 100, height: 100, parent: tidyWrapParent }),
    createNode({ x: 140, y: 0, width: 100, height: 100, parent: tidyWrapParent }),
    createNode({ x: 0, y: 464, width: 100, height: 100, parent: tidyWrapParent }),
  ];
  figma.currentPage.selection = tidyWrapSelection;
  await setTidyRowGap('-64');

  assert.equal(tidyWrapSelection[2].y, 400);
  assert.equal(notifications.at(-1)?.message, 'Tidy row gap set to -64');

  notifications.length = 0;

  const gridRowGapNode = {
    type: 'FRAME',
    layoutMode: 'GRID',
    gridRowGap: 364,
  };
  figma.currentPage.selection = [gridRowGapNode];
  await setCounterGap('+12');

  assert.equal(gridRowGapNode.gridRowGap, 376);
  assert.equal(notifications.at(-1)?.message, 'Grid row gap set to +12');

  notifications.length = 0;

  const nonWrapNode = {
    type: 'FRAME',
    layoutMode: 'HORIZONTAL',
    layoutWrap: 'NO_WRAP',
    counterAxisAlignContent: 'AUTO',
    counterAxisSpacing: 12,
  };
  figma.currentPage.selection = [nonWrapNode];
  await setCounterGap('+4');

  assert.equal(nonWrapNode.counterAxisAlignContent, 'AUTO');
  assert.equal(nonWrapNode.counterAxisSpacing, 12);
  assert.equal(notifications.at(-1)?.message, 'Selected node must be a wrap auto-layout or grid layout');

  notifications.length = 0;

  const absoluteFillParent = {
    type: 'FRAME',
    layoutMode: 'HORIZONTAL',
    width: 320,
    height: 180,
  };
  const absoluteFillChild = {
    type: 'FRAME',
    layoutMode: 'NONE',
    layoutPositioning: 'ABSOLUTE',
    parent: absoluteFillParent,
    x: 24,
    y: 36,
    width: 80,
    height: 40,
    resize(width, height) {
      this.width = width;
      this.height = height;
    },
  };
  figma.currentPage.selection = [absoluteFillChild];
  layoutSizing('HORIZONTAL', 'FILL');

  assert.equal(absoluteFillChild.width, 320);
  assert.equal(absoluteFillChild.height, 40);
  assert.equal(absoluteFillChild.x, 0);
  assert.equal(absoluteFillChild.y, 36);
  assert.equal(absoluteFillChild.layoutMode, 'NONE');
  assert.equal(notifications.at(-1)?.message, 'Width matched to parent');

  notifications.length = 0;

  layoutSizing('VERTICAL', 'FILL');

  assert.equal(absoluteFillChild.width, 320);
  assert.equal(absoluteFillChild.height, 180);
  assert.equal(absoluteFillChild.x, 0);
  assert.equal(absoluteFillChild.y, 0);
  assert.equal(absoluteFillChild.layoutMode, 'NONE');
  assert.equal(notifications.at(-1)?.message, 'Height matched to parent');

  notifications.length = 0;

  const page = {
    children: [],
    appendChild(node) {
      const currentIndex = this.children.indexOf(node);
      if (currentIndex !== -1) {
        this.children.splice(currentIndex, 1);
      }
      this.children.push(node);
      node.parent = this;
    },
  };
  const selectedFrame = createFrameNode({
    x: 80,
    y: 40,
    width: 260,
    height: 120,
    parent: page,
    fills: [{ type: 'SOLID' }],
  });
  const rightChild = createNode({ x: 90, y: 12, width: 30, height: 24, parent: selectedFrame });
  const leftChild = createNode({ x: 20, y: 12, width: 40, height: 24, parent: selectedFrame });
  selectedFrame.children = [rightChild, leftChild];
  page.children = [selectedFrame];
  figma.currentPage.selection = [selectedFrame];

  createAutoLayout('HORIZONTAL');

  assert.equal(selectedFrame.layoutMode, 'HORIZONTAL');
  assert.equal(selectedFrame.itemSpacing, 30);
  assert.deepEqual(selectedFrame.children, [leftChild, rightChild]);
  assert.deepEqual(page.children, [selectedFrame]);
  assert.deepEqual(selectedFrame.fills, [{ type: 'SOLID' }]);
  assert.deepEqual(figma.currentPage.selection, [selectedFrame]);
  assert.equal(notifications.at(-1)?.message, 'Selected frame converted to horizontal auto-layout');

  console.log('layout implementation tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
