import assert from 'node:assert/strict';
import { createFigmaStub } from './helpers/figma-stub.js';

function createNativeAspectRatioNode({ targetAspectRatio = null } = {}) {
  return {
    type: 'RECTANGLE',
    width: 120,
    height: 80,
    targetAspectRatio,
    lockCalls: 0,
    unlockCalls: 0,
    lockAspectRatio() {
      this.lockCalls += 1;
      this.targetAspectRatio = { x: this.width, y: this.height };
    },
    unlockAspectRatio() {
      this.unlockCalls += 1;
      this.targetAspectRatio = null;
    },
  };
}

async function main() {
  const { figma, notifications } = createFigmaStub();
  globalThis.figma = figma;

  const { toggleAspectRatioLock } = await import('../src/implementations/sizing.ts');

  const unlockedNode = createNativeAspectRatioNode();
  figma.currentPage.selection = [unlockedNode];
  toggleAspectRatioLock();

  assert.deepEqual(unlockedNode.targetAspectRatio, { x: 120, y: 80 });
  assert.equal(unlockedNode.lockCalls, 1);
  assert.equal(unlockedNode.unlockCalls, 0);
  assert.equal(notifications.at(-1)?.message, 'Locked aspect ratio');

  notifications.length = 0;

  const lockedNode = createNativeAspectRatioNode({ targetAspectRatio: { x: 3, y: 2 } });
  figma.currentPage.selection = [lockedNode];
  toggleAspectRatioLock();

  assert.equal(lockedNode.targetAspectRatio, null);
  assert.equal(lockedNode.lockCalls, 0);
  assert.equal(lockedNode.unlockCalls, 1);
  assert.equal(notifications.at(-1)?.message, 'Unlocked aspect ratio');

  notifications.length = 0;

  const mixedUnlockedNode = createNativeAspectRatioNode();
  const mixedLockedNode = createNativeAspectRatioNode({ targetAspectRatio: { x: 1, y: 1 } });
  figma.currentPage.selection = [mixedUnlockedNode, mixedLockedNode];
  toggleAspectRatioLock();

  assert.deepEqual(mixedUnlockedNode.targetAspectRatio, { x: 120, y: 80 });
  assert.deepEqual(mixedLockedNode.targetAspectRatio, { x: 120, y: 80 });
  assert.equal(notifications.at(-1)?.message, 'Locked aspect ratio');

  notifications.length = 0;

  const legacyNode = {
    type: 'LINE',
    constrainProportions: false,
  };
  figma.currentPage.selection = [legacyNode];
  toggleAspectRatioLock();

  assert.equal(legacyNode.constrainProportions, true);
  assert.equal(notifications.at(-1)?.message, 'Locked aspect ratio');

  notifications.length = 0;

  figma.currentPage.selection = [{ type: 'SLICE' }];
  assert.throws(
    () => toggleAspectRatioLock(),
    /Selected items must support aspect ratio lock/
  );
  assert.equal(notifications.length, 0);

  console.log('sizing implementation tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
