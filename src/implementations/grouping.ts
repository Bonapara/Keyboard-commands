// ================================
// Grouping Functions
// ================================

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

