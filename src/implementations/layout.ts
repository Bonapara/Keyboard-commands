// ================================
// Layout Functions
// ================================

import { resolveDelta } from '../utils';

export function createAutoLayout(direction: 'HORIZONTAL' | 'VERTICAL' = 'HORIZONTAL') {
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

export function setPadding({ paddingLeft, paddingRight, paddingTop, paddingBottom }: {
  paddingLeft?: string;
  paddingRight?: string;
  paddingTop?: string;
  paddingBottom?: string;
}) {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    throw new Error('No items selected');
  }

  for (const node of selection) {
    if ('paddingLeft' in node) {
      if (paddingLeft !== undefined) node.paddingLeft = Math.max(0, resolveDelta(paddingLeft, node.paddingLeft));
      if (paddingRight !== undefined) node.paddingRight = Math.max(0, resolveDelta(paddingRight, node.paddingRight));
      if (paddingTop !== undefined) node.paddingTop = Math.max(0, resolveDelta(paddingTop, node.paddingTop));
      if (paddingBottom !== undefined) node.paddingBottom = Math.max(0, resolveDelta(paddingBottom, node.paddingBottom));
    }
  }

  figma.notify('Padding updated for all selected items');
}

export function layoutSizing(direction: 'HORIZONTAL' | 'VERTICAL', value: 'HUG' | 'FIXED' | 'FILL') {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    throw new Error('No items selected');
  }

  selection.forEach(node => {
    // Handle frames: add auto-layout if needed
    if ('layoutMode' in node) {
      // Enable auto-layout if not already set
      if (node.layoutMode === 'NONE') {
        node.layoutMode = direction;
      }
      try {
        if (direction === 'HORIZONTAL') {
          if ('layoutSizingHorizontal' in node) {
            node.layoutSizingHorizontal = value;
            figma.notify(`Horizontal layout sizing set to ${value.toLowerCase()}`);
          }
        } else {
          if ('layoutSizingVertical' in node) {
            node.layoutSizingVertical = value;
            figma.notify(`Vertical layout sizing set to ${value.toLowerCase()}`);
          }
        }
        return;
      } catch (error) {
        console.warn(`Failed to set layout sizing on node:`, error);
        figma.notify('Failed to set layout sizing');
        return;
      }
    }

    // For non-frames, check if the node is inside an auto-layout frame
    const parent = node.parent;
    if (!parent || !('layoutMode' in parent) || parent.layoutMode === 'NONE') {
      figma.notify('Selected item must be inside an auto-layout frame');
      return;
    }

    try {
      // Attempt to set the layout sizing directly
      if (direction === 'HORIZONTAL') {
        if ('layoutSizingHorizontal' in node) {
          node.layoutSizingHorizontal = value;
          figma.notify(`Horizontal layout sizing set to ${value.toLowerCase()}`);
        }
      } else {
        if ('layoutSizingVertical' in node) {
          node.layoutSizingVertical = value;
          figma.notify(`Vertical layout sizing set to ${value.toLowerCase()}`);
        }
      }
    } catch (error) {
      console.warn(`Failed to set layout sizing on node:`, error);
      figma.notify('Failed to set layout sizing');
    }
  });
}

// Set primary axis gap (horizontal)
export function setPrimaryGap(gap: string | 'AUTO') {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    throw new Error('No items selected');
  }

  selection.forEach(node => {
    if ('layoutMode' in node && node.layoutMode !== 'NONE') {
      if (gap === 'AUTO') {
        node.primaryAxisAlignItems = 'SPACE_BETWEEN';
        figma.notify('Primary gap set to AUTO');
      } else {
        node.primaryAxisAlignItems = 'MIN';
        node.itemSpacing = Math.max(0, resolveDelta(gap, node.itemSpacing));
        figma.notify(`Primary gap set to ${gap}`);
      }
    } else {
      figma.notify('Selected node must be an auto-layout');
    }
  });
}

// Set counter axis gap (vertical for wrap layouts)
export function setCounterGap(gap: string | 'AUTO') {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    throw new Error('No items selected');
  }

  selection.forEach(node => {
    if ('layoutMode' in node && 'layoutWrap' in node && node.layoutWrap === 'WRAP') {
      if (gap === 'AUTO') {
        node.counterAxisAlignContent = 'SPACE_BETWEEN';
        figma.notify('Counter gap set to AUTO');
      } else {
        node.counterAxisAlignContent = 'AUTO';
        const current = typeof node.counterAxisSpacing === 'number' ? node.counterAxisSpacing : 0;
        node.counterAxisSpacing = Math.max(0, resolveDelta(gap, current));
        figma.notify(`Counter gap set to ${gap}`);
      }
    } else {
      figma.notify('Selected node must be a wrap auto-layout');
    }
  });
}

export function setLayout(mode: 'HORIZONTAL' | 'VERTICAL' | 'WRAP' | 'NONE') {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    throw new Error('No items selected');
  }

  selection.forEach(node => {
    if (node.type === 'FRAME') {
      if (mode === 'WRAP') {
        node.layoutMode = 'HORIZONTAL'; // Set to HORIZONTAL for WRAP
        node.layoutWrap = 'WRAP';
      } else {
        node.layoutMode = mode as 'HORIZONTAL' | 'VERTICAL' | 'NONE';
        node.layoutWrap = 'NO_WRAP';
      }

      figma.notify(`${mode.toLowerCase()} layout applied`);
    } else {
      console.warn('Selected item is not a frame:', node);
    }
  });
}

