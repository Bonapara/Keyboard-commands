function dedupeSceneNodes(nodes: SceneNode[]): SceneNode[] {
  const seen = new Set<string>();
  const unique: SceneNode[] = [];

  for (const node of nodes) {
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    unique.push(node);
  }

  return unique;
}

function getHierarchySignature(node: SceneNode, rootNode: SceneNode): string[] {
  const signature: string[] = [];
  let current: BaseNode | null = node;

  while (current && current.id !== rootNode.id) {
    signature.unshift(`${current.name}|${current.type}`);
    current = current.parent;
  }

  return signature;
}

function findNodesBySignature(rootNode: SceneNode, signature: string[]): SceneNode[] {
  const results: SceneNode[] = [];

  function traverse(node: SceneNode, depth: number) {
    const signaturePart = signature[depth];
    if (!signaturePart) return;

    const [expectedName, expectedType] = signaturePart.split('|');

    if (node.name === expectedName && node.type === expectedType) {
      if (depth === signature.length - 1) {
        results.push(node);
        return;
      }

      if ('children' in node) {
        for (const child of node.children) {
          traverse(child as SceneNode, depth + 1);
        }
      }
    }
  }

  if ('children' in rootNode) {
    for (const child of rootNode.children) {
      traverse(child as SceneNode, 0);
    }
  }

  return results;
}

export async function selectSimilar() {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('Please select an item first');
  }

  const targetNode = selection[0];

  let rootNode = targetNode.parent;
  while (rootNode && rootNode.type !== 'PAGE') {
    if (rootNode.type === 'FRAME' && rootNode.layoutMode === 'NONE') {
      break;
    }
    rootNode = rootNode.parent;
  }

  if (!rootNode) {
    rootNode = figma.currentPage;
  }

  const signature = getHierarchySignature(targetNode, rootNode as SceneNode);
  const results = findNodesBySignature(rootNode as SceneNode, signature);

  if (results.length > 0) {
    figma.currentPage.selection = results;
    figma.notify(`Selected ${results.length} matching items in ${rootNode.name}`);
  } else {
    figma.notify('No matching items found in the current frame');
  }
}

export function selectParent() {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) return;

  const parents = dedupeSceneNodes(
    selection.flatMap((node) => {
      const parent = node.parent;
      if (!parent || parent.type === 'PAGE' || parent.type === 'DOCUMENT') {
        return [];
      }
      return [parent as SceneNode];
    })
  );

  if (parents.length === 0) {
    figma.notify('Selection is already at the page level');
    return;
  }

  figma.currentPage.selection = parents;
  figma.notify(parents.length === 1 ? 'Selected parent layer' : `Selected ${parents.length} parent layers`);
}

export function selectChildren() {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) return;

  const children = dedupeSceneNodes(
    selection.flatMap((node) => ('children' in node ? Array.from(node.children) as SceneNode[] : []))
  );

  if (children.length === 0) {
    figma.notify('Selection has no children');
    return;
  }

  figma.currentPage.selection = children;
  figma.notify(children.length === 1 ? 'Selected 1 child layer' : `Selected ${children.length} child layers`);
}

export function deleteSelection() {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) return;

  for (const node of selection) {
    node.remove();
  }
  figma.notify('Deleted selection');
}

const DUPLICATE_OFFSET = 10;

export function duplicate() {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) return;

  const newSelection: SceneNode[] = [];
  for (const node of selection) {
    if (node.type === 'SLOT') continue;
    const clone = node.clone();
    if ('x' in clone && 'y' in clone) {
      clone.x += DUPLICATE_OFFSET;
      clone.y += DUPLICATE_OFFSET;
    }
    newSelection.push(clone);
  }
  figma.currentPage.selection = newSelection;
  figma.notify('Duplicated selection');
}

type ReorderDirection = 'FRONT' | 'BACK' | 'FORWARD' | 'BACKWARD';
type ReorderableParentNode = BaseNode & ChildrenMixin;

function isReorderableParent(parent: BaseNode | null): parent is ReorderableParentNode {
  return !!parent && 'children' in parent && 'insertChild' in parent;
}

function usesReverseAutoLayoutZIndex(parent: ReorderableParentNode): boolean {
  return 'layoutMode' in parent &&
    (parent.layoutMode === 'HORIZONTAL' || parent.layoutMode === 'VERTICAL') &&
    'itemReverseZIndex' in parent &&
    parent.itemReverseZIndex === true;
}

function moveChildToIndex(children: readonly SceneNode[], node: SceneNode, targetIndex: number): SceneNode[] {
  const nextOrder = [...children];
  const currentIndex = nextOrder.indexOf(node);
  if (currentIndex === -1) return nextOrder;

  const [movedNode] = nextOrder.splice(currentIndex, 1);
  nextOrder.splice(Math.max(0, Math.min(targetIndex, nextOrder.length)), 0, movedNode);
  return nextOrder;
}

function applyChildrenOrder(parent: ReorderableParentNode, nextOrder: readonly SceneNode[]): void {
  nextOrder.forEach((child, index) => {
    if (parent.children[index] !== child) {
      parent.insertChild(index, child);
    }
  });
}

function getReorderTargetIndex(
  index: number,
  childCount: number,
  direction: ReorderDirection,
  reverseZIndex: boolean
): number {
  const firstIndex = 0;
  const lastIndex = childCount - 1;

  switch (direction) {
    case 'FRONT':
      return reverseZIndex ? firstIndex : lastIndex;
    case 'BACK':
      return reverseZIndex ? lastIndex : firstIndex;
    case 'FORWARD':
      return reverseZIndex ? Math.max(firstIndex, index - 1) : Math.min(lastIndex, index + 1);
    case 'BACKWARD':
      return reverseZIndex ? Math.min(lastIndex, index + 1) : Math.max(firstIndex, index - 1);
  }
}

async function loadParentIfNeeded(parent: ReorderableParentNode): Promise<void> {
  if (parent.type === 'PAGE' && 'loadAsync' in parent) {
    await parent.loadAsync();
  }
}

export async function reorderLayer(direction: ReorderDirection) {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) return;

  for (const node of selection) {
    const parent = node.parent;
    if (!isReorderableParent(parent)) continue;

    await loadParentIfNeeded(parent);

    const children = parent.children;
    const index = children.indexOf(node);
    if (index === -1) continue;

    const reverseZIndex = usesReverseAutoLayoutZIndex(parent);
    const targetIndex = getReorderTargetIndex(
      index,
      children.length,
      direction,
      reverseZIndex
    );
    const nextOrder = moveChildToIndex(children, node, targetIndex);

    if (targetIndex !== index) applyChildrenOrder(parent, nextOrder);
  }
}
