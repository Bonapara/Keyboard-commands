// ================================
// Styling Functions
// ================================

import { resolvePaintValue, resolveStyleValue, resolveDelta } from '../utils';

type StyleTransferField =
  | 'opacity'
  | 'strokeWeight'
  | 'strokeTopWeight'
  | 'strokeRightWeight'
  | 'strokeBottomWeight'
  | 'strokeLeftWeight';

type VariableBindableSceneNode = SceneNode & {
  readonly boundVariables?: Record<string, VariableAlias | VariableAlias[] | undefined>;
  setBoundVariable?: (field: StyleTransferField, variable: Variable | null) => void;
};

type StyleMutableSceneNode = SceneNode & {
  setFillStyleIdAsync?: (styleId: string) => Promise<void>;
  setStrokeStyleIdAsync?: (styleId: string) => Promise<void>;
  setEffectStyleIdAsync?: (styleId: string) => Promise<void>;
  setTextStyleIdAsync?: (styleId: string) => Promise<void>;
  setFillsAsync?: (paints: ReadonlyArray<Paint>) => Promise<void>;
  setStrokesAsync?: (paints: ReadonlyArray<Paint>) => Promise<void>;
};

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

async function loadTextNodeFonts(node: TextNode): Promise<void> {
  if (node.fontName !== figma.mixed) {
    await figma.loadFontAsync(node.fontName);
    return;
  }

  const fonts = node.getRangeAllFontNames(0, node.characters.length);
  const seen = new Set<string>();
  const uniqueFonts = fonts.filter((font) => {
    const key = `${font.family}:${font.style}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  await Promise.all(uniqueFonts.map((font) => figma.loadFontAsync(font)));
}

async function copyNodeVariableBinding(
  source: SceneNode,
  target: SceneNode,
  field: StyleTransferField
): Promise<void> {
  const sourceAlias = (source as VariableBindableSceneNode).boundVariables?.[field];

  if (Array.isArray(sourceAlias)) {
    return;
  }

  let variable: Variable | null = null;
  if (sourceAlias?.id) {
    variable = await figma.variables.getVariableByIdAsync(sourceAlias.id);
  }

  (target as VariableBindableSceneNode).setBoundVariable?.(field, variable);
}

async function setFillStyleId(node: SceneNode, styleId: string): Promise<void> {
  const styleNode = node as StyleMutableSceneNode & { fillStyleId?: string | typeof figma.mixed };
  if (styleNode.setFillStyleIdAsync) {
    await styleNode.setFillStyleIdAsync(styleId);
  } else if ('fillStyleId' in styleNode) {
    styleNode.fillStyleId = styleId;
  }
}

async function setStrokeStyleId(node: SceneNode, styleId: string): Promise<void> {
  const styleNode = node as StyleMutableSceneNode & { strokeStyleId?: string };
  if (styleNode.setStrokeStyleIdAsync) {
    await styleNode.setStrokeStyleIdAsync(styleId);
  } else if ('strokeStyleId' in styleNode) {
    styleNode.strokeStyleId = styleId;
  }
}

async function setEffectStyleId(node: SceneNode, styleId: string): Promise<void> {
  const styleNode = node as StyleMutableSceneNode & { effectStyleId?: string };
  if (styleNode.setEffectStyleIdAsync) {
    await styleNode.setEffectStyleIdAsync(styleId);
  } else if ('effectStyleId' in styleNode) {
    styleNode.effectStyleId = styleId;
  }
}

async function setTextStyleId(node: TextNode, styleId: string): Promise<void> {
  const styleNode = node as TextNode & StyleMutableSceneNode & { textStyleId?: string | typeof figma.mixed };
  if (styleNode.setTextStyleIdAsync) {
    await styleNode.setTextStyleIdAsync(styleId);
  } else if ('textStyleId' in styleNode) {
    styleNode.textStyleId = styleId;
  }
}

async function setFills(node: SceneNode, paints: ReadonlyArray<Paint>): Promise<void> {
  const styleNode = node as StyleMutableSceneNode & { fills?: ReadonlyArray<Paint> | typeof figma.mixed };
  const clonedPaints = cloneValue(paints);
  if (styleNode.setFillsAsync) {
    await styleNode.setFillsAsync(clonedPaints);
  } else if ('fills' in styleNode) {
    styleNode.fills = clonedPaints;
  }
}

async function setStrokes(node: SceneNode, paints: ReadonlyArray<Paint>): Promise<void> {
  const styleNode = node as StyleMutableSceneNode & { strokes?: ReadonlyArray<Paint> };
  const clonedPaints = cloneValue(paints);
  if (styleNode.setStrokesAsync) {
    await styleNode.setStrokesAsync(clonedPaints);
  } else if ('strokes' in styleNode) {
    styleNode.strokes = clonedPaints;
  }
}

async function copyFillStyle(source: SceneNode, target: SceneNode): Promise<void> {
  if (!('fills' in source) || !('fills' in target)) {
    return;
  }

  const sourceFillStyleId = 'fillStyleId' in source ? source.fillStyleId : '';
  if (typeof sourceFillStyleId === 'string' && sourceFillStyleId !== '') {
    await setFillStyleId(target, sourceFillStyleId);
    return;
  }

  await setFillStyleId(target, '');
  if (source.fills !== figma.mixed) {
    await setFills(target, source.fills);
  }
}

function copyUniformStrokeWeights(
  source: SceneNode & {
    strokeWeight: number | typeof figma.mixed;
    strokeTopWeight?: number;
    strokeRightWeight?: number;
    strokeBottomWeight?: number;
    strokeLeftWeight?: number;
  },
  target: SceneNode & {
    strokeWeight: number | typeof figma.mixed;
    strokeTopWeight?: number;
    strokeRightWeight?: number;
    strokeBottomWeight?: number;
    strokeLeftWeight?: number;
  }
) {
  if (source.strokeWeight === figma.mixed) {
    return;
  }

  target.strokeWeight = source.strokeWeight;
  if ('strokeTopWeight' in target) target.strokeTopWeight = source.strokeWeight;
  if ('strokeRightWeight' in target) target.strokeRightWeight = source.strokeWeight;
  if ('strokeBottomWeight' in target) target.strokeBottomWeight = source.strokeWeight;
  if ('strokeLeftWeight' in target) target.strokeLeftWeight = source.strokeWeight;
}

function copyPerSideStrokeWeights(
  source: SceneNode & {
    strokeTopWeight?: number;
    strokeRightWeight?: number;
    strokeBottomWeight?: number;
    strokeLeftWeight?: number;
  },
  target: SceneNode & {
    strokeTopWeight?: number;
    strokeRightWeight?: number;
    strokeBottomWeight?: number;
    strokeLeftWeight?: number;
  }
) {
  if ('strokeTopWeight' in source && 'strokeTopWeight' in target) target.strokeTopWeight = source.strokeTopWeight;
  if ('strokeRightWeight' in source && 'strokeRightWeight' in target) target.strokeRightWeight = source.strokeRightWeight;
  if ('strokeBottomWeight' in source && 'strokeBottomWeight' in target) target.strokeBottomWeight = source.strokeBottomWeight;
  if ('strokeLeftWeight' in source && 'strokeLeftWeight' in target) target.strokeLeftWeight = source.strokeLeftWeight;
}

async function copyStrokeStyle(source: SceneNode, target: SceneNode): Promise<void> {
  if (!('strokes' in source) || !('strokes' in target)) {
    return;
  }

  const sourceStrokeStyleId = 'strokeStyleId' in source ? source.strokeStyleId : '';
  if (typeof sourceStrokeStyleId === 'string' && sourceStrokeStyleId !== '') {
    await setStrokeStyleId(target, sourceStrokeStyleId);
  } else {
    await setStrokeStyleId(target, '');
    await setStrokes(target, source.strokes);
  }

  await copyNodeVariableBinding(source, target, 'strokeWeight');
  await copyNodeVariableBinding(source, target, 'strokeTopWeight');
  await copyNodeVariableBinding(source, target, 'strokeRightWeight');
  await copyNodeVariableBinding(source, target, 'strokeBottomWeight');
  await copyNodeVariableBinding(source, target, 'strokeLeftWeight');

  if ('strokeWeight' in source && 'strokeWeight' in target) {
    copyUniformStrokeWeights(source, target);
    if (source.strokeWeight === figma.mixed) {
      copyPerSideStrokeWeights(source, target);
    }
  }

  if ('strokeAlign' in source && 'strokeAlign' in target) {
    target.strokeAlign = source.strokeAlign;
  }

  if ('dashPattern' in source && 'dashPattern' in target) {
    target.dashPattern = [...source.dashPattern];
  }

  if ('strokeCap' in source && 'strokeCap' in target && source.strokeCap !== figma.mixed) {
    target.strokeCap = source.strokeCap;
  }

  if ('strokeJoin' in source && 'strokeJoin' in target && source.strokeJoin !== figma.mixed) {
    target.strokeJoin = source.strokeJoin;
  }

  if ('strokeMiterLimit' in source && 'strokeMiterLimit' in target) {
    target.strokeMiterLimit = source.strokeMiterLimit;
  }
}

async function copyEffectsStyle(source: SceneNode, target: SceneNode): Promise<void> {
  if (!('effects' in source) || !('effects' in target)) {
    return;
  }

  const sourceEffectStyleId = 'effectStyleId' in source ? source.effectStyleId : '';
  if (typeof sourceEffectStyleId === 'string' && sourceEffectStyleId !== '') {
    await setEffectStyleId(target, sourceEffectStyleId);
    return;
  }

  await setEffectStyleId(target, '');
  target.effects = cloneValue(source.effects);
}

async function copyOpacityStyle(source: SceneNode, target: SceneNode): Promise<void> {
  if (!('opacity' in source) || !('opacity' in target)) {
    return;
  }

  await copyNodeVariableBinding(source, target, 'opacity');
  target.opacity = source.opacity;
}

function copyRadiusStyle(source: SceneNode, target: SceneNode): void {
  if ('cornerSmoothing' in source && 'cornerSmoothing' in target) {
    target.cornerSmoothing = source.cornerSmoothing;
  }

  if ('cornerRadius' in source && 'cornerRadius' in target && source.cornerRadius !== figma.mixed) {
    target.cornerRadius = source.cornerRadius;
    if ('topLeftRadius' in target) target.topLeftRadius = source.cornerRadius;
    if ('topRightRadius' in target) target.topRightRadius = source.cornerRadius;
    if ('bottomRightRadius' in target) target.bottomRightRadius = source.cornerRadius;
    if ('bottomLeftRadius' in target) target.bottomLeftRadius = source.cornerRadius;
    return;
  }

  if ('topLeftRadius' in source && 'topLeftRadius' in target) {
    target.topLeftRadius = source.topLeftRadius;
    target.topRightRadius = source.topRightRadius;
    target.bottomRightRadius = source.bottomRightRadius;
    target.bottomLeftRadius = source.bottomLeftRadius;
  }
}

async function copyTextStyle(source: SceneNode, target: SceneNode): Promise<void> {
  if (source.type !== 'TEXT' || target.type !== 'TEXT') {
    return;
  }

  const sourceTextStyleId = source.textStyleId;
  const hasLinkedTextStyle = typeof sourceTextStyleId === 'string' && sourceTextStyleId !== '';

  await setTextStyleId(target, hasLinkedTextStyle ? sourceTextStyleId : '');

  if (!hasLinkedTextStyle) {
    await loadTextNodeFonts(target);

    if (source.fontName !== figma.mixed) {
      await figma.loadFontAsync(source.fontName);
      target.fontName = cloneValue(source.fontName);
    }

    if (source.fontSize !== figma.mixed) {
      target.fontSize = source.fontSize;
    }

    if (source.letterSpacing !== figma.mixed) {
      target.letterSpacing = cloneValue(source.letterSpacing);
    }

    if (source.lineHeight !== figma.mixed) {
      target.lineHeight = cloneValue(source.lineHeight);
    }

    if (source.paragraphSpacing !== figma.mixed) {
      target.paragraphSpacing = source.paragraphSpacing;
    }

    if (source.paragraphIndent !== figma.mixed) {
      target.paragraphIndent = source.paragraphIndent;
    }

    if (source.textCase !== figma.mixed) {
      target.textCase = source.textCase;
    }

    if (source.textDecoration !== figma.mixed) {
      target.textDecoration = source.textDecoration;
    }

    if (source.leadingTrim !== figma.mixed) {
      target.leadingTrim = source.leadingTrim;
    }
  }

  if (source.textAlignHorizontal !== figma.mixed) {
    target.textAlignHorizontal = source.textAlignHorizontal;
  }

  if (source.textAlignVertical !== figma.mixed) {
    target.textAlignVertical = source.textAlignVertical;
  }
}

export async function matchStyle() {
  const selection = figma.currentPage.selection;
  if (selection.length < 2) {
    throw new Error('Select at least 2 layers to match style');
  }

  const [source, ...targets] = selection;
  let matchedCount = 0;

  for (const target of targets) {
    try {
      await copyFillStyle(source, target);
      await copyStrokeStyle(source, target);
      await copyEffectsStyle(source, target);
      await copyOpacityStyle(source, target);
      copyRadiusStyle(source, target);
      await copyTextStyle(source, target);
      matchedCount++;
    } catch (error) {
      console.error(`Failed to match style onto ${target.name}:`, error);
    }
  }

  figma.notify(`Matched style to ${matchedCount} layer${matchedCount === 1 ? '' : 's'}`);
}

export async function setFill(value: string) {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) throw new Error('No items selected');

  const resolution = await resolvePaintValue(value);

  for (const node of selection) {
    if (!('fills' in node)) {
      continue;
    }

    try {
      switch (resolution.type) {
        case 'style': {
          if (!resolution.styleKey) break;

          // Get the style by key
          const localStyles = await figma.getLocalPaintStylesAsync();
          let style: PaintStyle | undefined = localStyles.find(s => s.key === resolution.styleKey);

          // If not found locally, import from library
          if (!style) {
            const importedStyle = await figma.importStyleByKeyAsync(resolution.styleKey);
            if (importedStyle.type === 'PAINT') {
              style = importedStyle as PaintStyle;
            }
          }

          if (style) {
            await node.setFillStyleIdAsync(style.id);
          }
          break;
        }

        case 'variable': {
          // Import library variable if needed
          let variableId = resolution.variableId!;

          if (resolution.isLibraryVariable) {
            const importedVar = await figma.variables.importVariableByKeyAsync(variableId);
            variableId = importedVar.id;
          }

          const variable = await figma.variables.getVariableByIdAsync(variableId);
          if (!variable) throw new Error('Variable not found');

          const currentFills = node.fills === figma.mixed ? [] : [...node.fills];
          const basePaint: SolidPaint = currentFills[0]?.type === 'SOLID'
            ? currentFills[0] as SolidPaint
            : { type: 'SOLID', color: { r: 0, g: 0, b: 0 } };

          const boundPaint = figma.variables.setBoundVariableForPaint(
            basePaint,
            'color',
            variable
          );
          node.fills = [boundPaint];
          break;
        }

        case 'literal': {
          node.fills = [{
            type: 'SOLID',
            color: resolution.color!
          }];
          break;
        }
      }
    } catch (error) {
      console.error(`Failed to apply fill to ${node.name}:`, error);
      // Continue with other nodes
    }
  }

  figma.notify('Fill applied successfully');
}

export function toggleFill() {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }

  for (const node of selection) {
    // Check if the node has fills property
    if ('fills' in node) {
      const fills = node.fills;

      // Ensure fills is an array before checking its length
      if (Array.isArray(fills) && fills.length > 0) {
        // If the node has fills, remove them
        node.fills = [];
      } else {
        // If the node has no fills, add a black fill
        node.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
      }
    }
  }
}

export function setRadius({
  topLeftRadius,
  topRightRadius,
  bottomLeftRadius,
  bottomRightRadius
}: {
  topLeftRadius?: string;
  topRightRadius?: string;
  bottomLeftRadius?: string;
  bottomRightRadius?: string;
}) {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    throw new Error('No items selected');
  }

  for (const node of selection) {
    if ('topLeftRadius' in node) {
      if (topLeftRadius !== undefined) node.topLeftRadius = Math.max(0, resolveDelta(topLeftRadius, node.topLeftRadius));
      if (topRightRadius !== undefined) node.topRightRadius = Math.max(0, resolveDelta(topRightRadius, node.topRightRadius));
      if (bottomLeftRadius !== undefined) node.bottomLeftRadius = Math.max(0, resolveDelta(bottomLeftRadius, node.bottomLeftRadius));
      if (bottomRightRadius !== undefined) node.bottomRightRadius = Math.max(0, resolveDelta(bottomRightRadius, node.bottomRightRadius));
    }
  }

  figma.notify('Radius updated for all selected items');
}

export function setCornerSmoothing(value: string) {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }

  for (const node of selection) {
    if ('cornerSmoothing' in node) {
      const currentPercent = (node.cornerSmoothing ?? 0) * 100;
      const next = Math.max(0, Math.min(100, resolveDelta(value, currentPercent)));
      node.cornerSmoothing = next / 100;
    }
  }

  figma.notify(`Corner smoothing set to ${value}`);
}

export function clipContent() {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }

  for (const node of selection) {
    switch (node.type) {
      case 'COMPONENT':
      case 'COMPONENT_SET':
      case 'FRAME':
      case 'INSTANCE':
        if ('clipsContent' in node) {
          (node as FrameNode).clipsContent = !(node as FrameNode).clipsContent;
        }
        break;
    }
  }
}

export function swapFillStroke() {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    throw new Error('No items selected');
  }

  for (const node of selection) {
    // Check if node supports both fills and strokes
    if (!('fills' in node) || !('strokes' in node)) {
      continue;
    }

    // Get current fills and strokes
    const currentFills = node.fills === figma.mixed ? [] : [...(node.fills as Paint[])];
    const currentStrokes = [...node.strokes];

    // Only swap if at least one has a solid color
    if (currentFills.length === 0 && currentStrokes.length === 0) {
      continue;
    }

    // Swap fills and strokes
    node.fills = currentStrokes.length > 0 ? currentStrokes : [];
    node.strokes = currentFills.length > 0 ? currentFills : [];

    // Ensure stroke is visible if we just added one
    if (currentFills.length > 0 && 'strokeWeight' in node) {
      if (node.strokeWeight === 0) {
        node.strokeWeight = 1; // Default to 1px if no stroke weight was set
      }
    }
  }

  figma.notify('Fill and stroke swapped');
}

export async function setEffect(value: string) {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) throw new Error('No items selected');

  const resolution = await resolveStyleValue(value);

  for (const node of selection) {
    try {
      if (resolution.type === 'style' && resolution.styleKey && resolution.styleType === 'EFFECT') {
        if ('effectStyleId' in node) {
          try {
            const style = await figma.importStyleByKeyAsync(resolution.styleKey);
            if (style) {
              await node.setEffectStyleIdAsync(style.id);
            }
          } catch (e) {
            console.error(`Failed to load style ${resolution.styleKey}:`, e);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to apply effect to ${node.name}:`, error);
    }
  }

  figma.notify('Effect applied successfully');
}
