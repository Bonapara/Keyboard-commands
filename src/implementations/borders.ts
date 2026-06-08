// ================================
// Border Functions
// ================================

import { clearNodeBoundVariables, resolveNumberValue, resolveNumberVariable, resolvePaintValue, setNodeBoundVariable } from '../utils';
import { DEFAULT_BORDER_WIDTH } from '../constants';

type IndividualSide = 'left' | 'right' | 'top' | 'bottom';
type Side = 'all' | IndividualSide;
type SideWeights = Record<IndividualSide, number>;
type SideBoundField = 'strokeLeftWeight' | 'strokeRightWeight' | 'strokeTopWeight' | 'strokeBottomWeight';
type StrokeBoundField = 'strokeWeight' | SideBoundField;
const INDIVIDUAL_SIDES = ['top', 'right', 'bottom', 'left'] as const;

type StrokeNode = SceneNode & {
  strokes: ReadonlyArray<Paint>;
  strokeWeight: number | PluginAPI['mixed'];
  strokeTopWeight: number;
  strokeBottomWeight: number;
  strokeLeftWeight: number;
  strokeRightWeight: number;
  strokeAlign: 'CENTER' | 'INSIDE' | 'OUTSIDE';
};

type BoundVariableStore =
  | Partial<Record<StrokeBoundField, VariableAlias | VariableAlias[] | undefined>>
  | Map<string, VariableAlias | Variable | undefined>;

type VariableBoundStrokeNode = StrokeNode & {
  readonly boundVariables?: BoundVariableStore;
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

function getSideWeights(node: StrokeNode): SideWeights {
  return {
    left: node.strokeLeftWeight,
    right: node.strokeRightWeight,
    top: node.strokeTopWeight,
    bottom: node.strokeBottomWeight,
  };
}

function zeroSideWeights(): SideWeights {
  return { left: 0, right: 0, top: 0, bottom: 0 };
}

function uniformSideWeights(width: number): SideWeights {
  return { left: width, right: width, top: width, bottom: width };
}

function applySideWeights(node: StrokeNode, changedSide: IndividualSide, weights: SideWeights): void {
  setSideWeight(node, changedSide, weights[changedSide]);

  for (const side of INDIVIDUAL_SIDES) {
    if (side !== changedSide) {
      setSideWeight(node, side, weights[side]);
    }
  }
}

function sideBoundField(side: IndividualSide): SideBoundField {
  return `stroke${side.charAt(0).toUpperCase() + side.slice(1)}Weight` as SideBoundField;
}

function getBoundVariableAlias(node: StrokeNode, field: StrokeBoundField): VariableAlias | null {
  const bindings = (node as VariableBoundStrokeNode).boundVariables;
  if (!bindings) return null;

  const binding = bindings instanceof Map ? bindings.get(field) : bindings[field];
  if (!binding || Array.isArray(binding)) return null;

  return 'id' in binding ? { type: 'VARIABLE_ALIAS', id: binding.id } : null;
}

async function restoreBoundVariable(node: StrokeNode, field: StrokeBoundField, alias: VariableAlias | null) {
  if (!alias) return;

  const variable = await figma.variables.getVariableByIdAsync(alias.id);
  if (variable) {
    setNodeBoundVariable(node, field, variable);
  }
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

// Before touching one side, seed side weights from a visible uniform stroke so
// the untouched sides don't get wiped when the node switches to individual-side
// weights. Stroke alignment is intentionally preserved.
function prepareIndividualSides(node: StrokeNode): void {
  ensureStrokePaint(node);
  const hasSideWeights = anySideHasBorder(node);
  const uniform = typeof node.strokeWeight === 'number' ? node.strokeWeight : 0;
  const shouldSeedUniform = uniform > 0 && (node.strokeAlign !== 'INSIDE' || !hasSideWeights);

  if (shouldSeedUniform) {
    node.strokeTopWeight = uniform;
    node.strokeBottomWeight = uniform;
    node.strokeLeftWeight = uniform;
    node.strokeRightWeight = uniform;
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
    return anySideHasBorder(node) ||
      (typeof node.strokeWeight === 'number' && node.strokeWeight > 0);
  }
  return typeof node.strokeWeight === 'number' && node.strokeWeight > 0;
}

function sideHasBorder(node: StrokeNode, side: IndividualSide): boolean {
  if (node.strokes.length === 0) return false;
  if (node.strokeAlign === 'INSIDE') {
    return getSideWeight(node, side) > 0 ||
      (!anySideHasBorder(node) && typeof node.strokeWeight === 'number' && node.strokeWeight > 0);
  }
  return typeof node.strokeWeight === 'number' && node.strokeWeight > 0;
}

function zeroAllSides(node: StrokeNode): void {
  node.strokeTopWeight = 0;
  node.strokeBottomWeight = 0;
  node.strokeLeftWeight = 0;
  node.strokeRightWeight = 0;
}

function sidesExcept(excludedSide: IndividualSide): IndividualSide[] {
  return INDIVIDUAL_SIDES.filter(side => side !== excludedSide);
}

function setSideWeightsForSides(weights: SideWeights, sides: IndividualSide[], width: number): void {
  for (const side of sides) {
    weights[side] = width;
  }
}

function applySideWeightsForSides(
  node: StrokeNode,
  sides: IndividualSide[],
  weights: SideWeights,
  preservedSide: IndividualSide
): void {
  const preservedWeight = weights[preservedSide];

  for (const side of sides) {
    setSideWeight(node, side, weights[side]);
  }

  // Figma can collapse per-side weights into a uniform stroke after the first
  // write. Restore the excluded side only if that side was touched implicitly.
  if (getSideWeight(node, preservedSide) !== preservedWeight) {
    setSideWeight(node, preservedSide, preservedWeight);
  }
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
    const originalStrokeAlign = node.strokeAlign;
    const wasInvisible = !hasVisibleBorder(node);
    prepareIndividualSides(node);
    if (wasInvisible) {
      zeroAllSides(node);
    }

    const desiredSideWeights = getSideWeights(node);
    desiredSideWeights[side] = resolution.type === 'variable'
      ? desiredSideWeights[side]
      : resolution.value!;

    if (resolution.type === 'variable') {
      const variable = await resolveNumberVariable(resolution);
      clearNodeBoundVariables(node, 'strokeWeight');
      setNodeBoundVariable(node, sideBoundField(side), variable);
    } else {
      clearNodeBoundVariables(node, 'strokeWeight', sideBoundField(side));
      applySideWeights(node, side, desiredSideWeights);
    }
    node.strokeAlign = originalStrokeAlign;
  }

  if (resolution.type === 'variable') {
    figma.notify(`${side.charAt(0).toUpperCase() + side.slice(1)} stroke bound to ${resolution.variableName}`);
  } else {
    figma.notify(`${side.charAt(0).toUpperCase() + side.slice(1)} stroke set to ${resolution.value}px`);
  }
}

export async function setBorderExcept(excludedSide: IndividualSide, width: string) {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }

  const resolution = await resolveNumberValue(width);
  if (resolution.type === 'variable') {
    throw new Error('Variables are not supported for border-except commands');
  }

  for (const node of selection) {
    if (!isStrokeNode(node)) continue;

    const originalStrokeAlign = node.strokeAlign;
    const wasInvisible = !hasVisibleBorder(node);
    const excludedField = sideBoundField(excludedSide);
    const preservedBinding =
      getBoundVariableAlias(node, excludedField) ??
      getBoundVariableAlias(node, 'strokeWeight');
    const includedSides = sidesExcept(excludedSide);

    prepareIndividualSides(node);
    if (wasInvisible) {
      zeroAllSides(node);
    }

    const desiredSideWeights = getSideWeights(node);
    setSideWeightsForSides(desiredSideWeights, includedSides, resolution.value!);
    clearNodeBoundVariables(
      node,
      'strokeWeight',
      ...includedSides.map(sideBoundField)
    );
    applySideWeightsForSides(node, includedSides, desiredSideWeights, excludedSide);
    await restoreBoundVariable(node, excludedField, preservedBinding);
    node.strokeAlign = originalStrokeAlign;
  }

  figma.notify(`All except ${excludedSide} stroke set to ${resolution.value}px`);
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
      if (node.strokes.length > 0) {
        node.strokes = [];
        node.strokeWeight = 0;
        zeroAllSides(node);
      } else {
        ensureStrokePaint(node);
        node.strokeWeight = DEFAULT_BORDER_WIDTH;
        if (node.strokeAlign === 'INSIDE') {
          applySideWeights(node, 'top', uniformSideWeights(DEFAULT_BORDER_WIDTH));
        }
      }
      continue;
    }

    // Capture visibility before seeding side weights, which can make the
    // pre-change intent unreadable for uniform strokes.
    const hadBorderAnywhere = hasVisibleBorder(node);
    const hadBorderOnSide = sideHasBorder(node, side);
    const originalStrokeAlign = node.strokeAlign;

    prepareIndividualSides(node);
    const desiredSideWeights = hadBorderAnywhere ? getSideWeights(node) : zeroSideWeights();
    clearNodeBoundVariables(node, 'strokeWeight', sideBoundField(side));

    if (!hadBorderAnywhere) {
      desiredSideWeights[side] = DEFAULT_BORDER_WIDTH;
    } else if (hadBorderOnSide) {
      desiredSideWeights[side] = 0;
    } else {
      const width = firstNonZeroSideWeight(node) || DEFAULT_BORDER_WIDTH;
      desiredSideWeights[side] = width;
    }
    applySideWeights(node, side, desiredSideWeights);
    node.strokeAlign = originalStrokeAlign;
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
