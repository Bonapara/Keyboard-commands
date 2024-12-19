export function rotate(value) {
    if (value === undefined)
        throw new Error('No value provided');
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
        throw new Error('No items selected');
    }
    for (const node of selection) {
        if ('rotation' in node) {
            node.rotation = value;
        }
    }
    figma.notify(`Rotation set to ${value}° for all selected items`);
}
