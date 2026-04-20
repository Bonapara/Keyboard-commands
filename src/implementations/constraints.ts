// ================================
// Constraints Functions
// ================================

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

