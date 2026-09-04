import assert from 'node:assert/strict';
import { createFigmaStub } from './helpers/figma-stub.js';

async function main() {
  const { figma, notifications } = createFigmaStub();
  const loadedFonts = [];
  figma.loadFontAsync = async (font) => {
    loadedFonts.push(font);
  };
  globalThis.figma = figma;

  const { setFontWeight, setTextAutoResize, textTruncation } = await import('../src/implementations/text.ts');

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

  loadedFonts.length = 0;
  notifications.length = 0;

  const weightNode = {
    type: 'TEXT',
    name: 'Weighted Copy',
    characters: 'body copy',
    fontName: { family: 'Inter', style: 'Regular' },
  };
  figma.listAvailableFontsAsync = async () => [
    { fontName: { family: 'Inter', style: 'Regular' } },
    { fontName: { family: 'Inter', style: 'Bold' } },
  ];
  figma.currentPage.selection = [weightNode];

  await setFontWeight('700');

  assert.deepEqual(weightNode.fontName, { family: 'Inter', style: 'Bold' });
  assert.deepEqual(loadedFonts, [{ family: 'Inter', style: 'Bold' }]);
  assert.equal(notifications.at(-1)?.message, 'Font weight set to 700');

  loadedFonts.length = 0;
  notifications.length = 0;
  const rangeFontUpdates = [];
  const mixedWeightNode = {
    type: 'TEXT',
    name: 'Mixed Weighted Copy',
    characters: 'mixed copy',
    fontName: figma.mixed,
    getStyledTextSegments(fields) {
      assert.deepEqual(fields, ['fontName']);
      return [
        { start: 0, end: 5, characters: 'mixed', fontName: { family: 'Inter', style: 'Regular' } },
        { start: 5, end: 10, characters: ' copy', fontName: { family: 'Roboto', style: 'Italic' } },
      ];
    },
    setRangeFontName(start, end, fontName) {
      rangeFontUpdates.push({ start, end, fontName });
    },
  };
  figma.listAvailableFontsAsync = async () => [
    { fontName: { family: 'Inter', style: 'Semi Bold' } },
    { fontName: { family: 'Roboto', style: 'SemiBold Italic' } },
  ];
  figma.currentPage.selection = [mixedWeightNode];

  await setFontWeight('600');

  assert.deepEqual(rangeFontUpdates, [
    { start: 0, end: 5, fontName: { family: 'Inter', style: 'Semi Bold' } },
    { start: 5, end: 10, fontName: { family: 'Roboto', style: 'SemiBold Italic' } },
  ]);
  assert.equal(notifications.at(-1)?.message, 'Font weight set to 600');

  loadedFonts.length = 0;
  notifications.length = 0;
  figma.listAvailableFontsAsync = async () => [
    { fontName: { family: 'Inter', style: 'Regular' } },
  ];
  figma.loadFontAsync = async (font) => {
    loadedFonts.push(font);
    throw new Error('Font is not available');
  };
  weightNode.fontName = { family: 'Inter', style: 'Regular' };

  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    await assert.rejects(
      () => setFontWeight('700'),
      /Font weight 700 is not available/
    );
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(
    notifications.some(({ message }) => message === 'Font weight set to 700'),
    false,
    'font weight should not report success after every candidate fails'
  );

  console.log('text implementation tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
