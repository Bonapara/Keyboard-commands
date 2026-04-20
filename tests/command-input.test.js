import assert from 'node:assert/strict';
import { applyDropdownSelection, replaceLastCommandToken } from '../src/command-input.ts';
import {
  buildExecutionPlan,
  parseBindingSegment,
  parseTypedBindingSegment,
} from '../src/command-execution-plan.ts';

const isKnownCommand = (name) => ['AlignCenterRight', 'HorizontalFill', 'Width'].includes(name);

assert.equal(replaceLastCommandToken('', 'AlignCenterRight'), 'AlignCenterRight');
assert.equal(replaceLastCommandToken('hf a', 'AlignCenterRight'), 'hf AlignCenterRight');
assert.equal(replaceLastCommandToken('hf, a', 'AlignCenterRight'), 'hf, AlignCenterRight');
assert.equal(replaceLastCommandToken('w100  a', 'AlignCenterRight'), 'w100  AlignCenterRight');
assert.equal(replaceLastCommandToken('hf,', 'Width:100'), 'hf, Width:100');
assert.equal(replaceLastCommandToken('hf, ', 'Width:100'), 'hf, Width:100');

assert.equal(
  applyDropdownSelection('hf a', 'acr, arc · AlignCenterRight -- Align Center Right', isKnownCommand),
  'hf AlignCenterRight'
);

assert.equal(
  applyDropdownSelection('w100  a', 'acr, arc · AlignCenterRight -- Align Center Right', isKnownCommand),
  'w100  AlignCenterRight'
);

assert.equal(
  applyDropdownSelection('hf, a', 'acr, arc · AlignCenterRight -- Align Center Right', isKnownCommand),
  'hf, AlignCenterRight'
);

assert.equal(
  applyDropdownSelection('hf, ', 'Width:100', isKnownCommand),
  'hf, Width:100'
);

assert.equal(
  applyDropdownSelection('hf  ', 'Width:100', isKnownCommand),
  'hf  Width:100'
);

assert.equal(
  applyDropdownSelection('hf  ', 'acr, arc · AlignCenterRight -- Align Center Right', isKnownCommand),
  'hf  AlignCenterRight'
);

assert.equal(
  applyDropdownSelection('hf a', 'HorizontalFill | AlignCenterRight', isKnownCommand),
  'hf a'
);

assert.equal(
  applyDropdownSelection('f?blu', 'Blue / 500', isKnownCommand),
  'f?blu'
);

assert.equal(
  applyDropdownSelection('hf x', 'Width:100', isKnownCommand),
  'hf Width:100'
);

assert.equal(
  applyDropdownSelection('hf a', 'brand · blue', isKnownCommand),
  'hf a'
);

assert.equal(
  applyDropdownSelection('', 'Width:100', isKnownCommand),
  'Width:100'
);

assert.deepEqual(
  buildExecutionPlan(['hf', 'f?blue', 'acr']),
  [
    { kind: 'simple', command: 'hf' },
    {
      kind: 'binding',
      parsed: { prefix: '', alias: 'f', value: 'blue' },
    },
    { kind: 'simple', command: 'acr' },
  ]
);

assert.deepEqual(
  buildExecutionPlan(['w100 hf f?blue', 'acr']),
  [
    { kind: 'simple', command: 'w100' },
    { kind: 'simple', command: 'hf' },
    {
      kind: 'binding',
      parsed: { prefix: 'w100 hf', alias: 'f', value: 'blue' },
    },
    { kind: 'simple', command: 'acr' },
  ]
);

// Two bindings in the same segment (single-space separated) must split into
// two steps. Without the split, "bc;red" was swallowed into Fill's value and
// fuzzy-matched the wrong style.
assert.deepEqual(
  buildExecutionPlan(['f?white bc;red']),
  [
    {
      kind: 'binding',
      parsed: { prefix: '', alias: 'f', value: 'white' },
    },
    {
      kind: 'binding',
      parsed: { prefix: '', alias: 'bc', value: 'red' },
    },
  ]
);

assert.deepEqual(
  buildExecutionPlan(['f?white and bc;border medium']),
  [
    {
      kind: 'binding',
      parsed: { prefix: '', alias: 'f', value: 'white and' },
    },
    {
      kind: 'binding',
      parsed: { prefix: '', alias: 'bc', value: 'border medium' },
    },
  ]
);

assert.deepEqual(
  buildExecutionPlan(['hf', 'f?blue', 'w100', 's?primary']),
  [
    { kind: 'simple', command: 'hf' },
    {
      kind: 'binding',
      parsed: { prefix: '', alias: 'f', value: 'blue' },
    },
    { kind: 'simple', command: 'w100' },
    {
      kind: 'binding',
      parsed: { prefix: '', alias: 's', value: 'primary' },
    },
  ]
);

// parseBindingSegment — lenient, used during execution
assert.deepEqual(parseBindingSegment('f?blue'), { prefix: '', alias: 'f', value: 'blue' });
assert.deepEqual(parseBindingSegment('hf f?blue'), { prefix: 'hf', alias: 'f', value: 'blue' });
assert.deepEqual(parseBindingSegment('w100f?blue'), { prefix: 'w100', alias: 'f', value: 'blue' });
assert.deepEqual(parseBindingSegment('9f?blue'), { prefix: '9', alias: 'f', value: 'blue' });
assert.equal(parseBindingSegment('no-binding-here'), null);

// parseTypedBindingSegment — strict, used while user types (suggestions).
// Must not match when a non-whitespace prefix is mashed against the alias.
assert.deepEqual(parseTypedBindingSegment('f?blue'), { alias: 'f', searchTerm: 'blue' });
assert.deepEqual(parseTypedBindingSegment('hf f?blue'), { alias: 'f', searchTerm: 'blue' });
assert.deepEqual(parseTypedBindingSegment('hff?blue'), { alias: 'hff', searchTerm: 'blue' });
assert.equal(parseTypedBindingSegment('w100f?blue'), null);
assert.equal(parseTypedBindingSegment('9f?blue'), null);
assert.equal(parseTypedBindingSegment('no-binding-here'), null);

// ";" is accepted as an AZERTY-friendly alternative to "?", and works everywhere "?" does.
assert.deepEqual(parseBindingSegment('f;blue'), { prefix: '', alias: 'f', value: 'blue' });
assert.deepEqual(parseBindingSegment('hf f;blue'), { prefix: 'hf', alias: 'f', value: 'blue' });
assert.deepEqual(parseTypedBindingSegment('f;blue'), { alias: 'f', searchTerm: 'blue' });
assert.deepEqual(parseTypedBindingSegment('hf f;blue'), { alias: 'f', searchTerm: 'blue' });
assert.deepEqual(parseTypedBindingSegment('hff;blue'), { alias: 'hff', searchTerm: 'blue' });

// Dropdown selections with ";" binding input must also pass through untouched,
// matching the "?" behavior (selection is resolved later per segment).
assert.equal(
  applyDropdownSelection('f;blu', 'Blue / 500', isKnownCommand),
  'f;blu'
);

console.log('command-input tests passed');
