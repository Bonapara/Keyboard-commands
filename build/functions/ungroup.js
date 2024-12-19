export function ungroup() {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
        throw new Error('No items selected');
    }
    const ungroupedChildren = [];
    const groupsToRemove = [];
    for (const node of selection) {
        if (node.type === 'GROUP') {
            const parent = node.parent;
            if (parent) {
                for (const child of node.children) {
                    parent.appendChild(child);
                    ungroupedChildren.push(child);
                }
                groupsToRemove.push(node);
            }
        }
    }
    // Remove groups after ungrouping all children
    for (const group of groupsToRemove) {
        group.remove();
    }
    // Update selection to ungrouped children
    if (ungroupedChildren.length > 0) {
        figma.currentPage.selection = ungroupedChildren;
    }
    figma.notify('Items ungrouped');
}
