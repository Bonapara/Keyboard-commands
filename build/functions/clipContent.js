export function clipContent() {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
        throw new Error('No items selected');
    }
    for (const node of selection) {
        switch (node.type) {
            case 'COMPONENT':
            case 'COMPONENT_SET':
            case 'FRAME':
            case 'INSTANCE':
                if ('clipsContent' in node) {
                    node.clipsContent = !node.clipsContent;
                }
                break;
        }
    }
    figma.notify('Clips content toggled');
}
