

import { getStoredLibraries, getActiveLibraries } from './library';

const PROPERTY_ID_SUFFIX_REGEX = /#\d+:\d+$/;
const VARIANT_SPACING = 20;
const COMPONENT_SET_PADDING = 20;
const COMPONENT_SET_STROKE_COLOR = { r: 0x97 / 255, g: 0x47 / 255, b: 0xFF / 255 };

// Cache for main component lookups to avoid repeated async calls
const mainComponentCache = new WeakMap<InstanceNode, ComponentNode | null>();

async function getCachedMainComponent(instance: InstanceNode): Promise<ComponentNode | null> {
  if (mainComponentCache.has(instance)) {
    return mainComponentCache.get(instance)!;
  }
  const mainComponent = await instance.getMainComponentAsync();
  mainComponentCache.set(instance, mainComponent);
  return mainComponent;
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural || singular + 's');
}

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
}

function getComponentPropertyDefinitions(mainComponent: ComponentNode): ComponentPropertyDefinitions {
  const componentParent = mainComponent.parent;
  if (componentParent && componentParent.type === 'COMPONENT_SET') {
    return componentParent.componentPropertyDefinitions;
  }
  return mainComponent.componentPropertyDefinitions;
}

function cleanPropertyName(propertyName: string): string {
  return propertyName.replace(PROPERTY_ID_SUFFIX_REGEX, '');
}

function findPropertyKey(
  propertyName: string,
  allProperties: ComponentPropertyDefinitions
): { key: string | null; definition: PropertyDefinition | null } {

  if (allProperties[propertyName]) {
    return { key: propertyName, definition: allProperties[propertyName] };
  }

  const propertyKeys = Object.keys(allProperties);

  for (const key of propertyKeys) {
    const cleanedKey = cleanPropertyName(key);
    if (cleanedKey === propertyName) {
      return { key, definition: allProperties[key] };
    }
  }

  const searchLower = propertyName.toLowerCase();

  for (const key of propertyKeys) {
    const cleanedKey = cleanPropertyName(key);
    if (cleanedKey.toLowerCase().startsWith(searchLower)) {
      return { key, definition: allProperties[key] };
    }
  }

  for (const key of propertyKeys) {
    const cleanedKey = cleanPropertyName(key);
    if (cleanedKey.toLowerCase().includes(searchLower)) {
      return { key, definition: allProperties[key] };
    }
  }

  return { key: null, definition: null };
}

function extractPropertyValue(property: string | boolean | { value: string | boolean }): string | boolean {
  if (typeof property === 'object' && property !== null && 'value' in property) {
    return property.value;
  }
  return property;
}

async function searchVariantOptions(instances: InstanceNode[], propertyName: string, optionFilter: string = ''): Promise<string[]> {

  for (const instance of instances) {
    // First check main component properties
    const mainComponent = await getCachedMainComponent(instance);
    if (mainComponent) {
      const allProperties = getComponentPropertyDefinitions(mainComponent);
      const { key: realPropertyKey, definition: propertyDef } = findPropertyKey(propertyName, allProperties);

      if (realPropertyKey && propertyDef && propertyDef.type === 'VARIANT' && propertyDef.variantOptions) {

        let options = propertyDef.variantOptions;
        if (optionFilter) {
          const filterLower = optionFilter.toLowerCase();
          options = options.filter((opt: string) => opt.toLowerCase().includes(filterLower));
        }

        if (options.length === 0) {
          return [`No options matching "${optionFilter}" for "${cleanPropertyName(realPropertyKey)}"`];
        }

        return options.map((option: string) => `${realPropertyKey}:${option}`);
      }
    }

    // Then check exposed instances (nested components)
    if (instance.exposedInstances && instance.exposedInstances.length > 0) {
      for (const exposedInstance of instance.exposedInstances) {
        const exposedMainComponent = await getCachedMainComponent(exposedInstance);
        if (!exposedMainComponent) continue;

        const exposedProperties = getComponentPropertyDefinitions(exposedMainComponent);
        const { key: exposedRealKey, definition: exposedPropDef } = findPropertyKey(propertyName, exposedProperties);

        if (exposedRealKey && exposedPropDef && exposedPropDef.type === 'VARIANT' && exposedPropDef.variantOptions) {

          let options = exposedPropDef.variantOptions;
          if (optionFilter) {
            const filterLower = optionFilter.toLowerCase();
            options = options.filter((opt: string) => opt.toLowerCase().includes(filterLower));
          }

          if (options.length === 0) {
            return [`No options matching "${optionFilter}" for "${cleanPropertyName(exposedRealKey)}"`];
          }

          return options.map((option: string) => `${exposedRealKey}:${option}`);
        }
      }
    }
  }

  return [`No variant options found for "${propertyName}"`];
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


async function setVariantProperty(instances: InstanceNode[], propertyName: string, optionValue: string): Promise<void> {
  let successCount = 0;
  let errorCount = 0;
  let matchedPropertyName = '';

  for (const instance of instances) {
    const mainComponent = await getCachedMainComponent(instance);
    if (mainComponent) {
      const allVariantProperties = getComponentPropertyDefinitions(mainComponent);
      const { key: realPropertyKey, definition: propertyDef } = findPropertyKey(propertyName, allVariantProperties);

      if (realPropertyKey && propertyDef && propertyDef.type === 'VARIANT') {
        try {

          const propertiesToSet: { [key: string]: string | boolean } = {};

          const propKeys = Object.keys(allVariantProperties);
          for (const propName of propKeys) {
            const propDef = allVariantProperties[propName];
            if (propDef && propDef.type === 'VARIANT') {
              const currentValue = extractPropertyValue(instance.componentProperties[propName]);
              propertiesToSet[propName] = String(currentValue);
            }
          }

          propertiesToSet[realPropertyKey] = optionValue;

          instance.setProperties(propertiesToSet);

          if (successCount === 0) {
            matchedPropertyName = cleanPropertyName(realPropertyKey);
          }

          successCount++;
        } catch (error) {
          console.error(`Error setting variant property ${propertyName}:`, error);
          errorCount++;
        }
      }
    }

    const exposedCount = await applyToExposedInstances(instance, propertyName, 'VARIANT', async (exposedInstance, key) => {
      const exposedMainComponent = await getCachedMainComponent(exposedInstance);
      if (!exposedMainComponent) return;

      const exposedProperties = getComponentPropertyDefinitions(exposedMainComponent);
      const exposedPropertiesToSet: { [key: string]: string | boolean } = {};

      const exposedPropKeys = Object.keys(exposedProperties);
      for (const propName of exposedPropKeys) {
        const propDef = exposedProperties[propName];
        if (propDef && propDef.type === 'VARIANT') {
          const currentValue = extractPropertyValue(exposedInstance.componentProperties[propName]);
          exposedPropertiesToSet[propName] = String(currentValue);
        }
      }

      exposedPropertiesToSet[key] = optionValue;
      exposedInstance.setProperties(exposedPropertiesToSet);

      if (successCount === 0 && !matchedPropertyName) {
        matchedPropertyName = cleanPropertyName(key);
      }
    });

    successCount += exposedCount;
  }

  if (successCount > 0) {

    const wasPartialMatch = matchedPropertyName.toLowerCase() !== propertyName.toLowerCase();
    const message = wasPartialMatch
      ? `Matched "${matchedPropertyName}" -> set to "${optionValue}" on ${successCount} instance${successCount > 1 ? 's' : ''}`
      : `Set "${matchedPropertyName}" to "${optionValue}" on ${successCount} instance${successCount > 1 ? 's' : ''}`;

    figma.notify(message);
  }

  if (errorCount > 0) {
    figma.notify(`Failed to update ${errorCount} instance${errorCount > 1 ? 's' : ''}`, { error: true });
  }
}

async function setTextProperty(instances: InstanceNode[], propertyName: string, textValue: string): Promise<void> {
  let successCount = 0;
  let errorCount = 0;
  let matchedPropertyName = '';

  for (const instance of instances) {
    const mainComponent = await getCachedMainComponent(instance);
    if (mainComponent) {
      const allProperties = getComponentPropertyDefinitions(mainComponent);
      const { key: realPropertyKey, definition: propertyDef } = findPropertyKey(propertyName, allProperties);

      if (realPropertyKey && propertyDef && propertyDef.type === 'TEXT') {
        try {
          instance.setProperties({
            [realPropertyKey]: textValue
          });

          if (successCount === 0) {
            matchedPropertyName = cleanPropertyName(realPropertyKey);
          }

          successCount++;
        } catch (error) {
          console.error(`Error setting text property ${propertyName}:`, error);
          errorCount++;
        }
      }
    }

    const exposedCount = await applyToExposedInstances(instance, propertyName, 'TEXT', (exposedInstance, key) => {
      exposedInstance.setProperties({ [key]: textValue });

      if (successCount === 0 && !matchedPropertyName) {
        matchedPropertyName = cleanPropertyName(key);
      }
    });

    successCount += exposedCount;
  }

  if (successCount > 0) {

    const wasPartialMatch = matchedPropertyName.toLowerCase() !== propertyName.toLowerCase();
    const message = wasPartialMatch
      ? `Matched "${matchedPropertyName}" -> set to "${textValue}" on ${successCount} instance${successCount > 1 ? 's' : ''}`
      : `Set "${matchedPropertyName}" to "${textValue}" on ${successCount} instance${successCount > 1 ? 's' : ''}`;

    figma.notify(message);
  }

  if (errorCount > 0) {
    figma.notify(`Failed to update ${errorCount} instance${errorCount > 1 ? 's' : ''}`, { error: true });
  }
}

// Helper to resolve preferred values for INSTANCE_SWAP properties
async function resolvePreferredValues(
  preferredValues: InstanceSwapPreferredValue[] | undefined
): Promise<Array<{ name: string; key: string; library: string; isPreferred: true }>> {
  if (!preferredValues || preferredValues.length === 0) {
    return [];
  }

  const results: Array<{ name: string; key: string; library: string; isPreferred: true }> = [];
  const seenNames = new Set<string>(); // Deduplicate by name (avoid showing same ComponentSet multiple times)
  const [libraries, activeLibraries] = await Promise.all([
    getStoredLibraries(),
    getActiveLibraries()
  ]);

  for (const pref of preferredValues) {
    const componentKey = pref.key;

    // Try to find the component in stored libraries first
    let foundName: string | null = null;
    let foundLibrary: string | null = null;

    for (const libName of activeLibraries) {
      const items = libraries[libName];
      if (items) {
        const match = items.find(item => item[1] === componentKey && item[2] === 'COMPONENT');
        if (match) {
          foundName = match[0];
          foundLibrary = libName;
          break;
        }
      }
    }

    // If not found in libraries, try to import and get the name
    if (!foundName) {
      try {
        // Use appropriate import function based on preferred value type
        if (pref.type === 'COMPONENT_SET') {
          const componentSet = await figma.importComponentSetByKeyAsync(componentKey);
          if (componentSet) {
            // Use ComponentSet name, not variant name
            foundName = componentSet.name;
            foundLibrary = 'External';
          }
        } else {
          const component = await figma.importComponentByKeyAsync(componentKey);
          if (component) {
            // If this is a variant inside a ComponentSet, use the ComponentSet name
            if (component.parent?.type === 'COMPONENT_SET') {
              foundName = component.parent.name;
            } else {
              foundName = component.name;
            }
            foundLibrary = 'External';
          }
        }
      } catch {
        // Component might not be accessible, skip it
        continue;
      }
    }

    // Deduplicate by name (e.g., multiple variants from same ComponentSet)
    if (foundName && foundLibrary && !seenNames.has(foundName)) {
      seenNames.add(foundName);
      results.push({
        name: foundName,
        key: componentKey,
        library: foundLibrary,
        isPreferred: true
      });
    }
  }

  return results;
}

function matchesComponentSearchTerm(name: string, searchTerm: string): boolean {
  return searchTerm === '' || name.toLowerCase().includes(searchTerm.toLowerCase());
}

function normalizeComponentPathSegment(segment: string): string {
  return segment.trim().toLowerCase();
}

function getComponentFolderSegments(componentName: string): string[] {
  const segments = componentName
    .split('/')
    .map(segment => normalizeComponentPathSegment(segment))
    .filter(Boolean);

  if (segments.length < 2) {
    return [];
  }

  return segments.slice(0, -1);
}

function getComponentSwapSourceName(mainComponent: ComponentNode): string {
  return mainComponent.parent?.type === 'COMPONENT_SET'
    ? mainComponent.parent.name
    : mainComponent.name;
}

async function findContainingInstanceSwapProperty(
  instance: InstanceNode,
  propertyReference: string
): Promise<PropertyDefinition | null> {
  let current: BaseNode | null = instance.parent;

  while (current) {
    if (current.type === 'COMPONENT' || current.type === 'COMPONENT_SET') {
      const { definition } = findPropertyKey(propertyReference, current.componentPropertyDefinitions);
      if (definition) {
        return definition;
      }
    } else if (current.type === 'INSTANCE') {
      const mainComponent = await getCachedMainComponent(current);
      if (mainComponent) {
        const { definition } = findPropertyKey(propertyReference, getComponentPropertyDefinitions(mainComponent));
        if (definition) {
          return definition;
        }
      }
    }

    current = current.parent;
  }

  return null;
}

async function resolvePreferredSwapComponents(
  instances: InstanceNode[]
): Promise<Array<{ name: string; key: string; library: string; isPreferred: true }>> {
  const collectedPreferredValues: InstanceSwapPreferredValue[] = [];
  const seenKeys = new Set<string>();

  for (const instance of instances) {
    const propertyReference = instance.componentPropertyReferences?.mainComponent;
    if (!propertyReference) continue;

    const propertyDef = await findContainingInstanceSwapProperty(instance, propertyReference);
    if (!propertyDef || propertyDef.type !== 'INSTANCE_SWAP' || !propertyDef.preferredValues) {
      continue;
    }

    for (const preferredValue of propertyDef.preferredValues) {
      const dedupeKey = `${preferredValue.type}:${preferredValue.key}`;
      if (seenKeys.has(dedupeKey)) continue;

      seenKeys.add(dedupeKey);
      collectedPreferredValues.push(preferredValue);
    }
  }

  return resolvePreferredValues(collectedPreferredValues);
}

function getCommonPrefixLength(a: string[], b: string[]): number {
  const maxLength = Math.min(a.length, b.length);
  let index = 0;

  while (index < maxLength && a[index] === b[index]) {
    index++;
  }

  return index;
}

type ComponentFolderMatch = {
  commonPrefixLength: number;
  distance: number;
};

function compareComponentFolderMatches(a: ComponentFolderMatch, b: ComponentFolderMatch): number {
  if (a.commonPrefixLength !== b.commonPrefixLength) {
    return b.commonPrefixLength - a.commonPrefixLength;
  }

  if (a.distance !== b.distance) {
    return a.distance - b.distance;
  }

  return 0;
}

function getBestComponentFolderMatch(
  componentName: string,
  selectedFolderSegments: string[][]
): ComponentFolderMatch | null {
  const componentFolderSegments = getComponentFolderSegments(componentName);
  if (componentFolderSegments.length === 0) {
    return null;
  }

  let bestMatch: ComponentFolderMatch | null = null;

  for (const selectedFolder of selectedFolderSegments) {
    const commonPrefixLength = getCommonPrefixLength(componentFolderSegments, selectedFolder);
    if (commonPrefixLength === 0) {
      continue;
    }

    const distance =
      (componentFolderSegments.length - commonPrefixLength) +
      (selectedFolder.length - commonPrefixLength);
    const match = {
      commonPrefixLength,
      distance
    };

    if (
      !bestMatch ||
      match.commonPrefixLength > bestMatch.commonPrefixLength ||
      (match.commonPrefixLength === bestMatch.commonPrefixLength && match.distance < bestMatch.distance)
    ) {
      bestMatch = match;
    }
  }

  return bestMatch;
}

async function getSelectedComponentFolderSegments(instances: InstanceNode[]): Promise<string[][]> {
  const folderPaths: string[][] = [];
  const seenFolderPaths = new Set<string>();

  for (const instance of instances) {
    const mainComponent = await getCachedMainComponent(instance);
    if (!mainComponent) continue;

    const folderPath = getComponentFolderSegments(getComponentSwapSourceName(mainComponent));
    if (folderPath.length > 0) {
      const dedupeKey = folderPath.join('/');
      if (!seenFolderPaths.has(dedupeKey)) {
        seenFolderPaths.add(dedupeKey);
        folderPaths.push(folderPath);
      }
    }
  }

  return folderPaths;
}

// Helper to get components from the same frame as the instance's main component
async function getSameFrameComponents(
  instances: InstanceNode[]
): Promise<Array<{ name: string; library: string }>> {
  const sameFrameComponents: Array<{ name: string; library: string }> = [];
  const seenComponentIds = new Set<string>();

  for (const instance of instances) {
    const mainComponent = await getCachedMainComponent(instance);
    if (!mainComponent) continue;

    // If main component is inside a ComponentSet, get the ComponentSet's parent frame
    let parentFrame = mainComponent.parent;
    if (parentFrame && parentFrame.type === 'COMPONENT_SET') {
      parentFrame = parentFrame.parent;
    }

    // Also get the ComponentSet ID if main component is a variant
    const mainComponentSetId = mainComponent.parent?.type === 'COMPONENT_SET' ? mainComponent.parent.id : null;

    if (parentFrame && 'children' in parentFrame) {
      for (const sibling of parentFrame.children) {
        // Show standalone Component nodes
        if (sibling.type === 'COMPONENT' && sibling.id !== mainComponent.id && !seenComponentIds.has(sibling.id)) {
          seenComponentIds.add(sibling.id);
          sameFrameComponents.push({
            name: sibling.name,
            library: figma.root.name
          });
        }
        // Show ComponentSets (using ComponentSet name), excluding the current one
        else if (sibling.type === 'COMPONENT_SET' && sibling.id !== mainComponentSetId && !seenComponentIds.has(sibling.id)) {
          seenComponentIds.add(sibling.id);
          sameFrameComponents.push({
            name: sibling.name,
            library: figma.root.name
          });
        }
      }
    }
    // Only process first instance to avoid duplicates
    break;
  }

  return sameFrameComponents;
}

async function buildSwapComponentResults(
  instances: InstanceNode[],
  searchTerm: string
): Promise<Array<{ name: string; library: string }>> {
  const [preferredComponents, sameFrameComponents, selectedFolderSegments, libraryComponents] = await Promise.all([
    resolvePreferredSwapComponents(instances),
    instances.length > 0 ? getSameFrameComponents(instances) : Promise.resolve([]),
    getSelectedComponentFolderSegments(instances),
    searchLibraryComponents(searchTerm, 100)
  ]);

  const preferredResults = preferredComponents
    .filter(component => matchesComponentSearchTerm(component.name, searchTerm))
    .map(({ name, library }) => ({ name, library }));
  const usedNames = new Set(preferredResults.map(component => component.name));

  const folderMatchedResults = [
    ...sameFrameComponents.map(component => ({
      ...component,
      isSameFrame: true,
      match: getBestComponentFolderMatch(component.name, selectedFolderSegments)
    })),
    ...libraryComponents.map(component => ({
      name: component.name,
      library: component.library,
      isSameFrame: false,
      match: getBestComponentFolderMatch(component.name, selectedFolderSegments)
    }))
  ]
    .filter(component => (
      !usedNames.has(component.name) &&
      component.match !== null &&
      matchesComponentSearchTerm(component.name, searchTerm)
    ))
    .sort((a, b) => {
      const matchComparison = compareComponentFolderMatches(
        a.match as ComponentFolderMatch,
        b.match as ComponentFolderMatch
      );
      if (matchComparison !== 0) {
        return matchComparison;
      }

      if (a.isSameFrame !== b.isSameFrame) {
        return a.isSameFrame ? -1 : 1;
      }

      return a.name.localeCompare(b.name);
    })
    .map(({ name, library }) => ({ name, library }));

  folderMatchedResults.forEach(component => usedNames.add(component.name));

  const sameFrameResults = sameFrameComponents.filter(component => (
    matchesComponentSearchTerm(component.name, searchTerm) &&
    !usedNames.has(component.name)
  ));

  sameFrameResults.forEach(component => usedNames.add(component.name));

  const otherResults = libraryComponents
    .filter(component => !usedNames.has(component.name))
    .map(({ name, library }) => ({ name, library }));

  return [...preferredResults, ...folderMatchedResults, ...sameFrameResults, ...otherResults];
}

async function searchLibraryComponents(searchTerm: string, limit: number = 100, libraryFilter?: string): Promise<Array<{ name: string; key: string; library: string }>> {
  const [libraries, activeLibraries] = await Promise.all([
    getStoredLibraries(),
    getActiveLibraries()
  ]);
  const results: Array<{ name: string; key: string; library: string }> = [];
  const searchLower = searchTerm.toLowerCase();

  // If a filter is provided, only search that library (if it's active)
  const librariesToSearch = libraryFilter
    ? (activeLibraries.indexOf(libraryFilter) !== -1 ? [libraryFilter] : [])
    : activeLibraries;

  for (const libName of librariesToSearch) {
    const items = libraries[libName];
    if (!items) continue;

    for (const item of items) {
      // Item format: [Name, Key, Type]
      if (item[2] === 'COMPONENT') {
        if (searchLower === '' || item[0].toLowerCase().includes(searchLower)) {
          results.push({
            name: item[0],
            key: item[1],
            library: libName
          });
        }
      }
    }
  }

  return results.slice(0, limit);
}

export async function searchInstanceProperties(searchTerm: string): Promise<Array<string | { name: string; data: unknown }>> {
  const selection = figma.currentPage.selection;
  const instances = selection.filter(node => node.type === 'INSTANCE') as InstanceNode[];

  if (instances.length === 0) {
    return ['No instances selected'];
  }

  const propertyWithValueMatch = searchTerm.match(/^(.+):(.*)$/);
  if (propertyWithValueMatch) {
    const propertyName = propertyWithValueMatch[1].trim();
    const value = propertyWithValueMatch[2].trim();

    for (const instance of instances) {
      const mainComponent = await getCachedMainComponent(instance);
      if (!mainComponent) continue;

      const allProperties = getComponentPropertyDefinitions(mainComponent);
      const { key: realPropertyKey, definition: propertyDef } = findPropertyKey(propertyName, allProperties);

      if (propertyDef) {
        if (propertyDef.type === 'VARIANT') {
          return await searchVariantOptions(instances, propertyName, value);
        } else if (propertyDef.type === 'TEXT') {
          const cleanName = realPropertyKey ? cleanPropertyName(realPropertyKey) : propertyName;
          if (value) {
            return [`${cleanName}: ${value}`];
          } else {
            // Get current value to show in suggestion
            let currentValue = 'current value';
            if (realPropertyKey && instance.componentProperties[realPropertyKey]) {
              const currentProp = extractPropertyValue(instance.componentProperties[realPropertyKey]);
              if (currentProp && typeof currentProp === 'string') {
                currentValue = currentProp;
              }
            }
            return [`${cleanName}: Type what you want to replace '${currentValue}' with`];
          }
        } else if (propertyDef.type === 'INSTANCE_SWAP') {
          // For initial display (empty value), show preferred values and same-frame components first
          if (value === '') {
            // Get preferred values
            const preferredComponents = await resolvePreferredValues(propertyDef.preferredValues);
            const preferredResults = preferredComponents.map(c => ({
              name: `${c.name} (${c.library})`,
              data: `${propertyName}:${c.name} (${c.library})`
            }));

            // Get same-frame components
            const sameFrameComponents = await getSameFrameComponents(instances);
            const preferredNames = new Set(preferredComponents.map(p => p.name));
            const sameFrameResults = sameFrameComponents
              .filter(c => !preferredNames.has(c.name))
              .map(c => ({
                name: `${c.name} (${c.library})`,
                data: `${propertyName}:${c.name} (${c.library})`
              }));

            // Then get library components
            const usedNames = new Set([...preferredNames, ...sameFrameComponents.map(c => c.name)]);
            const components = await searchLibraryComponents('', 100);
            const otherComponents = components
              .filter(c => !usedNames.has(c.name))
              .map(c => ({
                name: `${c.name} (${c.library})`,
                data: `${propertyName}:${c.name} (${c.library})`
              }));

            const allResults = [...preferredResults, ...sameFrameResults, ...otherComponents];
            if (allResults.length === 0) {
              return ['No components found'];
            }
            return allResults;
          }

          // When searching, search all components
          const components = await searchLibraryComponents(value, 100);

          if (components.length === 0) {
            return [`No components found matching "${value}"`];
          }
          return components.map(c => ({
            name: `${c.name} (${c.library})`,
            data: `${propertyName}:${c.name} (${c.library})`
          }));
        }
      }

      if (propertyDef) break;

      // If not found in main component, check exposed instances
      if (instance.exposedInstances && instance.exposedInstances.length > 0) {
        for (const exposedInstance of instance.exposedInstances) {
          const exposedMainComponent = await getCachedMainComponent(exposedInstance);
          if (!exposedMainComponent) continue;

          const exposedProperties = getComponentPropertyDefinitions(exposedMainComponent);
          const { key: exposedRealKey, definition: exposedPropDef } = findPropertyKey(propertyName, exposedProperties);

          if (exposedPropDef) {
            if (exposedPropDef.type === 'VARIANT') {
              return await searchVariantOptions(instances, propertyName, value);
            } else if (exposedPropDef.type === 'TEXT') {
              const cleanName = exposedRealKey ? cleanPropertyName(exposedRealKey) : propertyName;
              if (value) {
                return [`${cleanName}: ${value}`];
              } else {
                // Get current value to show in suggestion
                let currentValue = 'current value';
                if (exposedRealKey && exposedInstance.componentProperties[exposedRealKey]) {
                  const currentProp = extractPropertyValue(exposedInstance.componentProperties[exposedRealKey]);
                  if (currentProp && typeof currentProp === 'string') {
                    currentValue = currentProp;
                  }
                }
                return [`${cleanName}: Type what you want to replace '${currentValue}' with`];
              }
            } else if (exposedPropDef.type === 'INSTANCE_SWAP') {
              // For initial display (empty value), show preferred values and same-frame components first
              if (value === '') {
                // Get preferred values
                const preferredComponents = await resolvePreferredValues(exposedPropDef.preferredValues);
                const preferredResults = preferredComponents.map(c => ({
                  name: `${c.name} (${c.library})`,
                  data: `${propertyName}:${c.name} (${c.library})`
                }));

                // Get same-frame components
                const sameFrameComponents = await getSameFrameComponents(instances);
                const preferredNames = new Set(preferredComponents.map(p => p.name));
                const sameFrameResults = sameFrameComponents
                  .filter(c => !preferredNames.has(c.name))
                  .map(c => ({
                    name: `${c.name} (${c.library})`,
                    data: `${propertyName}:${c.name} (${c.library})`
                  }));

                // Then get library components
                const usedNames = new Set([...preferredNames, ...sameFrameComponents.map(c => c.name)]);
                const components = await searchLibraryComponents('', 100);
                const otherComponents = components
                  .filter(c => !usedNames.has(c.name))
                  .map(c => ({
                    name: `${c.name} (${c.library})`,
                    data: `${propertyName}:${c.name} (${c.library})`
                  }));

                const allResults = [...preferredResults, ...sameFrameResults, ...otherComponents];
                if (allResults.length === 0) {
                  return ['No components found'];
                }
                return allResults;
              }

              const components = await searchLibraryComponents(value, 100);
              if (components.length === 0) {
                return [`No components found matching "${value}"`];
              }
              return components.map(c => ({
                name: `${c.name} (${c.library})`,
                data: `${propertyName}:${c.name} (${c.library})`
              }));
            }

            // Found the property in exposed instance, stop searching
            break;
          }
        }
      }
    }

    return await searchVariantOptions(instances, propertyName, value);
  }

  const propertiesMap = new Map<string, PropertyData>();
  const seenCleanedNames = new Set<string>();

  for (const instance of instances) {
    const mainComponent = await getCachedMainComponent(instance);
    if (!mainComponent) continue;

    const allProperties = getComponentPropertyDefinitions(mainComponent);

    const propKeys = Object.keys(allProperties);
    for (const propName of propKeys) {
      const propDef = allProperties[propName];
      if (!propDef) continue;

      const cleanedName = cleanPropertyName(propName);

      if (!seenCleanedNames.has(cleanedName)) {
        seenCleanedNames.add(cleanedName);

        if (!propertiesMap.has(propName)) {
          propertiesMap.set(propName, {
            type: propDef.type,
            values: new Set(),
            propertyDef: propDef
          });
        }

        const currentProp = instance.componentProperties[propName];
        if (currentProp !== undefined) {
          const actualValue = extractPropertyValue(currentProp);
          propertiesMap.get(propName)!.values.add(String(actualValue));
        }
      }
    }

    // Add exposed properties from nested instances
    if (instance.exposedInstances && instance.exposedInstances.length > 0) {
      for (const exposedInstance of instance.exposedInstances) {
        const exposedMainComponent = await getCachedMainComponent(exposedInstance);
        if (!exposedMainComponent) continue;

        const exposedProperties = getComponentPropertyDefinitions(exposedMainComponent);
        const exposedPropKeys = Object.keys(exposedProperties);

        for (const exposedPropName of exposedPropKeys) {
          const exposedPropDef = exposedProperties[exposedPropName];
          if (!exposedPropDef) continue;

          const cleanedExposedName = cleanPropertyName(exposedPropName);

          // Only add if we haven't seen this property name yet (deduplication)
          if (!seenCleanedNames.has(cleanedExposedName)) {
            seenCleanedNames.add(cleanedExposedName);

            if (!propertiesMap.has(exposedPropName)) {
              propertiesMap.set(exposedPropName, {
                type: exposedPropDef.type,
                values: new Set(),
                propertyDef: exposedPropDef
              });
            }

            // Get current value from the exposed instance's component properties
            const exposedCurrentProp = exposedInstance.componentProperties[exposedPropName];
            if (exposedCurrentProp !== undefined) {
              const actualValue = extractPropertyValue(exposedCurrentProp);
              propertiesMap.get(exposedPropName)!.values.add(String(actualValue));
            }
          }
        }
      }
    }
  }

  const searchLower = searchTerm.toLowerCase();
  const matchingProperties: Array<{ name: string; data: PropertyData }> = [];

  for (const [propName, data] of propertiesMap.entries()) {
    if (propName.toLowerCase().includes(searchLower)) {
      matchingProperties.push({ name: propName, data });
    }
  }

  if (matchingProperties.length === 0) {
    return ['No matching properties found'];
  }

  return await Promise.all(matchingProperties.map(async ({ name, data }) => {
    return await formatPropertySuggestion(name, data);
  }));
}

async function formatPropertySuggestion(propertyName: string, data: PropertyData): Promise<string> {
  const cleanName = cleanPropertyName(propertyName);
  const typeDisplay = data.type.charAt(0) + data.type.slice(1).toLowerCase();

  let optionsDisplay = '';

  switch (data.type) {
    case 'BOOLEAN': {
      const currentValues = Array.from(data.values);
      if (currentValues.length === 1) {
        // Capitalize the boolean value for display
        const currentValue = currentValues[0] === 'true' ? 'True' : 'False';
        optionsDisplay = `${currentValue} -> Toggle`;
      } else if (currentValues.length > 1) {
        optionsDisplay = 'Mixed -> Toggle';
      } else {
        optionsDisplay = 'true, false';
      }
      break;
    }
    case 'VARIANT': {
      const currentValues = Array.from(data.values);
      if (currentValues.length === 1) {
        optionsDisplay = `${currentValues[0]} -> type: to change`;
      } else if (currentValues.length > 1) {
        optionsDisplay = 'Mixed -> type: to change';
      } else if (data.propertyDef.variantOptions) {
        // Fallback: show options if no current value
        const options = data.propertyDef.variantOptions;
        const maxDisplay = 3;
        if (options.length <= maxDisplay) {
          optionsDisplay = `${options.join(', ')} -> type: to change`;
        } else {
          const displayedOptions = options.slice(0, maxDisplay).join(', ');
          const remaining = options.length - maxDisplay;
          optionsDisplay = `${displayedOptions}, +${remaining} -> type: to change`;
        }
      }
      break;
    }
    case 'TEXT': {
      const currentValues = Array.from(data.values);
      if (currentValues.length === 1) {
        optionsDisplay = `${currentValues[0]} -> type :text to change`;
      } else if (currentValues.length > 1) {
        optionsDisplay = 'Mixed -> type :text to change';
      } else {
        optionsDisplay = 'Text input -> type :text to set';
      }
      break;
    }
    case 'INSTANCE_SWAP': {
      const currentValues = Array.from(data.values);

      // Resolve current component name from ID
      let currentName = 'None';
      if (currentValues.length === 1) {
        try {
          const node = await figma.getNodeByIdAsync(currentValues[0]);
          if (node && 'name' in node) {
            currentName = node.name;
          }
        } catch {
          // Ignore resolution errors
        }
      } else if (currentValues.length > 1) {
        currentName = 'Mixed';
      }

      optionsDisplay = `${currentName} -> type: to change`;
      break;
    }
    default:
      optionsDisplay = 'Value';
  }

  const displayName = (data.type === 'VARIANT' || data.type === 'TEXT' || data.type === 'INSTANCE_SWAP') ? `${cleanName}:` : cleanName;

  return `${displayName} (${typeDisplay} - ${optionsDisplay})`;
}

export async function setInstanceProperty(propertyReference: string) {
  const selection = figma.currentPage.selection;
  const instances = selection.filter(node => node.type === 'INSTANCE') as InstanceNode[];

  if (instances.length === 0) {
    throw new Error('No instances selected');
  }

  const variantWithDescMatch = propertyReference.match(/^([^:]+):\s*\(Variant\s*-/);
  if (variantWithDescMatch) {
    const propertyName = variantWithDescMatch[1].trim();
    figma.notify(`💡 Type "ip?${propertyName}:" in the command bar to see all available options for this variant`);
    return;
  }

  const textWithDescMatch = propertyReference.match(/^([^:]+):\s*\(Text\s*-/);
  if (textWithDescMatch) {
    const propertyName = textWithDescMatch[1].trim();
    figma.notify(`💡 Type "ip?${propertyName}:Your text here" to set the text value`);
    return;
  }

  const instanceSwapWithDescMatch = propertyReference.match(/^([^:]+):\s*\(Instance_swap\s*-/);
  if (instanceSwapWithDescMatch) {
    const propertyName = instanceSwapWithDescMatch[1].trim();
    figma.notify(`💡 Type "ip?${propertyName}:" to search for components to swap`);
    return;
  }

  const propertyWithValueMatch = propertyReference.match(/^([^:]+):(.+)$/);
  if (propertyWithValueMatch) {
    const propertyName = propertyWithValueMatch[1].trim();
    const value = propertyWithValueMatch[2].trim();

    const firstInstance = instances[0];
    const { definition: propertyDef } = await findPropertyInInstanceOrExposed(firstInstance, propertyName);

    if (propertyDef) {
      if (propertyDef.type === 'VARIANT') {
        return await setVariantProperty(instances, propertyName, value);
      } else if (propertyDef.type === 'TEXT') {
        return await setTextProperty(instances, propertyName, value);
      } else if (propertyDef.type === 'INSTANCE_SWAP') {
        const { component } = await findAndImportComponent(value);

        if (component) {
          let successCount = 0;
          for (const inst of instances) {
            const main = await getCachedMainComponent(inst);
            if (main) {
              const props = getComponentPropertyDefinitions(main);
              const { key: realKey } = findPropertyKey(propertyName, props);

              if (realKey) {
                inst.setProperties({ [realKey]: component.id });
                successCount++;
              }
            }

            const exposedCount = await applyToExposedInstances(inst, propertyName, 'INSTANCE_SWAP', (exposedInstance, key) => {
              exposedInstance.setProperties({ [key]: component.id });
            });

            successCount += exposedCount;
          }
          if (successCount > 0) {
            figma.notify(`Swapped "${propertyName}" to "${component.name}" on ${successCount} instance${successCount > 1 ? 's' : ''}`);
          } else {
            figma.notify(`Failed to set property on selected instances`, { error: true });
          }
        }
        return;
      }
    }

    return await setVariantProperty(instances, propertyName, value);
  }

  const match = propertyReference.match(/^([^(]+?)(?:\s*\([^)]+\))?$/);
  if (!match) {
    throw new Error('Invalid property reference format');
  }

  const propertyName = match[1].trim();

  let successCount = 0;
  let errorCount = 0;

  for (const instance of instances) {
    const { definition: propertyDef, keyInMain: realPropertyKey } = await findPropertyInInstanceOrExposed(instance, propertyName);

    if (!propertyDef) {
      errorCount++;
      continue;
    }

    try {

      switch (propertyDef.type) {
        case 'BOOLEAN': {
          if (realPropertyKey) {
            const currentValue = extractPropertyValue(instance.componentProperties[realPropertyKey]) as boolean;
            instance.setProperties({
              [realPropertyKey]: !currentValue
            });
            successCount++;
          }
          break;
        }
        case 'TEXT': {
          figma.notify('💡 Type ":" after the property name to set text (e.g., ip?Label:New text)');
          return;
        }
        case 'VARIANT': {
          figma.notify('💡 Type ":" after the variant name to see all available options (e.g., ip?Type:)');
          return;
        }
        case 'INSTANCE_SWAP': {
          figma.notify('💡 Type ":" after the property name to search for components (e.g., ip?Icon:Search)');
          return;
        }
        default:
          errorCount++;
          continue;
      }
    } catch (error) {
      console.error(`Error setting property ${propertyName}:`, error);
      errorCount++;
    }

    if (propertyDef.type === 'BOOLEAN') {
      const exposedCount = await applyToExposedInstances(instance, propertyName, 'BOOLEAN', (exposedInstance, key) => {
        const currentValue = extractPropertyValue(exposedInstance.componentProperties[key]) as boolean;
        exposedInstance.setProperties({
          [key]: !currentValue
        });
      });

      successCount += exposedCount;
    }
  }

  if (successCount > 0) {
    figma.notify(`Updated "${propertyName}" on ${successCount} instance${successCount > 1 ? 's' : ''}`);
  }

  if (errorCount > 0) {
    figma.notify(`Failed to update ${errorCount} instance${errorCount > 1 ? 's' : ''}`, { error: true });
  }
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
// Helper to find and import a component based on name/library string
async function findLocalComponentByName(componentName: string): Promise<ComponentNode | ComponentSetNode | null> {
  await figma.loadAllPagesAsync();
  // eslint-disable-next-line @figma/figma-plugins/dynamic-page-find-method-advice
  const found = figma.root.findOne(node =>
    (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') &&
    node.name === componentName
  );

  return found && (found.type === 'COMPONENT' || found.type === 'COMPONENT_SET')
    ? found
    : null;
}

async function findAndImportComponent(value: string): Promise<{ component: ComponentNode | null, name: string }> {
  const [libraries, activeLibraries] = await Promise.all([
    getStoredLibraries(),
    getActiveLibraries()
  ]);

  let componentName = value;
  let targetLibrary: string | null = null;

  // Robust parsing: Check if the value ends with " (LibraryName)" for any active library
  const sortedLibraries = [...activeLibraries].sort((a, b) => b.length - a.length);

  for (const libName of sortedLibraries) {
    const suffix = ` (${libName})`;
    if (value.endsWith(suffix)) {
      targetLibrary = libName;
      componentName = value.substring(0, value.length - suffix.length).trim();
      break;
    }
  }

  // Fallback parsing
  if (!targetLibrary) {
    const lastParenIndex = value.lastIndexOf(' (');
    if (lastParenIndex > 0 && value.endsWith(')')) {
      componentName = value.substring(0, lastParenIndex).trim();
    }
  }

  const shouldSearchLocal = !targetLibrary || targetLibrary === figma.root.name;
  if (shouldSearchLocal) {
    const localNode = await findLocalComponentByName(componentName);
    if (localNode) {
      return {
        component: localNode.type === 'COMPONENT_SET' ? localNode.defaultVariant : localNode,
        name: componentName
      };
    }
  }

  let componentKey: string | null = null;

  // 1. Try exact match in target library
  if (targetLibrary && libraries[targetLibrary]) {
    const items = libraries[targetLibrary];
    const match = items.find(item => item[0] === componentName && item[2] === 'COMPONENT');
    if (match) {
      componentKey = match[1];
    }
  }

  // 2. Fallback: Search in all active libraries
  if (!componentKey) {
    for (const libName of activeLibraries) {
      const items = libraries[libName];
      if (items) {
        const match = items.find(item => item[0] === componentName && item[2] === 'COMPONENT');
        if (match) {
          componentKey = match[1];
          break;
        }
      }
    }
  }

  // Partial match
  if (!componentKey) {
    const components = await searchLibraryComponents(componentName, 1);
    if (components.length > 0) {
      componentKey = components[0].key;
      figma.notify(`Found "${components[0].name}" in "${components[0].library}"`);
    }
  }

  if (componentKey) {
    try {
      // Check if the component is in the current file (Local Library)
      // We need to know which library this key came from.
      // We can infer it from targetLibrary or by finding which library in activeLibraries has this key.

      let sourceLibrary = targetLibrary;
      if (!sourceLibrary) {
        // Find which library has this key
        for (const libName of activeLibraries) {
          const items = libraries[libName];
          if (items && items.find(item => item[1] === componentKey)) {
            sourceLibrary = libName;
            break;
          }
        }
      }

      const isLocal = sourceLibrary === figma.root.name;
      let node: ComponentNode | ComponentSetNode | null = null;

      if (isLocal) {
        // Search locally by key
        await figma.loadAllPagesAsync();
        // eslint-disable-next-line @figma/figma-plugins/dynamic-page-find-method-advice
        const found = figma.root.findOne(n => (n.type === 'COMPONENT' || n.type === 'COMPONENT_SET') && n.key === componentKey);
        if (found && (found.type === 'COMPONENT' || found.type === 'COMPONENT_SET')) {
          node = found;
        }
      } else {
        node = await figma.importComponentByKeyAsync(componentKey);
      }

      if (node) {
        let componentToUse: ComponentNode | null = null;

        if (node.type === 'COMPONENT_SET') {
          componentToUse = node.defaultVariant;
        } else if (node.type === 'COMPONENT') {
          componentToUse = node;
        }

        if (componentToUse) {
          return { component: componentToUse, name: componentName };
        } else {
          console.warn(`[FindComponent] Could not determine component to use from node type: ${node.type}`);
        }
      }
    } catch (e) {
      console.error('[FindComponent] Error importing component:', e);
      figma.notify(`Failed to import component "${componentName}"`, { error: true });
    }
  } else {
    console.warn(`[FindComponent] Component "${componentName}" not found`);
    figma.notify(`Component "${componentName}" not found in active libraries`, { error: true });
  }

  return { component: null, name: componentName };
}

export async function searchComponentsForSwap(searchTerm: string): Promise<string[]> {
  const selection = figma.currentPage.selection;
  const instances = selection.filter(node => node.type === 'INSTANCE') as InstanceNode[];

  const components = await buildSwapComponentResults(instances, searchTerm);

  if (components.length === 0) {
    return [searchTerm === '' ? 'No components found' : `No components found matching "${searchTerm}"`];
  }

  return components.map(c => `${c.name} (${c.library})`);
}

export async function swapInstance(value: string) {
  const selection = figma.currentPage.selection;
  const instances = selection.filter(node => node.type === 'INSTANCE') as InstanceNode[];

  if (instances.length === 0) {
    throw new Error('No instances selected');
  }

  const { component, name } = await findAndImportComponent(value);

  if (component) {
    let successCount = 0;
    let propertiesPreservedCount = 0;

    for (const inst of instances) {
      try {
        // Capture current VARIANT properties before swap (cleaned name -> value)
        const oldProperties = new Map<string, string | boolean>();
        const oldMainComponent = await getCachedMainComponent(inst);

        if (oldMainComponent) {
          const oldPropDefs = getComponentPropertyDefinitions(oldMainComponent);
          for (const [propKey, propValue] of Object.entries(inst.componentProperties)) {
            const propDef = oldPropDefs[propKey];
            // Only preserve VARIANT properties
            if (propDef && propDef.type === 'VARIANT') {
              const cleanedName = cleanPropertyName(propKey);
              oldProperties.set(cleanedName.toLowerCase(), propValue.value);
            }
          }
        }

        // Perform the swap
        inst.swapComponent(component);
        successCount++;

        // After swap, get the new main component and its property definitions
        const newMainComponent = await inst.getMainComponentAsync();
        if (!newMainComponent) continue;

        const newPropDefs = getComponentPropertyDefinitions(newMainComponent);

        // Build properties to set: start with ALL current variant values, then override with old matching values
        const propertiesToSet: Record<string, string | boolean> = {};
        let hasChanges = false;

        // First, collect all current variant property values
        for (const [propKey, propDef] of Object.entries(newPropDefs)) {
          if (propDef.type === 'VARIANT') {
            const currentValue = inst.componentProperties[propKey];
            if (currentValue) {
              propertiesToSet[propKey] = String(extractPropertyValue(currentValue));
            }
          }
        }

        // Then, override with old values where they match and are valid
        for (const [propKey, propDef] of Object.entries(newPropDefs)) {
          if (propDef.type === 'VARIANT') {
            const cleanedName = cleanPropertyName(propKey).toLowerCase();
            const oldValue = oldProperties.get(cleanedName);

            // Check if old value exists and is valid for the new property
            if (oldValue !== undefined && propDef.variantOptions) {
              const valueStr = String(oldValue);
              if (propDef.variantOptions.includes(valueStr)) {
                // Only count as preserved if the value is different from current
                if (propertiesToSet[propKey] !== valueStr) {
                  propertiesToSet[propKey] = valueStr;
                  propertiesPreservedCount++;
                  hasChanges = true;
                }
              }
            }
          }
        }

        // Apply preserved properties (only if we have changes)
        if (hasChanges && Object.keys(propertiesToSet).length > 0) {
          inst.setProperties(propertiesToSet);
        }
      } catch (e) {
        console.error(`[SwapInstance] Error swapping instance "${inst.name}":`, e);
      }
    }
    if (successCount > 0) {
      const propsMsg = propertiesPreservedCount > 0 ? ` (${propertiesPreservedCount} ${pluralize(propertiesPreservedCount, 'property', 'properties')} preserved)` : '';
      figma.notify(`Swapped ${successCount} instance${successCount > 1 ? 's' : ''} to "${component.name}"${propsMsg}`);
    } else {
      figma.notify(`Failed to swap instances to "${name}"`, { error: true });
    }
  }
}

// Constants for grouped fields
const RADIUS_FIELDS = ['cornerRadius', 'topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius'];
const STROKE_FIELDS = [
  'strokes', 'strokeWeight', 'strokeAlign', 'strokeCap', 'strokeJoin',
  'dashPattern', 'strokeMiterLimit', 'strokeStyleId',
  'strokeTopWeight', 'strokeBottomWeight', 'strokeLeftWeight', 'strokeRightWeight',
  'stokeTopWeight' // Handle Figma API typo
];

const FIELD_MAPPING: Record<string, string> = {
  'strokestyleid': 'strokeStyleId', 'strokeweight': 'strokeWeight',
  'strokes': 'strokes', 'fills': 'fills', 'fillstyleid': 'fillStyleId',
  'componentproperties': 'componentProperties', 'effects': 'effects',
  'effectstyleid': 'effectStyleId', 'characters': 'characters',
  'textstyleid': 'textStyleId', 'cornerradius': 'cornerRadius',
  'stroke': 'stroke'
};

interface ComponentPropertyValueEntry {
  key: string;
  name: string;
  value: string | boolean | undefined;
}

interface ParsedOverrideReference {
  nodeId: string | null;
  field: string | null;
  nodeName: string | null;
  componentPropertyKey: string | null;
  componentPropertyName: string | null;
}

interface OverrideSearchContext {
  selectedInstance: InstanceNode;
  ownerInstance: InstanceNode;
}

interface OverrideSuggestionPayload {
  nodeId: string | null;
  field: string;
  nodeName: string;
  componentPropertyKey?: string | null;
  componentPropertyName?: string | null;
}

interface OverrideSuggestionEntry {
  baseName: string;
  payload: OverrideSuggestionPayload;
  selectedInstanceIds: Set<string>;
}

function isNodeInSubtree(node: BaseNode | null, subtreeRoot: SceneNode): boolean {
  let current: BaseNode | null = node;

  while (current) {
    if (current.id === subtreeRoot.id) return true;
    current = 'parent' in current ? current.parent : null;
  }

  return false;
}

function getOverrideSearchContexts(instances: InstanceNode[]): OverrideSearchContext[] {
  const contexts: OverrideSearchContext[] = [];
  const seen = new Set<string>();

  for (const selectedInstance of instances) {
    let current: BaseNode | null = selectedInstance;

    while (current) {
      if (current.type === 'INSTANCE') {
        const key = `${selectedInstance.id}:${current.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          contexts.push({
            selectedInstance,
            ownerInstance: current
          });
        }
      }

      current = 'parent' in current ? current.parent : null;
    }
  }

  return contexts;
}

function matchesInstanceByName(instance: InstanceNode, nodeName: string | null): boolean {
  return !nodeName || instance.name === nodeName;
}

function getNearestParentInstance(instance: InstanceNode): InstanceNode | null {
  let current: BaseNode | null = instance.parent;

  while (current) {
    if (current.type === 'INSTANCE') {
      return current;
    }

    current = 'parent' in current ? current.parent : null;
  }

  return null;
}

async function getDirectComponentPropertySourceNode(instance: InstanceNode): Promise<BaseNode | null> {
  const parentInstance = getNearestParentInstance(instance);

  if (parentInstance) {
    const parentDefinedSource = await findSourceNode(parentInstance, instance);
    if (parentDefinedSource) {
      return parentDefinedSource;
    }
  }

  return findSourceNode(instance, instance);
}

function addOverrideSuggestion(
  suggestions: Map<string, OverrideSuggestionEntry>,
  mergeKey: string,
  baseName: string,
  payload: OverrideSuggestionPayload,
  selectedInstanceId: string
) {
  const existing = suggestions.get(mergeKey);

  if (existing) {
    existing.selectedInstanceIds.add(selectedInstanceId);
    if (!existing.payload.nodeId && payload.nodeId) {
      existing.payload.nodeId = payload.nodeId;
    }
    return;
  }

  suggestions.set(mergeKey, {
    baseName,
    payload: { ...payload },
    selectedInstanceIds: new Set([selectedInstanceId])
  });
}

function buildOverrideSuggestionsList(
  suggestions: Map<string, OverrideSuggestionEntry>
): Array<{ name: string; data: string }> {
  return Array.from(suggestions.values()).map(entry => {
    const count = entry.selectedInstanceIds.size;
    const payload = count > 1
      ? { ...entry.payload, nodeId: null }
      : entry.payload;

    return {
      name: count > 1 ? `${entry.baseName} · ${count} selected` : entry.baseName,
      data: JSON.stringify(payload)
    };
  });
}

function formatFieldLabel(field: string): string {
  if (field === 'cornerRadius') return 'Corner Radius';
  if (field === 'stroke') return 'Stroke';

  return field
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getComponentPropertyValueMap(node: BaseNode): Map<string, ComponentPropertyValueEntry> {
  const properties = new Map<string, ComponentPropertyValueEntry>();

  if (node.type === 'INSTANCE') {
    for (const [key, property] of Object.entries(node.componentProperties)) {
      const name = cleanPropertyName(key);
      properties.set(name.toLowerCase(), {
        key,
        name,
        value: extractPropertyValue(property)
      });
    }
  } else if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
    const definitions = node.type === 'COMPONENT'
      ? getComponentPropertyDefinitions(node)
      : node.componentPropertyDefinitions;

    for (const [key, definition] of Object.entries(definitions)) {
      const name = cleanPropertyName(key);
      properties.set(name.toLowerCase(), {
        key,
        name,
        value: definition.defaultValue
      });
    }
  }

  return properties;
}

function getOverriddenComponentProperties(
  node: SceneNode,
  sourceNode: BaseNode | null
): ComponentPropertyValueEntry[] {
  if (node.type !== 'INSTANCE' || !sourceNode) return [];

  const currentProperties = getComponentPropertyValueMap(node);
  const sourceProperties = getComponentPropertyValueMap(sourceNode);
  const overrides: ComponentPropertyValueEntry[] = [];

  for (const [lookupKey, currentEntry] of currentProperties.entries()) {
    const sourceEntry = sourceProperties.get(lookupKey);
    if (!sourceEntry || sourceEntry.value === undefined) continue;

    if (!isEqual(sourceEntry.value, currentEntry.value)) {
      overrides.push(currentEntry);
    }
  }

  return overrides;
}

function resolveComponentPropertyResetTarget(
  node: SceneNode,
  sourceNode: BaseNode,
  componentPropertyKey: string | null,
  componentPropertyName: string | null
): { key: string; value: string | boolean } | null {
  if (node.type !== 'INSTANCE') {
    return null;
  }

  const currentProperties = getComponentPropertyValueMap(node);
  const sourceProperties = getComponentPropertyValueMap(sourceNode);
  const lookupKeys = new Set<string>();

  if (componentPropertyKey) {
    lookupKeys.add(cleanPropertyName(componentPropertyKey).toLowerCase());
  }

  if (componentPropertyName) {
    lookupKeys.add(cleanPropertyName(componentPropertyName).toLowerCase());
  }

  for (const lookupKey of lookupKeys) {
    const currentEntry = currentProperties.get(lookupKey);
    const sourceEntry = sourceProperties.get(lookupKey);

    if (currentEntry && sourceEntry && sourceEntry.value !== undefined) {
      return {
        key: currentEntry.key,
        value: sourceEntry.value
      };
    }
  }

  return null;
}

/**
 * Helper to check if a field belongs to a group and return the group name
 */
function getGroupedField(field: string): string | null {
  if (RADIUS_FIELDS.includes(field)) return 'cornerRadius';
  if (STROKE_FIELDS.includes(field)) return 'stroke';
  return null;
}

/**
 * Helper to get all fields associated with a reset target (handling groups)
 */
function getFieldsToReset(field: string): string[] {
  if (field === 'cornerRadius') return RADIUS_FIELDS;
  if (field === 'stroke') return STROKE_FIELDS;
  return [field];
}

/**
 * Helper to find the source node in the main component hierarchy corresponding to a target node.
 * 
 * IMPORTANT: This always resolves from the SELECTED instance's main component, NOT from
 * deeply nested component definitions. This ensures that when resetting overrides, we reset
 * to the value defined in the component (which may itself have overrides), not the original
 * source component.
 * 
 * Example: If "Breadcrumb Item Editable" component has Vector with strokeWeight=1.33px (overriding
 * the original "user" component's 1px), resetting an instance should reset to 1.33px, not 1px.
 */
async function findSourceNode(instance: InstanceNode, targetNode: SceneNode): Promise<BaseNode | null> {
  try {
    // Build the full index path from targetNode up to the selected instance
    const indexPath: number[] = [];
    let currentNode: SceneNode = targetNode;
    let depth = 0;
    const MAX_DEPTH = 100;

    while (currentNode.id !== instance.id && depth < MAX_DEPTH) {
      const parent = currentNode.parent;
      if (!parent) break;

      const index = parent.children.indexOf(currentNode as SceneNode);
      if (index === -1) return null;

      indexPath.unshift(index);
      currentNode = parent as SceneNode;
      depth++;
    }

    // Get the main component of the SELECTED instance
    let sourceNode: BaseNode | null = await getCachedMainComponent(instance);
    if (!sourceNode) return null;

    // Navigate down the main component using the path
    for (const idx of indexPath) {
      if (!sourceNode || !('children' in sourceNode)) return null;

      const children: readonly SceneNode[] = (sourceNode as ChildrenMixin).children;
      if (idx >= children.length) return null;

      sourceNode = children[idx];
    }

    return sourceNode;
  } catch (e) {
    return null;
  }
}

/**
 * Helper to reset a single property value
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resetProperty(node: SceneNode, field: string, value: unknown) {
  // Dynamic property access on Figma nodes requires casting
  const nodeRecord = node as unknown as Record<string, unknown>;
  const nodeWithStyles = node as unknown as {
    setStrokeStyleIdAsync?: (id: string) => Promise<void>;
    setFillStyleIdAsync?: (id: string) => Promise<void>;
    setEffectStyleIdAsync?: (id: string) => Promise<void>;
    setTextStyleIdAsync?: (id: string) => Promise<void>;
  };

  // Handle async style setters
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
    await figma.loadFontAsync(fontName);
    node.fontName = fontName;
  }
  // For array properties, clone to prevent reference issues
  else if (Array.isArray(value)) {
    nodeRecord[field] = JSON.parse(JSON.stringify(value));
  } else {
    nodeRecord[field] = value;
  }
}

/**
 * Helper for deep equality check
 */
function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object' || a === null || b === null) return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((val, i) => isEqual(val, b[i]));
  }

  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  if (keysA.length !== keysB.length) return false;

  return keysA.every(key => keysB.includes(key) && isEqual(objA[key], objB[key]));
}

/**
 * Helper to check if an override is "real" (value differs from source)
 */
async function isOverrideReal(instance: InstanceNode, node: SceneNode, field: string): Promise<boolean> {
  const sourceNode = await findSourceNode(instance, node);
  if (!sourceNode) return true; // Can't verify, assume real

  const fieldsToCheck = getFieldsToReset(field);
  const sourceRecord = sourceNode as unknown as Record<string, unknown>;
  const nodeRecord = node as unknown as Record<string, unknown>;

  for (const f of fieldsToCheck) {
    if (!(f in sourceNode)) continue;

    const sourceValue = sourceRecord[f];
    const currentValue = nodeRecord[f];

    if (!isEqual(sourceValue, currentValue)) {
      return true; // Found a difference
    }
  }

  return false; // All fields match source
}

/**
 * Helper to parse override reference string or JSON
 */
function parseOverrideReference(ref: string): ParsedOverrideReference {
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
  } catch (e) {
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
      return {
        nodeId: null,
        field,
        nodeName,
        componentPropertyKey: null,
        componentPropertyName: null
      };
    }
  }
  return {
    nodeId: null,
    field: null,
    nodeName: null,
    componentPropertyKey: null,
    componentPropertyName: null
  };
}

/**
 * Helper to restore an override from source
 */
async function restoreOverride(
  nodeToReset: SceneNode,
  sourceNode: BaseNode,
  field: string,
  componentPropertyKey: string | null = null,
  componentPropertyName: string | null = null
): Promise<boolean> {
  let didReset = false;

  if (field === 'componentProperties') {
    try {
      if (componentPropertyKey || componentPropertyName) {
        const propertyToReset = resolveComponentPropertyResetTarget(
          nodeToReset,
          sourceNode,
          componentPropertyKey,
          componentPropertyName
        );

        if (propertyToReset) {
          (nodeToReset as InstanceNode).setProperties({
            [propertyToReset.key]: propertyToReset.value
          });
          didReset = true;
        }
      } else {
        const defaultProps: Record<string, string | boolean> = {};
        if (sourceNode.type === 'INSTANCE') {
          const props = sourceNode.componentProperties;
          Object.entries(props).forEach(([k, v]) => defaultProps[k] = v.value);
        } else if (sourceNode.type === 'COMPONENT' || sourceNode.type === 'COMPONENT_SET') {
          const definitions = sourceNode.type === 'COMPONENT'
            ? getComponentPropertyDefinitions(sourceNode)
            : sourceNode.componentPropertyDefinitions;
          Object.entries(definitions).forEach(([k, v]) => {
            if (v.defaultValue !== undefined) {
              defaultProps[k] = v.defaultValue;
            }
          });
        }

        if (Object.keys(defaultProps).length > 0) {
          (nodeToReset as InstanceNode).setProperties(defaultProps);
          didReset = true;
        }
      }
    } catch (err) {
      // Failed to reset componentProperties
    }
  } else {
    const fieldsToReset = getFieldsToReset(field);
    const sourceRecord = sourceNode as unknown as Record<string, unknown>;
    
    for (const f of fieldsToReset) {
      if (f in sourceNode) {
        try {
          await resetProperty(nodeToReset, f, sourceRecord[f]);
          didReset = true;
        } catch (err) {
          // Failed to reset field
        }
      }
    }
  }
  return didReset;
}

/**
 * Search and list all overrides on selected instances
 */
export async function searchInstanceOverrides(searchTerm: string): Promise<Array<string | { name: string; data: unknown }>> {
  const selection = figma.currentPage.selection;
  const instances = selection.filter(node => node.type === 'INSTANCE') as InstanceNode[];
  const contexts = getOverrideSearchContexts(instances);

  if (instances.length === 0) {
    return ['No instances selected'];
  }

  // Collect all unique node IDs from overrides for batch lookup
  const uniqueNodeIds = new Set<string>();
  for (const context of contexts) {
    for (const override of context.ownerInstance.overrides) {
      uniqueNodeIds.add(override.id);
    }
  }

  // Batch fetch all nodes at once using Promise.all
  const nodeIdArray = Array.from(uniqueNodeIds);
  const nodeResults = await Promise.all(
    nodeIdArray.map(async (id) => {
      try {
        return await figma.getNodeByIdAsync(id) as SceneNode | null;
      } catch {
        return null;
      }
    })
  );

  // Create lookup map for O(1) access
  const nodeMap = new Map<string, SceneNode | null>();
  nodeIdArray.forEach((id, index) => {
    nodeMap.set(id, nodeResults[index]);
  });

  const mergedSuggestions = new Map<string, OverrideSuggestionEntry>();

  for (const context of contexts) {
    const { selectedInstance, ownerInstance } = context;

    for (const override of ownerInstance.overrides) {
      const nodeId = override.id;
      const fields = override.overriddenFields;
      const node = nodeMap.get(nodeId);

      if (!node) continue;
      if (!isNodeInSubtree(node, selectedInstance)) {
        continue;
      }

      const nodeName = 'name' in node ? node.name : 'Unknown';

      // Process fields
      for (const field of fields) {
        if (field === 'componentProperties' && node.type === 'INSTANCE') {
          const sourceNode = await findSourceNode(ownerInstance, node);
          const propertyOverrides = getOverriddenComponentProperties(node, sourceNode);

          for (const propertyOverride of propertyOverrides) {
            const displayName = `${nodeName} -> Property: ${propertyOverride.name}`;
            if (searchTerm && !displayName.toLowerCase().includes(searchTerm.toLowerCase())) continue;

            addOverrideSuggestion(
              mergedSuggestions,
              `property:${nodeName.toLowerCase()}:${propertyOverride.name.toLowerCase()}`,
              displayName,
              {
                nodeId,
                field: 'componentProperties',
                nodeName,
                componentPropertyKey: propertyOverride.key,
                componentPropertyName: propertyOverride.name
              },
              selectedInstance.id
            );
          }

          const displayName = `${nodeName} -> ${formatFieldLabel(field)}`;
          if (searchTerm && !displayName.toLowerCase().includes(searchTerm.toLowerCase())) continue;

          addOverrideSuggestion(
            mergedSuggestions,
            `field:${nodeName.toLowerCase()}:componentProperties`,
            displayName,
            { nodeId, field, nodeName },
            selectedInstance.id
          );
          continue;
        }

        // Check for groups first
        const groupName = getGroupedField(field);
        const effectiveField = groupName || field;

        // Check if the override is real (value differs from source)
        const isReal = await isOverrideReal(ownerInstance, node, effectiveField);
        if (!isReal) continue;

        const displayName = `${nodeName} -> ${formatFieldLabel(effectiveField)}`;

        if (searchTerm && !displayName.toLowerCase().includes(searchTerm.toLowerCase())) continue;

        addOverrideSuggestion(
          mergedSuggestions,
          `field:${nodeName.toLowerCase()}:${effectiveField.toLowerCase()}`,
          displayName,
          { nodeId, field: effectiveField, nodeName },
          selectedInstance.id
        );
      }
    }
  }

  for (const instance of instances) {
    const sourceNode = await getDirectComponentPropertySourceNode(instance);
    const propertyOverrides = getOverriddenComponentProperties(instance, sourceNode);

    for (const propertyOverride of propertyOverrides) {
      const displayName = `${instance.name} -> Property: ${propertyOverride.name}`;
      if (searchTerm && !displayName.toLowerCase().includes(searchTerm.toLowerCase())) continue;

      addOverrideSuggestion(
        mergedSuggestions,
        `property:${instance.name.toLowerCase()}:${propertyOverride.name.toLowerCase()}`,
        displayName,
        {
          nodeId: instance.id,
          field: 'componentProperties',
          nodeName: instance.name,
          componentPropertyKey: propertyOverride.key,
          componentPropertyName: propertyOverride.name
        },
        instance.id
      );
    }

    if (propertyOverrides.length > 0) {
      const displayName = `${instance.name} -> ${formatFieldLabel('componentProperties')}`;
      if (!searchTerm || displayName.toLowerCase().includes(searchTerm.toLowerCase())) {
        addOverrideSuggestion(
          mergedSuggestions,
          `field:${instance.name.toLowerCase()}:componentProperties`,
          displayName,
          {
            nodeId: instance.id,
            field: 'componentProperties',
            nodeName: instance.name
          },
          instance.id
        );
      }
    }
  }

  const overridesList = buildOverrideSuggestionsList(mergedSuggestions);

  return overridesList.length === 0
    ? (searchTerm ? [`No overrides found matching "${searchTerm}"`] : ['No overrides found on selected instances'])
    : overridesList;
}

/**
 * Reset a specific override on selected instances
 * @param overrideReference String in format "NodeName -> Field" or JSON data from dropdown
 */
export async function resetSpecificOverride(overrideReference: string) {
  const selection = figma.currentPage.selection;
  const instances = selection.filter(node => node.type === 'INSTANCE') as InstanceNode[];
  const contexts = getOverrideSearchContexts(instances);

  if (instances.length === 0) throw new Error('No instances selected');

  const {
    nodeId,
    field,
    nodeName,
    componentPropertyKey,
    componentPropertyName
  } = parseOverrideReference(overrideReference);

  if (!field) {
    figma.notify('Invalid override reference format', { error: true });
    return;
  }

  let resetCount = 0;

  for (const context of contexts) {
    const { selectedInstance, ownerInstance } = context;

    for (const override of ownerInstance.overrides) {
      // Filter by nodeId if provided
      if (nodeId && override.id !== nodeId) continue;

      // If matching by name, verify the node name
      if (!nodeId && nodeName) {
        try {
          const node = await figma.getNodeByIdAsync(override.id);
          if (!node || node.name !== nodeName) continue;
        } catch { continue; }
      }

      const nodeToReset = await figma.getNodeByIdAsync(override.id) as SceneNode | null;
      if (!nodeToReset) continue;
      if (!isNodeInSubtree(nodeToReset, selectedInstance)) {
        continue;
      }

      const fieldsToReset = getFieldsToReset(field);
      const hasMatchingField = override.overriddenFields.some(f => fieldsToReset.includes(f));

      if (hasMatchingField) {
        try {
          const sourceNode = await findSourceNode(ownerInstance, nodeToReset);

          if (sourceNode) {
            const success = await restoreOverride(
              nodeToReset,
              sourceNode,
              field,
              componentPropertyKey,
              componentPropertyName
            );
            if (success) resetCount++;
          }
        } catch (e) {
          // Error resetting override
        }
      }
    }
  }

  if (field === 'componentProperties') {
    for (const instance of instances) {
      if (nodeId && instance.id !== nodeId) continue;
      if (!matchesInstanceByName(instance, nodeName)) continue;

      try {
        const sourceNode = await getDirectComponentPropertySourceNode(instance);
        if (!sourceNode) continue;

        const success = await restoreOverride(
          instance,
          sourceNode,
          field,
          componentPropertyKey,
          componentPropertyName
        );

        if (success) resetCount++;
      } catch (e) {
        // Error resetting direct instance component property fallback
      }
    }
  }

  if (resetCount > 0) {
    const displayField = componentPropertyName || formatFieldLabel(field);
    figma.notify(`Reset "${displayField}" on ${resetCount} ${pluralize(resetCount, 'node')}${nodeName ? ` (${nodeName})` : ''}`);
  } else {
    figma.notify('No matching overrides found to reset', { error: true });
  }
}
