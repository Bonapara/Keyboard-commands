import assert from 'node:assert/strict';
import { createFigmaStub } from './helpers/figma-stub.js';

function variantProperty(options) {
  return {
    type: 'VARIANT',
    variantOptions: options,
  };
}

function instanceSwapProperty() {
  return {
    type: 'INSTANCE_SWAP',
    preferredValues: [],
  };
}

function textProperty(defaultValue = '') {
  return {
    type: 'TEXT',
    defaultValue,
  };
}

function booleanProperty(defaultValue = false) {
  return {
    type: 'BOOLEAN',
    defaultValue,
  };
}

function createMainComponent(id, componentPropertyDefinitions) {
  return {
    id,
    name: id,
    type: 'COMPONENT',
    parent: null,
    componentPropertyDefinitions,
  };
}

function propertyValue(value) {
  return { value };
}

function createInstance(id, mainComponent, componentProperties, exposedInstances = []) {
  const setPropertiesCalls = [];

  return {
    id,
    name: id,
    type: 'INSTANCE',
    componentProperties,
    exposedInstances,
    setPropertiesCalls,
    async getMainComponentAsync() {
      return mainComponent;
    },
    setProperties(properties) {
      setPropertiesCalls.push(properties);
      for (const [key, value] of Object.entries(properties)) {
        this.componentProperties[key] = propertyValue(value);
      }
    },
  };
}

function createDelayedInstance(id, mainComponent, componentProperties, tracker) {
  const instance = createInstance(id, mainComponent, componentProperties);
  instance.getMainComponentAsync = async () => {
    tracker.inFlight += 1;
    tracker.maxInFlight = Math.max(tracker.maxInFlight, tracker.inFlight);
    await new Promise(resolve => setTimeout(resolve, 0));
    tracker.inFlight -= 1;
    return mainComponent;
  };
  return instance;
}

function createCompatibleStateSelection() {
  const headerMain = createMainComponent('header-main', {
    'State#1:1': variantProperty(['Default', 'Selected']),
    'Tone#1:2': variantProperty(['Low', 'High']),
  });
  const cellMain = createMainComponent('cell-main', {
    'State#2:2': variantProperty(['Selected', 'Default']),
    'Density#2:3': variantProperty(['Compact', 'Comfortable']),
  });

  const header = createInstance('header', headerMain, {
    'State#1:1': propertyValue('Default'),
    'Tone#1:2': propertyValue('Low'),
  });
  const cellA = createInstance('cell-a', cellMain, {
    'State#2:2': propertyValue('Default'),
    'Density#2:3': propertyValue('Compact'),
  });
  const cellB = createInstance('cell-b', cellMain, {
    'State#2:2': propertyValue('Default'),
    'Density#2:3': propertyValue('Comfortable'),
  });

  return { header, cellA, cellB };
}

function createIncompatibleStateSelection() {
  const headerMain = createMainComponent('header-main-incompatible', {
    'State#10:1': variantProperty(['Default', 'Selected', 'Sorted']),
  });
  const cellMain = createMainComponent('cell-main-incompatible', {
    'State#20:1': variantProperty(['Default', 'Selected']),
  });

  const header = createInstance('header-incompatible', headerMain, {
    'State#10:1': propertyValue('Default'),
  });
  const cell = createInstance('cell-incompatible', cellMain, {
    'State#20:1': propertyValue('Default'),
  });

  return { header, cell };
}

function createSingleRootWithDuplicateExposedState() {
  const wrapperMain = createMainComponent('duplicate-wrapper-main', {});
  const headerMain = createMainComponent('duplicate-header-main', {
    'State#50:1': variantProperty(['Default', 'Selected', 'Sorted']),
  });
  const cellMain = createMainComponent('duplicate-cell-main', {
    'State#60:1': variantProperty(['Default', 'Selected']),
  });

  const exposedHeader = createInstance('duplicate-exposed-header', headerMain, {
    'State#50:1': propertyValue('Default'),
  });
  const exposedCell = createInstance('duplicate-exposed-cell', cellMain, {
    'State#60:1': propertyValue('Default'),
  });
  const wrapper = createInstance('duplicate-wrapper', wrapperMain, {}, [exposedHeader, exposedCell]);

  return { wrapper, exposedHeader, exposedCell };
}

function createSingleRootWithDirectAndNestedIcon() {
  const wrapperMain = createMainComponent('icon-wrapper-main', {
    'Icon#70:1': instanceSwapProperty(),
  });
  const nestedIconMain = createMainComponent('nested-icon-main', {
    'Icon#80:1': instanceSwapProperty(),
  });

  const nestedIcon = createInstance('Field icon', nestedIconMain, {
    'Icon#80:1': propertyValue('nested-current-icon'),
  });
  const wrapper = createInstance('icon-wrapper', wrapperMain, {
    'Icon#70:1': propertyValue('direct-current-icon'),
  }, [nestedIcon]);

  return { wrapper, nestedIcon };
}

function createSingleRootWithContainerAndNestedIcon() {
  const wrapperMain = createMainComponent('container-wrapper-main', {
    'Container#75:1': variantProperty(['24px', '32px']),
  });
  const nestedIconMain = createMainComponent('container-nested-icon-main', {
    'Weight#76:1': variantProperty(['Light', 'Regular']),
    'IconSize#76:2': variantProperty(['16px', '20px']),
    'Icon#76:3': instanceSwapProperty(),
  });

  const nestedIcon = createInstance('Icon/Tabler', nestedIconMain, {
    'Weight#76:1': propertyValue('Light'),
    'IconSize#76:2': propertyValue('16px'),
    'Icon#76:3': propertyValue('bell'),
  });
  const wrapper = createInstance('container-wrapper', wrapperMain, {
    'Container#75:1': propertyValue('32px'),
  }, [nestedIcon]);

  return { wrapper, nestedIcon };
}

function createRightPanelOrderedSelection() {
  const wrapperMain = createMainComponent('ordered-wrapper-main', {
    'Label#90:2': textProperty('Amount:'),
    'Label?#90:3': booleanProperty(true),
    'State#90:1': variantProperty(['Default', 'Selected']),
  });
  const fieldIconMain = createMainComponent('ordered-field-icon-main', {
    'Icon#91:3': instanceSwapProperty(),
    'Weight#91:1': variantProperty(['Light', 'Regular']),
    'IconSize#91:2': variantProperty(['16px', '20px']),
  });
  const chipMain = createMainComponent('ordered-chip-main', {
    'Icon_type#92:4': instanceSwapProperty(),
    'Text#92:5': textProperty('Teammate'),
    'Show Icon#92:6': booleanProperty(true),
    'Transparent?#92:1': variantProperty(['True', 'False']),
    'State#92:2': variantProperty(['Default', 'Hover']),
    'Weight#92:3': variantProperty(['Regular', 'Bold']),
  });
  const iconMain = createMainComponent('ordered-icon-main', {
    'Size#93:1': variantProperty(['14px', '16px']),
    'Color#93:2': variantProperty(['Image', 'Primary']),
  });

  const fieldIcon = createInstance('field icon', fieldIconMain, {
    'Weight#91:1': propertyValue('Light'),
    'IconSize#91:2': propertyValue('16px'),
    'Icon#91:3': propertyValue('currency-dollar'),
  });
  const chip = createInstance('🟦 Chips/Chip 🟦', chipMain, {
    'Transparent?#92:1': propertyValue('True'),
    'State#92:2': propertyValue('Default'),
    'Weight#92:3': propertyValue('Regular'),
    'Icon_type#92:4': propertyValue('Round icons'),
    'Text#92:5': propertyValue('Teammate'),
    'Show Icon#92:6': propertyValue(true),
  });
  const icon = createInstance('Icon', iconMain, {
    'Size#93:1': propertyValue('14px'),
    'Color#93:2': propertyValue('Image'),
  });
  const wrapper = createInstance('ordered-wrapper', wrapperMain, {
    'State#90:1': propertyValue('Default'),
    'Label#90:2': propertyValue('Amount:'),
    'Label?#90:3': propertyValue(true),
  }, [fieldIcon, chip, icon]);

  return { wrapper, fieldIcon, chip, icon };
}

function suggestionName(item) {
  return typeof item === 'string' ? item : item.name;
}

function suggestionData(item) {
  return typeof item === 'string' ? item : item.data;
}

async function main() {
  const { figma, notifications } = createFigmaStub();
  globalThis.figma = figma;

  const {
    searchInstanceProperties,
    setInstanceProperty,
    stripInstancePropertyVariantGroupToken,
  } = await import('../src/implementations/instance.ts');

  const compatible = createCompatibleStateSelection();
  figma.currentPage.selection = [compatible.header, compatible.cellA, compatible.cellB];

  const sharedSuggestions = await searchInstanceProperties('');
  const sharedSuggestionNames = sharedSuggestions.map(suggestionName);
  assert.ok(
    sharedSuggestionNames.some(name => name.startsWith('State ')),
    'shared variant properties should be shown for multi-selection'
  );
  assert.ok(
    sharedSuggestionNames.every(name => !name.startsWith('Tone ') && !name.startsWith('Density ')),
    'multi-selection suggestions should hide properties that are not shared by every selected instance'
  );

  await setInstanceProperty('State:Selected');

  assert.equal(compatible.header.componentProperties['State#1:1'].value, 'Selected');
  assert.equal(compatible.cellA.componentProperties['State#2:2'].value, 'Selected');
  assert.equal(compatible.cellB.componentProperties['State#2:2'].value, 'Selected');
  assert.deepEqual(
    compatible.header.setPropertiesCalls[0],
    { 'State#1:1': 'Selected', 'Tone#1:2': 'Low' },
    'direct variant updates should preserve other current variant values on the same instance'
  );
  assert.equal(notifications.at(-1)?.message, 'State → Selected on 3 instances');

  notifications.length = 0;

  const incompatible = createIncompatibleStateSelection();
  figma.currentPage.selection = [incompatible.header, incompatible.cell];

  const suggestions = await searchInstanceProperties('State:');

  assert.deepEqual(
    suggestions,
    ['No shared variant property matching "State" across 2 selected instances'],
    'multi-selection should hide variant properties whose full option sets are not shared'
  );

  await setInstanceProperty('State:Selected');

  assert.equal(incompatible.header.componentProperties['State#10:1'].value, 'Default');
  assert.equal(incompatible.cell.componentProperties['State#20:1'].value, 'Default');
  assert.equal(incompatible.header.setPropertiesCalls.length, 0);
  assert.equal(incompatible.cell.setPropertiesCalls.length, 0);

  const duplicate = createSingleRootWithDuplicateExposedState();
  figma.currentPage.selection = [duplicate.wrapper];
  const duplicateSuggestions = await searchInstanceProperties('State:');
  const selectedSuggestions = duplicateSuggestions.filter(item => suggestionName(item).includes('State → Selected'));

  assert.equal(selectedSuggestions.length, 2, 'single-root duplicate State option sets should surface as separate suggestions');
  assert.deepEqual(
    selectedSuggestions.map(suggestionName).sort(),
    [
      'duplicate-exposed-cell › State → Selected',
      'duplicate-exposed-header › State → Selected',
    ],
    'duplicate-looking nested options should be disambiguated by their instance name prefix'
  );
  assert.ok(
    selectedSuggestions.every(item => String(suggestionData(item)).includes('[[kc-variant-options=')),
    'duplicate-looking option suggestions should carry private option-set tokens'
  );
  assert.deepEqual(
    selectedSuggestions.map(item => stripInstancePropertyVariantGroupToken(String(suggestionData(item)))).sort(),
    ['State:Selected', 'State:Selected'],
    'private option-set tokens should strip back to normal ip syntax'
  );

  const cellOnly = createSingleRootWithDuplicateExposedState();
  figma.currentPage.selection = [cellOnly.wrapper];
  const cellOnlySuggestions = await searchInstanceProperties('State:');
  const cellSelected = cellOnlySuggestions.find(item => suggestionName(item) === 'duplicate-exposed-cell › State → Selected');
  assert.ok(cellSelected, 'expected a cell-only State suggestion');

  await setInstanceProperty(String(suggestionData(cellSelected)));

  assert.equal(cellOnly.exposedHeader.componentProperties['State#50:1'].value, 'Default');
  assert.equal(cellOnly.exposedCell.componentProperties['State#60:1'].value, 'Selected');
  assert.equal(cellOnly.exposedHeader.setPropertiesCalls.length, 0);
  assert.equal(cellOnly.exposedCell.setPropertiesCalls.length, 1);

  const headerOnly = createSingleRootWithDuplicateExposedState();
  figma.currentPage.selection = [headerOnly.wrapper];
  const headerOnlySuggestions = await searchInstanceProperties('State:');
  const headerSelected = headerOnlySuggestions.find(item => suggestionName(item) === 'duplicate-exposed-header › State → Selected');
  assert.ok(headerSelected, 'expected a header-only State suggestion');

  await setInstanceProperty(String(suggestionData(headerSelected)));

  assert.equal(headerOnly.exposedHeader.componentProperties['State#50:1'].value, 'Selected');
  assert.equal(headerOnly.exposedCell.componentProperties['State#60:1'].value, 'Default');
  assert.equal(headerOnly.exposedHeader.setPropertiesCalls.length, 1);
  assert.equal(headerOnly.exposedCell.setPropertiesCalls.length, 0);

  const icons = createSingleRootWithDirectAndNestedIcon();
  figma.currentPage.selection = [icons.wrapper];
  const iconSuggestions = await searchInstanceProperties('Icon');

  assert.deepEqual(
    iconSuggestions.map(suggestionName).sort(),
    [
      'Field icon › Icon · none · type : to swap',
      'Icon · none · type : to swap',
    ],
    'nested instance properties should be prefixed with their instance name'
  );
  assert.deepEqual(
    iconSuggestions.map(item => stripInstancePropertyVariantGroupToken(String(suggestionData(item)))).sort(),
    ['Icon', 'Icon'],
    'nested instance property scope tokens should strip back to normal ip syntax'
  );
  assert.ok(
    iconSuggestions.some(item => String(suggestionData(item)).includes('[[kc-property-origin=')),
    'nested instance properties should carry private scope tokens'
  );

  const containerWithNestedIcon = createSingleRootWithContainerAndNestedIcon();
  figma.currentPage.selection = [containerWithNestedIcon.wrapper];
  const containerValueSuggestions = await searchInstanceProperties('con:');

  assert.deepEqual(
    containerValueSuggestions.map(suggestionName),
    ['Container → 24px    now 32px', 'Container · 32px · current'],
    'property value search should prefer a variant prefix match over an instance-swap substring match'
  );

  const ordered = createRightPanelOrderedSelection();
  figma.currentPage.selection = [ordered.wrapper];
  const orderedSuggestions = await searchInstanceProperties('');

  assert.deepEqual(
    [...new Set(orderedSuggestions.map(item => suggestionName(item).split(/ [·→] /)[0]))],
    [
      'State',
      'Label',
      'Label?',
      'field icon › Weight',
      'field icon › IconSize',
      'field icon › Icon',
      '🟦 Chips/Chip 🟦 › Transparent?',
      '🟦 Chips/Chip 🟦 › State',
      '🟦 Chips/Chip 🟦 › Weight',
      '🟦 Chips/Chip 🟦 › Icon_type',
      '🟦 Chips/Chip 🟦 › Text',
      '🟦 Chips/Chip 🟦 › Show Icon',
      'Icon › Size',
      'Icon › Color',
    ],
    'property suggestions should follow the same order as Figma right-panel sections'
  );

  const chipIconSuggestions = await searchInstanceProperties('chip icon');
  assert.deepEqual(
    chipIconSuggestions.map(suggestionName),
    [
      '🟦 Chips/Chip 🟦 › Icon_type · none · type : to swap',
      '🟦 Chips/Chip 🟦 › Show Icon → Off',
      '🟦 Chips/Chip 🟦 › Show Icon · On · current',
    ],
    'multi-word property search should match across nested instance and property names'
  );

  assert.deepEqual(
    await searchInstanceProperties('chip icon color'),
    ['No editable properties matching "chip icon color" on the selected instance'],
    'empty property searches should explain the search term and current selection scope'
  );

  const chipTextValueSuggestions = await searchInstanceProperties('chip text:new text');
  assert.deepEqual(
    chipTextValueSuggestions.map(suggestionName),
    ['🟦 Chips/Chip 🟦 › Text → "new text"'],
    'text property value search should resolve nested display-name prefixes before the colon'
  );
  assert.ok(
    String(suggestionData(chipTextValueSuggestions[0])).includes('[[kc-property-origin='),
    'nested text value suggestions should carry private scope tokens'
  );
  assert.equal(
    stripInstancePropertyVariantGroupToken(String(suggestionData(chipTextValueSuggestions[0]))),
    'Text:new text',
    'nested text value suggestion scope tokens should strip back to normal ip syntax'
  );

  await setInstanceProperty('chip text:new text');
  assert.equal(ordered.chip.componentProperties['Text#92:5'].value, 'new text');
  assert.deepEqual(
    ordered.chip.setPropertiesCalls.at(-1),
    { 'Text#92:5': 'new text' },
    'manual prefixed text edits should mutate the matched nested instance property'
  );
  assert.equal(
    ordered.wrapper.setPropertiesCalls.length,
    0,
    'manual prefixed text edits should not mutate the wrapper instance'
  );

  const wrapperMain = createMainComponent('wrapper-main', {});
  const exposedMainA = createMainComponent('exposed-main-a', {
    'State#30:1': variantProperty(['Default', 'Selected']),
  });
  const exposedMainB = createMainComponent('exposed-main-b', {
    'State#40:1': variantProperty(['Selected', 'Default']),
  });
  const exposedHeader = createInstance('Field state', exposedMainA, {
    'State#30:1': propertyValue('Default'),
  });
  const exposedCell = createInstance('Field state', exposedMainB, {
    'State#40:1': propertyValue('Default'),
  });
  const wrapper = createInstance('wrapper', wrapperMain, {}, [exposedHeader]);
  const secondWrapper = createInstance('second-wrapper', wrapperMain, {}, [exposedCell]);

  figma.currentPage.selection = [wrapper, secondWrapper];
  const sharedNestedSuggestions = await searchInstanceProperties('State');
  assert.deepEqual(
    sharedNestedSuggestions.map(suggestionName),
    ['Field state › State · Default · current', 'Field state › State → Selected'],
    'shared nested properties should be grouped by nested instance name across selected roots'
  );

  await setInstanceProperty('State:Selected');

  assert.equal(exposedHeader.componentProperties['State#30:1'].value, 'Selected');
  assert.equal(exposedCell.componentProperties['State#40:1'].value, 'Selected');
  assert.equal(wrapper.setPropertiesCalls.length, 0);
  assert.equal(secondWrapper.setPropertiesCalls.length, 0);

  const delayedMain = createMainComponent('delayed-main', {
    'Label#100:1': textProperty('Amount:'),
  });
  const delayedTracker = { inFlight: 0, maxInFlight: 0 };
  figma.currentPage.selection = [
    createDelayedInstance('delayed-a', delayedMain, { 'Label#100:1': propertyValue('A') }, delayedTracker),
    createDelayedInstance('delayed-b', delayedMain, { 'Label#100:1': propertyValue('B') }, delayedTracker),
    createDelayedInstance('delayed-c', delayedMain, { 'Label#100:1': propertyValue('C') }, delayedTracker),
  ];

  await searchInstanceProperties('');

  assert.ok(
    delayedTracker.maxInFlight > 1,
    'instance property search should load selected instance main components in parallel'
  );

  const cachedMain = createMainComponent('cached-main', {
    'Label#101:1': textProperty('Cached'),
  });
  let cachedPropertyReads = 0;
  const cachedComponentProperties = {};
  Object.defineProperty(cachedComponentProperties, 'Label#101:1', {
    enumerable: true,
    configurable: true,
    get() {
      cachedPropertyReads++;
      return propertyValue('Cached');
    },
  });
  const cachedInstance = createInstance('cached-instance', cachedMain, cachedComponentProperties);
  figma.currentPage.selection = [cachedInstance];

  await searchInstanceProperties('');
  assert.ok(cachedPropertyReads > 0, 'initial instance inventory should read current property values');

  cachedPropertyReads = 0;
  await searchInstanceProperties('lab');
  assert.equal(
    cachedPropertyReads,
    0,
    'repeated instance-property typing should reuse inventory without rescanning component property values'
  );

  // Every row is an action: what Enter does on the top row of a search.
  const buttonMain = createMainComponent('button-main', {
    'Size#110:1': variantProperty(['XS', 'S', 'M', 'L', 'XL']),
    'Label#110:2': textProperty('Button'),
    'Has icon#110:3': booleanProperty(false),
    'Icon#110:4': { type: 'INSTANCE_SWAP', preferredValues: [{ type: 'COMPONENT_SET', key: 'set:Icon/Plus' }] },
  });
  const createButton = (id, overrides = {}) => createInstance(id, buttonMain, {
    'Size#110:1': propertyValue('M'),
    'Label#110:2': propertyValue('Buy now'),
    'Has icon#110:3': propertyValue(false),
    'Icon#110:4': propertyValue('arrow-icon'),
    ...overrides,
  });
  const runTopRow = async (searchTerm) => {
    const [top] = await searchInstanceProperties(searchTerm);
    await setInstanceProperty(String(suggestionData(top)));
  };

  figma.currentPage.selection = [createButton('rank-button')];
  assert.equal(
    stripInstancePropertyVariantGroupToken(String(suggestionData((await searchInstanceProperties('size:s'))[0]))),
    'Size:S',
    'an exact option should rank above options that only contain the typed text'
  );

  const currentButton = createButton('current-button');
  figma.currentPage.selection = [currentButton];
  notifications.length = 0;
  await runTopRow('size:m');
  assert.deepEqual(
    { calls: currentButton.setPropertiesCalls.length, messages: notifications.map(item => item.message) },
    { calls: 0, messages: ['Size is already M'] },
    'typing the current option should say it is already set instead of failing'
  );

  const variantButton = createButton('variant-button');
  figma.currentPage.selection = [variantButton];
  await runTopRow('size');
  assert.equal(
    variantButton.componentProperties['Size#110:1'].value,
    'XS',
    'the top row for a variant property should set an option, not print a hint'
  );

  const commaButton = createButton('comma-button');
  const clearButton = createButton('clear-button');
  figma.currentPage.selection = [commaButton];
  await runTopRow('Label:Hello, world');
  figma.currentPage.selection = [clearButton];
  await runTopRow('Label:');
  assert.deepEqual(
    [commaButton, clearButton].map(button => button.componentProperties['Label#110:2'].value),
    ['Hello, world', ''],
    'text values should keep their commas, and an empty value should clear the text'
  );

  const pickedButtons = [createButton('picked-a', { 'Has icon#110:3': propertyValue(true) }), createButton('picked-b'), createButton('picked-c')];
  figma.currentPage.selection = pickedButtons;
  await runTopRow('has icon');
  const typedButtons = [createButton('typed-a', { 'Has icon#110:3': propertyValue(true) }), createButton('typed-b'), createButton('typed-c')];
  figma.currentPage.selection = typedButtons;
  await setInstanceProperty('has icon');
  assert.deepEqual(
    [pickedButtons, typedButtons].map(buttons => buttons.map(button => button.componentProperties['Has icon#110:3'].value)),
    [[true, true, true], [true, true, true]],
    'a boolean that differs across the selection should end up the same on every instance'
  );

  const plusVariant = { id: 'plus-16', key: 'plus-16-key', type: 'COMPONENT', name: 'Size=16' };
  const plusSet = {
    id: 'plus-set',
    key: 'set:Icon/Plus',
    type: 'COMPONENT_SET',
    name: 'Icon/Plus',
    children: [plusVariant],
    defaultVariant: plusVariant,
    componentPropertyDefinitions: { Size: variantProperty(['16']) },
  };
  plusVariant.parent = plusSet;
  figma.loadAllPagesAsync = async () => {};
  figma.root.findAllWithCriteria = () => [];
  figma.importComponentSetByKeyAsync = async (key) => {
    if (key === plusSet.key) return plusSet;
    throw new Error('Component set not published');
  };
  figma.importComponentByKeyAsync = async () => {
    throw new Error('Component not published');
  };
  figma.getNodeByIdAsync = async () => null;

  const swapButton = createButton('swap-button');
  figma.currentPage.selection = [swapButton];
  const plusRow = (await searchInstanceProperties('Icon:plus')).find(item => suggestionName(item).includes('Plus'));
  assert.ok(plusRow, 'a preferred component should still be offered once a search term is typed');
  await setInstanceProperty(String(suggestionData(plusRow)));
  assert.equal(
    swapButton.componentProperties['Icon#110:4'].value,
    'plus-16',
    'a preferred component outside the lp index should be set by its key'
  );

  console.log('instance implementation tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
