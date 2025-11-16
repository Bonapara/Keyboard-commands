// ================================
// Alignment Functions
// ================================

type PrimaryAxisAlignment = 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
type CounterAxisAlignment = 'MIN' | 'CENTER' | 'MAX' | 'BASELINE';

// Define a type for nodes that support auto-layout
type AutoLayoutNode = FrameNode | ComponentNode | InstanceNode;

// Helper function to check if a node supports auto-layout
function isAutoLayoutNode(node: SceneNode): node is AutoLayoutNode {
  return 'layoutMode' in node &&
  'primaryAxisAlignItems' in node &&
  'counterAxisAlignItems' in node;
}

function alignItems(
  direction: 'PRIMARY' | 'COUNTER',
  value: PrimaryAxisAlignment | CounterAxisAlignment,
  node: AutoLayoutNode
) {
  try {
    if (direction === 'PRIMARY') {
      node.primaryAxisAlignItems = value as PrimaryAxisAlignment;
    } else {
      node.counterAxisAlignItems = value as CounterAxisAlignment;
    }
  } catch (error) {
    console.warn(`Failed to set axis alignment on node:`, error);
    figma.notify('Failed to set axis alignment');
  }
}

// Function for AutoLayout alignment
export async function setAutoLayoutAlignment(horizontal: {
  primary: PrimaryAxisAlignment,
  counter: CounterAxisAlignment
}, vertical: {
  primary: PrimaryAxisAlignment,
  counter: CounterAxisAlignment
}) {
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  for (const node of selection) {
    if (!isAutoLayoutNode(node)) {
      figma.notify('Only auto-layout frames can have axis alignment');
      continue;
    }
    
    if (node.layoutMode === 'NONE') {
      figma.notify('Frame must have auto-layout enabled');
      continue;
    }
    
    const isHorizontal = node.layoutMode === 'HORIZONTAL';
    const { primary, counter } = isHorizontal ? horizontal : vertical;
    
    alignItems('PRIMARY', primary, node);
    alignItems('COUNTER', counter, node);
    
    figma.notify(`Alignment set for ${isHorizontal ? 'horizontal' : 'vertical'} layout`);
  }
}

// Function for Text alignment with separate horizontal and vertical control
export async function AlignText(options: {
  horizontal?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED',
  vertical?: 'TOP' | 'CENTER' | 'BOTTOM'
}) {
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  for (const node of selection) {
    if (node.type === 'TEXT') {
      try {
        // Load all fonts used in the text node
        const fonts = node.getRangeAllFontNames(0, node.characters.length);
        await Promise.all(fonts.map(font => figma.loadFontAsync(font)));
        
        // Set horizontal alignment if specified
        if (options.horizontal) {
          node.textAlignHorizontal = options.horizontal;
        }
        
        // Set vertical alignment if specified
        if (options.vertical) {
          node.textAlignVertical = options.vertical;
        }
        
        // Prepare notification message
        const alignments = [];
        if (options.horizontal) {
          alignments.push(`horizontal: ${options.horizontal.toLowerCase()}`);
        }
        if (options.vertical) {
          alignments.push(`vertical: ${options.vertical.toLowerCase()}`);
        }
        
        figma.notify(`Text alignment updated (${alignments.join(', ')})`);
      } catch (err) {
        figma.notify('Error loading font');
      }
    } else {
      figma.notify('Selected node is not a text layer');
    }
  }
}

export function alignNodes(alignment: 'TOP' | 'RIGHT' | 'LEFT' | 'BOTTOM' | 'VERTICAL_CENTER' | 'HORIZONTAL_CENTER') {
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    figma.notify('Please select at least 1 item to align');
    return;
  }
  
  // Filter nodes that have x and y properties
  const validNodes = selection.filter(node => 'x' in node && 'y' in node);
  
  if (validNodes.length !== selection.length) {
    figma.notify('Some selected items cannot be aligned');
    return;
  }
  
  if (validNodes.length === 1) {
    // Single node alignment relative to parent
    const node = validNodes[0];
    const parent = node.parent;
    
    if (!parent || !('width' in parent) || !('height' in parent)) {
      figma.notify('Cannot align: parent container not found or invalid');
      return;
    }
    
    switch (alignment) {
      case 'LEFT':
      node.x = 0;
      break;
      case 'RIGHT':
      if ('width' in node) {
        node.x = parent.width - node.width;
      }
      break;
      case 'TOP':
      node.y = 0;
      break;
      case 'BOTTOM':
      if ('height' in node) {
        node.y = parent.height - node.height;
      }
      break;
      case 'VERTICAL_CENTER': {
        if ('height' in node) {
          node.y = (parent.height - node.height) / 2;
        }
        break;
      }
      case 'HORIZONTAL_CENTER': {
        if ('width' in node) {
          node.x = (parent.width - node.width) / 2;
        }
        break;
      }
    }
    
    figma.notify(`Aligned node to ${alignment.toLowerCase().replace('_', ' ')} of parent`);
    return;
  }
  
  // Multiple node alignment logic (unchanged)
  const positions = validNodes.map(node => ({
    x: node.x,
    y: node.y,
    width: 'width' in node ? node.width : 0,
    height: 'height' in node ? node.height : 0
  }));
  
  const leftmost = Math.min(...positions.map(p => p.x));
  const rightmost = Math.max(...positions.map(p => p.x + p.width));
  const topmost = Math.min(...positions.map(p => p.y));
  const bottommost = Math.max(...positions.map(p => p.y + p.height));
  
  for (const node of validNodes) {
    switch (alignment) {
      case 'LEFT':
      node.x = leftmost;
      break;
      case 'RIGHT':
      if ('width' in node) {
        node.x = rightmost - node.width;
      }
      break;
      case 'TOP':
      node.y = topmost;
      break;
      case 'BOTTOM':
      if ('height' in node) {
        node.y = bottommost - node.height;
      }
      break;
      case 'VERTICAL_CENTER': {
        const centerY = topmost + (bottommost - topmost) / 2;
        if ('height' in node) {
          node.y = centerY - (node.height / 2);
        }
        break;
      }
      case 'HORIZONTAL_CENTER': {
        const centerX = leftmost + (rightmost - leftmost) / 2;
        if ('width' in node) {
          node.x = centerX - (node.width / 2);
        }
        break;
      }
    }
  }
  
  figma.notify(`Aligned ${validNodes.length} items to ${alignment.toLowerCase().replace('_', ' ')}`);
}

export function alignNodesToParent(alignment: 'TOP_LEFT' | 'TOP_RIGHT' | 'BOTTOM_LEFT' | 'BOTTOM_RIGHT' | 'CENTER_CENTER') {
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    figma.notify('Please select at least 1 item to align');
    return;
  }
  
  const validNodes = selection.filter(node => 'x' in node && 'y' in node);
  
  for (const node of validNodes) {
    const parent = node.parent;
    
    if (!parent || !('width' in parent) || !('height' in parent)) {
      continue;
    }
    
    // Set position based on alignment
    switch (alignment) {
      case 'TOP_LEFT':
        node.x = 0;
        node.y = 0;
        break;
      case 'TOP_RIGHT':
        if ('width' in node) {
          node.x = parent.width - node.width;
          node.y = 0;
        }
        break;
      case 'BOTTOM_LEFT':
        if ('height' in node) {
          node.x = 0;
          node.y = parent.height - node.height;
        }
        break;
      case 'BOTTOM_RIGHT':
        if ('width' in node && 'height' in node) {
          node.x = parent.width - node.width;
          node.y = parent.height - node.height;
        }
        break;
      case 'CENTER_CENTER':
        if ('width' in node && 'height' in node) {
          node.x = (parent.width - node.width) / 2;
          node.y = (parent.height - node.height) / 2;
        }
        break;
    }
  }
  
  figma.notify(`Aligned ${validNodes.length} item(s) to ${alignment.toLowerCase().replace('_', ' ')} of parent`);
}

