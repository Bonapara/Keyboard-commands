import type { ValueFormat } from './types';
import { COMMANDS } from './commands';
import {
  findCommand,
  getCommandSuggestions,
  extractValue,
  calculateExpression,
  isCommandAvailableForSelection,
  VALUE_FORMAT_REGEX,
  COMMAND_SPLITTER_REGEX,
  COMMAND_PART_REGEX,
  COMMAND_BREAK_PATTERN,
  searchStylesAndVariables
} from './utils';
import { applyDropdownSelection } from './command-input';
import {
  buildExecutionPlan,
  parseBindingSegment,
  parseTypedBindingSegment,
  type ParsedBinding,
} from './command-execution-plan';
import { searchLibraries } from './implementations/library';
import { recordRecentValue, getRecentValues } from './recent-values';
import { getHistory, recordHistory } from './history';
import * as impl from './implementations';

const HISTORY_COMMAND_NAME = 'History';
const PRISTINE_HISTORY_COUNT = 3;

// True when the input is a single token that resolves to the History command
// (e.g. "hi", "history", or partial typings like "hist" — anything findCommand
// would map to History on its own).
function isHistoryInvocation(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed || trimmed.includes(' ')) return false;
  return findCommand(trimmed)[0]?.name === HISTORY_COMMAND_NAME;
}

let originalInput = '';

function findCommandIgnoringSelection(part: string): (typeof COMMANDS)[0] | undefined {
  const commandPart = part.match(COMMAND_PART_REGEX)?.[0];
  if (!commandPart) return undefined;

  const cmdLower = commandPart.toLowerCase();

  const exactAlias = COMMANDS.find(cmd =>
    cmd.alias.some(alias => alias.toLowerCase() === cmdLower)
  );
  if (exactAlias) return exactAlias;

  const exactName = COMMANDS.find(cmd => cmd.name.toLowerCase() === cmdLower);
  if (exactName) return exactName;

  return COMMANDS.find(cmd =>
    cmd.name.toLowerCase().startsWith(cmdLower) ||
    cmd.alias.some(alias => alias.toLowerCase().startsWith(cmdLower))
  ) || COMMANDS.find(cmd =>
    cmd.name.toLowerCase().includes(cmdLower) ||
    cmd.alias.some(alias => alias.toLowerCase().includes(cmdLower))
  );
}

function getSuggestionDataKey(item: string | { data: unknown }): string | null {
  if (typeof item === 'string') return impl.stripInstancePropertyVariantGroupToken(item);
  if (item && typeof item.data === 'string') return impl.stripInstancePropertyVariantGroupToken(item.data);
  return null;
}

function formatRecentFieldLabel(field: string): string {
  if (field === 'cornerRadius') return 'Corner Radius';
  if (field === 'stroke') return 'Stroke';

  return field
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatInstanceOverrideRecentLabel(value: string): string | null {
  try {
    const data = JSON.parse(value) as Record<string, unknown>;
    const field = typeof data.field === 'string' ? data.field : '';
    const nodeName = typeof data.nodeName === 'string' ? data.nodeName : '';
    const componentPropertyName = typeof data.componentPropertyName === 'string'
      ? data.componentPropertyName
      : '';

    if (!field || !nodeName) return null;

    const fieldLabel = field === 'componentProperties' && componentPropertyName
      ? `Property: ${componentPropertyName}`
      : formatRecentFieldLabel(field);

    return `${nodeName} -> ${fieldLabel}`;
  } catch {
    return null;
  }
}

function getRecentSuggestionName(
  matchedCommand: (typeof COMMANDS)[0],
  value: string
): string {
  const displayValue = matchedCommand.bindingSupport?.instanceOverrides
    ? formatInstanceOverrideRecentLabel(value) || value
    : value;

  return `${displayValue} (recent)`;
}

// Extract the "active" portion of a chained search (what's after the last ",")
// and the committed prefix (everything up to and including that ","). Only
// instance-property chains use "," so other commands pass through untouched.
function splitActiveSearch(
  matchedCommand: (typeof COMMANDS)[0],
  searchTerm: string
): { active: string; prefix: string; committed: Set<string> } {
  if (!matchedCommand.bindingSupport?.instanceProperties || !searchTerm.includes(',')) {
    return { active: searchTerm, prefix: '', committed: new Set() };
  }

  const commaIdx = searchTerm.lastIndexOf(',');
  const prefix = searchTerm.slice(0, commaIdx + 1);
  const active = searchTerm.slice(commaIdx + 1).replace(/^\s+/, '');
  const committed = new Set(
    prefix.split(',').map(s => s.trim()).filter(Boolean)
  );
  return { active, prefix, committed };
}

async function buildRecentSuggestions(
  matchedCommand: (typeof COMMANDS)[0],
  searchTerm: string,
  existing: Array<string | { name: string; data: unknown }>
): Promise<Array<{ name: string; data: unknown }>> {
  // Libraries are selection lists, and instance-property search should stay
  // focused on the properties currently editable from the selected instances.
  if (matchedCommand.bindingSupport?.libraries || matchedCommand.bindingSupport?.instanceProperties) return [];

  const recents = await getRecentValues(matchedCommand.name);
  if (recents.length === 0) return [];

  const { active, prefix, committed } = splitActiveSearch(matchedCommand, searchTerm);
  const activeLower = active.toLowerCase();

  const existingKeys = new Set(
    existing.map(getSuggestionDataKey).filter((k): k is string => k !== null)
  );

  const matchingRecents = recents
    .map(r => ({ value: r, name: getRecentSuggestionName(matchedCommand, r) }))
    .filter(r => !committed.has(r.value))
    .filter(r => (
      !activeLower ||
      r.value.toLowerCase().includes(activeLower) ||
      r.name.toLowerCase().includes(activeLower)
    ))
    .filter(r => !existingKeys.has(prefix + r.value));

  return matchingRecents.map(r => ({ name: r.name, data: prefix + r.value }));
}

async function generateBindingSuggestions(
  matchedCommand: (typeof COMMANDS)[0],
  searchTerm: string
): Promise<Array<string | { name: string; data: unknown }>> {
  if (!matchedCommand?.bindingSupport) {
    return [];
  }

  try {
    let suggestions: Array<string | { name: string; data: unknown }> = [];

    if (matchedCommand.bindingSupport.libraries) {
      suggestions = await searchLibraries(searchTerm);
    } else if (matchedCommand.bindingSupport.instanceProperties) {
      suggestions = await impl.searchInstanceProperties(searchTerm);
    } else if (matchedCommand.bindingSupport.instanceSwap) {
      suggestions = await impl.searchComponentsForSwap(searchTerm);
    } else if (matchedCommand.bindingSupport.instanceOverrides) {
      suggestions = await impl.searchInstanceOverrides(searchTerm);
    } else {
      suggestions = await searchStylesAndVariables(
        searchTerm,
        matchedCommand.bindingSupport,
        {
          getStoredLibraries: impl.getStoredLibraries,
          getActiveLibraries: impl.getActiveLibraries
        }
      );
    }

    const recentItems = await buildRecentSuggestions(matchedCommand, searchTerm, suggestions);
    if (recentItems.length === 0) return suggestions;
    return matchedCommand.bindingSupport.instanceProperties
      ? [...suggestions, ...recentItems]
      : [...recentItems, ...suggestions];
  } catch (error) {
    console.error('Error searching:', error);
    return [];
  }
}

function trackCommandsFromSegment(
  segment: string,
  isBindingSegment: boolean,
  bindingAlias?: string,
  bindingValue?: string,
  ignoreSelection: boolean = false
): Record<string, string> {
  const commands: Record<string, string> = {};

  if (isBindingSegment && bindingAlias && bindingValue !== undefined) {
    const matchedBindingCmd = ignoreSelection
      ? findCommandIgnoringSelection(bindingAlias)
      : findCommand(bindingAlias)[0];
    if (matchedBindingCmd) {
      let formattedValue = bindingValue.trim();

      // Special formatting for instance properties: "propertyName:value" -> "PropertyName:Value"
      if (matchedBindingCmd.bindingSupport?.instanceProperties) {
        const propertyMatch = formattedValue.match(/^([^:]+):(.*)$/);
        if (propertyMatch) {
          const propName = propertyMatch[1].trim();
          const propValue = propertyMatch[2].trim();
          // Capitalize first letter of propName and propValue
          const capitalizedPropName = propName.charAt(0).toUpperCase() + propName.slice(1);
          const capitalizedPropValue = propValue.charAt(0).toUpperCase() + propValue.slice(1);
          formattedValue = `${capitalizedPropName}:${capitalizedPropValue}`;
        }
      }

      commands[matchedBindingCmd.name] = formattedValue;
    }
  }

  // Process simple commands from the segment
  const parts = segment.split(COMMAND_SPLITTER_REGEX).filter(Boolean);
  parts.forEach(part => {
    const matchedCommand = ignoreSelection
      ? findCommandIgnoringSelection(part)
      : findCommand(part)[0];
    if (matchedCommand) {
      if (matchedCommand.type === 'commandWithoutValue') {
        commands[matchedCommand.name] = '';
      } else {
        const hasHex = VALUE_FORMAT_REGEX.hex.exec(part);
        const hasNumber = VALUE_FORMAT_REGEX.number.exec(part);
        if (hasHex && matchedCommand.valueFormat === 'hex') {
          commands[matchedCommand.name] = hasHex[0];
        } else if (hasNumber) {
          // Preserve delta operator (e.g. "w+10" tracked as "+10") and
          // comma lists (e.g. "p20,30" tracked as "20,30").
          const deltaMatch = part.match(/^[\p{L}][\p{L}\-]*\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)\s*$/u);
          const listMatch = part.match(/^[\p{L}][\p{L}\-]*\s*(-?\d+(?:\.\d+)?(?:,-?\d+(?:\.\d+)?)+)\s*$/u);
          if (deltaMatch) {
            commands[matchedCommand.name] = `${deltaMatch[1]}${deltaMatch[2]}`;
          } else if (listMatch) {
            commands[matchedCommand.name] = listMatch[1];
          } else {
            try {
              const computedValue = calculateExpression(hasNumber[0]);
              commands[matchedCommand.name] = computedValue.toString();
            } catch {
              commands[matchedCommand.name] = hasNumber[0];
            }
          }
        }
      }
    }
  });

  return commands;
}

function getDropdownValue(
  parameters: { command?: string },
  isOnlySegment: boolean,
  isLastSegment: boolean
): string | null {
  if (!parameters?.command) {
    return null;
  }

  const dropdownValue = parameters.command;

  // Don't use summary strings (which contain pipes)
  if (dropdownValue.includes('|')) {
    return null;
  }

  // For single binding segment, use the dropdown value
  if (isOnlySegment) {
    return dropdownValue;
  }

  // For last binding segment, check if it looks like a selection
  if (isLastSegment) {
    const isSelection = dropdownValue &&
      (dropdownValue.includes(':') || dropdownValue.includes('('));
    return isSelection ? dropdownValue : null;
  }

  return null;
}

// Contract: a suggestion's `data` field is the canonical execution value;
// `name` is display-only (may carry UI hints, counts, etc.). Consumers read
// `data`, never `name`. When a suggestion is a bare string, it IS the value.
function getFirstSuggestionName(suggestions: Array<string | { data: unknown }>): string | null {
  const first = suggestions[0];
  if (typeof first === 'string') return first;
  if (first && typeof first === 'object' && typeof first.data === 'string') return first.data;
  return null;
}

// Resolve two-stage color selection (e.g., "source : target")
async function resolveTwoStageValue(
  rawValue: string,
  command: (typeof COMMANDS)[0]
): Promise<string> {
  const delimiterIndex = rawValue.indexOf(':');
  const sourceSearch = rawValue.slice(0, delimiterIndex).trim();
  const targetSearch = rawValue.slice(delimiterIndex + 1).trim();

  // Auto-select source
  const sourceSuggestions = await generateBindingSuggestions(command, sourceSearch);
  const resolvedSource = getFirstSuggestionName(sourceSuggestions) || sourceSearch;

  // Auto-select target using stage 2 context
  const targetSuggestions = await generateBindingSuggestions(command, `${sourceSearch} : ${targetSearch}`);
  const resolvedTarget = getFirstSuggestionName(targetSuggestions) || targetSearch;

  return `${resolvedSource} : ${resolvedTarget}`;
}

async function executeBindingCommand(
  parsed: ParsedBinding,
  parameters: { command?: string },
  isOnlyBinding: boolean,
  isLastBinding: boolean,
): Promise<void> {
  const matchedCommand = findCommand(parsed.alias)[0];
  const rawValue = parsed.value.trim();
  // Only selectionColors commands use ":" as a two-stage separator. Other
  // binding commands (e.g. instance properties) also use ":" inside their
  // values, so we must not treat those as two-stage.
  const isTwoStageBinding = !!matchedCommand?.bindingSupport?.selectionColors;
  const hasDelimiter = isTwoStageBinding && rawValue.includes(':');

  // Check if we should use the dropdown value
  const dropdownValue = getDropdownValue(
    parameters,
    isOnlyBinding,
    isLastBinding
  );
  let valueToUse = rawValue;
  let isDropdownSelection = false;

  if (dropdownValue) {
    if (!hasDelimiter || (isTwoStageBinding && dropdownValue.includes(':'))) {
      valueToUse = dropdownValue;
      isDropdownSelection = true;
    } else {
      // Two-stage: preserve source, use dropdown as target. If the user
      // omitted the source (e.g. "cs;:blue"), auto-resolve it from the first
      // selection-color match — same default the no-dropdown path gets via
      // resolveTwoStageValue.
      let source = rawValue.slice(0, rawValue.indexOf(':')).trim();
      if (!source && matchedCommand?.bindingSupport) {
        const sourceSuggestions = await generateBindingSuggestions(matchedCommand, '');
        source = getFirstSuggestionName(sourceSuggestions) || '';
      }
      valueToUse = `${source} : ${dropdownValue}`;
      isDropdownSelection = true;
    }
  }

  // Auto-select first result if no dropdown selection was made
  if (!isDropdownSelection && matchedCommand?.bindingSupport) {
    if (hasDelimiter) {
      valueToUse = await resolveTwoStageValue(valueToUse, matchedCommand);
    } else {
      const name = getFirstSuggestionName(await generateBindingSuggestions(matchedCommand, valueToUse));
      if (name) valueToUse = name;
    }
  }

  await executeCommand(`${parsed.alias} ${valueToUse}`, true);

  // Record for recent-values. ip chains on ",", each pair is its own entry.
  if (matchedCommand) {
    const recordable = matchedCommand.bindingSupport?.instanceProperties
      ? valueToUse
        .split(',')
        .map(v => impl.stripInstancePropertyVariantGroupToken(v.trim()))
        .filter(Boolean)
      : [valueToUse.trim()];
    for (const entry of recordable) {
      await recordRecentValue(matchedCommand.name, entry);
    }
  }
}

// ================================
// Input Handler Helpers
// ================================

// Handle binding mode suggestions (cmd?searchTerm pattern)
async function handleBindingMode(
  segment: string,
  result: ParameterInputEvent['result']
): Promise<boolean> {
  const typed = parseTypedBindingSegment(segment);
  if (!typed) return false;

  const matchedCommand = findCommand(typed.alias)[0];

  if (!matchedCommand?.bindingSupport) return false;

  const suggestions = await generateBindingSuggestions(matchedCommand, typed.searchTerm);
  if (suggestions.length > 0) {
    result.setSuggestions(suggestions);
  } else {
    const message = matchedCommand.bindingSupport.libraries
      ? 'No matching libraries found'
      : 'No matching styles or variables found';
    result.setSuggestions([message]);
  }
  return true;
}

// Track commands from previous segments to show "already set" indicators
function trackPreviousCommands(previousSegments: string[], currentSegmentParts: string[]): Record<string, string> {
  const commands: Record<string, string> = {};

  // Process previous segments
  for (const segment of previousSegments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;

    const parsed = parseBindingSegment(trimmed);
    if (parsed) {
      if (parsed.prefix) {
        Object.assign(commands, trackCommandsFromSegment(parsed.prefix, false));
      }
      Object.assign(commands, trackCommandsFromSegment('', true, parsed.alias, parsed.value));
    } else {
      Object.assign(commands, trackCommandsFromSegment(trimmed, false));
    }
  }

  // Process previous parts in current segment
  for (const part of currentSegmentParts) {
    Object.assign(commands, trackCommandsFromSegment(part, false));
  }

  return commands;
}

// Build suggestion summary string (e.g., "Width:100 | Height:200")
function buildSuggestionSummary(previousCommands: Record<string, string>): string[] {
  return Object.entries(previousCommands).map(([name, value]) =>
    value ? `${name}:${value}` : name
  );
}

function summarizeHistoryPiece(piece: string): string {
  const tracked = trackCommandsFromSegment(piece, false, undefined, undefined, true);
  const parts = buildSuggestionSummary(tracked);
  return parts.length > 0 ? parts.join(' | ') : piece.trim();
}

function normalizeHistorySequenceForReplay(commandString: string): string {
  if (!commandString.includes('|')) {
    return commandString;
  }

  const normalizedParts = commandString
    .split('|')
    .map(piece => summarizeHistoryPiece(piece))
    .filter(Boolean);

  return normalizedParts.length > 0 ? normalizedParts.join(' ') : commandString;
}

function summarizeExecutionStep(step: ReturnType<typeof buildExecutionPlan>[number]): string {
  const tracked = step.kind === 'binding'
    ? trackCommandsFromSegment('', true, step.parsed.alias, step.parsed.value, true)
    : trackCommandsFromSegment(step.command, false, undefined, undefined, true);
  const parts = buildSuggestionSummary(tracked);

  if (parts.length > 0) {
    return parts.join(' | ');
  }

  return step.kind === 'binding'
    ? `${step.parsed.alias}:${step.parsed.value.trim()}`
    : step.command;
}

// Handle normal mode suggestions (space-separated commands)
async function handleNormalMode(
  query: string,
  currentPart: string,
  previousCommands: Record<string, string>,
  result: ParameterInputEvent['result']
): Promise<void> {
  // If query is empty or ends with space, show all commands
  if (!query || query.endsWith(' ')) {
    const baseSuggestions = getCommandSuggestions(COMMANDS, '', undefined, true, previousCommands);

    // Pristine input — prepend the top N recent sequences so users can re-run
    // any of them with one click. Skip mid-chain so suggestions stay focused
    // on what's next.
    if (!query.trim()) {
      const history = await getHistory();
      const recentItems = history.slice(0, PRISTINE_HISTORY_COUNT).map(entry => ({
        name: `↻ ${summarizeHistorySequence(entry)}`,
        data: normalizeHistorySequenceForReplay(entry),
      }));
      if (recentItems.length > 0) {
        result.setSuggestions([...recentItems, ...baseSuggestions]);
        return;
      }
    }

    result.setSuggestions(baseSuggestions);
    return;
  }

  const completeCommands = buildSuggestionSummary(previousCommands);
  const matchedCommand = findCommand(currentPart)[0];
  const hasNumber = VALUE_FORMAT_REGEX.number.exec(currentPart);
  const hasHex = VALUE_FORMAT_REGEX.hex.exec(currentPart);

  if (matchedCommand) {
    handleMatchedCommand(matchedCommand, currentPart, completeCommands, previousCommands, hasNumber, hasHex, result);
  } else {
    handleUnmatchedCommand(currentPart, result);
  }
}

// Render a saved sequence ("hf vf", "f?blue", "w100  h200") as a human-readable
// recap ("HorizontalFill | VerticalFill", "Fill:blue", "Width:100 | Height:200")
// while preserving the original execution order of the chain.
function summarizeHistorySequence(commandString: string): string {
  if (commandString.includes('|')) {
    const legacyParts = commandString
      .split('|')
      .map(piece => summarizeHistoryPiece(piece))
      .filter(Boolean);
    return legacyParts.length > 0 ? legacyParts.join(' | ') : commandString;
  }

  const segments = commandString.split(COMMAND_BREAK_PATTERN);
  const steps = buildExecutionPlan(segments);
  const parts = steps.map(summarizeExecutionStep).filter(Boolean);
  return parts.length > 0 ? parts.join(' | ') : commandString;
}

// Show recent command sequences as suggestions for the History command.
async function handleHistoryCommand(
  result: ParameterInputEvent['result']
): Promise<void> {
  const history = await getHistory();
  if (history.length === 0) {
    result.setSuggestions(['No history yet — run any command first']);
    return;
  }
  result.setSuggestions(
    history.map(entry => ({
      name: summarizeHistorySequence(entry),
      data: normalizeHistorySequenceForReplay(entry),
    }))
  );
}

// Handle suggestions when a command is matched
function handleMatchedCommand(
  matchedCommand: (typeof COMMANDS)[0],
  currentPart: string,
  completeCommands: string[],
  previousCommands: Record<string, string>,
  hasNumber: RegExpExecArray | null,
  hasHex: RegExpExecArray | null,
  result: ParameterInputEvent['result']
): void {
  const isValidValue =
    (matchedCommand.type === "commandWithValue" || matchedCommand.type === "optionalValueCommand") &&
    'valueFormat' in matchedCommand && (
      matchedCommand.valueFormat === 'hex' ? hasHex :
        matchedCommand.valueFormat === 'number' ? hasNumber : true
    );

  const suggestions: string[] = [];

  // Show "already set" indicator if command was used earlier
  if (
    matchedCommand.name.toLowerCase().includes(currentPart.toLowerCase()) ||
    matchedCommand.alias.some(alias => alias.toLowerCase().includes(currentPart.toLowerCase()))
  ) {
    const previousValue = previousCommands[matchedCommand.name];
    const hint = previousValue ? `already set to '${previousValue}'` : matchedCommand.suggestion;
    suggestions.push(`${matchedCommand.alias.join(', ')} · ${matchedCommand.name} -- ${hint}`);
  }

  // Display computed values in suggestion
  if (isValidValue && (hasHex || hasNumber)) {
    if (matchedCommand.valueFormat === 'hex' && hasHex) {
      completeCommands.push(`${matchedCommand.name}:${hasHex[0]}`);
      suggestions[0] = completeCommands.join(' | ');
    } else if (matchedCommand.valueFormat === 'number' && hasNumber) {
      // Preserve delta operator (e.g. "w+10" → "Width:+10") and comma lists
      // (e.g. "p20,30" → "Padding:20,30") so the summary round-trips correctly
      // through executeCommand's normalization.
      const deltaMatch = currentPart.match(/^[\p{L}][\p{L}\-]*\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)\s*$/u);
      const listMatch = currentPart.match(/^[\p{L}][\p{L}\-]*\s*(-?\d+(?:\.\d+)?(?:,-?\d+(?:\.\d+)?)+)\s*$/u);
      if (deltaMatch) {
        completeCommands.push(`${matchedCommand.name}:${deltaMatch[1]}${deltaMatch[2]}`);
      } else if (listMatch) {
        completeCommands.push(`${matchedCommand.name}:${listMatch[1]}`);
      } else {
        try {
          completeCommands.push(`${matchedCommand.name}:${calculateExpression(hasNumber[0])}`);
        } catch {
          completeCommands.push(`${matchedCommand.name}:${hasNumber[0]}`);
        }
      }
      suggestions[0] = completeCommands.join(' | ');
    }
  }

  if (matchedCommand.type === 'commandWithoutValue') {
    completeCommands.push(
      completeCommands.length === 0 && matchedCommand.suggestion
        ? `${matchedCommand.name} -- ${matchedCommand.suggestion}`
        : matchedCommand.name
    );
    suggestions[0] = completeCommands.join(' | ');
  }

  // Add related commands
  const relatedSuggestions = getCommandSuggestions(COMMANDS, currentPart, matchedCommand, false, previousCommands);
  result.setSuggestions([...suggestions, ...relatedSuggestions]);
}

// Handle suggestions when no command is matched
function handleUnmatchedCommand(currentPart: string, result: ParameterInputEvent['result']): void {
  const cmdLower = currentPart.toLowerCase();
  const allMatching = COMMANDS.filter(cmd =>
    cmd.name.toLowerCase().includes(cmdLower) ||
    cmd.alias.some(a => a.toLowerCase().includes(cmdLower))
  );

  if (allMatching.length === 0) {
    result.setSuggestions([`No command found for "${currentPart}"`]);
    return;
  }

  // Check if matching commands are valid for current selection
  const selection = figma.currentPage.selection;
  const available = allMatching.filter(cmd => isCommandAvailableForSelection(cmd, selection));

  if (available.length === 0) {
    result.setSuggestions(allMatching.map(cmd => `'${cmd.name}' not available on selection`));
  } else {
    result.setSuggestions([`No command found for "${currentPart}"`]);
  }
}

// ================================
// Main Input Handler Setup
// ================================

let currentInputHandler: ((event: ParameterInputEvent) => void) | null = null;

function setupInputHandler() {
  if (currentInputHandler) {
    figma.parameters.off('input', currentInputHandler);
  }

  currentInputHandler = async ({ key, query, result }) => {
    if (key !== 'command') return;
    originalInput = query;

    const segments = query.split(COMMAND_BREAK_PATTERN);
    const currentSegment = segments[segments.length - 1];
    const previousSegments = segments.slice(0, -1);

    // Try binding mode first
    if (await handleBindingMode(currentSegment, result)) return;

    // History command shows recent sequences instead of related commands.
    // Only trigger when the History command is the entire input — chains like
    // "w100  hi" should not hijack suggestions.
    if (previousSegments.length === 0 && isHistoryInvocation(currentSegment)) {
      await handleHistoryCommand(result);
      return;
    }

    // Normal mode
    const parts = currentSegment.split(' ');
    const currentPart = parts[parts.length - 1];
    const previousCommands = trackPreviousCommands(previousSegments, parts.slice(0, -1));

    await handleNormalMode(query, currentPart, previousCommands, result);
  };

  figma.parameters.on('input', currentInputHandler);
}

setupInputHandler();

figma.on('run', async (parameters) => {
  // Use the selected dropdown value if available, otherwise use what was typed
  let commandString = applyDropdownSelection(
    originalInput,
    parameters.parameters?.command,
    (name) => findCommand(name).length > 0
  );

  // Strip description suffix if present (e.g., "HorizontalFill -- Horizontal Fill" → "HorizontalFill")
  // This handles cases where suggestion data includes " -- description" format
  commandString = commandString.split(' -- ')[0];

  // History replay: the user picked a saved sequence (either from the `hi`
  // dropdown or from the "↻ recap" entry in the empty-input list). In both
  // cases the dropdown value IS the entire commandString — we must NOT pass it
  // down to executeBindingCommand (for "f?blue" it would be mistaken for a
  // resolved style name). Empty params force auto-resolution.
  const selectedValue = parameters.parameters?.command;
  const isHistoryReplay =
    (isHistoryInvocation(originalInput) && !isHistoryInvocation(commandString)) ||
    (!!selectedValue && selectedValue === commandString && commandString !== originalInput.trim());
  const runParameters = isHistoryReplay ? {} : parameters.parameters || {};

  // If user invoked "hi" without picking anything, surface why nothing happens.
  if (isHistoryInvocation(commandString)) {
    const history = await getHistory();
    figma.notify(
      history.length === 0
        ? 'No history yet — run any command first'
        : 'Pick a recent sequence from the suggestions'
    );
    figma.closePlugin();
    return;
  }

  // Parse command chain (e.g., "w100  h200  f?blue" → 3 segments)
  const segments = commandString.split(COMMAND_BREAK_PATTERN);

  // Build an ordered execution plan so mixed binding/simple chains run left to right.
  const executionPlan = buildExecutionPlan(segments);
  const totalBindings = executionPlan.filter((step) => step.kind === 'binding').length;

  try {
    let bindingIndex = 0;

    for (const step of executionPlan) {
      if (step.kind === 'simple') {
        await executeCommand(step.command, true);
      } else {
        await executeBindingCommand(
          step.parsed,
          runParameters,
          totalBindings === 1,
          bindingIndex === totalBindings - 1
        );
        bindingIndex += 1;
      }
    }

    // Record the sequence so it appears in `hi`. Skip if the chain leads with
    // History so the no-op invocation doesn't pollute its own list.
    const leadCommand = findCommand(commandString)[0];
    if (commandString && leadCommand?.name !== HISTORY_COMMAND_NAME) {
      await recordHistory(commandString, summarizeHistorySequence);
    }

    figma.closePlugin();
  } catch (error) {
    figma.notify(error instanceof Error ? error.message : 'An unknown error occurred');
    figma.closePlugin();
  }
});

async function executeCommand(cmd: string, skipNotification: boolean = false): Promise<void> {
  if (!cmd) return;

  // Suggestion summaries use the format "CommandName:Value" (e.g. "Rotate:23",
  // "Width:100", "Fill:#FF0000"). When fed back as input — either because the
  // user accepted an auto-picked suggestion or because the summary was appended
  // to a chain — normalize to "alias value" so extractValue's colon handling
  // (used for selection-color swaps) doesn't swallow the prefix.
  const summaryMatch = cmd.match(/^([A-Z][A-Za-z]+):(.+)$/);
  if (summaryMatch) {
    const summaryCmd = findCommand(summaryMatch[1])[0];
    if (summaryCmd) {
      cmd = `${summaryCmd.alias[0]} ${summaryMatch[2]}`;
    }
  }

  // Extract command from suggestion text (remove aliases, descriptions, etc.)
  const cleanCmd = cmd.split('•')[0]  // Remove everything after the bullet point
    .split('·')[0]    // Also split on middle dot (used in suggestions)
    .split(',')[0]    // Take only the first part before any comma
    .trim();          // Remove whitespace

  const command = findCommand(cleanCmd)[0];

  if (!command) return;

  const loadingNotification = skipNotification ? null : figma.notify(`Executing command(s)...`, { timeout: 0 });

  try {
    // Route to appropriate execution based on command type
    if (command.type === 'commandWithoutValue') {
      await command.functionWithoutParam();
    } else {
      const value = extractValue(cmd, command.valueFormat as ValueFormat);

      if (command.type === 'commandWithValue') {
        if (!value) {
          figma.notify(`No value provided for ${command.name}`);
          return;
        }
        await command.functionWithParam(value);
      } else if (command.type === 'optionalValueCommand') {
        if (value) {
          await command.functionWithParam(value);
        } else {
          await command.functionWithoutParam();
        }
      }
    }
  } catch (error) {
    console.error('Error executing command:', error);

    // Provide user-friendly error messages for common issues
    if (error instanceof Error) {
      if (error.message.includes('font')) {
        figma.notify(`Font loading failed for "${command.name}". The font may not be available.`);
      } else if (error.message.includes('permission')) {
        figma.notify(`Permission denied for "${command.name}". Check node permissions.`);
      } else if (error.message.includes('read-only')) {
        figma.notify(`Cannot modify "${command.name}" - node or property is read-only.`);
      } else {
        figma.notify(error.message);
      }
    } else {
      figma.notify('Command execution failed');
    }
    throw error;
  } finally {
    if (loadingNotification) {
      loadingNotification.cancel();
    }
  }
}
