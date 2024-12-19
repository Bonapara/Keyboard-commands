export function resizeHeight(value) {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
        throw new Error('No items selected');
    }
    for (const node of selection) {
        if ('resize' in node) {
            node.resize(node.width, value);
        }
    }
    figma.notify(`Height set to ${value} for all selected items`);
}
