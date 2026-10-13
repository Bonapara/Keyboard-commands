// Helpers shared by the instance property (ip), instance swap (is) and
// override reset (rio) implementations.

export const PROPERTY_ID_SUFFIX_REGEX = /#\d+:\d+$/;

// Cache for main component lookups to avoid repeated async calls. Store the
// in-flight promise too, so parallel inventory collection does not issue the
// same lookup twice for a shared nested instance.
const mainComponentCache = new WeakMap<InstanceNode, Promise<ComponentNode | null>>();

export async function getCachedMainComponent(instance: InstanceNode): Promise<ComponentNode | null> {
  const cached = mainComponentCache.get(instance);
  if (cached) {
    return await cached;
  }

  const mainComponentPromise = instance.getMainComponentAsync().catch(error => {
    mainComponentCache.delete(instance);
    throw error;
  });
  mainComponentCache.set(instance, mainComponentPromise);
  return await mainComponentPromise;
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural || singular + 's');
}

export function getComponentPropertyDefinitions(mainComponent: ComponentNode): ComponentPropertyDefinitions {
  const componentParent = mainComponent.parent;
  if (componentParent && componentParent.type === 'COMPONENT_SET') {
    return componentParent.componentPropertyDefinitions;
  }
  return mainComponent.componentPropertyDefinitions;
}

export function cleanPropertyName(propertyName: string): string {
  return propertyName.replace(PROPERTY_ID_SUFFIX_REGEX, '');
}

// Exact key, then exact cleaned name, then cleaned-name prefix, then substring.
export function findPropertyKey(
  propertyName: string,
  allProperties: ComponentPropertyDefinitions
): { key: string | null; definition: ComponentPropertyDefinitions[string] | null } {
  if (allProperties[propertyName]) {
    return { key: propertyName, definition: allProperties[propertyName] };
  }

  const propertyKeys = Object.keys(allProperties);
  const searchLower = propertyName.toLowerCase();
  const predicates: Array<(cleanedKey: string) => boolean> = [
    cleanedKey => cleanedKey === propertyName,
    cleanedKey => cleanedKey.toLowerCase().startsWith(searchLower),
    cleanedKey => cleanedKey.toLowerCase().includes(searchLower),
  ];

  for (const predicate of predicates) {
    const key = propertyKeys.find(candidate => predicate(cleanPropertyName(candidate)));
    if (key) return { key, definition: allProperties[key] };
  }

  return { key: null, definition: null };
}

export function extractPropertyValue(property: string | boolean | { value: string | boolean }): string | boolean {
  if (typeof property === 'object' && property !== null && 'value' in property) {
    return property.value;
  }
  return property;
}

export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\W_]+/g, ' ')
    .trim();
}

// Every whitespace-separated token of the search must appear in at least one
// target, either as-is or with the target's spaces removed ("iconsize" finds
// "Icon size").
export function matchesSearchTokens(searchTerm: string, ...targets: string[]): boolean {
  const normalizedSearch = normalizeSearchText(searchTerm);
  if (!normalizedSearch) return true;

  const tokens = normalizedSearch.split(/\s+/).filter(Boolean);
  const normalizedTargets = targets.map(normalizeSearchText);
  const compactTargets = normalizedTargets.map(target => target.replace(/\s+/g, ''));

  return tokens.every(token =>
    normalizedTargets.some(target => target.includes(token)) ||
    compactTargets.some(target => target.includes(token))
  );
}

// "Size=Small, State=Hover" → { Size: 'Small', State: 'Hover' }
export function parseVariantName(name: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const part of name.split(',')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key) values[key] = value;
  }
  return values;
}

// Text nodes can only be edited once every font they use is loaded.
export async function loadFontsForTextNode(node: TextNode): Promise<void> {
  const fonts: FontName[] = node.fontName === figma.mixed
    ? node.getStyledTextSegments(['fontName']).map(segment => segment.fontName)
    : [node.fontName as FontName];

  const unique = new Map(fonts.map(font => [`${font.family}\u0000${font.style}`, font]));
  for (const font of unique.values()) {
    try {
      await figma.loadFontAsync(font);
    } catch {
      throw new Error(`font "${font.family} ${font.style}" isn't available`);
    }
  }
}
