// ================================
// Layer Management
// ================================

/**
 * Toggles the locked status of selected nodes.
 */
export function toggleLock() {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) return;

    // If mixed, lock all. If all locked, unlock all. If all unlocked, lock all.
    const allLocked = selection.every(node => node.locked);

    for (const node of selection) {
        node.locked = !allLocked;
    }

    figma.notify(allLocked ? 'Unlocked selection' : 'Locked selection');
}

/**
 * Toggles the mask status of selected nodes.
 */
export function toggleMask() {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) return;

    const node = selection[0];
    if ('isMask' in node) {
        const newState = !node.isMask;
        // Apply to all selected nodes that support masks
        for (const n of selection) {
            if ('isMask' in n) {
                n.isMask = newState;
            }
        }
        figma.notify(newState ? 'Used as mask' : 'Removed mask');
    } else {
        figma.notify('Selection cannot be used as mask');
    }
}

/**
 * Flattens the current selection.
 */
export function flattenSelection() {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) return;

    try {
        figma.flatten(selection);
        figma.notify('Selection flattened');
    } catch (error) {
        console.error('Error flattening selection:', error);
        figma.notify('Failed to flatten selection');
    }
}

/**
 * Outlines the stroke of selected nodes.
 */
export function outlineStroke() {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) return;

    let count = 0;
    for (const node of selection) {
        if ('outlineStroke' in node && typeof node.outlineStroke === 'function') {
            try {
                node.outlineStroke();
                count++;
            } catch (error) {
                console.error(`Failed to outline stroke for node ${node.name}:`, error);
            }
        }
    }

    if (count > 0) {
        figma.notify(`Outlined stroke for ${count} node(s)`);
    } else {
        figma.notify('No nodes supported outline stroke');
    }
}
