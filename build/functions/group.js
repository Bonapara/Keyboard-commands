export function group() {
    const selection = figma.currentPage.selection;
    if (selection.length < 2) {
        throw new Error('Select at least 2 items to group');
    }
    const groupNode = figma.group(selection, figma.currentPage);
    figma.currentPage.selection = [groupNode];
    figma.notify('Items grouped');
}
