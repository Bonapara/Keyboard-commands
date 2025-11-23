

import { getStoredLibraries, getActiveLibraries } from './library';

const PROPERTY_ID_SUFFIX_REGEX = /#\d+:\d+$/;
const VARIANT_SPACING = 20;
const COMPONENT_SET_PADDING = 20;
const COMPONENT_SET_STROKE_COLOR = { r: 0x97 / 255, g: 0x47 / 255, b: 0xFF / 255 };

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
    const mainComponent = await instance.getMainComponentAsync();
    if (!mainComponent) continue;

    const allProperties = getComponentPropertyDefinitions(mainComponent);
    const { key: realPropertyKey, definition: propertyDef } = findPropertyKey(propertyName, allProperties);

    if (realPropertyKey && propertyDef && propertyDef.type === 'VARIANT' && propertyDef.variantOptions) {

      let options = propertyDef.variantOptions;
      if (optionFilter) {
        const filterLower = optionFilter.toLowerCase();
        options = options.filter((opt: string) => opt.toLowerCase().includes(filterLower));
      }

      if (options.length === 0) {
        return [`No options matching "${optionFilter}" for "${propertyName}"`];
      }

      return options.map((option: string) => `${realPropertyKey}:${option}`);
    }
  }

  return [`No variant options found for "${propertyName}"`];
}

async function setVariantProperty(instances: InstanceNode[], propertyName: string, optionValue: string): Promise<void> {
  let successCount = 0;
  let errorCount = 0;
  let matchedPropertyName = '';

  for (const instance of instances) {
    const mainComponent = await instance.getMainComponentAsync();
    if (!mainComponent) {
      errorCount++;
      continue;
    }

    const allVariantProperties = getComponentPropertyDefinitions(mainComponent);
    const { key: realPropertyKey, definition: propertyDef } = findPropertyKey(propertyName, allVariantProperties);

    if (!realPropertyKey || !propertyDef || propertyDef.type !== 'VARIANT') {
      errorCount++;
      continue;
    }

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

  if (successCount > 0) {

    const wasPartialMatch = matchedPropertyName.toLowerCase() !== propertyName.toLowerCase();
    const message = wasPartialMatch
      ? `Matched "${matchedPropertyName}" → set to "${optionValue}" on ${successCount} instance${successCount > 1 ? 's' : ''}`
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
    const mainComponent = await instance.getMainComponentAsync();
    if (!mainComponent) {
      errorCount++;
      continue;
    }

    const allProperties = getComponentPropertyDefinitions(mainComponent);
    const { key: realPropertyKey, definition: propertyDef } = findPropertyKey(propertyName, allProperties);

    if (!realPropertyKey || !propertyDef || propertyDef.type !== 'TEXT') {
      errorCount++;
      continue;
    }

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

  if (successCount > 0) {

    const wasPartialMatch = matchedPropertyName.toLowerCase() !== propertyName.toLowerCase();
    const message = wasPartialMatch
      ? `Matched "${matchedPropertyName}" → set to "${textValue}" on ${successCount} instance${successCount > 1 ? 's' : ''}`
      : `Set "${matchedPropertyName}" to "${textValue}" on ${successCount} instance${successCount > 1 ? 's' : ''}`;

    figma.notify(message);
  }

  if (errorCount > 0) {
    figma.notify(`Failed to update ${errorCount} instance${errorCount > 1 ? 's' : ''}`, { error: true });
  }
}

async function searchLibraryComponents(searchTerm: string, limit: number = 100, libraryFilter?: string): Promise<Array<{ name: string; key: string; library: string }>> {
  const libraries = await getStoredLibraries();
  const activeLibraries = await getActiveLibraries();
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
      const mainComponent = await instance.getMainComponentAsync();
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
          // Determine context library from current value
          let currentLibrary: string | undefined;

          if (realPropertyKey && instance.componentProperties[realPropertyKey]) {
            const currentId = instance.componentProperties[realPropertyKey].value;
            if (typeof currentId === 'string') {
              try {
                const node = await figma.getNodeByIdAsync(currentId);
                if (node && (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET')) {
                  // Find which library has this key
                  // We need to check all libraries? Or is there a faster way?
                  // We have to check all stored libraries.
                  const libraries = await getStoredLibraries();
                  const activeLibs = await getActiveLibraries();

                  // Check active libraries first
                  for (const libName of activeLibs) {
                    const items = libraries[libName];
                    if (items) {
                      // item[1] is key
                      // We need the node's key.
                      // Wait, node.key is available on ComponentNode? Yes.
                      // But `key` property on ComponentNode is only available if it's a published component?
                      // Local components have keys too.
                      // Let's assume we can access .key
                      const componentKey = (node as ComponentNode | ComponentSetNode).key;
                      if (componentKey) {
                        const match = items.find(item => item[1] === componentKey);
                        if (match) {
                          currentLibrary = libName;
                          break;
                        }
                      }
                    }
                  }
                }
              } catch (e) {
                // Ignore error resolving node
              }
            }
          }

          // If value is empty, use the current library as filter
          // If value is not empty, search globally (or maybe prioritize? User said "default suggestion")
          // "Default suggestion" usually means empty search state.

          const filter = (value === '' && currentLibrary) ? currentLibrary : undefined;

          const components = await searchLibraryComponents(value, 100, filter);

          if (components.length === 0) {
            if (filter) {
              // If filtered search returned nothing (maybe library empty?), try global?
              // But user wanted "part of the same library".
              // Let's just return empty or maybe a message.
              return [`No components found in "${filter}"`];
            }
            return [`No components found matching "${value}"`];
          }
          return components.map(c => ({
            name: `${c.name} (${c.library})`,
            data: `${propertyName}:${c.name} (${c.library})`
          }));
        }
      }

      if (propertyDef) break;
    }

    return await searchVariantOptions(instances, propertyName, value);
  }

  const propertiesMap = new Map<string, PropertyData>();

  for (const instance of instances) {
    const mainComponent = await instance.getMainComponentAsync();
    if (!mainComponent) continue;

    const allProperties = getComponentPropertyDefinitions(mainComponent);

    const propKeys = Object.keys(allProperties);
    for (const propName of propKeys) {
      const propDef = allProperties[propName];
      if (!propDef) continue;

      // Removed INSTANCE_SWAP skip

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
        optionsDisplay = `${currentValue} → Toggle`;
      } else if (currentValues.length > 1) {
        optionsDisplay = 'Mixed → Toggle';
      } else {
        optionsDisplay = 'true, false';
      }
      break;
    }
    case 'VARIANT': {
      const currentValues = Array.from(data.values);
      if (currentValues.length === 1) {
        optionsDisplay = `${currentValues[0]} → type: to change`;
      } else if (currentValues.length > 1) {
        optionsDisplay = 'Mixed → type: to change';
      } else if (data.propertyDef.variantOptions) {
        // Fallback: show options if no current value
        const options = data.propertyDef.variantOptions;
        const maxDisplay = 3;
        if (options.length <= maxDisplay) {
          optionsDisplay = `${options.join(', ')} → type: to change`;
        } else {
          const displayedOptions = options.slice(0, maxDisplay).join(', ');
          const remaining = options.length - maxDisplay;
          optionsDisplay = `${displayedOptions}, +${remaining} → type: to change`;
        }
      }
      break;
    }
    case 'TEXT': {
      const currentValues = Array.from(data.values);
      if (currentValues.length === 1) {
        optionsDisplay = `${currentValues[0]} → type :text to change`;
      } else if (currentValues.length > 1) {
        optionsDisplay = 'Mixed → type :text to change';
      } else {
        optionsDisplay = 'Text input → type :text to set';
      }
      break;
    }
    case 'INSTANCE_SWAP': {
      // Get current component name(s)
      const currentValues = Array.from(data.values);

      // Since values are component IDs or keys, we might want to try to resolve them to names if possible
      // But for now, let's assume we can't easily resolve ID to name without a lookup
      // However, the value stored in componentProperties for INSTANCE_SWAP is the ID.
      // We can try to find the node if it's local, or just show "Current"
      // Actually, let's try to get the node name if possible, but it might be async and slow for many items.
      // For now, let's just show the count or "Mixed" if multiple.
      // Wait, the prompt requested: "Current: ComponentName"

      // Let's try to resolve the name for the first value if it's a local ID
      // Note: This is a bit tricky as we don't have the node here, just the ID string.
      // We'll skip complex resolution for now to keep it fast, or maybe just show "Current Selection"

      // Actually, we can get the preferred values
      const preferred = data.propertyDef.preferredValues;
      let _preferredDisplay = '';

      if (preferred && preferred.length > 0) {
        // preferredValues are [{ type: 'COMPONENT', key: string }, ...]
        // We can't easily get names from keys without looking them up in our library storage or Figma
        // Let's try to look up in our library storage
        const libraries = await getStoredLibraries();
        const activeLibraries = await getActiveLibraries();
        const preferredNames: string[] = [];

        for (const pref of preferred) {
          // Try to find name in active libraries
          let foundName = '';
          for (const libName of activeLibraries) {
            const items = libraries[libName];
            if (items) {
              const match = items.find(item => item[1] === pref.key);
              if (match) {
                foundName = match[0];
                break;
              }
            }
          }
          if (foundName) preferredNames.push(foundName);
        }

        if (preferredNames.length > 0) {
          const maxDisplay = 3;
          if (preferredNames.length <= maxDisplay) {
            _preferredDisplay = ` | Preferred: ${preferredNames.join(', ')}`;
          } else {
            _preferredDisplay = ` | Preferred: ${preferredNames.slice(0, maxDisplay).join(', ')}, +${preferredNames.length - maxDisplay}`;
          }
        }
      }

      // For current value, we can try to find the node if it exists in the document
      // But `data.values` contains IDs. 
      // Let's try to resolve one
      let currentName = 'None';
      if (currentValues.length === 1) {
        // It's an ID. 
        // We can't easily resolve it here without being async and potentially slow.
        // But wait, formatPropertySuggestion is async.
        try {
          const node = await figma.getNodeByIdAsync(currentValues[0]);
          if (node && 'name' in node) {
            currentName = node.name;
          }
        } catch (e) {
          // Ignore
        }
      } else if (currentValues.length > 1) {
        currentName = 'Mixed';
      }

      optionsDisplay = `${currentName} → type: to change`;
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
    const mainComponent = await firstInstance.getMainComponentAsync();
    if (mainComponent) {
      const allProperties = getComponentPropertyDefinitions(mainComponent);
      const { definition: propertyDef } = findPropertyKey(propertyName, allProperties);

      if (propertyDef) {
        if (propertyDef.type === 'VARIANT') {
          return await setVariantProperty(instances, propertyName, value);
        } else if (propertyDef.type === 'TEXT') {
          return await setTextProperty(instances, propertyName, value);
        } else if (propertyDef.type === 'INSTANCE_SWAP') {
          // Handle Instance Swap
          const { component, name: _name } = await findAndImportComponent(value);

          if (component) {
            // Apply to all instances
            let successCount = 0;
            for (const inst of instances) {
              const main = await inst.getMainComponentAsync();
              if (!main) continue;
              const props = getComponentPropertyDefinitions(main);
              const { key: realKey } = findPropertyKey(propertyName, props);

              if (realKey) {
                inst.setProperties({ [realKey]: component.id });
                successCount++;
              } else {
                console.warn(`[InstanceSwap] Property "${propertyName}" not found on instance "${inst.name}"`);
              }
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
    const mainComponent = await instance.getMainComponentAsync();
    if (!mainComponent) {
      errorCount++;
      continue;
    }

    const allProperties = getComponentPropertyDefinitions(mainComponent);
    const { key: realPropertyKey, definition: propertyDef } = findPropertyKey(propertyName, allProperties);

    if (!realPropertyKey || !propertyDef) {
      errorCount++;
      continue;
    }

    try {

      switch (propertyDef.type) {
        case 'BOOLEAN': {

          const currentValue = extractPropertyValue(instance.componentProperties[realPropertyKey]) as boolean;
          instance.setProperties({
            [realPropertyKey]: !currentValue
          });
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

      successCount++;
    } catch (error) {
      console.error(`Error setting property ${propertyName}:`, error);
      errorCount++;
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
      instance.resetOverrides();
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

export async function selectMasterComponent() {
  const selection = figma.currentPage.selection;
  const instances = selection.filter(node => node.type === 'INSTANCE') as InstanceNode[];

  if (instances.length === 0) {
    throw new Error('No instances selected');
  }

  const mainComponents: ComponentNode[] = [];

  for (const instance of instances) {
    const main = await instance.getMainComponentAsync();
    if (main) {
      mainComponents.push(main);
    }
  }

  if (mainComponents.length > 0) {
    figma.currentPage.selection = mainComponents;
    figma.viewport.scrollAndZoomIntoView(mainComponents);
    figma.notify(`Selected ${mainComponents.length} main component${mainComponents.length > 1 ? 's' : ''}`);
  } else {
    figma.notify('No main components found');
  }
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

  const mainComponent = await instance.getMainComponentAsync();
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
async function findAndImportComponent(value: string): Promise<{ component: ComponentNode | null, name: string }> {
  const libraries = await getStoredLibraries();
  const activeLibraries = await getActiveLibraries();

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
  const components = await searchLibraryComponents(searchTerm);

  if (components.length === 0) {
    return [`No components found matching "${searchTerm}"`];
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
    for (const inst of instances) {
      try {
        inst.swapComponent(component);
        successCount++;
      } catch (e) {
        console.error(`[SwapInstance] Error swapping instance "${inst.name}":`, e);
      }
    }
    if (successCount > 0) {
      figma.notify(`Swapped ${successCount} instance${successCount > 1 ? 's' : ''} to "${component.name}"`);
    } else {
      figma.notify(`Failed to swap instances to "${name}"`, { error: true });
    }
  }
}
