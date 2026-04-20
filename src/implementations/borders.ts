// ================================
// Border Functions
// ================================

import { clearNodeBoundVariables, resolveNumberValue, resolveNumberVariable, resolvePaintValue, setNodeBoundVariable } from '../utils';
import { DEFAULT_BORDER_WIDTH } from '../constants';

type IndividualSide = 'left' | 'right' | 'top' | 'bottom';
type Side = 'all' | IndividualSide;

type StrokeNode = SceneNode & {
  strokes: ReadonlyArray<Paint>;
  strokeWeight: number | PluginAPI['mixed'];
  strokeTopWeight: number;
  strokeBottomWeight: number;
  strokeLeftWeight: number;
  strokeRightWeight: number;
  strokeAlign: 'CENTER' | 'INSIDE' | 'OUTSIDE';
};

function isStrokeNode(node: SceneNode): node is StrokeNode {
  return (
    'strokes' in node &&
    'strokeWeight' in node &&
    'strokeLeftWeight' in node &&
    'strokeRightWeight' in node &&
    'strokeTopWeight' in node &&
    'strokeBottomWeight' in node
  );
}

function getSideWeight(node: StrokeNode, side: IndividualSide): number {
  switch (side) {
    case 'left': return node.strokeLeftWeight;
    case 'right': return node.strokeRightWeight;
    case 'top': return node.strokeTopWeight;
    case 'bottom': return node.strokeBottomWeight;
  }
}

function setSideWeight(node: StrokeNode, side: IndividualSide, value: number): void {
  switch (side) {
    case 'left': node.strokeLeftWeight = value; break;
    case 'right': node.strokeRightWeight = value; break;
    case 'top': node.strokeTopWeight = value; break;
    case 'bottom': node.strokeBottomWeight = value; break;
  }
}

function sideBoundField(side: IndividualSide): 'strokeLeftWeight' | 'strokeRightWeight' | 'strokeTopWeight' | 'strokeBottomWeight' {
  return `stroke${side.charAt(0).toUpperCase() + side.slice(1)}Weight` as
    'strokeLeftWeight' | 'strokeRightWeight' | 'strokeTopWeight' | 'strokeBottomWeight';
}

function ensureStrokePaint(node: StrokeNode): void {
  if (node.strokes.length === 0) {
    node.strokes = [{
      type: 'SOLID',
      color: { r: 0, g: 0, b: 0 },
      opacity: 1,
    }];
  }
}

// Figma exposes per-side weights only under INSIDE alignment. When flipping
// from CENTER/OUTSIDE, seed each side with the previous uniform weight so the
// visible border doesn't get wiped the first time we touch one side.
function prepareIndividualSides(node: StrokeNode): void {
  ensureStrokePaint(node);
  if (node.strokeAlign !== 'INSIDE') {
    const uniform = typeof node.strokeWeight === 'number' ? node.strokeWeight : 0;
    node.strokeAlign = 'INSIDE';
    if (uniform > 0) {
      node.strokeTopWeight = uniform;
      node.strokeBottomWeight = uniform;
      node.strokeLeftWeight = uniform;
      node.strokeRightWeight = uniform;
    }
  }
}

function anySideHasBorder(node: StrokeNode): boolean {
  return (
    node.strokeTopWeight > 0 ||
    node.strokeBottomWeight > 0 ||
    node.strokeLeftWeight > 0 ||
    node.strokeRightWeight > 0
  );
}

function firstNonZeroSideWeight(node: StrokeNode): number {
  return (
    node.strokeTopWeight ||
    node.strokeBottomWeight ||
    node.strokeLeftWeight ||
    node.strokeRightWeight
  );
}

// True when the node renders any visible border right now. Checks both uniform
// (strokeAlign !== 'INSIDE') and per-side state — a uniform stroke can still be
// visible even when all `strokeSideWeight` properties read as 0.
function hasVisibleBorder(node: StrokeNode): boolean {
  if (node.strokes.length === 0) return false;
  if (node.strokeAlign === 'INSIDE') {
    return anySideHasBorder(node);
  }
  return typeof node.strokeWeight === 'number' && node.strokeWeight > 0;
}

function sideHasBorder(node: StrokeNode, side: IndividualSide): boolean {
  if (node.strokes.length === 0) return false;
  if (node.strokeAlign === 'INSIDE') {
    return getSideWeight(node, side) > 0;
  }
  return typeof node.strokeWeight === 'number' && node.strokeWeight > 0;
}

function zeroAllSides(node: StrokeNode): void {
  node.strokeTopWeight = 0;
  node.strokeBottomWeight = 0;
  node.strokeLeftWeight = 0;
  node.strokeRightWeight = 0;
}

export async function setBorder(side: Side, width: string) {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }

  const resolution = await resolveNumberValue(width);

  for (const node of selection) {
    if (!isStrokeNode(node)) continue;

    if (side === 'all') {
      ensureStrokePaint(node);
      if (resolution.type === 'variable') {
        const variable = await resolveNumberVariable(resolution);
        clearNodeBoundVariables(node, 'strokeTopWeight', 'strokeRightWeight', 'strokeBottomWeight', 'strokeLeftWeight');
        setNodeBoundVariable(node, 'strokeWeight', variable);
      } else {
        clearNodeBoundVariables(node, 'strokeWeight', 'strokeTopWeight', 'strokeRightWeight', 'strokeBottomWeight', 'strokeLeftWeight');
        node.strokeWeight = resolution.value!;
      }
      continue;
    }

    // Seed per-side state before first write, otherwise a fresh node with no
    // strokes would either read default non-zero weights (bleeding into other
    // sides) or need a separate "first time" branch.
    const wasInvisible = !hasVisibleBorder(node);
    prepareIndividualSides(node);
    if (wasInvisible) {
      zeroAllSides(node);
    }

    if (resolution.type === 'variable') {
      const variable = await resolveNumberVariable(resolution);
      clearNodeBoundVariables(node, 'strokeWeight');
      setNodeBoundVariable(node, sideBoundField(side), variable);
    } else {
      clearNodeBoundVariables(node, 'strokeWeight', sideBoundField(side));
      setSideWeight(node, side, resolution.value!);
    }
  }

  if (resolution.type === 'variable') {
    figma.notify(`${side.charAt(0).toUpperCase() + side.slice(1)} stroke bound to ${resolution.variableName}`);
  } else {
    figma.notify(`${side.charAt(0).toUpperCase() + side.slice(1)} stroke set to ${resolution.value}px`);
  }
}

export function toggleBorder(side: Side) {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }

  for (const node of selection) {
    if (!isStrokeNode(node)) continue;

    if (side === 'all') {
      clearNodeBoundVariables(node, 'strokeWeight', 'strokeTopWeight', 'strokeRightWeight', 'strokeBottomWeight', 'strokeLeftWeight');
      if (hasVisibleBorder(node)) {
        node.strokes = [];
      } else {
        ensureStrokePaint(node);
        node.strokeWeight = DEFAULT_BORDER_WIDTH;
      }
      continue;
    }

    // Capture visibility BEFORE mutating strokeAlign — flipping to INSIDE can
    // reseed per-side weights, making the pre-change intent unreadable.
    const hadBorderAnywhere = hasVisibleBorder(node);
    const hadBorderOnSide = sideHasBorder(node, side);

    prepareIndividualSides(node);
    clearNodeBoundVariables(node, 'strokeWeight', sideBoundField(side));

    if (!hadBorderAnywhere) {
      zeroAllSides(node);
      setSideWeight(node, side, DEFAULT_BORDER_WIDTH);
    } else if (hadBorderOnSide) {
      setSideWeight(node, side, 0);
    } else {
      const width = firstNonZeroSideWeight(node) || DEFAULT_BORDER_WIDTH;
      setSideWeight(node, side, width);
    }
  }

  figma.notify(`${side.charAt(0).toUpperCase() + side.slice(1)} border toggled`);
}

export function setBorderAlign(alignment: 'CENTER' | 'INSIDE' | 'OUTSIDE') {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }

  for (const node of selection) {
    if (!('strokeAlign' in node)) {
      continue;
    }
    node.strokeAlign = alignment;
  }

  figma.notify(`Border alignment set to ${alignment.toLowerCase()}`);
}

export async function setBorderColor(value: string) {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) throw new Error('No items selected');

  const resolution = await resolvePaintValue(value);

  for (const node of selection) {
    if (!('strokes' in node)) continue;

    try {
      switch (resolution.type) {
        case 'style': {
          if (!resolution.styleKey) break;

          const localStyles = await figma.getLocalPaintStylesAsync();
          let style: PaintStyle | undefined = localStyles.find(s => s.key === resolution.styleKey);

          if (!style) {
            const importedStyle = await figma.importStyleByKeyAsync(resolution.styleKey);
            if (importedStyle.type === 'PAINT') {
              style = importedStyle as PaintStyle;
            }
          }

          if (style) {
            await node.setStrokeStyleIdAsync(style.id);
          }
          break;
        }

        case 'variable': {
          let variableId = resolution.variableId!;

          if (resolution.isLibraryVariable) {
            const importedVar = await figma.variables.importVariableByKeyAsync(variableId);
            variableId = importedVar.id;
          }

          const variable = await figma.variables.getVariableByIdAsync(variableId);
          if (!variable) throw new Error('Variable not found');

          const currentStrokes = Array.isArray(node.strokes) ? [...node.strokes] : [];
          const basePaint: SolidPaint = currentStrokes[0]?.type === 'SOLID'
            ? currentStrokes[0] as SolidPaint
            : { type: 'SOLID', color: { r: 0, g: 0, b: 0 } };

          const boundPaint = figma.variables.setBoundVariableForPaint(
            basePaint,
            'color',
            variable
          );
          node.strokes = [boundPaint];
          break;
        }

        case 'literal': {
          node.strokes = [{
            type: 'SOLID',
            color: resolution.color!
          }];
          break;
        }
      }
    } catch (error) {
      console.error(`Failed to apply stroke to ${node.name}:`, error);
    }
  }

  figma.notify('Stroke color applied successfully');
}
