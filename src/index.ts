// ==========================
// Figma Keyboard Commands Plugin
// ==========================
// Main entry point for command parsing, suggestion generation, and execution.
// Supports:
//   - Simple commands (e.g., "w100" for width)
//   - Binding mode with live search (e.g., "f?sky" for fill styles matching "sky")
//   - Command chaining with double-space delimiter (e.g., "w100  h200  f?blue")

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

// Store original user input for command execution
let originalInput = '';

// ================
// Helper Functions
// ================



/**
 * Generate suggestions for binding mode commands (commands with "?" suffix).
 * Routes to appropriate search based on binding support:
 *   - libraries: Search stored libraries by name
 *   - instanceProperties: Search component properties (variants, text, instance swap)
 *   - instanceSwap: Search components for swapping
 *   - styles/variables: Search local and library styles/variables
 */
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

/**
 * Extract and track executed commands from a segment for summary display.
 * Maps command names to their values (e.g., {"Width": "100", "Fill": "#ff0000"}).
 * Used to show "already set" indicators and build command summaries.
 */
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

/**
 * Parse command segments into simple and binding commands.
 * Simple commands: Direct execution (e.g., "w100", "abs")
 * Binding commands: Interactive search mode with "?" (e.g., "f?blue", "ip?Icon")
 */
interface SegmentParseResult {
  simpleCommands: string[];
  bindingSegments: Array<{ segment: string; alias: string }>;
}

function parseCommandSegments(segments: string[]): SegmentParseResult {
  const simpleCommands: string[] = [];
  const bindingSegments: Array<{ segment: string; alias: string }> = [];

  segments.forEach(segment => {
    const trimmedSegment = segment.trim();
    if (!trimmedSegment) return;

    const bindingModeMatch = trimmedSegment.match(/^(.*?)\s*([a-z]+)\?(.*)$/i);

    if (bindingModeMatch) {
      const [, previousCommandsStr, cmdAlias] = bindingModeMatch;

      // Add any simple commands that come before the binding command in this segment
      if (previousCommandsStr.trim()) {
        const prevCmds = previousCommandsStr.trim().split(COMMAND_SPLITTER_REGEX).filter(Boolean);
        simpleCommands.push(...prevCmds);
      }

      // Store this binding segment for later execution
      bindingSegments.push({ segment: trimmedSegment, alias: cmdAlias });
    } else {
      // Normal mode: this segment contains only simple commands
      const cmds = trimmedSegment.split(COMMAND_SPLITTER_REGEX).filter(Boolean);
      simpleCommands.push(...cmds);
    }
  });

  return { simpleCommands, bindingSegments };
}

/**
 * Determine if the user selected a suggestion from the dropdown.
 * Differentiates between:
 *   - Dropdown selection (formatted suggestion)
 *   - User-typed value (raw search term)
 * Returns selected value or null to trigger auto-search.
 */
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

/**
 * Execute a binding command with intelligent value resolution.
 * 1. Use dropdown selection if available
 * 2. Otherwise auto-select first search result for typed value
 * 3. Execute the resolved command
 */
async function executeBindingCommand(
  bindingSegment: { segment: string; alias: string },
  parameters: { command?: string },
  isOnlySegment: boolean,
  isLastSegment: boolean
): Promise<void> {
  const { segment, alias } = bindingSegment;

  const bindingMatch = segment.match(/^(.*?)\s*([a-z]+)\?(.*)$/i);
  if (!bindingMatch) return;

  const [, , cmdAlias, rawValue] = bindingMatch;
  const matchedCommand = findCommand(cmdAlias)[0];

  let valueToUse = rawValue.trim();
  let isDropdownSelection = false;

  // Check if we should use the dropdown value
  const dropdownValue = getDropdownValue(parameters, isOnlySegment, isLastSegment);
  if (dropdownValue) {
    valueToUse = dropdownValue;
    isDropdownSelection = true;
  }

  // Auto-select first search result when user types a value without selecting from dropdown
  if (!isDropdownSelection && matchedCommand?.bindingSupport) {
    const suggestions = await generateBindingSuggestions(matchedCommand, valueToUse);

    if (suggestions.length > 0) {
      const firstResult = suggestions[0];
      if (typeof firstResult === 'object' && 'name' in firstResult) {
        valueToUse = firstResult.name;
      } else if (typeof firstResult === 'string') {
        valueToUse = firstResult;
      }
    }
  }

  // Build final command string and execute
  const fullCommand = `${cmdAlias} ${valueToUse}`;
  await executeCommand(fullCommand, true);
}

// ================
// Input Handler Setup
// ================
// Manages the suggestion system as user types commands.
// Handles both normal mode (simple commands) and binding mode (interactive search).

// Track current handler for cleanup
let currentInputHandler: ((event: ParameterInputEvent) => void) | null = null;

function setupInputHandler() {
  // Remove existing handler to prevent duplicates
  if (currentInputHandler) {
    figma.parameters.off('input', currentInputHandler);
  }

  // Create input handler for real-time suggestion generation
  currentInputHandler = async ({ key, query, result }) => {
    if (key !== 'command') return;
    originalInput = query;

    // Split input by double-space for command chaining (e.g., "w100  h200")
    const segments = query.split(COMMAND_BREAK_PATTERN);
    const currentSegment = segments[segments.length - 1];
    const previousSegments = segments.slice(0, -1);

    // Detect binding mode pattern: "cmdAlias?searchTerm" or "w100 f?blue"
    const bindingModeMatch = currentSegment.match(/^(.*?)\s+([a-z]+)\?(.*)$/i);
    const simpleBindingMatch = currentSegment.match(/^([a-z]+)\?(.*)$/i);

    // Binding mode: Show live search suggestions
    if (bindingModeMatch || simpleBindingMatch) {
      // Parse command alias and search term from binding pattern
      const cmdAlias = bindingModeMatch ? bindingModeMatch[2] : simpleBindingMatch![1];
      const searchTerm = bindingModeMatch ? bindingModeMatch[3] : simpleBindingMatch![2];
      const matchedCommand = findCommand(cmdAlias)[0];

      if (matchedCommand?.bindingSupport) {
        const suggestions = await generateBindingSuggestions(matchedCommand, searchTerm);

        if (suggestions.length > 0) {
          result.setSuggestions(suggestions);
          return;
        } else {
          const message = matchedCommand.bindingSupport.libraries
            ? 'No matching libraries found'
            : 'No matching styles or variables found';
          result.setSuggestions([message]);
          return;
        }
      }
    }

    // Normal mode: Parse space-separated simple commands
    const parts = currentSegment.split(' ');
    const currentPart = parts[parts.length - 1];

    // Track all previously executed commands for "already set" indicators
    const previousCommands: Record<string, string> = {};

    // Process previous segments
    previousSegments.forEach(segment => {
      const trimmedSegment = segment.trim();
      if (!trimmedSegment) return;

      const bindingMatch = trimmedSegment.match(/^(.*?)\s*([a-z]+)\?(.*)$/i);

      if (bindingMatch) {
        const [, previousInSegment, cmdAlias, value] = bindingMatch;

        // Process simple commands before the binding command
        if (previousInSegment.trim()) {
          const tracked = trackCommandsFromSegment(previousInSegment.trim(), false);
          Object.assign(previousCommands, tracked);
        }

        // Track the binding command itself
        const bindingTracked = trackCommandsFromSegment('', true, cmdAlias, value);
        Object.assign(previousCommands, bindingTracked);
      } else {
        // Normal segment with only simple commands
        const tracked = trackCommandsFromSegment(trimmedSegment, false);
        Object.assign(previousCommands, tracked);
      }
    });

    // Process previous commands in current segment
    parts.slice(0, -1).forEach(part => {
      const tracked = trackCommandsFromSegment(part, false);
      Object.assign(previousCommands, tracked);
    });

    // If query is empty or ends with space, show all commands
    if (!query || query.endsWith(' ')) {
      result.setSuggestions(getCommandSuggestions(COMMANDS, '', undefined, true, previousCommands));
      return;
    }

    // Build summary of all commands (e.g., "Width:100 | Height:200 | Fill:#ff0000")
    const completeCommands: (string | undefined)[] = Object.entries(previousCommands).map(([name, value]) => {
      return value ? `${name}:${value}` : name;
    });

    // Handle the current command being typed
    const matchedCommand = findCommand(currentPart)[0];
    const hasNumber = VALUE_FORMAT_REGEX.number.exec(currentPart);
    const hasHex = VALUE_FORMAT_REGEX.hex.exec(currentPart);

    if (matchedCommand) {
      const isValidValue =
        (matchedCommand.type === "commandWithValue" || matchedCommand.type === "optionalValueCommand") &&
        'valueFormat' in matchedCommand && (
          matchedCommand.valueFormat === 'hex' ? hasHex :
            matchedCommand.valueFormat === 'number' ? hasNumber :
              true
        );

      let suggestions: string[] = [];

      // Show "already set" indicator if command was used earlier in chain
      if (
        matchedCommand.name.toLowerCase().includes(currentPart.toLowerCase()) ||
        matchedCommand.alias.some(alias => alias.toLowerCase().includes(currentPart.toLowerCase()))
      ) {
        const previousCommand = previousCommands[matchedCommand.name];
        const suggestion = previousCommand
          ? `ℹ️ already set to '${previousCommand}'`
          : matchedCommand.suggestion;
        suggestions.push(`${matchedCommand.alias.join(', ')} · ${matchedCommand.name} -- ${suggestion}`);
      }

      // Display computed values in suggestion (e.g., "100*2" → "200")
      if (isValidValue && (hasHex || hasNumber)) {
        if (matchedCommand.valueFormat === 'hex' && hasHex) {
          completeCommands.push(`${matchedCommand.name}:${hasHex[0]}`);
          suggestions[0] = completeCommands.join(' | ');
        } else if (matchedCommand.valueFormat === 'number' && hasNumber) {
          try {
            const computedValue = calculateExpression(hasNumber[0]);
            completeCommands.push(`${matchedCommand.name}:${computedValue}`);
            suggestions[0] = completeCommands.join(' | ');
          } catch {
            completeCommands.push(`${matchedCommand.name}:${hasNumber[0]}`);
            suggestions[0] = completeCommands.join(' | ');
          }
        }
      }

      if (matchedCommand.type === 'commandWithoutValue') {
        if (completeCommands.length === 0 && matchedCommand.suggestion) {
          completeCommands.push(`${matchedCommand.name} -- ${matchedCommand.suggestion}`);
        } else {
          completeCommands.push(`${matchedCommand.name}`);
        }
        suggestions[0] = completeCommands.join(' | ');
      }

      // Show related commands as additional suggestions
      const relatedSuggestions = getCommandSuggestions(COMMANDS, currentPart, matchedCommand, false, previousCommands);
      suggestions = [...suggestions, ...relatedSuggestions];

      result.setSuggestions(suggestions);
    } else {
      // No exact match: Search for similar command names
      const allMatchingCommands = COMMANDS.filter(cmd => {
        const nameLower = cmd.name.toLowerCase();
        const cmdLower = currentPart.toLowerCase();
        return (
          nameLower.includes(cmdLower) ||
          cmd.alias.some(alias => alias.toLowerCase().includes(cmdLower))
        );
      });

      if (allMatchingCommands.length === 0) {
        result.setSuggestions([`No command found for "${currentPart}"`]);
      } else {
        // Check if matching commands are valid for current selection
        const availableCommands = allMatchingCommands.filter(cmd => {
          const selection = figma.currentPage.selection;

          const supportsNodeTypes = !cmd.supportedNodes || selection.length === 0 ||
            selection.every(node => cmd.supportedNodes!.indexOf(node.type) !== -1);

          const meetsSpecialConditions = !cmd.specialConditions || selection.length === 0 ||
            selection.every(node => checkSpecialConditions(node, cmd.specialConditions!));

          return supportsNodeTypes && meetsSpecialConditions;
        });

        if (availableCommands.length === 0) {
          const suggestions = allMatchingCommands.map(cmd => `'${cmd.name}' not available on selection`);
          result.setSuggestions(suggestions);
        } else {
          result.setSuggestions([`No command found for "${currentPart}"`]);
        }
      }
    }
  };

  // Attach handler to Figma's parameter input system
  figma.parameters.on('input', currentInputHandler);
}

// Initialize input handler on plugin load
setupInputHandler();

// Note: Handler checks selection dynamically, so no recreation needed on selection change

// ===================
// Command Execution Entry Point
// ===================
// Triggered when user presses Enter to execute commands
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

// =================
// Command Executor
// =================
// Core execution logic for all command types
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

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const loadingNotification = skipNotification ? null : figma.notify(`Executing command(s)...`, { timeout: 0 });

  try {
    await delay(1);

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
    await delay(1);
    if (loadingNotification) {
      loadingNotification.cancel();
    }
  }
}

