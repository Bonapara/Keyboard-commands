// ================================
// Visibility Functions
// ================================

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

