// ================================
// Transform Functions
// ================================

import { resolveDelta } from '../utils';

export function rotate(value: number | string) {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    throw new Error('No items selected');
  }

  for (const node of selection) {
    if (!('rotation' in node)) continue;

    // Resolve per-node so deltas like "+15" / "-90" rotate relative to current.
    const target = typeof value === 'number'
      ? value
      : resolveDelta(value, node.rotation);

    if (Number.isNaN(target)) {
      throw new Error('No value provided');
    }

    // Anchor the rotation at the node's *current* visual center, matching
    // Figma's native rotation behavior. The previous implementation stored an
    // "original" position in pluginData and rotated around that — which drifted
    // whenever the user moved the node between rotations and accumulated stale
    // pluginData in the file. Clean any of that legacy data while we're here.
    if (node.getPluginData('originalX')) node.setPluginData('originalX', '');
    if (node.getPluginData('originalY')) node.setPluginData('originalY', '');

    const t = node.relativeTransform;
    const w = node.width;
    const h = node.height;
    const centerX = t[0][2] + (t[0][0] * w + t[0][1] * h) / 2;
    const centerY = t[1][2] + (t[1][0] * w + t[1][1] * h) / 2;

    const theta = (target * Math.PI) / 180;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);

    const newX = centerX - (cos * w + sin * h) / 2;
    const newY = centerY - (-sin * w + cos * h) / 2;

    node.relativeTransform = [
      [cos, sin, newX],
      [-sin, cos, newY],
    ];
  }

  figma.notify(`Rotated ${value}°`);
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

