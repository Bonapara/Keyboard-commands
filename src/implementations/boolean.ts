// ================================
// Boolean Operations
// ================================

/**
 * Performs a boolean operation on the current selection.
 * @param operation The type of boolean operation to perform.
 */
export function performBooleanOperation(operation: 'UNION' | 'SUBTRACT' | 'INTERSECT' | 'EXCLUDE') {
    const selection = figma.currentPage.selection;

    if (selection.length < 2) {
        figma.notify('Select at least 2 layers for boolean operations');
        return;
    }

    try {
        switch (operation) {
            case 'UNION':
                figma.union(selection, figma.currentPage);
                break;
            case 'SUBTRACT':
                figma.subtract(selection, figma.currentPage);
                break;
            case 'INTERSECT':
                figma.intersect(selection, figma.currentPage);
                break;
            case 'EXCLUDE':
                figma.exclude(selection, figma.currentPage);
                break;
        }
        figma.notify(`Boolean ${operation} created`);
    } catch (error) {
        console.error(`Error performing boolean ${operation}:`, error);
        figma.notify(`Failed to create boolean ${operation}`);
    }
}
