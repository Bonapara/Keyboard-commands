// ================================
// Effects Functions
// ================================

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

