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
import { searchLibraries } from './implementations/library';
import * as impl from './implementations';
import { getIconWithOpacity, getIconWithColor } from './icons';

let originalInput = '';

// ================================
// Shared Binding Pattern Utilities
// ================================

const BINDING_PATTERN = /^(.*?)\s*([a-z]+)\?(.*)$/i;
const SIMPLE_BINDING_PATTERN = /^([a-z]+)\?(.*)$/i;

interface ParsedBinding {
  prefix: string;
  alias: string;
  value: string;
}

function parseBindingSegment(segment: string): ParsedBinding | null {
  const match = segment.match(BINDING_PATTERN);
  if (!match) return null;
  return { prefix: match[1].trim(), alias: match[2], value: match[3] };
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

    return suggestions;
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
          try {
            const computedValue = calculateExpression(hasNumber[0]);
            commands[matchedCommand.name] = computedValue.toString();
          } catch {
            commands[matchedCommand.name] = hasNumber[0];
          }
        }
      }
    }
  });

  return commands;
}

interface SegmentParseResult {
  simpleCommands: string[];
  bindingSegments: Array<{ segment: string; alias: string }>;
}

function parseCommandSegments(segments: string[]): SegmentParseResult {
  const simpleCommands: string[] = [];
  const bindingSegments: Array<{ segment: string; alias: string }> = [];

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;

    const parsed = parseBindingSegment(trimmed);
    if (parsed) {
      // Add any simple commands that come before the binding command
      if (parsed.prefix) {
        simpleCommands.push(...parsed.prefix.split(COMMAND_SPLITTER_REGEX).filter(Boolean));
      }
      bindingSegments.push({ segment: trimmed, alias: parsed.alias });
    } else {
      // Normal segment with only simple commands
      simpleCommands.push(...trimmed.split(COMMAND_SPLITTER_REGEX).filter(Boolean));
    }
  }

  return { simpleCommands, bindingSegments };
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

// Extract color identifier from suggestion text (strips usage info)
// "ColorName (Type) - X uses in locations" -> "ColorName (Type)"
function extractColorIdentifier(text: string): string {
  return text.replace(/\s-\s\d+\suses?.*$/, '').trim();
}

// Extract the first suggestion's name from suggestion results
function getFirstSuggestionName(suggestions: Array<string | { name: string; data: unknown }>): string | null {
  if (suggestions.length === 0) return null;
  const first = suggestions[0];
  if (typeof first === 'object' && 'name' in first) return extractColorIdentifier(first.name);
  if (typeof first === 'string') return extractColorIdentifier(first);
  return null;
}

// Resolve two-stage color selection (e.g., "source :: target")
async function resolveTwoStageValue(
  rawValue: string,
  command: (typeof COMMANDS)[0]
): Promise<string> {
  const [sourceSearch, targetSearch] = rawValue.split('::').map(s => s.trim());

  // Auto-select source
  const sourceSuggestions = await generateBindingSuggestions(command, sourceSearch);
  const resolvedSource = getFirstSuggestionName(sourceSuggestions) || sourceSearch;

  // Auto-select target using stage 2 context
  const targetSuggestions = await generateBindingSuggestions(command, `${sourceSearch} :: ${targetSearch}`);
  const resolvedTarget = getFirstSuggestionName(targetSuggestions) || targetSearch;

  return `${resolvedSource} :: ${resolvedTarget}`;
}

async function executeBindingCommand(
  bindingSegment: { segment: string; alias: string },
  parameters: { command?: string },
  isOnlySegment: boolean,
  isLastSegment: boolean
): Promise<void> {
  const parsed = parseBindingSegment(bindingSegment.segment);
  if (!parsed) return;

  const matchedCommand = findCommand(parsed.alias)[0];
  const rawValue = parsed.value.trim();
  const hasDelimiter = rawValue.includes('::');

  // Check if we should use the dropdown value
  const dropdownValue = getDropdownValue(parameters, isOnlySegment, isLastSegment);
  let valueToUse = rawValue;
  let isDropdownSelection = false;

  if (dropdownValue) {
    if (!hasDelimiter || dropdownValue.includes('::')) {
      valueToUse = dropdownValue;
      isDropdownSelection = true;
    } else {
      // Two-stage: preserve source, use dropdown as target
      const source = rawValue.split('::')[0].trim();
      valueToUse = `${source} :: ${dropdownValue}`;
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
}

// ================================
// Input Handler Helpers
// ================================

// Handle binding mode suggestions (cmd?searchTerm pattern)
async function handleBindingMode(
  segment: string,
  result: ParameterInputEvent['result']
): Promise<boolean> {
  // Check for binding patterns
  const complexMatch = segment.match(/^(.*?)\s+([a-z]+)\?(.*)$/i);
  const simpleMatch = segment.match(SIMPLE_BINDING_PATTERN);

  if (!complexMatch && !simpleMatch) return false;

  const cmdAlias = complexMatch ? complexMatch[2] : simpleMatch![1];
  const searchTerm = complexMatch ? complexMatch[3] : simpleMatch![2];
  const matchedCommand = findCommand(cmdAlias)[0];

  if (!matchedCommand?.bindingSupport) return false;

  const suggestions = await generateBindingSuggestions(matchedCommand, searchTerm);
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

  let suggestions: Array<string | { name: string; data: string; icon?: string }> = [];

  // Show "already set" indicator if command was used earlier
  if (
    matchedCommand.name.toLowerCase().includes(currentPart.toLowerCase()) ||
    matchedCommand.alias.some(alias => alias.toLowerCase().includes(currentPart.toLowerCase()))
  ) {
    const previousValue = previousCommands[matchedCommand.name];
    const hint = previousValue ? `already set to '${previousValue}'` : matchedCommand.suggestion;
    const suggestionText = `${matchedCommand.alias.join(', ')} · ${matchedCommand.name} -- ${hint}`;

    // Get icon with 80% opacity for the first result (more prominent than others at 40%)
    const icon = matchedCommand.icon ? getIconWithColor(matchedCommand.icon, '#BC3114', 1.0) : undefined;

    if (icon) {
      suggestions.push({ name: suggestionText, data: suggestionText, icon });
    } else {
      suggestions.push(suggestionText);
    }
  }

  // Display computed values in suggestion
  if (isValidValue && (hasHex || hasNumber)) {
    if (matchedCommand.valueFormat === 'hex' && hasHex) {
      completeCommands.push(`${matchedCommand.name}:${hasHex[0]}`);
      const newText = completeCommands.join(' | ');
      // Preserve icon if first suggestion had one
      if (suggestions[0] && typeof suggestions[0] === 'object') {
        suggestions[0] = { ...suggestions[0], name: newText, data: newText };
      } else {
        suggestions[0] = newText;
      }
    } else if (matchedCommand.valueFormat === 'number' && hasNumber) {
      try {
        completeCommands.push(`${matchedCommand.name}:${calculateExpression(hasNumber[0])}`);
      } catch {
        completeCommands.push(`${matchedCommand.name}:${hasNumber[0]}`);
      }
      const newText = completeCommands.join(' | ');
      // Preserve icon if first suggestion had one
      if (suggestions[0] && typeof suggestions[0] === 'object') {
        suggestions[0] = { ...suggestions[0], name: newText, data: newText };
      } else {
        suggestions[0] = newText;
      }
    }
  }

  if (matchedCommand.type === 'commandWithoutValue') {
    completeCommands.push(
      completeCommands.length === 0 && matchedCommand.suggestion
        ? `${matchedCommand.name} -- ${matchedCommand.suggestion}`
        : matchedCommand.name
    );
    const newText = completeCommands.join(' | ');
    // Preserve icon if first suggestion had one
    if (suggestions[0] && typeof suggestions[0] === 'object') {
      suggestions[0] = { ...suggestions[0], name: newText, data: newText };
    } else {
      suggestions[0] = newText;
    }
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
  const commandString = originalInput.trim();

  // Parse command chain (e.g., "w100  h200  f?blue" → 3 segments)
  const segments = commandString.split(COMMAND_BREAK_PATTERN);

  // Separate simple commands from binding commands for execution
  const { simpleCommands, bindingSegments } = parseCommandSegments(segments);

  try {
    // Execute simple commands first (direct execution)
    for (const cmd of simpleCommands) {
      await executeCommand(cmd, true);
    }

    // Execute binding commands with value resolution
    if (bindingSegments.length > 0) {

      for (let i = 0; i < bindingSegments.length; i++) {
        const bindingSegment = bindingSegments[i];
        const isOnlySegment = bindingSegments.length === 1;
        const isLastSegment = i === bindingSegments.length - 1;

        await executeBindingCommand(
          bindingSegment,
          parameters.parameters || {},
          isOnlySegment,
          isLastSegment
        );
      }
    }

    figma.closePlugin();
  } catch (error) {
    figma.notify(error instanceof Error ? error.message : 'An unknown error occurred');
    figma.closePlugin();
  }
});

async function executeCommand(cmd: string, skipNotification: boolean = false): Promise<void> {
  if (!cmd) {
    return;
  }

  // Extract command from suggestion text (remove aliases, descriptions, etc.)
  const cleanCmd = cmd.split('•')[0]  // Remove everything after the bullet point
    .split(',')[0]    // Take only the first part before any comma
    .trim();          // Remove whitespace

  const command = findCommand(cleanCmd)[0];

  if (!command) {
    return;
  }

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

