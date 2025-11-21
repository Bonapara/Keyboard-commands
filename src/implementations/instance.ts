

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

export async function searchInstanceProperties(searchTerm: string): Promise<string[]> {
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

          if (value) {
            return [`${propertyName}:${value}`];
          } else {

            const cleanName = realPropertyKey ? cleanPropertyName(realPropertyKey) : propertyName;
            return [`${cleanName}: type your text value`];
          }
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

      if (propDef.type === 'INSTANCE_SWAP') continue;

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
    case 'BOOLEAN':
      optionsDisplay = 'true, false';
      break;
    case 'VARIANT':
      if (data.propertyDef.variantOptions) {
        const options = data.propertyDef.variantOptions;
        const maxDisplay = 3;
        if (options.length <= maxDisplay) {
          optionsDisplay = options.join(', ');
        } else {
          const displayedOptions = options.slice(0, maxDisplay).join(', ');
          const remaining = options.length - maxDisplay;
          optionsDisplay = `${displayedOptions}, +${remaining}`;
        }
      }
      break;
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
    default:
      optionsDisplay = 'Value';
  }

  const displayName = (data.type === 'VARIANT' || data.type === 'TEXT') ? `${cleanName}:` : cleanName;

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

  if ((instance.fills as any) !== figma.mixed) {
    mainComponent.fills = instance.fills;
  }

  if ((instance.strokes as any) !== figma.mixed) {
    mainComponent.strokes = instance.strokes;
  }
  if ((instance.strokeWeight as any) !== figma.mixed) {
    mainComponent.strokeWeight = instance.strokeWeight;
  }
  if ((instance.strokeAlign as any) !== figma.mixed) {
    mainComponent.strokeAlign = instance.strokeAlign;
  }
  if ((instance.dashPattern as any) !== figma.mixed) {
    mainComponent.dashPattern = instance.dashPattern;
  }

  if ((instance.effects as any) !== figma.mixed) {
    mainComponent.effects = instance.effects;
  }

  if ('cornerRadius' in instance && (instance.cornerRadius as any) !== figma.mixed) {
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
