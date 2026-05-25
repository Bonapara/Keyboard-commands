import assert from 'node:assert/strict';
import { createFigmaStub } from './helpers/figma-stub.js';

function createSolidPaint(color, overrides = {}) {
  return {
    type: 'SOLID',
    color,
    opacity: 1,
    visible: true,
    ...overrides,
  };
}

function createDropShadow(overrides = {}) {
  return {
    type: 'DROP_SHADOW',
    color: { r: 0, g: 0, b: 0, a: 0.25 },
    offset: { x: 0, y: 2 },
    radius: 6,
    spread: 0,
    visible: true,
    blendMode: 'NORMAL',
    ...overrides,
  };
}

function createBindableNode(base, initialBindings = {}) {
  const appliedBindings = new Map();
  const bindingCalls = [];

  return {
    ...base,
    boundVariables: { ...initialBindings },
    appliedBindings,
    bindingCalls,
    setBoundVariable(field, variable) {
      bindingCalls.push({ field, variableId: variable?.id ?? null });
      if (variable) {
        appliedBindings.set(field, variable);
        this.boundVariables[field] = { id: variable.id };
      } else {
        appliedBindings.delete(field);
        delete this.boundVariables[field];
      }
    },
  };
}

function createShapeNode(overrides = {}, initialBindings = {}) {
  return createBindableNode({
    type: 'RECTANGLE',
    name: 'Shape',
    fills: [],
    fillStyleId: '',
    fillStyleCalls: [],
    async setFillStyleIdAsync(styleId) {
      this.fillStyleCalls.push(styleId);
      this.fillStyleId = styleId;
    },
    async setFillsAsync(paints) {
      this.fills = paints;
    },
    strokes: [],
    strokeStyleId: '',
    strokeStyleCalls: [],
    async setStrokeStyleIdAsync(styleId) {
      this.strokeStyleCalls.push(styleId);
      this.strokeStyleId = styleId;
    },
    async setStrokesAsync(paints) {
      this.strokes = paints;
    },
    effects: [],
    effectStyleId: '',
    effectStyleCalls: [],
    async setEffectStyleIdAsync(styleId) {
      this.effectStyleCalls.push(styleId);
      this.effectStyleId = styleId;
    },
    opacity: 1,
    cornerRadius: 0,
    cornerSmoothing: 0,
    topLeftRadius: 0,
    topRightRadius: 0,
    bottomRightRadius: 0,
    bottomLeftRadius: 0,
    strokeWeight: 1,
    strokeTopWeight: 1,
    strokeRightWeight: 1,
    strokeBottomWeight: 1,
    strokeLeftWeight: 1,
    strokeAlign: 'CENTER',
    dashPattern: [],
    strokeCap: 'NONE',
    strokeJoin: 'MITER',
    strokeMiterLimit: 4,
    ...overrides,
  }, initialBindings);
}

function createTextNode(overrides = {}, initialBindings = {}) {
  return createBindableNode({
    type: 'TEXT',
    name: 'Label',
    characters: 'Hello world',
    fills: [],
    fillStyleId: '',
    fillStyleCalls: [],
    async setFillStyleIdAsync(styleId) {
      this.fillStyleCalls.push(styleId);
      this.fillStyleId = styleId;
    },
    async setFillsAsync(paints) {
      this.fills = paints;
    },
    strokes: [],
    strokeStyleId: '',
    strokeStyleCalls: [],
    async setStrokeStyleIdAsync(styleId) {
      this.strokeStyleCalls.push(styleId);
      this.strokeStyleId = styleId;
    },
    async setStrokesAsync(paints) {
      this.strokes = paints;
    },
    effects: [],
    effectStyleId: '',
    effectStyleCalls: [],
    async setEffectStyleIdAsync(styleId) {
      this.effectStyleCalls.push(styleId);
      this.effectStyleId = styleId;
    },
    textStyleId: '',
    textStyleCalls: [],
    async setTextStyleIdAsync(styleId) {
      this.textStyleCalls.push(styleId);
      this.textStyleId = styleId;
    },
    fontName: { family: 'Inter', style: 'Regular' },
    fontSize: 16,
    letterSpacing: { value: 0, unit: 'PIXELS' },
    lineHeight: { value: 20, unit: 'PIXELS' },
    paragraphSpacing: 0,
    paragraphIndent: 0,
    textCase: 'ORIGINAL',
    textDecoration: 'NONE',
    leadingTrim: 'NONE',
    textAlignHorizontal: 'LEFT',
    textAlignVertical: 'TOP',
    opacity: 1,
    getRangeAllFontNames() {
      return [this.fontName];
    },
    ...overrides,
  }, initialBindings);
}

function createFloatVariable(id, name = 'Style Token') {
  return {
    id,
    name,
    resolvedType: 'FLOAT',
    variableCollectionId: 'collection-1',
    valuesByMode: {
      'mode-1': 1,
    },
  };
}

async function main() {
  const opacityVariable = createFloatVariable('var-opacity', 'Opacity');
  const strokeVariable = createFloatVariable('var-stroke', 'Stroke');
  const { figma, notifications } = createFigmaStub({
    localVariables: [opacityVariable, strokeVariable],
    localVariableCollections: [{ id: 'collection-1', name: 'Style Tokens' }],
  });
  const loadedFonts = [];
  figma.loadFontAsync = async (font) => {
    loadedFonts.push(font);
  };
  globalThis.figma = figma;

  const { matchStyle } = await import('../src/implementations/styling.ts');

  const sourceShape = createShapeNode({
    name: 'Source Shape',
    fills: [createSolidPaint({ r: 1, g: 0.4, b: 0.1 })],
    fillStyleId: 'fill-style',
    strokes: [createSolidPaint({ r: 0.2, g: 0.2, b: 0.2 })],
    strokeStyleId: 'stroke-style',
    effects: [createDropShadow()],
    effectStyleId: 'effect-style',
    opacity: 0.42,
    cornerRadius: 12,
    cornerSmoothing: 0.6,
    topLeftRadius: 12,
    topRightRadius: 12,
    bottomRightRadius: 12,
    bottomLeftRadius: 12,
    strokeWeight: 3,
    strokeTopWeight: 3,
    strokeRightWeight: 3,
    strokeBottomWeight: 3,
    strokeLeftWeight: 3,
    strokeAlign: 'INSIDE',
    dashPattern: [6, 2],
    strokeCap: 'ROUND',
    strokeJoin: 'BEVEL',
    strokeMiterLimit: 10,
  }, {
    opacity: { id: 'var-opacity' },
    strokeWeight: { id: 'var-stroke' },
  });
  const targetShape = createShapeNode({
    name: 'Target Shape',
    fillStyleId: 'old-fill',
    strokeStyleId: 'old-stroke',
    effectStyleId: 'old-effect',
    opacity: 1,
    cornerRadius: 0,
    strokeWeight: 1,
    dashPattern: [],
  });

  figma.currentPage.selection = [sourceShape, targetShape];
  await matchStyle();

  assert.deepEqual(targetShape.fillStyleCalls, ['fill-style']);
  assert.deepEqual(targetShape.strokeStyleCalls, ['stroke-style']);
  assert.deepEqual(targetShape.effectStyleCalls, ['effect-style']);
  assert.equal(targetShape.opacity, 0.42);
  assert.equal(targetShape.appliedBindings.get('opacity')?.id, 'var-opacity');
  assert.equal(targetShape.appliedBindings.get('strokeWeight')?.id, 'var-stroke');
  assert.equal(targetShape.cornerRadius, 12);
  assert.equal(targetShape.cornerSmoothing, 0.6);
  assert.equal(targetShape.topLeftRadius, 12);
  assert.equal(targetShape.strokeWeight, 3);
  assert.equal(targetShape.strokeAlign, 'INSIDE');
  assert.deepEqual(targetShape.dashPattern, [6, 2]);
  assert.equal(targetShape.strokeCap, 'ROUND');
  assert.equal(targetShape.strokeJoin, 'BEVEL');
  assert.equal(targetShape.strokeMiterLimit, 10);
  assert.equal(notifications.at(-1)?.message, 'Matched style to 1 layer');

  notifications.length = 0;
  loadedFonts.length = 0;

  const sourceText = createTextNode({
    name: 'Source Text',
    fills: [createSolidPaint({ r: 0, g: 0, b: 0 })],
    strokes: [createSolidPaint({ r: 1, g: 0, b: 0 })],
    effects: [createDropShadow({ radius: 4 })],
    opacity: 0.75,
    fontName: { family: 'Inter', style: 'Bold' },
    fontSize: 20,
    letterSpacing: { value: 2, unit: 'PIXELS' },
    lineHeight: { value: 28, unit: 'PIXELS' },
    paragraphSpacing: 10,
    paragraphIndent: 6,
    textCase: 'UPPER',
    textDecoration: 'UNDERLINE',
    leadingTrim: 'CAP_HEIGHT',
    textAlignHorizontal: 'CENTER',
    textAlignVertical: 'BOTTOM',
  });
  const targetText = createTextNode({
    name: 'Target Text',
    fills: [createSolidPaint({ r: 0.5, g: 0.5, b: 0.5 })],
    strokes: [],
    effects: [],
    fillStyleId: 'linked-fill',
    strokeStyleId: 'linked-stroke',
    effectStyleId: 'linked-effect',
    textStyleId: 'linked-text-style',
    fontName: { family: 'Roboto', style: 'Regular' },
    fontSize: 14,
    letterSpacing: { value: 0, unit: 'PIXELS' },
    lineHeight: { value: 18, unit: 'PIXELS' },
    paragraphSpacing: 0,
    paragraphIndent: 0,
    textCase: 'LOWER',
    textDecoration: 'NONE',
    leadingTrim: 'NONE',
    textAlignHorizontal: 'LEFT',
    textAlignVertical: 'TOP',
  });

  figma.currentPage.selection = [sourceText, targetText];
  await matchStyle();

  assert.deepEqual(targetText.fillStyleCalls, ['']);
  assert.deepEqual(targetText.strokeStyleCalls, ['']);
  assert.deepEqual(targetText.effectStyleCalls, ['']);
  assert.deepEqual(targetText.textStyleCalls, ['']);
  assert.deepEqual(targetText.fills, sourceText.fills);
  assert.notEqual(targetText.fills, sourceText.fills);
  assert.deepEqual(targetText.strokes, sourceText.strokes);
  assert.notEqual(targetText.strokes, sourceText.strokes);
  assert.deepEqual(targetText.effects, sourceText.effects);
  assert.notEqual(targetText.effects, sourceText.effects);
  assert.equal(targetText.opacity, 0.75);
  assert.deepEqual(loadedFonts, [
    { family: 'Roboto', style: 'Regular' },
    { family: 'Inter', style: 'Bold' },
  ]);
  assert.deepEqual(targetText.fontName, { family: 'Inter', style: 'Bold' });
  assert.equal(targetText.fontSize, 20);
  assert.deepEqual(targetText.letterSpacing, { value: 2, unit: 'PIXELS' });
  assert.deepEqual(targetText.lineHeight, { value: 28, unit: 'PIXELS' });
  assert.equal(targetText.paragraphSpacing, 10);
  assert.equal(targetText.paragraphIndent, 6);
  assert.equal(targetText.textCase, 'UPPER');
  assert.equal(targetText.textDecoration, 'UNDERLINE');
  assert.equal(targetText.leadingTrim, 'CAP_HEIGHT');
  assert.equal(targetText.textAlignHorizontal, 'CENTER');
  assert.equal(targetText.textAlignVertical, 'BOTTOM');
  assert.equal(notifications.at(-1)?.message, 'Matched style to 1 layer');

  figma.currentPage.selection = [sourceText];
  await assert.rejects(matchStyle(), /Select at least 2 layers to match style/);

  console.log('styling implementation tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
