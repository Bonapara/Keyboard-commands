// ==========================
// Plugin Entry Point
// ==========================

import type { ValueFormat } from './types';
import { COMMAND_DEFINITIONS, COMMANDS, type CommandName } from './commands';
import { 
  findCommand, 
  getCommandSuggestions, 
  extractValue, 
  calculateExpression,
  checkSpecialConditions,
  VALUE_FORMAT_REGEX,
  COMMAND_SPLITTER_REGEX 
} from './utils';

// Global state
let originalInput = '';

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
  currentInputHandler = ({ key, query, result }) => {
    if (key !== 'command') return;
    originalInput = query;
    
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
  const commands = commandString.split(COMMAND_SPLITTER_REGEX).filter(Boolean);

  console.log("parameters", parameters);
  console.log("commands", commands);
  
  try {
    // Group all command executions into a single undo step for better UX
    // This allows users to undo all commands at once with Cmd+Z
    if (parameters.parameters?.command && !parameters.parameters.command.includes('|')) {
      // Execute all commands except the last one
      for (let i = 0; i < commands.length - 1; i++) {
        const cmd = commands[i];
        await executeCommand(cmd, true);
      }
      console.log("parameters.parameters.command", parameters.parameters.command);
      await executeCommand(parameters.parameters.command, true);
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
async function processCommand(commandName: CommandName, value?: string): Promise<void> {
  const command = COMMAND_DEFINITIONS[commandName];
  if (!command) {
    throw new Error(`Command "${commandName}" not found`);
  }

  console.log("process command", command);
  
  try {
    if (command.type === 'commandWithValue') {
      if (!value) {
        throw new Error(`Command "${commandName}" requires a value`);
      }
      await command.functionWithParam(value);
    } else if (command.type === 'commandWithoutValue') {
      await command.functionWithoutParam();
    } else if (command.type === 'optionalValueCommand') {
      if (value) {
        await command.functionWithParam(value);
      } else {
        await command.functionWithoutParam();
      }
    }
  } catch (error) {
    // Improve error messages for common failures
    if (error instanceof Error) {
      if (error.message.includes('font')) {
        throw new Error(`Font loading failed for "${commandName}". The font may not be available.`);
      } else if (error.message.includes('permission')) {
        throw new Error(`Permission denied for "${commandName}". Check node permissions.`);
      } else if (error.message.includes('read-only')) {
        throw new Error(`Cannot modify "${commandName}" - node or property is read-only.`);
      }
      // Re-throw original error if it's already descriptive
      throw error;
    }
    throw new Error(`Failed to execute command "${commandName}"`);
  }
}

async function executeCommand(cmd: string, skipNotification: boolean = false): Promise<void> {
  if (!cmd) return;
  
  // Clean the command string by removing suggestions and aliases
  const cleanCmd = cmd.split('•')[0]  // Remove everything after the bullet point
                     .split(',')[0]    // Take only the first part before any comma
                     .trim();          // Remove whitespace
  
  const command = findCommand(cleanCmd)[0];
  if (!command) {
      return;
  }

  console.log("execute cleaned command:", cleanCmd);
  console.log("execute matched command:", command);
  
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const loadingNotification = skipNotification ? null : figma.notify(`Executing command(s)...`, { timeout: 0 });
  
  try {
    await delay(1);
    if (command.type === 'commandWithoutValue') {
      await processCommand(command.name);
    } else {
      const value = extractValue(cmd, command.valueFormat as ValueFormat);
      console.log("value", value);
      if (command.type === 'commandWithValue') {
        if (value) {
          await processCommand(command.name, value);
        } else {
          figma.notify(`No value provided for ${command.name}`);
        }
      } else if (command.type === 'optionalValueCommand') {
        if (value) {
          console.log("optional value command", value);
          await command.functionWithParam(value);
        } else {
          console.log("optional value command without param");
          await command.functionWithoutParam();
        }
      }
    }
  } catch (error) {
    console.error('Error executing command:', error);
    figma.notify(error instanceof Error ? error.message : 'Command execution failed');
    throw error;
  } finally {
    await delay(1);
    if (loadingNotification) {
      loadingNotification.cancel();
    }
  }
}

