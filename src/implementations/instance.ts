import {
  getCachedMainComponent,
  getComponentPropertyDefinitions,
  cleanPropertyName,
  extractPropertyValue,
  findPropertyKey,
  normalizeSearchText as normalizePropertySearchText,
  matchesSearchTokens as matchesPropertySearch,
  pluralize,
} from './instance-shared';
import { findComponentRows, formatNoComponentMatch, leafName, prepareSelectionThumbnail, resolveComponentValue } from './component-swap';
import { ICONS, applyThumbnails, withThumbnail } from './suggestion-icons';

export { pluralize } from './instance-shared';
export { searchComponentsForSwap, swapInstance } from './component-swap';
export { searchInstanceOverrides, resetSpecificOverride } from './overrides';

const VARIANT_SPACING = 20;
const COMPONENT_SET_PADDING = 20;
const COMPONENT_SET_STROKE_COLOR = { r: 0x97 / 255, g: 0x47 / 255, b: 0xFF / 255 };

function generateUniqueVariantName(baseName: string, existingNames: Set<string>): string {
  const match = baseName.match(/^(.*?)(\d+)$/);
  const namePrefix = match ? match[1] : baseName;
  const startNumber = match ? parseInt(match[2], 10) + 1 : 1;

  let newName = `${namePrefix}${startNumber}`;
  let counter = startNumber;
  while (existingNames.has(newName)) {
    counter++;
    newName = `${namePrefix}${counter}`;
  }
  return newName;
}

function calculateBoundingBox(nodes: readonly ComponentNode[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + node.width);
    maxY = Math.max(maxY, node.y + node.height);
  }

  return { minX, minY, maxX, maxY };
}

function applyComponentSetStyling(componentSet: ComponentSetNode, padding: number = COMPONENT_SET_PADDING) {
  componentSet.strokes = [{
    type: 'SOLID',
    color: COMPONENT_SET_STROKE_COLOR,
    opacity: 1
  }];
  componentSet.strokeWeight = 1;
  componentSet.strokeAlign = 'INSIDE';
  componentSet.dashPattern = [10, 5];
  componentSet.paddingLeft = padding;
  componentSet.paddingRight = padding;
  componentSet.paddingTop = padding;
  componentSet.paddingBottom = padding;
}

interface PropertyDefinition {
  type: string;
  variantOptions?: string[];
  defaultValue?: string | boolean;
  preferredValues?: InstanceSwapPreferredValue[];
}

interface PropertyData {
  type: string;
  values: Set<string>;
  propertyDef: PropertyDefinition;
  cleanedName?: string;
  displayName?: string;
  originKey?: string;
  order?: number;
  optionSignature?: string;
  variantOptions?: string[];
}

interface NonVariantPropertyTarget {
  rootInstance: InstanceNode;
  instance: InstanceNode;
  propertyKey: string;
  propertyDef: PropertyDefinition;
  // Read once when the inventory is built, so typing never rescans instances.
  currentValue: string | boolean | undefined;
}

interface PropertyAccumulator {
  key: string;
  name: string;
  data: PropertyData;
  rootIds: Set<string>;
  targets: NonVariantPropertyTarget[];
}

interface VariantPropertyTarget {
  rootInstance: InstanceNode;
  instance: InstanceNode;
  propertyKey: string;
  allProperties: ComponentPropertyDefinitions;
  currentValue: string | undefined;
}

interface VariantPropertyGroup {
  cleanedName: string;
  displayName: string;
  optionSignature: string;
  selectionSignature: string;
  order: number;
  variantOptions: string[];
  propertyDef: PropertyDefinition;
  targets: VariantPropertyTarget[];
  rootIds: Set<string>;
  values: Set<string>;
}

interface InstancePropertySource {
  rootInstance: InstanceNode;
  instance: InstanceNode;
  mainComponent: ComponentNode;
}

interface InstancePropertyInventory {
  nonVariantProperties: Map<string, PropertyAccumulator>;
  variantGroups: VariantPropertyGroup[];
}

let instancePropertyInventoryCache: {
  key: string;
  sources: InstanceNode[];
  promise: Promise<InstancePropertyInventory>;
} | null = null;

function getInstancePropertySourceCacheSignature(instance: InstanceNode): string {
  return instance.id;
}

function getInstancePropertyInventoryCacheIdentity(instances: InstanceNode[]): { key: string; sources: InstanceNode[] } {
  const sources = instances;
  const key = instances.map(getInstancePropertySourceCacheSignature).join('\x1e');

  return { key, sources };
}

function hasSameInstancePropertyCacheSources(a: InstanceNode[], b: InstanceNode[]): boolean {
  return a.length === b.length && a.every((source, index) => source === b[index]);
}

function invalidateInstancePropertyInventoryCache(): void {
  instancePropertyInventoryCache = null;
}

type SuggestionItem = string | { name: string; data: unknown; icon?: string };

const VARIANT_OPTION_SIGNATURE_SEPARATOR = '\x1f';
const VARIANT_GROUP_KEY_SEPARATOR = '\x1e';
const VARIANT_GROUP_TOKEN_REGEX = /\[\[kc-variant-options=([^\]]*)\]\]/;
const VARIANT_GROUP_TOKEN_FRAGMENT_REGEX = /\[\[kc-variant-options=[^\]]*\]\]/g;
const PROPERTY_ORIGIN_TOKEN_REGEX = /\[\[kc-property-origin=([^\]]*)\]\]/;
const PROPERTY_ORIGIN_TOKEN_FRAGMENT_REGEX = /\[\[kc-property-origin=[^\]]*\]\]/g;
const ROW_TOKEN_FRAGMENT_REGEX = /\[\[kc-(?:hint=[a-z]+|empty)\]\]/g;

function getVariantOptionSignature(options: readonly string[]): string {
  return [...options].sort().join(VARIANT_OPTION_SIGNATURE_SEPARATOR);
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function withVariantGroupToken(propertyName: string, optionSignature: string): string {
  return `${propertyName}[[kc-variant-options=${encodeURIComponent(optionSignature)}]]`;
}

function withPropertyOriginToken(propertyName: string, originKey: string): string {
  return `${propertyName}[[kc-property-origin=${encodeURIComponent(originKey)}]]`;
}

function stripInstancePropertyTokens(value: string): string {
  return value
    .replace(VARIANT_GROUP_TOKEN_FRAGMENT_REGEX, '')
    .replace(PROPERTY_ORIGIN_TOKEN_FRAGMENT_REGEX, '')
    .replace(ROW_TOKEN_FRAGMENT_REGEX, '');
}

function parseVariantGroupPropertyName(propertyName: string): { propertyName: string; optionSignature: string | null } {
  const tokenMatch = propertyName.match(VARIANT_GROUP_TOKEN_REGEX);
  return {
    propertyName: stripInstancePropertyTokens(propertyName).trim(),
    optionSignature: tokenMatch ? safeDecodeURIComponent(tokenMatch[1]) : null
  };
}

export function stripInstancePropertyVariantGroupToken(value: string): string {
  return stripInstancePropertyTokens(value);
}

function parsePropertyOriginPropertyName(propertyName: string): { propertyName: string; originKey: string | null } {
  const tokenMatch = propertyName.match(PROPERTY_ORIGIN_TOKEN_REGEX);
  return {
    propertyName: stripInstancePropertyTokens(propertyName).trim(),
    originKey: tokenMatch ? safeDecodeURIComponent(tokenMatch[1]) : null
  };
}

function formatVariantOptionSetLabel(options: readonly string[]): string {
  const maxDisplay = 4;
  if (options.length <= maxDisplay) {
    return options.join(', ');
  }

  const displayedOptions = options.slice(0, maxDisplay).join(', ');
  return `${displayedOptions}, +${options.length - maxDisplay}`;
}

function getPropertyOriginKey(rootInstance: InstanceNode, instance: InstanceNode): string {
  return instance === rootInstance ? 'direct' : `nested:${instance.name}`;
}

function getPropertyDisplayName(rootInstance: InstanceNode, instance: InstanceNode, propertyName: string): string {
  const cleanedName = cleanPropertyName(propertyName);
  return instance === rootInstance ? cleanedName : `${instance.name} › ${cleanedName}`;
}

function getPropertyKeysInFigmaPanelOrder(allProperties: ComponentPropertyDefinitions): string[] {
  const propertyKeys = Object.keys(allProperties);
  const variantKeys: string[] = [];
  const nonVariantKeys: string[] = [];

  for (const propertyKey of propertyKeys) {
    const propertyDef = allProperties[propertyKey];
    if (propertyDef?.type === 'VARIANT') {
      variantKeys.push(propertyKey);
    } else {
      nonVariantKeys.push(propertyKey);
    }
  }

  return [...variantKeys, ...nonVariantKeys];
}

function addVariantPropertyGroupTarget(
  groups: Map<string, VariantPropertyGroup>,
  rootInstance: InstanceNode,
  instance: InstanceNode,
  allProperties: ComponentPropertyDefinitions,
  propertyKey: string,
  order: number
): void {
  const propertyDef = allProperties[propertyKey];
  if (!propertyDef || propertyDef.type !== 'VARIANT' || !propertyDef.variantOptions) return;

  const cleanedName = cleanPropertyName(propertyKey);
  const displayName = getPropertyDisplayName(rootInstance, instance, propertyKey);
  const optionSignature = getVariantOptionSignature(propertyDef.variantOptions);
  const originKey = getPropertyOriginKey(rootInstance, instance);
  const selectionSignature = `${originKey}${VARIANT_GROUP_KEY_SEPARATOR}${optionSignature}`;
  const groupKey = `${originKey}${VARIANT_GROUP_KEY_SEPARATOR}${cleanedName}${VARIANT_GROUP_KEY_SEPARATOR}${optionSignature}`;

  let group = groups.get(groupKey);
  if (!group) {
    group = {
      cleanedName,
      displayName,
      optionSignature,
      selectionSignature,
      order,
      variantOptions: propertyDef.variantOptions,
      propertyDef,
      targets: [],
      rootIds: new Set(),
      values: new Set()
    };
    groups.set(groupKey, group);
  }

  const currentProp = instance.componentProperties[propertyKey];
  const currentValue = currentProp !== undefined ? String(extractPropertyValue(currentProp)) : undefined;
  group.targets.push({ rootInstance, instance, propertyKey, allProperties, currentValue });
  group.rootIds.add(rootInstance.id);

  if (currentValue !== undefined) {
    group.values.add(currentValue);
  }
}

async function collectVariantPropertyGroups(
  instances: InstanceNode[],
  propertyName?: string
): Promise<VariantPropertyGroup[]> {
  return filterVariantPropertyGroupsByReference(
    (await collectInstancePropertyInventory(instances)).variantGroups,
    propertyName
  );
}

function filterVariantPropertyGroupsByReference(
  groups: VariantPropertyGroup[],
  propertyName?: string
): VariantPropertyGroup[] {
  const parsed = propertyName
    ? parseVariantGroupPropertyName(propertyName)
    : { propertyName: '', optionSignature: null };
  const propertyFilter = parsed.propertyName || undefined;
  let collectedGroups = groups;

  if (propertyFilter) {
    collectedGroups = collectedGroups.filter(group =>
      matchesPropertySearch(propertyFilter, group.cleanedName, group.displayName)
    );
  }

  if (!parsed.optionSignature) return collectedGroups;

  return collectedGroups.filter(group => group.selectionSignature === parsed.optionSignature);
}

function filterSharedVariantPropertyGroups(
  instances: InstanceNode[],
  groups: VariantPropertyGroup[]
): VariantPropertyGroup[] {
  if (instances.length <= 1) return groups;
  return groups.filter(group => group.rootIds.size === instances.length);
}

function addNonVariantPropertyAccumulator(
  propertiesMap: Map<string, PropertyAccumulator>,
  rootInstance: InstanceNode,
  instance: InstanceNode,
  propertyKey: string,
  propertyDef: PropertyDefinition,
  order: number
): void {
  if (propertyDef.type === 'VARIANT') return;

  const cleanedName = cleanPropertyName(propertyKey);
  const displayName = getPropertyDisplayName(rootInstance, instance, propertyKey);
  const originKey = getPropertyOriginKey(rootInstance, instance);
  const groupKey = `${originKey}${VARIANT_GROUP_KEY_SEPARATOR}${cleanedName}${VARIANT_GROUP_KEY_SEPARATOR}${propertyDef.type}`;

  let accumulator = propertiesMap.get(groupKey);
  if (!accumulator) {
    accumulator = {
      key: groupKey,
      name: propertyKey,
      data: {
        type: propertyDef.type,
        values: new Set(),
        propertyDef,
        cleanedName,
        displayName,
        originKey,
        order
      },
      rootIds: new Set(),
      targets: []
    };
    propertiesMap.set(groupKey, accumulator);
  }

  const currentProp = instance.componentProperties[propertyKey];
  const currentValue = currentProp !== undefined ? extractPropertyValue(currentProp) : undefined;
  accumulator.rootIds.add(rootInstance.id);
  accumulator.targets.push({ rootInstance, instance, propertyKey, propertyDef, currentValue });

  if (currentValue !== undefined) {
    accumulator.data.values.add(String(currentValue));
  }
}

function filterSharedPropertyAccumulators(
  instances: InstanceNode[],
  propertiesMap: Map<string, PropertyAccumulator>
): PropertyAccumulator[] {
  const accumulators = Array.from(propertiesMap.values());
  if (instances.length <= 1) return accumulators;
  return accumulators.filter(accumulator => accumulator.rootIds.size === instances.length);
}

async function collectInstancePropertySources(instances: InstanceNode[]): Promise<InstancePropertySource[]> {
  const sourcePromises: Array<Promise<InstancePropertySource | null>> = [];

  for (const instance of instances) {
    sourcePromises.push(
      getCachedMainComponent(instance).then(mainComponent =>
        mainComponent ? { rootInstance: instance, instance, mainComponent } : null
      )
    );

    if (instance.exposedInstances && instance.exposedInstances.length > 0) {
      for (const exposedInstance of instance.exposedInstances) {
        sourcePromises.push(
          getCachedMainComponent(exposedInstance).then(mainComponent =>
            mainComponent ? { rootInstance: instance, instance: exposedInstance, mainComponent } : null
          )
        );
      }
    }
  }

  const sources = await Promise.all(sourcePromises);
  return sources.filter((source): source is InstancePropertySource => source !== null);
}

async function buildInstancePropertyInventory(instances: InstanceNode[]): Promise<InstancePropertyInventory> {
  const nonVariantProperties = new Map<string, PropertyAccumulator>();
  const variantGroups = new Map<string, VariantPropertyGroup>();
  let propertyOrder = 0;
  const sources = await collectInstancePropertySources(instances);

  for (const source of sources) {
    const allProperties = getComponentPropertyDefinitions(source.mainComponent);

    const propKeys = getPropertyKeysInFigmaPanelOrder(allProperties);
    for (const propName of propKeys) {
      const order = propertyOrder++;
      const propDef = allProperties[propName];
      if (!propDef) continue;

      if (propDef.type === 'VARIANT') {
        addVariantPropertyGroupTarget(
          variantGroups,
          source.rootInstance,
          source.instance,
          allProperties,
          propName,
          order
        );
      } else {
        addNonVariantPropertyAccumulator(
          nonVariantProperties,
          source.rootInstance,
          source.instance,
          propName,
          propDef,
          order
        );
      }
    }
  }

  return {
    nonVariantProperties,
    variantGroups: Array.from(variantGroups.values())
  };
}

async function collectInstancePropertyInventory(instances: InstanceNode[]): Promise<InstancePropertyInventory> {
  const cacheIdentity = getInstancePropertyInventoryCacheIdentity(instances);
  if (
    instancePropertyInventoryCache?.key === cacheIdentity.key &&
    hasSameInstancePropertyCacheSources(instancePropertyInventoryCache.sources, cacheIdentity.sources)
  ) {
    return await instancePropertyInventoryCache.promise;
  }

  const promise = buildInstancePropertyInventory(instances).catch(error => {
    if (
      instancePropertyInventoryCache?.key === cacheIdentity.key &&
      hasSameInstancePropertyCacheSources(instancePropertyInventoryCache.sources, cacheIdentity.sources)
    ) {
      instancePropertyInventoryCache = null;
    }
    throw error;
  });
  instancePropertyInventoryCache = {
    key: cacheIdentity.key,
    sources: cacheIdentity.sources,
    promise
  };
  return await promise;
}

function getPropertyReferenceMatchRank(propertyReference: string, data: PropertyData): number {
  const normalizedReference = normalizePropertySearchText(propertyReference);
  const normalizedName = normalizePropertySearchText(data.cleanedName || '');
  const normalizedDisplayName = normalizePropertySearchText(data.displayName || data.cleanedName || '');
  const compactReference = normalizedReference.replace(/\s+/g, '');
  const compactName = normalizedName.replace(/\s+/g, '');
  const compactDisplayName = normalizedDisplayName.replace(/\s+/g, '');

  if (normalizedDisplayName === normalizedReference) return 0;
  if (normalizedName === normalizedReference) return 1;
  if (compactDisplayName === compactReference) return 2;
  if (compactName === compactReference) return 3;
  if (normalizedDisplayName.startsWith(normalizedReference)) return 4;
  if (normalizedName.startsWith(normalizedReference)) return 5;
  return 6;
}

function getNonVariantPropertyReferenceMatchRank(
  propertyReference: string,
  accumulator: PropertyAccumulator
): number {
  const parsed = parsePropertyOriginPropertyName(propertyReference);
  return getPropertyReferenceMatchRank(parsed.propertyName, accumulator.data);
}

function getVariantPropertyGroupReferenceMatchRank(
  propertyReference: string,
  group: VariantPropertyGroup
): number {
  return getPropertyReferenceMatchRank(propertyReference, {
    type: 'VARIANT',
    values: group.values,
    propertyDef: group.propertyDef,
    cleanedName: group.cleanedName,
    displayName: group.displayName,
    order: group.order,
    optionSignature: group.selectionSignature,
    variantOptions: group.variantOptions
  });
}

function filterBestRankedVariantPropertyGroups(
  propertyReference: string,
  groups: VariantPropertyGroup[]
): VariantPropertyGroup[] {
  const parsed = parseVariantGroupPropertyName(propertyReference);
  if (!parsed.propertyName || groups.length <= 1) return groups;

  const bestRank = Math.min(
    ...groups.map(group => getVariantPropertyGroupReferenceMatchRank(parsed.propertyName, group))
  );

  return groups.filter(group =>
    getVariantPropertyGroupReferenceMatchRank(parsed.propertyName, group) === bestRank
  );
}

function getBestVariantPropertyReferenceMatchRank(
  instances: InstanceNode[],
  allGroups: VariantPropertyGroup[],
  propertyReference: string
): number | null {
  const groups = filterSharedVariantPropertyGroups(
    instances,
    filterVariantPropertyGroupsByReference(allGroups, propertyReference)
  );
  if (groups.length === 0) return null;

  const parsed = parseVariantGroupPropertyName(propertyReference);
  if (!parsed.propertyName) return 0;

  return Math.min(
    ...groups.map(group => getVariantPropertyGroupReferenceMatchRank(parsed.propertyName, group))
  );
}

function findSharedNonVariantPropertyAccumulatorFromMap(
  instances: InstanceNode[],
  propertiesMap: Map<string, PropertyAccumulator>,
  propertyReference: string,
  allowedTypes?: string[]
): PropertyAccumulator | null {
  const parsed = parsePropertyOriginPropertyName(propertyReference);
  const accumulators = filterSharedPropertyAccumulators(instances, propertiesMap);

  const matches = accumulators
    .filter(accumulator => !allowedTypes || allowedTypes.includes(accumulator.data.type))
    .filter(accumulator => !parsed.originKey || accumulator.data.originKey === parsed.originKey)
    .filter(accumulator => matchesPropertySearch(
      parsed.propertyName,
      accumulator.data.cleanedName || accumulator.name,
      accumulator.data.displayName || accumulator.data.cleanedName || accumulator.name
    ))
    .sort((a, b) => {
      const rankComparison =
        getNonVariantPropertyReferenceMatchRank(propertyReference, a) -
        getNonVariantPropertyReferenceMatchRank(propertyReference, b);
      if (rankComparison !== 0) return rankComparison;
      return (a.data.order ?? 0) - (b.data.order ?? 0);
    });

  return matches[0] || null;
}

function getNonVariantExecutionPropertyName(data: PropertyData): string {
  const cleanName = data.cleanedName || data.displayName || '';
  if (data.originKey && data.originKey !== 'direct') {
    return withPropertyOriginToken(cleanName, data.originKey);
  }
  return cleanName;
}

// Row values that are not plain "Property:Value" pairs.
const EMPTY_TEXT_TOKEN = '[[kc-empty]]';
const HINT_TOKEN_REGEX = /\[\[kc-hint=(text|swap)\]\]/;

function selectedInstances(): InstanceNode[] {
  return figma.currentPage.selection.filter(node => node.type === 'INSTANCE') as InstanceNode[];
}

function quoteText(value: string): string {
  const singleLine = value.replace(/\s+/g, ' ');
  return `"${singleLine.length > 24 ? `${singleLine.slice(0, 23)}…` : singleLine}"`;
}

function formatInstanceCount(count: number): string {
  return `${count} ${pluralize(count, 'instance')}`;
}

function describeChangeCount(changing: number, total: number): string {
  if (total <= 1 || changing === total) return '';
  return ` · ${changing} of ${total} ${changing === 1 ? 'changes' : 'change'}`;
}

function getUnanimousTargetCurrentValue(targets: VariantPropertyTarget[]): string | null {
  let value: string | null = null;
  for (const target of targets) {
    if (target.currentValue === undefined) return null;
    if (value === null) value = target.currentValue;
    else if (value !== target.currentValue) return null;
  }
  return value;
}

function getDistinctAccumulatorValues(accumulator: PropertyAccumulator): string[] {
  return [...new Set(accumulator.targets.map(target => String(target.currentValue)))];
}

// ================================
// Resolving a typed property reference
// ================================

type ResolvedProperty =
  | { kind: 'TEXT' | 'INSTANCE_SWAP' | 'BOOLEAN'; accumulator: PropertyAccumulator }
  | { kind: 'VARIANT' };

function resolveProperty(
  propertyName: string,
  instances: InstanceNode[],
  inventory: InstancePropertyInventory
): ResolvedProperty | null {
  if (!stripInstancePropertyTokens(propertyName).trim()) return null;

  const accumulator = findSharedNonVariantPropertyAccumulatorFromMap(
    instances,
    inventory.nonVariantProperties,
    propertyName,
    ['TEXT', 'INSTANCE_SWAP', 'BOOLEAN']
  );
  const accumulatorRank = accumulator ? getNonVariantPropertyReferenceMatchRank(propertyName, accumulator) : null;
  const variantRank = getBestVariantPropertyReferenceMatchRank(instances, inventory.variantGroups, propertyName);

  if (accumulator && (variantRank === null || (accumulatorRank !== null && accumulatorRank <= variantRank))) {
    return { kind: accumulator.data.type as 'TEXT' | 'INSTANCE_SWAP' | 'BOOLEAN', accumulator };
  }
  return variantRank !== null ? { kind: 'VARIANT' } : null;
}

// The ":" between property and value: the first one whose left side names a
// property, so text values may contain colons ("Label:Time: 10:30").
function findValueSeparator(reference: string, instances: InstanceNode[], inventory: InstancePropertyInventory): number {
  const first = reference.indexOf(':');
  for (let index = first; index !== -1; index = reference.indexOf(':', index + 1)) {
    if (resolveProperty(reference.slice(0, index).trim(), instances, inventory)) return index;
  }
  return first;
}

// A comma chains another pair ("Size:L,State:Hover") unless it sits inside a
// text or component value ("Label:Hello, world"): there it only chains when
// another property of the selection follows.
function findChainBoundaries(reference: string, instances: InstanceNode[], inventory: InstancePropertyInventory): number[] {
  const boundaries: number[] = [];
  let start = 0;

  for (let index = reference.indexOf(','); index !== -1; index = reference.indexOf(',', index + 1)) {
    const left = reference.slice(start, index);
    const nextName = reference.slice(index + 1).match(/^\s*([^:,]+):/);
    let isBoundary = !!nextName && !!resolveProperty(nextName[1].trim(), instances, inventory);

    if (!isBoundary) {
      const separator = findValueSeparator(left, instances, inventory);
      const kind = separator === -1 ? null : resolveProperty(left.slice(0, separator).trim(), instances, inventory)?.kind;
      isBoundary = kind !== 'TEXT' && kind !== 'INSTANCE_SWAP';
    }

    if (isBoundary) {
      boundaries.push(index);
      start = index + 1;
    }
  }

  return boundaries;
}

function splitPropertyChain(reference: string, instances: InstanceNode[], inventory: InstancePropertyInventory): string[] {
  const pairs: string[] = [];
  let start = 0;
  for (const boundary of findChainBoundaries(reference, instances, inventory)) {
    pairs.push(reference.slice(start, boundary));
    start = boundary + 1;
  }
  pairs.push(reference.slice(start));
  return pairs.map(pair => pair.trim()).filter(Boolean);
}

// ================================
// Suggestion rows
// ================================

interface OptionCandidate {
  group: VariantPropertyGroup;
  option: string;
  rank: number;
  index: number;
}

function optionMatchRank(option: string, filter: string): number | null {
  if (!filter) return 0;
  const optionLower = option.toLowerCase();
  const filterLower = filter.toLowerCase();
  if (optionLower === filterLower) return 0;
  if (optionLower.startsWith(filterLower)) return 1;
  if (optionLower.includes(filterLower)) return 2;
  return null;
}

function formatOptionRows(candidates: OptionCandidate[], filter: string): SuggestionItem[] {
  const displayCounts = new Map<string, number>();
  for (const { group, option } of candidates) {
    const display = `${group.displayName}\u0000${option}`;
    displayCounts.set(display, (displayCounts.get(display) || 0) + 1);
  }

  return candidates.map(({ group, option, rank }) => {
    const total = group.targets.length;
    const changing = group.targets.filter(target => target.currentValue !== option).length;
    const optionSet = (displayCounts.get(`${group.displayName}\u0000${option}`) || 0) > 1
      ? ` (${formatVariantOptionSetLabel(group.variantOptions)})`
      : '';
    const name = changing === 0
      ? `${group.displayName} · ${option} · ${filter && rank === 0 ? 'already set' : 'current'}${optionSet}`
      : `${group.displayName} → ${option}${describeChangeCount(changing, total)}${optionSet}`;

    return { name, data: `${withVariantGroupToken(group.cleanedName, group.selectionSignature)}:${option}`, icon: ICONS.variant };
  });
}

function booleanRows(accumulator: PropertyAccumulator, filter: string = ''): SuggestionItem[] {
  const name = accumulator.data.displayName || accumulator.data.cleanedName || accumulator.name;
  const executionName = getNonVariantExecutionPropertyName(accumulator.data);
  const values = accumulator.targets.map(target => target.currentValue === true);
  const onCount = values.filter(Boolean).length;
  const rows: Array<{ name: string; data: string; icon: string; changing: number }> = [];

  for (const value of [true, false]) {
    const label = value ? 'On' : 'Off';
    if (filter && parseBooleanValue(filter) !== value && !label.toLowerCase().startsWith(filter.toLowerCase())) continue;

    const changing = value ? values.length - onCount : onCount;
    rows.push({
      name: changing === 0
        ? `${name} · ${label} · ${filter ? 'already set' : 'current'}`
        : `${name} → ${label}${describeChangeCount(changing, values.length)}`,
      data: `${executionName}:${value}`,
      icon: value ? ICONS.on : ICONS.off,
      changing,
    });
  }

  // When every instance agrees, offer the change first.
  return rows
    .sort((a, b) => (a.changing === 0 ? 1 : 0) - (b.changing === 0 ? 1 : 0))
    .map(({ name: rowName, data, icon }) => ({ name: rowName, data, icon }));
}

function textHintRow(accumulator: PropertyAccumulator): SuggestionItem {
  const name = accumulator.data.displayName || accumulator.data.cleanedName || accumulator.name;
  const values = getDistinctAccumulatorValues(accumulator);
  const current = values.length === 1 ? quoteText(values[0]) : 'mixed';
  return {
    name: `${name} · ${current} · type : to edit`,
    data: `${getNonVariantExecutionPropertyName(accumulator.data)}[[kc-hint=text]]`,
    icon: ICONS.text,
  };
}

function textValueRow(accumulator: PropertyAccumulator, value: string): SuggestionItem {
  const name = accumulator.data.displayName || accumulator.data.cleanedName || accumulator.name;
  const executionName = getNonVariantExecutionPropertyName(accumulator.data);

  if (value) {
    return { name: `${name} → ${quoteText(value)}`, data: `${executionName}:${value}`, icon: ICONS.text };
  }

  const values = getDistinctAccumulatorValues(accumulator);
  const current = values.length === 1 ? quoteText(values[0]) : 'mixed';
  return { name: `${name} → clear    now ${current}`, data: `${executionName}:${EMPTY_TEXT_TOKEN}`, icon: ICONS.text };
}

async function instanceSwapHintRow(accumulator: PropertyAccumulator): Promise<SuggestionItem> {
  const name = accumulator.data.displayName || accumulator.data.cleanedName || accumulator.name;
  const values = getDistinctAccumulatorValues(accumulator);

  let current = values.length > 1 ? 'mixed' : 'none';
  if (values.length === 1) {
    try {
      const node = await figma.getNodeByIdAsync(values[0]);
      if (node && 'name' in node) {
        current = node.parent?.type === 'COMPONENT_SET' ? node.parent.name : node.name;
      }
    } catch {
      // Keep "none" when the current component can't be read.
    }
  }

  const row = {
    name: `${name} · ${leafName(current)} · type : to swap`,
    data: `${getNonVariantExecutionPropertyName(accumulator.data)}[[kc-hint=swap]]`,
    icon: ICONS.component,
  };
  return withThumbnail(row, values.length === 1
    ? { id: values[0], load: async () => await figma.getNodeByIdAsync(values[0]) as SceneNode | null }
    : null);
}

async function instanceSwapValueRows(
  instances: InstanceNode[],
  accumulator: PropertyAccumulator,
  value: string
): Promise<SuggestionItem[]> {
  const name = accumulator.data.displayName || accumulator.data.cleanedName || accumulator.name;
  const executionName = getNonVariantExecutionPropertyName(accumulator.data);
  prepareSelectionThumbnail(instances);
  const rows = await findComponentRows({
    instances,
    preferredValues: accumulator.data.propertyDef.preferredValues || [],
    query: value,
    excludeCurrent: false,
  });

  if (rows.length === 0) return [await formatNoComponentMatch(value)];
  const suggestions = rows.map(row => withThumbnail(
    { name: `${name} → ${row.label}`, data: `${executionName}:${row.value}`, icon: ICONS.component },
    row.thumbnail
  ));
  await applyThumbnails(suggestions);
  return suggestions;
}

function searchVariantOptionRows(
  instances: InstanceNode[],
  allGroups: VariantPropertyGroup[],
  propertyName: string,
  filter: string
): SuggestionItem[] {
  const groups = filterSharedVariantPropertyGroups(
    instances,
    filterVariantPropertyGroupsByReference(allGroups, propertyName)
  );
  const bestRankedGroups = filterBestRankedVariantPropertyGroups(propertyName, groups);

  if (bestRankedGroups.length === 0) {
    return [formatVariantPropertyEmptyState(instances, propertyName)];
  }

  const candidates: OptionCandidate[] = [];
  for (const group of bestRankedGroups) {
    group.variantOptions.forEach((option, index) => {
      const rank = optionMatchRank(option, filter);
      if (rank !== null) candidates.push({ group, option, rank, index });
    });
  }

  if (candidates.length === 0) {
    return [formatVariantOptionEmptyState(instances, propertyName, filter)];
  }

  candidates.sort((a, b) => (a.rank - b.rank) || (a.group.order - b.group.order) || (a.index - b.index));
  return addCurrentValueHint(formatOptionRows(candidates, filter), candidates[0]);
}

function searchAllVariantOptionRows(
  instances: InstanceNode[],
  inventory: InstancePropertyInventory,
  filter: string
): SuggestionItem[] {
  const candidates: OptionCandidate[] = [];
  for (const group of filterSharedVariantPropertyGroups(instances, inventory.variantGroups)) {
    group.variantOptions.forEach((option, index) => {
      const rank = optionMatchRank(option, filter);
      if (rank !== null) candidates.push({ group, option, rank, index });
    });
  }

  if (candidates.length === 0) {
    return [formatAllVariantOptionsEmptyState(instances, filter)];
  }

  candidates.sort((a, b) => (a.rank - b.rank) || (a.group.order - b.group.order) || (a.index - b.index));
  return addCurrentValueHint(formatOptionRows(candidates, filter), candidates[0]);
}

// "Size → XS    now M": the first row says what it replaces.
function addCurrentValueHint(rows: SuggestionItem[], top: OptionCandidate | undefined): SuggestionItem[] {
  if (!top || rows.length === 0 || typeof rows[0] === 'string') return rows;

  const current = getUnanimousTargetCurrentValue(top.group.targets);
  if (current === null || current === top.option) return rows;

  const [first, ...rest] = rows;
  return [{ ...first, name: `${first.name}    now ${current}` }, ...rest];
}

// Without a ":", every matching property expands into rows that each do one
// thing: one row per variant option, On/Off for booleans, and a hint row for
// text and component properties, which need a typed value.
async function searchPropertyRows(
  searchTerm: string,
  instances: InstanceNode[],
  inventory: InstancePropertyInventory
): Promise<SuggestionItem[]> {
  const groups = filterSharedVariantPropertyGroups(instances, inventory.variantGroups);
  const accumulators = filterSharedPropertyAccumulators(instances, inventory.nonVariantProperties);
  const tokens = normalizePropertySearchText(searchTerm).split(/\s+/).filter(Boolean);
  const entries = [
    ...groups.map(group => ({ order: group.order, group, accumulator: null as PropertyAccumulator | null })),
    ...accumulators.map(accumulator => ({ order: accumulator.data.order ?? 0, group: null as VariantPropertyGroup | null, accumulator })),
  ].sort((a, b) => a.order - b.order);

  const rows: Array<{ item: SuggestionItem; exact: boolean; candidate?: OptionCandidate }> = [];

  for (const entry of entries) {
    if (entry.group) {
      const group = entry.group;
      const candidates = group.variantOptions
        .map((option, index) => ({ group, option, rank: 0, index }))
        .filter(candidate => matchesPropertySearch(searchTerm, group.cleanedName, group.displayName, candidate.option));
      formatOptionRows(candidates, '').forEach((item, index) => {
        const option = normalizePropertySearchText(candidates[index].option);
        rows.push({ item, exact: tokens.includes(option), candidate: candidates[index] });
      });
      continue;
    }

    const accumulator = entry.accumulator as PropertyAccumulator;
    const name = accumulator.data.cleanedName || accumulator.name;
    const displayName = accumulator.data.displayName || name;

    if (accumulator.data.type === 'BOOLEAN') {
      for (const item of booleanRows(accumulator)) {
        const value = typeof item === 'string' ? '' : (item.data as string).endsWith(':true') ? 'on' : 'off';
        if (matchesPropertySearch(searchTerm, name, displayName, value)) rows.push({ item, exact: false });
      }
    } else if (matchesPropertySearch(searchTerm, name, displayName)) {
      if (accumulator.data.type === 'TEXT') rows.push({ item: textHintRow(accumulator), exact: false });
      if (accumulator.data.type === 'INSTANCE_SWAP') rows.push({ item: await instanceSwapHintRow(accumulator), exact: false });
    }
  }

  if (rows.length === 0) {
    return [formatPropertySearchEmptyState(instances, searchTerm)];
  }

  // An option typed in full ("ip?size s") goes first.
  const ordered = [...rows.filter(row => row.exact), ...rows.filter(row => !row.exact)];
  const items = ordered.map(row => row.item);
  await applyThumbnails(items);
  return addCurrentValueHint(items, ordered[0].candidate);
}

async function searchPropertyReference(
  searchTerm: string,
  instances: InstanceNode[],
  inventory: InstancePropertyInventory
): Promise<SuggestionItem[]> {
  // "ip?:value" — empty property name, search variant options across all properties.
  if (searchTerm.startsWith(':')) {
    return searchAllVariantOptionRows(instances, inventory, searchTerm.slice(1).trim());
  }

  const separator = findValueSeparator(searchTerm, instances, inventory);
  if (separator === -1) {
    return await searchPropertyRows(searchTerm, instances, inventory);
  }

  const propertyName = searchTerm.slice(0, separator).trim();
  const value = searchTerm.slice(separator + 1).trim();
  const property = resolveProperty(propertyName, instances, inventory);

  if (property?.kind === 'TEXT') return [textValueRow(property.accumulator, value)];
  if (property?.kind === 'INSTANCE_SWAP') return await instanceSwapValueRows(instances, property.accumulator, value);
  if (property?.kind === 'BOOLEAN') {
    const rows = booleanRows(property.accumulator, value);
    return rows.length > 0 ? rows : [`No value matching "${value}" for "${propertyName}" — use On or Off`];
  }

  return searchVariantOptionRows(instances, inventory.variantGroups, propertyName, value);
}

export async function searchInstanceProperties(searchTerm: string): Promise<SuggestionItem[]> {
  const instances = selectedInstances();
  if (instances.length === 0) {
    return ['No instances selected'];
  }

  const inventory = await collectInstancePropertyInventory(instances);

  // Comma-chained pairs: "Type:Primary,Size:Large" — committed pairs stay
  // as-is; suggestions are for the active (last) pair, prefixed on return.
  const boundaries = findChainBoundaries(searchTerm, instances, inventory);
  if (boundaries.length > 0) {
    const lastBoundary = boundaries[boundaries.length - 1];
    const prefix = searchTerm.slice(0, lastBoundary + 1);
    const active = searchTerm.slice(lastBoundary + 1).replace(/^\s+/, '');
    const rows = await searchPropertyReference(active, instances, inventory);
    return rows.map(item => prefixChainedSuggestion(item, prefix));
  }

  return await searchPropertyReference(searchTerm, instances, inventory);
}

// ================================
// Applying a property reference
// ================================

function parseBooleanValue(value: string): boolean | null {
  const normalized = value.trim().toLowerCase();
  if (['on', 'true', 'yes', '1', 'show', 'shown', 'visible'].includes(normalized)) return true;
  if (['off', 'false', 'no', '0', 'hide', 'hidden'].includes(normalized)) return false;
  return null;
}

function notifyUpdateFailures(name: string, failures: string[]) {
  if (failures.length === 0) return;
  figma.notify(`Couldn't update ${name} on ${formatInstanceCount(failures.length)}: ${failures[0]}`, { error: true });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function findOption(groups: VariantPropertyGroup[], value: string): { group: VariantPropertyGroup; option: string } | null {
  for (let rank = 0; rank <= 2; rank++) {
    for (const group of groups) {
      const option = group.variantOptions.find(candidate => optionMatchRank(candidate, value) === rank);
      if (option !== undefined) return { group, option };
    }
  }
  return null;
}

async function setVariantProperty(instances: InstanceNode[], propertyName: string, optionValue: string): Promise<void> {
  const groups = filterSharedVariantPropertyGroups(
    instances,
    await collectVariantPropertyGroups(instances, propertyName)
  );
  const bestRanked = filterBestRankedVariantPropertyGroups(propertyName, groups);
  const match = optionValue ? findOption(bestRanked, optionValue) || findOption(groups, optionValue) : null;

  if (!match) {
    const group = bestRanked[0] || groups[0];
    const label = stripInstancePropertyTokens(propertyName).trim();
    figma.notify(
      group
        ? `${group.displayName} has no option "${optionValue}" (${formatVariantOptionSetLabel(group.variantOptions)})`
        : `No property "${label}" on the selection`,
      { error: true }
    );
    return;
  }

  const { group, option } = match;
  const pending = group.targets.filter(target => target.currentValue !== option);

  if (pending.length === 0) {
    figma.notify(`${group.displayName} is already ${option}`);
    return;
  }

  let changed = 0;
  const failures: string[] = [];
  for (const target of pending) {
    try {
      const propertiesToSet: { [key: string]: string | boolean } = {};
      for (const [key, definition] of Object.entries(target.allProperties)) {
        if (definition?.type !== 'VARIANT') continue;
        const currentValue = target.instance.componentProperties[key];
        if (currentValue !== undefined) propertiesToSet[key] = String(extractPropertyValue(currentValue));
      }

      propertiesToSet[target.propertyKey] = option;
      target.instance.setProperties(propertiesToSet);
      changed++;
    } catch (error) {
      console.error(`Error setting variant property ${propertyName}:`, error);
      failures.push(errorMessage(error));
    }
  }

  if (changed > 0) {
    const total = group.targets.length;
    figma.notify(`${group.displayName} → ${option} on ${formatInstanceCount(total)}${changed < total ? ` (${changed} changed)` : ''}`);
  }
  notifyUpdateFailures(group.displayName, failures);
}

async function setTextPropertyAccumulator(accumulator: PropertyAccumulator, textValue: string): Promise<void> {
  const name = accumulator.data.displayName || accumulator.data.cleanedName || accumulator.name;
  const pending = accumulator.targets.filter(target => target.currentValue !== textValue);

  if (pending.length === 0) {
    figma.notify(textValue ? `${name} is already ${quoteText(textValue)}` : `${name} is already empty`);
    return;
  }

  let changed = 0;
  const failures: string[] = [];
  for (const target of pending) {
    try {
      target.instance.setProperties({ [target.propertyKey]: textValue });
      changed++;
    } catch (error) {
      console.error(`Error setting text property ${name}:`, error);
      failures.push(errorMessage(error));
    }
  }

  if (changed > 0) {
    const count = formatInstanceCount(accumulator.targets.length);
    figma.notify(textValue ? `${name} → ${quoteText(textValue)} on ${count}` : `Cleared ${name} on ${count}`);
  }
  notifyUpdateFailures(name, failures);
}

// Text properties found on some selected instances but not all of them.
async function setTextProperty(instances: InstanceNode[], propertyName: string, textValue: string): Promise<void> {
  let changed = 0;
  let matchedPropertyName = '';
  const failures: string[] = [];

  for (const instance of instances) {
    const mainComponent = await getCachedMainComponent(instance);
    if (mainComponent) {
      const { key, definition } = findPropertyKey(propertyName, getComponentPropertyDefinitions(mainComponent));
      if (key && definition && definition.type === 'TEXT') {
        try {
          instance.setProperties({ [key]: textValue });
          matchedPropertyName = matchedPropertyName || cleanPropertyName(key);
          changed++;
        } catch (error) {
          console.error(`Error setting text property ${propertyName}:`, error);
          failures.push(errorMessage(error));
        }
      }
    }

    changed += await applyToExposedInstances(instance, propertyName, 'TEXT', (exposedInstance, key) => {
      exposedInstance.setProperties({ [key]: textValue });
      matchedPropertyName = matchedPropertyName || cleanPropertyName(key);
    });
  }

  if (changed > 0) {
    figma.notify(textValue
      ? `${matchedPropertyName} → ${quoteText(textValue)} on ${formatInstanceCount(changed)}`
      : `Cleared ${matchedPropertyName} on ${formatInstanceCount(changed)}`);
  }
  notifyUpdateFailures(matchedPropertyName || propertyName, failures);
}

async function setInstanceSwapPropertyAccumulator(accumulator: PropertyAccumulator, value: string): Promise<void> {
  const resolved = await resolveComponentValue(value);
  if (!resolved) return;

  const name = accumulator.data.displayName || accumulator.data.cleanedName || accumulator.name;
  let changed = 0;
  const failures: string[] = [];
  for (const target of accumulator.targets) {
    try {
      target.instance.setProperties({ [target.propertyKey]: resolved.target.component.id });
      changed++;
    } catch (error) {
      failures.push(errorMessage(error));
    }
  }

  if (changed > 0) {
    figma.notify(`${name} → ${leafName(resolved.name)} on ${formatInstanceCount(changed)}`);
  }
  notifyUpdateFailures(name, failures);
}

// `true`/`false` set every instance; "toggle" flips a value they share, and
// makes a mixed selection consistent by switching everything on.
async function setBooleanPropertyAccumulator(accumulator: PropertyAccumulator, mode: boolean | 'toggle'): Promise<void> {
  const name = accumulator.data.displayName || accumulator.data.cleanedName || accumulator.name;
  const values = accumulator.targets.map(target => target.currentValue === true);
  const unanimous = values.every(value => value === values[0]);
  const nextValue = mode === 'toggle' ? (unanimous ? !values[0] : true) : mode;
  const label = nextValue ? 'On' : 'Off';
  const pending = accumulator.targets.filter((_, index) => values[index] !== nextValue);

  if (pending.length === 0) {
    figma.notify(`${name} is already ${label}`);
    return;
  }

  let changed = 0;
  const failures: string[] = [];
  for (const target of pending) {
    try {
      target.instance.setProperties({ [target.propertyKey]: nextValue });
      changed++;
    } catch (error) {
      console.error(`Error setting boolean property ${name}:`, error);
      failures.push(errorMessage(error));
    }
  }

  if (changed > 0) {
    const total = accumulator.targets.length;
    figma.notify(`${name} → ${label} on ${formatInstanceCount(total)}${changed < total ? ` (${changed} changed)` : ''}`);
  }
  notifyUpdateFailures(name, failures);
}

// Bare names that no shared boolean matches: toggle per instance where the
// property exists, or explain how to set the other property types.
async function applyBarePropertyName(instances: InstanceNode[], propertyName: string): Promise<void> {
  let changed = 0;
  let missing = 0;

  for (const instance of instances) {
    let { definition: propertyDef, keyInMain: realPropertyKey } = await findBooleanPropertyInInstanceOrExposed(instance, propertyName);
    if (!propertyDef) {
      const fallback = await findPropertyInInstanceOrExposed(instance, propertyName);
      propertyDef = fallback.definition;
      realPropertyKey = fallback.keyInMain;
    }

    if (!propertyDef) {
      missing++;
      continue;
    }

    if (propertyDef.type === 'TEXT') {
      figma.notify(`Type "ip?${propertyName}:" and the new text`);
      return;
    }
    if (propertyDef.type === 'VARIANT') {
      figma.notify(`Type "ip?${propertyName}" to see its options`);
      return;
    }
    if (propertyDef.type === 'INSTANCE_SWAP') {
      figma.notify(`Type "ip?${propertyName}:" to search components`);
      return;
    }
    if (propertyDef.type !== 'BOOLEAN') {
      missing++;
      continue;
    }

    try {
      if (realPropertyKey) {
        const currentValue = extractPropertyValue(instance.componentProperties[realPropertyKey]) as boolean;
        instance.setProperties({ [realPropertyKey]: !currentValue });
        changed++;
      }
    } catch (error) {
      console.error(`Error setting property ${propertyName}:`, error);
    }

    changed += await applyToExposedInstances(instance, propertyName, 'BOOLEAN', (exposedInstance, key) => {
      const currentValue = extractPropertyValue(exposedInstance.componentProperties[key]) as boolean;
      exposedInstance.setProperties({ [key]: !currentValue });
    });
  }

  if (changed > 0) {
    figma.notify(`Toggled ${propertyName} on ${formatInstanceCount(changed)}`);
  } else if (missing > 0) {
    figma.notify(`No property "${propertyName}" on the selection`, { error: true });
  }
}

async function applyPropertyReference(reference: string, instances: InstanceNode[]): Promise<void> {
  const hint = reference.match(HINT_TOKEN_REGEX);
  if (hint) {
    const propertyName = stripInstancePropertyTokens(reference.replace(HINT_TOKEN_REGEX, '')).trim();
    figma.notify(hint[1] === 'text'
      ? `Type "ip?${propertyName}:" and the new text`
      : `Type "ip?${propertyName}:" to search components`);
    return;
  }

  // Descriptive rows saved in history by older versions.
  const legacyRow = reference.match(/^([^:]+):\s*\((Variant|Text|Instance_swap)\s*-/);
  if (legacyRow) {
    const propertyName = stripInstancePropertyVariantGroupToken(legacyRow[1].trim());
    figma.notify(legacyRow[2] === 'Variant'
      ? `Type "ip?${propertyName}" to see its options`
      : legacyRow[2] === 'Text'
        ? `Type "ip?${propertyName}:" and the new text`
        : `Type "ip?${propertyName}:" to search components`);
    return;
  }

  invalidateInstancePropertyInventoryCache();
  const inventory = await collectInstancePropertyInventory(instances);
  const separator = findValueSeparator(reference, instances, inventory);

  if (separator === -1) {
    const propertyName = reference.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const property = resolveProperty(propertyName, instances, inventory);
    if (property?.kind === 'BOOLEAN') {
      return await setBooleanPropertyAccumulator(property.accumulator, 'toggle');
    }
    return await applyBarePropertyName(instances, propertyName);
  }

  const propertyName = reference.slice(0, separator).trim();
  const rawValue = reference.slice(separator + 1).trim();
  const value = rawValue === EMPTY_TEXT_TOKEN ? '' : rawValue;
  const lookupPropertyName = stripInstancePropertyVariantGroupToken(propertyName);
  const property = resolveProperty(propertyName, instances, inventory);

  if (property?.kind === 'TEXT') return await setTextPropertyAccumulator(property.accumulator, value);
  if (property?.kind === 'INSTANCE_SWAP') return await setInstanceSwapPropertyAccumulator(property.accumulator, value);
  if (property?.kind === 'BOOLEAN') {
    const booleanValue = parseBooleanValue(value);
    if (booleanValue === null) {
      figma.notify(`${lookupPropertyName} takes On or Off`, { error: true });
      return;
    }
    return await setBooleanPropertyAccumulator(property.accumulator, booleanValue);
  }
  if (property?.kind === 'VARIANT') return await setVariantProperty(instances, propertyName, value);

  // Properties that only some selected instances have.
  const { definition } = await findPropertyInInstanceOrExposed(instances[0], lookupPropertyName);
  if (definition?.type === 'TEXT') return await setTextProperty(instances, lookupPropertyName, value);
  if (definition?.type === 'VARIANT') return await setVariantProperty(instances, propertyName, value);

  figma.notify(`No property "${lookupPropertyName}" on the selection`, { error: true });
}

export async function setInstanceProperty(propertyReference: string) {
  const instances = selectedInstances();
  if (instances.length === 0) {
    throw new Error('No instances selected');
  }

  invalidateInstancePropertyInventoryCache();
  const inventory = await collectInstancePropertyInventory(instances);
  for (const pair of splitPropertyChain(propertyReference, instances, inventory)) {
    await applyPropertyReference(pair, instances);
  }
}

function isInfoSuggestion(text: string): boolean {
  return text.startsWith('No ');
}

function getInstanceSelectionScope(instances: InstanceNode[]): { prefix: string; suffix: string } {
  if (instances.length <= 1) {
    return { prefix: '', suffix: 'on the selected instance' };
  }

  return { prefix: 'shared ', suffix: `across ${instances.length} selected instances` };
}

function formatPropertySearchEmptyState(instances: InstanceNode[], searchTerm: string): string {
  const { prefix, suffix } = getInstanceSelectionScope(instances);
  const cleanedSearch = stripInstancePropertyTokens(searchTerm).trim();

  if (cleanedSearch) {
    return `No ${prefix}editable properties matching "${cleanedSearch}" ${suffix}`;
  }

  return `No ${prefix}editable properties found ${suffix}`;
}

function formatVariantPropertyEmptyState(instances: InstanceNode[], propertyName: string): string {
  const { prefix, suffix } = getInstanceSelectionScope(instances);
  const cleanedPropertyName = stripInstancePropertyTokens(propertyName).trim();

  if (cleanedPropertyName) {
    return `No ${prefix}variant property matching "${cleanedPropertyName}" ${suffix}`;
  }

  return `No ${prefix}variant properties found ${suffix}`;
}

function formatVariantOptionEmptyState(
  instances: InstanceNode[],
  propertyName: string,
  optionFilter: string
): string {
  const { suffix } = getInstanceSelectionScope(instances);
  const cleanedPropertyName = stripInstancePropertyTokens(propertyName).trim();

  if (optionFilter) {
    return `No variant option matching "${optionFilter}" for "${cleanedPropertyName}" ${suffix}`;
  }

  return `No other variant options available for "${cleanedPropertyName}" ${suffix}`;
}

function formatAllVariantOptionsEmptyState(instances: InstanceNode[], optionFilter: string): string {
  const { prefix, suffix } = getInstanceSelectionScope(instances);

  if (optionFilter) {
    return `No ${prefix}variant options matching "${optionFilter}" ${suffix}`;
  }

  return `No ${prefix}variant options available ${suffix}`;
}

function prefixChainedSuggestion(item: SuggestionItem, prefix: string): SuggestionItem {
  if (typeof item === 'string') {
    if (isInfoSuggestion(item)) return item;
    // Keep the dropdown label clean; thread the committed chain through `data`
    // so execution still resolves every pair.
    return { name: item, data: prefix + item };
  }

  const data = typeof item.data === 'string' && !isInfoSuggestion(item.data)
    ? prefix + item.data
    : item.data;

  return { ...item, data };
}

async function applyToExposedInstances(
  instance: InstanceNode,
  propertyName: string,
  expectedType: string,
  applyFn: (exposedInstance: InstanceNode, propertyKey: string) => Promise<void> | void
): Promise<number> {
  let count = 0;

  if (!instance.exposedInstances || instance.exposedInstances.length === 0) {
    return count;
  }

  for (const exposedInstance of instance.exposedInstances) {
    const exposedMainComponent = await getCachedMainComponent(exposedInstance);
    if (!exposedMainComponent) continue;

    const exposedProperties = getComponentPropertyDefinitions(exposedMainComponent);
    const { key: exposedRealKey, definition: exposedPropDef } = findPropertyKey(propertyName, exposedProperties);

    if (exposedRealKey && exposedPropDef && exposedPropDef.type === expectedType) {
      try {
        await applyFn(exposedInstance, exposedRealKey);
        count++;
      } catch (error) {
        console.error(`Error applying to exposed instance:`, error);
      }
    }
  }

  return count;
}

// A bare property name (no ":") can only drive a BOOLEAN toggle — other types
// need a value. Prefer a BOOLEAN match so fuzzy inputs like "h" don't resolve
// to an INSTANCE_SWAP/VARIANT sibling that just prints a hint and bails.
async function findBooleanPropertyInInstanceOrExposed(
  instance: InstanceNode,
  propertyName: string
): Promise<{ definition: PropertyDefinition | null; keyInMain: string | null }> {
  const searchLower = propertyName.toLowerCase();

  const scan = (allProperties: ComponentPropertyDefinitions) => {
    const keys = Object.keys(allProperties);
    const predicates: Array<(c: string) => boolean> = [
      (c) => c === searchLower,
      (c) => c.startsWith(searchLower),
      (c) => c.includes(searchLower),
    ];

    for (const predicate of predicates) {
      for (const key of keys) {
        const def = allProperties[key];
        if (!def || def.type !== 'BOOLEAN') continue;
        const cleanedKey = cleanPropertyName(key).toLowerCase();
        if (predicate(cleanedKey)) {
          return { key, definition: def };
        }
      }
    }
    return null;
  };

  const mainComponent = await getCachedMainComponent(instance);
  if (mainComponent) {
    const hit = scan(getComponentPropertyDefinitions(mainComponent));
    if (hit) return { definition: hit.definition, keyInMain: hit.key };
  }

  if (instance.exposedInstances) {
    for (const exposedInstance of instance.exposedInstances) {
      const exposedMain = await getCachedMainComponent(exposedInstance);
      if (!exposedMain) continue;
      const hit = scan(getComponentPropertyDefinitions(exposedMain));
      if (hit) return { definition: hit.definition, keyInMain: null };
    }
  }

  return { definition: null, keyInMain: null };
}

async function findPropertyInInstanceOrExposed(
  instance: InstanceNode,
  propertyName: string
): Promise<{ definition: PropertyDefinition | null; keyInMain: string | null }> {
  const mainComponent = await getCachedMainComponent(instance);
  if (mainComponent) {
    const allProperties = getComponentPropertyDefinitions(mainComponent);
    const result = findPropertyKey(propertyName, allProperties);
    if (result.definition) {
      return { definition: result.definition, keyInMain: result.key };
    }
  }

  if (instance.exposedInstances) {
    for (const exposedInstance of instance.exposedInstances) {
      const exposedMainComponent = await getCachedMainComponent(exposedInstance);
      if (!exposedMainComponent) continue;

      const exposedProperties = getComponentPropertyDefinitions(exposedMainComponent);
      const result = findPropertyKey(propertyName, exposedProperties);
      if (result.definition) {
        return { definition: result.definition, keyInMain: null };
      }
    }
  }

  return { definition: null, keyInMain: null };
}


export function resetInstance() {
  const selection = figma.currentPage.selection;
  const instances = selection.filter(node => node.type === 'INSTANCE') as InstanceNode[];

  if (instances.length === 0) {
    throw new Error('No instances selected');
  }

  let successCount = 0;

  for (const instance of instances) {
    try {
      instance.removeOverrides();
      successCount++;
    } catch (error) {
      console.error('Error resetting instance:', error);
    }
  }

  if (successCount > 0) {
    figma.notify(`Reset ${successCount} ${pluralize(successCount, 'instance')} to master component state`);
  } else {
    figma.notify('Failed to reset instances', { error: true });
  }
}

export function detachInstance() {
  const selection = figma.currentPage.selection;
  const instances = selection.filter(node => node.type === 'INSTANCE') as InstanceNode[];

  if (instances.length === 0) {
    throw new Error('No instances selected');
  }

  const detachedFrames: FrameNode[] = [];

  for (const instance of instances) {
    try {
      const frame = instance.detachInstance();
      detachedFrames.push(frame);
    } catch (error) {
      console.error('Error detaching instance:', error);
    }
  }

  if (detachedFrames.length > 0) {
    figma.currentPage.selection = detachedFrames;
    figma.notify(`Detached ${detachedFrames.length} ${pluralize(detachedFrames.length, 'instance')} to ${pluralize(detachedFrames.length, 'frame')}`);
  } else {
    figma.notify('Failed to detach instances', { error: true });
  }
}

export function createComponent() {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    throw new Error('No items selected');
  }

  const components: ComponentNode[] = [];

  for (const node of selection) {

    if ('type' in node && node.type !== 'SLICE') {
      try {
        const component = figma.createComponentFromNode(node as SceneNode);
        components.push(component);
      } catch (error) {
        console.error(`Error creating component from ${node.name}:`, error);
      }
    }
  }

  if (components.length > 0) {
    figma.currentPage.selection = components;
    figma.notify(`Created ${components.length} ${pluralize(components.length, 'component')}`);
  } else {
    figma.notify('Failed to create components', { error: true });
  }
}

export function addVariant() {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    throw new Error('No component or variant selected');
  }

  const selected = selection[0];
  let baseComponent: ComponentNode | null = null;
  let parent: ComponentSetNode | null = null;

  if (selected.type === 'COMPONENT_SET') {
    const componentSet = selected as ComponentSetNode;
    baseComponent = componentSet.defaultVariant;
    parent = componentSet;
  }

  else if (selected.type === 'COMPONENT') {
    const component = selected as ComponentNode;

    if (component.parent && component.parent.type === 'COMPONENT_SET') {
      baseComponent = component;
      parent = component.parent as ComponentSetNode;
    } else {

      const componentParent = component.parent;
      const componentIndex = componentParent && 'children' in componentParent
        ? componentParent.children.indexOf(component)
        : undefined;

      const originalX = component.x;
      const originalY = component.y;

      parent = figma.combineAsVariants([component], componentParent!, componentIndex);
      baseComponent = parent.defaultVariant;

      applyComponentSetStyling(parent, COMPONENT_SET_PADDING);

      baseComponent.x = COMPONENT_SET_PADDING;
      baseComponent.y = COMPONENT_SET_PADDING;

      parent.x = originalX - COMPONENT_SET_PADDING;
      parent.y = originalY - COMPONENT_SET_PADDING;

      figma.notify('Converted to variant set');
    }
  } else {
    throw new Error('Please select a component set or a component');
  }

  if (!baseComponent || !parent) {
    throw new Error('Could not find base variant to clone');
  }

  const newVariant = baseComponent.clone();

  const existingNames = new Set(
    (parent.children as ComponentNode[]).map(child => child.name)
  );
  newVariant.name = generateUniqueVariantName(baseComponent.name, existingNames);

  parent.appendChild(newVariant);

  const allVariants = parent.children as ComponentNode[];
  let bottommostY = 0;
  let bottomVariantX = baseComponent.x;

  for (const variant of allVariants) {
    if (variant !== newVariant) {
      const variantBottom = variant.y + variant.height;
      if (variantBottom > bottommostY) {
        bottommostY = variantBottom;
        bottomVariantX = variant.x;
      }
    }
  }

  newVariant.x = bottomVariantX;
  newVariant.y = bottommostY + VARIANT_SPACING;

  const children = parent.children as ComponentNode[];
  if (children.length > 0) {
    const bounds = calculateBoundingBox(children);
    const padding = parent.paddingLeft || 0;
    parent.resize(
      bounds.maxX - bounds.minX + (padding * 2),
      bounds.maxY - bounds.minY + (padding * 2)
    );
  }

  figma.currentPage.selection = [newVariant];

  figma.notify(`Added new variant "${newVariant.name}" based on "${baseComponent.name}"`);
}



export async function pushOverridesToMain() {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('Please select an instance');
  }

  const instance = selection[0];
  if (instance.type !== 'INSTANCE') {
    throw new Error('Selected item is not an instance');
  }

  const mainComponent = await getCachedMainComponent(instance);
  if (!mainComponent) {
    throw new Error('Main component not found');
  }

  if ((instance.fills as typeof figma.mixed | Paint[]) !== figma.mixed) {
    mainComponent.fills = instance.fills;
  }

  if ((instance.strokes as typeof figma.mixed | Paint[]) !== figma.mixed) {
    mainComponent.strokes = instance.strokes;
  }
  if ((instance.strokeWeight as typeof figma.mixed | number) !== figma.mixed) {
    mainComponent.strokeWeight = instance.strokeWeight;
  }
  if ((instance.strokeAlign as typeof figma.mixed | 'CENTER' | 'INSIDE' | 'OUTSIDE') !== figma.mixed) {
    mainComponent.strokeAlign = instance.strokeAlign;
  }
  if ((instance.dashPattern as typeof figma.mixed | number[]) !== figma.mixed) {
    mainComponent.dashPattern = instance.dashPattern;
  }

  if ((instance.effects as typeof figma.mixed | Effect[]) !== figma.mixed) {
    mainComponent.effects = instance.effects;
  }

  if ('cornerRadius' in instance && (instance.cornerRadius as typeof figma.mixed | number) !== figma.mixed) {
    mainComponent.cornerRadius = instance.cornerRadius;
  }
  if ('topLeftRadius' in instance) {
    mainComponent.topLeftRadius = instance.topLeftRadius;
    mainComponent.topRightRadius = instance.topRightRadius;
    mainComponent.bottomLeftRadius = instance.bottomLeftRadius;
    mainComponent.bottomRightRadius = instance.bottomRightRadius;
  }

  figma.notify('Pushed supported overrides (Fills, Strokes, Effects, Radius) to Main Component');
}
