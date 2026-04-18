import type { ValueFormat } from './types';
import { COMMANDS } from './commands';
import {
  findCommand,
  getCommandSuggestions,
  extractValue,
  calculateExpression,
  checkSpecialConditions,
  VALUE_FORMAT_REGEX,
  COMMAND_SPLITTER_REGEX,
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
import * as impl from './implementations';

let originalInput = '';

function getSuggestionDataKey(item: string | { data: unknown }): string | null {
  if (typeof item === 'string') return item;
  if (item && typeof item.data === 'string') return item.data;
  return null;
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
  // Libraries don't benefit — they're a selection list, not an action.
  if (matchedCommand.bindingSupport?.libraries) return [];

  const recents = await getRecentValues(matchedCommand.name);
  if (recents.length === 0) return [];

  const { active, prefix, committed } = splitActiveSearch(matchedCommand, searchTerm);
  const activeLower = active.toLowerCase();

  const existingKeys = new Set(
    existing.map(getSuggestionDataKey).filter((k): k is string => k !== null)
  );

  return recents
    .filter(r => !committed.has(r))
    .filter(r => !activeLower || r.toLowerCase().includes(activeLower))
    .filter(r => !existingKeys.has(prefix + r))
    .map(r => ({ name: `${r} (recent)`, data: prefix + r }));
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
    return recentItems.length > 0 ? [...recentItems, ...suggestions] : suggestions;
  } catch (error) {
    console.error('Error searching:', error);
    return [];
  }
}

function trackCommandsFromSegment(
  segment: string,
  isBindingSegment: boolean,
  bindingAlias?: string,
  bindingValue?: string
): Record<string, string> {
  const commands: Record<string, string> = {};

  if (isBindingSegment && bindingAlias && bindingValue !== undefined) {
    const matchedBindingCmd = findCommand(bindingAlias)[0];
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
    const matchedCommand = findCommand(part)[0];
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
      ? valueToUse.split(',').map(v => v.trim()).filter(Boolean)
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

// Handle normal mode suggestions (space-separated commands)
function handleNormalMode(
  query: string,
  currentPart: string,
  previousCommands: Record<string, string>,
  result: ParameterInputEvent['result']
): void {
  // If query is empty or ends with space, show all commands
  if (!query || query.endsWith(' ')) {
    result.setSuggestions(getCommandSuggestions(COMMANDS, '', undefined, true, previousCommands));
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
  const available = allMatching.filter(cmd => {
    const supportsNodes = !cmd.supportedNodes || selection.length === 0 ||
      selection.every(node => cmd.supportedNodes!.includes(node.type));
    const meetsConditions = !cmd.specialConditions || selection.length === 0 ||
      selection.every(node => checkSpecialConditions(node, cmd.specialConditions!));
    return supportsNodes && meetsConditions;
  });

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

    // Normal mode
    const parts = currentSegment.split(' ');
    const currentPart = parts[parts.length - 1];
    const previousCommands = trackPreviousCommands(previousSegments, parts.slice(0, -1));

    handleNormalMode(query, currentPart, previousCommands, result);
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
          parameters.parameters || {},
          totalBindings === 1,
          bindingIndex === totalBindings - 1
        );
        bindingIndex += 1;
      }
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
