// ================================
// Layout Grid Functions
// ================================

const DEFAULT_GUTTER = 20;
const DEFAULT_OFFSET = 0;

type GridCapableNode = SceneNode & { layoutGrids: ReadonlyArray<LayoutGrid> };

function isGridCapable(node: SceneNode): node is GridCapableNode {
  return 'layoutGrids' in node;
}

function applyToSelection(action: (node: GridCapableNode) => void) {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }

  let touched = 0;
  for (const node of selection) {
    if (!isGridCapable(node)) continue;
    action(node);
    touched++;
  }
  return touched;
}

export function setColumnsGrid(count: string) {
  const n = Number(count);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error('Column count must be a positive number');
  }

  const columns: RowsColsLayoutGrid = {
    pattern: 'COLUMNS',
    alignment: 'STRETCH',
    count: n,
    gutterSize: DEFAULT_GUTTER,
    offset: DEFAULT_OFFSET,
    visible: true,
  };

  applyToSelection(node => {
    const others = node.layoutGrids.filter(g => g.pattern !== 'COLUMNS');
    node.layoutGrids = [...others, columns];
  });

  figma.notify(`Columns grid set to ${n}`);
}

export function setRowsGrid(count: string) {
  const n = Number(count);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error('Row count must be a positive number');
  }

  const rows: RowsColsLayoutGrid = {
    pattern: 'ROWS',
    alignment: 'STRETCH',
    count: n,
    gutterSize: DEFAULT_GUTTER,
    offset: DEFAULT_OFFSET,
    visible: true,
  };

  applyToSelection(node => {
    const others = node.layoutGrids.filter(g => g.pattern !== 'ROWS');
    node.layoutGrids = [...others, rows];
  });

  figma.notify(`Rows grid set to ${n}`);
}

export function setUniformGrid(size: string) {
  const s = Number(size);
  if (!Number.isFinite(s) || s <= 0) {
    throw new Error('Grid size must be a positive number');
  }

  const grid: GridLayoutGrid = {
    pattern: 'GRID',
    sectionSize: s,
    visible: true,
  };

  applyToSelection(node => {
    const others = node.layoutGrids.filter(g => g.pattern !== 'GRID');
    node.layoutGrids = [...others, grid];
  });

  figma.notify(`Uniform grid set to ${s}px`);
}

export function setGridGutter(size: string) {
  const s = Number(size);
  if (!Number.isFinite(s) || s < 0) {
    throw new Error('Gutter must be a non-negative number');
  }

  let updatedGrids = 0;
  applyToSelection(node => {
    const next = node.layoutGrids.map(g => {
      if (g.pattern === 'COLUMNS' || g.pattern === 'ROWS') {
        updatedGrids++;
        return { ...g, gutterSize: s };
      }
      return g;
    });
    node.layoutGrids = next;
  });

  if (updatedGrids === 0) {
    figma.notify('No row/column grids on selection');
  } else {
    figma.notify(`Gutter set to ${s}px`);
  }
}

export function setGridMargin(size: string) {
  const s = Number(size);
  if (!Number.isFinite(s) || s < 0) {
    throw new Error('Margin must be a non-negative number');
  }

  let updatedGrids = 0;
  applyToSelection(node => {
    const next = node.layoutGrids.map(g => {
      if (g.pattern === 'COLUMNS' || g.pattern === 'ROWS') {
        updatedGrids++;
        return { ...g, offset: s };
      }
      return g;
    });
    node.layoutGrids = next;
  });

  if (updatedGrids === 0) {
    figma.notify('No row/column grids on selection');
  } else {
    figma.notify(`Margin set to ${s}px`);
  }
}

export function removeGrids() {
  applyToSelection(node => {
    node.layoutGrids = [];
  });
  figma.notify('Grids removed');
}

export function toggleGridVisibility() {
  let togglable = 0;
  applyToSelection(node => {
    if (node.layoutGrids.length === 0) return;
    const anyVisible = node.layoutGrids.some(g => g.visible !== false);
    node.layoutGrids = node.layoutGrids.map(g => ({ ...g, visible: !anyVisible }));
    togglable++;
  });

  if (togglable === 0) {
    figma.notify('No grids on selection');
  } else {
    figma.notify('Toggled grid visibility');
  }
}
