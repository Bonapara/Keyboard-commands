import assert from 'node:assert/strict';
import { createFigmaStub } from './helpers/figma-stub.js';

// One document for every case: an lp index with "Core UI" and "Icons", two
// unpublished local components, and the selections a designer swaps from.

function variantName(values) {
  return Object.entries(values).map(([property, value]) => `${property}=${value}`).join(', ');
}

function parseVariantName(name) {
  return Object.fromEntries(name.split(', ').map(part => part.split('=')));
}

function combinations(properties) {
  return Object.entries(properties).reduce(
    (combos, [property, options]) => combos.flatMap(combo => options.map(option => ({ ...combo, [property]: option }))),
    [{}]
  );
}

function remoteSet(name, properties, missing = []) {
  const set = {
    type: 'COMPONENT_SET',
    id: `remote:${name}`,
    key: `set:${name}`,
    name,
    parent: null,
    componentPropertyDefinitions: Object.fromEntries(Object.entries(properties).map(([property, options]) => [
      property,
      { type: 'VARIANT', variantOptions: options, defaultValue: options[0] },
    ])),
  };
  set.children = combinations(properties)
    .filter(combo => !missing.some(gap => Object.entries(gap).every(([property, value]) => combo[property] === value)))
    .map(combo => ({
      type: 'COMPONENT',
      id: `remote:${name}:${variantName(combo)}`,
      key: `v:${name}:${variantName(combo)}`,
      name: variantName(combo),
      parent: set,
    }));
  set.defaultVariant = set.children[0];
  return set;
}

function remoteComponent(name) {
  return { type: 'COMPONENT', id: `remote:${name}`, key: `c:${name}`, name, parent: null, componentPropertyDefinitions: {} };
}

function variantOf(set, values) {
  const wanted = variantName(values);
  return set.children.find(variant => variant.name === wanted);
}

// Behaves like a Figma instance: variant properties come from its main
// component, and setProperties only lands on combinations that exist.
function createInstance(id, mainComponent, { parent = null, propertyReference = null } = {}) {
  return {
    type: 'INSTANCE',
    id,
    name: id,
    parent,
    main: mainComponent,
    swappedTo: [],
    componentPropertyReferences: propertyReference ? { mainComponent: propertyReference } : null,
    get componentProperties() {
      return Object.fromEntries(Object.entries(parseVariantName(this.main.name)).map(([property, value]) => [
        property,
        { type: 'VARIANT', value },
      ]));
    },
    async getMainComponentAsync() {
      return this.main;
    },
    swapComponent(component) {
      this.swappedTo.push(component.key);
      this.main = component;
    },
    setProperties(properties) {
      const wanted = { ...parseVariantName(this.main.name), ...properties };
      const match = this.main.parent?.children.find(variant => variant.name === variantName(wanted));
      if (!match) throw new Error('Unable to find a variant with those property values');
      this.main = match;
    },
  };
}

const ICONS = ['Add item', 'Arrow right', 'Calendar plus', 'Check', 'Chevron right', 'Folder plus', 'Minus', 'Plus', 'Plus circle', 'Plus square', 'User plus'];
const iconSets = Object.fromEntries(ICONS.map(name => [name, remoteSet(`Icon/${name}`, { Size: ['16', '20', '24'] })]));
const buttonSet = remoteSet('Buttons/Button', {
  Variant: ['Primary', 'Secondary', 'Ghost'],
  Size: ['Small', 'Medium', 'Large'],
  State: ['Default', 'Hover'],
});
const splitButtonSet = remoteSet('Buttons/Split button', { Variant: ['Primary', 'Secondary'], Size: ['Medium', 'Large'] }, [
  { Variant: 'Secondary', Size: 'Large' },
]);
const coreComponents = [remoteComponent('Buttons/Button group'), remoteComponent('Buttons/Icon button')];
const remoteSets = [...Object.values(iconSets), buttonSet, splitButtonSet];
const remoteNodes = [...remoteSets, ...remoteSets.flatMap(set => set.children), ...coreComponents];

const page = { type: 'PAGE', id: 'page', name: 'Checkout', parent: null };
const localComponents = [
  { type: 'COMPONENT', id: 'local:plus-badge', key: 'k:plus-badge', name: 'Checkout/Plus badge', parent: page, componentPropertyDefinitions: {} },
  // A detached copy that shares the name of a library icon.
  { type: 'COMPONENT', id: 'local:minus-copy', key: 'k:minus-copy', name: 'Icon/Minus', parent: page, componentPropertyDefinitions: {} },
  { type: 'COMPONENT', id: 'local:spark', key: 'k:spark', name: 'Icon/Spark', parent: page, componentPropertyDefinitions: {} },
];

const { figma, notifications } = createFigmaStub({ rootName: 'Checkout' });
let setImports = 0;
figma.loadAllPagesAsync = async () => {};
figma.root.findAllWithCriteria = ({ types }) => localComponents.filter(node => types.includes(node.type));
figma.root.findOne = predicate => localComponents.find(predicate) ?? null;
figma.getNodeByIdAsync = async id => [...localComponents, ...remoteNodes].find(node => node.id === id) ?? null;
figma.importComponentByKeyAsync = async key => {
  const node = remoteNodes.find(candidate => candidate.type === 'COMPONENT' && candidate.key === key);
  if (!node) throw new Error(`Component ${key} is not published`);
  return node;
};
figma.importComponentSetByKeyAsync = async key => {
  setImports++;
  const node = remoteSets.find(candidate => candidate.key === key);
  if (!node) throw new Error(`Component set ${key} is not published`);
  return node;
};
globalThis.figma = figma;

async function main() {
  const { saveLibraries, setActiveLibraries } = await import('../src/storage.ts');
  const { searchComponentsForSwap, swapInstance } = await import('../src/implementations/instance.ts');

  await saveLibraries({
    'Core UI': [
      ...[buttonSet, splitButtonSet].map(set => [set.name, set.defaultVariant.key, 'COMPONENT']),
      ...coreComponents.map(component => [component.name, component.key, 'COMPONENT']),
    ],
    Icons: Object.values(iconSets).map(set => [set.name, set.defaultVariant.key, 'COMPONENT']),
  });
  await setActiveLibraries(['Core UI', 'Icons']);

  const frame = { type: 'FRAME', id: 'row', name: 'List row', parent: page };
  const buttonMain = {
    type: 'COMPONENT',
    id: 'local:button',
    name: 'Button',
    parent: null,
    componentPropertyDefinitions: {
      'Icon#1:0': {
        type: 'INSTANCE_SWAP',
        defaultValue: iconSets['Arrow right'].defaultVariant.id,
        preferredValues: [
        ...['Plus', 'Minus', 'Check'].map(name => ({ type: 'COMPONENT_SET', key: iconSets[name].key })),
        { type: 'COMPONENT', key: 'k:spark' },
      ],
      },
    },
  };
  const buttonInstance = { type: 'INSTANCE', id: 'button', name: 'Button', parent: frame, async getMainComponentAsync() { return buttonMain; } };

  const selections = {
    rowIcon: () => [createInstance('row-icon', variantOf(iconSets['Chevron right'], { Size: '20' }), { parent: frame })],
    nestedIcon: () => [createInstance('nested-icon', variantOf(iconSets['Arrow right'], { Size: '16' }), {
      parent: buttonInstance,
      propertyReference: 'Icon#1:0',
    })],
    buttons: () => ['back', 'save', 'skip'].map(id => createInstance(id, variantOf(buttonSet, {
      Variant: 'Secondary',
      Size: 'Large',
      State: 'Hover',
    }), { parent: frame })),
  };

  function rowText(row) {
    return typeof row === 'string' ? row : row.name;
  }

  function rowValue(row) {
    return typeof row === 'string' ? row : row.data;
  }

  // "★ Plus · preferred    ↵ keeps Size=16" or "Icon/Plus (Icons)" → "Plus"
  function rowComponent(row) {
    const label = rowText(row).replace(/^[★↻] /, '').split(/ · | \(/)[0];
    return label.slice(label.lastIndexOf('/') + 1);
  }

  const cases = [];
  const test = (name, fn) => cases.push({ name, fn });

  test('the top row is the closest match for what was typed', async () => {
    const table = [
      ['rowIcon', 'plus', 'Plus'],
      ['rowIcon', ' plus', 'Plus'],
      ['rowIcon', 'right arrow', 'Arrow right'],
      ['rowIcon', 'plus badge', 'Plus badge'],
      ['buttons', 'btn', 'Button group'],
      ['buttons', 'buton', 'Button group'],
    ];

    const results = [];
    for (const [selection, query] of table) {
      figma.currentPage.selection = selections[selection]();
      results.push([selection, query, rowComponent((await searchComponentsForSwap(query))[0])]);
    }

    assert.deepEqual(results, table);
  });

  test("the selection's current component is not offered", async () => {
    figma.currentPage.selection = selections.rowIcon();
    const rows = await searchComponentsForSwap('chevron');
    assert.ok(rows.every(row => rowComponent(row) !== 'Chevron right'), rows.map(rowText).join('\n'));
  });

  test('a preferred component swaps to that component, not a same-named local layer', async () => {
    const [instance] = selections.nestedIcon();
    figma.currentPage.selection = [instance];
    const rows = await searchComponentsForSwap('');
    const minus = rows.find(row => /minus/i.test(rowText(row)) && /preferred|External/.test(rowText(row)));
    assert.ok(minus, rows.map(rowText).join('\n'));

    await swapInstance(rowValue(minus));
    assert.deepEqual(instance.swappedTo, [variantOf(iconSets.Minus, { Size: '16' }).key]);
  });

  test('a component is only marked preferred for the selection that prefers it', async () => {
    figma.currentPage.selection = selections.nestedIcon();
    const preferredSpark = (await searchComponentsForSwap('spark'))[0];
    figma.currentPage.selection = selections.rowIcon();
    const plainSpark = (await searchComponentsForSwap('spark'))[0];
    const withoutHint = row => rowText(row).replace(/ {4}↵.*$/, '');
    assert.deepEqual([preferredSpark, plainSpark].map(withoutHint), ['★ Spark · preferred', 'Spark · this file']);
  });

  test('preferred components are imported once per run, not on every keystroke', async () => {
    figma.currentPage.selection = selections.nestedIcon();
    await searchComponentsForSwap('');
    const afterFirstKeystroke = setImports;
    await searchComponentsForSwap('p');
    await searchComponentsForSwap('pl');
    assert.equal(setImports, afterFirstKeystroke);
  });

  test('a name that is not in the index fails instead of swapping to a partial match', async () => {
    const [instance] = selections.rowIcon();
    figma.currentPage.selection = [instance];
    notifications.length = 0;
    await swapInstance('Icon/Add (Icons)');
    assert.deepEqual(
      { swappedTo: instance.swappedTo, error: notifications.at(-1)?.options?.error === true },
      { swappedTo: [], error: true }
    );
  });

  test('the swap lands on the closest variant that exists and says what it kept', async () => {
    const instances = selections.buttons();
    figma.currentPage.selection = instances;
    notifications.length = 0;
    await swapInstance(rowValue((await searchComponentsForSwap('split'))[0]));

    assert.deepEqual(
      { variants: instances.map(instance => instance.main.name), message: notifications.at(-1)?.message },
      {
        variants: Array(3).fill('Variant=Secondary, Size=Medium'),
        message: 'Swapped 3 → Split button · kept Variant=Secondary · reset Size, State',
      }
    );
  });

  let failures = 0;
  for (const { name, fn } of cases) {
    try {
      await fn();
    } catch (error) {
      failures++;
      console.error(`✗ ${name}\n${error.message}\n`);
    }
  }

  if (failures > 0) {
    console.error(`${failures} of ${cases.length} instance swap tests failed`);
    process.exit(1);
  }
  console.log('instance swap tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
