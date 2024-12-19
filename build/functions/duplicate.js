export function duplicate() {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
        throw new Error('No items selected');
    }
    const duplicates = selection.map(node => node.clone());
    figma.currentPage.selection = duplicates;
    figma.notify('Items duplicated');
}
