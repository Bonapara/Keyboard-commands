import assert from 'node:assert/strict';
import * as LZString from 'lz-string';
import { createFigmaStub } from './helpers/figma-stub.js';

const ACTIVE_LIBRARIES_KEY = 'KB_COMMANDS_ACTIVE_LIBRARIES';

async function main() {
  const initialLibraries = {
    Core: [
      ['Blue / 500', 'style-blue-500', 'PAINT'],
    ],
  };

  const { figma, storage } = createFigmaStub({
    storageSeed: {
      KB_COMMANDS_LIBRARY_DATA: LZString.compressToUTF16(JSON.stringify(initialLibraries)),
    },
  });
  globalThis.figma = figma;

  const [
    { getStoredLibraries, saveLibraries, STORAGE_KEY, getActiveLibraries, setActiveLibraries },
    { getHistory, recordHistory },
  ] = await Promise.all([
    import('../src/storage.ts'),
    import('../src/history.ts'),
  ]);

  assert.deepEqual(await getStoredLibraries(), initialLibraries);

  const nextLibraries = {
    Icons: [
      ['Arrow Right', 'component-arrow-right', 'COMPONENT', 'UIKit'],
    ],
  };

  await saveLibraries(nextLibraries);
  const compressedLibraries = storage.get(STORAGE_KEY);
  assert.equal(typeof compressedLibraries, 'string');
  assert.notEqual(compressedLibraries, JSON.stringify(nextLibraries));
  assert.deepEqual(
    JSON.parse(LZString.decompressFromUTF16(compressedLibraries)),
    nextLibraries
  );

  assert.deepEqual(await getActiveLibraries(), []);
  await setActiveLibraries(['Core', 'Icons']);
  assert.deepEqual(storage.get(ACTIVE_LIBRARIES_KEY), ['Core', 'Icons']);
  assert.deepEqual(await getActiveLibraries(), ['Core', 'Icons']);

  assert.deepEqual(await getHistory(), []);
  await recordHistory('  w100  ');
  await recordHistory('h200');
  await recordHistory('w100');
  assert.deepEqual(await getHistory(), ['w100', 'h200']);

  for (let index = 0; index < 12; index += 1) {
    await recordHistory(`cmd${index}`);
  }

  const history = await getHistory();
  assert.equal(history.length, 10);
  assert.equal(history[0], 'cmd11');
  assert.equal(history.at(-1), 'cmd2');

  console.log('persistence tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
