// ================================
// Selection Functions
// ================================

export async function selectMasterComponent() {
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    figma.notify('No items selected');
    return;
  }
  
  const selectedNode = selection[0];
  
  if ('getMainComponentAsync' in selectedNode) {
    try {
      const mainComponent = await selectedNode.getMainComponentAsync();
      
      if (!mainComponent) {
        figma.notify('No master component found');
        return;
      }
      
      if (mainComponent.remote) {
        figma.notify('Master component is in a different file');
        return;
      }
      
      // Find the page containing the master component
      let componentPage = mainComponent.parent;
      while (componentPage && componentPage.type !== 'PAGE') {
        componentPage = componentPage.parent;
      }
      
      if (componentPage) {
        // Switch to the page if different
        if (componentPage.id !== figma.currentPage.id) {
          await figma.setCurrentPageAsync(componentPage);
        }
        
        figma.currentPage.selection = [mainComponent];
        figma.viewport.scrollAndZoomIntoView([mainComponent]);
        
        figma.notify(componentPage.id !== figma.currentPage.id 
          ? `Master component selected (on page "${componentPage.name}")`
          : 'Master component selected');
        }
      } catch (error) {
        figma.notify('Error accessing master component');
      }
    } else {
      figma.notify('Selected item is not an instance');
    }
  }

// Store the last used offset outside the function to persist between calls
let lastOffset = { x: 0, y: 0 };

export function duplicate() {
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  // If this is a subsequent duplication, we can calculate the offset
  // from the first selected item's position relative to its original
  if (selection[0].getPluginData('originalPosition')) {
    const originalX = parseFloat(selection[0].getPluginData('originalPosition').split(',')[0]);
    const originalY = parseFloat(selection[0].getPluginData('originalPosition').split(',')[1]);
    
    // Calculate the offset from the original position
    lastOffset = {
      x: selection[0].x - originalX,
      y: selection[0].y - originalY
    };
  }
  
  const duplicates = selection.map(node => {
    const clone = node.clone();
    const parent = node.parent;
    
    if (parent) {
      parent.appendChild(clone);
      
      // Apply the stored offset to the new clone
      clone.x = node.x + lastOffset.x;
      clone.y = node.y + lastOffset.y;
      
      // Store the original position in the new clone
      clone.setPluginData('originalPosition', `${node.x},${node.y}`);
    }
    
    return clone;
  });
  
  figma.currentPage.selection = duplicates;
  figma.notify('Items duplicated');
}

export function deleteSelection() {
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  for (const node of selection) {
    node.remove();
  }
  figma.notify('Items deleted');
}

