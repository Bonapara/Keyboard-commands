// ================================
// Visibility Functions
// ================================

import { clearNodeBoundVariables, resolveDelta, resolveNumberValue, resolveNumberVariable, setNodeBoundVariable } from '../utils';

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
      clearNodeBoundVariables(node, 'opacity');
      node.opacity = node.opacity === 0 ? 1 : 0;
    }
  }
  
  const firstNode = selection[0];
  if ('opacity' in firstNode) {
    const newOpacity = firstNode.opacity === 0 ? 0 : 100;
    figma.notify(`Opacity toggled to ${newOpacity}%`);
  }
}

export async function setOpacity(value: string) {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }

  const resolution = await resolveNumberValue(value);

  for (const node of selection) {
    if ('opacity' in node) {
      if (resolution.type === 'variable') {
        setNodeBoundVariable(node, 'opacity', await resolveNumberVariable(resolution));
      } else {
        clearNodeBoundVariables(node, 'opacity');
        const currentPercent = node.opacity * 100;
        const next = Math.max(0, Math.min(100, resolveDelta(value, currentPercent)));
        node.opacity = next / 100;
      }
    }
  }

  figma.notify(`Opacity set to ${value}`);
}
