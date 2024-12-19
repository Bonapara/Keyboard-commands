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
