import assert from 'node:assert/strict';
import { createFigmaStub } from './helpers/figma-stub.js';

async function main() {
  const { figma, notifications } = createFigmaStub();
  globalThis.figma = figma;

  const { selectParent, selectChildren } = await import('../src/implementations/selection.ts');

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

  console.log('selection implementation tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
