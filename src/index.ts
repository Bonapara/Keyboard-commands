// ==========================
// Plugin Entry Point
// ==========================

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

// Global state
let originalInput = '';

// ================
// Helper Functions
// ================

/**
 * Find command for binding mode (with ?).
 * Special handling: 'b' and 'st' map to StrokeColor in binding mode instead of Stroke.
 */
function findCommandForBinding(alias: string): (typeof COMMANDS)[0] | undefined {
  const aliasLower = alias.toLowerCase();

  // Special case: b? and st? should map to StrokeColor, not Stroke
  if (aliasLower === 'b' || aliasLower === 'st') {
    return COMMANDS.find(cmd => cmd.name === 'StrokeColor');
  }

  // For all other aliases, use the normal findCommand
  return findCommand(alias)[0];
}

// ================
// Setup Logic
// ================

// Keep track of the current input handler so we can remove it
let currentInputHandler: ((event: ParameterInputEvent) => void) | null = null;

function setupInputHandler() {
  // If there's an existing handler, remove it
  if (currentInputHandler) {
    figma.parameters.off('input', currentInputHandler);
  }

  // Define a new handler
  currentInputHandler = async ({ key, query, result }) => {
    if (key !== 'command') return;
    originalInput = query;

    // Split by double space to support command chaining
    // This allows "ip?icon:user  f? color primary" to work
    const segments = query.split(COMMAND_BREAK_PATTERN);
    const currentSegment = segments[segments.length - 1];
    const previousSegments = segments.slice(0, -1);

    // Check for binding mode in the current segment
    // Pattern: "cmd?" or "previous commands cmd?"
    const bindingModeMatch = currentSegment.match(/^(.*?)\s+([a-z]+)\?(.*)$/i);

    if (bindingModeMatch) {
      const [, _previousCommandsStr, cmdAlias, searchTerm] = bindingModeMatch;
      const matchedCommand = findCommandForBinding(cmdAlias);

      if (matchedCommand?.bindingSupport) {
        try {
          let suggestions: Array<string | { name: string; data: unknown }> = [];

          // Handle library search
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
        } catch (error) {
          console.error('Error searching:', error);
        }
      }
    }

    // Check for binding mode at the start of the current segment (no previous commands in segment)
    const simpleBindingMatch = currentSegment.match(/^([a-z]+)\?(.*)$/i);

    if (simpleBindingMatch) {
      const [, cmdAlias, searchTerm] = simpleBindingMatch;
      const matchedCommand = findCommandForBinding(cmdAlias);

      if (matchedCommand?.bindingSupport) {
        try {
          let suggestions: Array<string | { name: string; data: unknown }> = [];

          // Handle library search
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
        } catch (error) {
          console.error('Error searching:', error);
        }
      }
    }

    // Normal mode: split current segment by spaces for simple commands
    const parts = currentSegment.split(' ');
    const currentPart = parts[parts.length - 1];

    // Track previous commands from ALL segments (including previous segments)
    const previousCommands: Record<string, string> = {};

    // Process previous segments
    previousSegments.forEach(segment => {
      const trimmedSegment = segment.trim();
      if (!trimmedSegment) return;

      // Check if this segment is a binding command
      const bindingMatch = trimmedSegment.match(/^(.*?)\s*([a-z]+)\?(.*)$/i);

      if (bindingMatch) {
        // This is a binding command - extract and track it
        const [, previousInSegment, cmdAlias, value] = bindingMatch;

        // First process any simple commands before the binding command
        if (previousInSegment.trim()) {
          const prevParts = previousInSegment.trim().split(COMMAND_SPLITTER_REGEX).filter(Boolean);
          prevParts.forEach(part => {
            const matchedCommand = findCommand(part)[0];
            if (matchedCommand) {
              if (matchedCommand.type === 'commandWithoutValue') {
                previousCommands[matchedCommand.name] = '';
              } else {
                const hasHex = VALUE_FORMAT_REGEX.hex.exec(part);
                const hasNumber = VALUE_FORMAT_REGEX.number.exec(part);
                if (hasHex && matchedCommand.valueFormat === 'hex') {
                  previousCommands[matchedCommand.name] = hasHex[0];
                } else if (hasNumber) {
                  try {
                    const computedValue = calculateExpression(hasNumber[0]);
                    previousCommands[matchedCommand.name] = computedValue.toString();
                  } catch {
                    previousCommands[matchedCommand.name] = hasNumber[0];
                  }
                }
              }
            }
          });
        }

        // Now track the binding command itself
        const matchedBindingCmd = findCommandForBinding(cmdAlias);
        if (matchedBindingCmd) {
          previousCommands[matchedBindingCmd.name] = value.trim();
        }
      } else {
        // Normal segment with only simple commands
        const segmentParts = trimmedSegment.split(COMMAND_SPLITTER_REGEX).filter(Boolean);
        segmentParts.forEach(part => {
          const matchedCommand = findCommand(part)[0];
          if (matchedCommand) {
            if (matchedCommand.type === 'commandWithoutValue') {
              previousCommands[matchedCommand.name] = '';
            } else {
              const hasHex = VALUE_FORMAT_REGEX.hex.exec(part);
              const hasNumber = VALUE_FORMAT_REGEX.number.exec(part);
              if (hasHex && matchedCommand.valueFormat === 'hex') {
                previousCommands[matchedCommand.name] = hasHex[0];
              } else if (hasNumber) {
                try {
                  const computedValue = calculateExpression(hasNumber[0]);
                  previousCommands[matchedCommand.name] = computedValue.toString();
                } catch {
                  previousCommands[matchedCommand.name] = hasNumber[0];
                }
              }
            }
          }
        });
      }
    });

    // Process previous commands in current segment
    parts.slice(0, -1).forEach(part => {
      const matchedCommand = findCommand(part)[0];
      if (matchedCommand) {
        if (matchedCommand.type === 'commandWithoutValue') {
          previousCommands[matchedCommand.name] = '';
        } else {
          const hasHex = VALUE_FORMAT_REGEX.hex.exec(part);
          const hasNumber = VALUE_FORMAT_REGEX.number.exec(part);
          if (hasHex && matchedCommand.valueFormat === 'hex') {
            previousCommands[matchedCommand.name] = hasHex[0];
          } else if (hasNumber) {
            try {
              const computedValue = calculateExpression(hasNumber[0]);
              previousCommands[matchedCommand.name] = computedValue.toString();
            } catch {
              previousCommands[matchedCommand.name] = hasNumber[0];
            }
          }
        }
      }
    });

    // If query is empty or ends with space, show all commands
    if (!query || query.endsWith(' ')) {
      result.setSuggestions(getCommandSuggestions(COMMANDS, '', undefined, true, previousCommands));
      return;
    }

    // Build the complete command summary from ALL segments
    // The previousCommands object already includes ALL commands from all segments
    const completeCommands: (string | undefined)[] = Object.entries(previousCommands).map(([name, value]) => {
      return value ? `${name}:${value}` : name;
    });


    // Process current (last) command
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

      // Manage already matched commands
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

      // Handle valid values
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
        // Modified logic here: Show suggestion in summary only if it's the first command
        if (completeCommands.length === 0 && matchedCommand.suggestion) {
          completeCommands.push(`${matchedCommand.name} -- ${matchedCommand.suggestion}`);
        } else {
          completeCommands.push(`${matchedCommand.name}`);
        }
        suggestions[0] = completeCommands.join(' | ');
      }

      // Add related suggestions
      const relatedSuggestions = getCommandSuggestions(COMMANDS, currentPart, matchedCommand, false, previousCommands);
      suggestions = [...suggestions, ...relatedSuggestions];

      result.setSuggestions(suggestions);
    } else {
      // first try to see if a command by that name exists at all
      const allMatchingCommands = COMMANDS.filter(cmd => {
        const nameLower = cmd.name.toLowerCase();
        const cmdLower = currentPart.toLowerCase();
        return (
          nameLower.includes(cmdLower) ||
          cmd.alias.some(alias => alias.toLowerCase().includes(cmdLower))
        );
      });

      // If no command by that name
      if (allMatchingCommands.length === 0) {
        result.setSuggestions([`No command found for "${currentPart}"`]);
      } else {
        // If commands exist but none are valid for current selection
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

  // Register the new handler
  figma.parameters.on('input', currentInputHandler);
}

// Set up the initial input handler
setupInputHandler();

// Whenever the selection changes, we don't need to recreate the entire handler
// The handler already checks selection dynamically when generating suggestions
// This optimization prevents unnecessary handler recreation on every selection change

// ===================
// Main Run Handler
// ===================
figma.on('run', async (parameters) => {
  const commandString = originalInput.trim();

  console.log("parameters", parameters);
  console.log("originalInput", originalInput);

  // Split by double space to handle command chaining
  const segments = commandString.split(COMMAND_BREAK_PATTERN);

  // Track all simple commands and binding commands from all segments
  const allSimpleCommands: string[] = [];
  const bindingSegments: Array<{ segment: string, alias: string }> = [];

  // Process each segment to identify binding commands and simple commands
  segments.forEach(segment => {
    const trimmedSegment = segment.trim();
    if (!trimmedSegment) return;

    // Check if this segment contains a binding command
    const bindingModeMatch = trimmedSegment.match(/^(.*?)\s*([a-z]+)\?(.*)$/i);

    if (bindingModeMatch) {
      const [, previousCommandsStr, cmdAlias, searchTerm] = bindingModeMatch;

      console.log("Binding mode detected in segment");
      console.log("Previous commands in segment:", previousCommandsStr);
      console.log("Binding command alias:", cmdAlias);
      console.log("Search term:", searchTerm);

      // Add any simple commands that come before the binding command in this segment
      if (previousCommandsStr.trim()) {
        const prevCmds = previousCommandsStr.trim().split(COMMAND_SPLITTER_REGEX).filter(Boolean);
        allSimpleCommands.push(...prevCmds);
      }

      // Store this binding segment for later execution
      bindingSegments.push({ segment: trimmedSegment, alias: cmdAlias });
    } else {
      // Normal mode: this segment contains only simple commands
      const cmds = trimmedSegment.split(COMMAND_SPLITTER_REGEX).filter(Boolean);
      allSimpleCommands.push(...cmds);
    }
  });

  console.log("allSimpleCommands", allSimpleCommands);
  console.log("bindingSegments", bindingSegments);

  try {
    // Group all command executions into a single undo step for better UX
    // This allows users to undo all commands at once with Cmd+Z

    // Execute all simple commands first
    for (const cmd of allSimpleCommands) {
      console.log("Executing simple command:", cmd);
      await executeCommand(cmd, true);
    }

    // Now handle binding commands
    // For each binding segment, extract the full command (alias + value) and execute it
    if (bindingSegments.length > 0) {
      console.log(`Executing ${bindingSegments.length} binding command(s)`);

      for (const bindingSegment of bindingSegments) {
        const { segment, alias } = bindingSegment;

        // Parse the binding segment to extract the value
        // Format: "cmd?value" or "previous cmds cmd?value"
        const bindingMatch = segment.match(/^(.*?)\s*([a-z]+)\?(.*)$/i);

        if (bindingMatch) {
          const [, , cmdAlias, rawValue] = bindingMatch;
          const matchedCommand = findCommandForBinding(cmdAlias);

          // The rawValue might be a search term or a direct value
          // If parameters.parameters.command exists and matches this segment's context,
          // use that (it's from the dropdown selection)
          // Otherwise, use the typed value directly
          let valueToUse = rawValue.trim();
          let isDropdownSelection = false;

          // Check if this is the segment that triggered the dropdown
          // (when only one binding segment, or the last one, Figma returns the selected value)
          if (parameters.parameters?.command &&
            bindingSegments.length === 1) {
            const dropdownValue = parameters.parameters.command;
            // Make sure it's not the summary string (which contains pipes)
            if (!dropdownValue.includes('|')) {
              valueToUse = dropdownValue;
              isDropdownSelection = true;
            }
          } else if (parameters.parameters?.command &&
            bindingSegment === bindingSegments[bindingSegments.length - 1]) {
            // Last binding segment - might be the dropdown value
            const dropdownValue = parameters.parameters.command;
            // Check if it looks like a selection (not a search term or summary string)
            const isSelection = dropdownValue &&
              (dropdownValue.includes(':') || dropdownValue.includes('(')) &&
              !dropdownValue.includes('|'); // Exclude summary strings
            if (isSelection) {
              valueToUse = dropdownValue;
              isDropdownSelection = true;
            }
          }

          // If no dropdown selection was made and this is a style/variable/component binding,
          // auto-search and use the first result
          if (!isDropdownSelection && matchedCommand?.bindingSupport) {
            console.log(`No dropdown selection, searching for: "${valueToUse}"`);

            try {
              let suggestions: Array<string | { name: string; data: unknown }> = [];

              // Handle different binding types
              if (matchedCommand.bindingSupport.libraries) {
                suggestions = await searchLibraries(valueToUse);
              } else if (matchedCommand.bindingSupport.instanceSwap) {
                suggestions = await impl.searchComponentsForSwap(valueToUse);
              } else if (!matchedCommand.bindingSupport.instanceProperties) {
                // For styles/variables (not instance properties)
                suggestions = await searchStylesAndVariables(
                  valueToUse,
                  matchedCommand.bindingSupport,
                  {
                    getStoredLibraries: impl.getStoredLibraries,
                    getActiveLibraries: impl.getActiveLibraries
                  }
                );
              }

              // Use the first result if available
              if (suggestions.length > 0) {
                const firstResult = suggestions[0];
                if (typeof firstResult === 'object' && 'name' in firstResult) {
                  valueToUse = firstResult.name;
                  console.log(`Auto-selected first result: "${valueToUse}"`);
                } else if (typeof firstResult === 'string') {
                  valueToUse = firstResult;
                  console.log(`Auto-selected first result: "${valueToUse}"`);
                }
              } else {
                console.log(`No results found for search term: "${valueToUse}"`);
              }
            } catch (error) {
              console.error('Error searching for auto-select:', error);
            }
          }

          // Construct the full command: alias + value
          const fullCommand = `${cmdAlias} ${valueToUse}`;
          console.log(`Executing binding command: ${fullCommand}`);
          await executeCommand(fullCommand, true);
        }
      }
    }

    figma.closePlugin();
  } catch (error) {
    figma.notify(error instanceof Error ? error.message : 'An unknown error occurred');
    figma.closePlugin();
  }
});

// =================
// Command Execution
// =================
async function executeCommand(cmd: string, skipNotification: boolean = false): Promise<void> {
  console.log("=== executeCommand START ===");
  console.log("Input cmd:", cmd);

  if (!cmd) {
    console.log("Empty command, returning");
    return;
  }

  // Clean the command string by removing suggestions and aliases
  const cleanCmd = cmd.split('•')[0]  // Remove everything after the bullet point
    .split(',')[0]    // Take only the first part before any comma
    .trim();          // Remove whitespace

  console.log("Cleaned command:", cleanCmd);

  // Check if this command has a binding value (style/variable pattern)
  // If so, use findCommandForBinding to handle b/st -> StrokeColor routing
  const styleVariablePattern = /^([a-z]+)\s+([^(]+)\s*\(([^)]+)\)$/i;
  const hasBindingValue = styleVariablePattern.test(cleanCmd);

  let command;
  if (hasBindingValue) {
    const aliasMatch = cleanCmd.match(/^([a-z]+)/i);
    if (aliasMatch) {
      command = findCommandForBinding(aliasMatch[1]);
      console.log("Found command using binding mode:", command);
    }
  } else {
    command = findCommand(cleanCmd)[0];
    console.log("Found command:", command);
  }

  if (!command) {
    console.log("No command found, returning");
    return;
  }

  console.log("execute cleaned command:", cleanCmd);
  console.log("execute matched command:", command);

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const loadingNotification = skipNotification ? null : figma.notify(`Executing command(s)...`, { timeout: 0 });

  try {
    await delay(1);

    // Execute command based on type
    if (command.type === 'commandWithoutValue') {
      console.log("Executing commandWithoutValue");
      await command.functionWithoutParam();
    } else {
      const value = extractValue(cmd, command.valueFormat as ValueFormat);
      console.log("Extracted value:", value);
      console.log("Command type:", command.type);

      if (command.type === 'commandWithValue') {
        if (!value) {
          console.log("No value for commandWithValue");
          figma.notify(`No value provided for ${command.name}`);
          return;
        }
        console.log("Executing commandWithValue with value:", value);
        await command.functionWithParam(value);
      } else if (command.type === 'optionalValueCommand') {
        if (value) {
          console.log("Executing optionalValueCommand with param:", value);
          await command.functionWithParam(value);
        } else {
          console.log("Executing optionalValueCommand without param");
          await command.functionWithoutParam();
        }
      }
    }
    console.log("=== executeCommand END (success) ===");
  } catch (error) {
    console.error('=== executeCommand END (error) ===');
    console.error('Error executing command:', error);

    // Improve error messages for common failures
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

