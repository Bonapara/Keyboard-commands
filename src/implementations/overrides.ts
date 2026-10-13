// Reset one specific override (`rio`): list each overridden layer + field with
// its current and original value, and restore it from the component that
// defines it. Also lists styles a nested-instance swap dropped (an icon swapped
// inside a wrapper can lose the wrapper's stroke color): Figma records no
// override for those, yet the layer no longer looks the way its components say.

import {
  getComponentPropertyDefinitions,
  cleanPropertyName,
  extractPropertyValue,
  pluralize,
  matchesSearchTokens,
  loadFontsForTextNode,
} from './instance-shared';

const RADIUS_FIELDS = ['cornerRadius', 'topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius'];
const STROKE_FIELDS = [
  'strokes', 'strokeWeight', 'strokeAlign', 'strokeCap', 'strokeJoin',
  'dashPattern', 'strokeMiterLimit', 'strokeStyleId',
  'strokeTopWeight', 'strokeBottomWeight', 'strokeLeftWeight', 'strokeRightWeight',
  'stokeTopWeight' // Handle Figma API typo
];
// The fill style goes after the paints, so a reset re-links it.
const FILL_FIELDS = ['fills', 'fillStyleId'];
// Writing any of these on a text node requires its fonts to be loaded.
const TEXT_FIELDS = new Set([
  'characters', 'fontSize', 'fontName', 'fontWeight', 'letterSpacing', 'lineHeight', 'textCase',
  'textDecoration', 'paragraphIndent', 'paragraphSpacing', 'listSpacing', 'hangingPunctuation',
  'hangingList', 'leadingTrim', 'textAutoResize', 'textAlignHorizontal', 'textAlignVertical',
  'textTruncation', 'maxLines', 'textStyleId', 'openTypeFeatures',
]);
// Compared on layers under a swapped nested instance even when Figma recorded
// no override. The text style comes before the font fields it sets.
const SWAP_CHECKED_FIELDS = ['fills', 'stroke', 'effects', 'opacity', 'visible', 'textStyleId', 'fontSize', 'fontName'];

const FIELD_LABELS: Record<string, string> = {
  characters: 'Text',
  fills: 'Fill',
  strokes: 'Stroke',
  stroke: 'Stroke',
  cornerRadius: 'Radius',
  width: 'Width',
  height: 'Height',
  opacity: 'Opacity',
  visible: 'Visibility',
  fontSize: 'Font size',
  fontName: 'Font',
  textStyleId: 'Text style',
  fillStyleId: 'Fill style',
  strokeStyleId: 'Stroke style',
  effectStyleId: 'Effect style',
  effects: 'Effects',
  name: 'Name',
  letterSpacing: 'Letter spacing',
  lineHeight: 'Line height',
  textCase: 'Text case',
  textDecoration: 'Decoration',
};

// Legacy "Node -> Field" references.
const FIELD_MAPPING: Record<string, string> = {
  'strokestyleid': 'strokeStyleId', 'strokeweight': 'strokeWeight',
  'strokes': 'strokes', 'fills': 'fills', 'fillstyleid': 'fillStyleId',
  'componentproperties': 'componentProperties', 'effects': 'effects',
  'effectstyleid': 'effectStyleId', 'characters': 'characters',
  'textstyleid': 'textStyleId', 'cornerradius': 'cornerRadius',
  'stroke': 'stroke'
};

interface OverridePayload {
  v: 2;
  path?: number[];
  field?: string;
  prop?: string | null;
  name?: string;
  all?: true;
}

interface OverrideRow {
  key: string;
  path: number[];
  field: string;
  prop: string | null;
  nodeName: string;
  label: string;
  search: string;
  instanceIds: Set<string>;
  order: number;
}

interface ComponentPropertyValueEntry {
  key: string;
  name: string;
  type: ComponentPropertyType | undefined;
  value: string | boolean | undefined;
}

interface ResetResult {
  ok: boolean;
  reason?: string;
}

interface DefiningInstance {
  instance: InstanceNode;
  path: number[];
}

// A layer as one instance's main component has it.
interface Definition {
  source: SceneNode;
  // The layer's own component, which sets every field.
  innermost: boolean;
  // The path down to it runs through a nested instance swapped to another
  // component.
  swapped: boolean;
}

interface ExpectedValue {
  name: string;
  value: unknown;
  source: SceneNode;
  swapped: boolean;
}

interface LostStyle {
  node: SceneNode;
  field: string;
  expected: ExpectedValue[];
}

// Lookups for one listing or reset, keyed by node id: Figma hands out a fresh
// object for an instance sublayer on each access, so object keys miss.
interface LookupContext {
  mainOf(instance: InstanceNode): Promise<ComponentNode | null>;
  definitionsOf(node: SceneNode): Promise<Definition[]>;
  baseOf(source: SceneNode): Promise<SceneNode | null>;
}

// ================================
// Tree helpers
// ================================

function isNodeInSubtree(node: BaseNode | null, subtreeRoot: SceneNode): boolean {
  let current: BaseNode | null = node;

  while (current) {
    if (current.id === subtreeRoot.id) return true;
    current = 'parent' in current ? current.parent : null;
  }

  return false;
}

// The selected instance and every instance above it can own overrides on
// layers inside the selection.
function getOwnerInstances(instance: InstanceNode): InstanceNode[] {
  const owners: InstanceNode[] = [];
  let current: BaseNode | null = instance;

  while (current) {
    if (current.type === 'INSTANCE') owners.push(current);
    current = 'parent' in current ? current.parent : null;
  }

  return owners;
}

function getNearestParentInstance(instance: InstanceNode): InstanceNode | null {
  let current: BaseNode | null = instance.parent;

  while (current) {
    if (current.type === 'INSTANCE') return current;
    current = 'parent' in current ? current.parent : null;
  }

  return null;
}

// indexOf() misses an instance sublayer whose object differs from the one in
// its parent's children, so match on ids.
function indexInParent(parent: ChildrenMixin, node: BaseNode): number {
  return parent.children.findIndex(child => child.id === node.id);
}

function getChildPath(root: SceneNode, node: SceneNode): number[] | null {
  const path: number[] = [];
  let current: SceneNode = node;

  while (current.id !== root.id) {
    const parent = current.parent;
    if (!parent || !('children' in parent)) return null;

    const index = indexInParent(parent, current);
    if (index === -1) return null;

    path.unshift(index);
    current = parent as SceneNode;
  }

  return path;
}

// The child path from `owner` down to one of the layers its main component
// defines. Slot content is placed per instance, so it has no counterpart.
function getDefinedPath(owner: SceneNode, node: SceneNode): number[] | null {
  const path: number[] = [];
  let current: SceneNode = node;

  while (current.id !== owner.id) {
    const parent = current.parent;
    if (!parent || parent.type === 'SLOT' || !('children' in parent)) return null;

    const index = indexInParent(parent, current);
    if (index === -1) return null;

    path.unshift(index);
    current = parent as SceneNode;
  }

  return path;
}

function resolveChildPath(root: SceneNode, path: number[]): SceneNode | null {
  let current: SceneNode = root;

  for (const index of path) {
    if (!('children' in current) || index >= current.children.length) return null;
    current = current.children[index];
  }

  return current;
}

function comparePaths(a: number[], b: number[]): number {
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return a.length - b.length;
}

// "chevron-right › Vector" for layers inside a nested instance, so rows for
// same-named layers say which component they sit in.
function getLayerLabel(node: SceneNode, selection: SceneNode): string {
  let current: BaseNode | null = node.id === selection.id ? null : node.parent;

  while (current && current.id !== selection.id) {
    if (current.type === 'INSTANCE') return `${current.name} › ${node.name}`;
    current = 'parent' in current ? current.parent : null;
  }

  return node.name;
}

// ================================
// Component definitions
// ================================

// Instances whose main component defines `node`, innermost first, each with
// the child path down to it. An instance defines its own fields too. Slot
// content is placed per instance, so nothing above a slot defines it.
function getDefiningInstances(node: SceneNode): DefiningInstance[] {
  const owners: DefiningInstance[] = node.type === 'INSTANCE' ? [{ instance: node, path: [] }] : [];
  const path: number[] = [];
  let current: SceneNode = node;

  for (;;) {
    const parent = current.parent;
    if (!parent || parent.type === 'SLOT' || parent.type === 'PAGE' || parent.type === 'DOCUMENT') break;

    const index = indexInParent(parent, current);
    if (index === -1) break;

    path.unshift(index);
    if (parent.type === 'INSTANCE') owners.push({ instance: parent, path: [...path] });
    current = parent as SceneNode;
  }

  return owners;
}

// Walk the owner's child path through its main component. Past a nested
// instance swapped to another component the layer must keep its name, which
// is how Figma carries overrides across a swap.
async function resolveInMain(
  owner: DefiningInstance,
  node: SceneNode,
  context: LookupContext
): Promise<{ source: SceneNode; swapped: boolean } | null> {
  const main = await context.mainOf(owner.instance);
  if (!main) return null;

  let source: SceneNode = main;
  let current: SceneNode = owner.instance;
  let swapped = false;
  let swappedAbove = false;

  for (const index of owner.path) {
    if (!('children' in source) || !('children' in current)) return null;

    const nextSource: SceneNode | undefined = source.children[index];
    const nextCurrent: SceneNode | undefined = current.children[index];
    if (!nextSource || !nextCurrent || nextSource.type !== nextCurrent.type) return null;

    swappedAbove = swapped;
    if (!swapped && nextCurrent.type === 'INSTANCE' && nextSource.type === 'INSTANCE') {
      const [currentMain, sourceMain] = await Promise.all([context.mainOf(nextCurrent), context.mainOf(nextSource)]);
      swapped = Boolean(currentMain && sourceMain && currentMain.id !== sourceMain.id);
    }

    source = nextSource;
    current = nextCurrent;
  }

  if (swappedAbove && source.name !== node.name) return null;
  return { source, swapped };
}

async function resolveDefinitions(node: SceneNode, context: LookupContext): Promise<Definition[]> {
  try {
    const owners = getDefiningInstances(node);
    const definitions: Definition[] = [];

    // Outermost first: the outermost component that sets a field wins.
    for (let index = owners.length - 1; index >= 0; index--) {
      const resolved = await resolveInMain(owners[index], node, context);
      if (resolved) definitions.push({ ...resolved, innermost: index === 0 });
    }

    return definitions;
  } catch {
    return [];
  }
}

// The same layer one component down, before the overrides of the main
// component `source` sits in.
async function resolveBase(source: SceneNode, context: LookupContext): Promise<SceneNode | null> {
  try {
    const owner = getDefiningInstances(source)[0];
    if (!owner) return null;

    const resolved = await resolveInMain(owner, source, context);
    return resolved ? resolved.source : null;
  } catch {
    return null;
  }
}

function createLookupContext(): LookupContext {
  const mains = new Map<string, Promise<ComponentNode | null>>();
  const definitions = new Map<string, Promise<Definition[]>>();
  const bases = new Map<string, Promise<SceneNode | null>>();

  const context: LookupContext = {
    mainOf(instance) {
      let main = mains.get(instance.id);
      if (!main) {
        main = instance.getMainComponentAsync().catch(() => null);
        mains.set(instance.id, main);
      }
      return main;
    },
    definitionsOf(node) {
      let result = definitions.get(node.id);
      if (!result) {
        result = resolveDefinitions(node, context);
        definitions.set(node.id, result);
      }
      return result;
    },
    baseOf(source) {
      let base = bases.get(source.id);
      if (!base) {
        base = resolveBase(source, context);
        bases.set(source.id, base);
      }
      return base;
    },
  };

  return context;
}

// Each field comes from the outermost component that sets it, i.e. where it
// differs from the layer one component down, else from the layer's own
// component. Null when no component defines the layer.
async function getExpectedValues(node: SceneNode, field: string, context: LookupContext): Promise<ExpectedValue[] | null> {
  const definitions = await context.definitionsOf(node);
  if (definitions.length === 0) return null;

  const expected: ExpectedValue[] = [];
  for (const name of getFieldsToReset(field)) {
    for (const definition of definitions) {
      if (!(name in definition.source)) continue;

      const value = readField(definition.source, name);
      if (!definition.innermost) {
        const base = await context.baseOf(definition.source);
        if (base && name in base && valuesEqual(name, value, readField(base, name))) continue;
      }

      expected.push({ name, value, source: definition.source, swapped: definition.swapped });
      break;
    }
  }

  return expected;
}

function getChangedValues(node: SceneNode, expected: ExpectedValue[]): ExpectedValue[] {
  return expected.filter(entry => entry.name in node && !valuesEqual(entry.name, readField(node, entry.name), entry.value));
}

/**
 * Find the layer in the main component that corresponds to `targetNode`, for
 * component property resets. This resolves from `instance`'s own main
 * component, so a reset restores the value the component defines (which may
 * itself be an override), not the original source.
 */
async function findSourceNode(instance: InstanceNode, targetNode: SceneNode, context: LookupContext): Promise<SceneNode | null> {
  try {
    const path = getDefinedPath(instance, targetNode);
    if (!path) return null;

    let sourceNode: SceneNode | null = await context.mainOf(instance);
    for (const index of path) {
      if (!sourceNode || !('children' in sourceNode)) return null;
      sourceNode = sourceNode.children[index] ?? null;
    }

    return sourceNode;
  } catch {
    return null;
  }
}

async function getDirectComponentPropertySourceNode(instance: InstanceNode, context: LookupContext): Promise<SceneNode | null> {
  const parentInstance = getNearestParentInstance(instance);

  if (parentInstance) {
    const parentDefinedSource = await findSourceNode(parentInstance, instance, context);
    if (parentDefinedSource) return parentDefinedSource;
  }

  return findSourceNode(instance, instance, context);
}

// Layers at or under a nested instance swapped away from what a component
// above placed there: the only layers that lose styles without an override.
async function getLayersUnderSwaps(root: SceneNode, context: LookupContext): Promise<SceneNode[]> {
  const layers: SceneNode[] = [];

  const visit = async (node: SceneNode, underSwap: boolean): Promise<void> => {
    let swapped = underSwap;
    if (!swapped && node.type === 'INSTANCE') {
      swapped = (await context.definitionsOf(node)).some(definition => definition.swapped);
    }
    if (swapped) layers.push(node);
    if (!('children' in node)) return;

    // Slot content is placed per instance, so a swap above doesn't reach it.
    for (const child of node.children) await visit(child, swapped && node.type !== 'SLOT');
  };

  await visit(root, false);
  return layers;
}

// Visibility toggled by a boolean property belongs to that property.
function isBoundToProperty(node: SceneNode, field: string): boolean {
  const references = 'componentPropertyReferences' in node ? node.componentPropertyReferences : null;
  return field === 'visible' && Boolean(references?.visible);
}

async function findLostStyles(instance: InstanceNode, context: LookupContext): Promise<LostStyle[]> {
  const lost: LostStyle[] = [];
  // Await before looping: Figma's QuickJS can't compile `for (… of await …)`.
  const layers = await getLayersUnderSwaps(instance, context);

  for (const node of layers) {
    let textStyleRestored = false;

    for (const field of SWAP_CHECKED_FIELDS) {
      if (!getFieldsToReset(field).some(name => name in node)) continue;
      if (isBoundToProperty(node, field)) continue;
      // Restoring the text style brings its font and size along.
      if (textStyleRestored && (field === 'fontSize' || field === 'fontName')) continue;

      const expected = await getExpectedValues(node, field, context);
      if (!expected || !getChangedValues(node, expected).some(entry => entry.swapped)) continue;

      lost.push({ node, field, expected });
      if (field === 'textStyleId' && expected.some(entry => entry.name === 'textStyleId' && entry.value)) {
        textStyleRestored = true;
      }
    }
  }

  return lost;
}

// ================================
// Value comparison and formatting
// ================================

function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object' || a === null || b === null) return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((value, index) => isEqual(value, b[index]));
  }

  const objectA = a as Record<string, unknown>;
  const objectB = b as Record<string, unknown>;
  const keysA = Object.keys(objectA);
  const keysB = Object.keys(objectB);
  if (keysA.length !== keysB.length) return false;

  return keysA.every(key => keysB.includes(key) && isEqual(objectA[key], objectB[key]));
}

// A bound color resolves per variable mode, so bound paints compare by
// variable rather than by color.
function getComparablePaint(paint: unknown): unknown {
  const solid = paint as SolidPaint;
  if (!solid || solid.type !== 'SOLID' || !solid.boundVariables?.color) return paint;

  const comparable: Record<string, unknown> = { ...solid };
  delete comparable.color;
  return comparable;
}

function valuesEqual(name: string, a: unknown, b: unknown): boolean {
  if ((name === 'fills' || name === 'strokes') && Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((paint, index) => isEqual(getComparablePaint(paint), getComparablePaint(b[index])));
  }
  return isEqual(a, b);
}

// Instances of a variant are named after the component set, not the variant.
// Figma throws on a property the node doesn't have, so callers check `in`.
function readField(node: BaseNode, name: string): unknown {
  if (name === 'name' && node.type === 'COMPONENT' && node.parent?.type === 'COMPONENT_SET') {
    return node.parent.name;
  }
  return (node as unknown as Record<string, unknown>)[name];
}

function getGroupedField(field: string): string | null {
  if (RADIUS_FIELDS.includes(field)) return 'cornerRadius';
  if (STROKE_FIELDS.includes(field)) return 'stroke';
  return null;
}

function getFieldsToReset(field: string): string[] {
  if (field === 'cornerRadius') return RADIUS_FIELDS;
  if (field === 'stroke') return STROKE_FIELDS;
  if (field === 'fills') return FILL_FIELDS;
  return [field];
}

// The field's values once reset: expected values over the node's own.
function getExpectedRecord(node: SceneNode, field: string, expected: ExpectedValue[]): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const name of getFieldsToReset(field)) {
    if (name in node) record[name] = readField(node, name);
  }
  for (const entry of expected) record[entry.name] = entry.value;
  return record;
}

function formatFieldLabel(field: string): string {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];

  const spaced = field
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatNumber(value: unknown): string {
  if (typeof value !== 'number') return 'mixed';
  return String(Math.round(value * 100) / 100);
}

function quote(value: unknown): string {
  if (typeof value !== 'string') return 'mixed';
  const singleLine = value.replace(/\s+/g, ' ');
  return `"${singleLine.length > 24 ? `${singleLine.slice(0, 23)}…` : singleLine}"`;
}

function toHex(color: RGB): string {
  const channel = (value: number) => Math.round(value * 255).toString(16).padStart(2, '0');
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`.toUpperCase();
}

async function describeVariable(id: string): Promise<string> {
  try {
    const variable = await figma.variables.getVariableByIdAsync(id);
    return variable ? variable.name : 'variable';
  } catch {
    return 'variable';
  }
}

async function describePaints(paints: unknown): Promise<string> {
  if (!Array.isArray(paints)) return 'mixed';

  const visible = (paints as Paint[]).filter(paint => paint.visible !== false);
  if (visible.length === 0) return 'none';

  const first = visible[0];
  let description: string;
  if (first.type === 'SOLID') {
    description = first.boundVariables?.color ? await describeVariable(first.boundVariables.color.id) : toHex(first.color);
    if (first.opacity !== undefined && first.opacity < 1) description += ` ${Math.round(first.opacity * 100)}%`;
  } else if (first.type === 'IMAGE') {
    description = 'image';
  } else if (first.type.startsWith('GRADIENT')) {
    description = 'gradient';
  } else {
    description = first.type.toLowerCase();
  }

  return visible.length > 1 ? `${description} +${visible.length - 1}` : description;
}

async function describeStyle(styleId: unknown): Promise<string> {
  if (typeof styleId !== 'string') return 'mixed';
  if (!styleId) return 'none';

  try {
    const style = await figma.getStyleByIdAsync(styleId);
    return style ? style.name : 'missing style';
  } catch {
    return 'missing style';
  }
}

async function describeFieldValue(target: object, field: string): Promise<string | null> {
  // Figma throws on a property the node doesn't have.
  const record = new Proxy(target as Record<string, unknown>, {
    get: (values, name) => (name in values ? values[name as string] : undefined),
  });

  switch (field) {
    case 'characters':
    case 'name':
      return quote(record[field]);
    case 'width':
    case 'height':
    case 'fontSize':
      return formatNumber(record[field]);
    case 'opacity':
      return typeof record.opacity === 'number' ? `${Math.round(record.opacity * 100)}%` : 'mixed';
    case 'visible':
      return record.visible === false ? 'hidden' : 'shown';
    case 'fills':
      return await describePaints(record.fills);
    case 'stroke': {
      const weight = typeof record.strokeWeight === 'number' ? ` ${formatNumber(record.strokeWeight)}px` : '';
      return `${await describePaints(record.strokes)}${weight}`;
    }
    case 'cornerRadius':
      return formatNumber(record.cornerRadius);
    case 'fontName': {
      const font = record.fontName as FontName | symbol | undefined;
      return font && typeof font === 'object' ? `${font.family} ${font.style}` : 'mixed';
    }
    case 'effects':
      return Array.isArray(record.effects) ? `${record.effects.length} ${pluralize(record.effects.length, 'effect')}` : 'mixed';
    case 'textStyleId':
    case 'fillStyleId':
    case 'strokeStyleId':
    case 'effectStyleId':
      return await describeStyle(record[field]);
    default: {
      const value = record[field];
      if (typeof value === 'number') return formatNumber(value);
      if (typeof value === 'string') return quote(value);
      if (typeof value === 'boolean') return value ? 'on' : 'off';
      return null;
    }
  }
}

function getComponentPropertyValueMap(node: BaseNode): Map<string, ComponentPropertyValueEntry> {
  const properties = new Map<string, ComponentPropertyValueEntry>();

  if (node.type === 'INSTANCE') {
    for (const [key, property] of Object.entries(node.componentProperties)) {
      const name = cleanPropertyName(key);
      properties.set(name.toLowerCase(), { key, name, type: property.type, value: extractPropertyValue(property) });
    }
  } else if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
    const definitions = node.type === 'COMPONENT'
      ? getComponentPropertyDefinitions(node)
      : node.componentPropertyDefinitions;

    for (const [key, definition] of Object.entries(definitions)) {
      const name = cleanPropertyName(key);
      properties.set(name.toLowerCase(), { key, name, type: definition.type, value: definition.defaultValue });
    }
  }

  return properties;
}

function getOverriddenComponentProperties(
  node: SceneNode,
  sourceNode: BaseNode | null
): Array<{ current: ComponentPropertyValueEntry; source: ComponentPropertyValueEntry }> {
  if (node.type !== 'INSTANCE' || !sourceNode) return [];

  const currentProperties = getComponentPropertyValueMap(node);
  const sourceProperties = getComponentPropertyValueMap(sourceNode);
  const overrides: Array<{ current: ComponentPropertyValueEntry; source: ComponentPropertyValueEntry }> = [];

  for (const [lookupKey, current] of currentProperties.entries()) {
    const source = sourceProperties.get(lookupKey);
    if (!source || source.value === undefined) continue;
    if (!isEqual(source.value, current.value)) overrides.push({ current, source });
  }

  return overrides;
}

async function describePropertyValue(entry: ComponentPropertyValueEntry | undefined): Promise<string> {
  const value = entry?.value;
  if (typeof value === 'boolean') return value ? 'on' : 'off';
  if (typeof value !== 'string') return 'none';
  if (entry?.type === 'TEXT') return quote(value);

  // Instance-swap properties hold a component id.
  if (entry?.type === 'INSTANCE_SWAP') {
    try {
      const node = await figma.getNodeByIdAsync(value);
      if (node && 'name' in node) {
        return node.parent?.type === 'COMPONENT_SET' ? node.parent.name : node.name;
      }
    } catch {
      // Fall through to the raw value.
    }
  }

  return value;
}

// ================================
// Suggestions
// ================================

function rowKey(path: number[], field: string, prop: string | null): string {
  return `${path.join('.')}|${field}|${(prop || '').toLowerCase()}`;
}

function selectedInstances(): InstanceNode[] {
  return figma.currentPage.selection.filter(node => node.type === 'INSTANCE') as InstanceNode[];
}

async function collectOverrideRows(instances: InstanceNode[], context: LookupContext): Promise<OverrideRow[]> {
  const rows = new Map<string, OverrideRow>();
  let order = 0;

  const addRow = (row: Omit<OverrideRow, 'key' | 'instanceIds' | 'order'>, instanceId: string) => {
    const key = rowKey(row.path, row.field, row.prop);
    const existing = rows.get(key);
    if (existing) {
      existing.instanceIds.add(instanceId);
      return;
    }
    rows.set(key, { ...row, key, instanceIds: new Set([instanceId]), order: order++ });
  };

  const addFieldRow = async (
    instance: InstanceNode,
    node: SceneNode,
    path: number[],
    field: string,
    expected: ExpectedValue[] | null
  ) => {
    const layer = getLayerLabel(node, instance);
    const label = formatFieldLabel(field);
    const from = await describeFieldValue(node, field);
    const to = expected ? await describeFieldValue(getExpectedRecord(node, field, expected), field) : null;
    const values = from !== null && to !== null ? ` ${from} → ${to}` : '';
    addRow({
      path,
      field,
      prop: null,
      nodeName: node.name,
      label: `${layer} · ${label}${values}`,
      search: `${layer} ${label} ${from || ''} ${to || ''}`,
    }, instance.id);
  };

  for (const instance of instances) {
    for (const owner of getOwnerInstances(instance)) {
      for (const override of owner.overrides) {
        const node = await figma.getNodeByIdAsync(override.id) as SceneNode | null;
        if (!node || !isNodeInSubtree(node, instance)) continue;

        const path = getChildPath(instance, node);
        if (!path) continue;

        const seenFields = new Set<string>();

        for (const rawField of override.overriddenFields) {
          if (rawField === 'componentProperties') {
            // The selected instance's own properties are listed below, against
            // the source a reset will use.
            if (path.length === 0) continue;
            const layer = getLayerLabel(node, instance);
            const sourceNode = await findSourceNode(owner, node, context);
            for (const { current, source } of getOverriddenComponentProperties(node, sourceNode)) {
              const from = await describePropertyValue(current);
              const to = await describePropertyValue(source);
              addRow({
                path,
                field: 'componentProperties',
                prop: current.name,
                nodeName: node.name,
                label: `${layer} · ${current.name} ${from} → ${to}`,
                search: `${layer} ${current.name} ${from} ${to}`,
              }, instance.id);
            }
            continue;
          }

          const field = getGroupedField(rawField) || rawField;
          if (seenFields.has(field)) continue;
          seenFields.add(field);

          // Without a defining component the override can't be checked, so
          // it stays listed.
          const expected = await getExpectedValues(node, field, context);
          if (expected && getChangedValues(node, expected).length === 0) continue;
          await addFieldRow(instance, node, path, field, expected);
        }
      }
    }

    const lostStyles = await findLostStyles(instance, context);
    for (const { node, field, expected } of lostStyles) {
      const path = getChildPath(instance, node);
      if (path) await addFieldRow(instance, node, path, field, expected);
    }

    // Component properties set directly on the selected instance.
    const directSource = await getDirectComponentPropertySourceNode(instance, context);
    for (const { current, source } of getOverriddenComponentProperties(instance, directSource)) {
      const from = await describePropertyValue(current);
      const to = await describePropertyValue(source);
      addRow({
        path: [],
        field: 'componentProperties',
        prop: current.name,
        nodeName: instance.name,
        label: `${instance.name} · ${current.name} ${from} → ${to}`,
        search: `${instance.name} ${current.name} ${from} ${to}`,
      }, instance.id);
    }
  }

  return [...rows.values()].sort((a, b) => comparePaths(a.path, b.path) || a.order - b.order);
}

// Suggestions refresh on every keystroke; rows only change when a reset runs,
// and the plugin closes after that.
let overrideRowsCache: { key: string; rows: Promise<OverrideRow[]> } | null = null;

function getOverrideRows(instances: InstanceNode[]): Promise<OverrideRow[]> {
  const key = instances.map(instance => instance.id).join('\x1e');
  if (overrideRowsCache && overrideRowsCache.key === key) return overrideRowsCache.rows;

  const rows = collectOverrideRows(instances, createLookupContext());
  const entry = { key, rows };
  overrideRowsCache = entry;
  rows.catch(() => {
    if (overrideRowsCache === entry) overrideRowsCache = null;
  });
  return rows;
}

function parsePayload(value: string): OverridePayload | null {
  try {
    const payload = JSON.parse(value);
    return payload && payload.v === 2 ? payload : null;
  } catch {
    return null;
  }
}

export async function searchInstanceOverrides(searchTerm: string): Promise<Array<string | { name: string; data: string }>> {
  const instances = selectedInstances();
  if (instances.length === 0) {
    return ['No instances selected'];
  }

  const rows = await getOverrideRows(instances);
  const matching = rows.filter(row => matchesSearchTokens(searchTerm, row.search));

  const suggestions: Array<{ name: string; data: string }> = matching.map(row => {
    const shared = instances.length > 1 ? ` · ${row.instanceIds.size} ${pluralize(row.instanceIds.size, 'instance')}` : '';
    const payload: OverridePayload = { v: 2, path: row.path, field: row.field, name: row.nodeName };
    if (row.prop) payload.prop = row.prop;
    return { name: `${row.label}${shared}`, data: JSON.stringify(payload) };
  });

  if (rows.length > 0 && (!searchTerm.trim() || matchesSearchTokens(searchTerm, 'all reset everything'))) {
    const label = instances.length === 1
      ? `All ${rows.length} ${pluralize(rows.length, 'override')} on ${instances[0].name}`
      : `All overrides on ${instances.length} instances`;
    suggestions.push({ name: label, data: JSON.stringify({ v: 2, all: true }) });
  }

  if (suggestions.length === 0) {
    if (searchTerm.trim()) return [`No overrides matching "${searchTerm.trim()}"`];
    return [instances.length === 1
      ? 'No overrides on the selected instance'
      : `No overrides on the ${instances.length} selected instances`];
  }

  return suggestions;
}

// ================================
// Reset
// ================================

// Copy paints so the node doesn't share the source's objects, binding color
// variables again so the copies stay linked.
async function clonePaints(paints: readonly Paint[]): Promise<Paint[]> {
  return Promise.all(paints.map(async paint => {
    const copy = JSON.parse(JSON.stringify(paint)) as Paint;
    const alias = paint.type === 'SOLID' ? paint.boundVariables?.color : undefined;
    if (!alias || copy.type !== 'SOLID') return copy;

    try {
      const variable = await figma.variables.getVariableByIdAsync(alias.id);
      return variable ? figma.variables.setBoundVariableForPaint(copy, 'color', variable) : copy;
    } catch {
      return copy;
    }
  }));
}

async function resetProperty(node: SceneNode, field: string, value: unknown) {
  // Dynamic property access on Figma nodes requires casting
  const nodeRecord = node as unknown as Record<string, unknown>;
  const nodeWithStyles = node as unknown as {
    setStrokeStyleIdAsync?: (id: string) => Promise<void>;
    setFillStyleIdAsync?: (id: string) => Promise<void>;
    setEffectStyleIdAsync?: (id: string) => Promise<void>;
    setTextStyleIdAsync?: (id: string) => Promise<void>;
  };

  if (field === 'strokeStyleId' && nodeWithStyles.setStrokeStyleIdAsync) {
    await nodeWithStyles.setStrokeStyleIdAsync(value as string);
  } else if (field === 'fillStyleId' && nodeWithStyles.setFillStyleIdAsync) {
    await nodeWithStyles.setFillStyleIdAsync(value as string);
  } else if (field === 'effectStyleId' && nodeWithStyles.setEffectStyleIdAsync) {
    await nodeWithStyles.setEffectStyleIdAsync(value as string);
  } else if (field === 'textStyleId' && nodeWithStyles.setTextStyleIdAsync) {
    await nodeWithStyles.setTextStyleIdAsync(value as string);
  } else if (field === 'fontName' && node.type === 'TEXT') {
    const fontName = value as FontName | typeof figma.mixed;
    if (fontName === figma.mixed) return;
    try {
      await figma.loadFontAsync(fontName);
    } catch {
      throw new Error(`font "${fontName.family} ${fontName.style}" isn't available`);
    }
    node.fontName = fontName;
  } else if ((field === 'width' || field === 'height') && 'resize' in node) {
    // width and height are read-only; resize() is the only writer.
    const source = value as number;
    node.resize(field === 'width' ? source : node.width, field === 'height' ? source : node.height);
  } else if ((field === 'fills' || field === 'strokes') && Array.isArray(value)) {
    nodeRecord[field] = await clonePaints(value as Paint[]);
  } else if (Array.isArray(value)) {
    // Clone arrays so the node does not share the source's objects.
    nodeRecord[field] = JSON.parse(JSON.stringify(value));
  } else {
    nodeRecord[field] = value;
  }
}

function resolveComponentPropertyResetTarget(
  node: SceneNode,
  sourceNode: BaseNode,
  propertyNames: Array<string | null>
): { key: string; value: string | boolean } | null {
  if (node.type !== 'INSTANCE') return null;

  const currentProperties = getComponentPropertyValueMap(node);
  const sourceProperties = getComponentPropertyValueMap(sourceNode);

  for (const name of propertyNames) {
    if (!name) continue;
    const lookupKey = cleanPropertyName(name).toLowerCase();
    const current = currentProperties.get(lookupKey);
    const source = sourceProperties.get(lookupKey);
    if (current && source && source.value !== undefined) {
      return { key: current.key, value: source.value };
    }
  }

  return null;
}

function restoreComponentProperties(
  node: SceneNode,
  sourceNode: BaseNode,
  propertyNames: Array<string | null> = []
): ResetResult {
  try {
    if (node.type !== 'INSTANCE') return { ok: false, reason: 'not an instance' };

    if (propertyNames.some(Boolean)) {
      const target = resolveComponentPropertyResetTarget(node, sourceNode, propertyNames);
      if (!target) return { ok: false, reason: 'property not found on the component' };
      node.setProperties({ [target.key]: target.value });
      return { ok: true };
    }

    const defaults: Record<string, string | boolean> = {};
    for (const entry of getComponentPropertyValueMap(sourceNode).values()) {
      if (entry.value !== undefined) defaults[entry.key] = entry.value;
    }
    node.setProperties(defaults);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

async function restoreFields(node: SceneNode, expected: ExpectedValue[], field: string): Promise<ResetResult> {
  try {
    if (expected.length === 0) return { ok: false, reason: `the component has no ${formatFieldLabel(field).toLowerCase()}` };

    const changes = getChangedValues(node, expected).filter(entry => entry.value !== figma.mixed);
    if (changes.length === 0) return { ok: true };

    if (node.type === 'TEXT' && changes.some(entry => TEXT_FIELDS.has(entry.name))) {
      await loadFontsForTextNode(node);
      // A restored text style or font needs the source's fonts too.
      for (const entry of changes) {
        if ((entry.name === 'fontName' || entry.name === 'textStyleId') && entry.source.type === 'TEXT') {
          await loadFontsForTextNode(entry.source);
        }
      }
    }

    let firstError: string | null = null;
    let restored = 0;
    for (const entry of changes) {
      try {
        await resetProperty(node, entry.name, entry.value);
        restored++;
      } catch (error) {
        firstError = firstError || (error instanceof Error ? error.message : String(error));
      }
    }

    return restored > 0 ? { ok: true } : { ok: false, reason: firstError || 'nothing to restore' };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

function findOwnerOverride(
  instance: InstanceNode,
  node: SceneNode,
  field: string
): InstanceNode | null {
  const fields = field === 'componentProperties' ? ['componentProperties'] : getFieldsToReset(field);
  for (const owner of getOwnerInstances(instance)) {
    const override = owner.overrides.find(entry => entry.id === node.id);
    if (override && override.overriddenFields.some(name => fields.includes(name))) return owner;
  }
  return null;
}

async function describeResetTarget(node: SceneNode, field: string, expected: ExpectedValue[]): Promise<string> {
  const value = await describeFieldValue(getExpectedRecord(node, field, expected), field);
  const label = formatFieldLabel(field).toLowerCase();
  return value !== null ? `${label} → ${value}` : label;
}

async function describePropertyResetTarget(sourceNode: BaseNode, prop: string | null): Promise<string> {
  if (!prop) return formatFieldLabel('componentProperties').toLowerCase();

  const source = getComponentPropertyValueMap(sourceNode).get(cleanPropertyName(prop).toLowerCase());
  return `${prop} → ${await describePropertyValue(source)}`;
}

async function resetAllOverrides(instances: InstanceNode[]) {
  let resetCount = 0;
  for (const instance of instances) {
    try {
      instance.removeOverrides();
      resetCount++;
    } catch (error) {
      console.error('Error resetting instance:', error);
    }
  }

  // Styles a swap dropped aren't overrides, so removeOverrides() leaves them.
  let restoredStyles = 0;
  try {
    const context = createLookupContext();
    for (const instance of instances) {
      const lostStyles = await findLostStyles(instance, context);
      for (const { node, field, expected } of lostStyles) {
        if ((await restoreFields(node, expected, field)).ok) restoredStyles++;
      }
    }
  } catch (error) {
    console.error('Error restoring styles:', error);
  }

  const restored = restoredStyles > 0
    ? ` · restored ${restoredStyles} ${pluralize(restoredStyles, 'style')} a swap dropped`
    : '';
  if (resetCount > 0) {
    figma.notify(`Reset all overrides on ${resetCount} ${pluralize(resetCount, 'instance')}${restored}`);
  } else {
    figma.notify('Failed to reset instances', { error: true });
  }
}

async function resetPathOverride(instances: InstanceNode[], payload: OverridePayload) {
  const path = payload.path || [];
  const field = payload.field as string;
  const prop = payload.prop || null;
  const context = createLookupContext();
  let resetCount = 0;
  let resetDescription = '';
  let nodeName = payload.name || '';
  const failures: string[] = [];

  for (const instance of instances) {
    const node = resolveChildPath(instance, path);
    if (!node || (payload.name && node.name !== payload.name)) continue;
    nodeName = node.name;

    if (field === 'componentProperties') {
      let sourceNode: SceneNode | null;
      if (path.length === 0) {
        sourceNode = await getDirectComponentPropertySourceNode(instance, context);
      } else {
        const owner = findOwnerOverride(instance, node, field);
        if (!owner) continue;
        sourceNode = await findSourceNode(owner, node, context);
      }

      if (!sourceNode) {
        failures.push("the matching layer isn't in the main component");
        continue;
      }

      const result = restoreComponentProperties(node, sourceNode, [prop]);
      if (result.ok) {
        resetCount++;
        resetDescription = resetDescription || await describePropertyResetTarget(sourceNode, prop);
      } else {
        failures.push(result.reason || 'unknown error');
      }
      continue;
    }

    const expected = await getExpectedValues(node, field, context);
    if (!expected) {
      failures.push("the matching layer isn't in the main component");
      continue;
    }
    // Already what the components say on this instance.
    if (expected.length > 0 && getChangedValues(node, expected).length === 0) continue;

    const result = await restoreFields(node, expected, field);
    if (result.ok) {
      resetCount++;
      resetDescription = resetDescription || await describeResetTarget(node, field, expected);
    } else {
      failures.push(result.reason || 'unknown error');
    }
  }

  if (failures.length > 0) {
    const partial = resetCount > 0 ? ` (reset on ${resetCount} ${pluralize(resetCount, 'instance')})` : '';
    figma.notify(`Couldn't reset ${nodeName}: ${failures[0]}${partial}`, { error: true });
  } else if (resetCount === 0) {
    figma.notify("That override isn't on the selection anymore", { error: true });
  } else if (resetCount === 1) {
    figma.notify(`Reset ${nodeName} ${resetDescription}`);
  } else {
    const label = field === 'componentProperties' && prop ? prop : formatFieldLabel(field).toLowerCase();
    figma.notify(`Reset ${nodeName} ${label} on ${resetCount} instances`);
  }
}

// Older references: JSON with a node id, or "NodeName -> Field".
function parseLegacyReference(ref: string): {
  nodeId: string | null;
  field: string | null;
  nodeName: string | null;
  componentPropertyKey: string | null;
  componentPropertyName: string | null;
} {
  try {
    const data = JSON.parse(ref);
    if (data.field) {
      return {
        nodeId: data.nodeId || null,
        field: data.field,
        nodeName: data.nodeName || null,
        componentPropertyKey: data.componentPropertyKey || null,
        componentPropertyName: data.componentPropertyName || null
      };
    }
  } catch {
    const match = ref.match(/^(.+?)\s*->\s*(.+)$/);
    if (match) {
      const nodeName = match[1].trim();
      const rawField = match[2].trim();
      const propertyMatch = rawField.match(/^Property:\s*(.+)$/i);

      if (propertyMatch) {
        return {
          nodeId: null,
          field: 'componentProperties',
          nodeName,
          componentPropertyKey: null,
          componentPropertyName: propertyMatch[1].trim()
        };
      }

      let field = rawField.replace(/\s+/g, '').replace(/^(.)/, m => m.toLowerCase());
      field = FIELD_MAPPING[field.toLowerCase()] || field;
      return { nodeId: null, field, nodeName, componentPropertyKey: null, componentPropertyName: null };
    }
  }

  return { nodeId: null, field: null, nodeName: null, componentPropertyKey: null, componentPropertyName: null };
}

async function resetLegacyOverride(instances: InstanceNode[], reference: string) {
  const { nodeId, field, nodeName, componentPropertyKey, componentPropertyName } = parseLegacyReference(reference);

  if (!field) {
    figma.notify('Invalid override reference format', { error: true });
    return;
  }

  const context = createLookupContext();
  let resetCount = 0;
  const failures: string[] = [];
  const propertyNames = [componentPropertyKey, componentPropertyName];

  for (const instance of instances) {
    for (const owner of getOwnerInstances(instance)) {
      for (const override of owner.overrides) {
        if (nodeId && override.id !== nodeId) continue;

        const node = await figma.getNodeByIdAsync(override.id) as SceneNode | null;
        if (!node || (!nodeId && nodeName && node.name !== nodeName)) continue;
        if (!isNodeInSubtree(node, instance)) continue;

        const fieldsToReset = getFieldsToReset(field);
        if (!override.overriddenFields.some(name => fieldsToReset.includes(name))) continue;

        let result: ResetResult;
        if (field === 'componentProperties') {
          const sourceNode = await findSourceNode(owner, node, context);
          if (!sourceNode) continue;
          result = restoreComponentProperties(node, sourceNode, propertyNames);
        } else {
          const expected = await getExpectedValues(node, field, context);
          if (!expected) continue;
          result = await restoreFields(node, expected, field);
        }

        if (result.ok) resetCount++;
        else failures.push(result.reason || 'unknown error');
      }
    }

    if (field === 'componentProperties' && (!nodeId || instance.id === nodeId) && (!nodeName || instance.name === nodeName)) {
      const sourceNode = await getDirectComponentPropertySourceNode(instance, context);
      if (!sourceNode) continue;

      const result = restoreComponentProperties(instance, sourceNode, propertyNames);
      if (result.ok) resetCount++;
    }
  }

  if (failures.length > 0 && resetCount === 0) {
    figma.notify(`Couldn't reset ${nodeName || 'override'}: ${failures[0]}`, { error: true });
  } else if (resetCount > 0) {
    const displayField = componentPropertyName || formatFieldLabel(field);
    figma.notify(`Reset "${displayField}" on ${resetCount} ${pluralize(resetCount, 'node')}${nodeName ? ` (${nodeName})` : ''}`);
  } else {
    figma.notify('No matching overrides found to reset', { error: true });
  }
}

/**
 * Reset a specific override on the selected instances.
 * @param overrideReference A row payload, an older JSON payload, or "NodeName -> Field"
 */
export async function resetSpecificOverride(overrideReference: string) {
  overrideRowsCache = null;
  const instances = selectedInstances();
  if (instances.length === 0) throw new Error('No instances selected');

  const payload = parsePayload(overrideReference);
  if (!payload) {
    await resetLegacyOverride(instances, overrideReference);
  } else if (payload.all) {
    await resetAllOverrides(instances);
  } else if (Array.isArray(payload.path) && payload.field) {
    await resetPathOverride(instances, payload);
  } else {
    figma.notify('Invalid override reference format', { error: true });
  }
}
