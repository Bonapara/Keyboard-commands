// ================================
// Styling Functions
// ================================

import { resolvePaintValue } from '../utils';

export async function setFill(value: string) {
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) throw new Error('No items selected');

  const resolution = await resolvePaintValue(value);

  for (const node of selection) {
    if (!('fills' in node)) {
      continue;
    }

    try {
      switch (resolution.type) {
        case 'style': {
          if (!resolution.styleKey) break;
          
          // Get the style by key
          const localStyles = await figma.getLocalPaintStylesAsync();
          let style: PaintStyle | undefined = localStyles.find(s => s.key === resolution.styleKey);
          
          // If not found locally, import from library
          if (!style) {
            const importedStyle = await figma.importStyleByKeyAsync(resolution.styleKey);
            if (importedStyle.type === 'PAINT') {
              style = importedStyle as PaintStyle;
            }
          }
          
          if (style) {
            await node.setFillStyleIdAsync(style.id);
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

          const currentFills = node.fills === figma.mixed ? [] : [...node.fills];
          const basePaint: SolidPaint = currentFills[0]?.type === 'SOLID'
            ? currentFills[0] as SolidPaint
            : { type: 'SOLID', color: { r: 0, g: 0, b: 0 } };

          const boundPaint = figma.variables.setBoundVariableForPaint(
            basePaint,
            'color',
            variable
          );
          node.fills = [boundPaint];
          break;
        }

        case 'literal': {
          node.fills = [{
            type: 'SOLID',
            color: resolution.color!
          }];
          break;
        }
      }
    } catch (error) {
      console.error(`Failed to apply fill to ${node.name}:`, error);
      // Continue with other nodes
    }
  }

  figma.notify('Fill applied successfully');
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

