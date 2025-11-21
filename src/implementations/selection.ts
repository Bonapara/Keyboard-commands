

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

export function deleteSelection() {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) return;

  for (const node of selection) {
    node.remove();
  }
  figma.notify('Deleted selection');
}

export function duplicate() {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) return;

  const newSelection: SceneNode[] = [];
  for (const node of selection) {
    const clone = node.clone();
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
