import type { ValueFormat } from './types';
import { COMMANDS } from './commands';
import {
  findCommand,
  getCommandSuggestions,
  extractValue,
  createSelectionAvailabilityContext,
  isCommandAvailableForSelectionWithContext,
  type SelectionAvailabilityContext,
  VALUE_FORMAT_REGEX,
  COMMAND_SPLITTER_REGEX,
  COMMAND_PART_REGEX,
  COMMAND_BREAK_PATTERN,
  searchStylesAndVariables
} from './utils';
import { applyDropdownSelection, isInformationalSuggestion } from './command-input';
import {
  buildExecutionPlan,
  parseBindingSegment,
  parseTypedBindingSegment,
  type ParsedBinding,
} from './command-execution-plan';
import { searchLibraries } from './implementations/library';
import { getHistory, recordHistory } from './history';
import * as impl from './implementations';

const HISTORY_COMMAND_NAME = 'History';
const PRISTINE_HISTORY_COUNT = 3;
const CHAIN_HINT = 'Type "  " for another command';
type BindingSuggestionItem = string | ({ name: string; data: unknown } & Record<string, unknown>);

// True when the input is a single token that resolves to the History command
// (e.g. "hi", "history", or partial typings like "hist" — anything findCommand
// would map to History on its own).
function isHistoryInvocation(input: string, availabilityContext?: SelectionAvailabilityContext): boolean {
  const trimmed = input.trim();
  if (!trimmed || trimmed.includes(' ')) return false;
  return findCommand(trimmed, availabilityContext)[0]?.name === HISTORY_COMMAND_NAME;
}

let originalInput = '';

function findCommandIgnoringSelection(part: string): (typeof COMMANDS)[0] | undefined {
  const commandPart = part.match(COMMAND_PART_REGEX)?.[0];
  if (!commandPart) return undefined;

  const cmdLower = commandPart.toLowerCase();

  const exactMatch = findExactCommandIgnoringSelection(part);
  if (exactMatch) return exactMatch;

  return COMMANDS.find(cmd =>
    cmd.name.toLowerCase().startsWith(cmdLower) ||
    cmd.alias.some(alias => alias.toLowerCase().startsWith(cmdLower))
  ) || COMMANDS.find(cmd =>
    cmd.name.toLowerCase().includes(cmdLower) ||
    cmd.alias.some(alias => alias.toLowerCase().includes(cmdLower))
  );
}

// Past the first "alias?" of a segment, only exact binding aliases start a new
// binding; any other "?" or ";" belongs to the value being typed.
function isBindingCommandAlias(alias: string): boolean {
  return !!findExactCommandIgnoringSelection(alias)?.bindingSupport;
}

function findExactCommandIgnoringSelection(part: string): (typeof COMMANDS)[0] | undefined {
  const commandPart = part.match(COMMAND_PART_REGEX)?.[0];
  if (!commandPart) return undefined;

  const cmdLower = commandPart.toLowerCase();

  const exactAlias = COMMANDS.find(cmd =>
    cmd.alias.some(alias => alias.toLowerCase() === cmdLower)
  );
  if (exactAlias) return exactAlias;

  return COMMANDS.find(cmd => cmd.name.toLowerCase() === cmdLower);
}

async function generateBindingSuggestions(
  matchedCommand: (typeof COMMANDS)[0],
  searchTerm: string
): Promise<BindingSuggestionItem[]> {
  if (!matchedCommand?.bindingSupport) {
    return [];
  }

  try {
    let suggestions: BindingSuggestionItem[] = [];

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

    return suggestions;
  } catch (error) {
    console.error('Error searching:', error);
    return [];
  }
}

function supportsCatalogBindingSearch(command: (typeof COMMANDS)[0]): boolean {
  return !!(
    command.bindingSupport?.styles ||
    command.bindingSupport?.variables ||
    command.bindingSupport?.libraryStyles ||
    command.bindingSupport?.selectionColors
  );
}

function addChainHintToFirstSuggestion(suggestions: BindingSuggestionItem[]): BindingSuggestionItem[] {
  if (suggestions.length === 0) return suggestions;

  const [first, ...rest] = suggestions;
  if (typeof first === 'string') {
    return [{ name: `${first}    ${CHAIN_HINT}`, data: first }, ...rest];
  }

  return [
    {
      ...first,
      name: `${first.name}    ${CHAIN_HINT}`,
    },
    ...rest,
  ];
}

function trackCommandsFromSegment(
  segment: string,
  isBindingSegment: boolean,
  bindingAlias?: string,
  bindingValue?: string,
  ignoreSelection: boolean = false,
  availabilityContext?: SelectionAvailabilityContext
): Record<string, string> {
  const commands: Record<string, string> = {};

  if (isBindingSegment && bindingAlias && bindingValue !== undefined) {
    const matchedBindingCmd = ignoreSelection
      ? findCommandIgnoringSelection(bindingAlias)
      : findCommand(bindingAlias, availabilityContext)[0];
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
      : findCommand(part, availabilityContext)[0];
    if (matchedCommand) {
      if (matchedCommand.type === 'commandWithoutValue') {
        commands[matchedCommand.name] = '';
      } else {
        const hasHex = VALUE_FORMAT_REGEX.hex.exec(part);
        const numberValue = extractValue(part, 'number');
        if (hasHex && matchedCommand.valueFormat === 'hex') {
          commands[matchedCommand.name] = hasHex[0];
        } else if (numberValue !== null && matchedCommand.valueFormat === 'number') {
          // Preserve delta operator (e.g. "w+10" tracked as "+10") and
          // comma lists (e.g. "p20,30" tracked as "20,30").
          const deltaMatch = part.match(/^-?[\p{L}][\p{L}-]*\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)\s*$/u);
          const listMatch = part.match(/^-?[\p{L}][\p{L}-]*\s*(-?\d+(?:\.\d+)?(?:,-?\d+(?:\.\d+)?)+)\s*$/u);
          if (deltaMatch) {
            commands[matchedCommand.name] = `${deltaMatch[1]}${deltaMatch[2]}`;
          } else if (listMatch) {
            commands[matchedCommand.name] = listMatch[1];
          } else {
            commands[matchedCommand.name] = numberValue;
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
  for (const item of suggestions) {
    if (typeof item === 'string') {
      if (!isInformationalSuggestion(item)) return item;
    } else if (item && typeof item.data === 'string') {
      return item.data;
    }
  }
  return null;
}

function isStatusOnly(suggestions: Array<string | { data: unknown }>): boolean {
  return suggestions.length > 0 &&
    suggestions.every(item => typeof item === 'string' && isInformationalSuggestion(item));
}

function getEmptyBindingMessage(command: (typeof COMMANDS)[0]): string {
  const support = command.bindingSupport;
  if (support?.libraries) return 'No matching libraries found';
  if (support?.instanceProperties) return 'No matching properties';
  if (support?.instanceSwap) return 'No matching components';
  if (support?.instanceOverrides) return 'No matching overrides';
  return 'No matching styles or variables found';
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

  // Check if we should use the dropdown value. A status row ("No components
  // found…") is never a value, whatever Figma submits.
  const pickedValue = getDropdownValue(
    parameters,
    isOnlyBinding,
    isLastBinding
  );
  const dropdownValue = pickedValue && !isInformationalSuggestion(pickedValue) ? pickedValue : null;
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
      const suggestions = await generateBindingSuggestions(matchedCommand, valueToUse);
      const name = getFirstSuggestionName(suggestions);
      if (name) {
        valueToUse = name;
      } else if (isStatusOnly(suggestions)) {
        figma.notify(suggestions[0] as string);
        return;
      }
    }
  }

  await executeCommand(`${parsed.alias} ${valueToUse}`, true);
}

// ================================
// Input Handler Helpers
// ================================

// Handle binding mode suggestions (cmd?searchTerm pattern)
async function handleBindingMode(
  segment: string,
  result: ParameterInputEvent['result'],
  getAvailabilityContext: () => SelectionAvailabilityContext
): Promise<boolean> {
  const typed = parseTypedBindingSegment(segment, isBindingCommandAlias);
  if (!typed) return false;

  const matchedCommand = findCommand(typed.alias, getAvailabilityContext())[0];

  if (!matchedCommand?.bindingSupport) return false;

  const suggestions = await generateBindingSuggestions(matchedCommand, typed.searchTerm);

  // setError keeps Enter from submitting a status row as a value.
  if (suggestions.length === 0) {
    result.setError(getEmptyBindingMessage(matchedCommand));
    return true;
  }
  if (isStatusOnly(suggestions)) {
    result.setError(suggestions[0] as string);
    return true;
  }

  result.setSuggestions(
    supportsCatalogBindingSearch(matchedCommand)
      ? addChainHintToFirstSuggestion(suggestions)
      : suggestions
  );
  return true;
}

// Track commands from previous segments to show "already set" indicators
function trackPreviousCommands(
  previousSegments: string[],
  currentSegmentParts: string[],
  availabilityContext: SelectionAvailabilityContext
): Record<string, string> {
  const commands: Record<string, string> = {};

  // Process previous segments
  for (const segment of previousSegments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;

    const parsed = parseBindingSegment(trimmed);
    if (parsed) {
      if (parsed.prefix) {
        Object.assign(commands, trackCommandsFromSegment(parsed.prefix, false, undefined, undefined, false, availabilityContext));
      }
      Object.assign(commands, trackCommandsFromSegment('', true, parsed.alias, parsed.value, false, availabilityContext));
    } else {
      Object.assign(commands, trackCommandsFromSegment(trimmed, false, undefined, undefined, false, availabilityContext));
    }
  }

  // Process previous parts in current segment
  for (const part of currentSegmentParts) {
    Object.assign(commands, trackCommandsFromSegment(part, false, undefined, undefined, false, availabilityContext));
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
  result: ParameterInputEvent['result'],
  getAvailabilityContext: () => SelectionAvailabilityContext
): Promise<void> {
  // If query is empty or ends with space, show all commands
  if (!query || query.endsWith(' ')) {
    const availabilityContext = query.trim()
      ? getAvailabilityContext()
      : createSelectionAvailabilityContext([]);
    const baseSuggestions = getCommandSuggestions(
      COMMANDS,
      '',
      undefined,
      true,
      previousCommands,
      availabilityContext
    );

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
  const availabilityContext = getAvailabilityContext();
  const matchedCommand = findCommand(currentPart, availabilityContext)[0] ||
    (Object.keys(previousCommands).length > 0 ? findExactCommandIgnoringSelection(currentPart) : undefined);
  const numberValue = extractValue(currentPart, 'number');
  const hasHex = VALUE_FORMAT_REGEX.hex.exec(currentPart);

  if (matchedCommand) {
    handleMatchedCommand(
      matchedCommand,
      currentPart,
      completeCommands,
      previousCommands,
      numberValue,
      hasHex,
      result,
      availabilityContext
    );
  } else {
    handleUnmatchedCommand(currentPart, result, availabilityContext);
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
  const steps = buildExecutionPlan(segments, isBindingCommandAlias);
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
  numberValue: string | null,
  hasHex: RegExpExecArray | null,
  result: ParameterInputEvent['result'],
  availabilityContext: SelectionAvailabilityContext
): void {
  const isValidValue =
    (matchedCommand.type === "commandWithValue" || matchedCommand.type === "optionalValueCommand") &&
    'valueFormat' in matchedCommand && (
      matchedCommand.valueFormat === 'hex' ? hasHex :
        matchedCommand.valueFormat === 'number' ? numberValue !== null : true
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
  if (isValidValue && (hasHex || numberValue !== null)) {
    if (matchedCommand.valueFormat === 'hex' && hasHex) {
      completeCommands.push(`${matchedCommand.name}:${hasHex[0]}`);
      suggestions[0] = completeCommands.join(' | ');
    } else if (matchedCommand.valueFormat === 'number' && numberValue !== null) {
      // Preserve delta operator (e.g. "w+10" → "Width:+10") and comma lists
      // (e.g. "p20,30" → "Padding:20,30") so the summary round-trips correctly
      // through executeCommand's normalization.
      const deltaMatch = currentPart.match(/^-?[\p{L}][\p{L}-]*\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)\s*$/u);
      const listMatch = currentPart.match(/^-?[\p{L}][\p{L}-]*\s*(-?\d+(?:\.\d+)?(?:,-?\d+(?:\.\d+)?)+)\s*$/u);
      if (deltaMatch) {
        completeCommands.push(`${matchedCommand.name}:${deltaMatch[1]}${deltaMatch[2]}`);
      } else if (listMatch) {
        completeCommands.push(`${matchedCommand.name}:${listMatch[1]}`);
      } else {
        completeCommands.push(`${matchedCommand.name}:${numberValue}`);
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
  const relatedSuggestions = getCommandSuggestions(
    COMMANDS,
    currentPart,
    matchedCommand,
    false,
    previousCommands,
    availabilityContext
  );
  result.setSuggestions([...suggestions, ...relatedSuggestions]);
}

// Handle suggestions when no command is matched
function handleUnmatchedCommand(
  currentPart: string,
  result: ParameterInputEvent['result'],
  availabilityContext: SelectionAvailabilityContext
): void {
  const cmdLower = currentPart.toLowerCase();
  const allMatching = COMMANDS.filter(cmd =>
    cmd.name.toLowerCase().includes(cmdLower) ||
    cmd.alias.some(a => a.toLowerCase().includes(cmdLower))
  );

  if (allMatching.length === 0) {
    result.setSuggestions([`No command found for "${currentPart}"`]);
    return;
  }

  const available = allMatching.filter(cmd =>
    isCommandAvailableForSelectionWithContext(cmd, availabilityContext)
  );

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

    let availabilityContext: SelectionAvailabilityContext | null = null;
    const getAvailabilityContext = () => {
      if (!availabilityContext) {
        availabilityContext = createSelectionAvailabilityContext(figma.currentPage.selection);
      }
      return availabilityContext;
    };
    const segments = query.split(COMMAND_BREAK_PATTERN);
    const currentSegment = segments[segments.length - 1];
    const previousSegments = segments.slice(0, -1);

    // Try binding mode first
    if (await handleBindingMode(currentSegment, result, getAvailabilityContext)) return;

    // History command shows recent sequences instead of related commands.
    // Only trigger when the History command is the entire input — chains like
    // "w100  hi" should not hijack suggestions.
    if (previousSegments.length === 0 && isHistoryInvocation(currentSegment, currentSegment.trim() ? getAvailabilityContext() : undefined)) {
      await handleHistoryCommand(result);
      return;
    }

    // Normal mode
    const parts = currentSegment.split(' ');
    const currentPart = parts[parts.length - 1];
    const previousCommands = previousSegments.length > 0 || parts.length > 1
      ? trackPreviousCommands(previousSegments, parts.slice(0, -1), getAvailabilityContext())
      : {};

    await handleNormalMode(query, currentPart, previousCommands, result, getAvailabilityContext);
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
  const executionPlan = buildExecutionPlan(segments, isBindingCommandAlias);
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
      const commandPart = cmd.match(COMMAND_PART_REGEX)?.[0];
      const hasExplicitValue = !!commandPart && cmd.slice(commandPart.length).trim().length > 0;

      if (command.type === 'commandWithValue') {
        if (!value) {
          figma.notify(`No value provided for ${command.name}`);
          return;
        }
        await command.functionWithParam(value);
      } else if (command.type === 'optionalValueCommand') {
        if (value) {
          await command.functionWithParam(value);
        } else if (hasExplicitValue) {
          figma.notify(`Invalid value for ${command.name}`);
          return;
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
