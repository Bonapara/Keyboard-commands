import { BindingSupport, Command, PaintResolution, StyleResolution, NumberResolution, StyleBindingType, ValueFormat, VariableResolvedType, SpecialCondition } from './types';
import { getStoredLibraries } from './storage';
import { COMMANDS, CommandName } from './commands';
import {
  COMMAND_SPLITTER_REGEX,
  COMMAND_BREAK_PATTERN,
  COMMAND_PART_REGEX,
  VALUE_FORMAT_REGEX,
  CACHE_DURATION
} from './constants';
import { searchInstanceProperties } from './implementations/instance';
import { searchSelectionColors } from './implementations/colors';

export { COMMAND_SPLITTER_REGEX, COMMAND_BREAK_PATTERN, COMMAND_PART_REGEX, VALUE_FORMAT_REGEX };

export type BindableField =
  | 'itemSpacing'
  | 'counterAxisSpacing'
  | 'paddingLeft'
  | 'paddingRight'
  | 'paddingTop'
  | 'paddingBottom'
  | 'strokeWeight'
  | 'strokeTopWeight'
  | 'strokeRightWeight'
  | 'strokeBottomWeight'
  | 'strokeLeftWeight'
  | 'opacity'
  | 'minWidth'
  | 'maxWidth'
  | 'minHeight'
  | 'maxHeight'
  | 'gridRowGap'
  | 'gridColumnGap'
  | 'letterSpacing'
  | 'lineHeight'
  | 'paragraphSpacing'
  | 'paragraphIndent';

type VariableBindableNodeLike = SceneNode & {
  setBoundVariable?: (field: BindableField, variable: Variable | null) => void;
};

export function setNodeBoundVariable(node: SceneNode, field: BindableField, variable: Variable | null): void {
  (node as VariableBindableNodeLike).setBoundVariable?.(field, variable);
}

export function clearNodeBoundVariables(node: SceneNode, ...fields: BindableField[]): void {
  for (const field of fields) {
    setNodeBoundVariable(node, field, null);
  }
}

// ================================
// Command Index for O(1) Lookups
// ================================

type CommandWithName = Command & { name: CommandName };

// Pre-built indexes for fast command lookups (built lazily on first use)
let aliasToCommand: Map<string, CommandWithName> | null = null;
let nameToCommand: Map<string, CommandWithName> | null = null;
let allAliasesByCommand: Map<string, string[]> | null = null;
let indexBuilt = false;

// Build the index lazily on first use to avoid circular dependency issues
function ensureCommandIndex() {
  if (indexBuilt) return;

  aliasToCommand = new Map<string, CommandWithName>();
  nameToCommand = new Map<string, CommandWithName>();
  allAliasesByCommand = new Map<string, string[]>();

  for (const cmd of COMMANDS) {
    // Index by name (lowercase)
    nameToCommand.set(cmd.name.toLowerCase(), cmd);

    // Index by each alias (lowercase)
    const aliases = Array.isArray(cmd.alias) ? cmd.alias : [cmd.alias];
    allAliasesByCommand.set(cmd.name, aliases);
    for (const alias of aliases) {
      aliasToCommand.set(alias.toLowerCase(), cmd);
    }
  }

  indexBuilt = true;
}

export function notify(message: string, options?: NotificationOptions) {
  figma.notify(message, options);
}

export function checkSpecialConditions(node: SceneNode, conditions: SpecialCondition[]): boolean {
  if (!conditions || conditions.length === 0) return true;

  return conditions.some(condition => {
    switch (condition) {
      case 'IsAutoLayout':
        return 'layoutMode' in node &&
          (node.layoutMode === 'HORIZONTAL' || node.layoutMode === 'VERTICAL');
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
      case 'HasParent':
        return !!node.parent;
      case 'HasLayoutGrid':
        return 'layoutGrids' in node && node.layoutGrids.length > 0;
      case 'HasRowsOrColumnsLayoutGrid':
        return 'layoutGrids' in node && node.layoutGrids.some(grid =>
          grid.pattern === 'COLUMNS' || grid.pattern === 'ROWS'
        );
      case 'IsAutoLayoutWrap':
        return 'layoutMode' in node && node.layoutMode !== 'NONE' && 'layoutWrap' in node && node.layoutWrap === 'WRAP';
      case 'IsGridLayout':
        return 'layoutMode' in node && node.layoutMode === 'GRID';
      case 'HasInferredAutoLayout':
        return node.type === 'FRAME' && node.inferredAutoLayout != null;
      case 'HasInferredAutoLayoutWrap':
        return node.type === 'FRAME' &&
          node.inferredAutoLayout != null &&
          node.inferredAutoLayout.layoutWrap === 'WRAP';
      default:
        return false;
    }
  });
}

export interface SelectionAvailabilityContext {
  selection: readonly SceneNode[];
  selectedNodeTypes: Set<SceneNode['type']> | null;
  specialConditionResults: Map<string, boolean>;
  selectionPredicateResults: Map<NonNullable<Command['selectionPredicate']>, boolean>;
}

export function createSelectionAvailabilityContext(selection: readonly SceneNode[]): SelectionAvailabilityContext {
  return {
    selection,
    selectedNodeTypes: null,
    specialConditionResults: new Map(),
    selectionPredicateResults: new Map()
  };
}

function getSelectedNodeTypes(context: SelectionAvailabilityContext): Set<SceneNode['type']> {
  if (!context.selectedNodeTypes) {
    context.selectedNodeTypes = new Set(context.selection.map(node => node.type));
  }

  return context.selectedNodeTypes;
}

function matchesSupportedNodeTypes(cmd: Command, context: SelectionAvailabilityContext): boolean {
  if (!cmd.supportedNodes) return true;

  const selectedNodeTypes = getSelectedNodeTypes(context);
  for (const nodeType of selectedNodeTypes) {
    if (cmd.supportedNodes.indexOf(nodeType) === -1) return false;
  }

  return true;
}

function getSpecialConditionKey(conditions: SpecialCondition[]): string {
  return conditions.join('\x1f');
}

function meetsSpecialConditions(cmd: Command, context: SelectionAvailabilityContext): boolean {
  if (!cmd.specialConditions) return true;

  const cacheKey = getSpecialConditionKey(cmd.specialConditions);
  const cached = context.specialConditionResults.get(cacheKey);
  if (cached !== undefined) return cached;

  const result = context.selection.every(node =>
    checkSpecialConditions(node, cmd.specialConditions!)
  );
  context.specialConditionResults.set(cacheKey, result);
  return result;
}

function matchesSelectionPredicate(cmd: Command, context: SelectionAvailabilityContext): boolean {
  if (!cmd.selectionPredicate) return true;

  const cached = context.selectionPredicateResults.get(cmd.selectionPredicate);
  if (cached !== undefined) return cached;

  const result = cmd.selectionPredicate(context.selection);
  context.selectionPredicateResults.set(cmd.selectionPredicate, result);
  return result;
}

export function isCommandAvailableForSelectionWithContext(
  cmd: Command,
  context: SelectionAvailabilityContext
): boolean {
  if (!cmd.supportedNodes && !cmd.specialConditions && cmd.selectionCount === undefined && !cmd.selectionPredicate) {
    return true;
  }
  if (context.selection.length === 0) return true;

  const matchesSelectionCount = cmd.selectionCount === undefined || context.selection.length === cmd.selectionCount;

  return (
    matchesSelectionCount &&
    matchesSupportedNodeTypes(cmd, context) &&
    meetsSpecialConditions(cmd, context) &&
    matchesSelectionPredicate(cmd, context)
  );
}

// Helper function to check if command supports current selection
export function isCommandAvailableForSelection(cmd: Command, selection: readonly SceneNode[]): boolean {
  return isCommandAvailableForSelectionWithContext(
    cmd,
    createSelectionAvailabilityContext(selection)
  );
}

export function findCommand(
  part: string,
  availabilityContext: SelectionAvailabilityContext = createSelectionAvailabilityContext(figma.currentPage.selection)
): Array<Command & { name: CommandName }> {
  // Ensure command index is built (lazy initialization)
  ensureCommandIndex();

  const commandPart = part.match(COMMAND_PART_REGEX)?.[0];

  if (!commandPart) {
    return [];
  }

  const cmdLower = commandPart.toLowerCase();

  // O(1) lookup: Check for exact alias match first
  const exactMatch = aliasToCommand!.get(cmdLower);
  if (exactMatch) {
    return isCommandAvailableForSelectionWithContext(exactMatch, availabilityContext) ? [exactMatch] : [];
  }

  // O(1) lookup: Check for exact name match
  const nameMatch = nameToCommand!.get(cmdLower);
  if (nameMatch) {
    return isCommandAvailableForSelectionWithContext(nameMatch, availabilityContext) ? [nameMatch] : [];
  }

  // Fallback to prefix/contains search only when no exact match
  // This is still O(n) but only runs for partial matches during typing
  const startsWithMatches: CommandWithName[] = [];
  const containsMatches: CommandWithName[] = [];

  for (const cmd of COMMANDS) {
    const nameLower = cmd.name.toLowerCase();
    const aliases = allAliasesByCommand!.get(cmd.name) || [];

    // Check if name or any alias starts with the search term
    if (nameLower.startsWith(cmdLower) ||
      aliases.some(alias => alias.toLowerCase().startsWith(cmdLower))) {
      if (!isCommandAvailableForSelectionWithContext(cmd, availabilityContext)) continue;
      startsWithMatches.push(cmd);
    }
    // If not starting with, check if it contains the term
    else if (nameLower.includes(cmdLower) ||
      aliases.some(alias => alias.toLowerCase().includes(cmdLower))) {
      if (!isCommandAvailableForSelectionWithContext(cmd, availabilityContext)) continue;
      containsMatches.push(cmd);
    }
  }

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

export function getCommandSuggestions(
  commands: Array<Command & { name: CommandName }>,
  searchTerm: string = '',
  excludeCommand?: Command,
  includeSuggestion: boolean = false,
  previousCommands: Record<string, string> = {},
  availabilityContext: SelectionAvailabilityContext = createSelectionAvailabilityContext(figma.currentPage.selection)
) {
  const lowerSearch = searchTerm.toLowerCase();
  const filteredCommands = commands.filter(cmd => {
    // Exclude the specific command (so it doesn't show up as a "related" suggestion to itself)
    if (excludeCommand && cmd.name === excludeCommand.name) return false;

    // If the user typed nothing (searchTerm is empty):
    // - For the initial top-level suggestions, we return all commands.
    // - For "related" suggestions (excludeCommand is set), we don't return everything
    //   (otherwise you'd see random commands that have nothing to do with the matched command).
    if (!searchTerm) {
      return !excludeCommand && isCommandAvailableForSelectionWithContext(cmd, availabilityContext);
    }

    // Otherwise, normal search filtering
    const matchesSearch =
      cmd.name.toLowerCase().startsWith(lowerSearch) ||
      cmd.name.toLowerCase().includes(lowerSearch) ||
      cmd.alias.some(alias =>
        alias.toLowerCase().startsWith(lowerSearch) ||
        alias.toLowerCase().includes(lowerSearch)
      );

    return matchesSearch && isCommandAvailableForSelectionWithContext(cmd, availabilityContext);
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

  return sortedCommands.map((cmd, index) => {
    const previousValue = previousCommands[cmd.name];
    let infoText = '';

    if (previousValue !== undefined) {
      // If we previously set this command
      infoText =
        cmd.type === 'commandWithoutValue'
          ? 'already set'
          : `already set to '${previousValue}'`;
    } else if (includeSuggestion && index === 0) {
      // If this is the top suggestion, show the command's built-in suggestion (if any)
      infoText = cmd.suggestion || '';
    }

    const separator = infoText ? ' -- ' : '';
    return `${cmd.alias.join(', ')} · ${cmd.name}${separator}${infoText}`;
  });
}

export interface DeltaSpec {
  op: '+' | '-' | '*' | '/';
  amount: number;
}

const DELTA_REGEX = /^([+\-*/])(-?\d+(?:\.\d+)?)$/;

// Parses a value string of the form "+10", "-20", "*2", "/2".
// Returns null if the value isn't a delta expression.
export function parseDelta(value: string): DeltaSpec | null {
  const m = value.match(DELTA_REGEX);
  if (!m) return null;
  return { op: m[1] as DeltaSpec['op'], amount: Number(m[2]) };
}

export function applyDelta(current: number, spec: DeltaSpec): number {
  switch (spec.op) {
    case '+': return current + spec.amount;
    case '-': return current - spec.amount;
    case '*': return current * spec.amount;
    case '/': return current / spec.amount;
  }
}

// Resolves a value string against a per-node current value.
// If the value is a delta (e.g. "+10"), applies it to `current`.
// Otherwise, returns Number(value) — the absolute interpretation.
export function resolveDelta(value: string, current: number): number {
  const spec = parseDelta(value);
  if (spec) return applyDelta(current, spec);
  return Number(value);
}

// Parses a comma-separated list of values: "20,30,40,50" → ["20", "30", "40", "50"].
// Returns a single-element array when there are no commas.
export function parseNumberList(value: string): string[] {
  return value.split(',').map(v => v.trim()).filter(v => v.length > 0);
}

export function extractValue(text: string, format: ValueFormat): string | null {
  // Detect "<alias><op><number>" delta form (e.g. "w+10", "h-20", "p*2", "ro+15").
  // Numeric commands that opt in via resolveDelta() will read the per-node
  // current value and apply the operator. Commands that don't opt in fall
  // back to Number(), which silently ignores leading "+" and treats "-N" as
  // a negative absolute (matching prior behavior).
  if (format === 'number') {
    const deltaMatch = text.match(/^[\p{L}][\p{L}-]*\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)\s*$/u);
    if (deltaMatch) {
      return `${deltaMatch[1]}${deltaMatch[2]}`;
    }

    // Detect "<alias><n>,<n>(,<n>)*" comma-separated list (e.g. "p20,30",
    // "r10,20,30,40"). Returned as the raw "20,30" string so multi-value
    // commands can split it via parseNumberList().
    const listMatch = text.match(/^[\p{L}][\p{L}-]*\s*(-?\d+(?:\.\d+)?(?:,-?\d+(?:\.\d+)?)+)\s*$/u);
    if (listMatch) {
      return listMatch[1];
    }
  }

  // Check for selection colors format with : delimiter: "source : target".
  // Must be preserved as-is for the swapSelectionColors command.
  if (text.includes(':')) {
    // Extract everything after the command part
    const parts = text.split(' ');
    // Find the first part that contains :, join from there
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].includes(':') || (i > 0 && parts.slice(i).join(' ').includes(':'))) {
        const result = parts.slice(i).join(' ');
        return result;
      }
    }
    const delimiterIndex = text.indexOf(':');
    if (delimiterIndex > 0) {
      return text;
    }
  }

  // Check for JSON value format: "command {json...}" or "command -> format"
  // This handles instance override references and similar JSON data
  const jsonMatch = text.match(/^([a-z]+)\s+(\{.+\}|\S+\s*->\s*.+)$/i);
  if (jsonMatch) {
    // Format: "rio {json}" or "rio NodeName -> Field" -> extract the value part
    return text.substring(text.indexOf(' ') + 1).trim();
  }

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

interface VariableCacheEntry {
  id: string;
  name: string;
  type: string;
  collection: string;
  isLibrary: boolean;
  color?: RGB;
  _rawColorValue?: unknown; // For lazy color resolution
}

interface StyleVariableCache {
  paintStyles: Array<{ name: string, key: string, isLocal: boolean, color?: RGB, imageHash?: string }>;
  textStyles: Array<{ name: string, key: string, isLocal: boolean }>;
  effectStyles: Array<{ name: string, key: string, isLocal: boolean }>;
  gridStyles: Array<{ name: string, key: string, isLocal: boolean }>;
  variables: Array<VariableCacheEntry>;
  timestamp: number;
}

let cache: StyleVariableCache | null = null;

// Lazy color resolution for variables - only resolve when displaying suggestions
async function resolveVariableColor(variable: VariableCacheEntry): Promise<RGB | undefined> {
  // Already resolved
  if (variable.color) return variable.color;

  // Not a color variable
  if (variable.type !== 'COLOR' || !variable._rawColorValue) return undefined;

  let value = variable._rawColorValue;

  // Resolve VARIABLE_ALIAS by following the reference chain
  let attempts = 0;
  while (value && typeof value === 'object' && 'type' in value && (value as { type: string }).type === 'VARIABLE_ALIAS' && attempts < 10) {
    attempts++;
    const aliasId = (value as VariableAlias).id;
    try {
      const aliasedVar = await figma.variables.getVariableByIdAsync(aliasId);
      if (aliasedVar && aliasedVar.resolvedType === 'COLOR' && aliasedVar.valuesByMode) {
        const modeKeys = Object.keys(aliasedVar.valuesByMode);
        if (modeKeys.length > 0) {
          value = aliasedVar.valuesByMode[modeKeys[0]];
        } else {
          break;
        }
      } else {
        break;
      }
    } catch {
      break;
    }
  }

  // Extract RGB if we have a color value
  if (value && typeof value === 'object' && 'r' in value && 'g' in value && 'b' in value) {
    variable.color = value as RGB;
    return variable.color;
  }

  return undefined;
}

function createColorSwatchSVG(color: RGB | string): string {
  let hexColor: string;

  if (typeof color === 'string') {
    hexColor = color.startsWith('#') ? color : `#${color}`;
  } else {
    // Convert RGB (0-1 range) to hex
    const toHex = (n: number): string => {
      const hex = Math.round(n * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    hexColor = `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
  }

  return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="16" height="16" fill="white"/>
  <rect x="1" y="1" width="14" height="14" fill="${hexColor}"/>
  <rect x="0.5" y="0.5" width="15" height="15" stroke="#00000033" stroke-opacity="0.2"/>
</svg>`;
}

const IMAGE_STYLE_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="16" height="16" fill="#f5f5f5"/>
  <rect x="2" y="3" width="12" height="10" rx="1" fill="#e0e0e0"/>
  <circle cx="5" cy="6" r="1.5" fill="#bdbdbd"/>
  <path d="M2 11L5.5 8L8 10L11 7L14 11V12C14 12.5523 13.5523 13 13 13H3C2.44772 13 2 12.5523 2 12V11Z" fill="#bdbdbd"/>
  <rect x="0.5" y="0.5" width="15" height="15" stroke="#00000033" stroke-opacity="0.2"/>
</svg>`;

function getImageStyleIcon(): string {
  return IMAGE_STYLE_ICON;
}

export async function getCachedStylesAndVariables(): Promise<StyleVariableCache> {
  if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
    return cache;
  }

  // Fetch all styles and variables in parallel for faster loading
  const [
    localPaintStyles,
    localTextStyles,
    localEffectStyles,
    localGridStyles,
    allVariables,
    collections
  ] = await Promise.all([
    figma.getLocalPaintStylesAsync(),
    figma.getLocalTextStylesAsync(),
    figma.getLocalEffectStylesAsync(),
    figma.getLocalGridStylesAsync(),
    figma.variables.getLocalVariablesAsync(),
    figma.variables.getLocalVariableCollectionsAsync()
  ]);

  const paintStylesData = (localPaintStyles || []).map(s => {
    let color: RGB | undefined;
    let imageHash: string | undefined;

    const paints = s.paints || [];
    for (const paint of paints) {
      if (paint.visible === false) continue;

      if (paint.type === 'SOLID') {
        color = paint.color;
        break;
      } else if (paint.type === 'GRADIENT_LINEAR' || paint.type === 'GRADIENT_RADIAL' || paint.type === 'GRADIENT_ANGULAR' || paint.type === 'GRADIENT_DIAMOND') {
        if (paint.gradientStops && paint.gradientStops.length > 0) {
          color = paint.gradientStops[0].color;
          break;
        }
      } else if (paint.type === 'IMAGE') {
        const imagePaint = paint as ImagePaint;
        if (imagePaint.imageHash) {
          imageHash = imagePaint.imageHash;
          break;
        }
      }
    }

    return {
      name: s.name,
      key: s.key,
      isLocal: !s.remote,
      color,
      imageHash
    };
  });

  // Process text styles (with defensive check)
  const textStylesData = (localTextStyles || []).map(s => ({
    name: s.name,
    key: s.key,
    isLocal: !s.remote
  }));

  // Process effect styles (with defensive check)
  const effectStylesData = (localEffectStyles || []).map(s => ({
    name: s.name,
    key: s.key,
    isLocal: !s.remote
  }));

  // Process grid styles (with defensive check)
  const gridStylesData = (localGridStyles || []).map(s => ({
    name: s.name,
    key: s.key,
    isLocal: !s.remote
  }));

  // Build collection map for variable lookups (with defensive check)
  const collectionMap = new Map((collections || []).map(c => [c.id, c.name]));

  // Process variables - defer color resolution to display time (lazy)
  // Only store basic metadata here, resolve colors when needed for suggestions
  const variablesData = (allVariables || []).map(v => {
    // Safely get raw color value
    let rawColorValue: unknown = undefined;
    if (v.resolvedType === 'COLOR' && v.valuesByMode) {
      const modeKeys = Object.keys(v.valuesByMode);
      if (modeKeys.length > 0) {
        rawColorValue = v.valuesByMode[modeKeys[0]];
      }
    }

    return {
      id: v.id,
      name: v.name,
      type: v.resolvedType,
      collection: collectionMap.get(v.variableCollectionId) || 'Unknown',
      isLibrary: false,
      color: undefined as RGB | undefined,
      _rawColorValue: rawColorValue
    };
  });

  cache = {
    paintStyles: paintStylesData,
    textStyles: textStylesData,
    effectStyles: effectStylesData,
    gridStyles: gridStylesData,
    variables: variablesData,
    timestamp: Date.now()
  };

  return cache;
}

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

function normalizeSearchTerm(value: string): string {
  return value
    .toLowerCase()
    .replace(/[/\-_]/g, ' ')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactSearchTerm(value: string): string {
  return normalizeSearchTerm(value).replace(/\s+/g, '');
}

function tokenizeSearchTerm(value: string): string[] {
  return normalizeSearchTerm(value).split(' ').filter(Boolean);
}

interface TokenMatchAnalysis {
  matched: boolean;
  contiguous: boolean;
  gaps: number;
  startIndex: number;
  exactMatches: number;
  prefixMatches: number;
}

function analyzeTokenMatch(searchTerm: string, targetName: string): TokenMatchAnalysis {
  const searchTokens = tokenizeSearchTerm(searchTerm);
  const targetTokens = tokenizeSearchTerm(targetName);

  if (searchTokens.length === 0) {
    return {
      matched: true,
      contiguous: true,
      gaps: 0,
      startIndex: 0,
      exactMatches: 0,
      prefixMatches: 0
    };
  }

  const matchedIndices: number[] = [];
  let searchIndex = 0;
  let exactMatches = 0;
  let prefixMatches = 0;

  for (let targetIndex = 0; targetIndex < targetTokens.length; targetIndex++) {
    if (searchIndex >= searchTokens.length) break;

    const targetToken = targetTokens[targetIndex];
    const searchToken = searchTokens[searchIndex];

    if (!targetToken.includes(searchToken)) {
      continue;
    }

    matchedIndices.push(targetIndex);

    if (targetToken === searchToken) {
      exactMatches++;
    }

    if (targetToken.startsWith(searchToken)) {
      prefixMatches++;
    }

    searchIndex++;
  }

  if (searchIndex !== searchTokens.length) {
    return {
      matched: false,
      contiguous: false,
      gaps: Number.MAX_SAFE_INTEGER,
      startIndex: Number.MAX_SAFE_INTEGER,
      exactMatches: 0,
      prefixMatches: 0
    };
  }

  let gaps = 0;
  for (let i = 1; i < matchedIndices.length; i++) {
    gaps += matchedIndices[i] - matchedIndices[i - 1] - 1;
  }

  return {
    matched: true,
    contiguous: gaps === 0,
    gaps,
    startIndex: matchedIndices[0] ?? 0,
    exactMatches,
    prefixMatches
  };
}

function flexibleMatch(searchTerm: string, targetName: string): boolean {
  const normalizedSearch = normalizeSearchTerm(searchTerm);
  if (!normalizedSearch) return true;

  const normalizedTarget = normalizeSearchTerm(targetName);
  if (normalizedTarget.includes(normalizedSearch)) {
    return true;
  }

  const compactSearch = compactSearchTerm(searchTerm);
  const compactTarget = compactSearchTerm(targetName);
  if (compactSearch && compactTarget.includes(compactSearch)) {
    return true;
  }

  return analyzeTokenMatch(searchTerm, targetName).matched;
}

function calculateSearchScore(searchTerm: string, targetName: string): number {
  if (!searchTerm || searchTerm.trim() === '') {
    return 100;
  }

  const normalizedSearch = normalizeSearchTerm(searchTerm);
  const normalizedTarget = normalizeSearchTerm(targetName);
  const compactSearch = compactSearchTerm(searchTerm);
  const compactTarget = compactSearchTerm(targetName);
  const searchTokens = tokenizeSearchTerm(searchTerm);
  const tokenMatch = analyzeTokenMatch(searchTerm, targetName);
  const targetLower = targetName.toLowerCase();
  const searchLower = searchTerm.toLowerCase();

  // Exact match (highest priority)
  if (
    targetLower === searchLower ||
    normalizedTarget === normalizedSearch ||
    compactTarget === compactSearch
  ) {
    return 1200;
  }

  let score = 100;

  if (tokenMatch.matched) {
    score += 280;
    score += tokenMatch.exactMatches * 120;
    score += tokenMatch.prefixMatches * 30;
    score -= tokenMatch.gaps * 45;
    score -= tokenMatch.startIndex * 15;

    if (tokenMatch.contiguous) {
      score += searchTokens.length > 1 ? 280 : 220;
    }
  }

  // Starts with (high priority)
  if (
    targetLower.startsWith(searchLower) ||
    normalizedTarget.startsWith(normalizedSearch) ||
    compactTarget.startsWith(compactSearch)
  ) {
    score = Math.max(score, 820);
  }

  // Contains as substring (medium priority)
  if (
    targetLower.includes(searchLower) ||
    normalizedTarget.includes(normalizedSearch) ||
    compactTarget.includes(compactSearch)
  ) {
    score = Math.max(score, 620);
  }

  return score;
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
  // Handle selection colors with two-stage search
  if (bindingSupport.selectionColors) {
    const delimiterIndex = searchTerm.indexOf(':');

    if (delimiterIndex === -1) {
      // Stage 1: Show colors from selection
      return await searchSelectionColors(searchTerm);
    } else {
      // Stage 2: Show replacement options (styles/variables)
      const targetSearch = searchTerm.slice(delimiterIndex + 1).trim();
      // Continue with normal search using targetSearch
      searchTerm = targetSearch;
    }
  }

  // Handle instance properties separately
  if (bindingSupport.instanceProperties) {
    return await searchInstanceProperties(searchTerm);
  }

  const data = await getCachedStylesAndVariables();

  interface SearchResult {
    score: number;
    text: string;
    collection: string;
    name: string;
    color?: RGB;
    hexColor?: string;
    imageHash?: string; // For image fill styles
    variableEntry?: VariableCacheEntry; // Reference for lazy color resolution
  }

  // Use a Map to automatically handle deduplication by name
  // Library items (processed last) will overwrite API items, ensuring we keep the one with the icon
  const resultsMap = new Map<string, SearchResult>();

  // Search variables
  if (bindingSupport.variables) {
    const matchingVars = data.variables.filter(v =>
      bindingSupport.variables!.indexOf(v.type as VariableResolvedType) !== -1 &&
      flexibleMatch(searchTerm, v.name)
    );

    matchingVars.forEach(v => {
      const score = calculateSearchScore(searchTerm, v.name);
      const location = v.isLibrary ? 'Library' : 'Local';
      resultsMap.set(v.name, {
        score,
        text: `${v.name} (${v.collection} - ${location})`,
        collection: v.collection,
        name: v.name,
        color: v.color,
        variableEntry: v // Store reference for lazy color resolution
      });
    });
  }

  // Search styles using data-driven approach
  const styleConfigs: Array<{
    key: 'paintStyles' | 'textStyles' | 'effectStyles' | 'gridStyles';
    bindingKey: StyleBindingType;
  }> = [
      { key: 'paintStyles', bindingKey: 'PAINT' },
      { key: 'textStyles', bindingKey: 'TEXT' },
      { key: 'effectStyles', bindingKey: 'EFFECT' },
      { key: 'gridStyles', bindingKey: 'GRID' },
    ];

  for (const { key, bindingKey } of styleConfigs) {
    if (!bindingSupport.styles?.includes(bindingKey)) continue;

    data[key]
      .filter(s => flexibleMatch(searchTerm, s.name))
      .forEach(s => {
        const location = s.isLocal ? 'Local' : 'Library';

        const imageHashValue = 'imageHash' in s ? (s as { imageHash?: string }).imageHash : undefined;
        resultsMap.set(s.name, {
          score: calculateSearchScore(searchTerm, s.name),
          text: `${s.name} (${location})`,
          collection: location,
          name: s.name,
          color: 'color' in s ? (s as { color?: RGB }).color : undefined,
          imageHash: imageHashValue
        });
      });
  }

  // Search library styles (from plugin storage)
  if (bindingSupport.libraryStyles && (bindingSupport.styles || bindingSupport.variables) && libraryFunctions) {
    const libraries = await libraryFunctions.getStoredLibraries();
    const activeLibraries = await libraryFunctions.getActiveLibraries();

    for (const libName of activeLibraries) {
      const items = libraries[libName] || [];

      // Filter items based on requested types
      const matchingItems = items.filter(item => {
        const [name, , type] = item;

        // Check if type matches requested styles
        const isStyleMatch = bindingSupport.styles && bindingSupport.styles.indexOf(type as unknown as StyleBindingType) !== -1;

        // Check if type matches requested variables
        let isVariableMatch = false;
        if (type.startsWith('VARIABLE_') && bindingSupport.variables) {
          const varType = type.replace('VARIABLE_', '') as VariableResolvedType;
          isVariableMatch = bindingSupport.variables.indexOf(varType) !== -1;
        } else if ((type as string) === 'VARIABLE' && bindingSupport.variables?.length) {
          // Legacy support
          const wantsColor = bindingSupport.variables.indexOf('COLOR') !== -1;
          const wantsOthers = bindingSupport.variables.some(v => v !== 'COLOR');
          const hasColor = !!item[3];

          if (wantsColor && !wantsOthers) {
            isVariableMatch = hasColor;
          } else if (!wantsColor && wantsOthers) {
            isVariableMatch = !hasColor;
          } else {
            isVariableMatch = true;
          }
        }

        return (isStyleMatch || isVariableMatch) && flexibleMatch(searchTerm, name);
      });

      matchingItems.forEach(item => {
        const [name, , itemType, colorOrImageRef] = item;

        const score = calculateSearchScore(searchTerm, name);

        // Format text: Only add " - Library" for variables so resolvePaintValue detects them as variables
        const isVariable = itemType.startsWith('VARIABLE');
        const text = isVariable ? `${name} (${libName} - Library)` : `${name} (${libName})`;

        let hexColor: string | undefined;
        let imageHash: string | undefined;

        if (colorOrImageRef?.startsWith('IMAGE:')) {
          imageHash = colorOrImageRef.substring(6);
        } else {
          hexColor = colorOrImageRef;
        }

        const existing = resultsMap.get(name);
        const finalImageHash = imageHash || existing?.imageHash;

        resultsMap.set(name, {
          score,
          text,
          collection: libName,
          name: name,
          hexColor,
          imageHash: finalImageHash
        });
      });
    }
  }

  // Sort by score first (highest to lowest), then by collection, then by name
  const sortedResults = Array.from(resultsMap.values())
    .sort((a, b) => {
      // First, sort by score (descending)
      if (a.score !== b.score) return b.score - a.score;

      // Then, sort by collection name
      const collectionCompare = a.collection.localeCompare(b.collection);
      if (collectionCompare !== 0) return collectionCompare;

      // Finally, sort alphabetically by name with natural number sorting
      return naturalSort(a.name, b.name);
    })
    .slice(0, 20);

  // Lazy color/image resolution: Only resolve for the final 20 results
  // This avoids resolving colors/images for hundreds of items that won't be displayed
  const finalResults = await Promise.all(sortedResults.map(async r => {
    const hexColor = r.hexColor;

    if (hexColor) {
      return {
        name: r.text,
        data: r.text,
        icon: createColorSwatchSVG(hexColor)
      };
    }

    if (r.imageHash) {
      return {
        name: r.text,
        data: r.text,
        icon: getImageStyleIcon()
      };
    }

    // Lazy resolve variable color if needed
    let color = r.color;
    if (!color && r.variableEntry) {
      color = await resolveVariableColor(r.variableEntry);
    }

    if (color) {
      return {
        name: r.text,
        data: r.text,
        icon: createColorSwatchSVG(color)
      };
    }
    return r.text;
  }));

  return finalResults;
}

// ================================
// Unified Value Resolution Helpers
// ================================

const BINDING_REFERENCE_PATTERN = /^(.+?)\s*\(([^)]+)\)$/;
const STYLE_TYPES: StyleBindingType[] = ['PAINT', 'TEXT', 'EFFECT', 'GRID'];

interface VariableLookupConfig {
  typeFilter: (type: string) => boolean;
}

async function lookupVariable(
  name: string,
  config: VariableLookupConfig
): Promise<{ variableId: string; variableName: string; isLibraryVariable: boolean } | null> {
  const data = await getCachedStylesAndVariables();
  const varData = data.variables.find(v => v.name === name);

  if (varData) {
    return { variableId: varData.id, variableName: varData.name, isLibraryVariable: varData.isLibrary };
  }

  // Fallback: Check stored libraries
  try {
    const libraries = await getStoredLibraries();
    for (const libName of Object.keys(libraries)) {
      const foundItem = libraries[libName].find(i => i[0] === name && config.typeFilter(i[2]));
      if (foundItem) {
        return { variableId: foundItem[1], variableName: foundItem[0], isLibraryVariable: true };
      }
    }
  } catch (e) {
    console.warn('Failed to search stored libraries:', e);
  }

  return null;
}

async function lookupStyle(
  name: string,
  allowedTypes: StyleBindingType[]
): Promise<{ styleKey: string; styleType?: StyleBindingType } | null> {
  const data = await getCachedStylesAndVariables();

  // Search through style types in order
  const styleConfigs: Array<{ styles: typeof data.paintStyles; type: StyleBindingType }> = [
    { styles: data.paintStyles, type: 'PAINT' },
    { styles: data.textStyles, type: 'TEXT' },
    { styles: data.effectStyles, type: 'EFFECT' },
    { styles: data.gridStyles, type: 'GRID' },
  ];

  for (const { styles, type } of styleConfigs) {
    if (!allowedTypes.includes(type)) continue;
    const found = styles.find(s => s.name === name);
    if (found) {
      // Lazy import if it's a library style
      if (!found.isLocal && found.key) {
        await figma.importStyleByKeyAsync(found.key).catch(() => {
          throw new Error(`Failed to import library style: ${name}`);
        });
      }
      return { styleKey: found.key, styleType: type };
    }
  }

  // Fallback: Check stored libraries for unimported styles
  try {
    const libraries = await getStoredLibraries();
    for (const libName of Object.keys(libraries)) {
      const foundItem = libraries[libName].find(i => i[0] === name && allowedTypes.includes(i[2] as StyleBindingType));
      if (foundItem) {
        await figma.importStyleByKeyAsync(foundItem[1]).catch(() => {
          throw new Error(`Failed to import library style: ${name}`);
        });
        return { styleKey: foundItem[1], styleType: foundItem[2] as StyleBindingType };
      }
    }
  } catch (e) {
    console.warn('Failed to search stored libraries for style:', e);
  }

  return null;
}

function parseHexColor(value: string): RGB | null {
  const hexMatch = value.match(/#?([0-9a-fA-F]{3,6})/);
  if (!hexMatch) return null;

  let hex = hexMatch[1];
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  if (hex.length !== 6) return null;

  return {
    r: parseInt(hex.substring(0, 2), 16) / 255,
    g: parseInt(hex.substring(2, 4), 16) / 255,
    b: parseInt(hex.substring(4, 6), 16) / 255
  };
}

// ================================
// Public Resolution Functions
// ================================

export async function resolvePaintValue(rawValue: string): Promise<PaintResolution> {
  const cleanValue = rawValue.trim();
  const bindingMatch = cleanValue.match(BINDING_REFERENCE_PATTERN);

  if (bindingMatch) {
    const name = bindingMatch[1].trim();
    const metadata = bindingMatch[2];

    // Variable reference (contains " - " in metadata)
    if (metadata.includes(' - ')) {
      const result = await lookupVariable(name, {
        typeFilter: type => type === 'VARIABLE_COLOR' || type === 'VARIABLE'
      });
      if (!result) {
        figma.notify(`Variable "${name}" not found, skipping...`);
        throw new Error(`Variable not found: ${name}`);
      }
      return { type: 'variable', ...result };
    }

    // Style reference
    const styleResult = await lookupStyle(name, ['PAINT']);
    if (!styleResult) {
      figma.notify(`Style "${name}" not found, skipping...`);
      throw new Error(`Style not found: ${name}`);
    }
    return { type: 'style', styleKey: styleResult.styleKey };
  }

  // Literal hex color
  const color = parseHexColor(cleanValue);
  if (!color) throw new Error(`Invalid color format: ${cleanValue}`);
  return { type: 'literal', color };
}

export async function resolveStyleValue(rawValue: string): Promise<StyleResolution> {
  const cleanValue = rawValue.trim();
  const bindingMatch = cleanValue.match(BINDING_REFERENCE_PATTERN);

  if (bindingMatch) {
    const name = bindingMatch[1].trim();
    const metadata = bindingMatch[2];

    // Variable reference
    if (metadata.includes(' - ')) {
      const result = await lookupVariable(name, {
        typeFilter: type => type.startsWith('VARIABLE') || type === 'VARIABLE'
      });
      if (!result) {
        figma.notify(`Variable "${name}" not found, skipping...`);
        throw new Error(`Variable not found: ${name}`);
      }
      return { type: 'variable', ...result };
    }

    // Style reference (search all types)
    const styleResult = await lookupStyle(name, STYLE_TYPES);
    if (!styleResult) {
      figma.notify(`Style "${name}" not found, skipping...`);
      throw new Error(`Style not found: ${name}`);
    }
    return { type: 'style', styleKey: styleResult.styleKey, styleType: styleResult.styleType };
  }

  // Literal hex color fallback
  const color = parseHexColor(cleanValue);
  if (color) return { type: 'literal', color };

  throw new Error(`Invalid style or color format: ${cleanValue}`);
}

export async function resolveNumberValue(rawValue: string): Promise<NumberResolution> {
  const cleanValue = rawValue.trim();
  const bindingMatch = cleanValue.match(BINDING_REFERENCE_PATTERN);

  if (bindingMatch) {
    const name = bindingMatch[1].trim();
    const metadata = bindingMatch[2];

    // Variable reference
    if (metadata.includes(' - ')) {
      const result = await lookupVariable(name, {
        typeFilter: type => type === 'VARIABLE_FLOAT'
      });
      if (!result) {
        figma.notify(`Variable "${name}" not found, skipping...`);
        throw new Error(`Variable not found: ${name}`);
      }
      return { type: 'variable', ...result };
    }
  }

  // Literal number
  const isPercentage = cleanValue.endsWith('%');
  const valueStr = isPercentage ? cleanValue.slice(0, -1) : cleanValue;
  let value = parseFloat(valueStr);

  if (isNaN(value)) {
    // Try to calculate expression
    try {
      const calculated = calculateExpression(cleanValue);
      const isCalcPercentage = calculated.endsWith('%');
      value = parseFloat(isCalcPercentage ? calculated.slice(0, -1) : calculated);
      if (!isNaN(value)) {
        return { type: 'literal', value, unit: isCalcPercentage ? 'PERCENT' : 'PIXELS' };
      }
    } catch { /* ignore */ }
    throw new Error(`Invalid number format: ${cleanValue}`);
  }

  return { type: 'literal', value, unit: isPercentage ? 'PERCENT' : 'PIXELS' };
}

export async function resolveNumberVariable(resolution: NumberResolution): Promise<Variable> {
  if (resolution.type !== 'variable' || !resolution.variableId) {
    throw new Error('Expected a variable-backed number resolution');
  }

  let variableId = resolution.variableId;
  if (resolution.isLibraryVariable) {
    const importedVar = await figma.variables.importVariableByKeyAsync(variableId);
    if (!importedVar) throw new Error('Variable not found');
    variableId = importedVar.id;
  }

  const variable = await figma.variables.getVariableByIdAsync(variableId);
  if (!variable) throw new Error('Variable not found');
  return variable;
}
