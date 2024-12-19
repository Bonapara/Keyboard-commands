// Type definitions
type ValueFormat = 'number' | 'positiveNumber' | 'hex' | 'text';

type CommandWithValue = {
  alias: string;
  valueFormat: ValueFormat;
  execute: (value: string) => void;
  suggestion: string;
};

type CommandWithoutValue = {
  alias: string;
  execute: () => void;
  suggestion: string;
};

type OptionalValueCommand = {
  alias: string;
  execute: (value?: string) => void;
  suggestion: string;
};

type CommandName = keyof typeof COMMAND_DEFINITIONS;
type Command = { name: CommandName } & (CommandWithValue | CommandWithoutValue | OptionalValueCommand);

// Example commands using the simplified types
const COMMAND_DEFINITIONS = {
  Width: {
    alias: 'w',
    valueFormat: 'positiveNumber' as const,
    suggestion: ' - Enter width in pixels',
    execute: (value: string) => {
      if (!value) throw new Error('No value provided');
      resize(value, 'width');
    }
  },

  AutoLayout: {
    alias: 'a',
    suggestion: ' - Create horizontal auto-layout',
    execute: () => createAutoLayout('HORIZONTAL')
  },

  Fill: {
    alias: 'f',
    valueFormat: 'hex' as const,
    suggestion: ' - Enter #HEX color',
    execute: (value?: string) => {
      if (value === undefined) {
        toggleFill();
        return;
      }
      setFill(value);
    }
  },

  Rotate: {
    alias: 'ro',
    valueFormat: 'number' as const,
    suggestion: ' - Enter rotation angle in degrees',
    execute: (value: string) => {
      if (!value) throw new Error('No value provided');
      const numValue = parseInt(value);
      rotate(numValue);
    }
  }
} satisfies Record<string, CommandWithValue | CommandWithoutValue | OptionalValueCommand>;


const COMMANDS: Array<Command & { name: CommandName }> = (Object.keys(COMMAND_DEFINITIONS) as CommandName[]).map((name) => {
  const def = COMMAND_DEFINITIONS[name];
  return { name, ...def };
});

const VALUE_FORMAT_REGEX = {
  number: /-?\d+/,
  positiveNumber: /\d+/,
  hex: /#?[0-9a-fA-F]{3,6}\b/,
  text: /.+/
};
const ATTACHED_FORMAT_REGEX = /^([a-zA-Z]+)([-#]?\w+)$/;
const COMMAND_SPLITTER_REGEX = /[\s,]+/;

let originalInput = '';


// Manages command suggestions and autocompletion as the user types
figma.parameters.on('input', ({ key, query, result }) => {
  // Only process 'command' parameter inputs
  if (key !== 'command') return;
  originalInput = query;

  // Split input into parts by spaces
  const parts = query.split(' ');
  const currentPart = parts[parts.length - 1];

  // If query is empty or ends with space, show all available commands
  if (!query || query.endsWith(' ')) {
    result.setSuggestions(COMMANDS.map((cmd) => `${cmd.name} (${cmd.alias})`));
    return;
  }

  // Handle single word input
  if (parts.length === 1) {
    const matchedCommand = COMMANDS.find(
      (cmd) =>
        currentPart.toLowerCase().startsWith(cmd.alias.toLowerCase()) ||
        currentPart.toLowerCase().startsWith(cmd.name.toLowerCase())
    );
    
    if (matchedCommand && 'valueFormat' in matchedCommand) {
      const value = extractValue(currentPart, matchedCommand.valueFormat);
      if (value) {
        result.setSuggestions([`${matchedCommand.name}:${value}`]);
        return;
      }
    }
  }

  // Handle multi-word input
  if (parts.length > 1) {
    // Process all parts except the last one
    const completeCommands = parts.slice(0, -1).map((part) => {
      // Try to match exact command first
      let matchedCommand = COMMANDS.find(
        (cmd) =>
          part.toLowerCase() === cmd.alias.toLowerCase() ||
          part.toLowerCase() === cmd.name.toLowerCase()
      );
      // If no exact match, try partial match
      if (!matchedCommand) {
        matchedCommand = COMMANDS.find(
          (cmd) =>
            part.toLowerCase().startsWith(cmd.alias.toLowerCase()) ||
            part.toLowerCase().startsWith(cmd.name.toLowerCase())
        );
      }
      if (matchedCommand) {
        // Format command with value if required
        if ('valueFormat' in matchedCommand) {
          const hasNumber = VALUE_FORMAT_REGEX.number.exec(part);
          if (hasNumber) return `${matchedCommand.name}:${hasNumber[0]}`;
        } else {
          return matchedCommand.name;
        }
      }
      return part;
    });

    // Process the current (last) part
    const matchedCommand = COMMANDS.find(
      (cmd) =>
        currentPart.toLowerCase().startsWith(cmd.alias.toLowerCase()) ||
        currentPart.toLowerCase().startsWith(cmd.name.toLowerCase())
    );
    const hasNumber = VALUE_FORMAT_REGEX.number.exec(currentPart);

    // Inside multi-word handling - uses completeCommands array
    if (parts.length > 1) {
      if (matchedCommand && 'valueFormat' in matchedCommand && hasNumber) {
        completeCommands.push(`${matchedCommand.name}:${hasNumber[0]}`);
        result.setSuggestions([completeCommands.join(' | ')]);
        return;
      } else if (matchedCommand && !('valueFormat' in matchedCommand)) {
        completeCommands.push(matchedCommand.name);
        result.setSuggestions([completeCommands.join(' | ')]);
        return;
      }
    }     // Single word or fallback handling - uses simple string concatenation
    else if (matchedCommand && 'valueFormat' in matchedCommand && hasNumber) {
      const value = hasNumber[0];
      const previousCommands = parts.slice(0, -1).join(' ');
      const suggestion = previousCommands
        ? `${previousCommands} | ${matchedCommand.name}:${value}`
        : `${matchedCommand.name}:${value}`;
      result.setSuggestions([suggestion]);
      return;
    }
  }

  // Handle number input for commands that require values
  const matchedCmd = COMMANDS.find(
    (cmd) =>
      currentPart.toLowerCase().startsWith(cmd.alias.toLowerCase()) ||
      currentPart.toLowerCase().startsWith(cmd.name.toLowerCase())
  );
  if (matchedCmd && 'valueFormat' in matchedCmd) {
    const hasNumber = VALUE_FORMAT_REGEX.number.exec(currentPart);
    if (hasNumber) {
      const value = hasNumber[0];
      const previousCommands = parts.slice(0, -1).join(' ');
      const suggestion = previousCommands
        ? `${previousCommands} | ${matchedCmd.name}:${value}`
        : `${matchedCmd.name}:${value}`;
      result.setSuggestions([suggestion]);
      return;
    }
  }

  // Generate filtered and sorted command suggestions based on current input
  const suggestions = COMMANDS.filter(
    (cmd) =>
      cmd.alias.toLowerCase().startsWith(currentPart.toLowerCase()) ||
      cmd.name.toLowerCase().startsWith(currentPart.toLowerCase())
  )
    // Sort suggestions prioritizing exact matches and shorter aliases
    .sort((a, b) => {
      if (a.alias.toLowerCase() === currentPart.toLowerCase()) return -1;
      if (b.alias.toLowerCase() === currentPart.toLowerCase()) return 1;
      return a.alias.length - b.alias.length;
    })
    // Format suggestions with appropriate hints
    .map((cmd) => {
      if (currentPart.toLowerCase() === cmd.alias.toLowerCase()) {
        return {
          name: `${cmd.alias} (${cmd.name})${cmd.suggestion}`,
          data: { command: cmd },
        };
      }
      if (currentPart.toLowerCase() === cmd.name.toLowerCase()) {
        return {
          name: `${cmd.name}${cmd.suggestion}`
        };
      }
      return {
        name: `${cmd.name} (${cmd.alias})${cmd.suggestion}`,
      };
    });

  // Set final suggestions, fallback to original query if no matches found
  result.setSuggestions(suggestions.length ? suggestions : [query]);
});

figma.on('run', async ({ parameters, command }) => {
  try {
    if (command === 'input' && parameters?.command?.data?.command) {
      const selectedCommand = parameters.command.data.command as Command;
      if (!('valueFormat' in selectedCommand)) {
        await processCommand(selectedCommand.name);
        figma.closePlugin();
        return;
      }
    }

    const commandString = originalInput.trim();
    const commands = commandString.split(COMMAND_SPLITTER_REGEX).filter(Boolean);

    // Wait for all commands to complete using Promise.all
    await Promise.all(commands.map(cmd => executeCommand(cmd)));
    
    // Only close the plugin after all commands have completed
    figma.closePlugin();
  } catch (error) {
    console.error('Error executing commands:', error);
    figma.notify(error instanceof Error ? error.message : 'An unknown error occurred');
    figma.closePlugin();
  }
});

async function processCommand(commandName: CommandName, value?: string): Promise<void> {
  const definition = COMMAND_DEFINITIONS[commandName];
  if (!definition) return;

  if ('valueFormat' in definition) {
    if (!value) throw new Error('No value provided');
    await definition.execute(value);
  } else {
    await definition.execute();
  }
}

async function executeCommand(cmd: string): Promise<void> {
  if (!cmd) return;
  console.log('Executing command:', cmd);

  const command = findExactCommand(cmd) || findPartialCommand(cmd);
  if (!command) {
    console.log('No matching command found');
    return;
  }
  console.log('Found command:', command.name);

  // Handle commands that don't require values
  if (!('valueFormat' in command)) {
    console.log('Processing command without value');
    await processCommand(command.name);
    return;
  }

  // For commands requiring values
  if ('valueFormat' in command) {
    console.log('Command requires value of format:', command.valueFormat);
    
    // Try to extract value using the command's format
    const value = extractValue(cmd, command.valueFormat);
    if (value) {
      console.log('Found value using format:', value);
      await processCommand(command.name, value);
      return;
    }

    // Try attached format as fallback
    const attachedFormat = cmd.match(ATTACHED_FORMAT_REGEX);
    if (attachedFormat) {
      const [, cmdPart, value] = attachedFormat;
      if (cmdPart.toLowerCase() === command.alias.toLowerCase() || 
          cmdPart.toLowerCase() === command.name.toLowerCase()) {
        const formattedValue = command.valueFormat === 'hex' ? `#${value}` : value;
        console.log('Found attached format value:', formattedValue);
        await processCommand(command.name, formattedValue);
        return;
      }
    }
    
    console.log('No valid value found for command');
  }
}

// Helper functions
function findExactCommand(cmd: string): Command | undefined {
  // Extract command part before any numbers or special characters
  const cmdPart = cmd.match(/^[a-zA-Z]+/)?.[0] || '';
  
  return COMMANDS.find(c =>
    cmdPart.toLowerCase() === c.alias.toLowerCase() ||
    cmdPart.toLowerCase() === c.name.toLowerCase()
  );
}

function findPartialCommand(cmd: string): Command | undefined {
  // Extract command part before any numbers or special characters
  const cmdPart = cmd.match(/^[a-zA-Z]+/)?.[0] || '';
  
  return COMMANDS.find(c =>
    c.alias.toLowerCase().startsWith(cmdPart.toLowerCase()) ||
    c.name.toLowerCase().startsWith(cmdPart.toLowerCase())
  );
}

// Update the input handler to use generic value detection
function extractValue(text: string, format: ValueFormat): string | null {
  const match = text.match(VALUE_FORMAT_REGEX[format]);
  if (!match) return null;
  
  if (format === 'hex') {
    const value = match[0];
    return value.startsWith('#') ? value : `#${value}`;
  }
  
  return match[0];
}

// Functions

async function resize(value: string, resizeType: 'width' | 'height') {
  const numValue = Number(value);
  if (isNaN(numValue)) throw new Error('Invalid number provided');
  
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }

  for (const node of selection) {
    if ('resize' in node) {
      const newSize = {
        width: resizeType === 'width' ? numValue : node.width,
        height: resizeType === 'height' ? numValue : node.height
      };
      node.resize(newSize.width, newSize.height);
    }
  }

  figma.notify(`${resizeType} set to ${value} for all selected items`);
}

async function setFill(value: string) {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }

  // Convert input to a standardized hex string
  let hexColor = value.toString();
  
  // Remove # if present
  hexColor = hexColor.replace('#', '');
  
  // Convert 3-digit hex to 6-digit hex
  if (hexColor.length === 3) {
    hexColor = hexColor.split('').map(char => char + char).join('');
  }
  
  // Validate hex format
  if (!/^[0-9A-Fa-f]{6}$/.test(hexColor)) {
    throw new Error('Invalid hex color format');
  }
  
  // Convert hex to RGB values (0-1 range for Figma)
  const r = parseInt(hexColor.substring(0, 2), 16) / 255;
  const g = parseInt(hexColor.substring(2, 4), 16) / 255;
  const b = parseInt(hexColor.substring(4, 6), 16) / 255;
  
  // Apply fill to selected nodes
  for (const node of selection) {
    if ('fills' in node) {
      const newFills: Paint[] = [{
        type: 'SOLID',
        color: { r, g, b },
        opacity: 1
      } as SolidPaint];
      node.fills = newFills;
    }
  }
}

async function toggleFill() {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }

  for (const node of selection) {
    // Check if the node has fills property
    if ('fills' in node) {
      const fills = node.fills;
      
      // Ensure fills is an array before checking its length
      if (Array.isArray(fills) && fills.length > 0) {
        // If the node has fills, remove them
        node.fills = [];
      } else {
        // If the node has no fills, add a black fill
        node.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
      }
    }
  }
}

async function createAutoLayout(direction: 'HORIZONTAL' | 'VERTICAL' = 'HORIZONTAL') {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    throw new Error('No items selected');
  }

  // If the selection is a single group, convert it directly
  if (selection.length === 1 && selection[0].type === 'GROUP') {
    const group = selection[0];
    const parentFrame = group.parent;
    if (!parentFrame) return;

    // Create a new frame with the same size and position as the group
    const frame = figma.createFrame();
    frame.x = group.x;
    frame.y = group.y;
    frame.resize(group.width, group.height);
    frame.layoutMode = direction;
    frame.primaryAxisSizingMode = 'AUTO';
    frame.counterAxisSizingMode = 'AUTO';
    frame.fills = []; // Remove default white background
    frame.paddingLeft = 0;
    frame.paddingRight = 0;
    frame.paddingTop = 0;
    frame.paddingBottom = 0;

    // Sort the group's children by position
    const sortedChildren = [...group.children].sort((a, b) => {
      if (direction === 'HORIZONTAL') {
        return a.x - b.x;
      } else {
        return a.y - b.y;
      }
    });

    // Calculate spacing based on the first two children if they exist
    let spacing = 0;
    if (sortedChildren.length > 1) {
      if (direction === 'HORIZONTAL') {
        spacing = sortedChildren[1].x - (sortedChildren[0].x + sortedChildren[0].width);
      } else {
        spacing = sortedChildren[1].y - (sortedChildren[0].y + sortedChildren[0].height);
      }
    }
    frame.itemSpacing = Math.max(0, spacing);

    // Add the frame to the parent
    parentFrame.appendChild(frame);

    // Move all children from group to the new frame
    sortedChildren.forEach(child => {
      frame.appendChild(child);
    });

    // Select the new frame
    figma.currentPage.selection = [frame];
    figma.notify(`Group converted to ${direction.toLowerCase()} auto-layout frame`);
    return;
  }

  // Original code for multiple selections or non-group selections
  const parentFrame = selection[0].parent;
  if (!parentFrame) return;

  const firstNodeX = selection[0].x;
  const firstNodeY = selection[0].y;

  let spacing = 0;
  if (selection.length > 1) {
    if (direction === 'HORIZONTAL') {
      spacing = selection[1].x - (selection[0].x + selection[0].width);
    } else {
      spacing = selection[1].y - (selection[0].y + selection[0].height);
    }
  }

  const frame = figma.createFrame();
  frame.layoutMode = direction;
  frame.primaryAxisSizingMode = 'AUTO';
  frame.counterAxisSizingMode = 'AUTO';
  frame.fills = [];
  frame.paddingLeft = 0;
  frame.paddingRight = 0;
  frame.paddingTop = 0;
  frame.paddingBottom = 0;
  frame.itemSpacing = Math.max(0, spacing);

  parentFrame.appendChild(frame);
  frame.x = firstNodeX;
  frame.y = firstNodeY;

  const sortedSelection = [...selection].sort((a, b) => {
    if (direction === 'HORIZONTAL') {
      return a.x - b.x;
    } else {
      return a.y - b.y;
    }
  });

  sortedSelection.forEach(node => {
    frame.appendChild(node);
  });

  figma.currentPage.selection = [frame];
  figma.notify(`Auto-layout frame created in ${direction.toLowerCase()} direction`);
}

async function rotate(value: number) {
  if (!value && value !== 0) throw new Error('No value provided');
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    throw new Error('No items selected');
  }

  for (const node of selection) {
    if ('rotation' in node) {
      // Keep the existing rotation and add the new value
      node.rotation = (node.rotation + value) % 360;
    }
  }

  figma.notify(`Rotated ${value}° for all selected items`);
}