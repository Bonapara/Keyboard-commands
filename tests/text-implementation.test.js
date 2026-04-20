import assert from 'node:assert/strict';
import { createFigmaStub } from './helpers/figma-stub.js';

async function main() {
  const { figma, notifications } = createFigmaStub();
  const loadedFonts = [];
  figma.loadFontAsync = async (font) => {
    loadedFonts.push(font);
  };
  globalThis.figma = figma;

  const { setTextAutoResize, textTruncation } = await import('../src/implementations/text.ts');

  const mixedFontNode = {
    type: 'TEXT',
    name: 'Mixed Label',
    characters: 'hello world',
    fontName: figma.mixed,
    textAutoResize: 'NONE',
    textTruncation: 'DISABLED',
    maxLines: null,
    getRangeAllFontNames(start, end) {
      assert.equal(start, 0);
      assert.equal(end, this.characters.length);
      return [
        { family: 'Inter', style: 'Regular' },
        { family: 'Inter', style: 'Bold' },
        { family: 'Inter', style: 'Regular' },
      ];
    },
  };

  figma.currentPage.selection = [mixedFontNode];
  await setTextAutoResize('HEIGHT');

  assert.equal(mixedFontNode.textAutoResize, 'HEIGHT');
  assert.deepEqual(loadedFonts, [
    { family: 'Inter', style: 'Regular' },
    { family: 'Inter', style: 'Bold' },
  ]);
  assert.equal(notifications.at(-1)?.message, 'Text auto-resize set to height');

  loadedFonts.length = 0;
  notifications.length = 0;

  await textTruncation('3');

  assert.equal(mixedFontNode.textTruncation, 'ENDING');
  assert.equal(mixedFontNode.maxLines, 3);
  assert.deepEqual(loadedFonts, [
    { family: 'Inter', style: 'Regular' },
    { family: 'Inter', style: 'Bold' },
  ]);
  assert.equal(notifications.at(-1)?.message, 'Text truncation set to 3 lines');

  loadedFonts.length = 0;
  notifications.length = 0;

  const truncatingNode = {
    type: 'TEXT',
    name: 'Fixed Copy',
    characters: 'body copy',
    fontName: { family: 'Inter', style: 'Regular' },
    textAutoResize: 'HEIGHT',
    textTruncation: 'ENDING',
    maxLines: 4,
  };

  figma.currentPage.selection = [truncatingNode];
  await textTruncation();

  assert.equal(truncatingNode.textTruncation, 'DISABLED');
  assert.equal(truncatingNode.maxLines, null);
  assert.deepEqual(loadedFonts, [{ family: 'Inter', style: 'Regular' }]);
  assert.equal(notifications.at(-1)?.message, 'Text truncation disabled');

  console.log('text implementation tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
