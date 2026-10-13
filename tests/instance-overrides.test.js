import assert from 'node:assert/strict';
import { createFigmaStub } from './helpers/figma-stub.js';

// Nodes follow two Figma rules that resets have to respect: text can only be
// written once its font is loaded, and width/height only change via resize().
let nextId = 1;
const nodesById = new Map();
const loadedFonts = new Set();

function register(node) {
  node.id = `node-${nextId++}`;
  nodesById.set(node.id, node);
  return node;
}

function textNode(name, characters, family = 'Inter') {
  const fontName = { family, style: 'Regular' };
  let value = characters;
  return register({
    type: 'TEXT',
    name,
    fontName,
    getStyledTextSegments: () => [{ fontName }],
    get characters() {
      return value;
    },
    set characters(next) {
      if (!loadedFonts.has(`${family} Regular`)) {
        throw new Error(`Cannot write to node with unloaded font "${family} Regular"`);
      }
      value = next;
    },
  });
}

function boxNode(height) {
  let size = { width: 200, height };
  return register({
    type: 'FRAME',
    name: 'Box',
    children: [],
    get width() {
      return size.width;
    },
    get height() {
      return size.height;
    },
    resize(width, nextHeight) {
      size = { width, height: nextHeight };
    },
  });
}

function withChildren(parent, children) {
  parent.children = children;
  children.forEach(child => {
    child.parent = parent;
  });
  return parent;
}

const page = { type: 'PAGE', id: 'page', name: 'Page', parent: null };
const cardMain = withChildren(register({ type: 'COMPONENT', name: 'Card', parent: null, componentPropertyDefinitions: {} }), [
  textNode('Label', 'Title'),
  textNode('Label', 'Subtitle'),
  boxNode(40),
]);

// overriddenFields per child index, in the order Figma reports them.
function createCard({ title = 'Title', subtitle = 'Subtitle', height = 40, family = 'Inter', overrides }) {
  const card = withChildren(register({
    type: 'INSTANCE',
    name: 'Card',
    parent: page,
    componentProperties: {},
    removeOverridesCalls: 0,
    async getMainComponentAsync() {
      return cardMain;
    },
    setProperties() {},
    removeOverrides() {
      this.removeOverridesCalls++;
    },
  }), [textNode('Label', title, family), textNode('Label', subtitle, family), boxNode(height)]);
  card.overrides = overrides.map(([index, field]) => ({ id: card.children[index].id, overriddenFields: [field] }));
  return card;
}

// Like Figma: reading a property the node type doesn't have throws, and an
// instance sublayer's parent is a new object on each access, so indexOf()
// can't find it among its parent's children.
function figmaNode(props, children) {
  const target = { parent: null, ...props, id: `node-${nextId++}` };
  if (children) target.children = children;
  const node = new Proxy(target, {
    get(object, key, receiver) {
      // Promises probe resolved values for `then`.
      if (typeof key === 'symbol' || key === 'then' || key in object) return Reflect.get(object, key, receiver);
      throw new Error(`no such property '${key}' on ${object.type} node`);
    },
  });
  for (const child of children || []) {
    Object.defineProperty(child, 'parent', { get: () => Object.create(node), configurable: true });
  }
  nodesById.set(target.id, node);
  return node;
}

function component(name, children) {
  return figmaNode({ type: 'COMPONENT', name, componentPropertyDefinitions: {} }, children);
}

function instance(name, main, children, props = {}) {
  return figmaNode({
    type: 'INSTANCE',
    name,
    overrides: [],
    componentProperties: {},
    removeOverridesCalls: 0,
    async getMainComponentAsync() {
      return main;
    },
    setProperties() {},
    removeOverrides() {
      this.removeOverridesCalls++;
    },
    ...props,
  }, children);
}

function solid(r, g, b, variableId) {
  const paint = { type: 'SOLID', visible: true, opacity: 1, blendMode: 'NORMAL', color: { r, g, b } };
  if (variableId) paint.boundVariables = { color: { type: 'VARIABLE_ALIAS', id: variableId } };
  return paint;
}

const tertiary = { id: 'VariableID:tertiary', name: 'Text/Tertiary' };
const black = () => [solid(0, 0, 0)];
const tertiaryStroke = () => [solid(0.6, 0.6, 0.6, tertiary.id)];

function vector(strokes, strokeWeight) {
  return figmaNode({
    type: 'VECTOR', name: 'Vector', visible: true, opacity: 1, fills: [], effects: [],
    strokes, strokeWeight, strokeAlign: 'CENTER',
  });
}

function label(characters) {
  const fontName = { family: 'Inter', style: 'Regular' };
  return figmaNode({ type: 'TEXT', name: 'Label', characters, fontName, getStyledTextSegments: () => [{ fontName }] });
}

// Icon/Tabler wraps an icon and styles its stroke; a menu item places one as
// its trailing icon; a menu lists items in a slot.
const bellMain = component('bell', [vector(black(), 1)]);
const chevronMain = component('chevron-right', [vector(black(), 1)]);
const tablerMain = component('Icon/Tabler', [instance('bell', bellMain, [vector(tertiaryStroke(), 1.1)])]);
const menuItemMain = component('Menu item', [
  instance('Trailing icon', tablerMain, [instance('bell', bellMain, [vector(tertiaryStroke(), 1.1)])]),
]);
const menuMain = component('Menu', [figmaNode({ type: 'SLOT', name: 'Items' }, [])]);

// Both items swapped their icon to chevron-right: Figma carried the wrapper's
// stroke over on the first and dropped it on the second, recording no override.
function createMenu() {
  const item = (strokes, weight) => instance('Menu item', menuItemMain, [
    instance('Trailing icon', tablerMain, [instance('chevron-right', chevronMain, [vector(strokes, weight)])]),
  ]);
  const kept = item(tertiaryStroke(), 1.1);
  const dropped = item(black(), 1);
  const menu = instance('Menu', menuMain, [figmaNode({ type: 'SLOT', name: 'Items' }, [kept, dropped])], { parent: page });
  return { menu, droppedVector: dropped.children[0].children[0].children[0] };
}

function rowText(row) {
  return typeof row === 'string' ? row : row.name;
}

function rowValue(row) {
  return typeof row === 'string' ? row : row.data;
}

async function main() {
  const { figma, notifications } = createFigmaStub({ localVariables: [tertiary] });
  figma.getNodeByIdAsync = async id => nodesById.get(id) ?? null;
  figma.loadFontAsync = async font => {
    if (font.family === 'Missing Font') throw new Error(`Font "${font.family}" not found`);
    loadedFonts.add(`${font.family} ${font.style}`);
  };
  globalThis.figma = figma;

  const { searchInstanceOverrides, resetSpecificOverride } = await import('../src/implementations/instance.ts');
  const { ICONS } = await import('../src/implementations/suggestion-icons.ts');

  const editedCard = () => createCard({
    title: 'Hello',
    subtitle: 'World',
    height: 56,
    overrides: [[2, 'height'], [0, 'characters'], [1, 'characters']],
  });
  const findRow = (rows, pattern) => rows.find(row => pattern.test(rowText(row)));

  const cases = [];
  const test = (name, fn) => cases.push({ name, fn });

  test('lists every overridden layer with its current and original value', async () => {
    figma.currentPage.selection = [editedCard()];
    assert.deepEqual((await searchInstanceOverrides('')).map(rowText), [
      'Label · Text "Hello" → "Title"',
      'Label · Text "World" → "Subtitle"',
      'Box · Height 56 → 40',
      'All 3 overrides on Card',
    ]);
  });

  test('resets the second of two layers that share a name', async () => {
    const card = editedCard();
    figma.currentPage.selection = [card];
    const world = findRow(await searchInstanceOverrides(''), /World/);
    assert.ok(world, 'expected a row for the second Label');

    await resetSpecificOverride(rowValue(world));
    assert.deepEqual(card.children.slice(0, 2).map(node => node.characters), ['Hello', 'Subtitle']);
  });

  test('restores text after loading its font', async () => {
    const card = editedCard();
    figma.currentPage.selection = [card];
    notifications.length = 0;
    await resetSpecificOverride(rowValue(findRow(await searchInstanceOverrides(''), /Label.*(Characters|Text)/)));
    assert.deepEqual(
      { text: card.children[0].characters, message: notifications.at(-1)?.message },
      { text: 'Title', message: 'Reset Label text → "Title"' }
    );
  });

  test('restores width and height through resize()', async () => {
    const card = editedCard();
    figma.currentPage.selection = [card];
    await resetSpecificOverride(rowValue(findRow(await searchInstanceOverrides(''), /Box/)));
    assert.equal(card.children[2].height, 40);
  });

  test('says why a reset could not run', async () => {
    figma.currentPage.selection = [createCard({ title: 'Hello', family: 'Missing Font', overrides: [[0, 'characters']] })];
    notifications.length = 0;
    await resetSpecificOverride(rowValue(findRow(await searchInstanceOverrides(''), /Label/)));
    assert.deepEqual(
      { message: notifications.at(-1)?.message, error: notifications.at(-1)?.options?.error },
      { message: 'Couldn\'t reset Label: font "Missing Font Regular" isn\'t available', error: true }
    );
  });

  test('the last row resets every override on the instance', async () => {
    const card = editedCard();
    figma.currentPage.selection = [card];
    const rows = await searchInstanceOverrides('');
    await resetSpecificOverride(rowValue(rows[rows.length - 1]));
    assert.equal(card.removeOverridesCalls, 1);
  });

  test('restores an icon stroke that a nested swap dropped', async () => {
    const { menu, droppedVector } = createMenu();
    figma.currentPage.selection = [menu];
    const rows = await searchInstanceOverrides('');
    assert.deepEqual(rows.map(rowText), [
      'chevron-right › Vector · Stroke #000000 1px → Text/Tertiary 1.1px',
      'All 1 override on Menu',
    ]);

    notifications.length = 0;
    await resetSpecificOverride(rowValue(rows[0]));
    assert.deepEqual(
      {
        variable: droppedVector.strokes[0].boundVariables?.color.id,
        weight: droppedVector.strokeWeight,
        message: notifications.at(-1)?.message,
      },
      { variable: tertiary.id, weight: 1.1, message: 'Reset Vector stroke → Text/Tertiary 1.1px' }
    );
  });

  test('the last row also restores styles a swap dropped', async () => {
    const { menu, droppedVector } = createMenu();
    figma.currentPage.selection = [menu];
    const rows = await searchInstanceOverrides('');
    notifications.length = 0;
    await resetSpecificOverride(rowValue(rows[rows.length - 1]));
    assert.deepEqual(
      { removed: menu.removeOverridesCalls, weight: droppedVector.strokeWeight, message: notifications.at(-1)?.message },
      { removed: 1, weight: 1.1, message: 'Reset all overrides on 1 instance · restored 1 style a swap dropped' }
    );
  });

  test('each row shows what it restores', async () => {
    const { menu } = createMenu();
    figma.currentPage.selection = [menu];
    const [stroke, all] = await searchInstanceOverrides('');
    figma.currentPage.selection = [editedCard()];
    const cardIcons = (await searchInstanceOverrides('')).map(row => row.icon);
    assert.deepEqual(
      { tertiaryRing: /stroke="#999999"/.test(stroke.icon), all: all.icon, card: cardIcons },
      { tertiaryRing: true, all: ICONS.reset, card: [ICONS.text, ICONS.text, ICONS.size, ICONS.reset] }
    );
  });

  test('finds overrides on nested layers whose objects differ from their parent\'s children', async () => {
    const buttonMain = component('Button', [label('Button')]);
    const cardWithButtonMain = component('Card', [instance('Button', buttonMain, [label('Button')])]);
    const card = instance('Card', cardWithButtonMain, [instance('Button', buttonMain, [label('Buy now')])], { parent: page });
    card.overrides = [{ id: card.children[0].children[0].id, overriddenFields: ['characters'] }];
    figma.currentPage.selection = [card];
    assert.deepEqual((await searchInstanceOverrides('')).map(rowText), [
      'Button › Label · Text "Buy now" → "Button"',
      'All 1 override on Card',
    ]);
  });

  test('compares slot content with its own component, not the slot default', async () => {
    const showIcon = value => ({ 'showIcon#1:2': { type: 'BOOLEAN', value } });
    const rowMain = withChildren(register({
      type: 'COMPONENT',
      name: 'Row',
      parent: null,
      componentPropertyDefinitions: { 'showIcon#1:2': { type: 'BOOLEAN', defaultValue: true } },
    }), []);
    const plainInstance = (name, main, componentProperties, children = []) => withChildren(register({
      type: 'INSTANCE',
      name,
      parent: null,
      overrides: [],
      componentProperties,
      async getMainComponentAsync() {
        return main;
      },
      setProperties() {},
      removeOverrides() {},
    }), children);
    // The list's own slot shows a row with its icon hidden.
    const listMain = withChildren(register({ type: 'COMPONENT', name: 'List', parent: null, componentPropertyDefinitions: {} }), [
      withChildren(register({ type: 'SLOT', name: 'Rows' }), [plainInstance('Row', rowMain, showIcon(false))]),
    ]);
    const row = plainInstance('Row', rowMain, showIcon(true));
    const list = plainInstance('List', listMain, {}, [withChildren(register({ type: 'SLOT', name: 'Rows' }), [row])]);
    list.parent = page;

    figma.currentPage.selection = [row];
    assert.deepEqual((await searchInstanceOverrides('')).map(rowText), ['No overrides on the selected instance']);
  });

  let failures = 0;
  for (const { name, fn } of cases) {
    loadedFonts.clear();
    try {
      await fn();
    } catch (error) {
      failures++;
      console.error(`✗ ${name}\n${error.message}\n`);
    }
  }

  if (failures > 0) {
    console.error(`${failures} of ${cases.length} instance override tests failed`);
    process.exit(1);
  }
  console.log('instance override tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
