// ================================
// Styling Functions
// ================================

import { resolvePaintValue, resolveStyleValue, resolveDelta } from '../utils';

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
      if (topLeftRadius !== undefined) node.topLeftRadius = Math.max(0, resolveDelta(topLeftRadius, node.topLeftRadius));
      if (topRightRadius !== undefined) node.topRightRadius = Math.max(0, resolveDelta(topRightRadius, node.topRightRadius));
      if (bottomLeftRadius !== undefined) node.bottomLeftRadius = Math.max(0, resolveDelta(bottomLeftRadius, node.bottomLeftRadius));
      if (bottomRightRadius !== undefined) node.bottomRightRadius = Math.max(0, resolveDelta(bottomRightRadius, node.bottomRightRadius));
    }
  }

  figma.notify('Radius updated for all selected items');
}

export function setCornerSmoothing(value: string) {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }

  for (const node of selection) {
    if ('cornerSmoothing' in node) {
      const currentPercent = (node.cornerSmoothing ?? 0) * 100;
      const next = Math.max(0, Math.min(100, resolveDelta(value, currentPercent)));
      node.cornerSmoothing = next / 100;
    }
  }

  figma.notify(`Corner smoothing set to ${value}`);
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

export function swapFillStroke() {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    throw new Error('No items selected');
  }

  for (const node of selection) {
    // Check if node supports both fills and strokes
    if (!('fills' in node) || !('strokes' in node)) {
      continue;
    }

    // Get current fills and strokes
    const currentFills = node.fills === figma.mixed ? [] : [...(node.fills as Paint[])];
    const currentStrokes = [...node.strokes];

    // Only swap if at least one has a solid color
    if (currentFills.length === 0 && currentStrokes.length === 0) {
      continue;
    }

    // Swap fills and strokes
    node.fills = currentStrokes.length > 0 ? currentStrokes : [];
    node.strokes = currentFills.length > 0 ? currentFills : [];

    // Ensure stroke is visible if we just added one
    if (currentFills.length > 0 && 'strokeWeight' in node) {
      if (node.strokeWeight === 0) {
        node.strokeWeight = 1; // Default to 1px if no stroke weight was set
      }
    }
  }

  figma.notify('Fill and stroke swapped');
}

export async function setEffect(value: string) {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) throw new Error('No items selected');

  const resolution = await resolveStyleValue(value);

  for (const node of selection) {
    try {
      if (resolution.type === 'style' && resolution.styleKey && resolution.styleType === 'EFFECT') {
        if ('effectStyleId' in node) {
          try {
            const style = await figma.importStyleByKeyAsync(resolution.styleKey);
            if (style) {
              await node.setEffectStyleIdAsync(style.id);
            }
          } catch (e) {
            console.error(`Failed to load style ${resolution.styleKey}:`, e);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to apply effect to ${node.name}:`, error);
    }
  }

  figma.notify('Effect applied successfully');
}
