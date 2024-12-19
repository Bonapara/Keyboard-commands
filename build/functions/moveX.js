export function moveX(value) {
    if (value === undefined)
        throw new Error('No value provided');
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
        throw new Error('No items selected');
    }
    for (const node of selection) {
        if ('x' in node) {
            node.x += value;
        }
    }
    figma.notify(`Moved items horizontally by ${value} pixels`);
}
