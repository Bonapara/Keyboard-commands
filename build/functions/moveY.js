export function moveY(value) {
    if (value === undefined)
        throw new Error('No value provided');
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
        throw new Error('No items selected');
    }
    for (const node of selection) {
        if ('y' in node) {
            node.y += value;
        }
    }
    figma.notify(`Moved items vertically by ${value} pixels`);
}
