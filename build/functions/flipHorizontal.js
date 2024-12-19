export function flipHorizontal() {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
        throw new Error('No items selected');
    }
    for (const node of selection) {
        if ('transform' in node) {
            // Reflect across vertical axis
            const currentTransform = node.relativeTransform;
            // Multiply by a matrix that flips horizontally
            node.relativeTransform = [
                [-1 * currentTransform[0][0], currentTransform[0][1], currentTransform[0][2]],
                [currentTransform[1][0], currentTransform[1][1], currentTransform[1][2]]
            ];
        }
    }
    figma.notify('Items flipped horizontally');
}
