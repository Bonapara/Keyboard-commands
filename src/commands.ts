// ==================================
// Command Definitions
// ==================================

import type { CommandWithValue, CommandWithoutValue, OptionalValueCommand } from './types';
import * as impl from './implementations';
import { notify } from './utils';

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
    suggestion: 'Reset to master component 🔄',
    functionWithoutParam: () => impl.resetInstance(),
    supportedNodes: [...NODE_GROUPS.INSTANCE_ONLY],
  },
  DetachInstance: {
    type: "commandWithoutValue",
    alias: ['di'],
    suggestion: 'Detach from master component ⛓️‍💥',
    functionWithoutParam: () => impl.detachInstance(),
    supportedNodes: [...NODE_GROUPS.INSTANCE_ONLY],
  },
  SelectSimilar: {
    type: "commandWithoutValue",
    alias: ['ss'],
    suggestion: 'Select all similar instances 👯',
    functionWithoutParam: () => impl.selectSimilar(),
  },
  PushOverrides: {
    type: "commandWithoutValue",
    alias: ['po'],
    suggestion: 'Push overrides to main component ⬆️',
    functionWithoutParam: () => impl.pushOverridesToMain(),
    supportedNodes: [...NODE_GROUPS.INSTANCE_ONLY],
  },
  CreateComponent: {
    type: "commandWithoutValue",
    alias: ['cc'],
    suggestion: 'Create component from selection 📦',
    functionWithoutParam: () => impl.createComponent(),
  },
  AddVariant: {
    type: "commandWithoutValue",
    alias: ['av'],
    suggestion: 'Add new variant (clone selected) ➕',
    functionWithoutParam: () => impl.addVariant(),
    supportedNodes: [...NODE_GROUPS.COMPONENT_VARIANT_ONLY],
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
  Delete: {
    type: "commandWithoutValue",
    alias: ['de'],
    suggestion: '🗑️',
    functionWithoutParam: () => impl.deleteSelection(),
    supportedNodes: [...NODE_GROUPS.DELETABLE],
  },
  AutoLayout: {
    type: "commandWithoutValue",
    alias: ['alh'],
    suggestion: 'Create Horizontal Auto-Layout →',
    functionWithoutParam: () => impl.createAutoLayout('HORIZONTAL'),
  },
  AutoLayoutVertical: {
    type: "commandWithoutValue",
    alias: ['alv'],
    suggestion: "Create Vertical Auto-Layout ↓",
    functionWithoutParam: () => impl.createAutoLayout('VERTICAL'),
  },
  RemoveAutoLayout: {
    type: "commandWithoutValue",
    alias: ['ra'],
    suggestion: '🗑️📐',
    functionWithoutParam: () => impl.setLayout('NONE'),
    supportedNodes: [...NODE_GROUPS.FRAME_LIKE],
  },
  FlipHorizontal: {
    type: "commandWithoutValue",
    alias: ['fh'],
    suggestion: '↔',
    functionWithoutParam: () => impl.flip('horizontal')
  },
  FlipVertical: {
    type: "commandWithoutValue",
    alias: ['fv'],
    suggestion: '↕',
    functionWithoutParam: () => impl.flip('vertical')
  },
  Group: {
    type: "commandWithoutValue",
    alias: ['gr'],
    suggestion: '👥',
    functionWithoutParam: () => impl.grouping('group')
  },
  Ungroup: {
    type: "commandWithoutValue",
    alias: ['ugr'],
    suggestion: '👤',
    functionWithoutParam: () => impl.grouping('ungroup')
  },
  VerticalFill: {
    type: "commandWithoutValue",
    alias: ['vf'],
    suggestion: "↕",
    functionWithoutParam: () => impl.layoutSizing('VERTICAL', 'FILL'),
    specialConditions: ['IsInAutoLayout', 'IsAutoLayout'],
  },
  VerticalHug: {
    type: "commandWithoutValue",
    alias: ['vh'],
    suggestion: "↓↑",
    functionWithoutParam: () => impl.layoutSizing('VERTICAL', 'HUG'),
    specialConditions: ['IsInAutoLayout', 'IsAutoLayout'],
  },
  HorizontalFill: {
    type: "commandWithoutValue",
    alias: ['hf'],
    suggestion: "↔",
    functionWithoutParam: () => impl.layoutSizing('HORIZONTAL', 'FILL'),
    specialConditions: ['IsInAutoLayout', 'IsAutoLayout'],
  },
  HorizontalHug: {
    type: "commandWithoutValue",
    alias: ['hh'],
    suggestion: "→←",
    functionWithoutParam: () => impl.layoutSizing('HORIZONTAL', 'HUG'),
    specialConditions: ['IsInAutoLayout', 'IsAutoLayout'],
  },
  Gap: {
    type: "optionalValueCommand",
    alias: ['g'],
    valueFormat: "number",
    suggestion: "Gap in px (No value = Auto)",
    functionWithParam: (value: string) => impl.setPrimaryGap(value),
    functionWithoutParam: () => impl.setPrimaryGap('AUTO'),
    specialConditions: ['IsAutoLayout'],
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
    suggestion: "Vertical Gap in px (No value = Auto)",
    functionWithParam: (value: string) => impl.setCounterGap(value),
    functionWithoutParam: () => impl.setCounterGap('AUTO'),
    specialConditions: ['IsAutoLayoutWrap'],
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
    suggestion: "→",
    functionWithoutParam: () => impl.setLayout('HORIZONTAL'),
    supportedNodes: [...NODE_GROUPS.FRAME_LIKE],
    specialConditions: ['IsAutoLayout'],
  },
  LayoutVertical: {
    type: "commandWithoutValue",
    alias: ['lv'],
    suggestion: "↓",
    functionWithoutParam: () => impl.setLayout('VERTICAL'),
    supportedNodes: [...NODE_GROUPS.FRAME_LIKE],
    specialConditions: ['IsAutoLayout'],
  },
  LayoutWrap: {
    type: "commandWithoutValue",
    alias: ['lw'],
    suggestion: "↩️",
    functionWithoutParam: () => impl.setLayout('WRAP'),
    supportedNodes: [...NODE_GROUPS.FRAME_LIKE],
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
    type: "commandWithValue",
    alias: ['p'],
    valueFormat: "number",
    suggestion: "Enter padding for all sides",
    functionWithParam: (value: string) => impl.setPadding({ paddingLeft: value, paddingRight: value, paddingTop: value, paddingBottom: value }),
    supportedNodes: [...NODE_GROUPS.FRAME_LIKE],
  },
  PaddingHorizontal: {
    type: "commandWithValue",
    alias: ['ph'],
    valueFormat: "number",
    suggestion: "Enter horizontal padding",
    functionWithParam: (value: string) => impl.setPadding({ paddingLeft: value, paddingRight: value }),
    supportedNodes: [...NODE_GROUPS.FRAME_LIKE],
  },
  PaddingVertical: {
    type: "commandWithValue",
    alias: ['pv'],
    valueFormat: "number",
    suggestion: "Enter vertical padding",
    functionWithParam: (value: string) => impl.setPadding({ paddingTop: value, paddingBottom: value }),
    supportedNodes: [...NODE_GROUPS.FRAME_LIKE],
  },
  PaddingLeft: {
    type: "commandWithValue",
    alias: ['pl'],
    valueFormat: "number",
    suggestion: "Enter left padding",
    functionWithParam: (value: string) => impl.setPadding({ paddingLeft: value }),
    supportedNodes: [...NODE_GROUPS.FRAME_LIKE],
  },
  PaddingTop: {
    type: "commandWithValue",
    alias: ['pt'],
    valueFormat: "number",
    suggestion: "Enter top padding",
    functionWithParam: (value: string) => impl.setPadding({ paddingTop: value }),
    supportedNodes: [...NODE_GROUPS.FRAME_LIKE],
  },
  PaddingRight: {
    type: "commandWithValue",
    alias: ['pr'],
    valueFormat: "number",
    suggestion: "Enter right padding",
    functionWithParam: (value: string) => impl.setPadding({ paddingRight: value }),
    supportedNodes: [...NODE_GROUPS.FRAME_LIKE],
  },
  PaddingBottom: {
    type: "commandWithValue",
    alias: ['pb'],
    valueFormat: "number",
    suggestion: "Enter bottom padding",
    functionWithParam: (value: string) => impl.setPadding({ paddingBottom: value }),
    supportedNodes: [...NODE_GROUPS.FRAME_LIKE],
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
  Rotate: {
    type: "optionalValueCommand",
    alias: ['ro'],
    valueFormat: 'number' as const,
    suggestion: 'Enter rotation angle in degrees',
    functionWithoutParam: () => impl.rotate(0),
    functionWithParam: (value: string) => { impl.rotate(parseInt(value)); },
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
    type: "commandWithValue",
    alias: ['rtl'],
    valueFormat: 'number' as const,
    suggestion: 'Top left radius',
    functionWithParam: (value: string) => impl.setRadius({ topLeftRadius: value }),
    supportedNodes: [...NODE_GROUPS.CORNER_RADIUS],
  },
  RadiusTopRight: {
    type: "commandWithValue",
    alias: ['rtr'],
    valueFormat: 'number' as const,
    suggestion: 'Top right radius',
    functionWithParam: (value: string) => impl.setRadius({ topRightRadius: value }),
    supportedNodes: [...NODE_GROUPS.CORNER_RADIUS],
  },
  RadiusBottomRight: {
    type: "commandWithValue",
    alias: ['rbr'],
    valueFormat: 'number' as const,
    suggestion: 'Bottom right radius',
    functionWithParam: (value: string) => impl.setRadius({ bottomRightRadius: value }),
    supportedNodes: [...NODE_GROUPS.CORNER_RADIUS],
  },
  RadiusBottomLeft: {
    type: "commandWithValue",
    alias: ['rbl'],
    valueFormat: 'number' as const,
    suggestion: 'Bottom left radius',
    functionWithParam: (value: string) => impl.setRadius({ bottomLeftRadius: value }),
    supportedNodes: [...NODE_GROUPS.CORNER_RADIUS],
  },
  RadiusAll: {
    type: "commandWithValue",
    alias: ['r'],
    valueFormat: 'number' as const,
    suggestion: 'All corners radius',
    functionWithParam: (value: string) => impl.setRadius({
      topLeftRadius: value,
      topRightRadius: value,
      bottomRightRadius: value,
      bottomLeftRadius: value
    }),
    supportedNodes: [...NODE_GROUPS.CORNER_RADIUS],
  },
  RadiusLeft: {
    type: "commandWithValue",
    alias: ['rl'],
    valueFormat: 'number' as const,
    suggestion: 'Left side radius',
    functionWithParam: (value: string) => impl.setRadius({
      topLeftRadius: value,
      bottomLeftRadius: value
    }),
    supportedNodes: [...NODE_GROUPS.CORNER_RADIUS],
  },
  RadiusTop: {
    type: "commandWithValue",
    alias: ['rt'],
    valueFormat: 'number' as const,
    suggestion: 'Top side radius',
    functionWithParam: (value: string) => impl.setRadius({
      topLeftRadius: value,
      topRightRadius: value
    }),
    supportedNodes: [...NODE_GROUPS.CORNER_RADIUS],
  },
  RadiusRight: {
    type: "commandWithValue",
    alias: ['rr'],
    valueFormat: 'number' as const,
    suggestion: 'Right side radius',
    functionWithParam: (value: string) => impl.setRadius({
      topRightRadius: value,
      bottomRightRadius: value
    }),
    supportedNodes: [...NODE_GROUPS.CORNER_RADIUS],
  },
  RadiusBottom: {
    type: "commandWithValue",
    alias: ['rb'],
    valueFormat: 'number' as const,
    suggestion: 'Bottom side radius',
    functionWithParam: (value: string) => impl.setRadius({
      bottomLeftRadius: value,
      bottomRightRadius: value
    }),
    supportedNodes: [...NODE_GROUPS.CORNER_RADIUS],
  },
  ClipContent: {
    type: "commandWithoutValue",
    alias: ['c'],
    suggestion: ' ☑️ Toggle Clip Content',
    functionWithoutParam: () => impl.clipContent(),
    supportedNodes: [...NODE_GROUPS.FRAME_LIKE],
  },
  Visibility: {
    type: "commandWithoutValue",
    alias: ['v'],
    suggestion: 'Toggle Show/Hide 👁️',
    functionWithoutParam: () => impl.toggleVisibility()
  },
  Opacity: {
    type: "optionalValueCommand",
    alias: ['o'],
    valueFormat: 'number' as const,
    suggestion: 'In % (No value = toggle)',
    functionWithParam: (value: string) => impl.setOpacity(value),
    functionWithoutParam: () => impl.toggleOpacity(),
  },
  Duplicate: {
    type: "commandWithoutValue",
    alias: ['d'],
    suggestion: '✂️ Duplicate Element',
    functionWithoutParam: () => impl.duplicate()
  },
  Stroke: {
    type: "optionalValueCommand",
    alias: ['st', 'b'],
    valueFormat: 'number' as const,
    suggestion: 'in px (No value = toggle) ? → styles/variables',
    functionWithParam: (value: string) => impl.setBorder('all', value),
    functionWithoutParam: () => impl.toggleBorder('all'),
  },
  StrokeLeft: {
    type: "optionalValueCommand",
    alias: ['stl', 'bl'],
    valueFormat: 'number' as const,
    suggestion: 'border in px (No value = toggle)',
    functionWithParam: (value: string) => impl.setBorder('left', value),
    functionWithoutParam: () => impl.toggleBorder('left'),
  },
  StrokeRight: {
    type: "optionalValueCommand",
    alias: ['str', 'br'],
    valueFormat: 'number' as const,
    suggestion: 'border in px (No value = toggle)',
    functionWithParam: (value: string) => impl.setBorder('right', value),
    functionWithoutParam: () => impl.toggleBorder('right'),
  },
  StrokeTop: {
    type: "optionalValueCommand",
    alias: ['stt', 'bt'],
    valueFormat: 'number' as const,
    suggestion: 'border in px (No value = toggle)',
    functionWithParam: (value: string) => impl.setBorder('top', value),
    functionWithoutParam: () => impl.toggleBorder('top'),
  },
  StrokeBottom: {
    type: "optionalValueCommand",
    alias: ['stb', 'bb'],
    valueFormat: 'number' as const,
    suggestion: 'border in px (No value = toggle)',
    functionWithParam: (value: string) => impl.setBorder('bottom', value),
    functionWithoutParam: () => impl.toggleBorder('bottom'),
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
    type: "commandWithValue",
    alias: ['e'],
    valueFormat: 'string' as const,
    suggestion: 'Apply effect style',
    functionWithParam: (value: string) => impl.setEffect(value),
    bindingSupport: {
      styles: ['EFFECT'],
      libraryStyles: true
    }
  },
  StrokeAlignCenter: {
    type: "commandWithoutValue",
    alias: ['sac', 'scc'],
    suggestion: '◌',
    functionWithoutParam: () => impl.setBorderAlign('CENTER')
  },
  StrokeAlignInside: {
    type: "commandWithoutValue",
    alias: ['sti', 'bi'],
    suggestion: '⊖',
    functionWithoutParam: () => impl.setBorderAlign('INSIDE')
  },
  StrokeAlignOutside: {
    type: "commandWithoutValue",
    alias: ['sto', 'bo'],
    suggestion: '◯',
    functionWithoutParam: () => impl.setBorderAlign('OUTSIDE')
  },
  SelectionColorsSwapping: {
    type: 'commandWithValue',
    alias: ['scs', 'cs'],
    valueFormat: 'string' as const,
    suggestion: '?search colors in selection',
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
    suggestion: 'Toggle🌗',
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
    suggestion: 'Detach Text Style ⛓️‍💥',
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
    type: "commandWithValue",
    alias: ['ls'],
    valueFormat: 'number' as const,
    suggestion: 'Enter letter spacing in px',
    functionWithParam: async (value: string) => await impl.setLetterSpacing(value),
    supportedNodes: [...NODE_GROUPS.TEXT_ONLY],
    specialConditions: ['NoTextStyleApplied'],
  },

  // Line Height Command
  LineHeight: {
    type: "optionalValueCommand",
    alias: ['lh'],
    valueFormat: 'number' as const,
    suggestion: 'In px or % (No value = Auto)',
    functionWithParam: async (value: string) => await impl.setLineHeight(value),
    functionWithoutParam: async () => await impl.setLineHeight('AUTO'),
    supportedNodes: [...NODE_GROUPS.TEXT_ONLY],
    specialConditions: ['NoTextStyleApplied'],
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
    suggestion: 'Remove Text Decoration 🗑️',
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
    suggestion: 'Remove List Formatting 🗑️',
    functionWithoutParam: async () => await impl.setTextListOptions('NONE'),
    supportedNodes: [...NODE_GROUPS.TEXT_ONLY],
  },

  AlignTopLeft: {
    type: "optionalValueCommand",
    alias: ['atl', 'alt'],
    valueFormat: 'string' as const,
    suggestion: 'Align Top Left ↖',
    functionWithoutParam: () => impl.smartAlign('TOP_LEFT'),
    functionWithParam: (val: string) => impl.smartAlign('TOP_LEFT', val.startsWith('p') ? 'PARENT' : 'AUTO'),
    specialConditions: ['IsAutoLayout'],
  },
  AlignTopCenter: {
    type: "optionalValueCommand",
    alias: ['atc', 'act'],
    valueFormat: 'string' as const,
    suggestion: 'Align Top Center ↑',
    functionWithoutParam: () => impl.smartAlign('TOP_CENTER'),
    functionWithParam: (val: string) => impl.smartAlign('TOP_CENTER', val.startsWith('p') ? 'PARENT' : 'AUTO'),
    specialConditions: ['IsAutoLayout'],
  },
  AlignTopRight: {
    type: "optionalValueCommand",
    alias: ['atr', 'art'],
    valueFormat: 'string' as const,
    suggestion: 'Align Top Right ↗',
    functionWithoutParam: () => impl.smartAlign('TOP_RIGHT'),
    functionWithParam: (val: string) => impl.smartAlign('TOP_RIGHT', val.startsWith('p') ? 'PARENT' : 'AUTO'),
    specialConditions: ['IsAutoLayout'],
  },
  AlignCenterLeft: {
    type: "optionalValueCommand",
    alias: ['acl', 'alc'],
    valueFormat: 'string' as const,
    suggestion: 'Align Center Left ←',
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
    suggestion: 'Align Center Right →',
    functionWithoutParam: () => impl.smartAlign('CENTER_RIGHT'),
    functionWithParam: (val: string) => impl.smartAlign('CENTER_RIGHT', val.startsWith('p') ? 'PARENT' : 'AUTO'),
    specialConditions: ['IsAutoLayout'],
  },
  AlignBottomLeft: {
    type: "optionalValueCommand",
    alias: ['abl', 'alb'],
    valueFormat: 'string' as const,
    suggestion: 'Align Bottom Left ↙',
    functionWithoutParam: () => impl.smartAlign('BOTTOM_LEFT'),
    functionWithParam: (val: string) => impl.smartAlign('BOTTOM_LEFT', val.startsWith('p') ? 'PARENT' : 'AUTO'),
    specialConditions: ['IsAutoLayout'],
  },
  AlignBottomRight: {
    type: "optionalValueCommand",
    alias: ['abr', 'arb'],
    valueFormat: 'string' as const,
    suggestion: 'Align Bottom Right ↘',
    functionWithoutParam: () => impl.smartAlign('BOTTOM_RIGHT'),
    functionWithParam: (val: string) => impl.smartAlign('BOTTOM_RIGHT', val.startsWith('p') ? 'PARENT' : 'AUTO'),
    specialConditions: ['IsAutoLayout'],
  },
  AlignBottomCenter: {
    type: "optionalValueCommand",
    alias: ['abc', 'acb'],
    valueFormat: 'string' as const,
    suggestion: 'Align Bottom Center ↓',
    functionWithoutParam: () => impl.smartAlign('BOTTOM_CENTER'),
    functionWithParam: (val: string) => impl.smartAlign('BOTTOM_CENTER', val.startsWith('p') ? 'PARENT' : 'AUTO'),
    specialConditions: ['IsAutoLayout'],
  },
  MaxHeight: {
    type: "optionalValueCommand",
    alias: ['maxh'],
    valueFormat: 'number' as const,
    suggestion: '↕ in px (No value = toggle)',
    functionWithParam: (value: string) => impl.maxDimension({ value: value, type: 'max', direction: 'height', null: false }),
    functionWithoutParam: () => impl.maxDimension({ type: 'max', direction: 'height', null: true }),
    specialConditions: ['IsInAutoLayout', 'IsAutoLayout'],
  },
  MaxWidth: {
    type: "optionalValueCommand",
    alias: ['maxw'],
    valueFormat: 'number' as const,
    suggestion: '↔ in px (No value = toggle)',
    functionWithParam: (value: string) => impl.maxDimension({ value: value, type: 'max', direction: 'width', null: false }),
    functionWithoutParam: () => impl.maxDimension({ type: 'max', direction: 'width', null: true }),
    specialConditions: ['IsInAutoLayout', 'IsAutoLayout'],
  },
  MinHeight: {
    type: "optionalValueCommand",
    alias: ['minh'],
    valueFormat: 'number' as const,
    suggestion: '↓↑ in px (No value = toggle)',
    functionWithParam: (value: string) => impl.maxDimension({ value: value, type: 'min', direction: 'height', null: false }),
    functionWithoutParam: () => impl.maxDimension({ type: 'min', direction: 'height', null: true }),
    specialConditions: ['IsInAutoLayout', 'IsAutoLayout'],
  },
  MinWidth: {
    type: "optionalValueCommand",
    alias: ['minw'],
    valueFormat: 'number' as const,
    suggestion: '→← in px (No value = toggle)',
    functionWithParam: (value: string) => impl.maxDimension({ value: value, type: 'min', direction: 'width', null: false }),
    functionWithoutParam: () => impl.maxDimension({ type: 'min', direction: 'width', null: true }),
    specialConditions: ['IsInAutoLayout', 'IsAutoLayout'],
  },
  RemoveEffect: {
    type: "commandWithoutValue",
    alias: ['re'],
    suggestion: '🗑️✨',
    functionWithoutParam: () => impl.removeEffect()
  },
  ExportSVG: {
    type: "commandWithoutValue",
    alias: ['svg'],
    suggestion: '🎨',
    functionWithoutParam: () => impl.exportAs({ format: 'SVG', constraintType: 'SCALE', constraintValue: '1' }),
  },
  ExportPDF: {
    type: "commandWithoutValue",
    alias: ['pdf'],
    suggestion: '📄',
    functionWithoutParam: () => impl.exportAs({ format: 'PDF', constraintType: 'SCALE', constraintValue: '1' }),
  },
  ExportPNG: {
    type: "optionalValueCommand",
    alias: ['png'],
    valueFormat: 'number' as const,
    suggestion: 'Opt: Scale (e.g. png2 = 2x)',
    functionWithParam: (value: string) => impl.exportAs({ format: 'PNG', constraintType: 'SCALE', constraintValue: value }),
    functionWithoutParam: () => impl.exportAs({ format: 'PNG', constraintType: 'SCALE', constraintValue: '1' }),
  },
  ExportJPG: {
    type: "optionalValueCommand",
    alias: ['jpg'],
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
  },
  ConstraintCenterHorizontal: {
    type: "commandWithoutValue",
    alias: ['cch'],
    suggestion: 'Set horizontal constraint to center',
    functionWithoutParam: () => impl.setConstraints('HORIZONTAL', 'CENTER'),
    specialConditions: ['IsNotInAutoLayout'],
  },
  ConstraintRight: {
    type: "commandWithoutValue",
    alias: ['cr'],
    suggestion: 'Set horizontal constraint to right',
    functionWithoutParam: () => impl.setConstraints('HORIZONTAL', 'MAX'),
    specialConditions: ['IsNotInAutoLayout'],
  },
  ConstraintLeftAndRight: {
    type: "commandWithoutValue",
    alias: ['clr'],
    suggestion: 'Set horizontal constraint to left + right',
    functionWithoutParam: () => impl.setConstraints('HORIZONTAL', 'STRETCH'),
    specialConditions: ['IsNotInAutoLayout'],
  },
  ConstraintScaleHorizontal: {
    type: "commandWithoutValue",
    alias: ['csh'],
    suggestion: 'Set horizontal constraint to scale',
    functionWithoutParam: () => impl.setConstraints('HORIZONTAL', 'SCALE'),
    specialConditions: ['IsNotInAutoLayout'],
  },
  // Vertical Constraints
  ConstraintTop: {
    type: "commandWithoutValue",
    alias: ['ct'],
    suggestion: 'Set vertical constraint to top',
    functionWithoutParam: () => impl.setConstraints('VERTICAL', 'MIN'),
    specialConditions: ['IsNotInAutoLayout'],
  },
  ConstraintCenterVertical: {
    type: "commandWithoutValue",
    alias: ['ccv'],
    suggestion: 'Set vertical constraint to center',
    functionWithoutParam: () => impl.setConstraints('VERTICAL', 'CENTER'),
    specialConditions: ['IsNotInAutoLayout'],
  },
  ConstraintBottom: {
    type: "commandWithoutValue",
    alias: ['cb'],
    suggestion: 'Set vertical constraint to bottom',
    functionWithoutParam: () => impl.setConstraints('VERTICAL', 'MAX'),
    specialConditions: ['IsNotInAutoLayout'],
  },
  ConstraintTopAndBottom: {
    type: "commandWithoutValue",
    alias: ['ctb'],
    suggestion: 'Set vertical constraint to top + bottom',
    functionWithoutParam: () => impl.setConstraints('VERTICAL', 'STRETCH'),
    specialConditions: ['IsNotInAutoLayout'],
  },
  ConstraintScaleVertical: {
    type: "commandWithoutValue",
    alias: ['csv'],
    suggestion: 'Set vertical constraint to scale',
    functionWithoutParam: () => impl.setConstraints('VERTICAL', 'SCALE'),
    specialConditions: ['IsNotInAutoLayout'],
  },
  CornerSmoothing: {
    type: "commandWithValue",
    alias: ['cs'],
    valueFormat: "number",
    suggestion: "Corner smoothing (0-100)",
    functionWithParam: (value: string) => impl.setCornerSmoothing(value),
  },
  CornerSmoothingIOS: {
    type: "commandWithoutValue",
    alias: ['csi'],
    suggestion: "📱 (IOS)",
    functionWithoutParam: () => impl.setCornerSmoothing("60"),
  },
  AlignTop: {
    type: "commandWithoutValue",
    alias: ['at'],
    suggestion: "Align item(s) to top",
    functionWithoutParam: () => impl.alignNodes('TOP'),
    specialConditions: ['IsNotInAutoLayout'],
  },
  AlignBottom: {
    type: "commandWithoutValue",
    alias: ['ab'],
    suggestion: "Align item(s) to bottom",
    functionWithoutParam: () => impl.alignNodes('BOTTOM'),
    specialConditions: ['IsNotInAutoLayout'],
  },
  AlignLeft: {
    type: "commandWithoutValue",
    alias: ['al'],
    suggestion: "Align item(s) to left",
    functionWithoutParam: () => impl.alignNodes('LEFT'),
    specialConditions: ['IsNotInAutoLayout'],
  },
  AlignRight: {
    type: "commandWithoutValue",
    alias: ['ar'],
    suggestion: "Align item(s) to right",
    functionWithoutParam: () => impl.alignNodes('RIGHT'),
    specialConditions: ['IsNotInAutoLayout'],
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
    suggestion: "Align to parent's top left ↖",
    functionWithoutParam: () => impl.smartAlign('TOP_LEFT', 'PARENT'),
  },
  AlignTopCenterToParent: {
    type: "commandWithoutValue",
    alias: ['atcp', 'actp'],
    suggestion: "Align to parent's top center ↑",
    functionWithoutParam: () => impl.smartAlign('TOP_CENTER', 'PARENT'),
  },
  AlignTopRightToParent: {
    type: "commandWithoutValue",
    alias: ['atrp', 'artp'],
    suggestion: "Align to parent's top right ↗",
    functionWithoutParam: () => impl.smartAlign('TOP_RIGHT', 'PARENT'),
  },
  AlignCenterLeftToParent: {
    type: "commandWithoutValue",
    alias: ['aclp', 'alcp'],
    suggestion: "Align to parent's center left ←",
    functionWithoutParam: () => impl.smartAlign('CENTER_LEFT', 'PARENT'),
  },
  AlignCenterCenterToParent: {
    type: "commandWithoutValue",
    alias: ['accp'],
    suggestion: "Align to parent's center",
    functionWithoutParam: () => impl.smartAlign('CENTER', 'PARENT'),
  },
  AlignCenterRightToParent: {
    type: "commandWithoutValue",
    alias: ['acrp', 'arcp'],
    suggestion: "Align to parent's center right →",
    functionWithoutParam: () => impl.smartAlign('CENTER_RIGHT', 'PARENT'),
  },
  AlignBottomLeftToParent: {
    type: "commandWithoutValue",
    alias: ['ablp', 'albp'],
    suggestion: "Align to parent's bottom left ↙",
    functionWithoutParam: () => impl.smartAlign('BOTTOM_LEFT', 'PARENT'),
  },
  AlignBottomCenterToParent: {
    type: "commandWithoutValue",
    alias: ['abcp', 'acbp'],
    suggestion: "Align to parent's bottom center ↓",
    functionWithoutParam: () => impl.smartAlign('BOTTOM_CENTER', 'PARENT'),
  },
  AlignBottomRightToParent: {
    type: "commandWithoutValue",
    alias: ['abrp', 'arbp'],
    suggestion: "Align to parent's bottom right ↘",
    functionWithoutParam: () => impl.smartAlign('BOTTOM_RIGHT', 'PARENT'),
  },
  BringToFront: {
    type: "commandWithoutValue",
    alias: ['zf'],
    suggestion: 'Bring to Front ⬆️',
    functionWithoutParam: () => impl.reorderLayer('FRONT'),
  },
  BringForward: {
    type: "commandWithoutValue",
    alias: ['zu'],
    suggestion: 'Bring Forward ⬆',
    functionWithoutParam: () => impl.reorderLayer('FORWARD'),
  },
  SendBackward: {
    type: "commandWithoutValue",
    alias: ['zd'],
    suggestion: 'Send Backward ⬇',
    functionWithoutParam: () => impl.reorderLayer('BACKWARD'),
  },
  SendToBack: {
    type: "commandWithoutValue",
    alias: ['zb'],
    suggestion: 'Send to Back ⬇️',
    functionWithoutParam: () => impl.reorderLayer('BACK'),
  },
  SwapFillStroke: {
    type: "commandWithoutValue",
    alias: ['sfs'],
    suggestion: 'Swap Fill & Stroke colors ⇄',
    functionWithoutParam: () => impl.swapFillStroke(),
    supportedNodes: [...NODE_GROUPS.FILLS_AND_STROKES],
  },
  PublishLibrary: {
    type: "commandWithoutValue",
    alias: ['plib'],
    suggestion: 'Publish current file as Library 📚',
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
        notify(`📚 Available Libraries:\n${suggestions.join('\n')}\n\nUse: tlib? to search`);
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
    suggestion: 'Monitor Plugin Storage 📊',
    functionWithoutParam: () => impl.monitorStorage(),
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

