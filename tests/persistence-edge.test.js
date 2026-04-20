import assert from 'node:assert/strict';
import * as LZString from 'lz-string';
import { createFigmaStub } from './helpers/figma-stub.js';

const LIBRARY_STORAGE_KEY = 'KB_COMMANDS_LIBRARY_DATA';
const HISTORY_KEY = 'KB_COMMANDS_HISTORY';
const RECENT_KEY = 'KB_COMMANDS_RECENT_VALUES';

async function main() {
  const originalConsoleError = console.error;
  const loggedErrors = [];
  console.error = (...args) => {
    loggedErrors.push(args);
  };

  try {
    const corruptLibraries = createFigmaStub({
      storageSeed: {
        [LIBRARY_STORAGE_KEY]: LZString.compressToUTF16('not-json'),
      },
    });
    globalThis.figma = corruptLibraries.figma;

    const { getStoredLibraries, saveLibraries, STORAGE_KEY } = await import('../src/storage.ts');

    assert.deepEqual(
      await getStoredLibraries(),
      {},
      'corrupted compressed library data should recover to an empty library map'
    );
    assert.equal(loggedErrors.length, 1, 'corrupted library data should be logged once');

    const recoveredLibraries = {
      Recovery: [['Blue / 500', 'style-blue-500', 'PAINT']],
    };
    await saveLibraries(recoveredLibraries);

    const rewrittenLibraries = corruptLibraries.storage.get(STORAGE_KEY);
    assert.equal(typeof rewrittenLibraries, 'string');
    assert.deepEqual(
      JSON.parse(LZString.decompressFromUTF16(rewrittenLibraries)),
      recoveredLibraries,
      'saveLibraries should still overwrite corrupted storage with valid compressed data'
    );

    const invalidHistory = createFigmaStub({
      storageSeed: {
        [HISTORY_KEY]: 'not-an-array',
      },
    });
    globalThis.figma = invalidHistory.figma;

    const { getHistory, recordHistory } = await import('../src/history.ts');

    assert.deepEqual(
      await getHistory(),
      [],
      'non-array history storage should recover to an empty history list'
    );

    await recordHistory('w100');
    assert.deepEqual(
      invalidHistory.storage.get(HISTORY_KEY),
      ['w100'],
      'recordHistory should rebuild storage from an invalid history payload'
    );

    const invalidRecents = createFigmaStub({
      storageSeed: {
        [RECENT_KEY]: 'not-an-object',
      },
    });
    globalThis.figma = invalidRecents.figma;

    const { getRecentValues, recordRecentValue } = await import('../src/recent-values.ts');

    assert.deepEqual(
      await getRecentValues('Fill'),
      [],
      'non-object recent-values storage should recover to an empty recent-values map'
    );

    await recordRecentValue('Fill', 'blue');
    assert.deepEqual(
      invalidRecents.storage.get(RECENT_KEY),
      { Fill: ['blue'] },
      'recordRecentValue should rebuild storage from an invalid recent-values payload'
    );

    console.log('persistence edge-case tests passed');
  } finally {
    console.error = originalConsoleError;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
