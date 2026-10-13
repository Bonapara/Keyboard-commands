// Figma runs plugins in QuickJS, which can't compile a for…of / for…in loop
// over a `yield` ("InternalError: stack underflow") and then refuses to load
// the whole plugin. The es6 build turns `await` into `yield`, so
// `for (const x of await list())` has to await into a variable first.
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';

const { outputFiles } = buildSync({
  entryPoints: ['src/index.ts'],
  bundle: true,
  target: 'es6',
  minify: true,
  write: false,
});

const loopsOverYield = outputFiles[0].text.match(/.{0,60}\b(?:of|in)\s*\(?\s*yield\b.{0,40}/g) || [];
assert.deepEqual(loopsOverYield, [], 'a loop over an awaited value breaks the plugin in Figma; await into a variable first');

console.log('QuickJS compatibility tests passed');
