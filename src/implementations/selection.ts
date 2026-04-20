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

export function reorderLayer(direction: 'FRONT' | 'BACK' | 'FORWARD' | 'BACKWARD') {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) return;

  for (const node of selection) {
    const parent = node.parent;
    if (!parent) continue;

    const index = parent.children.indexOf(node);
    switch (direction) {
      case 'FRONT':
        parent.insertChild(parent.children.length - 1, node);
        break;
      case 'BACK':
        parent.insertChild(0, node);
        break;
      case 'FORWARD':
        if (index < parent.children.length - 1) {
          parent.insertChild(index + 1, node);
        }
        break;
      case 'BACKWARD':
        if (index > 0) {
          parent.insertChild(index - 1, node);
        }
        break;
    }
  }
}
