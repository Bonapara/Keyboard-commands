// ================================
// Instance Property Functions
// ================================

// Constants
const PROPERTY_ID_SUFFIX_REGEX = /#\d+:\d+$/;

// Types
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

/**
 * Helper: Get component property definitions (from ComponentSet if variant, otherwise from component)
 */
function getComponentPropertyDefinitions(mainComponent: ComponentNode): ComponentPropertyDefinitions {
  const componentParent = mainComponent.parent;
  if (componentParent && componentParent.type === 'COMPONENT_SET') {
    return componentParent.componentPropertyDefinitions;
  }
  return mainComponent.componentPropertyDefinitions;
}

/**
 * Helper: Clean property name by removing ID suffix
 */
function cleanPropertyName(propertyName: string): string {
  return propertyName.replace(PROPERTY_ID_SUFFIX_REGEX, '');
}

/**
 * Helper: Find the real property key using partial matching
 * Tries: 1) exact match, 2) cleaned exact match, 3) starts with, 4) contains
 * Returns null for both key and definition if no match is found
 */
function findPropertyKey(
  propertyName: string,
  allProperties: ComponentPropertyDefinitions
): { key: string | null; definition: PropertyDefinition | null } {
  // Try exact match first
  if (allProperties[propertyName]) {
    return { key: propertyName, definition: allProperties[propertyName] };
  }
  
  const propertyKeys = Object.keys(allProperties);
  
  // Try exact cleaned name match
  for (const key of propertyKeys) {
    const cleanedKey = cleanPropertyName(key);
    if (cleanedKey === propertyName) {
      return { key, definition: allProperties[key] };
    }
  }
  
  // Try partial matching (case-insensitive)
  const searchLower = propertyName.toLowerCase();
  
  // First try "starts with" match
  for (const key of propertyKeys) {
    const cleanedKey = cleanPropertyName(key);
    if (cleanedKey.toLowerCase().startsWith(searchLower)) {
      return { key, definition: allProperties[key] };
    }
  }
  
  // Finally try "contains" match
  for (const key of propertyKeys) {
    const cleanedKey = cleanPropertyName(key);
    if (cleanedKey.toLowerCase().includes(searchLower)) {
      return { key, definition: allProperties[key] };
    }
  }
  
  return { key: null, definition: null };
}

/**
 * Helper: Extract current property value (handles both direct values and objects with .value)
 */
function extractPropertyValue(property: string | boolean | { value: string | boolean }): string | boolean {
  if (typeof property === 'object' && property !== null && 'value' in property) {
    return property.value;
  }
  return property;
}


/**
 * Search for variant options of a specific property
 * Called when searchTerm is "PropertyName:" or "PropertyName:filter"
 */
async function searchVariantOptions(instances: InstanceNode[], propertyName: string, optionFilter: string = ''): Promise<string[]> {
  // Get the property definition from the first instance
  for (const instance of instances) {
    const mainComponent = await instance.getMainComponentAsync();
    if (!mainComponent) continue;
    
    const allProperties = getComponentPropertyDefinitions(mainComponent);
    const { key: realPropertyKey, definition: propertyDef } = findPropertyKey(propertyName, allProperties);
    
    if (realPropertyKey && propertyDef && propertyDef.type === 'VARIANT' && propertyDef.variantOptions) {
      // Filter options if optionFilter is provided
      let options = propertyDef.variantOptions;
      if (optionFilter) {
        const filterLower = optionFilter.toLowerCase();
        options = options.filter((opt: string) => opt.toLowerCase().includes(filterLower));
      }
      
      if (options.length === 0) {
        return [`No options matching "${optionFilter}" for "${propertyName}"`];
      }
      
      // Return filtered variant options formatted with the REAL property key
      return options.map((option: string) => `${realPropertyKey}:${option}`);
    }
  }
  
  return [`No variant options found for "${propertyName}"`];
}

/**
 * Set a specific variant option for a property
 * Handles variant components where all variant properties must be set together
 */
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
      // Build properties object with ALL variant properties
      // This ensures we set a valid variant combination
      const propertiesToSet: { [key: string]: string | boolean } = {};
      
      // First, get all current variant property values
      const propKeys = Object.keys(allVariantProperties);
      for (const propName of propKeys) {
        const propDef = allVariantProperties[propName];
        if (propDef && propDef.type === 'VARIANT') {
          const currentValue = extractPropertyValue(instance.componentProperties[propName]);
          propertiesToSet[propName] = String(currentValue);
        }
      }
      
      // Then override the one we're changing (use the REAL property key)
      propertiesToSet[realPropertyKey] = optionValue;
      
      instance.setProperties(propertiesToSet);
      
      // Store the matched property name for notification (first success only)
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
    // If partial match was used, show what was matched
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

/**
 * Set a text property value
 * Handles text component properties
 */
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
      
      // Store the matched property name for notification (first success only)
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
    // If partial match was used, show what was matched
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

/**
 * Search for available component properties on selected instances
 * Returns formatted suggestions for binding mode
 */
export async function searchInstanceProperties(searchTerm: string): Promise<string[]> {
  const selection = figma.currentPage.selection;
  const instances = selection.filter(node => node.type === 'INSTANCE') as InstanceNode[];
  
  if (instances.length === 0) {
    return ['No instances selected'];
  }
  
  // Check if we're in "property with value" mode (searchTerm contains :)
  // Format: "PropertyName:" or "PropertyName:Value"
  const propertyWithValueMatch = searchTerm.match(/^(.+):(.*)$/);
  if (propertyWithValueMatch) {
    const propertyName = propertyWithValueMatch[1].trim();
    const value = propertyWithValueMatch[2].trim();
    
    // Determine the property type from the first instance
    for (const instance of instances) {
      const mainComponent = await instance.getMainComponentAsync();
      if (!mainComponent) continue;
      
      const allProperties = getComponentPropertyDefinitions(mainComponent);
      const { key: realPropertyKey, definition: propertyDef } = findPropertyKey(propertyName, allProperties);
      
      if (propertyDef) {
        if (propertyDef.type === 'VARIANT') {
          // For variants, show filtered options
          return await searchVariantOptions(instances, propertyName, value);
        } else if (propertyDef.type === 'TEXT') {
          // For text properties, return the input as a ready-to-execute command
          // Use the original propertyName (not realPropertyKey) since setTextProperty will do the matching
          if (value) {
            return [`${propertyName}:${value}`];
          } else {
            // Just the colon, show a hint with the cleaned property name
            const cleanName = realPropertyKey ? cleanPropertyName(realPropertyKey) : propertyName;
            return [`${cleanName}: type your text value`];
          }
        }
      }
      
      // If we found a property definition, break (no need to check other instances)
      if (propertyDef) break;
    }
    
    // Fallback: assume it's a variant search
    return await searchVariantOptions(instances, propertyName, value);
  }
  
  // Collect all unique properties from selected instances
  const propertiesMap = new Map<string, PropertyData>();
  
  for (const instance of instances) {
    const mainComponent = await instance.getMainComponentAsync();
    if (!mainComponent) continue;
    
    const allProperties = getComponentPropertyDefinitions(mainComponent);
    
    // Collect property information
    const propKeys = Object.keys(allProperties);
    for (const propName of propKeys) {
      const propDef = allProperties[propName];
      if (!propDef) continue;
      
      // Skip INSTANCE_SWAP properties
      if (propDef.type === 'INSTANCE_SWAP') continue;
      
      if (!propertiesMap.has(propName)) {
        propertiesMap.set(propName, {
          type: propDef.type,
          values: new Set(),
          propertyDef: propDef
        });
      }
      
      // Get current value from instance
      const currentProp = instance.componentProperties[propName];
      if (currentProp !== undefined) {
        const actualValue = extractPropertyValue(currentProp);
        propertiesMap.get(propName)!.values.add(String(actualValue));
      }
    }
  }
  
  // Filter properties by search term
  const searchLower = searchTerm.toLowerCase();
  const matchingProperties: Array<{name: string; data: PropertyData}> = [];
  
  // Add matching properties
  for (const [propName, data] of propertiesMap.entries()) {
    if (propName.toLowerCase().includes(searchLower)) {
      matchingProperties.push({ name: propName, data });
    }
  }
  
  if (matchingProperties.length === 0) {
    return ['No matching properties found'];
  }
  
  // Format suggestions for binding mode
  return await Promise.all(matchingProperties.map(async ({ name, data }) => {
    return await formatPropertySuggestion(name, data);
  }));
}

/**
 * Helper: Format property suggestion for display
 * Format: "PropertyName (Type - option1, option2, option3, +N)"
 */
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
  
  // For variant and text properties, append ":" to indicate value input is needed
  const displayName = (data.type === 'VARIANT' || data.type === 'TEXT') ? `${cleanName}:` : cleanName;
  
  return `${displayName} (${typeDisplay} - ${optionsDisplay})`;
}

/**
 * Set instance property based on binding mode selection
 * Parses the property reference and applies changes to all selected instances
 */
export async function setInstanceProperty(propertyReference: string) {
  const selection = figma.currentPage.selection;
  const instances = selection.filter(node => node.type === 'INSTANCE') as InstanceNode[];
  
  if (instances.length === 0) {
    throw new Error('No instances selected');
  }
  
  // Check if this is a variant property with description (format: "PropertyName: (Variant - ...)")
  // This means user selected from first menu - extract property name and continue to submenu
  const variantWithDescMatch = propertyReference.match(/^([^:]+):\s*\(Variant\s*-/);
  if (variantWithDescMatch) {
    const propertyName = variantWithDescMatch[1].trim();
    figma.notify(`💡 Type "ip?${propertyName}:" in the command bar to see all available options for this variant`);
    return;
  }
  
  // Check if this is a text property with description (format: "PropertyName: (Text - ...)")
  const textWithDescMatch = propertyReference.match(/^([^:]+):\s*\(Text\s*-/);
  if (textWithDescMatch) {
    const propertyName = textWithDescMatch[1].trim();
    figma.notify(`💡 Type "ip?${propertyName}:Your text here" to set the text value`);
    return;
  }
  
  // Check if this is a property with value (format: "PropertyName:Value")
  // This handles both variant options and text values
  const propertyWithValueMatch = propertyReference.match(/^([^:]+):(.+)$/);
  if (propertyWithValueMatch) {
    const propertyName = propertyWithValueMatch[1].trim();
    const value = propertyWithValueMatch[2].trim();
    
    // Determine property type from the first instance to route correctly
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
    
    // Fallback: try variant first, then text
    return await setVariantProperty(instances, propertyName, value);
  }
  
  // Parse property reference
  // Format: "PropertyName (TYPE - Current: value)" or just "PropertyName"
  const match = propertyReference.match(/^([^(]+?)(?:\s*\([^)]+\))?$/);
  if (!match) {
    throw new Error('Invalid property reference format');
  }
  
  const propertyName = match[1].trim();
  
  // For now, we need to prompt for the new value
  // In binding mode, the user will need to provide the value separately
  // Let's handle different property types
  
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
      // Handle different property types
      switch (propertyDef.type) {
        case 'BOOLEAN': {
          // Toggle boolean value
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
