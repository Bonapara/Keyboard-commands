// ================================
// Transform Functions
// ================================

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
  
  figma.notify(`Rotated ${value}° for all selected items`);
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

