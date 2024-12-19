export function scale(value) {
    if (value === undefined)
        throw new Error('No value provided');
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
        throw new Error('No items selected');
    }
    for (const node of selection) {
        if ('resize' in node) {
            const scaleFactor = value / 100;
            node.resize(node.width * scaleFactor, node.height * scaleFactor);
        }
    }
    figma.notify(`Scaled items to ${value}%`);
}
