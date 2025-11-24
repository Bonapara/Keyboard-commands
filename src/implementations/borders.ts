// ================================
// Border Functions
// ================================

import { resolvePaintValue, resolveNumberValue } from '../utils';
import { DEFAULT_BORDER_WIDTH } from '../constants';

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

export async function setBorder(side: 'all' | 'left' | 'right' | 'top' | 'bottom', width: string) {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  const resolution = await resolveNumberValue(width);
  
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
    
    if (resolution.type === 'variable') {
      // Handle variable binding
      let variableId = resolution.variableId!;
      if (resolution.isLibraryVariable) {
        const importedVar = await figma.variables.importVariableByKeyAsync(variableId);
        variableId = importedVar.id;
      }
      const variable = await figma.variables.getVariableByIdAsync(variableId);
      if (!variable) throw new Error('Variable not found');
      
      const boundField = side === 'all' ? 'strokeWeight' : `stroke${side.charAt(0).toUpperCase() + side.slice(1)}Weight` as
        'strokeLeftWeight' | 'strokeRightWeight' | 'strokeTopWeight' | 'strokeBottomWeight';
      
      node.setBoundVariable(boundField, variable);
    } else {
      // Handle literal value
      const value = resolution.value!;
      switch (side) {
        case 'all':
        node.strokeWeight = value;
        break;
        case 'left':
        node.strokeLeftWeight = value;
        break;
        case 'right':
        node.strokeRightWeight = value;
        break;
        case 'top':
        node.strokeTopWeight = value;
        break;
        case 'bottom':
        node.strokeBottomWeight = value;
        break;
      }
    }
  }
  
  if (resolution.type === 'variable') {
    figma.notify(`${side.charAt(0).toUpperCase() + side.slice(1)} stroke bound to ${resolution.variableName}`);
  } else {
    figma.notify(`${side.charAt(0).toUpperCase() + side.slice(1)} stroke set to ${resolution.value}px`);
  }
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
        node.strokeWeight = DEFAULT_BORDER_WIDTH;
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
        node.strokeLeftWeight = DEFAULT_BORDER_WIDTH;
        break;
        case 'right':
        node.strokeRightWeight = DEFAULT_BORDER_WIDTH;
        break;
        case 'top':
        node.strokeTopWeight = DEFAULT_BORDER_WIDTH;
        break;
        case 'bottom':
        node.strokeBottomWeight = DEFAULT_BORDER_WIDTH;
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
        newWidth = DEFAULT_BORDER_WIDTH;
      } else {
        // Some other side has a border, match its thickness
        const widths = [
          node.strokeLeftWeight,
          node.strokeRightWeight,
          node.strokeTopWeight,
          node.strokeBottomWeight
        ].filter(w => w > 0);
        const existingWidth = widths[0] || DEFAULT_BORDER_WIDTH;
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

export async function setBorderColor(value: string) {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) throw new Error('No items selected');

  const resolution = await resolvePaintValue(value);

  for (const node of selection) {
    if (!('strokes' in node)) continue;

    try {
      switch (resolution.type) {
        case 'style': {
          if (!resolution.styleKey) break;
          
          const localStyles = await figma.getLocalPaintStylesAsync();
          let style: PaintStyle | undefined = localStyles.find(s => s.key === resolution.styleKey);
          
          if (!style) {
            const importedStyle = await figma.importStyleByKeyAsync(resolution.styleKey);
            if (importedStyle.type === 'PAINT') {
              style = importedStyle as PaintStyle;
            }
          }
          
          if (style) {
            await node.setStrokeStyleIdAsync(style.id);
          }
          break;
        }

        case 'variable': {
          // Import library variable if needed
          let variableId = resolution.variableId!;
          
          if (resolution.isLibraryVariable) {
            const importedVar = await figma.variables.importVariableByKeyAsync(variableId);
            variableId = importedVar.id;
          }
          
          const variable = await figma.variables.getVariableByIdAsync(variableId);
          if (!variable) throw new Error('Variable not found');

          const currentStrokes = Array.isArray(node.strokes) ? [...node.strokes] : [];
          const basePaint: SolidPaint = currentStrokes[0]?.type === 'SOLID'
            ? currentStrokes[0] as SolidPaint
            : { type: 'SOLID', color: { r: 0, g: 0, b: 0 } };

          const boundPaint = figma.variables.setBoundVariableForPaint(
            basePaint,
            'color',
            variable
          );
          node.strokes = [boundPaint];
          break;
        }

        case 'literal': {
          node.strokes = [{
            type: 'SOLID',
            color: resolution.color!
          }];
          break;
        }
      }
    } catch (error) {
      console.error(`Failed to apply stroke to ${node.name}:`, error);
    }
  }

  figma.notify('Stroke color applied successfully');
}

