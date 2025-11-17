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
  searchStylesAndVariables
} from './utils';

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
    
    // Check for binding mode BEFORE splitting by spaces
    // This allows variable/style names with spaces to work properly
    const bindingModeMatch = query.match(/^(.*?)\s+([a-z]+)\?(.*)$/i);
    
    if (bindingModeMatch) {
      const [, _previousCommandsStr, cmdAlias, searchTerm] = bindingModeMatch;
      const matchedCommand = findCommandForBinding(cmdAlias);
      
      if (matchedCommand?.bindingSupport) {
        try {
          const suggestions = await searchStylesAndVariables(
            searchTerm,
            matchedCommand.bindingSupport
          );
          
          if (suggestions.length > 0) {
            result.setSuggestions(suggestions);
            return;
          } else {
            result.setSuggestions(['No matching styles or variables found']);
            return;
          }
        } catch (error) {
          console.error('Error searching styles/variables:', error);
        }
      }
    }
    
    // Check for binding mode at the start of the query (no previous commands)
    const simpleBindingMatch = query.match(/^([a-z]+)\?(.*)$/i);
    
    if (simpleBindingMatch) {
      const [, cmdAlias, searchTerm] = simpleBindingMatch;
      const matchedCommand = findCommandForBinding(cmdAlias);
      
      if (matchedCommand?.bindingSupport) {
        try {
          const suggestions = await searchStylesAndVariables(
            searchTerm,
            matchedCommand.bindingSupport
          );
          
          if (suggestions.length > 0) {
            result.setSuggestions(suggestions);
            return;
          } else {
            result.setSuggestions(['No matching styles or variables found']);
            return;
          }
        } catch (error) {
          console.error('Error searching styles/variables:', error);
        }
      }
    }
    
    const parts = query.split(' ');
    const currentPart = parts[parts.length - 1];
    
    // Track previous commands
    const previousCommands: Record<string, string> = {};
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
    
    // Summarize previously defined commands (not used below except for display)
    const completeCommands = parts.slice(0, -1).map((part) => {
      const matchedCommand = findCommand(part)[0];
      if (!matchedCommand) {
        return "Not Found";
      }
      
      const { name, type } = matchedCommand;
      
      // Process hex or number value if present
      const processValue = (): string | null => {
        const hasHex = VALUE_FORMAT_REGEX.hex.exec(part);
        if (hasHex) {
          return hasHex[0];
        }
        
        const hasNumber = VALUE_FORMAT_REGEX.number.exec(part);
        if (hasNumber) {
          try {
            return calculateExpression(hasNumber[0]);
          } catch {
            return hasNumber[0];
          }
        }
        
        return null;
      };
      
      // Format command with optional value
      const formatCommand = (value: string | null): string => {
        return value ? `${name}:${value}` : name;
      };
      
      const value = processValue();
      
      if (type === 'commandWithValue') {
        return value ? formatCommand(value) : undefined;
      } else if (type === 'optionalValueCommand') {
        return formatCommand(value);
      } else {
        return name;
      }
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
  
  // Check for binding mode BEFORE splitting by spaces
  // Patterns: "cmd?" or "prev commands cmd?" 
  const bindingModeMatch = commandString.match(/^(.*?)\s*([a-z]+)\?(.*)$/i);
  
  let commands: string[];
  let isBindingMode = false;
  let bindingCommandAlias = '';
  
  if (bindingModeMatch) {
    isBindingMode = true;
    const [, previousCommandsStr, cmdAlias, searchTerm] = bindingModeMatch;
    bindingCommandAlias = cmdAlias;
    
    console.log("Binding mode detected");
    console.log("Previous commands:", previousCommandsStr);
    console.log("Binding command alias:", cmdAlias);
    console.log("Search term:", searchTerm);
    
    // Split only the previous commands part (before the binding command)
    if (previousCommandsStr.trim()) {
      commands = previousCommandsStr.trim().split(COMMAND_SPLITTER_REGEX).filter(Boolean);
    } else {
      commands = [];
    }
    // Don't include the binding command itself in the commands array
  } else {
    // Normal mode: split all commands by spaces
    commands = commandString.split(COMMAND_SPLITTER_REGEX).filter(Boolean);
  }
  
  console.log("commands", commands);
  
  try {
    // Group all command executions into a single undo step for better UX
    // This allows users to undo all commands at once with Cmd+Z
    if (parameters.parameters?.command && !parameters.parameters.command.includes('|')) {
      // Execute all commands (which won't include the binding command part)
      for (let i = 0; i < commands.length; i++) {
        const cmd = commands[i];
        await executeCommand(cmd, true);
      }
      
      console.log("parameters.parameters.command", parameters.parameters.command);
      
      // Check if this is a binding mode value that needs reconstruction
      // Formats:
      // - Style/Variable: "Name (Collection - Location)" or "Name (Location)"
      // - Instance Property: "PropertyName:OptionValue"
      let commandToExecute = parameters.parameters.command;
      const styleVariablePattern = /^([^(]+)\s*\(([^)]+)\)$/;
      const instancePropertyPattern = /^([^:]+):(.+)$/;
      
      const isStyleVariableBinding = styleVariablePattern.test(commandToExecute);
      const isInstancePropertyBinding = instancePropertyPattern.test(commandToExecute);
      const isBindingValue = isStyleVariableBinding || isInstancePropertyBinding;
      
      if (isBindingValue) {
        // This is a binding mode value
        if (isBindingMode && bindingCommandAlias) {
          // Reconstruct full command: alias + space + value
          // The space is needed so findCommand regex can extract just the alias
          commandToExecute = bindingCommandAlias + ' ' + commandToExecute;
          console.log("Reconstructed binding command:", commandToExecute);
        }
        await executeCommand(commandToExecute, true);
      } else if (isBindingMode) {
        // In binding mode but not a binding value pattern, still execute it
        await executeCommand(commandToExecute, true);
      }
      // If not in binding mode and not a binding value, skip (already executed in loop above)
    } else {
      for (const cmd of commands) {
        console.log("cmd", cmd);
        await executeCommand(cmd, true);
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

