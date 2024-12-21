// Type definitions
type ValueFormat = 'number' | 'positiveNumber' | 'hex' | 'text';

type CommandWithValue = {
  type: "commandWithValue";
  alias: string;
  valueFormat: ValueFormat;
  functionWithParam: (value: string) => void;
  suggestion: string;
};

type CommandWithoutValue = {
  type: "commandWithoutValue";
  alias: string;
  functionWithoutParam: () => void;
  suggestion: string;
};

type OptionalValueCommand = {
  type: "optionalValueCommand";
  alias: string;
  valueFormat?: ValueFormat;
  suggestion: string;
  functionWithoutParam: () => void;
  functionWithParam: (value: string) => void;
};

type CommandName = keyof typeof COMMAND_DEFINITIONS;
type Command = { name: CommandName, type: "commandWithValue" | "commandWithoutValue" | "optionalValueCommand"} & (CommandWithValue | CommandWithoutValue | OptionalValueCommand);

// Example commands using the simplified types
const COMMAND_DEFINITIONS = {
  Width: {
    type: "commandWithValue",
    alias: 'wi',
    valueFormat: 'positiveNumber' as const,
    suggestion: ' - Enter width in pixels',
    functionWithParam: (value: string) => resize(value, 'width'),
  },
  widthout: {
    type: "commandWithoutValue",
    alias: 'wid',
    suggestion: ' - Create horizontal auto-layout',
    functionWithoutParam: () => createAutoLayout('HORIZONTAL'),
  },
  Fill: {
    type: "optionalValueCommand",
    alias: 'f',
    valueFormat: 'hex' as const,
    suggestion: ' - Enter #HEX color',
    functionWithoutParam: () => toggleFill(),
    functionWithParam: (value: string) => setFill(value),
  },
  Rotate: {
    type: "commandWithValue",
    alias: 'ro',
    valueFormat: 'number' as const,
    suggestion: ' - Enter rotation angle in degrees',
    functionWithParam: (value: string) => {rotate(parseInt(value));
    }
  }
} satisfies Record<string, CommandWithValue | CommandWithoutValue | OptionalValueCommand>;


const COMMANDS: Array<Command & { name: CommandName }> = (Object.keys(COMMAND_DEFINITIONS) as CommandName[])
.map((name) => {
  const def = COMMAND_DEFINITIONS[name];
  return { name, ...def };
})
.sort((a, b) => {
  // First sort by alias length
  if (a.alias.length !== b.alias.length) {
    return a.alias.length - b.alias.length;
  }
  
  // If lengths are equal, sort alphabetically
  return a.alias.toLowerCase().localeCompare(b.alias.toLowerCase());
});


const VALUE_FORMAT_REGEX = {
  number: /-?\d+/,
  positiveNumber: /\d+/,
  hex: /#?[0-9a-fA-F]{3,6}\b/,
  text: /.+/
};
const COMMAND_SPLITTER_REGEX = /[\s,]+/;
const COMMAND_PART_REGEX = /^[a-zA-Z]+/;

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

  // Display a summary of already defined commands
  const completeCommands = parts.slice(0, -1).map((part) => {
    const commandPart = part.match(COMMAND_PART_REGEX)?.[0];
    const matchedCommand = COMMANDS.find(
      (cmd) =>
        commandPart?.toLowerCase() === (cmd.alias.toLowerCase()) ||
      commandPart?.toLowerCase() ===(cmd.name.toLowerCase())
    );
    if (matchedCommand) {
      if ('valueFormat' in matchedCommand) {
        const hasHex = VALUE_FORMAT_REGEX.hex.exec(part);
        if (hasHex) return `${matchedCommand.name}:${hasHex[0]}`;

        const hasNumber = VALUE_FORMAT_REGEX.number.exec(part);
        if (hasNumber) return `${matchedCommand.name}:${hasNumber[0]}`;
      }
      else {
        return matchedCommand.name;
      }
    } else {
      return "Not Found";
    }
  });
  
  // Process the current (last) command
  const matchedCommand = COMMANDS.find(
    (cmd) =>
      currentPart.toLowerCase().match(COMMAND_PART_REGEX)?.[0] === cmd.alias.toLowerCase() ||
    currentPart.toLowerCase().match(COMMAND_PART_REGEX)?.[0] === cmd.name.toLowerCase()
  );

  const hasNumber = VALUE_FORMAT_REGEX.number.exec(currentPart);
  const hasHex = VALUE_FORMAT_REGEX.hex.exec(currentPart);
  
    if (matchedCommand) {
      if (hasHex) {
        completeCommands.push(`${matchedCommand.name}:${hasHex[0]}`);
      }
      else if (hasNumber) {
        completeCommands.push(`${matchedCommand.name}:${hasNumber[0]}`);
      }
      else {
        completeCommands.push(`${matchedCommand.name} ${matchedCommand.suggestion} "hello"`);
      }
      result.setSuggestions([completeCommands.join(' | ')]);
      return;
    }

  // Generate filtered and sorted command suggestions based on current input
  const suggestions = COMMANDS
  .filter((cmd) =>
    cmd.alias.toLowerCase().startsWith(currentPart.toLowerCase()) ||
    cmd.name.toLowerCase().startsWith(currentPart.toLowerCase())
  )  // Format suggestions with appropriate hints
  .map((cmd) => {
    if (currentPart.toLowerCase() === cmd.alias.toLowerCase()) {
      return {
        name: `${cmd.alias} (${cmd.name})${cmd.suggestion}`,
      };
    }
    if (currentPart.toLowerCase() === cmd.name.toLowerCase()) {
      return {
        name: `${cmd.name}${cmd.suggestion}`
      };
    }
    return {
      name: `${cmd.name} (${cmd.alias})`,
    };
  });

  // Set final suggestions, fallback to original query if no matches found
  result.setSuggestions(suggestions.length ? suggestions : [query]);
});

figma.on('run', async ({ parameters}) => {
  try {
    //   if (parameters?.command?.data?.command) {
    //     const selectedCommand = parameters.command.data.command as Command;
    //     if (!('valueFormat' in selectedCommand)) {
    //       await processCommand(selectedCommand.name);
    //     figma.closePlugin();
    //     return;
    //   }
    // }
    console.log('X22parameters:', parameters);
    
    const commandString = originalInput.trim();
    const commands = commandString.split(COMMAND_SPLITTER_REGEX).filter(Boolean);
    console.log('X23commands:', commands);
    
    // Wait for all commands to complete using Promise.all
    await Promise.all(commands.map(cmd => executeCommand(cmd)));
    
    // Only close the plugin after all commands have completed
    figma.closePlugin();
  } catch (error) {
    figma.notify(error instanceof Error ? error.message : 'An unknown error occurred');
    figma.closePlugin();
  }
});

async function processCommand(commandName: CommandName, value?: string): Promise<void> {
  const command = COMMAND_DEFINITIONS[commandName];
  if (!command) return;
  
  if (command.type === 'commandWithValue') {
    await command.functionWithParam(value || '');
  } else if (command.type === 'commandWithoutValue') {
    await command.functionWithoutParam();
  } else if (command.type === 'optionalValueCommand') {
    if (value) {
      await command.functionWithParam(value);
    } else {
      await command.functionWithoutParam();
    }
  }
}

async function executeCommand(cmd: string): Promise<void> {
  if (!cmd) return;
  
  const command = findCommand(cmd);
  if (!command) {
    return;
  }
  
  if (command.type === 'commandWithoutValue') {
    await processCommand(command.name);
    return;
  }
  
  const value = extractValue(cmd, command.valueFormat as ValueFormat);
  
  if (command.type === 'commandWithValue') {
    if (value) {
      await processCommand(command.name, value);
      return;
    }
  }
  
  if (command.type === 'optionalValueCommand') {
    if (value) {
      await command.functionWithParam(value);
    } else {
      await command.functionWithoutParam();
    }
  }
}

// Helper functions
function findCommand(cmd: string): Command | undefined {
  // Extract command part before any numbers or special characters
  const cmdPart = cmd.match(/^[a-zA-Z]+/)?.[0] || '';
  
  return COMMANDS.find(c =>
    cmdPart.toLowerCase() === c.alias.toLowerCase() ||
    cmdPart.toLowerCase() === c.name.toLowerCase()
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