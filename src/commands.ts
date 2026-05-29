// ==================================
// Command Definitions
// ==================================

import type { CommandWithValue, CommandWithoutValue, OptionalValueCommand } from './types';
import * as impl from './implementations';
import { notify, parseNumberList } from './utils';

// CSS-style shorthand expansion for padding (T R B L).
// 1 → all four; 2 → V/H; 3 → T/H/B; 4 → T/R/B/L.
function expandPaddingShorthand(value: string): { top: string; right: string; bottom: string; left: string } {
  const parts = parseNumberList(value);
  switch (parts.length) {
    case 1: return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };
    case 2: return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] };
    case 3: return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[1] };
    default: return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] };
  }
}

// CSS-style shorthand expansion for radius (TL TR BR BL).
// 1 → all four; 2 → diagonal pairs (TL/BR, TR/BL); 4 → TL/TR/BR/BL.
function expandRadiusShorthand(value: string): { tl: string; tr: string; br: string; bl: string } {
  const parts = parseNumberList(value);
  switch (parts.length) {
    case 1: return { tl: parts[0], tr: parts[0], br: parts[0], bl: parts[0] };
    case 2: return { tl: parts[0], tr: parts[1], br: parts[0], bl: parts[1] };
    case 3: return { tl: parts[0], tr: parts[1], br: parts[2], bl: parts[1] };
    default: return { tl: parts[0], tr: parts[1], br: parts[2], bl: parts[3] };
  }
}

function hasSelectableParent(node: SceneNode): boolean {
  const parent = node.parent;
  return !!parent && parent.type !== 'PAGE' && parent.type !== 'DOCUMENT';
}

function hasChildren(node: SceneNode): boolean {
  return 'children' in node && node.children.length > 0;
}

function sharesParent(selection: readonly SceneNode[]): boolean {
  if (selection.length < 2) return false;
  const parent = selection[0].parent;
  return !!parent && selection.every(node => node.parent === parent);
}

function supportsOutlineStroke(node: SceneNode): boolean {
  return 'outlineStroke' in node && typeof node.outlineStroke === 'function';
}

function supportsConstraints(node: SceneNode): boolean {
  return 'constraints' in node;
}

function canAlignToParent(node: SceneNode): boolean {
  const parent = node.parent;
  return 'x' in node && 'y' in node && !!parent && 'width' in parent && 'height' in parent;
}

function isPositionedNode(node: SceneNode): boolean {
  return 'x' in node && 'y' in node && 'width' in node && 'height' in node;
}

function isInAutoLayoutParent(node: SceneNode): boolean {
  const parent = node.parent;
  return !!parent && 'layoutMode' in parent && parent.layoutMode !== 'NONE';
}

function supportsFreeLayoutAlignment(selection: readonly SceneNode[]): boolean {
  if (selection.length === 0) return true;

  if (!selection.every(node => isPositionedNode(node) && !isInAutoLayoutParent(node))) {
    return false;
  }

  return selection.length > 1 || selection.every(canAlignToParent);
}

function supportsTidySelection(selection: readonly SceneNode[]): boolean {
  if (selection.length === 1) {
    const [node] = selection;
    return node.type === 'FRAME' && node.inferredAutoLayout !== null;
  }

  return selection.length >= 2 && sharesParent(selection) && selection.every(isPositionedNode);
}

// ==================================
// Node Type Groups (Figma API v1)
// ==================================

/**
 * Reusable node type groups based on Figma Plugin API capabilities.
 * Following Figma best practice: always check node.type, not property existence.
 * 
 * Reference: Groups don't support fills, strokes, or corner radius (Figma API docs)
 * @see https://www.figma.com/plugin-docs/api/nodes/
 */
export const NODE_GROUPS = {
  /** Nodes supporting resize operations (width/height) */
  RESIZABLE: [
    'BOOLEAN_OPERATION',
    'COMPONENT',
    'COMPONENT_SET',
    'ELLIPSE',
    'FRAME',
    'GROUP',
    'INSTANCE',
    'LINE',
    'POLYGON',
    'RECTANGLE',
    'SLICE',
    'STAR',
    'TEXT',
    'VECTOR',
  ] as const,

  /** Nodes supporting position (x, y) including sections */
  POSITIONABLE: [
    'BOOLEAN_OPERATION',
    'COMPONENT',
    'COMPONENT_SET',
    'ELLIPSE',
    'FRAME',
    'GROUP',
    'INSTANCE',
    'LINE',
    'POLYGON',
    'RECTANGLE',
    'SECTION',
    'SLICE',
    'STAR',
    'TEXT',
    'VECTOR',
  ] as const,

  /** Nodes supporting fills and strokes (excludes GROUP per Figma API) */
  FILLS_AND_STROKES: [
    'BOOLEAN_OPERATION',
    'COMPONENT',
    'COMPONENT_SET',
    'ELLIPSE',
    'FRAME',
    'INSTANCE',
    'LINE',
    'POLYGON',
    'RECTANGLE',
    'SECTION',
    'STAR',
    'TEXT',
    'VECTOR',
  ] as const,

  /** Nodes supporting corner radius (excludes GROUP, LINE, SLICE, SECTION, TEXT) */
  CORNER_RADIUS: [
    'BOOLEAN_OPERATION',
    'COMPONENT',
    'COMPONENT_SET',
    'ELLIPSE',
    'FRAME',
    'INSTANCE',
    'POLYGON',
    'RECTANGLE',
    'STAR',
    'VECTOR',
  ] as const,

  /** Frame-like containers supporting padding, layout, clip content */
  FRAME_LIKE: [
    'COMPONENT',
    'COMPONENT_SET',
    'FRAME',
    'INSTANCE',
  ] as const,

  /** Text nodes only */
  TEXT_ONLY: ['TEXT'] as const,

  /** Instance nodes only (for master component navigation) */
  INSTANCE_ONLY: ['INSTANCE'] as const,

  /** Component and ComponentSet nodes (for variant operations) */
  COMPONENT_VARIANT_ONLY: ['COMPONENT', 'COMPONENT_SET'] as const,

  /** All deletable nodes */
  DELETABLE: [
    'BOOLEAN_OPERATION',
    'COMPONENT',
    'COMPONENT_SET',
    'ELLIPSE',
    'FRAME',
    'GROUP',
    'INSTANCE',
    'LINE',
    'POLYGON',
    'RECTANGLE',
    'SECTION',
    'SLICE',
    'STAR',
    'TEXT',
    'VECTOR',
  ] as const,
} as const;

export const COMMAND_DEFINITIONS = {
  Width: {
    type: "commandWithValue",
    alias: ['w'],
    valueFormat: 'number' as const,
    suggestion: 'Enter width in pixels',
    functionWithParam: (value: string) => impl.resize(value, 'width'),
    supportedNodes: [...NODE_GROUPS.RESIZABLE],
  },
  Height: {
    type: "commandWithValue",
    alias: ['h'],
    valueFormat: "number",
    suggestion: "Enter height in pixels",
    functionWithParam: (value: string) => impl.resize(value, 'height'),
    supportedNodes: [...NODE_GROUPS.RESIZABLE],
  },
  HeightWidth: {
    type: "commandWithValue",
    alias: ['hw', 'wh'],
    valueFormat: "number",
    suggestion: "Set both width/height to...",
    functionWithParam: (value: string) => impl.resize(value),
    supportedNodes: [...NODE_GROUPS.RESIZABLE],
  },

  InstanceSwap: {
    type: 'commandWithValue',
    alias: ['is'],
    valueFormat: 'string' as const,
    suggestion: '?swap instance with component',
    functionWithParam: (value: string) => impl.swapInstance(value),
    supportedNodes: [...NODE_GROUPS.INSTANCE_ONLY],
    bindingSupport: { instanceSwap: true }
  },
  InstanceProperty: {
    type: "commandWithValue",
    alias: ['i', "ip"],
    valueFormat: 'string' as const,
    suggestion: '?search for instance properties',
    functionWithParam: (value: string) => impl.setInstanceProperty(value),
    supportedNodes: [...NODE_GROUPS.INSTANCE_ONLY],
    bindingSupport: {
      instanceProperties: true
    }
  },
  ResetInstanceOverrides: {
    type: 'commandWithValue',
    alias: ['rio'],
    valueFormat: 'string' as const,
    suggestion: '?select override to reset',
    functionWithParam: async (value: string) => await impl.resetSpecificOverride(value),
    supportedNodes: [...NODE_GROUPS.INSTANCE_ONLY],
    bindingSupport: {
      instanceOverrides: true
    }
  },
  ResetInstance: {
    type: "commandWithoutValue",
    alias: ['ri'],
    suggestion: 'Reset to master component',
    functionWithoutParam: () => impl.resetInstance(),
    supportedNodes: [...NODE_GROUPS.INSTANCE_ONLY],
  },
  DetachInstance: {
    type: "commandWithoutValue",
    alias: ['di'],
    suggestion: 'Detach from master component',
    functionWithoutParam: () => impl.detachInstance(),
    supportedNodes: [...NODE_GROUPS.INSTANCE_ONLY],
  },
  SelectSimilar: {
    type: "commandWithoutValue",
    alias: ['ss'],
    suggestion: 'Select all similar instances',
    functionWithoutParam: () => impl.selectSimilar(),
  },
  SelectParent: {
    type: "commandWithoutValue",
    alias: ['selp', 'sp'],
    suggestion: 'Select parent layer',
    functionWithoutParam: () => impl.selectParent(),
    selectionPredicate: selection => selection.every(hasSelectableParent),
  },
  SelectChildren: {
    type: "commandWithoutValue",
    alias: ['selc', 'sc'],
    suggestion: 'Select direct children',
    functionWithoutParam: () => impl.selectChildren(),
    selectionPredicate: selection => selection.every(hasChildren),
  },
  PushOverrides: {
    type: "commandWithoutValue",
    alias: ['po'],
    suggestion: 'Push overrides to main component',
    functionWithoutParam: () => impl.pushOverridesToMain(),
    supportedNodes: [...NODE_GROUPS.INSTANCE_ONLY],
  },
  CreateComponent: {
    type: "commandWithoutValue",
    alias: ['cc'],
    suggestion: 'Create component from selection',
    functionWithoutParam: () => impl.createComponent(),
  },
  AddVariant: {
    type: "commandWithoutValue",
    alias: ['av'],
    suggestion: 'Add new variant (clone selected)',
    functionWithoutParam: () => impl.addVariant(),
    supportedNodes: [...NODE_GROUPS.COMPONENT_VARIANT_ONLY],
  },
  CreateSlot: {
    type: "commandWithoutValue",
    alias: ['csl'],
    suggestion: 'Create slot in component',
    functionWithoutParam: () => impl.createSlot(),
    supportedNodes: [...NODE_GROUPS.COMPONENT_VARIANT_ONLY],
  },
  ResetSlot: {
    type: "commandWithoutValue",
    alias: ['rsl'],
    suggestion: 'Reset slot to original content',
    functionWithoutParam: () => impl.resetSlot(),
    supportedNodes: ['SLOT'],
  },
  MoveTop: {
    type: "commandWithValue",
    alias: ['mt', '-my'],
    valueFormat: 'number' as const,
    suggestion: "Move X pixels up",
    functionWithParam: (value: string) => impl.move('TOP', value),
    supportedNodes: [...NODE_GROUPS.POSITIONABLE],
    specialConditions: ['IsNotInAutoLayout', 'IsAbsoluteInAutoLayout'],
  },
  MoveBottom: {
    type: "commandWithValue",
    alias: ['mb', 'my'],
    valueFormat: 'number' as const,
    suggestion: "Move X pixels down",
    functionWithParam: (value: string) => impl.move('BOTTOM', value),
    supportedNodes: [...NODE_GROUPS.POSITIONABLE],
    specialConditions: ['IsNotInAutoLayout', 'IsAbsoluteInAutoLayout'],
  },
  MoveLeft: {
    type: "commandWithValue",
    alias: ['ml', '-mx'],
    valueFormat: 'number' as const,
    suggestion: "Move X pixels left",
    functionWithParam: (value: string) => impl.move('LEFT', value),
    supportedNodes: [...NODE_GROUPS.POSITIONABLE],
    specialConditions: ['IsNotInAutoLayout', 'IsAbsoluteInAutoLayout'],
  },
  MoveRight: {
    type: "commandWithValue",
    alias: ['mr', 'mx'],
    valueFormat: 'number' as const,
    suggestion: "Move X pixels right",
    functionWithParam: (value: string) => impl.move('RIGHT', value),
    supportedNodes: [...NODE_GROUPS.POSITIONABLE],
    specialConditions: ['IsNotInAutoLayout', 'IsAbsoluteInAutoLayout'],
  },
  PositionLeft: {
    type: "commandWithValue",
    alias: ['pol', 'x'],
    valueFormat: "number",
    suggestion: "Position in px from left",
    functionWithParam: (value: string) => impl.position(value, 'left'),
    supportedNodes: [...NODE_GROUPS.POSITIONABLE],
    specialConditions: ['IsNotInAutoLayout', 'IsAbsoluteInAutoLayout'],
  },
  PositionRight: {
    type: "commandWithValue",
    alias: ['por', '-x'],
    valueFormat: "number",
    suggestion: "Position in px from right",
    functionWithParam: (value: string) => impl.position(value, 'right'),
    supportedNodes: [...NODE_GROUPS.POSITIONABLE],
    specialConditions: ['IsNotInAutoLayout', 'IsAbsoluteInAutoLayout'],
  },
  PositionTop: {
    type: "commandWithValue",
    alias: ['pot', 'y'],
    valueFormat: "number",
    suggestion: "Position in px from top",
    functionWithParam: (value: string) => impl.position(value, 'top'),
    supportedNodes: [...NODE_GROUPS.POSITIONABLE],
    specialConditions: ['IsNotInAutoLayout', 'IsAbsoluteInAutoLayout'],
  },
  PositionBottom: {
    type: "commandWithValue",
    alias: ['pob', '-y'],
    valueFormat: "number",
    suggestion: "Position in px from bottom",
    functionWithParam: (value: string) => impl.position(value, 'bottom'),
    supportedNodes: [...NODE_GROUPS.POSITIONABLE],
    specialConditions: ['IsNotInAutoLayout', 'IsAbsoluteInAutoLayout'],
  },
  SwapPosition: {
    type: "commandWithoutValue",
    alias: ['swp'],
    suggestion: 'Swap the position/order of 2 selected items',
    functionWithoutParam: () => impl.swapPosition(),
    supportedNodes: [...NODE_GROUPS.POSITIONABLE],
    specialConditions: ['HasParent'],
    selectionCount: 2,
  },
  Delete: {
    type: "commandWithoutValue",
    alias: ['de'],
    suggestion: 'Delete',
    functionWithoutParam: () => impl.deleteSelection(),
    supportedNodes: [...NODE_GROUPS.DELETABLE],
  },
  AutoLayout: {
    type: "commandWithoutValue",
    alias: ['alh'],
    suggestion: 'Create Horizontal Auto-Layout',
    functionWithoutParam: () => impl.createAutoLayout('HORIZONTAL'),
  },
  AutoLayoutVertical: {
    type: "commandWithoutValue",
    alias: ['alv'],
    suggestion: "Create Vertical Auto-Layout",
    functionWithoutParam: () => impl.createAutoLayout('VERTICAL'),
  },
  RemoveAutoLayout: {
    type: "commandWithoutValue",
    alias: ['ra'],
    suggestion: 'Remove Auto-Layout',
    functionWithoutParam: () => impl.setLayout('NONE'),
    supportedNodes: [...NODE_GROUPS.FRAME_LIKE],
  },
  FlipHorizontal: {
    type: "commandWithoutValue",
    alias: ['fh'],
    suggestion: 'Flip Horizontal',
    functionWithoutParam: () => impl.flip('horizontal')
  },
  FlipVertical: {
    type: "commandWithoutValue",
    alias: ['fv'],
    suggestion: 'Flip Vertical',
    functionWithoutParam: () => impl.flip('vertical')
  },
  Group: {
    type: "commandWithoutValue",
    alias: ['gr'],
    suggestion: 'Group',
    functionWithoutParam: () => impl.grouping('group'),
    selectionPredicate: sharesParent,
  },
  Ungroup: {
    type: "commandWithoutValue",
    alias: ['ugr'],
    suggestion: 'Ungroup',
    functionWithoutParam: () => impl.grouping('ungroup'),
    selectionPredicate: selection => selection.every(node =>
      (node.type === 'GROUP' || node.type === 'FRAME') && hasChildren(node)
    ),
  },
  Union: {
    type: "commandWithoutValue",
    alias: ['un', 'u'],
    suggestion: 'Union Selection',
    functionWithoutParam: () => impl.performBooleanOperation('UNION'),
    supportedNodes: [...NODE_GROUPS.FILLS_AND_STROKES],
    selectionPredicate: selection => selection.length >= 2,
  },
  Subtract: {
    type: "commandWithoutValue",
    alias: ['su', 'sub'],
    suggestion: 'Subtract Selection',
    functionWithoutParam: () => impl.performBooleanOperation('SUBTRACT'),
    supportedNodes: [...NODE_GROUPS.FILLS_AND_STROKES],
    selectionPredicate: selection => selection.length >= 2,
  },
  Intersect: {
    type: "commandWithoutValue",
    alias: ['in', 'int'],
    suggestion: 'Intersect Selection',
    functionWithoutParam: () => impl.performBooleanOperation('INTERSECT'),
    supportedNodes: [...NODE_GROUPS.FILLS_AND_STROKES],
    selectionPredicate: selection => selection.length >= 2,
  },
  Exclude: {
    type: "commandWithoutValue",
    alias: ['ex'],
    suggestion: 'Exclude Selection',
    functionWithoutParam: () => impl.performBooleanOperation('EXCLUDE'),
    supportedNodes: [...NODE_GROUPS.FILLS_AND_STROKES],
    selectionPredicate: selection => selection.length >= 2,
  },
  Lock: {
    type: "commandWithoutValue",
    alias: ['l', 'lock'],
    suggestion: 'Toggle Lock',
    functionWithoutParam: () => impl.toggleLock(),
  },
  Mask: {
    type: "commandWithoutValue",
    alias: ['m', 'mask'],
    suggestion: 'Toggle Mask',
    functionWithoutParam: () => impl.toggleMask(),
    supportedNodes: [...NODE_GROUPS.FILLS_AND_STROKES, 'GROUP'],
  },
  Flatten: {
    type: "commandWithoutValue",
    alias: ['fl'],
    suggestion: 'Flatten Selection',
    functionWithoutParam: () => impl.flattenSelection(),
  },
  OutlineStroke: {
    type: "commandWithoutValue",
    alias: ['os'],
    suggestion: 'Outline Stroke',
    functionWithoutParam: () => impl.outlineStroke(),
    supportedNodes: [...NODE_GROUPS.FILLS_AND_STROKES],
    selectionPredicate: selection => selection.every(supportsOutlineStroke),
  },
  VerticalFill: {
    type: "commandWithoutValue",
    alias: ['vf'],
    suggestion: "Vertical Fill",
    functionWithoutParam: () => impl.layoutSizing('VERTICAL', 'FILL'),
    specialConditions: ['IsInAutoLayout', 'IsAutoLayout', 'IsNotInAutoLayout'],
  },
  VerticalHug: {
    type: "commandWithoutValue",
    alias: ['vh'],
    suggestion: "Vertical Hug",
    functionWithoutParam: () => impl.layoutSizing('VERTICAL', 'HUG'),
    specialConditions: ['IsInAutoLayout', 'IsAutoLayout'],
  },
  HorizontalFill: {
    type: "commandWithoutValue",
    alias: ['hf'],
    suggestion: "Horizontal Fill",
    functionWithoutParam: () => impl.layoutSizing('HORIZONTAL', 'FILL'),
    specialConditions: ['IsInAutoLayout', 'IsAutoLayout', 'IsNotInAutoLayout'],
  },
  HorizontalHug: {
    type: "commandWithoutValue",
    alias: ['hh'],
    suggestion: "Horizontal Hug",
    functionWithoutParam: () => impl.layoutSizing('HORIZONTAL', 'HUG'),
    specialConditions: ['IsInAutoLayout', 'IsAutoLayout'],
  },
  Gap: {
    type: "optionalValueCommand",
    alias: ['g'],
    valueFormat: "number",
    suggestion: "Gap in px (No value = Auto on row/column layout)",
    functionWithParam: (value: string) => impl.setPrimaryGap(value),
    functionWithoutParam: () => impl.setPrimaryGap('AUTO'),
    specialConditions: ['IsAutoLayout'],
    bindingSupport: {
      variables: ['FLOAT'],
      libraryStyles: true
    }
  },
  SpaceBetween: {
    type: "commandWithoutValue",
    alias: ['sb'],
    suggestion: "Set Gap Between Objects to 'Auto'",
    functionWithoutParam: () => impl.setPrimaryGap('AUTO'),
    specialConditions: ['IsAutoLayout'],
  },
  VerticalGap: {
    type: "optionalValueCommand",
    alias: ['vg'],
    valueFormat: "number",
    suggestion: "Vertical gap in px (No value = Auto on wrap layout)",
    functionWithParam: (value: string) => impl.setCounterGap(value),
    functionWithoutParam: () => impl.setCounterGap('AUTO'),
    specialConditions: ['IsAutoLayoutWrap'],
    bindingSupport: {
      variables: ['FLOAT'],
      libraryStyles: true
    }
  },
  GridColumnGap: {
    type: "commandWithValue",
    alias: ['cg'],
    valueFormat: "number",
    suggestion: "Grid column gap in px",
    functionWithParam: (value: string) => impl.setPrimaryGap(value),
    specialConditions: ['IsGridLayout'],
    bindingSupport: {
      variables: ['FLOAT'],
      libraryStyles: true
    }
  },
  GridRowGap: {
    type: "commandWithValue",
    alias: ['rg'],
    valueFormat: "number",
    suggestion: "Grid row gap in px",
    functionWithParam: (value: string) => impl.setCounterGap(value),
    specialConditions: ['IsGridLayout'],
    bindingSupport: {
      variables: ['FLOAT'],
      libraryStyles: true
    }
  },
  TidyGap: {
    type: "optionalValueCommand",
    alias: ['tg', 'thg'],
    valueFormat: "number",
    suggestion: "Tidy / smart selection gap in px (No value = dominant existing gap)",
    functionWithParam: (value: string) => impl.setTidyGap(value),
    functionWithoutParam: () => impl.setTidyGap(),
    supportedNodes: [...NODE_GROUPS.POSITIONABLE],
    selectionPredicate: supportsTidySelection,
  },
  TidyRowGap: {
    type: "commandWithValue",
    alias: ['trg', 'tvg'],
    valueFormat: "number",
    suggestion: "Tidy / smart selection row gap in px",
    functionWithParam: (value: string) => impl.setTidyRowGap(value),
    supportedNodes: [...NODE_GROUPS.POSITIONABLE],
    selectionPredicate: supportsTidySelection,
  },
  VerticalSpaceBetween: {
    type: "commandWithoutValue",
    alias: ['vsb'],
    suggestion: "Auto",
    functionWithoutParam: () => impl.setCounterGap('AUTO'),
    specialConditions: ['IsAutoLayoutWrap'],
  },
  LayoutHorizontal: {
    type: "commandWithoutValue",
    alias: ['lh'],
    suggestion: "Horizontal Layout",
    functionWithoutParam: () => impl.setLayout('HORIZONTAL'),
    supportedNodes: [...NODE_GROUPS.FRAME_LIKE],
    specialConditions: ['IsAutoLayout'],
  },
  LayoutVertical: {
    type: "commandWithoutValue",
    alias: ['lv'],
    suggestion: "Vertical Layout",
    functionWithoutParam: () => impl.setLayout('VERTICAL'),
    supportedNodes: [...NODE_GROUPS.FRAME_LIKE],
    specialConditions: ['IsAutoLayout'],
  },
  LayoutWrap: {
    type: "commandWithoutValue",
    alias: ['lw'],
    suggestion: "Wrap Layout",
    functionWithoutParam: () => impl.setLayout('WRAP'),
    supportedNodes: [...NODE_GROUPS.FRAME_LIKE],
  },
  LayoutGrid: {
    type: "optionalValueCommand",
    alias: ['lg'],
    valueFormat: 'number' as const,
    suggestion: 'Uniform grid in px (No value = toggle visibility)',
    functionWithParam: (value: string) => impl.setUniformGrid(value),
    functionWithoutParam: () => impl.toggleGridVisibility(),
    supportedNodes: [...NODE_GROUPS.FRAME_LIKE],
  },
  LayoutGridColumns: {
    type: "commandWithValue",
    alias: ['lgc'],
    valueFormat: 'number' as const,
    suggestion: 'Number of columns (stretch)',
    functionWithParam: (value: string) => impl.setColumnsGrid(value),
    supportedNodes: [...NODE_GROUPS.FRAME_LIKE],
  },
  LayoutGridRows: {
    type: "commandWithValue",
    alias: ['lgr'],
    valueFormat: 'number' as const,
    suggestion: 'Number of rows (stretch)',
    functionWithParam: (value: string) => impl.setRowsGrid(value),
    supportedNodes: [...NODE_GROUPS.FRAME_LIKE],
  },
  LayoutGridGutter: {
    type: "commandWithValue",
    alias: ['lgg'],
    valueFormat: 'number' as const,
    suggestion: 'Gutter size in px (rows/columns)',
    functionWithParam: (value: string) => impl.setGridGutter(value),
    supportedNodes: [...NODE_GROUPS.FRAME_LIKE],
    specialConditions: ['HasRowsOrColumnsLayoutGrid'],
  },
  LayoutGridMargin: {
    type: "commandWithValue",
    alias: ['lgm'],
    valueFormat: 'number' as const,
    suggestion: 'Margin in px (rows/columns)',
    functionWithParam: (value: string) => impl.setGridMargin(value),
    supportedNodes: [...NODE_GROUPS.FRAME_LIKE],
    specialConditions: ['HasRowsOrColumnsLayoutGrid'],
  },
  LayoutGridRemove: {
    type: "commandWithoutValue",
    alias: ['lgrm'],
    suggestion: 'Remove all layout grids',
    functionWithoutParam: () => impl.removeGrids(),
    supportedNodes: [...NODE_GROUPS.FRAME_LIKE],
    specialConditions: ['HasLayoutGrid'],
  },
  AbsolutePosition: {
    type: "commandWithoutValue",
    alias: ['ap'],
    suggestion: "ignore auto-layout (toggle)",
    functionWithoutParam: () => impl.absolutePosition(),
    supportedNodes: [...NODE_GROUPS.RESIZABLE],
    specialConditions: ['IsInAutoLayout']
  },
  Padding: {
    type: "optionalValueCommand",
    alias: ['p'],
    valueFormat: "number",
    suggestion: "Padding in px — 1, 2, 3 or 4 values (e.g. p20,30)",
    functionWithParam: (value: string) => {
      const { top, right, bottom, left } = expandPaddingShorthand(value);
      impl.setPadding({ paddingTop: top, paddingRight: right, paddingBottom: bottom, paddingLeft: left });
    },
    functionWithoutParam: () => impl.setPadding({ paddingLeft: '0', paddingRight: '0', paddingTop: '0', paddingBottom: '0' }),
    supportedNodes: [...NODE_GROUPS.FRAME_LIKE],
    bindingSupport: {
      variables: ['FLOAT'],
      libraryStyles: true
    }
  },
  PaddingHorizontal: {
    type: "optionalValueCommand",
    alias: ['ph'],
    valueFormat: "number",
    suggestion: "Horizontal padding in px (No value = 0)",
    functionWithParam: (value: string) => impl.setPadding({ paddingLeft: value, paddingRight: value }),
    functionWithoutParam: () => impl.setPadding({ paddingLeft: '0', paddingRight: '0' }),
    supportedNodes: [...NODE_GROUPS.FRAME_LIKE],
    bindingSupport: {
      variables: ['FLOAT'],
      libraryStyles: true
    }
  },
  PaddingVertical: {
    type: "optionalValueCommand",
    alias: ['pv'],
    valueFormat: "number",
    suggestion: "Vertical padding in px (No value = 0)",
    functionWithParam: (value: string) => impl.setPadding({ paddingTop: value, paddingBottom: value }),
    functionWithoutParam: () => impl.setPadding({ paddingTop: '0', paddingBottom: '0' }),
    supportedNodes: [...NODE_GROUPS.FRAME_LIKE],
    bindingSupport: {
      variables: ['FLOAT'],
      libraryStyles: true
    }
  },
  PaddingLeft: {
    type: "optionalValueCommand",
    alias: ['pl'],
    valueFormat: "number",
    suggestion: "Left padding in px (No value = 0)",
    functionWithParam: (value: string) => impl.setPadding({ paddingLeft: value }),
    functionWithoutParam: () => impl.setPadding({ paddingLeft: '0' }),
    supportedNodes: [...NODE_GROUPS.FRAME_LIKE],
    bindingSupport: {
      variables: ['FLOAT'],
      libraryStyles: true
    }
  },
  PaddingTop: {
    type: "optionalValueCommand",
    alias: ['pt'],
    valueFormat: "number",
    suggestion: "Top padding in px (No value = 0)",
    functionWithParam: (value: string) => impl.setPadding({ paddingTop: value }),
    functionWithoutParam: () => impl.setPadding({ paddingTop: '0' }),
    supportedNodes: [...NODE_GROUPS.FRAME_LIKE],
    bindingSupport: {
      variables: ['FLOAT'],
      libraryStyles: true
    }
  },
  PaddingRight: {
    type: "optionalValueCommand",
    alias: ['pr'],
    valueFormat: "number",
    suggestion: "Right padding in px (No value = 0)",
    functionWithParam: (value: string) => impl.setPadding({ paddingRight: value }),
    functionWithoutParam: () => impl.setPadding({ paddingRight: '0' }),
    supportedNodes: [...NODE_GROUPS.FRAME_LIKE],
    bindingSupport: {
      variables: ['FLOAT'],
      libraryStyles: true
    }
  },
  PaddingBottom: {
    type: "optionalValueCommand",
    alias: ['pb'],
    valueFormat: "number",
    suggestion: "Bottom padding in px (No value = 0)",
    functionWithParam: (value: string) => impl.setPadding({ paddingBottom: value }),
    functionWithoutParam: () => impl.setPadding({ paddingBottom: '0' }),
    supportedNodes: [...NODE_GROUPS.FRAME_LIKE],
    bindingSupport: {
      variables: ['FLOAT'],
      libraryStyles: true
    }
  },
  Fill: {
    type: "optionalValueCommand",
    alias: ['f'],
    valueFormat: 'hex' as const,
    suggestion: 'HEX color or ?search for styles/variables',
    functionWithoutParam: () => impl.toggleFill(),
    functionWithParam: (value: string) => impl.setFill(value),
    supportedNodes: [...NODE_GROUPS.FILLS_AND_STROKES],
    bindingSupport: {
      styles: ['PAINT'],
      variables: ['COLOR'],
      libraryStyles: true
    }
  },
  MatchStyle: {
    type: "commandWithoutValue",
    alias: ['mst'],
    suggestion: 'Copy the first selected layer style to the others',
    functionWithoutParam: () => impl.matchStyle(),
    selectionPredicate: selection => selection.length >= 2,
  },
  Rotate: {
    type: "optionalValueCommand",
    alias: ['ro'],
    valueFormat: 'number' as const,
    suggestion: 'Enter rotation angle in degrees',
    functionWithoutParam: () => impl.rotate(0),
    functionWithParam: (value: string) => { impl.rotate(value); },
    supportedNodes: [...NODE_GROUPS.FILLS_AND_STROKES],
  },
  Scale: {
    type: "commandWithValue",
    alias: ['s'],
    valueFormat: "number",
    suggestion: "Value in % (x1 = 100%)",
    functionWithParam: (value: string) => impl.scale(value),
  },
  ScaleWidth: {
    type: "commandWithValue",
    alias: ['sw'],
    valueFormat: "number",
    suggestion: "New desired width in px",
    functionWithParam: (value: string) => impl.scale(value, 'width'),
  },
  ScaleHeight: {
    type: "commandWithValue",
    alias: ['sh'],
    valueFormat: "number",
    suggestion: "New desired height in px",
    functionWithParam: (value: string) => impl.scale(value, 'height'),
  },
  RadiusTopLeft: {
    type: "optionalValueCommand",
    alias: ['rtl'],
    valueFormat: 'number' as const,
    suggestion: 'Top left radius in px (No value = 0)',
    functionWithParam: (value: string) => impl.setRadius({ topLeftRadius: value }),
    functionWithoutParam: () => impl.setRadius({ topLeftRadius: '0' }),
    supportedNodes: [...NODE_GROUPS.CORNER_RADIUS],
  },
  RadiusTopRight: {
    type: "optionalValueCommand",
    alias: ['rtr'],
    valueFormat: 'number' as const,
    suggestion: 'Top right radius in px (No value = 0)',
    functionWithParam: (value: string) => impl.setRadius({ topRightRadius: value }),
    functionWithoutParam: () => impl.setRadius({ topRightRadius: '0' }),
    supportedNodes: [...NODE_GROUPS.CORNER_RADIUS],
  },
  RadiusBottomRight: {
    type: "optionalValueCommand",
    alias: ['rbr'],
    valueFormat: 'number' as const,
    suggestion: 'Bottom right radius in px (No value = 0)',
    functionWithParam: (value: string) => impl.setRadius({ bottomRightRadius: value }),
    functionWithoutParam: () => impl.setRadius({ bottomRightRadius: '0' }),
    supportedNodes: [...NODE_GROUPS.CORNER_RADIUS],
  },
  RadiusBottomLeft: {
    type: "optionalValueCommand",
    alias: ['rbl'],
    valueFormat: 'number' as const,
    suggestion: 'Bottom left radius in px (No value = 0)',
    functionWithParam: (value: string) => impl.setRadius({ bottomLeftRadius: value }),
    functionWithoutParam: () => impl.setRadius({ bottomLeftRadius: '0' }),
    supportedNodes: [...NODE_GROUPS.CORNER_RADIUS],
  },
  RadiusAll: {
    type: "optionalValueCommand",
    alias: ['r'],
    valueFormat: 'number' as const,
    suggestion: 'Radius in px — 1, 2, 3 or 4 values (e.g. r10,20,30,40)',
    functionWithParam: (value: string) => {
      const { tl, tr, br, bl } = expandRadiusShorthand(value);
      impl.setRadius({
        topLeftRadius: tl,
        topRightRadius: tr,
        bottomRightRadius: br,
        bottomLeftRadius: bl
      });
    },
    functionWithoutParam: () => impl.setRadius({
      topLeftRadius: '0',
      topRightRadius: '0',
      bottomRightRadius: '0',
      bottomLeftRadius: '0'
    }),
    supportedNodes: [...NODE_GROUPS.CORNER_RADIUS],
  },
  RadiusLeft: {
    type: "optionalValueCommand",
    alias: ['rl'],
    valueFormat: 'number' as const,
    suggestion: 'Left side radius in px (No value = 0)',
    functionWithParam: (value: string) => impl.setRadius({
      topLeftRadius: value,
      bottomLeftRadius: value
    }),
    functionWithoutParam: () => impl.setRadius({
      topLeftRadius: '0',
      bottomLeftRadius: '0'
    }),
    supportedNodes: [...NODE_GROUPS.CORNER_RADIUS],
  },
  RadiusTop: {
    type: "optionalValueCommand",
    alias: ['rt'],
    valueFormat: 'number' as const,
    suggestion: 'Top side radius in px (No value = 0)',
    functionWithParam: (value: string) => impl.setRadius({
      topLeftRadius: value,
      topRightRadius: value
    }),
    functionWithoutParam: () => impl.setRadius({
      topLeftRadius: '0',
      topRightRadius: '0'
    }),
    supportedNodes: [...NODE_GROUPS.CORNER_RADIUS],
  },
  RadiusRight: {
    type: "optionalValueCommand",
    alias: ['rr'],
    valueFormat: 'number' as const,
    suggestion: 'Right side radius in px (No value = 0)',
    functionWithParam: (value: string) => impl.setRadius({
      topRightRadius: value,
      bottomRightRadius: value
    }),
    functionWithoutParam: () => impl.setRadius({
      topRightRadius: '0',
      bottomRightRadius: '0'
    }),
    supportedNodes: [...NODE_GROUPS.CORNER_RADIUS],
  },
  RadiusBottom: {
    type: "optionalValueCommand",
    alias: ['rb'],
    valueFormat: 'number' as const,
    suggestion: 'Bottom side radius in px (No value = 0)',
    functionWithParam: (value: string) => impl.setRadius({
      bottomLeftRadius: value,
      bottomRightRadius: value
    }),
    functionWithoutParam: () => impl.setRadius({
      bottomLeftRadius: '0',
      bottomRightRadius: '0'
    }),
    supportedNodes: [...NODE_GROUPS.CORNER_RADIUS],
  },
  ClipContent: {
    type: "commandWithoutValue",
    alias: ['c'],
    suggestion: 'Toggle Clip Content',
    functionWithoutParam: () => impl.clipContent(),
    supportedNodes: [...NODE_GROUPS.FRAME_LIKE],
  },
  Visibility: {
    type: "commandWithoutValue",
    alias: ['v'],
    suggestion: 'Toggle Show/Hide',
    functionWithoutParam: () => impl.toggleVisibility()
  },
  Opacity: {
    type: "optionalValueCommand",
    alias: ['o'],
    valueFormat: 'number' as const,
    suggestion: 'In % (No value = toggle)',
    functionWithParam: (value: string) => impl.setOpacity(value),
    functionWithoutParam: () => impl.toggleOpacity(),
    bindingSupport: {
      variables: ['FLOAT'],
      libraryStyles: true
    }
  },
  Duplicate: {
    type: "commandWithoutValue",
    alias: ['d'],
    suggestion: 'Duplicate Element',
    functionWithoutParam: () => impl.duplicate()
  },
  Stroke: {
    type: "optionalValueCommand",
    alias: ['st', 'b'],
    valueFormat: 'number' as const,
    suggestion: 'in px (No value = toggle) ? variables',
    functionWithParam: (value: string) => impl.setBorder('all', value),
    functionWithoutParam: () => impl.toggleBorder('all'),
    bindingSupport: {
      variables: ['FLOAT'],
      libraryStyles: true
    }
  },
  StrokeLeft: {
    type: "optionalValueCommand",
    alias: ['stl', 'bl'],
    valueFormat: 'number' as const,
    suggestion: 'border in px (No value = toggle) ? variables',
    functionWithParam: (value: string) => impl.setBorder('left', value),
    functionWithoutParam: () => impl.toggleBorder('left'),
    bindingSupport: {
      variables: ['FLOAT'],
      libraryStyles: true
    }
  },
  StrokeRight: {
    type: "optionalValueCommand",
    alias: ['str', 'br'],
    valueFormat: 'number' as const,
    suggestion: 'border in px (No value = toggle) ? variables',
    functionWithParam: (value: string) => impl.setBorder('right', value),
    functionWithoutParam: () => impl.toggleBorder('right'),
    bindingSupport: {
      variables: ['FLOAT'],
      libraryStyles: true
    }
  },
  StrokeTop: {
    type: "optionalValueCommand",
    alias: ['stt', 'bt'],
    valueFormat: 'number' as const,
    suggestion: 'border in px (No value = toggle) ? variables',
    functionWithParam: (value: string) => impl.setBorder('top', value),
    functionWithoutParam: () => impl.toggleBorder('top'),
    bindingSupport: {
      variables: ['FLOAT'],
      libraryStyles: true
    }
  },
  StrokeBottom: {
    type: "optionalValueCommand",
    alias: ['stb', 'bb'],
    valueFormat: 'number' as const,
    suggestion: 'border in px (No value = toggle) ? variables',
    functionWithParam: (value: string) => impl.setBorder('bottom', value),
    functionWithoutParam: () => impl.toggleBorder('bottom'),
    bindingSupport: {
      variables: ['FLOAT'],
      libraryStyles: true
    }
  },
  StrokeColor: {
    type: "optionalValueCommand",
    alias: ['stc', 'bc'],
    valueFormat: 'hex' as const,
    suggestion: 'HEX color or ?search for styles/variables',
    functionWithParam: (value: string) => impl.setBorderColor(value),
    functionWithoutParam: () => impl.toggleBorder('all'),
    bindingSupport: {
      styles: ['PAINT'],
      variables: ['COLOR'],
      libraryStyles: true
    }
  },
  Effect: {
    type: "optionalValueCommand",
    alias: ['e'],
    valueFormat: 'string' as const,
    suggestion: 'Apply effect style (No value = remove)',
    functionWithoutParam: () => impl.removeEffect(),
    functionWithParam: (value: string) => impl.setEffect(value),
    bindingSupport: {
      styles: ['EFFECT'],
      libraryStyles: true
    }
  },
  StrokeAlignCenter: {
    type: "commandWithoutValue",
    alias: ['sac', 'scc'],
    suggestion: 'Stroke align center',
    functionWithoutParam: () => impl.setBorderAlign('CENTER')
  },
  StrokeAlignInside: {
    type: "commandWithoutValue",
    alias: ['sti', 'bi'],
    suggestion: 'Stroke align inside',
    functionWithoutParam: () => impl.setBorderAlign('INSIDE')
  },
  StrokeAlignOutside: {
    type: "commandWithoutValue",
    alias: ['sto', 'bo'],
    suggestion: 'Stroke align outside',
    functionWithoutParam: () => impl.setBorderAlign('OUTSIDE')
  },
  SelectionColorsSwapping: {
    type: 'optionalValueCommand',
    alias: ['scs', 'cs'],
    valueFormat: 'string' as const,
    suggestion: '?search colors in selection (no value = swap the 2 colors in selection)',
    functionWithoutParam: () => impl.swapTwoSelectionColors(),
    functionWithParam: (value: string) => impl.swapSelectionColors(value),
    supportedNodes: [...NODE_GROUPS.FILLS_AND_STROKES],
    bindingSupport: {
      styles: ['PAINT'],
      variables: ['COLOR'],
      libraryStyles: true,
      selectionColors: true
    }
  },
  ToggleTheme: {
    type: "commandWithoutValue",
    alias: ['t'],
    suggestion: 'Toggle',
    functionWithoutParam: () => impl.toggleTheme()
  },
  TextTruncation: {
    type: "optionalValueCommand",
    alias: ['tt'],
    valueFormat: 'number' as const,
    suggestion: 'Enter max lines (No value = toggle truncation)',
    functionWithoutParam: async () => await impl.textTruncation(),
    functionWithParam: async (value: string) => await impl.textTruncation(value),
    supportedNodes: [...NODE_GROUPS.TEXT_ONLY],
  },
  VerticalTrim: {
    type: "commandWithoutValue",
    alias: ['vt'],
    suggestion: 'Toggle Vertical Trim',
    functionWithoutParam: async () => await impl.toggleVerticalTrim(),
    supportedNodes: [...NODE_GROUPS.TEXT_ONLY],
  },
  TextAutoWidth: {
    type: "commandWithoutValue",
    alias: ['taw'],
    suggestion: 'Hug Text Width and Height',
    functionWithoutParam: async () => await impl.setTextAutoResize('WIDTH_AND_HEIGHT'),
    supportedNodes: [...NODE_GROUPS.TEXT_ONLY],
  },
  TextAutoHeight: {
    type: "commandWithoutValue",
    alias: ['tah'],
    suggestion: 'Hug Text Height',
    functionWithoutParam: async () => await impl.setTextAutoResize('HEIGHT'),
    supportedNodes: [...NODE_GROUPS.TEXT_ONLY],
  },
  TextFixedSize: {
    type: "commandWithoutValue",
    alias: ['tfs'],
    suggestion: 'Fixed Text Size',
    functionWithoutParam: async () => await impl.setTextAutoResize('NONE'),
    supportedNodes: [...NODE_GROUPS.TEXT_ONLY],
  },
  TextAlignLeft: {
    type: "commandWithoutValue",
    alias: ['tal'],
    suggestion: 'Align Text to Left',
    functionWithoutParam: () => impl.AlignText({ horizontal: 'LEFT' }),
    supportedNodes: [...NODE_GROUPS.TEXT_ONLY],
  },

  TextAlignCenter: {
    type: "commandWithoutValue",
    alias: ['tac'],
    suggestion: 'Align Text to Center',
    functionWithoutParam: () => impl.AlignText({ horizontal: 'CENTER' }),
    supportedNodes: [...NODE_GROUPS.TEXT_ONLY],
  },

  TextAlignRight: {
    type: "commandWithoutValue",
    alias: ['tar'],
    suggestion: 'Align Text to Right',
    functionWithoutParam: () => impl.AlignText({ horizontal: 'RIGHT' }),
    supportedNodes: [...NODE_GROUPS.TEXT_ONLY],
  },
  JustifyText: {
    type: "commandWithoutValue",
    alias: ['taj'],
    suggestion: 'Justify Text',
    functionWithoutParam: () => impl.AlignText({ horizontal: 'JUSTIFIED' }),
    supportedNodes: [...NODE_GROUPS.TEXT_ONLY],
  },

  TextAlignTop: {
    type: "commandWithoutValue",
    alias: ['tat'],
    suggestion: 'Align Text to Top',
    functionWithoutParam: () => impl.AlignText({ vertical: 'TOP' }),
    supportedNodes: [...NODE_GROUPS.TEXT_ONLY],
  },

  TextAlignMiddle: {
    type: "commandWithoutValue",
    alias: ['tam'],
    suggestion: 'Align Text to Middle',
    functionWithoutParam: () => impl.AlignText({ vertical: 'CENTER' }),
    supportedNodes: [...NODE_GROUPS.TEXT_ONLY],
  },
  TextAlignBottom: {
    type: "commandWithoutValue",
    alias: ['tab'],
    suggestion: 'Align Text to Bottom',
    functionWithoutParam: () => impl.AlignText({ vertical: 'BOTTOM' }),
    supportedNodes: [...NODE_GROUPS.TEXT_ONLY],
  },
  Font: {
    type: "optionalValueCommand",
    alias: ['ft'],
    valueFormat: 'string' as const,
    suggestion: 'Type ? to apply a font style',
    functionWithoutParam: () => { /* No toggle action for now, maybe list styles? */ },
    functionWithParam: (value: string) => impl.applyLibraryStyle(value, 'TEXT'),
    supportedNodes: [...NODE_GROUPS.TEXT_ONLY],
    bindingSupport: {
      styles: ['TEXT'],
      libraryStyles: true
    }
  },

  // Font Size Command
  FontSize: {
    type: "commandWithValue",
    alias: ['fs'],
    valueFormat: 'number' as const,
    suggestion: 'Enter font size in px',
    functionWithParam: async (value: string) => await impl.setFontSize(value),
    supportedNodes: [...NODE_GROUPS.TEXT_ONLY],
    specialConditions: ['NoTextStyleApplied'],
  },

  RemoveTextStyle: {
    type: "commandWithoutValue",
    alias: ['rts'],
    suggestion: 'Detach Text Style',
    functionWithoutParam: () => impl.removeTextStyle(),
    supportedNodes: [...NODE_GROUPS.TEXT_ONLY],
    specialConditions: ['TextStyleApplied'],
  },

  // Font Weight Command
  FontWeight: {
    type: "commandWithValue",
    alias: ['fw'],
    valueFormat: 'number' as const,
    suggestion: 'Enter font weight (100-900)',
    functionWithParam: async (value: string) => await impl.setFontWeight(value),
    supportedNodes: [...NODE_GROUPS.TEXT_ONLY],
    specialConditions: ['NoTextStyleApplied'],
  },

  // Letter Spacing Command
  LetterSpacing: {
    type: "optionalValueCommand",
    alias: ['ls'],
    valueFormat: "number",
    suggestion: "Letter spacing in px (or %)",
    functionWithParam: (value: string) => impl.setLetterSpacing(value),
    functionWithoutParam: () => impl.setLetterSpacing('0'),
    supportedNodes: [...NODE_GROUPS.TEXT_ONLY],
    bindingSupport: {
      variables: ['FLOAT'],
      libraryStyles: true
    }
  },
  LineHeight: {
    type: "optionalValueCommand",
    alias: ['lnh'],
    valueFormat: "number",
    suggestion: "Line height in px (or %)",
    functionWithParam: (value: string) => impl.setLineHeight(value),
    functionWithoutParam: () => impl.setLineHeight('AUTO'),
    supportedNodes: [...NODE_GROUPS.TEXT_ONLY],
    bindingSupport: {
      variables: ['FLOAT'],
      libraryStyles: true
    }
  },
  ParagraphSpacing: {
    type: "commandWithValue",
    alias: ['ps'],
    valueFormat: "number",
    suggestion: "Paragraph spacing in px",
    functionWithParam: (value: string) => impl.setParagraphSpacing(value),
    supportedNodes: [...NODE_GROUPS.TEXT_ONLY],
    bindingSupport: {
      variables: ['FLOAT'],
      libraryStyles: true
    }
  },
  ParagraphIndent: {
    type: "commandWithValue",
    alias: ['pi'],
    valueFormat: "number",
    suggestion: "Paragraph indent in px",
    functionWithParam: (value: string) => impl.setParagraphIndent(value),
    supportedNodes: [...NODE_GROUPS.TEXT_ONLY],
    bindingSupport: {
      variables: ['FLOAT'],
      libraryStyles: true
    }
  },

  // Original Text Case
  TextCaseOriginal: {
    type: "commandWithoutValue",
    alias: ['tco'],
    suggestion: 'Reset Text to Original Case',
    functionWithoutParam: async () => await impl.setTextCase('ORIGINAL'),
    supportedNodes: [...NODE_GROUPS.TEXT_ONLY],
    specialConditions: ['NoTextStyleApplied'],
  },

  // Uppercase Text
  TextCaseUppercase: {
    type: "commandWithoutValue",
    alias: ['tcu'],
    suggestion: 'Convert Text to UPPERCASE',
    functionWithoutParam: async () => await impl.setTextCase('UPPER'),
    supportedNodes: [...NODE_GROUPS.TEXT_ONLY],
    specialConditions: ['NoTextStyleApplied'],
  },

  // Lowercase Text
  TextCaseLowercase: {
    type: "commandWithoutValue",
    alias: ['tcl'],
    suggestion: 'Convert Text to lowercase',
    functionWithoutParam: async () => await impl.setTextCase('LOWER'),
    supportedNodes: [...NODE_GROUPS.TEXT_ONLY],
    specialConditions: ['NoTextStyleApplied'],
  },

  // Title Case Text
  TextCaseTitle: {
    type: "commandWithoutValue",
    alias: ['tct'],
    suggestion: 'Convert Text to Title Case',
    functionWithoutParam: async () => await impl.setTextCase('TITLE'),
    supportedNodes: [...NODE_GROUPS.TEXT_ONLY],
    specialConditions: ['NoTextStyleApplied'],
  },

  // Small Caps Text
  TextCaseSmallCaps: {
    type: "commandWithoutValue",
    alias: ['tcs'],
    suggestion: 'Convert Text to Small Caps',
    functionWithoutParam: async () => await impl.setTextCase('SMALL_CAPS'),
    supportedNodes: [...NODE_GROUPS.TEXT_ONLY],
    specialConditions: ['NoTextStyleApplied'],
  },

  // Small Caps Forced Text
  TextCaseSmallCapsForced: {
    type: "commandWithoutValue",
    alias: ['tcsf'],
    suggestion: 'Convert Text to Forced Small Caps',
    functionWithoutParam: async () => await impl.setTextCase('SMALL_CAPS_FORCED'),
    supportedNodes: [...NODE_GROUPS.TEXT_ONLY],
    specialConditions: ['NoTextStyleApplied'],
  },

  // Text Decoration Commands
  RemoveTextDecoration: {
    type: "commandWithoutValue",
    alias: ['rtd'],
    suggestion: 'Remove Text Decoration',
    functionWithoutParam: async () => await impl.toggleTextDecoration('NONE'),
    supportedNodes: [...NODE_GROUPS.TEXT_ONLY],
  },
  TextUnderline: {
    type: "commandWithoutValue",
    alias: ['tu'],
    suggestion: 'Add/Remove Underline',
    functionWithoutParam: async () => await impl.toggleTextDecoration('UNDERLINE'),
    supportedNodes: [...NODE_GROUPS.TEXT_ONLY],
  },

  TextStrikethrough: {
    type: "commandWithoutValue",
    alias: ['ts'],
    suggestion: 'Add/Remove Strikethrough',
    functionWithoutParam: async () => await impl.toggleTextDecoration('STRIKETHROUGH'),
    supportedNodes: [...NODE_GROUPS.TEXT_ONLY],
  },

  // List Type Commands
  TextOrderedList: {
    type: "commandWithoutValue",
    alias: ['tol'],
    suggestion: 'Convert to Ordered List',
    functionWithoutParam: async () => await impl.setTextListOptions('ORDERED'),
    supportedNodes: [...NODE_GROUPS.TEXT_ONLY],
  },

  TextUnorderedList: {
    type: "commandWithoutValue",
    alias: ['tul'],
    suggestion: 'Convert to Unordered List',
    functionWithoutParam: async () => await impl.setTextListOptions('UNORDERED'),
    supportedNodes: [...NODE_GROUPS.TEXT_ONLY],
  },

  TextRemoveList: {
    type: "commandWithoutValue",
    alias: ['trl'],
    suggestion: 'Remove List Formatting',
    functionWithoutParam: async () => await impl.setTextListOptions('NONE'),
    supportedNodes: [...NODE_GROUPS.TEXT_ONLY],
  },

  AlignTopLeft: {
    type: "optionalValueCommand",
    alias: ['atl', 'alt'],
    valueFormat: 'string' as const,
    suggestion: 'Align Top Left',
    functionWithoutParam: () => impl.smartAlign('TOP_LEFT'),
    functionWithParam: (val: string) => impl.smartAlign('TOP_LEFT', val.startsWith('p') ? 'PARENT' : 'AUTO'),
    specialConditions: ['IsAutoLayout'],
  },
  AlignTopCenter: {
    type: "optionalValueCommand",
    alias: ['atc', 'act'],
    valueFormat: 'string' as const,
    suggestion: 'Align Top Center',
    functionWithoutParam: () => impl.smartAlign('TOP_CENTER'),
    functionWithParam: (val: string) => impl.smartAlign('TOP_CENTER', val.startsWith('p') ? 'PARENT' : 'AUTO'),
    specialConditions: ['IsAutoLayout'],
  },
  AlignTopRight: {
    type: "optionalValueCommand",
    alias: ['atr', 'art'],
    valueFormat: 'string' as const,
    suggestion: 'Align Top Right',
    functionWithoutParam: () => impl.smartAlign('TOP_RIGHT'),
    functionWithParam: (val: string) => impl.smartAlign('TOP_RIGHT', val.startsWith('p') ? 'PARENT' : 'AUTO'),
    specialConditions: ['IsAutoLayout'],
  },
  AlignCenterLeft: {
    type: "optionalValueCommand",
    alias: ['acl', 'alc'],
    valueFormat: 'string' as const,
    suggestion: 'Align Center Left',
    functionWithoutParam: () => impl.smartAlign('CENTER_LEFT'),
    functionWithParam: (val: string) => impl.smartAlign('CENTER_LEFT', val.startsWith('p') ? 'PARENT' : 'AUTO'),
    specialConditions: ['IsAutoLayout'],
  },
  AlignCenterCenter: {
    type: "optionalValueCommand",
    alias: ['acc'],
    valueFormat: 'string' as const,
    suggestion: 'Align Center Center',
    functionWithoutParam: () => impl.smartAlign('CENTER'),
    functionWithParam: (val: string) => impl.smartAlign('CENTER', val.startsWith('p') ? 'PARENT' : 'AUTO'),
    specialConditions: ['IsAutoLayout'],
  },
  AlignCenterRight: {
    type: "optionalValueCommand",
    alias: ['acr', 'arc'],
    valueFormat: 'string' as const,
    suggestion: 'Align Center Right',
    functionWithoutParam: () => impl.smartAlign('CENTER_RIGHT'),
    functionWithParam: (val: string) => impl.smartAlign('CENTER_RIGHT', val.startsWith('p') ? 'PARENT' : 'AUTO'),
    specialConditions: ['IsAutoLayout'],
  },
  AlignBottomLeft: {
    type: "optionalValueCommand",
    alias: ['abl', 'alb'],
    valueFormat: 'string' as const,
    suggestion: 'Align Bottom Left',
    functionWithoutParam: () => impl.smartAlign('BOTTOM_LEFT'),
    functionWithParam: (val: string) => impl.smartAlign('BOTTOM_LEFT', val.startsWith('p') ? 'PARENT' : 'AUTO'),
    specialConditions: ['IsAutoLayout'],
  },
  AlignBottomRight: {
    type: "optionalValueCommand",
    alias: ['abr', 'arb'],
    valueFormat: 'string' as const,
    suggestion: 'Align Bottom Right',
    functionWithoutParam: () => impl.smartAlign('BOTTOM_RIGHT'),
    functionWithParam: (val: string) => impl.smartAlign('BOTTOM_RIGHT', val.startsWith('p') ? 'PARENT' : 'AUTO'),
    specialConditions: ['IsAutoLayout'],
  },
  AlignBottomCenter: {
    type: "optionalValueCommand",
    alias: ['abc', 'acb'],
    valueFormat: 'string' as const,
    suggestion: 'Align Bottom Center',
    functionWithoutParam: () => impl.smartAlign('BOTTOM_CENTER'),
    functionWithParam: (val: string) => impl.smartAlign('BOTTOM_CENTER', val.startsWith('p') ? 'PARENT' : 'AUTO'),
    specialConditions: ['IsAutoLayout'],
  },
  MaxHeight: {
    type: "optionalValueCommand",
    alias: ['maxh'],
    valueFormat: 'number' as const,
    suggestion: 'Max Height in px (No value = toggle)',
    functionWithParam: (value: string) => impl.maxDimension({ value: value, type: 'max', direction: 'height', null: false }),
    functionWithoutParam: () => impl.maxDimension({ type: 'max', direction: 'height', null: true }),
    specialConditions: ['IsInAutoLayout', 'IsAutoLayout'],
    bindingSupport: {
      variables: ['FLOAT'],
      libraryStyles: true
    }
  },
  MaxWidth: {
    type: "optionalValueCommand",
    alias: ['maxw'],
    valueFormat: 'number' as const,
    suggestion: 'Max Width in px (No value = toggle)',
    functionWithParam: (value: string) => impl.maxDimension({ value: value, type: 'max', direction: 'width', null: false }),
    functionWithoutParam: () => impl.maxDimension({ type: 'max', direction: 'width', null: true }),
    specialConditions: ['IsInAutoLayout', 'IsAutoLayout'],
    bindingSupport: {
      variables: ['FLOAT'],
      libraryStyles: true
    }
  },
  MinHeight: {
    type: "optionalValueCommand",
    alias: ['minh'],
    valueFormat: 'number' as const,
    suggestion: 'Min Height in px (No value = toggle)',
    functionWithParam: (value: string) => impl.maxDimension({ value: value, type: 'min', direction: 'height', null: false }),
    functionWithoutParam: () => impl.maxDimension({ type: 'min', direction: 'height', null: true }),
    specialConditions: ['IsInAutoLayout', 'IsAutoLayout'],
    bindingSupport: {
      variables: ['FLOAT'],
      libraryStyles: true
    }
  },
  MinWidth: {
    type: "optionalValueCommand",
    alias: ['minw'],
    valueFormat: 'number' as const,
    suggestion: 'Min Width in px (No value = toggle)',
    functionWithParam: (value: string) => impl.maxDimension({ value: value, type: 'min', direction: 'width', null: false }),
    functionWithoutParam: () => impl.maxDimension({ type: 'min', direction: 'width', null: true }),
    specialConditions: ['IsInAutoLayout', 'IsAutoLayout'],
    bindingSupport: {
      variables: ['FLOAT'],
      libraryStyles: true
    }
  },
  RemoveEffect: {
    type: "commandWithoutValue",
    alias: ['re'],
    suggestion: 'Remove Effect',
    functionWithoutParam: () => impl.removeEffect()
  },
  ExportSVG: {
    type: "commandWithoutValue",
    alias: ['svg', 'exportsvg'],
    suggestion: 'Export as SVG',
    functionWithoutParam: () => impl.exportAs({ format: 'SVG', constraintType: 'SCALE', constraintValue: '1' }),
  },
  ExportPDF: {
    type: "commandWithoutValue",
    alias: ['pdf', 'exportpdf'],
    suggestion: 'Export as PDF',
    functionWithoutParam: () => impl.exportAs({ format: 'PDF', constraintType: 'SCALE', constraintValue: '1' }),
  },
  ExportPNG: {
    type: "optionalValueCommand",
    alias: ['png', 'exportpng'],
    valueFormat: 'number' as const,
    suggestion: 'Opt: Scale (e.g. png2 = 2x)',
    functionWithParam: (value: string) => impl.exportAs({ format: 'PNG', constraintType: 'SCALE', constraintValue: value }),
    functionWithoutParam: () => impl.exportAs({ format: 'PNG', constraintType: 'SCALE', constraintValue: '1' }),
  },
  ExportJPG: {
    type: "optionalValueCommand",
    alias: ['jpg', 'jpeg', 'exportjpg'],
    valueFormat: 'number' as const,
    suggestion: 'Opt: Scale (e.g. jpg2 = 2x)',
    functionWithParam: (value: string) => impl.exportAs({ format: 'JPG', constraintType: 'SCALE', constraintValue: value }),
    functionWithoutParam: () => impl.exportAs({ format: 'JPG', constraintType: 'SCALE', constraintValue: '1' }),
  },
  ExportPNGWidth: {
    type: "commandWithValue",
    alias: ['pngw'],
    valueFormat: 'number' as const,
    suggestion: 'Export Width in px',
    functionWithParam: (value: string) => impl.exportAs({ format: 'PNG', constraintType: 'WIDTH', constraintValue: value }),
  },
  ExportJPGWidth: {
    type: "commandWithValue",
    alias: ['jpgw'],
    valueFormat: 'number' as const,
    suggestion: 'Export Width in px',
    functionWithParam: (value: string) => impl.exportAs({ format: 'JPG', constraintType: 'WIDTH', constraintValue: value }),
  },
  ExportPNGHeight: {
    type: "commandWithValue",
    alias: ['pngh'],
    valueFormat: 'number' as const,
    suggestion: 'Export Height in px',
    functionWithParam: (value: string) => impl.exportAs({ format: 'PNG', constraintType: 'HEIGHT', constraintValue: value }),
  },
  ExportJPGHeight: {
    type: "commandWithValue",
    alias: ['jpgh'],
    valueFormat: 'number' as const,
    suggestion: 'Export Height in px',
    functionWithParam: (value: string) => impl.exportAs({ format: 'JPG', constraintType: 'HEIGHT', constraintValue: value }),
  },
  // Horizontal Constraints
  ConstraintLeft: {
    type: "commandWithoutValue",
    alias: ['cl'],
    suggestion: 'Set horizontal constraint to left',
    functionWithoutParam: () => impl.setConstraints('HORIZONTAL', 'MIN'),
    specialConditions: ['IsNotInAutoLayout'],
    selectionPredicate: selection => selection.every(supportsConstraints),
  },
  ConstraintCenterHorizontal: {
    type: "commandWithoutValue",
    alias: ['cch'],
    suggestion: 'Set horizontal constraint to center',
    functionWithoutParam: () => impl.setConstraints('HORIZONTAL', 'CENTER'),
    specialConditions: ['IsNotInAutoLayout'],
    selectionPredicate: selection => selection.every(supportsConstraints),
  },
  ConstraintRight: {
    type: "commandWithoutValue",
    alias: ['cr'],
    suggestion: 'Set horizontal constraint to right',
    functionWithoutParam: () => impl.setConstraints('HORIZONTAL', 'MAX'),
    specialConditions: ['IsNotInAutoLayout'],
    selectionPredicate: selection => selection.every(supportsConstraints),
  },
  ConstraintLeftAndRight: {
    type: "commandWithoutValue",
    alias: ['clr'],
    suggestion: 'Set horizontal constraint to left + right',
    functionWithoutParam: () => impl.setConstraints('HORIZONTAL', 'STRETCH'),
    specialConditions: ['IsNotInAutoLayout'],
    selectionPredicate: selection => selection.every(supportsConstraints),
  },
  ConstraintScaleHorizontal: {
    type: "commandWithoutValue",
    alias: ['csh'],
    suggestion: 'Set horizontal constraint to scale',
    functionWithoutParam: () => impl.setConstraints('HORIZONTAL', 'SCALE'),
    specialConditions: ['IsNotInAutoLayout'],
    selectionPredicate: selection => selection.every(supportsConstraints),
  },
  // Vertical Constraints
  ConstraintTop: {
    type: "commandWithoutValue",
    alias: ['ct'],
    suggestion: 'Set vertical constraint to top',
    functionWithoutParam: () => impl.setConstraints('VERTICAL', 'MIN'),
    specialConditions: ['IsNotInAutoLayout'],
    selectionPredicate: selection => selection.every(supportsConstraints),
  },
  ConstraintCenterVertical: {
    type: "commandWithoutValue",
    alias: ['ccv'],
    suggestion: 'Set vertical constraint to center',
    functionWithoutParam: () => impl.setConstraints('VERTICAL', 'CENTER'),
    specialConditions: ['IsNotInAutoLayout'],
    selectionPredicate: selection => selection.every(supportsConstraints),
  },
  ConstraintBottom: {
    type: "commandWithoutValue",
    alias: ['cb'],
    suggestion: 'Set vertical constraint to bottom',
    functionWithoutParam: () => impl.setConstraints('VERTICAL', 'MAX'),
    specialConditions: ['IsNotInAutoLayout'],
    selectionPredicate: selection => selection.every(supportsConstraints),
  },
  ConstraintTopAndBottom: {
    type: "commandWithoutValue",
    alias: ['ctb'],
    suggestion: 'Set vertical constraint to top + bottom',
    functionWithoutParam: () => impl.setConstraints('VERTICAL', 'STRETCH'),
    specialConditions: ['IsNotInAutoLayout'],
    selectionPredicate: selection => selection.every(supportsConstraints),
  },
  ConstraintScaleVertical: {
    type: "commandWithoutValue",
    alias: ['csv'],
    suggestion: 'Set vertical constraint to scale',
    functionWithoutParam: () => impl.setConstraints('VERTICAL', 'SCALE'),
    specialConditions: ['IsNotInAutoLayout'],
    selectionPredicate: selection => selection.every(supportsConstraints),
  },
  CornerSmoothing: {
    type: "commandWithValue",
    alias: ['csm'],
    valueFormat: "number",
    suggestion: "Corner smoothing (0-100)",
    functionWithParam: (value: string) => impl.setCornerSmoothing(value),
  },
  CornerSmoothingIOS: {
    type: "commandWithoutValue",
    alias: ['csi'],
    suggestion: "Corner Smoothing (iOS)",
    functionWithoutParam: () => impl.setCornerSmoothing("60"),
  },
  AlignTop: {
    type: "commandWithoutValue",
    alias: ['at'],
    suggestion: "Align item(s) to top",
    functionWithoutParam: () => impl.alignNodes('TOP'),
    selectionPredicate: supportsFreeLayoutAlignment,
  },
  AlignBottom: {
    type: "commandWithoutValue",
    alias: ['ab'],
    suggestion: "Align item(s) to bottom",
    functionWithoutParam: () => impl.alignNodes('BOTTOM'),
    selectionPredicate: supportsFreeLayoutAlignment,
  },
  AlignLeft: {
    type: "commandWithoutValue",
    alias: ['al'],
    suggestion: "Align item(s) to left",
    functionWithoutParam: () => impl.alignNodes('LEFT'),
    selectionPredicate: supportsFreeLayoutAlignment,
  },
  AlignRight: {
    type: "commandWithoutValue",
    alias: ['ar'],
    suggestion: "Align item(s) to right",
    functionWithoutParam: () => impl.alignNodes('RIGHT'),
    selectionPredicate: supportsFreeLayoutAlignment,
  },
  AlignVerticalCenter: {
    type: "commandWithoutValue",
    alias: ['avc'],
    suggestion: "Align item(s) to vertical center",
    functionWithoutParam: () => impl.alignNodes('VERTICAL_CENTER'),
  },
  AlignHorizontalCenter: {
    type: "commandWithoutValue",
    alias: ['ahc'],
    suggestion: "Align item(s) to horizontal center",
    functionWithoutParam: () => impl.alignNodes('HORIZONTAL_CENTER'),
  },
  AlignTopLeftToParent: {
    type: "commandWithoutValue",
    alias: ['atlp', 'altp'],
    suggestion: "Align to parent's top left",
    functionWithoutParam: () => impl.smartAlign('TOP_LEFT', 'PARENT'),
    selectionPredicate: selection => selection.every(canAlignToParent),
  },
  AlignTopCenterToParent: {
    type: "commandWithoutValue",
    alias: ['atcp', 'actp'],
    suggestion: "Align to parent's top center",
    functionWithoutParam: () => impl.smartAlign('TOP_CENTER', 'PARENT'),
    selectionPredicate: selection => selection.every(canAlignToParent),
  },
  AlignTopRightToParent: {
    type: "commandWithoutValue",
    alias: ['atrp', 'artp'],
    suggestion: "Align to parent's top right",
    functionWithoutParam: () => impl.smartAlign('TOP_RIGHT', 'PARENT'),
    selectionPredicate: selection => selection.every(canAlignToParent),
  },
  AlignCenterLeftToParent: {
    type: "commandWithoutValue",
    alias: ['aclp', 'alcp'],
    suggestion: "Align to parent's center left",
    functionWithoutParam: () => impl.smartAlign('CENTER_LEFT', 'PARENT'),
    selectionPredicate: selection => selection.every(canAlignToParent),
  },
  AlignCenterCenterToParent: {
    type: "commandWithoutValue",
    alias: ['accp'],
    suggestion: "Align to parent's center",
    functionWithoutParam: () => impl.smartAlign('CENTER', 'PARENT'),
    selectionPredicate: selection => selection.every(canAlignToParent),
  },
  AlignCenterRightToParent: {
    type: "commandWithoutValue",
    alias: ['acrp', 'arcp'],
    suggestion: "Align to parent's center right",
    functionWithoutParam: () => impl.smartAlign('CENTER_RIGHT', 'PARENT'),
    selectionPredicate: selection => selection.every(canAlignToParent),
  },
  AlignBottomLeftToParent: {
    type: "commandWithoutValue",
    alias: ['ablp', 'albp'],
    suggestion: "Align to parent's bottom left",
    functionWithoutParam: () => impl.smartAlign('BOTTOM_LEFT', 'PARENT'),
    selectionPredicate: selection => selection.every(canAlignToParent),
  },
  AlignBottomCenterToParent: {
    type: "commandWithoutValue",
    alias: ['abcp', 'acbp'],
    suggestion: "Align to parent's bottom center",
    functionWithoutParam: () => impl.smartAlign('BOTTOM_CENTER', 'PARENT'),
    selectionPredicate: selection => selection.every(canAlignToParent),
  },
  AlignBottomRightToParent: {
    type: "commandWithoutValue",
    alias: ['abrp', 'arbp'],
    suggestion: "Align to parent's bottom right",
    functionWithoutParam: () => impl.smartAlign('BOTTOM_RIGHT', 'PARENT'),
    selectionPredicate: selection => selection.every(canAlignToParent),
  },
  BringToFront: {
    type: "commandWithoutValue",
    alias: ['zf'],
    suggestion: 'Bring to Front',
    functionWithoutParam: () => impl.reorderLayer('FRONT'),
  },
  BringForward: {
    type: "commandWithoutValue",
    alias: ['zu'],
    suggestion: 'Bring Forward',
    functionWithoutParam: () => impl.reorderLayer('FORWARD'),
  },
  SendBackward: {
    type: "commandWithoutValue",
    alias: ['zd'],
    suggestion: 'Send Backward',
    functionWithoutParam: () => impl.reorderLayer('BACKWARD'),
  },
  SendToBack: {
    type: "commandWithoutValue",
    alias: ['zb'],
    suggestion: 'Send to Back',
    functionWithoutParam: () => impl.reorderLayer('BACK'),
  },
  SwapFillStroke: {
    type: "commandWithoutValue",
    alias: ['sfs'],
    suggestion: 'Swap Fill & Stroke colors',
    functionWithoutParam: () => impl.swapFillStroke(),
    supportedNodes: [...NODE_GROUPS.FILLS_AND_STROKES],
  },
  PublishLibrary: {
    type: "commandWithoutValue",
    alias: ['plib'],
    suggestion: 'Publish current file as Library',
    functionWithoutParam: () => impl.publishLibrary(),
  },
  ToggleLibrary: {
    type: "optionalValueCommand",
    alias: ['tlib'],
    valueFormat: 'string' as const,
    suggestion: '?search for libraries to toggle',
    functionWithoutParam: async () => {
      const suggestions = await impl.getLibrarySuggestions();
      if (suggestions.length === 0) {
        notify('⚠️ No libraries found. Use plib to publish a library first.');
      } else {
        notify(`📚 Available Libraries: \n${suggestions.join('\n')}\n\nUse: tlib ? to search`);
      }
    },
    functionWithParam: (value: string) => impl.toggleLibraryByName(value),
    bindingSupport: {
      libraries: true
    }
  },
  RemoveLibrary: {
    type: "optionalValueCommand",
    alias: ['rlib'],
    valueFormat: 'string' as const,
    suggestion: '?search for libraries to delete',
    functionWithoutParam: () => impl.removeLibrary(),
    functionWithParam: (value: string) => impl.removeLibraryByName(value),
    bindingSupport: {
      libraries: true
    }
  },
  MonitorStorage: {
    type: "commandWithoutValue",
    alias: ['ms'],
    suggestion: 'Monitor Plugin Storage',
    functionWithoutParam: () => impl.monitorStorage(),
  },
  History: {
    type: "commandWithoutValue",
    alias: ['z', 'hi'],
    suggestion: 'Replay a recent command sequence',
    functionWithoutParam: () => notify('Pick a recent sequence from the suggestions'),
  },
} satisfies Record<string, CommandWithValue | CommandWithoutValue | OptionalValueCommand>;

// Create CommandName type from COMMAND_DEFINITIONS keys
export type CommandName = keyof typeof COMMAND_DEFINITIONS;

// Create an array from COMMAND_DEFINITIONS
export const COMMANDS: Array<import('./types').Command & { name: CommandName }> = (Object.keys(COMMAND_DEFINITIONS) as CommandName[])
  .map((name) => {
    const def = COMMAND_DEFINITIONS[name];
    return { name, ...def };
  });
