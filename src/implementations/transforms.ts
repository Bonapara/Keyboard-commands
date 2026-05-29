// ================================
// Transform Functions
// ================================

import { MIN_SCALE_FACTOR } from '../constants';
import { resolveDelta } from '../utils';

type Axis = 'horizontal' | 'vertical';
type AxisConstraint = 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE';

type PositionableNode = SceneNode & {
  x: number;
  y: number;
  width: number;
  height: number;
  parent: BaseNode | null;
  constraints?: Constraints;
  resize?: (width: number, height: number) => void;
};

type SizedParentNode = BaseNode & {
  width: number;
  height: number;
};

type ReorderableParentNode = BaseNode & ChildrenMixin;
type SwapMode = 'ORDER' | 'POSITION';
type TransformMatrix = [[number, number, number], [number, number, number]];

type AxisSlot =
  | { mode: 'MIN'; start: number }
  | { mode: 'MAX'; end: number }
  | { mode: 'CENTER'; centerOffset: number }
  | { mode: 'STRETCH'; start: number; end: number }
  | { mode: 'SCALE'; startRatio: number; sizeRatio: number };

function isPositionableNode(node: SceneNode): node is PositionableNode {
  return 'x' in node && 'y' in node && 'width' in node && 'height' in node;
}

function hasSizedParent(parent: BaseNode | null): parent is SizedParentNode {
  return !!parent && 'width' in parent && 'height' in parent;
}

function hasChildren(parent: BaseNode | null): parent is ReorderableParentNode {
  return !!parent && 'children' in parent && 'insertChild' in parent;
}

function isAutoLayoutParent(parent: BaseNode | null): parent is BaseNode & LayoutMixin {
  return !!parent && 'layoutMode' in parent && parent.layoutMode !== 'NONE';
}

function getLayoutPositioning(node: SceneNode): 'AUTO' | 'ABSOLUTE' {
  if ('layoutPositioning' in node && node.layoutPositioning === 'ABSOLUTE') {
    return 'ABSOLUTE';
  }

  return 'AUTO';
}

function getSwapMode(node: SceneNode): SwapMode {
  if (isAutoLayoutParent(node.parent) && getLayoutPositioning(node) === 'AUTO') {
    return 'ORDER';
  }

  return 'POSITION';
}

function getAxisStart(node: PositionableNode, axis: Axis): number {
  return axis === 'horizontal' ? node.x : node.y;
}

function setAxisStart(node: PositionableNode, axis: Axis, value: number): void {
  if (axis === 'horizontal') {
    node.x = value;
  } else {
    node.y = value;
  }
}

function getAxisSize(node: PositionableNode, axis: Axis): number {
  return axis === 'horizontal' ? node.width : node.height;
}

function getParentAxisSize(parent: SizedParentNode, axis: Axis): number {
  return axis === 'horizontal' ? parent.width : parent.height;
}

function getAxisConstraint(node: PositionableNode, axis: Axis): AxisConstraint {
  if (!node.constraints) return 'MIN';
  return axis === 'horizontal' ? node.constraints.horizontal : node.constraints.vertical;
}

function setAxisConstraint(node: PositionableNode, axis: Axis, mode: AxisConstraint): void {
  if (!node.constraints) return;

  node.constraints = axis === 'horizontal'
    ? { ...node.constraints, horizontal: mode }
    : { ...node.constraints, vertical: mode };
}

function resizeOnAxis(node: PositionableNode, axis: Axis, nextSize: number): void {
  if (!node.resize) {
    throw new Error('Selected items must support resizing to swap stretch/scale constraints');
  }

  const size = Math.max(MIN_SCALE_FACTOR, nextSize);
  node.resize(
    axis === 'horizontal' ? size : node.width,
    axis === 'vertical' ? size : node.height
  );
}

function captureAxisSlot(node: PositionableNode, parent: SizedParentNode, axis: Axis): AxisSlot {
  const start = getAxisStart(node, axis);
  const size = getAxisSize(node, axis);
  const parentSize = getParentAxisSize(parent, axis);
  const end = parentSize - start - size;
  const mode = getAxisConstraint(node, axis);

  switch (mode) {
    case 'MAX':
      return { mode, end };
    case 'CENTER':
      return {
        mode,
        centerOffset: start - ((parentSize - size) / 2),
      };
    case 'STRETCH':
      return { mode, start, end };
    case 'SCALE':
      return {
        mode,
        startRatio: parentSize === 0 ? 0 : start / parentSize,
        sizeRatio: parentSize === 0 ? 0 : size / parentSize,
      };
    case 'MIN':
    default:
      return { mode: 'MIN', start };
  }
}

function applyAxisSlot(node: PositionableNode, parent: SizedParentNode, axis: Axis, slot: AxisSlot): void {
  const parentSize = getParentAxisSize(parent, axis);

  switch (slot.mode) {
    case 'MIN':
      setAxisStart(node, axis, slot.start);
      break;
    case 'MAX':
      setAxisStart(node, axis, parentSize - getAxisSize(node, axis) - slot.end);
      break;
    case 'CENTER':
      setAxisStart(node, axis, ((parentSize - getAxisSize(node, axis)) / 2) + slot.centerOffset);
      break;
    case 'STRETCH':
      resizeOnAxis(node, axis, parentSize - slot.start - slot.end);
      setAxisStart(node, axis, slot.start);
      break;
    case 'SCALE':
      resizeOnAxis(node, axis, parentSize * slot.sizeRatio);
      setAxisStart(node, axis, parentSize * slot.startRatio);
      break;
  }

  setAxisConstraint(node, axis, slot.mode);
}

function swapAutoLayoutOrder(firstNode: SceneNode, secondNode: SceneNode, parent: ReorderableParentNode): void {
  const firstIndex = parent.children.indexOf(firstNode);
  const secondIndex = parent.children.indexOf(secondNode);

  if (firstIndex === -1 || secondIndex === -1) {
    throw new Error('Selected items must be direct children of the same parent');
  }

  const nextOrder = [...parent.children];
  nextOrder[firstIndex] = secondNode;
  nextOrder[secondIndex] = firstNode;

  // Rebuild the sibling order from the front so non-adjacent swaps remain
  // stable in Figma's insertChild semantics.
  nextOrder.forEach((node, index) => {
    if (parent.children[index] !== node) {
      parent.insertChild(index, node);
    }
  });
}

function swapAbsolutePosition(firstNode: PositionableNode, secondNode: PositionableNode, parent: SizedParentNode): void {
  const firstHorizontal = captureAxisSlot(firstNode, parent, 'horizontal');
  const firstVertical = captureAxisSlot(firstNode, parent, 'vertical');
  const secondHorizontal = captureAxisSlot(secondNode, parent, 'horizontal');
  const secondVertical = captureAxisSlot(secondNode, parent, 'vertical');

  applyAxisSlot(firstNode, parent, 'horizontal', secondHorizontal);
  applyAxisSlot(firstNode, parent, 'vertical', secondVertical);
  applyAxisSlot(secondNode, parent, 'horizontal', firstHorizontal);
  applyAxisSlot(secondNode, parent, 'vertical', firstVertical);
}

function applyTransform(transform: TransformMatrix, point: { x: number; y: number }): { x: number; y: number } {
  return {
    x: transform[0][0] * point.x + transform[0][1] * point.y + transform[0][2],
    y: transform[1][0] * point.x + transform[1][1] * point.y + transform[1][2],
  };
}

function invertTransform(transform: TransformMatrix): TransformMatrix {
  const [[a, b, tx], [c, d, ty]] = transform;
  const determinant = a * d - b * c;

  if (Math.abs(determinant) < Number.EPSILON) {
    throw new Error('Cannot swap positions with a non-invertible parent transform');
  }

  const inverseA = d / determinant;
  const inverseB = -b / determinant;
  const inverseC = -c / determinant;
  const inverseD = a / determinant;

  return [
    [inverseA, inverseB, -(inverseA * tx + inverseB * ty)],
    [inverseC, inverseD, -(inverseC * tx + inverseD * ty)],
  ];
}

function getAbsoluteTransform(node: BaseNode | null): TransformMatrix | null {
  if (!node) return null;

  if ('absoluteTransform' in node) {
    return node.absoluteTransform as TransformMatrix;
  }

  let x = 0;
  let y = 0;
  let current: BaseNode | null = node;

  while (current) {
    if ('x' in current) x += current.x;
    if ('y' in current) y += current.y;
    current = current.parent;
  }

  return [
    [1, 0, x],
    [0, 1, y],
  ];
}

function getAbsolutePosition(node: PositionableNode): { x: number; y: number } {
  const transform = getAbsoluteTransform(node);
  if (transform) {
    return {
      x: transform[0][2],
      y: transform[1][2],
    };
  }

  let x = node.x;
  let y = node.y;
  let current = node.parent;

  while (current) {
    if ('x' in current) x += current.x;
    if ('y' in current) y += current.y;
    current = current.parent;
  }

  return { x, y };
}

function setAbsolutePosition(node: PositionableNode, position: { x: number; y: number }): void {
  const parentTransform = getAbsoluteTransform(node.parent);
  if (parentTransform) {
    const localPoint = applyTransform(invertTransform(parentTransform), position);
    node.x = localPoint.x;
    node.y = localPoint.y;
    return;
  }

  node.x = position.x;
  node.y = position.y;
}

function swapAbsolutePositionAcrossParents(firstNode: PositionableNode, secondNode: PositionableNode): void {
  const firstPosition = getAbsolutePosition(firstNode);
  const secondPosition = getAbsolutePosition(secondNode);

  setAbsolutePosition(firstNode, secondPosition);
  setAbsolutePosition(secondNode, firstPosition);
}

export function rotate(value: number | string) {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    throw new Error('No items selected');
  }

  for (const node of selection) {
    if (!('rotation' in node)) continue;

    // Resolve per-node so deltas like "+15" / "-90" rotate relative to current.
    const target = typeof value === 'number'
      ? value
      : resolveDelta(value, node.rotation);

    if (Number.isNaN(target)) {
      throw new Error('No value provided');
    }

    // Anchor the rotation at the node's *current* visual center, matching
    // Figma's native rotation behavior. The previous implementation stored an
    // "original" position in pluginData and rotated around that — which drifted
    // whenever the user moved the node between rotations and accumulated stale
    // pluginData in the file. Clean any of that legacy data while we're here.
    if (node.getPluginData('originalX')) node.setPluginData('originalX', '');
    if (node.getPluginData('originalY')) node.setPluginData('originalY', '');

    const t = node.relativeTransform;
    const w = node.width;
    const h = node.height;
    const centerX = t[0][2] + (t[0][0] * w + t[0][1] * h) / 2;
    const centerY = t[1][2] + (t[1][0] * w + t[1][1] * h) / 2;

    const theta = (target * Math.PI) / 180;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);

    const newX = centerX - (cos * w + sin * h) / 2;
    const newY = centerY - (-sin * w + cos * h) / 2;

    node.relativeTransform = [
      [cos, sin, newX],
      [-sin, cos, newY],
    ];
  }

  figma.notify(`Rotated ${value}°`);
}

export function flip(direction: 'horizontal' | 'vertical') {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) return;
  
  for (const node of selection) {
    if ("relativeTransform" in node) {
      const transform = node.relativeTransform;
      if (direction === "horizontal" && "width" in node) {
        const cx = node.x;
        node.relativeTransform = [
          [-transform[0][0], -transform[0][1], transform[0][2]],
          [ transform[1][0],  transform[1][1], transform[1][2]]
        ];
        if (node.relativeTransform[0][0] < 0) node.x = cx + node.width;
        else node.x = cx - node.width;
      } else if (direction === "vertical" && "height" in node) {
        const cy = node.y;
        node.relativeTransform = [
          [transform[0][0],  transform[0][1], transform[0][2]],
          [-transform[1][0], -transform[1][1], transform[1][2]]
        ];
        if (node.relativeTransform[1][1] < 0) node.y = cy + node.height;
        else node.y = cy - node.height;
      }
    }
  }
}

export function move(direction: 'TOP' | 'RIGHT' | 'LEFT' | 'BOTTOM', value: string) {
  if (value === undefined) throw new Error('No value provided');
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) throw new Error('No items selected');
  
  const numValue = Number(value);
  
  for (const node of selection) {
    if ((direction === 'LEFT' || direction === 'RIGHT') && 'x' in node) {
      node.x += direction === 'RIGHT' ? numValue : -numValue;
    } else if ((direction === 'TOP' || direction === 'BOTTOM') && 'y' in node) {
      node.y += direction === 'BOTTOM' ? numValue : -numValue;
    }
  }
  
  const dirValue = (direction === 'LEFT' || direction === 'TOP') ? -numValue : numValue;
  figma.notify(`Moved items ${direction.toLowerCase()} by ${Math.abs(dirValue)} pixels`);
}

// Main positioning function that handles all sides
export function position(value: string, side: 'left' | 'right' | 'top' | 'bottom') {
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  for (const node of selection) {
    if ('x' in node && node.parent) {
      // Check if parent has width/height properties
      if (!('width' in node.parent) || !('height' in node.parent)) {
        throw new Error('Parent node must be a frame, component, or other container with dimensions');
      }
      
      const numValue = Number(value);
      
      switch (side) {
        case 'left':
        node.x = numValue;
        break;
        
        case 'right':
        // Position from right = parent width - node width - desired distance from right
        node.x = (node.parent as FrameNode).width - node.width - numValue;
        break;
        
        case 'top':
        node.y = numValue;
        break;
        
        case 'bottom':
        // Position from bottom = parent height - node height - desired distance from bottom
        node.y = (node.parent as FrameNode).height - node.height - numValue;
        break;
      }
    }
  }
  
  figma.notify(`Position set ${value}px from ${side} for all selected items`);
}

export function swapPosition() {
  const selection = figma.currentPage.selection;

  if (selection.length !== 2) {
    throw new Error('Select exactly 2 items');
  }

  const [firstNode, secondNode] = selection;

  if (!isPositionableNode(firstNode) || !isPositionableNode(secondNode)) {
    throw new Error('Selected items must support positioning');
  }

  if (!firstNode.parent || !secondNode.parent) {
    throw new Error('Selected items must have a parent');
  }

  const firstMode = getSwapMode(firstNode);
  const secondMode = getSwapMode(secondNode);

  if (firstMode !== secondMode) {
    throw new Error('Selected items must use compatible positioning modes');
  }

  const sameParent = firstNode.parent === secondNode.parent;

  if (firstMode === 'ORDER') {
    if (!isAutoLayoutParent(firstNode.parent) || !isAutoLayoutParent(secondNode.parent)) {
      throw new Error('Selected items must be in auto-layout parents');
    }
    if (!hasChildren(firstNode.parent) || !hasChildren(secondNode.parent)) {
      throw new Error('Selected items must be direct children of reorderable parents');
    }

    if (sameParent) {
      swapAutoLayoutOrder(firstNode, secondNode, firstNode.parent);
    } else {
      throw new Error('Flow auto-layout items can only be swapped within the same parent');
    }

    figma.notify('Swapped positions for 2 selected items');
    return;
  }

  const firstParent = firstNode.parent;

  if (sameParent && hasSizedParent(firstParent)) {
    swapAbsolutePosition(firstNode, secondNode, firstParent);
    figma.notify('Swapped positions for 2 selected items');
    return;
  }

  swapAbsolutePositionAcrossParents(firstNode, secondNode);

  figma.notify('Swapped positions for 2 selected items');
}
