// ===============
// Helper Functions & Constants
// ===============

import type { Command, SpecialCondition, ValueFormat, BindingSupport, VariableResolvedType, PaintResolution, StyleBindingType } from './types';
import { COMMANDS, type CommandName } from './commands';
import {
  COMMAND_SPLITTER_REGEX,
  COMMAND_PART_REGEX,
  VALUE_FORMAT_REGEX,
  CACHE_DURATION
} from './constants';
import { searchInstanceProperties } from './implementations/instance';

// Re-export constants for backwards compatibility
export { COMMAND_SPLITTER_REGEX, COMMAND_PART_REGEX, VALUE_FORMAT_REGEX };

// Helper Functions

export function notify(message: string, options?: NotificationOptions) {
  figma.notify(message, options);
}

export function checkSpecialConditions(node: SceneNode, conditions: SpecialCondition[]): boolean {
  if (!conditions || conditions.length === 0) return true;

  return conditions.some(condition => {
    switch (condition) {
      case 'IsAutoLayout':
        return 'layoutMode' in node && node.layoutMode !== 'NONE';
      case 'IsInAutoLayout':
        return node.parent && 'layoutMode' in node.parent && node.parent.layoutMode !== 'NONE';
      case 'IsAbsoluteInAutoLayout':
        return node.parent &&
          'layoutMode' in node.parent &&
          node.parent.layoutMode !== 'NONE' &&
          'layoutPositioning' in node &&
          node.layoutPositioning === 'ABSOLUTE';
      case 'NoTextStyleApplied':
        return node.type === 'TEXT' &&
          (!node.textStyleId ||
            node.textStyleId === '');
      case 'TextStyleApplied':
        return node.type === 'TEXT' &&
          node.textStyleId !== '' &&
          node.textStyleId !== undefined;

      case 'IsNotInAutoLayout':
        return node.parent && 'layoutMode' in node.parent && node.parent.layoutMode === 'NONE';
      case 'IsAutoLayoutWrap':
        return 'layoutMode' in node && node.layoutMode !== 'NONE' && 'layoutWrap' in node && node.layoutWrap === 'WRAP';
      default:
        return false;
    }
  });
}

// Unified findCommand function
export function findCommand(part: string): Array<Command & { name: CommandName }> {
  const commandPart = part.match(COMMAND_PART_REGEX)?.[0];

  if (!commandPart) {
    return [];
  }

  const cmdLower = commandPart.toLowerCase();
  const selection = figma.currentPage.selection;

  // Helper function to check if command supports current selection
  const supportsCurrentSelection = (cmd: Command) => {
    if (!cmd.supportedNodes && !cmd.specialConditions) return true;
    if (selection.length === 0) return true;

    // Check both supportedNodes and specialConditions
    const supportsNodeTypes = !cmd.supportedNodes || selection.every(node =>
      cmd.supportedNodes!.indexOf(node.type) !== -1
    );

    const meetsSpecialConditions = !cmd.specialConditions || selection.every(node =>
      checkSpecialConditions(node, cmd.specialConditions!)
    );

    return supportsNodeTypes && meetsSpecialConditions;
  };

  // First, check for exact alias matches
  const exactAliasMatches = COMMANDS.filter(cmd => {
    const aliases = Array.isArray(cmd.alias) ? cmd.alias : [cmd.alias];
    return aliases.some(alias => alias.toLowerCase() === cmdLower) && supportsCurrentSelection(cmd);
  });

  if (exactAliasMatches.length > 0) {
    return exactAliasMatches;
  }

  // Then, split results into "starts with" and "contains"
  const startsWithMatches: Array<Command & { name: CommandName }> = [];
  const containsMatches: Array<Command & { name: CommandName }> = [];

  COMMANDS.forEach(cmd => {
    // First check if command supports current selection
    if (!supportsCurrentSelection(cmd)) return;

    const nameLower = cmd.name.toLowerCase();
    const aliases = Array.isArray(cmd.alias) ? cmd.alias : [cmd.alias];

    // Check if name or any alias starts with the search term
    if (nameLower.startsWith(cmdLower) ||
      aliases.some(alias => alias.toLowerCase().startsWith(cmdLower))) {
      startsWithMatches.push(cmd);
    }
    // If not starting with, check if it contains the term
    else if (nameLower.includes(cmdLower) ||
      aliases.some(alias => alias.toLowerCase().includes(cmdLower))) {
      containsMatches.push(cmd);
    }
  });

  // Combine the results with "starts with" matches first
  return [...startsWithMatches, ...containsMatches];
}

export function calculateExpression(expression: string): string {
  // Check if the expression ends with %
  const isPercentage = expression.endsWith('%');

  // Remove % sign and spaces, normalize 'x' to '*'
  const sanitizedExp = expression
    .replace(/%$/, '')
    .replace(/\s+/g, '')
    .replace(/x/gi, '*');

  // Validate the expression
  if (!/^-?\(?\d+(\.\d+)?(?:[-+*/]\(?-?\d+(\.\d+)?\)?)*\)?$/.test(sanitizedExp)) {
    throw new Error('Invalid calculation format');
  }

  try {
    // Calculate the numeric result
    const result = Function(`return ${sanitizedExp}`)();

    // Return the result with % if the input had %
    return isPercentage ? `${result}%` : result.toString();
  } catch (error) {
    throw new Error('Invalid calculation');
  }
}

// ================
// Suggestion Helper
// ================

export function getCommandSuggestions(
  commands: Array<Command & { name: CommandName }>,
  searchTerm: string = '',
  excludeCommand?: Command,
  includeSuggestion: boolean = false,
  previousCommands: Record<string, string> = {}
) {
  const selection = figma.currentPage.selection;

  const filteredCommands = commands.filter(cmd => {
    // Exclude the specific command (so it doesn't show up as a "related" suggestion to itself)
    if (excludeCommand && cmd.name === excludeCommand.name) return false;

    // Check specialConditions (e.g. IsAutoLayout, etc.)
    if (cmd.specialConditions && selection.length > 0) {
      if (!selection.every(node => checkSpecialConditions(node, cmd.specialConditions!))) {
        return false;
      }
    }

    // Check supportedNodes if selection exists
    if (cmd.supportedNodes && selection.length > 0) {
      if (!selection.every(node => cmd.supportedNodes!.indexOf(node.type) !== -1)) {
        return false;
      }
    }

    // If the user typed nothing (searchTerm is empty):
    // - For the initial top-level suggestions, we return all commands.
    // - For "related" suggestions (excludeCommand is set), we don't return everything
    //   (otherwise you'd see random commands that have nothing to do with the matched command).
    if (!searchTerm) {
      return !excludeCommand; // Return true if no excludeCommand, false if we are in "related" mode
    }

    // Otherwise, normal search filtering
    const lowerSearch = searchTerm.toLowerCase();
    return (
      cmd.name.toLowerCase().startsWith(lowerSearch) ||
      cmd.name.toLowerCase().includes(lowerSearch) ||
      cmd.alias.some(alias =>
        alias.toLowerCase().startsWith(lowerSearch) ||
        alias.toLowerCase().includes(lowerSearch)
      )
    );
  });

  // Sort results
  const sortedCommands = filteredCommands.sort((a, b) => {
    // If no search term (and we're showing top-level suggestions),
    // just sort by shortest alias first, then name
    if (!searchTerm && !excludeCommand) {
      if (a.alias[0].length !== b.alias[0].length) {
        return a.alias[0].length - b.alias[0].length;
      }
      return a.name.localeCompare(b.name);
    }

    // With a search term, do an exact-match-first, then "starts with," then "contains"
    const lowerSearch = searchTerm.toLowerCase();
    const aLower = a.name.toLowerCase();
    const bLower = b.name.toLowerCase();

    // Exact match first
    const aExact = aLower === lowerSearch;
    const bExact = bLower === lowerSearch;
    if (aExact !== bExact) return bExact ? 1 : -1;

    // "Starts with" next
    const aStarts = aLower.startsWith(lowerSearch);
    const bStarts = bLower.startsWith(lowerSearch);
    if (aStarts !== bStarts) return bStarts ? 1 : -1;

    // "Contains" afterwards
    const aContains = aLower.includes(lowerSearch);
    const bContains = bLower.includes(lowerSearch);
    if (aContains !== bContains) return bContains ? 1 : -1;

    // Finally, alphabetical
    return a.name.localeCompare(b.name);
  });

  // Build suggestion strings
  return sortedCommands.map((cmd, index) => {
    const previousValue = previousCommands[cmd.name];
    let infoText = '';

    if (previousValue !== undefined) {
      // If we previously set this command
      infoText =
        cmd.type === 'commandWithoutValue'
          ? 'ℹ️ already set'
          : `ℹ️ already set to '${previousValue}'`;
    } else if (includeSuggestion && index === 0) {
      // If this is the top suggestion, show the command's built-in suggestion (if any)
      infoText = cmd.suggestion || '';
    }

    const separator = infoText ? ' -- ' : '';
    return `${cmd.alias.join(', ')} · ${cmd.name}${separator}${infoText}`;
  });
}

export function extractValue(text: string, format: ValueFormat): string | null {
  console.log("extract value", text);

  // Check for instance property format: "PropertyName:Value"
  // This is used for instance property binding mode
  const instancePropertyMatch = text.match(/^([a-z]+)\s+([^:]+):(.+)$/i);
  if (instancePropertyMatch) {
    // Format: "ip PropertyName:Value" -> extract "PropertyName:Value"
    return text.substring(text.indexOf(' ') + 1).trim();
  }

  // Check for style/variable references from the binding system
  // Variables have format: "Name (Collection - Location)" (contains " - " in parentheses)
  // Styles have format: "Name (Location)" (single word in parentheses)
  // The text might be "cmd Name (...)" so we need to extract just "Name (...)"
  const bindingMatch = text.match(/([^(]+)\s*\(([^)]+)\)/);
  if (bindingMatch) {
    // Check if there's a space before the name (indicating a command prefix)
    const spaceIndex = text.indexOf(' ');
    if (spaceIndex !== -1) {
      // Extract everything after the first space (the binding value)
      return text.substring(spaceIndex + 1).trim();
    }
    // No space, so the entire text is the binding value
    return text.trim();
  }

  const match = text.match(VALUE_FORMAT_REGEX[format]);
  console.log("extract value", match);
  if (!match) return null;

  if (format === 'hex') {
    const value = match[0];
    return value.startsWith('#') ? value : `#${value}`;
  }

  if (format === 'number') {
    const expression = match[0];
    try {
      const result = calculateExpression(expression);
      return result.toString();
    } catch {
      return expression;
    }
  }

  return match[0];
}

// ================
// Style & Variable Caching
// ================

// Cache structure
interface StyleVariableCache {
  paintStyles: Array<{ name: string, key: string, isLocal: boolean }>;
  textStyles: Array<{ name: string, key: string, isLocal: boolean }>;
  variables: Array<{ id: string, name: string, type: string, collection: string, isLibrary: boolean }>;
  timestamp: number;
}

let cache: StyleVariableCache | null = null;

export async function getCachedStylesAndVariables(): Promise<StyleVariableCache> {
  if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
    return cache;
  }

  // Fetch local paint styles (includes already imported library styles)
  const localPaintStyles = await figma.getLocalPaintStylesAsync();
  const paintStylesData = localPaintStyles.map(s => ({
    name: s.name,
    key: s.key,
    isLocal: !s.remote  // remote means it's from a library
  }));

  // Fetch local text styles (includes already imported library styles)
  const localTextStyles = await figma.getLocalTextStylesAsync();
  const textStylesData = localTextStyles.map(s => ({
    name: s.name,
    key: s.key,
    isLocal: !s.remote  // remote means it's from a library
  }));

  // Fetch all local variables
  const allVariables = await figma.variables.getLocalVariablesAsync();
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const collectionMap = new Map(collections.map(c => [c.id, c.name]));

  const variablesData = allVariables.map(v => ({
    id: v.id,
    name: v.name,
    type: v.resolvedType,
    collection: collectionMap.get(v.variableCollectionId) || 'Unknown',
    isLibrary: false
  }));

  // Fetch library variables
  try {
    const libraryCollections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();

    for (const libCollection of libraryCollections) {
      try {
        const libVars = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(libCollection.key);

        libVars.forEach(libVar => {
          variablesData.push({
            id: libVar.key,           // Use key for library vars (will import later)
            name: libVar.name,
            type: libVar.resolvedType,
            collection: libCollection.name,
            isLibrary: true
          });
        });
      } catch (e) {
        console.warn(`Failed to fetch variables from library collection ${libCollection.name}:`, e);
      }
    }
  } catch (e) {
    console.warn('Failed to fetch library variable collections:', e);
  }

  console.log(`📚 Loaded ${variablesData.length} variables (${variablesData.filter(v => !v.isLibrary).length} local, ${variablesData.filter(v => v.isLibrary).length} library)`);

  cache = {
    paintStyles: paintStylesData,
    textStyles: textStylesData,
    variables: variablesData,
    timestamp: Date.now()
  };

  return cache;
}

// ================
// Search Function
// ================

// Natural sort helper function for sorting strings with numbers
function naturalSort(a: string, b: string): number {
  const regex = /(\d+)|(\D+)/g;
  const aParts = a.match(regex) || [];
  const bParts = b.match(regex) || [];

  for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
    const aPart = aParts[i];
    const bPart = bParts[i];

    const aNum = parseInt(aPart);
    const bNum = parseInt(bPart);

    // If both are numbers, compare numerically
    if (!isNaN(aNum) && !isNaN(bNum)) {
      if (aNum !== bNum) return aNum - bNum;
    } else {
      // Otherwise compare as strings
      const cmp = aPart.localeCompare(bPart);
      if (cmp !== 0) return cmp;
    }
  }

  return aParts.length - bParts.length;
}

// Flexible search helper - normalizes separators for matching
// This allows "Sky 4" to match "Bright/sky/4"
function flexibleMatch(searchTerm: string, targetName: string): boolean {
  // Normalize both strings: lowercase and replace separators with spaces
  const normalizeString = (str: string) =>
    str.toLowerCase().replace(/[/\-_]/g, ' ').replace(/\s+/g, ' ').trim();

  const normalizedSearch = normalizeString(searchTerm);
  const normalizedTarget = normalizeString(targetName);

  // Simple substring match on normalized strings
  if (normalizedTarget.includes(normalizedSearch)) {
    return true;
  }

  // Also check if all search tokens appear in the target (in order)
  const searchTokens = normalizedSearch.split(' ').filter(t => t.length > 0);
  const targetTokens = normalizedTarget.split(' ').filter(t => t.length > 0);

  if (searchTokens.length === 0) return true;

  // Check if all search tokens appear in target tokens in order
  let searchIndex = 0;
  for (const targetToken of targetTokens) {
    if (searchIndex >= searchTokens.length) break;

    if (targetToken.includes(searchTokens[searchIndex]) ||
      searchTokens[searchIndex].includes(targetToken)) {
      searchIndex++;
    }
  }

  return searchIndex === searchTokens.length;
}

// Calculate a flexible search score
function calculateSearchScore(searchTerm: string, targetName: string): number {
  const normalizeString = (str: string) =>
    str.toLowerCase().replace(/[/\-_]/g, ' ').replace(/\s+/g, ' ').trim();

  const normalizedSearch = normalizeString(searchTerm);
  const normalizedTarget = normalizeString(targetName);
  const targetLower = targetName.toLowerCase();
  const searchLower = searchTerm.toLowerCase();

  // Exact match (highest priority)
  if (targetLower === searchLower || normalizedTarget === normalizedSearch) {
    return 1000;
  }

  // Starts with (high priority)
  if (targetLower.startsWith(searchLower) || normalizedTarget.startsWith(normalizedSearch)) {
    return 500;
  }

  // Contains as substring (medium priority)
  if (targetLower.includes(searchLower) || normalizedTarget.includes(normalizedSearch)) {
    return 300;
  }

  // Token-based match (lower priority)
  return 100;
}

import { LibraryData } from './types';

export async function searchStylesAndVariables(
  searchTerm: string,
  bindingSupport: BindingSupport,
  libraryFunctions?: {
    getStoredLibraries: () => Promise<LibraryData>;
    getActiveLibraries: () => Promise<string[]>;
  }
): Promise<Array<string | { name: string; data: unknown }>> {
  // Handle instance properties separately
  if (bindingSupport.instanceProperties) {
    return await searchInstanceProperties(searchTerm);
  }

  const data = await getCachedStylesAndVariables();
  const results: Array<{ score: number, text: string, collection: string, name: string }> = [];

  // Search variables
  if (bindingSupport.variables) {
    const matchingVars = data.variables.filter(v =>
      bindingSupport.variables!.indexOf(v.type as VariableResolvedType) !== -1 &&
      flexibleMatch(searchTerm, v.name)
    );

    const localMatches = matchingVars.filter(v => !v.isLibrary).length;
    const libraryMatches = matchingVars.filter(v => v.isLibrary).length;

    if (matchingVars.length > 0) {
      console.log(`🔍 Found ${matchingVars.length} variables matching "${searchTerm}" (${localMatches} local, ${libraryMatches} library)`);
    }

    matchingVars.forEach(v => {
      const score = calculateSearchScore(searchTerm, v.name);
      const location = v.isLibrary ? 'Library' : 'Local';
      results.push({
        score,
        text: `${v.name} (${v.collection} - ${location})`,
        collection: v.collection,
        name: v.name
      });
    });
  }

  // Search paint styles
  if (bindingSupport.styles && bindingSupport.styles.indexOf('PAINT') !== -1) {
    const matchingStyles = data.paintStyles.filter(s =>
      flexibleMatch(searchTerm, s.name)
    );

    matchingStyles.forEach(s => {
      const score = calculateSearchScore(searchTerm, s.name);
      const location = s.isLocal ? 'Local' : 'Library';
      results.push({
        score,
        text: `${s.name} (${location})`,
        collection: location, // Use location as collection for styles
        name: s.name
      });
    });
  }

  // Search text styles
  if (bindingSupport.styles && bindingSupport.styles.indexOf('TEXT') !== -1) {
    const matchingStyles = data.textStyles.filter(s =>
      flexibleMatch(searchTerm, s.name)
    );

    matchingStyles.forEach(s => {
      const score = calculateSearchScore(searchTerm, s.name);
      const location = s.isLocal ? 'Local' : 'Library';
      results.push({
        score,
        text: `${s.name} (${location})`,
        collection: location, // Use location as collection for styles
        name: s.name
      });
    });
  }

  // Search library styles (from plugin storage)
  if (bindingSupport.libraryStyles && bindingSupport.styles && libraryFunctions) {
    const libraries = await libraryFunctions.getStoredLibraries();
    const activeLibraries = await libraryFunctions.getActiveLibraries();

    for (const libName of activeLibraries) {
      const items = libraries[libName] || [];

      // Filter items based on requested types
      const matchingItems = items.filter(item => {
        const [name, , type] = item;
        return bindingSupport.styles!.indexOf(type as unknown as StyleBindingType) !== -1 && flexibleMatch(searchTerm, name);
      });

      matchingItems.forEach(item => {
        const [name] = item;
        const score = calculateSearchScore(searchTerm, name);
        results.push({
          score,
          text: `${name} (${libName})`,
          collection: libName,
          name: name
        });
      });
    }
  }

  // Sort by score first (highest to lowest), then by collection, then by name
  return results
    .sort((a, b) => {
      // First, sort by score (descending)
      if (a.score !== b.score) return b.score - a.score;

      // Then, sort by collection name
      const collectionCompare = a.collection.localeCompare(b.collection);
      if (collectionCompare !== 0) return collectionCompare;

      // Finally, sort alphabetically by name with natural number sorting
      return naturalSort(a.name, b.name);
    })
    .slice(0, 20)
    .map(r => r.text);
}

// ================
// Resolution Function
// ================

export async function resolvePaintValue(rawValue: string): Promise<PaintResolution> {
  const cleanValue = rawValue.trim();

  // Check if this is a style/variable reference by pattern
  // Variables have format: "Name (Collection - Location)" (contains " - " in parentheses)
  // Styles have format: "Name (Location)" (single word in parentheses)
  const bindingMatch = cleanValue.match(/^(.+?)\s*\(([^)]+)\)$/);

  if (bindingMatch) {
    const name = bindingMatch[1].trim();
    const metadata = bindingMatch[2];

    const data = await getCachedStylesAndVariables();

    // Check if it's a variable (contains " - " in metadata)
    if (metadata.includes(' - ')) {
      // Variable reference
      const varData = data.variables.find(v => v.name === name);

      if (!varData) {
        figma.notify(`Variable "${name}" not found, skipping...`);
        throw new Error(`Variable not found: ${name}`);
      }

      return {
        type: 'variable',
        variableId: varData.id,
        variableName: varData.name,
        isLibraryVariable: varData.isLibrary
      };
    } else {
      // Style reference
      const styleData = data.paintStyles.find(s => s.name === name);

      if (!styleData) {
        figma.notify(`Style "${name}" not found, skipping...`);
        throw new Error(`Style not found: ${name}`);
      }

      // Lazy import if it's a library style
      if (!styleData.isLocal && styleData.key) {
        try {
          await figma.importStyleByKeyAsync(styleData.key);
        } catch (e) {
          console.error("Failed to import style:", e);
          throw new Error(`Failed to import library style: ${name}`);
        }
      }

      return {
        type: 'style',
        styleKey: styleData.key
      };
    }
  }

  // Literal hex color
  const hexMatch = cleanValue.match(/#?([0-9a-fA-F]{3,6})/);
  if (!hexMatch) {
    throw new Error(`Invalid color format: ${cleanValue}`);
  }

  let hex = hexMatch[1];
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }

  if (hex.length !== 6) {
    throw new Error(`Invalid hex color: ${cleanValue}`);
  }

  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  return {
    type: 'literal',
    color: { r, g, b }
  };
}

