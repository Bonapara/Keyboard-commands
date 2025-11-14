// ================================
// Implementation Functions
// ================================

export function resize(value: string, resizeType?: 'width' | 'height') {
  const numValue = Number(value);
  if (isNaN(numValue)) throw new Error('Invalid number provided');
  
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  for (const node of selection) {
    if ('resize' in node) {
      const newSize = {
        width: resizeType ? (resizeType === 'width' ? numValue : node.width) : numValue,
        height: resizeType ? (resizeType === 'height' ? numValue : node.height) : numValue
      };
      node.resize(newSize.width, newSize.height);
    }
  }
  
  const message = resizeType 
    ? `${resizeType} set to ${value} for all selected items`
    : `width and height set to ${value} for all selected items`;
  figma.notify(message);
}

export function setFill(value: string) {
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

export function toggleFill() {
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
      if (paddingLeft !== undefined) node.paddingLeft = Number(paddingLeft);
      if (paddingRight !== undefined) node.paddingRight = Number(paddingRight);
      if (paddingTop !== undefined) node.paddingTop = Number(paddingTop);
      if (paddingBottom !== undefined) node.paddingBottom = Number(paddingBottom);
    }
  }
  
  figma.notify('Padding updated for all selected items');
}

export function rotate(value: number) {
  if (!value && value !== 0) throw new Error('No value provided');
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  for (const node of selection) {
    if ('rotation' in node) {
      // If rotating to 0, clean up stored plugin data to prevent memory leak
      if (value === 0) {
        node.rotation = 0;
        node.setPluginData('originalX', '');
        node.setPluginData('originalY', '');
        continue;
      }
      
      // Get or store original position
      let originalX = node.getPluginData('originalX');
      let originalY = node.getPluginData('originalY');
      
      // If no stored position, use current position and store it
      if (!originalX || !originalY) {
        originalX = node.x.toString();
        originalY = node.y.toString();
        node.setPluginData('originalX', originalX);
        node.setPluginData('originalY', originalY);
      }
      
      // Convert to numbers
      const origX = parseFloat(originalX);
      const origY = parseFloat(originalY);
      
      // Reset rotation
      node.rotation = 0;
      const theta = value * (Math.PI/180); // radians
      
      // Use original position for center calculation
      const cx = origX + node.width/2;
      const cy = origY + node.height/2;
      
      // Calculate new position using original coordinates
      const newx = Math.cos(theta) * origX + origY * Math.sin(theta) 
      - cy * Math.sin(theta) - cx * Math.cos(theta) + cx;
      const newy = -Math.sin(theta) * origX + cx * Math.sin(theta) 
      + origY * Math.cos(theta) - cy * Math.cos(theta) + cy;
      
      node.relativeTransform = [
        [Math.cos(theta), Math.sin(theta), newx],
        [-Math.sin(theta), Math.cos(theta), newy]
      ];
    }
  }
  
  // figma.notify(`Rotated ${value}° for all selected items`);
  figma.notify(`🚀 V8 BRANCH 🚀 Rotated ${value}° for all selected items`, { timeout: 5000 })
}

export function move(direction: 'TOP' | 'RIGHT' | 'LEFT' | 'BOTTOM', value: string) {
  if (value === undefined) throw new Error('No value provided');
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) throw new Error('No items selected');
  
  const numValue = Number(value);
  
  for (const node of selection) {
    if ((direction === 'LEFT' || direction === 'RIGHT') && 'x' in node) {
      node.x += direction === 'RIGHT' ? numValue : -numValue;
    } else if ((direction === 'TOP' || direction === 'BOTTOM') && 'y' in node) {
      node.y += direction === 'BOTTOM' ? numValue : -numValue;
    }
  }
  
  const dirValue = (direction === 'LEFT' || direction === 'TOP') ? -numValue : numValue;
  figma.notify(`Moved items ${direction.toLowerCase()} by ${Math.abs(dirValue)} pixels`);
}

export function scale(value?: string, dimension?: 'width' | 'height') {
  if (value === undefined) throw new Error('No value provided');
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  for (const node of selection) {
    if ('rescale' in node) {
      let scaleFactor: number;
      
      if (dimension === 'width') {
        scaleFactor = Number(value) / node.width;
      } else if (dimension === 'height') {
        scaleFactor = Number(value) / node.height;
      } else {
        scaleFactor = Number(value) / 100;
      }
      
      if (scaleFactor < 0.01) throw new Error('Scale factor must be at least 1%');
      node.rescale(scaleFactor);
    }
  }
  
  const message = dimension 
  ? `Scaled items to ${value}${dimension === 'width' ? 'w' : 'h'}`
  : `Scaled items to ${value}%`;
  
  figma.notify(message);
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
    if (node.type === 'FRAME') {
      if (!('layoutMode' in node)) {
        figma.notify('Selected frame must be an auto-layout frame');
        return;
      }
      
      if (gap === 'AUTO') {
        node.primaryAxisAlignItems = 'SPACE_BETWEEN';
        figma.notify('Primary gap set to AUTO');
      } else {
        node.primaryAxisAlignItems = 'MIN';
        node.itemSpacing = Number(gap);
        figma.notify(`Primary gap set to ${gap}`);
      }
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
    if (node.type === 'FRAME') {
      if (!('layoutMode' in node) || node.layoutWrap !== 'WRAP') {
        figma.notify('Selected frame must be a wrap auto-layout frame');
        return;
      }
      
      if (gap === 'AUTO') {
        node.counterAxisAlignContent = 'SPACE_BETWEEN';
        figma.notify('Counter gap set to AUTO');
      } else {
        node.counterAxisAlignContent = 'AUTO';
        node.counterAxisSpacing = Number(gap);
        figma.notify(`Counter gap set to ${gap}`);
      }
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

export function deleteSelection() {
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  for (const node of selection) {
    node.remove();
  }
  figma.notify('Items deleted');
}

export function setRadius({ 
  topLeftRadius, 
  topRightRadius, 
  bottomLeftRadius, 
  bottomRightRadius 
}: {
  topLeftRadius?: string;
  topRightRadius?: string;
  bottomLeftRadius?: string;
  bottomRightRadius?: string;
}) {
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  for (const node of selection) {
    if ('topLeftRadius' in node) {
      if (topLeftRadius !== undefined) node.topLeftRadius = Number(topLeftRadius);
      if (topRightRadius !== undefined) node.topRightRadius = Number(topRightRadius)  ;
      if (bottomLeftRadius !== undefined) node.bottomLeftRadius = Number(bottomLeftRadius);
      if (bottomRightRadius !== undefined) node.bottomRightRadius = Number(bottomRightRadius);
    }
  }
  
  figma.notify('Radius updated for all selected items');
}

export function flip(direction: 'horizontal' | 'vertical') {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) return;
  
  for (const node of selection) {
    if ("relativeTransform" in node) {
      const transform = node.relativeTransform;
      if (direction === "horizontal" && "width" in node) {
        const cx = node.x;
        node.relativeTransform = [
          [-transform[0][0], -transform[0][1], transform[0][2]],
          [ transform[1][0],  transform[1][1], transform[1][2]]
        ];
        if (node.relativeTransform[0][0] < 0) node.x = cx + node.width;
        else node.x = cx - node.width;
      } else if (direction === "vertical" && "height" in node) {
        const cy = node.y;
        node.relativeTransform = [
          [transform[0][0],  transform[0][1], transform[0][2]],
          [-transform[1][0], -transform[1][1], transform[1][2]]
        ];
        if (node.relativeTransform[1][1] < 0) node.y = cy + node.height;
        else node.y = cy - node.height;
      }
    }
  }
}

export function setCornerSmoothing(value: string) {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  // Convert value from 0-100 range to 0-1 range and clamp
  const inputValue = Math.max(0, Math.min(100, Number(value)));
  const smoothing = inputValue / 100;
  
  for (const node of selection) {
    if ('cornerSmoothing' in node) {
      node.cornerSmoothing = smoothing;
    }
  }
  
  figma.notify(`Corner smoothing set to ${inputValue}%`);
}

export function grouping(action: 'group' | 'ungroup') {
  const selection = figma.currentPage.selection;
  
  if (action === 'group') {
    if (selection.length < 2) {
      throw new Error('Select at least 2 items to group');
    }
    
    const parent = selection[0].parent;
    if (!parent) throw new Error('No parent found for selected items');
    
    for (const node of selection) {
      if (node.parent !== parent) {
        throw new Error('All selected items must share the same parent to group');
      }
    }
    
    const groupNode = figma.group(selection, parent);
    figma.currentPage.selection = [groupNode];
    figma.notify('Items grouped');
    
  } else if (action === 'ungroup') {
    if (selection.length === 0) throw new Error('No items selected');
    
    const ungroupedChildren: SceneNode[] = [];
    for (const node of selection) {
      if ((node.type === 'GROUP' || node.type === 'FRAME') && 'children' in node) {
        const children = figma.ungroup(node);
        ungroupedChildren.push(...children);
      }
    }
    
    if (ungroupedChildren.length > 0) {
      figma.currentPage.selection = ungroupedChildren;
    }
    
    figma.notify('Items ungrouped');
  }
}

export function clipContent() {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  for (const node of selection) {
    switch (node.type) {
      case 'COMPONENT':
      case 'COMPONENT_SET':
      case 'FRAME':
      case 'INSTANCE':
      if ('clipsContent' in node) {
        (node as FrameNode).clipsContent = !(node as FrameNode).clipsContent;
      }
      break;
    }
  }
}

export function toggleVisibility() {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  for (const node of selection) {
    if ('visible' in node) {
      node.visible = !node.visible;
    }
  }
}

export function toggleOpacity() {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  for (const node of selection) {
    if ('opacity' in node) {
      node.opacity = node.opacity === 0 ? 1 : 0;
    }
  }
  
  const firstNode = selection[0];
  if ('opacity' in firstNode) {
    const newOpacity = firstNode.opacity === 0 ? 0 : 100;
    figma.notify(`Opacity toggled to ${newOpacity}%`);
  }
}

export function setOpacity(value: string) {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  for (const node of selection) {
    if ('opacity' in node) {
      node.opacity = Math.max(0, Math.min(100, Number(value))) / 100;
    }
  }
  
  figma.notify(`Opacity set to ${Math.min(100, Math.max(0, Number(value)))}%`);
}

// Store the last used offset outside the function to persist between calls
let lastOffset = { x: 0, y: 0 };

export function duplicate() {
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  // If this is a subsequent duplication, we can calculate the offset
  // from the first selected item's position relative to its original
  if (selection[0].getPluginData('originalPosition')) {
    const originalX = parseFloat(selection[0].getPluginData('originalPosition').split(',')[0]);
    const originalY = parseFloat(selection[0].getPluginData('originalPosition').split(',')[1]);
    
    // Calculate the offset from the original position
    lastOffset = {
      x: selection[0].x - originalX,
      y: selection[0].y - originalY
    };
  }
  
  const duplicates = selection.map(node => {
    const clone = node.clone();
    const parent = node.parent;
    
    if (parent) {
      parent.appendChild(clone);
      
      // Apply the stored offset to the new clone
      clone.x = node.x + lastOffset.x;
      clone.y = node.y + lastOffset.y;
      
      // Store the original position in the new clone
      clone.setPluginData('originalPosition', `${node.x},${node.y}`);
    }
    
    return clone;
  });
  
  figma.currentPage.selection = duplicates;
  figma.notify('Items duplicated');
}

// Helper function to get existing border style or create new one
function getOrCreateBorder(node: SceneNode): Paint[] {
  if ('strokes' in node && node.strokes.length > 0) {
    // Create a new array from the readonly borders
    return [...node.strokes];
  }
  return [{
    type: 'SOLID' as const,
    color: { r: 0, g: 0, b: 0 },
    opacity: 1
  }];
}

export function setBorder(side: 'all' | 'left' | 'right' | 'top' | 'bottom', width: string) {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  for (const node of selection) {
    if (!('strokes' in node) || !('strokeWeight' in node) || 
    !('strokeLeftWeight' in node) || !('strokeRightWeight' in node) || 
    !('strokeTopWeight' in node) || !('strokeBottomWeight' in node)) {
      continue;
    }
    
    // If no strokes are set, initialize with all sides at 0
    if (node.strokes.length === 0) {
      node.strokes = getOrCreateBorder(node);
      node.strokeAlign = 'INSIDE';
      
      // Reset all sides to 0
      node.strokeLeftWeight = 0;
      node.strokeRightWeight = 0;
      node.strokeTopWeight = 0;
      node.strokeBottomWeight = 0;
    }
    
    if (side !== 'all') {
      node.strokeAlign = 'INSIDE';
    }
    
    switch (side) {
      case 'all':
      node.strokeWeight = Number(width);
      break;
      case 'left':
      node.strokeLeftWeight = Number(width);
      break;
      case 'right':
      node.strokeRightWeight = Number(width);
      break;
      case 'top':
      node.strokeTopWeight = Number(width);
      break;
      case 'bottom':
      node.strokeBottomWeight = Number(width);
      break;
    }
  }
  
  figma.notify(`${side.charAt(0).toUpperCase() + side.slice(1)} stroke set to ${Number(width)}px`);
}

export function toggleBorder(side: 'all' | 'left' | 'right' | 'top' | 'bottom') {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  for (const node of selection) {
    if (!('strokes' in node) || !('strokeWeight' in node) ||
    !('strokeLeftWeight' in node) || !('strokeRightWeight' in node) ||
    !('strokeTopWeight' in node) || !('strokeBottomWeight' in node)) {
      continue;
    }
    
    // Handle 'all' separately
    if (side === 'all') {
      if (node.strokes.length === 0 || node.strokeWeight === 0)
        {
        node.strokes = getOrCreateBorder(node);
        node.strokeWeight = 1;
      } else {
        node.strokes = [];
      }
      continue;
    }
    
    // If no strokes are set, this means no visible stroke. 
    // Set all sides to 0, then apply stroke to the toggled side.
    const noVisibleBorder = (node.strokes.length === 0 || node.strokeWeight === 0);
    
    if (noVisibleBorder) {
      node.strokes = getOrCreateBorder(node);
      node.strokeAlign = 'INSIDE';
      
      node.strokeLeftWeight = 0;
      node.strokeRightWeight = 0;
      node.strokeTopWeight = 0;
      node.strokeBottomWeight = 0;
      
      // Since we know there's no visible stroke, just set this side to 1
      switch (side) {
        case 'left':
        node.strokeLeftWeight = 1;
        break;
        case 'right':
        node.strokeRightWeight = 1;
        break;
        case 'top':
        node.strokeTopWeight = 1;
        break;
        case 'bottom':
        node.strokeBottomWeight = 1;
        break;
      }
      
      figma.notify(`${side.charAt(0).toUpperCase() + side.slice(1)} stroke toggled`);
      continue;
    }
    
    // If we reach here, some stroke exists. Toggle on/off this side without affecting others.
    node.strokeAlign = 'INSIDE';
    
    const currentWeight = (() => {
      switch (side) {
        case 'left': return node.strokeLeftWeight;
        case 'right': return node.strokeRightWeight;
        case 'top': return node.strokeTopWeight;
        case 'bottom': return node.strokeBottomWeight;
      }
    })();
    
    const hasAnyBorder =
    node.strokeLeftWeight > 0 ||
    node.strokeRightWeight > 0 ||
    node.strokeTopWeight > 0 ||
    node.strokeBottomWeight > 0;
    
    let newWidth: number;
    if (currentWeight > 0) {
      // This side currently has a border, remove it
      newWidth = 0;
    } else {
      // This side has no border currently
      if (!hasAnyBorder) {
        // If somehow no border is set (shouldn't happen here because we handled noVisibleBorder above),
        // just set this side to 1.
        newWidth = 1;
      } else {
        // Some other side has a border, match its thickness
        const widths = [
          node.strokeLeftWeight,
          node.strokeRightWeight,
          node.strokeTopWeight,
          node.strokeBottomWeight
        ].filter(w => w > 0);
        const existingWidth = widths[0] || 1;
        newWidth = existingWidth;
      }
    }
    
    // Apply the new width
    switch (side) {
      case 'left':
      node.strokeLeftWeight = newWidth;
      break;
      case 'right':
      node.strokeRightWeight = newWidth;
      break;
      case 'top':
      node.strokeTopWeight = newWidth;
      break;
      case 'bottom':
      node.strokeBottomWeight = newWidth;
      break;
    }
    
    figma.notify(`${side.charAt(0).toUpperCase() + side.slice(1)} border toggled`);
  }
}

export async function toggleTheme() {
  const selection = figma.currentPage.selection;
  if (!selection.length) return;
  
  async function findThemeCollection() {
    const localCollections = await figma.variables.getLocalVariableCollectionsAsync();
    const themeCollection = localCollections.find(c =>
      c.name.toLowerCase().includes("theme") || c.name.toLowerCase().includes("appearance")
    );
    if (themeCollection) return themeCollection;
    
    const libraryCollections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
    const libraryTheme = libraryCollections.find(c =>
      c.name.toLowerCase().includes("theme") || c.name.toLowerCase().includes("appearance")
    );
    if (!libraryTheme) return;
    
    const libraryVars = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(libraryTheme.key);
    if (!libraryVars.length) return;
    
    const importedVar = await figma.variables.importVariableByKeyAsync(libraryVars[0].key);
    return figma.variables.getVariableCollectionByIdAsync(importedVar.variableCollectionId);
  }
  
  const themeCollection = await findThemeCollection();
  if (!themeCollection) return;
  
  const lightMode = themeCollection.modes.find(m => /light|day/i.test(m.name));
  const darkMode = themeCollection.modes.find(m => /dark|night/i.test(m.name));
  if (!lightMode || !darkMode) return;
  
  for (const node of selection) {
    const currentModeId = node.resolvedVariableModes[themeCollection.id];
    if (node.boundVariables && themeCollection.id in node.resolvedVariableModes) {
      if (currentModeId === lightMode.modeId) {
        node.setExplicitVariableModeForCollection(themeCollection, darkMode.modeId);
      } else if (currentModeId === darkMode.modeId) {
        node.clearExplicitVariableModeForCollection(themeCollection);
      }
    } else {
      if (themeCollection.defaultModeId === lightMode.modeId) {
        node.setExplicitVariableModeForCollection(themeCollection, darkMode.modeId);
      } else if (themeCollection.defaultModeId === darkMode.modeId) {
        node.setExplicitVariableModeForCollection(themeCollection, lightMode.modeId);
      }
    }
  }
}

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

interface DimensionOptions {
  type: 'max' | 'min';
  direction: 'width' | 'height';
  null: boolean;
  value?: string;
}

export function maxDimension({ type, direction, null: isNull, value }: DimensionOptions): void {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  for (const node of selection) {
    // Check if node supports max/min width/height properties
    if ('maxWidth' in node && 'maxHeight' in node) {
      if (isNull) {
        // Set the property to null to remove constraint
        if (type === 'max' && direction === 'width') {
          node.maxWidth = null;
        } else if (type === 'max' && direction === 'height') {
          node.maxHeight = null;
        } else if (type === 'min' && direction === 'width') {
          node.minWidth = null;
        } else if (type === 'min' && direction === 'height') {
          node.minHeight = null;
        }
      } else {
        // Set the constraint value   
        if (value !== undefined && Number(value) > 0) {
          if (type === 'max' && direction === 'width') {
            node.maxWidth = Number(value);
          } else if (type === 'max' && direction === 'height') {
            node.maxHeight = Number(value);
          } else if (type === 'min' && direction === 'width') {
            node.minWidth = Number(value);
          } else if (type === 'min' && direction === 'height') {
            node.minHeight = Number(value);
          }
        }
      }
    }
  }
  
  const dimensionType = `${type} ${direction}`;
  const message = isNull 
  ? `Removed ${dimensionType} constraint`
  : `Set ${dimensionType} to ${value}px`;
  
  figma.notify(message);
}

// Remove effects
export function removeEffect() {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  for (const node of selection) {
    if ('effects' in node) {
      node.effects = [];
    }
  }
}

export async function exportAs({
  format,
  constraintType,
  constraintValue
}: {
  format: 'SVG' | 'PNG' | 'PDF' | 'JPG';
  constraintType?: 'SCALE' | 'WIDTH' | 'HEIGHT';
  constraintValue: string;
}) {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  // Create export settings object based on format
  const settings: ExportSettings = (() => {
    switch (format) {
      case 'PDF':
      return {
        format: 'PDF',
      };
      case 'SVG':
      return {
        format: 'SVG',
      };
      case 'PNG':
      case 'JPG':
      return {
        format: format,
        constraint: {
          type: constraintType || 'SCALE',
          value: Number(constraintValue)
        }
      };
      default:
      throw new Error(`Unsupported format: ${format}`);
    }
  })();
  
  try {
    // Export each selected node
    const exportResults = [];
    for (const node of selection) {
      const exportResult = await node.exportAsync(settings);
      exportResults.push({
        name: node.name,
        format,
        bytes: exportResult
      });
    }
    figma.showUI(__html__, { visible: false });
    figma.ui.postMessage(exportResults);
  } catch (error) {
    console.error('Export failed:', error);
    figma.notify('Export failed. Please try again.');
    throw error;
  }
  
  // Handle messages from UI with timeout to prevent hanging
  return new Promise((resolve, _reject) => {
    const timeout = setTimeout(() => {
      figma.notify('Export completed');
      resolve('Export timeout - files may still be downloading');
    }, 10000); // 10 second timeout
    
    figma.ui.onmessage = msg => {
      clearTimeout(timeout);
      resolve(msg);
      figma.closePlugin();
    };
  });
}

export function absolutePosition() {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  for (const node of selection) {
    if ('layoutPositioning' in node) {
      if (node.layoutPositioning === 'ABSOLUTE') {
        node.layoutPositioning = 'AUTO';
      } else {
        node.layoutPositioning = 'ABSOLUTE';
      }
    }
    break;
  }
}

export function setConstraints(direction: 'VERTICAL' | 'HORIZONTAL', value: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE') {
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  selection.forEach(node => {
    // Check if node has constraints property
    if ('constraints' in node) {
      try {
        // Create new constraints object maintaining the other direction's value
        const newConstraints = { ...node.constraints };
        
        // Update the specified direction
        if (direction === 'HORIZONTAL') {
          newConstraints.horizontal = value;
        } else {
          newConstraints.vertical = value;
        }
        
        // Set the new constraints
        node.constraints = newConstraints;
        figma.notify(`${direction.toLowerCase()} constraint set to ${value.toLowerCase()}`);
      } catch (error) {
        console.warn(`Failed to set constraints on node:`, error);
        figma.notify('Failed to set constraints');
      }
    } else {
      figma.notify('Selected item does not support constraints');
    }
  });
}

// Main positioning function that handles all sides
export function position(value: string, side: 'left' | 'right' | 'top' | 'bottom') {
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  for (const node of selection) {
    if ('x' in node && node.parent) {
      // Check if parent has width/height properties
      if (!('width' in node.parent) || !('height' in node.parent)) {
        throw new Error('Parent node must be a frame, component, or other container with dimensions');
      }
      
      const numValue = Number(value);
      
      switch (side) {
        case 'left':
        node.x = numValue;
        break;
        
        case 'right':
        // Position from right = parent width - node width - desired distance from right
        node.x = (node.parent as FrameNode).width - node.width - numValue;
        break;
        
        case 'top':
        node.y = numValue;
        break;
        
        case 'bottom':
        // Position from bottom = parent height - node height - desired distance from bottom
        node.y = (node.parent as FrameNode).height - node.height - numValue;
        break;
      }
    }
  }
  
  figma.notify(`Position set ${value}px from ${side} for all selected items`);
}

export function setBorderAlign(alignment: 'CENTER' | 'INSIDE' | 'OUTSIDE') {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  for (const node of selection) {
    // Check if the node supports border alignment
    if (!('strokeAlign' in node)) {
      continue;
    }
    
    // Set the border alignment
    node.strokeAlign = alignment;
  }
  
  figma.notify(`Border alignment set to ${alignment.toLowerCase()}`);
}

export async function selectMasterComponent() {
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    figma.notify('No items selected');
    return;
  }
  
  const selectedNode = selection[0];
  
  if ('getMainComponentAsync' in selectedNode) {
    try {
      const mainComponent = await selectedNode.getMainComponentAsync();
      
      if (!mainComponent) {
        figma.notify('No master component found');
        return;
      }
      
      if (mainComponent.remote) {
        figma.notify('Master component is in a different file');
        return;
      }
      
      // Find the page containing the master component
      let componentPage = mainComponent.parent;
      while (componentPage && componentPage.type !== 'PAGE') {
        componentPage = componentPage.parent;
      }
      
      if (componentPage) {
        // Switch to the page if different
        if (componentPage.id !== figma.currentPage.id) {
          await figma.setCurrentPageAsync(componentPage);
        }
        
        figma.currentPage.selection = [mainComponent];
        figma.viewport.scrollAndZoomIntoView([mainComponent]);
        
        figma.notify(componentPage.id !== figma.currentPage.id 
          ? `Master component selected (on page "${componentPage.name}")`
          : 'Master component selected');
        }
      } catch (error) {
        figma.notify('Error accessing master component');
      }
    } else {
      figma.notify('Selected item is not an instance');
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
  
  export async function setTextAutoResize(resizeType: 'NONE' | 'WIDTH_AND_HEIGHT' | 'HEIGHT') {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      throw new Error('No items selected');
    }
    
    for (const node of selection) {
      if (node.type === 'TEXT') {
        try {
          // Ensure the font is loaded before setting textAutoResize
          if (node.fontName !== figma.mixed) {
            await figma.loadFontAsync(node.fontName);
            node.textAutoResize = resizeType;
          }
        } catch (error) {
          console.error('Error loading font:', error);
          figma.notify(`Failed to set text auto-resize for "${node.name}"`);
        }
      }
    }
    figma.notify(`Text auto-resize set to ${resizeType.toLowerCase().replace('_', ' ')}`);
  }
  
  export async function textTruncation(maxLines?: string) {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      throw new Error('No items selected');
    }
    
    for (const node of selection) {
      if (node.type === 'TEXT') {
        try {
          if (node.fontName !== figma.mixed) {
            await figma.loadFontAsync(node.fontName);
            if (maxLines === undefined) {
              // Toggle mode
              const newTruncation = node.textTruncation === 'DISABLED' ? 'ENDING' : 'DISABLED';
              node.textTruncation = newTruncation;
              figma.notify(`Text truncation ${newTruncation === 'ENDING' ? 'enabled' : 'disabled'}`);
            } else {
              // Set mode with max lines
              const lines = parseInt(maxLines);
              if (isNaN(lines) || lines < 1) {
                throw new Error('Please provide a valid number greater than or equal to 1');
              }
              node.textTruncation = 'ENDING';
              node.maxLines = lines;
              figma.notify(`Text truncation set to ${lines} lines`);
            }
          }
        } catch (error) {
          console.error('Error setting text truncation:', error);
          figma.notify(`Failed to set text truncation for "${node.name}"`);
        }
      }
    }
  }
  
  export async function setFontSize(size: string) {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      throw new Error('No items selected');
    }
    
    const fontSize = parseInt(size);
    if (isNaN(fontSize) || fontSize < 1) {
      throw new Error('Please provide a valid font size greater than 0');
    }
    
    for (const node of selection) {
      if (node.type === 'TEXT') {
        try {
          if (node.fontName !== figma.mixed) {
            await figma.loadFontAsync(node.fontName);
            node.fontSize = fontSize;
          }
        } catch (error) {
          console.error('Error loading font:', error);
          figma.notify(`Failed to set font size for "${node.name}"`);
        }
      }
    }
    figma.notify(`Font size set to ${fontSize}px`);
  }
  
  export async function setFontWeight(weight: string) {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      throw new Error('No items selected');
    }
    
    const fontWeight = parseInt(weight);
    if (isNaN(fontWeight) || fontWeight < 100 || fontWeight > 900 || fontWeight % 100 !== 0) {
      throw new Error('Please provide a valid font weight (100-900 in steps of 100)');
    }
    
    for (const node of selection) {
      if (node.type === 'TEXT' && node.fontName !== figma.mixed) {
        try {
          const currentFont = node.fontName as FontName;
          const newFontName = {
            family: currentFont.family,
            style: fontWeight.toString()
          };
          
          await figma.loadFontAsync(newFontName);
          node.fontName = newFontName;
        } catch (error) {
          console.error('Error loading font weight:', error);
          figma.notify(`Failed to set font weight for "${node.name}" - weight ${fontWeight} may not be available`);
        }
      }
    }
    figma.notify(`Font weight set to ${fontWeight}`);
  }
  
  export async function setLetterSpacing(spacing: string) {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      throw new Error('No items selected');
    }
    
    const letterSpacing = parseFloat(spacing);
    if (isNaN(letterSpacing)) {
      throw new Error('Please provide a valid number for letter spacing');
    }
    
    for (const node of selection) {
      if (node.type === 'TEXT') {
        try {
          if (node.fontName !== figma.mixed) {
            await figma.loadFontAsync(node.fontName);
            node.letterSpacing = { value: letterSpacing, unit: 'PIXELS' };
          }
        } catch (error) {
          console.error('Error loading font:', error);
          figma.notify(`Failed to set letter spacing for "${node.name}"`);
        }
      }
    }
    figma.notify(`Letter spacing set to ${letterSpacing}px`);
  }
  
  export async function setLineHeight(height: string) {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      throw new Error('No items selected');
    }
    
    for (const node of selection) {
      if (node.type === 'TEXT') {
        try {
          if (node.fontName !== figma.mixed) {
            await figma.loadFontAsync(node.fontName);
            if (height === 'AUTO') {
              node.lineHeight = { unit: 'AUTO' };
            } else {
              // Check if the height value ends with %
              const isPercentage = height.endsWith('%');
              
              // Remove % if present and parse the number
              const value = parseFloat(isPercentage ? height.slice(0, -1) : height);
              
              if (isNaN(value) || value < 0) {
                throw new Error('Please provide a valid number for line height');
              }
              
              // Set line height based on whether it's a percentage or pixel value
              node.lineHeight = isPercentage 
              ? { unit: 'PERCENT', value: value }
              : { unit: 'PIXELS', value: value };
            }
          }
        } catch (error) {
          console.error('Error loading font:', error);
          figma.notify(`Failed to set line height for "${node.name}"`);
        }
      }
    }
    figma.notify(`Line height set to ${height}`);
  }
  
  export async function setTextCase(textCase: TextCase) {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      throw new Error('No items selected');
    }
    
    for (const node of selection) {
      if (node.type === 'TEXT') {
        try {
          if (node.fontName !== figma.mixed) {
            await figma.loadFontAsync(node.fontName);
            node.textCase = textCase;
          }
        } catch (error) {
          console.error('Error loading font:', error);
          figma.notify(`Failed to set text case for "${node.name}"`);
        }
      }
    }
    figma.notify(`Text case set to ${textCase.toLowerCase().replace('_', ' ')}`);
  }
  
  export async function toggleTextDecoration(decoration: TextDecoration) {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      throw new Error('No items selected');
    }
    
    for (const node of selection) {
      if (node.type === 'TEXT') {
        try {
          if (node.fontName !== figma.mixed) {
            await figma.loadFontAsync(node.fontName);
            const newDecoration = node.textDecoration === decoration ? 'NONE' : decoration;
            node.textDecoration = newDecoration;
            figma.notify(`Text decoration ${newDecoration === 'NONE' ? 'removed' : 'set to ' + decoration.toLowerCase()}`);
          }
        } catch (error) {
          console.error('Error loading font:', error);
          figma.notify(`Failed to toggle text decoration for "${node.name}"`);
        }
      }
    }
  }
  
  export async function setTextListOptions(listType: 'ORDERED' | 'UNORDERED' | 'NONE') {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      throw new Error('No items selected');
    }
    
    for (const node of selection) {
      if (node.type === 'TEXT') {
        try {
          if (node.fontName !== figma.mixed) {
            await figma.loadFontAsync(node.fontName);
            // Select all text in the node
            const length = node.characters.length;
            node.setRangeListOptions(0, length, { type: listType });
          }
        } catch (error) {
          console.error('Error loading font:', error);
          figma.notify(`Failed to set list options for "${node.name}"`);
        }
      }
    }
    figma.notify(`List type set to ${listType.toLowerCase()}`);
  }
  
  export async function toggleVerticalTrim() {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      throw new Error('No items selected');
    }
    
    for (const node of selection) {
      if (node.type === 'TEXT') {
        try {
          if (node.fontName !== figma.mixed) {
            await figma.loadFontAsync(node.fontName);
            // Toggle between CAP_HEIGHT and NONE
            const newTrim = (node.leadingTrim === figma.mixed || 
              !node.leadingTrim || 
              node.leadingTrim === 'CAP_HEIGHT')
              ? 'NONE'
              : 'CAP_HEIGHT';
            node.leadingTrim = newTrim;
            figma.notify(`Vertical trim ${newTrim === 'NONE' ? 'disabled' : 'enabled'}`);
          }
        } catch (error) {
          console.error('Error loading font:', error);
          figma.notify(`Failed to toggle vertical trim for "${node.name}"`);
        }
      }
    }
  }
    
    export function removeTextStyle() {
      if (figma.currentPage.selection[0].type === 'TEXT') {
        figma.currentPage.selection[0].setTextStyleIdAsync('');
      }
    }

