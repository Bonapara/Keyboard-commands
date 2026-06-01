import assert from 'node:assert/strict';
import { createFigmaStub } from './helpers/figma-stub.js';

function createReorderableParent({
  layoutMode = 'NONE',
  itemReverseZIndex = false,
} = {}) {
  return {
    id: `parent-${layoutMode}-${itemReverseZIndex}`,
    type: 'FRAME',
    name: 'Reorder Parent',
    layoutMode,
    itemReverseZIndex,
    children: [],
    insertChild(index, node) {
      const currentIndex = this.children.indexOf(node);
      if (currentIndex !== -1) {
        this.children.splice(currentIndex, 1);
      }
      const insertionIndex = currentIndex !== -1 && currentIndex < index ? index - 1 : index;
      this.children.splice(insertionIndex, 0, node);
      node.parent = this;
    },
  };
}

function createReorderChild(id, parent) {
  return { id, type: 'FRAME', name: id, parent };
}

function resetChildren(parent, children) {
  parent.children = children;
  for (const child of children) {
    child.parent = parent;
  }
}

function childIds(parent) {
  return parent.children.map(child => child.id);
}

async function main() {
  const { figma, notifications } = createFigmaStub();
  globalThis.figma = figma;

  const { selectParent, selectChildren, reorderLayer } = await import('../src/implementations/selection.ts');

  const page = { id: 'page', type: 'PAGE', name: 'Page' };

  const parentA = { id: 'parent-a', type: 'FRAME', name: 'Parent A', parent: page, children: [] };
  const parentB = { id: 'parent-b', type: 'GROUP', name: 'Parent B', parent: page, children: [] };

  const childA = { id: 'child-a', type: 'FRAME', name: 'Child A', parent: parentA };
  const childB = { id: 'child-b', type: 'COMPONENT', name: 'Child B', parent: parentA };
  const childC = { id: 'child-c', type: 'RECTANGLE', name: 'Child C', parent: parentB };

  parentA.children = [childA, childB];
  parentB.children = [childC];

  figma.currentPage.selection = [childA, childB, childC];
  selectParent();

  assert.deepEqual(
    figma.currentPage.selection,
    [parentA, parentB],
    'selectParent should dedupe shared parents and preserve order'
  );
  assert.equal(notifications.at(-1)?.message, 'Selected 2 parent layers');

  notifications.length = 0;

  selectChildren();

  assert.deepEqual(
    figma.currentPage.selection,
    [childA, childB, childC],
    'selectChildren should collect direct children from each selected container'
  );
  assert.equal(notifications.at(-1)?.message, 'Selected 3 child layers');

  notifications.length = 0;
  figma.currentPage.selection = [parentA];
  selectParent();

  assert.deepEqual(
    figma.currentPage.selection,
    [parentA],
    'selectParent should leave the selection unchanged when already at page level'
  );
  assert.equal(notifications.at(-1)?.message, 'Selection is already at the page level');

  notifications.length = 0;
  figma.currentPage.selection = [childA];
  selectChildren();

  assert.deepEqual(
    figma.currentPage.selection,
    [childA],
    'selectChildren should leave non-container selections unchanged'
  );
  assert.equal(notifications.at(-1)?.message, 'Selection has no children');

  const normalParent = createReorderableParent({ layoutMode: 'HORIZONTAL' });
  const normalA = createReorderChild('normal-a', normalParent);
  const normalB = createReorderChild('normal-b', normalParent);
  const normalC = createReorderChild('normal-c', normalParent);
  const normalD = createReorderChild('normal-d', normalParent);
  resetChildren(normalParent, [normalA, normalB, normalC, normalD]);

  figma.currentPage.selection = [normalB];
  await reorderLayer('FRONT');

  assert.deepEqual(
    childIds(normalParent),
    ['normal-a', 'normal-c', 'normal-d', 'normal-b'],
    'normal auto-layout parents should still use the last child as visually front'
  );

  const reversedParent = createReorderableParent({
    layoutMode: 'HORIZONTAL',
    itemReverseZIndex: true,
  });
  const reverseA = createReorderChild('reverse-a', reversedParent);
  const reverseB = createReorderChild('reverse-b', reversedParent);
  const reverseC = createReorderChild('reverse-c', reversedParent);
  const reverseD = createReorderChild('reverse-d', reversedParent);
  resetChildren(reversedParent, [reverseA, reverseB, reverseC, reverseD]);

  figma.currentPage.selection = [reverseC];
  await reorderLayer('FRONT');

  assert.deepEqual(
    childIds(reversedParent),
    ['reverse-c', 'reverse-a', 'reverse-b', 'reverse-d'],
    'reversed auto-layout parents should use the first child as visually front'
  );

  resetChildren(reversedParent, [reverseA, reverseB, reverseC, reverseD]);

  figma.currentPage.selection = [reverseB];
  await reorderLayer('FORWARD');

  assert.deepEqual(
    childIds(reversedParent),
    ['reverse-b', 'reverse-a', 'reverse-c', 'reverse-d'],
    'bring forward should move toward the first child when auto-layout z-index is reversed'
  );

  console.log('selection implementation tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
