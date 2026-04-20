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

export type AlignmentPosition =
  | 'TOP_LEFT' | 'TOP_CENTER' | 'TOP_RIGHT'
  | 'CENTER_LEFT' | 'CENTER' | 'CENTER_RIGHT'
  | 'BOTTOM_LEFT' | 'BOTTOM_CENTER' | 'BOTTOM_RIGHT';

function getAutoLayoutAlignment(position: AlignmentPosition, isHorizontal: boolean): { primary: PrimaryAxisAlignment, counter: CounterAxisAlignment } {
  const map: Record<AlignmentPosition, { h: [PrimaryAxisAlignment, CounterAxisAlignment], v: [PrimaryAxisAlignment, CounterAxisAlignment] }> = {
    'TOP_LEFT': { h: ['MIN', 'MIN'], v: ['MIN', 'MIN'] },
    'TOP_CENTER': { h: ['CENTER', 'MIN'], v: ['MIN', 'CENTER'] },
    'TOP_RIGHT': { h: ['MAX', 'MIN'], v: ['MIN', 'MAX'] },
    'CENTER_LEFT': { h: ['MIN', 'CENTER'], v: ['CENTER', 'MIN'] },
    'CENTER': { h: ['CENTER', 'CENTER'], v: ['CENTER', 'CENTER'] },
    'CENTER_RIGHT': { h: ['MAX', 'CENTER'], v: ['CENTER', 'MAX'] },
    'BOTTOM_LEFT': { h: ['MIN', 'MAX'], v: ['MAX', 'MIN'] },
    'BOTTOM_CENTER': { h: ['CENTER', 'MAX'], v: ['MAX', 'CENTER'] },
    'BOTTOM_RIGHT': { h: ['MAX', 'MAX'], v: ['MAX', 'MAX'] }
  };

  const config = map[position];
  const [primary, counter] = isHorizontal ? config.h : config.v;
  return { primary, counter };
}

function alignNodeToParentLogic(node: SceneNode, position: AlignmentPosition): boolean {
  const parent = node.parent;
  if (!parent || !('width' in parent) || !('height' in parent) || !('x' in node) || !('y' in node)) {
    return false;
  }

  // Cast parent to a type that definitely has width/height for TS
  const p = parent as { width: number, height: number };
  const n = node as { x: number, y: number, width: number, height: number }; // Assuming node has width/height if it has x/y and we are aligning it. 
  // Wait, LineNode might not have width/height in the same way? No, they do.
  // But let's be safe.
  if (!('width' in node) || !('height' in node)) return false;

  switch (position) {
    case 'TOP_LEFT': n.x = 0; n.y = 0; break;
    case 'TOP_CENTER': n.x = (p.width - n.width) / 2; n.y = 0; break;
    case 'TOP_RIGHT': n.x = p.width - n.width; n.y = 0; break;
    case 'CENTER_LEFT': n.x = 0; n.y = (p.height - n.height) / 2; break;
    case 'CENTER': n.x = (p.width - n.width) / 2; n.y = (p.height - n.height) / 2; break;
    case 'CENTER_RIGHT': n.x = p.width - n.width; n.y = (p.height - n.height) / 2; break;
    case 'BOTTOM_LEFT': n.x = 0; n.y = p.height - n.height; break;
    case 'BOTTOM_CENTER': n.x = (p.width - n.width) / 2; n.y = p.height - n.height; break;
    case 'BOTTOM_RIGHT': n.x = p.width - n.width; n.y = p.height - n.height; break;
  }
  return true;
}

export async function smartAlign(position: AlignmentPosition, scope: 'AUTO' | 'CHILDREN' | 'PARENT' = 'AUTO') {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    figma.notify('Please select at least 1 item to align');
    return;
  }

  let alignedCount = 0;

  for (const node of selection) {
    let handled = false;

    // Check for AutoLayout first (if scope allows)
    if (scope !== 'PARENT' && isAutoLayoutNode(node) && node.layoutMode !== 'NONE') {
      const isHorizontal = node.layoutMode === 'HORIZONTAL';
      const { primary, counter } = getAutoLayoutAlignment(position, isHorizontal);
      alignItems('PRIMARY', primary, node);
      alignItems('COUNTER', counter, node);
      handled = true;
      alignedCount++;
    }

    // Fallback to parent alignment (if scope allows and not already handled)
    if (!handled && (scope === 'PARENT' || scope === 'AUTO')) {
      if (alignNodeToParentLogic(node, position)) {
        alignedCount++;
      }
    }
  }

  if (alignedCount > 0) {
    const scopeMsg = scope === 'PARENT' ? ' (to parent)' : scope === 'CHILDREN' ? ' (children)' : '';
    figma.notify(`Aligned ${alignedCount} item(s) to ${position.toLowerCase().replace('_', ' ')}${scopeMsg}`);
  } else {
    figma.notify('No items could be aligned');
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

export function alignNodesToParent(alignment: AlignmentPosition | 'CENTER_CENTER') {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    figma.notify('Please select at least 1 item to align');
    return;
  }

  const validNodes = selection.filter(node => 'x' in node && 'y' in node);
  let count = 0;

  for (const node of validNodes) {
    // Map CENTER_CENTER to CENTER for compatibility
    const pos = alignment === 'CENTER_CENTER' ? 'CENTER' : alignment;
    if (alignNodeToParentLogic(node, pos as AlignmentPosition)) {
      count++;
    }
  }

  figma.notify(`Aligned ${count} item(s) to ${alignment.toLowerCase().replace('_', ' ')} of parent`);
}

