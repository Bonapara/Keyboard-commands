// ==========================
// Type Definitions & Globals
// ==========================
type SupportedNodeType = SceneNode['type'];
type SpecialCondition = 'IsAutoLayout' | 'IsInAutoLayout' | 'IsAbsoluteInAutoLayout' | 'IsAutoLayoutWrap' | 'IsVisible' | 'TextStyleApplied' | 'NoTextStyleApplied' | 'IsNotInAutoLayout';

type ValueFormat = 'number' | 'hex';

type CommandWithValue = {
  type: "commandWithValue";
  alias: Array<string>;
  valueFormat: ValueFormat;
  functionWithParam: (value: string) => void;
  suggestion: string;
  supportedNodes?: SupportedNodeType[];
  specialConditions?: SpecialCondition[];
};

type CommandWithoutValue = {
  type: "commandWithoutValue";
  alias: Array<string>;
  functionWithoutParam: () => void;
  suggestion: string;  
  supportedNodes?: SupportedNodeType[];
  specialConditions?: SpecialCondition[];
};

type OptionalValueCommand = {
  type: "optionalValueCommand";
  alias: Array<string>;
  valueFormat?: ValueFormat;
  suggestion: string;
  functionWithoutParam: () => void;
  functionWithParam: (value: string) => void;
  supportedNodes?: SupportedNodeType[];
  specialConditions?: SpecialCondition[];
};

type CommandName = keyof typeof COMMAND_DEFINITIONS;
type Command = {
  name: CommandName,
  type: "commandWithValue" | "commandWithoutValue" | "optionalValueCommand"
} & (CommandWithValue | CommandWithoutValue | OptionalValueCommand);

let originalInput = '';

// ==================================
// Command Definitions (unchanged)
// ==================================
const COMMAND_DEFINITIONS = {
  Width: {
    type: "commandWithValue",
    alias: ['w'],
    valueFormat: 'number' as const,
    suggestion: 'Enter width in pixels',
    functionWithParam: (value: string) => resize(value, 'width'),
    supportedNodes: ['BOOLEAN_OPERATION','COMPONENT','COMPONENT_SET','ELLIPSE','FRAME','GROUP','INSTANCE','LINE','POLYGON','RECTANGLE','SLICE','STAR','TEXT','VECTOR'],
  },
  Height: {
    type: "commandWithValue",
    alias: ['h'],
    valueFormat: "number",
    suggestion: "Enter height in pixels",
    functionWithParam: (value: string) => resize(value, 'height'),
    supportedNodes: ['BOOLEAN_OPERATION','COMPONENT','COMPONENT_SET','ELLIPSE','FRAME','GROUP','INSTANCE','LINE','POLYGON','RECTANGLE','SLICE','STAR','TEXT','VECTOR'],
  },
  GoToMainComponent: {
    type: "commandWithoutValue",
    alias: ['m'],
    suggestion: "use ⌘Z to come back",
    functionWithoutParam: () => selectMasterComponent(),
    supportedNodes: ['INSTANCE'],
  },
  MoveTop: {
    type: "commandWithValue",
    alias: ['mt', '-my'],
    valueFormat: 'number' as const,
    suggestion: "Move X pixels up",
    functionWithParam: (value: string) => move('TOP', value),
    supportedNodes: ['BOOLEAN_OPERATION','COMPONENT','COMPONENT_SET','ELLIPSE','FRAME','GROUP','INSTANCE','LINE','POLYGON','RECTANGLE','SECTION','SLICE','STAR','TEXT','VECTOR'],
    specialConditions: ['IsNotInAutoLayout', 'IsAbsoluteInAutoLayout'],
  },
  MoveBottom: {
    type: "commandWithValue",
    alias: ['mb', 'my'],
    valueFormat: 'number' as const,
    suggestion: "Move X pixels down",
    functionWithParam: (value: string) => move('BOTTOM', value),
    supportedNodes: ['BOOLEAN_OPERATION','COMPONENT','COMPONENT_SET','ELLIPSE','FRAME','GROUP','INSTANCE','LINE','POLYGON','RECTANGLE','SECTION','SLICE','STAR','TEXT','VECTOR'],
    specialConditions: ['IsNotInAutoLayout', 'IsAbsoluteInAutoLayout'],
  },
  MoveLeft: {
    type: "commandWithValue",
    alias: ['ml', '-mx'],
    valueFormat: 'number' as const,
    suggestion: "Move X pixels left",
    functionWithParam: (value: string) => move('LEFT', value),
    supportedNodes: ['BOOLEAN_OPERATION','COMPONENT','COMPONENT_SET','ELLIPSE','FRAME','GROUP','INSTANCE','LINE','POLYGON','RECTANGLE','SECTION','SLICE','STAR','TEXT','VECTOR'],
    specialConditions: ['IsNotInAutoLayout', 'IsAbsoluteInAutoLayout'],
  },
  MoveRight: {
    type: "commandWithValue",
    alias: ['mr', 'mx'],
    valueFormat: 'number' as const,
    suggestion: "Move X pixels right",
    functionWithParam: (value: string) => move('RIGHT', value),
    supportedNodes: ['BOOLEAN_OPERATION','COMPONENT','COMPONENT_SET','ELLIPSE','FRAME','GROUP','INSTANCE','LINE','POLYGON','RECTANGLE','SECTION','SLICE','STAR','TEXT','VECTOR'],
    specialConditions: ['IsNotInAutoLayout', 'IsAbsoluteInAutoLayout'],
  },
  PositionLeft: {
    type: "commandWithValue",
    alias: ['pol', 'x'],
    valueFormat: "number",
    suggestion: "Position in px from left",
    functionWithParam: (value: string) => position(value, 'left'),
    supportedNodes: ['BOOLEAN_OPERATION','COMPONENT','COMPONENT_SET','ELLIPSE','FRAME','GROUP','INSTANCE','LINE','POLYGON','RECTANGLE','SECTION','SLICE','STAR','TEXT','VECTOR'],
    specialConditions: ['IsNotInAutoLayout', 'IsAbsoluteInAutoLayout'],
  },
  PositionRight: {
    type: "commandWithValue",
    alias: ['por', '-x'],
    valueFormat: "number",
    suggestion: "Position in px from right",
    functionWithParam: (value: string) => position(value, 'right'),
    supportedNodes: ['BOOLEAN_OPERATION','COMPONENT','COMPONENT_SET','ELLIPSE','FRAME','GROUP','INSTANCE','LINE','POLYGON','RECTANGLE','SECTION','SLICE','STAR','TEXT','VECTOR'],
    specialConditions: ['IsNotInAutoLayout', 'IsAbsoluteInAutoLayout'],
  },
  PositionTop: {
    type: "commandWithValue",
    alias: ['pot', 'y'],
    valueFormat: "number",
    suggestion: "Position in px from top",
    functionWithParam: (value: string) => position(value, 'top'),
    supportedNodes: ['BOOLEAN_OPERATION','COMPONENT','COMPONENT_SET','ELLIPSE','FRAME','GROUP','INSTANCE','LINE','POLYGON','RECTANGLE','SECTION','SLICE','STAR','TEXT','VECTOR'],
    specialConditions: ['IsNotInAutoLayout', 'IsAbsoluteInAutoLayout'],
  },
  PositionBottom: {
    type: "commandWithValue",
    alias: ['pob', '-y'],
    valueFormat: "number",
    suggestion: "Position in px from bottom",
    functionWithParam: (value: string) => position(value, 'bottom'),
    supportedNodes: ['BOOLEAN_OPERATION','COMPONENT','COMPONENT_SET','ELLIPSE','FRAME','GROUP','INSTANCE','LINE','POLYGON','RECTANGLE','SECTION','SLICE','STAR','TEXT','VECTOR'],
    specialConditions: ['IsNotInAutoLayout','IsAbsoluteInAutoLayout'],
  },
  Delete: {
    type: "commandWithoutValue",
    alias: ['de'],
    suggestion: '🗑️',
    functionWithoutParam: () => deleteSelection(),
    supportedNodes: ["BOOLEAN_OPERATION","COMPONENT","COMPONENT_SET","ELLIPSE","FRAME","GROUP","INSTANCE","LINE","POLYGON","RECTANGLE","SECTION","SLICE","STAR","TEXT","VECTOR"],
  },
  AutoLayout: {
    type: "commandWithoutValue",
    alias: ['a'],
    suggestion: 'Create Horizontal Auto-Layout →',
    functionWithoutParam: () => createAutoLayout('HORIZONTAL'),
  },
  AutoLayoutVertical: {
    type: "commandWithoutValue",
    alias: ['av'],
    suggestion: "Create Vertical Auto-Layout ↓",
    functionWithoutParam: () => createAutoLayout('VERTICAL'),
  },
  RemoveAutoLayout: {
    type: "commandWithoutValue",
    alias: ['ra'],
    suggestion: '🗑️📐',
    functionWithoutParam: () => setLayout('NONE'),
    supportedNodes: ['COMPONENT','COMPONENT_SET','FRAME','INSTANCE'],
  },
  FlipHorizontal: {
    type: "commandWithoutValue",
    alias: ['fh'],
    suggestion: '↔',
    functionWithoutParam: () => flip('horizontal')
  },
  FlipVertical: {
    type: "commandWithoutValue",
    alias: ['fv'],
    suggestion: '↕',
    functionWithoutParam: () => flip('vertical')
  },
  Group: {
    type: "commandWithoutValue",
    alias: ['gr'],
    suggestion: '👥',
    functionWithoutParam: () => grouping('group')
  },
  Ungroup: {
    type: "commandWithoutValue",
    alias: ['ugr'],
    suggestion: '👤',
    functionWithoutParam: () => grouping('ungroup')
  },
  VerticalFill: {
    type: "commandWithoutValue",
    alias: ['vf'],
    suggestion: "↕",
    functionWithoutParam: () => layoutSizing('VERTICAL', 'FILL'),
    specialConditions: ['IsInAutoLayout', 'IsAutoLayout'],
  },
  VerticalHug: {
    type: "commandWithoutValue",
    alias: ['vh'],
    suggestion: "↓↑",
    functionWithoutParam: () => layoutSizing('VERTICAL', 'HUG'),
    specialConditions: ['IsInAutoLayout', 'IsAutoLayout'],
  },
  HorizontalFill: {
    type: "commandWithoutValue",
    alias: ['hf'],
    suggestion: "↔",
    functionWithoutParam: () => layoutSizing('HORIZONTAL', 'FILL'),
    specialConditions: ['IsInAutoLayout', 'IsAutoLayout'],
  },
  HorizontalHug: {
    type: "commandWithoutValue",
    alias: ['hh'],
    suggestion: "→←",
    functionWithoutParam: () => layoutSizing('HORIZONTAL', 'HUG'),
    specialConditions: ['IsInAutoLayout', 'IsAutoLayout'],
  },
  Gap: {
    type: "optionalValueCommand",
    alias: ['g'],
    valueFormat: "number",
    suggestion: "Gap in px (No value = Auto)",
    functionWithParam: (value: string) => setPrimaryGap(value),
    functionWithoutParam: () => setPrimaryGap('AUTO'),
    specialConditions: ['IsAutoLayout'],
  },
  SpaceBetween: {
    type: "commandWithoutValue",
    alias: ['sb'],
    suggestion: "Set Gap Between Objects to 'Auto'",
    functionWithoutParam: () => setPrimaryGap('AUTO'),
    specialConditions: ['IsAutoLayout'],
  },
  VerticalGap: {
    type: "optionalValueCommand",
    alias: ['vg'],
    valueFormat: "number",
    suggestion: "Vertical Gap in px (No value = Auto)",
    functionWithParam: (value: string) => setCounterGap(value),
    functionWithoutParam: () => setCounterGap('AUTO'),
    specialConditions: ['IsAutoLayoutWrap'],
  },
  VerticalSpaceBetween: {
    type: "commandWithoutValue",
    alias: ['vsb'],
    suggestion: "Auto",
    functionWithoutParam: () => setCounterGap('AUTO'),
    specialConditions: ['IsAutoLayoutWrap'],
  },
  LayoutHorizontal: {
    type: "commandWithoutValue",
    alias: ['lh'],
    suggestion: "→",
    functionWithoutParam: () => setLayout('HORIZONTAL'),
    supportedNodes: ['COMPONENT','COMPONENT_SET','FRAME','INSTANCE'],
    specialConditions: ['IsAutoLayout'],
  },
  LayoutVertical: {
    type: "commandWithoutValue",
    alias: ['lv'],
    suggestion: "↓",
    functionWithoutParam: () => setLayout('VERTICAL'),
    supportedNodes: ['COMPONENT','COMPONENT_SET','FRAME','INSTANCE'],
    specialConditions: ['IsAutoLayout'],
  },
  LayoutWrap: {
    type: "commandWithoutValue",
    alias: ['lw'],
    suggestion: "↩️",
    functionWithoutParam: () => setLayout('WRAP'),
    supportedNodes: ['COMPONENT','COMPONENT_SET','FRAME','INSTANCE'],
  },
  AbsolutePosition: {
    type: "commandWithoutValue",
    alias: ['ap'],
    suggestion: "ignore auto-layout (toggle)",
    functionWithoutParam: () => absolutePosition(),
    supportedNodes: ['BOOLEAN_OPERATION','COMPONENT','COMPONENT_SET','ELLIPSE','FRAME','GROUP','INSTANCE','LINE','POLYGON','RECTANGLE','SLICE','STAR','TEXT','VECTOR'],
    specialConditions: ['IsInAutoLayout']
  },
  Padding: {
    type: "commandWithValue",
    alias: ['p'],
    valueFormat: "number",
    suggestion: "Enter padding for all sides",
    functionWithParam: (value: string) => setPadding({paddingLeft: value, paddingRight: value, paddingTop: value, paddingBottom: value}),
    supportedNodes: ['COMPONENT','COMPONENT_SET','FRAME','INSTANCE'],
  },
  PaddingHorizontal: {
    type: "commandWithValue",
    alias: ['ph'],
    valueFormat: "number",
    suggestion: "Enter horizontal padding",
    functionWithParam: (value: string) => setPadding({paddingLeft: value, paddingRight: value}),
    supportedNodes: ['COMPONENT','COMPONENT_SET','FRAME','INSTANCE'],
  },
  PaddingVertical: {
    type: "commandWithValue",
    alias: ['pv'],
    valueFormat: "number",
    suggestion: "Enter vertical padding",
    functionWithParam: (value: string) => setPadding({paddingTop: value, paddingBottom: value}),
    supportedNodes: ['COMPONENT','COMPONENT_SET','FRAME','INSTANCE'],
  },
  PaddingLeft: {
    type: "commandWithValue",
    alias: ['pl'],
    valueFormat: "number",
    suggestion: "Enter left padding",
    functionWithParam: (value: string) => setPadding({paddingLeft: value}),
    supportedNodes: ['COMPONENT','COMPONENT_SET','FRAME','INSTANCE'],
  },
  PaddingTop: {
    type: "commandWithValue",
    alias: ['pt'],
    valueFormat: "number",
    suggestion: "Enter top padding",
    functionWithParam: (value: string) => setPadding({paddingTop: value}),
    supportedNodes: ['COMPONENT','COMPONENT_SET','FRAME','INSTANCE'],
  },
  PaddingRight: {
    type: "commandWithValue",
    alias: ['pr'],
    valueFormat: "number",
    suggestion: "Enter right padding",
    functionWithParam: (value: string) => setPadding({paddingRight: value}),
    supportedNodes: ['COMPONENT','COMPONENT_SET','FRAME','INSTANCE'],
  },
  PaddingBottom: {
    type: "commandWithValue",
    alias: ['pb'],
    valueFormat: "number",
    suggestion: "Enter bottom padding",
    functionWithParam: (value: string) => setPadding({paddingBottom: value}),
    supportedNodes: ['COMPONENT','COMPONENT_SET','FRAME','INSTANCE'],
  },
  Fill: {
    type: "optionalValueCommand",
    alias: ['f'],
    valueFormat: 'hex' as const,
    suggestion: 'Enter HEX color (No value = toggle)',
    functionWithoutParam: () => toggleFill(),
    functionWithParam: (value: string) => setFill(value),
    supportedNodes: ['BOOLEAN_OPERATION','COMPONENT','COMPONENT_SET','ELLIPSE','FRAME','INSTANCE','LINE','POLYGON','RECTANGLE','SECTION','STAR','TEXT','VECTOR'],
  },
  Rotate: {
    type: "optionalValueCommand",
    alias: ['ro'],
    valueFormat: 'number' as const,
    suggestion: 'Enter rotation angle in degrees',
    functionWithoutParam: () => rotate(0),
    functionWithParam: (value: string) => { rotate(parseInt(value)); },
    supportedNodes: ['BOOLEAN_OPERATION','COMPONENT','COMPONENT_SET','ELLIPSE','FRAME','INSTANCE','LINE','POLYGON','RECTANGLE','SECTION','STAR','TEXT','VECTOR'],
  },
  Scale: {
    type: "commandWithValue",
    alias: ['s'],
    valueFormat: "number",
    suggestion: "Value in % (x1 = 100%)",
    functionWithParam: (value: string) => scale(value),
  },
  ScaleWidth: {
    type: "commandWithValue",
    alias: ['sw'],
    valueFormat: "number",
    suggestion: "New desired width in px",
    functionWithParam: (value: string) => scale(value, 'width'),
  },
  ScaleHeight: {
    type: "commandWithValue",
    alias: ['sh'],
    valueFormat: "number",
    suggestion: "New desired height in px",
    functionWithParam: (value: string) => scale(value, 'height'),
  },
  RadiusTopLeft: {
    type: "commandWithValue",
    alias: ['rtl'],
    valueFormat: 'number' as const,
    suggestion: 'Top left radius',
    functionWithParam: (value: string) => setRadius({topLeftRadius: value}),
    supportedNodes: ['BOOLEAN_OPERATION','COMPONENT','COMPONENT_SET','ELLIPSE','FRAME','INSTANCE','POLYGON','RECTANGLE','STAR','VECTOR'],
  },
  RadiusTopRight: {
    type: "commandWithValue",
    alias: ['rtr'],
    valueFormat: 'number' as const,
    suggestion: 'Top right radius',
    functionWithParam: (value: string) => setRadius({topRightRadius: value}),
    supportedNodes: ['BOOLEAN_OPERATION','COMPONENT','COMPONENT_SET','ELLIPSE','FRAME','INSTANCE','POLYGON','RECTANGLE','STAR','VECTOR'],
  },
  RadiusBottomRight: {
    type: "commandWithValue",
    alias: ['rbr'],
    valueFormat: 'number' as const,
    suggestion: 'Bottom right radius',
    functionWithParam: (value: string) => setRadius({bottomRightRadius: value}),
    supportedNodes: ['BOOLEAN_OPERATION','COMPONENT','COMPONENT_SET','ELLIPSE','FRAME','INSTANCE','POLYGON','RECTANGLE','STAR','VECTOR'],
  },
  RadiusBottomLeft: {
    type: "commandWithValue",
    alias: ['rbl'],
    valueFormat: 'number' as const,
    suggestion: 'Bottom left radius',
    functionWithParam: (value: string) => setRadius({bottomLeftRadius: value}),
    supportedNodes: ['BOOLEAN_OPERATION','COMPONENT','COMPONENT_SET','ELLIPSE','FRAME','INSTANCE','POLYGON','RECTANGLE','STAR','VECTOR'],
  },
  RadiusAll: {
    type: "commandWithValue",
    alias: ['r'],
    valueFormat: 'number' as const,
    suggestion: 'All corners radius',
    functionWithParam: (value: string) => setRadius({
      topLeftRadius: value,
      topRightRadius: value,
      bottomRightRadius: value,
      bottomLeftRadius: value
    }),
    supportedNodes: ['BOOLEAN_OPERATION','COMPONENT','COMPONENT_SET','ELLIPSE','FRAME','INSTANCE','POLYGON','RECTANGLE','STAR','VECTOR'],
  },
  RadiusLeft: {
    type: "commandWithValue",
    alias: ['rl'],
    valueFormat: 'number' as const,
    suggestion: 'Left side radius',
    functionWithParam: (value: string) => setRadius({
      topLeftRadius: value,
      bottomLeftRadius: value
    }),
    supportedNodes: ['BOOLEAN_OPERATION','COMPONENT','COMPONENT_SET','ELLIPSE','FRAME','INSTANCE','POLYGON','RECTANGLE','STAR','VECTOR'],
  },
  RadiusTop: {
    type: "commandWithValue",
    alias: ['rt'],
    valueFormat: 'number' as const,
    suggestion: 'Top side radius',
    functionWithParam: (value: string) => setRadius({
      topLeftRadius: value,
      topRightRadius: value
    }),
    supportedNodes: ['BOOLEAN_OPERATION','COMPONENT','COMPONENT_SET','ELLIPSE','FRAME','INSTANCE','POLYGON','RECTANGLE','STAR','VECTOR'],
  },
  RadiusRight: {
    type: "commandWithValue",
    alias: ['rr'],
    valueFormat: 'number' as const,
    suggestion: 'Right side radius',
    functionWithParam: (value: string) => setRadius({
      topRightRadius: value,
      bottomRightRadius: value
    }),
    supportedNodes: ['BOOLEAN_OPERATION','COMPONENT','COMPONENT_SET','ELLIPSE','FRAME','INSTANCE','POLYGON','RECTANGLE','STAR','VECTOR'],
  },
  RadiusBottom: {
    type: "commandWithValue",
    alias: ['rb'],
    valueFormat: 'number' as const,
    suggestion: 'Bottom side radius',
    functionWithParam: (value: string) => setRadius({
      bottomLeftRadius: value,
      bottomRightRadius: value
    }),
    supportedNodes: ['BOOLEAN_OPERATION','COMPONENT','COMPONENT_SET','ELLIPSE','FRAME','INSTANCE','POLYGON','RECTANGLE','STAR','VECTOR'],
  },
  ClipContent: {
    type: "commandWithoutValue",
    alias: ['c'],
    suggestion: ' ☑️ Toggle Clip Content',
    functionWithoutParam: () => clipContent(),
    supportedNodes: ['COMPONENT','INSTANCE','FRAME','COMPONENT_SET'],
  },
  Visibility: {
    type: "commandWithoutValue",
    alias: ['v'],
    suggestion: 'Toggle Show/Hide 👁️',
    functionWithoutParam: () => toggleVisibility()
  },
  Opacity: {
    type: "optionalValueCommand",
    alias: ['o'],
    valueFormat: 'number' as const,
    suggestion: 'In % (No value = 0% ↔️ 100%)',
    functionWithParam: (value: string) => setOpacity(value),
    functionWithoutParam: () => toggleOpacity(),
  },
  Duplicate: {
    type: "commandWithoutValue",
    alias: ['d'],
    suggestion: '✂️ Duplicate Element',
    functionWithoutParam: () => duplicate()
  },
  Stroke: {
    type: "optionalValueCommand",
    alias: ['st','b'],
    valueFormat: 'number' as const,
    suggestion: 'border in px (No value = toggle)',
    functionWithParam: (value: string) => setBorder('all', value),
    functionWithoutParam: () => toggleBorder('all'),
  },
  StrokeLeft: {
    type: "optionalValueCommand",
    alias: ['stl','bl'],
    valueFormat: 'number' as const,
    suggestion: 'border in px (No value = toggle)',
    functionWithParam: (value: string) => setBorder('left', value),
    functionWithoutParam: () => toggleBorder('left'),
  },
  StrokeRight: {
    type: "optionalValueCommand",
    alias: ['str','br'],
    valueFormat: 'number' as const,
    suggestion: 'border in px (No value = toggle)',
    functionWithParam: (value: string) => setBorder('right', value),
    functionWithoutParam: () => toggleBorder('right'),
  },
  StrokeTop: {
    type: "optionalValueCommand",
    alias: ['stt','bt'],
    valueFormat: 'number' as const,
    suggestion: 'border in px (No value = toggle)',
    functionWithParam: (value: string) => setBorder('top', value),
    functionWithoutParam: () => toggleBorder('top'),
  },
  StrokeBottom: {
    type: "optionalValueCommand",
    alias: ['stb','bb'],
    valueFormat: 'number' as const,
    suggestion: 'border in px (No value = toggle)',
    functionWithParam: (value: string) => setBorder('bottom', value),
    functionWithoutParam: () => toggleBorder('bottom'),
  },
  StrokeAlignCenter: {
    type: "commandWithoutValue",
    alias: ['stc','bc'],
    suggestion: '◌',
    functionWithoutParam: () => setBorderAlign('CENTER')
  },
  StrokeAlignInside: {
    type: "commandWithoutValue",
    alias: ['sti','bi'],
    suggestion: '⊖',
    functionWithoutParam: () => setBorderAlign('INSIDE')
  },
  StrokeAlignOutside: {
    type: "commandWithoutValue",
    alias: ['sto','bo'],
    suggestion: '◯',
    functionWithoutParam: () => setBorderAlign('OUTSIDE')
  },
  ToggleTheme: {
    type: "commandWithoutValue",
    alias: ['t'],
    suggestion: 'Toggle🌗',
    functionWithoutParam: () => toggleTheme()
  },
  TextTruncation: {
    type: "optionalValueCommand",
    alias: ['tt'],
    valueFormat: 'number' as const,
    suggestion: 'Enter max lines (No value = toggle truncation)',
    functionWithoutParam: () => textTruncation(),
    functionWithParam: (value: string) => textTruncation(value),
    supportedNodes: ['TEXT'],
  },
  VerticalTrim: {
    type: "commandWithoutValue",
    alias: ['vt'],
    suggestion: 'Toggle Vertical Trim',
    functionWithoutParam: () => toggleVerticalTrim(),
    supportedNodes: ['TEXT'],
  },
  TextAutoWidth: {
    type: "commandWithoutValue",
    alias: ['taw'],
    suggestion: 'Hug Text Width and Height',
    functionWithoutParam: () => setTextAutoResize('WIDTH_AND_HEIGHT'),
    supportedNodes: ["TEXT"],
  },
  TextAutoHeight: {
    type: "commandWithoutValue",
    alias: ['tah'],
    suggestion: 'Hug Text Height',
    functionWithoutParam: () => setTextAutoResize('HEIGHT'),
    supportedNodes: ["TEXT"],
  },
  TextFixedSize: {
    type: "commandWithoutValue",
    alias: ['tfs'],
    suggestion: 'Fixed Text Size',
    functionWithoutParam: () => setTextAutoResize('NONE'),
    supportedNodes: ["TEXT"],
  },
  TextAlignLeft: {
    type: "commandWithoutValue",
    alias: ['tal'],
    suggestion: 'Align Text to Left',
    functionWithoutParam: () => AlignText({ horizontal: 'LEFT' }),
    supportedNodes: ["TEXT"],
  },
  
  TextAlignCenter: {
    type: "commandWithoutValue",
    alias: ['tac'],
    suggestion: 'Align Text to Center',
    functionWithoutParam: () => AlignText({ horizontal: 'CENTER' }),
    supportedNodes: ["TEXT"],
  },
  
  TextAlignRight: {
    type: "commandWithoutValue",
    alias: ['tar'],
    suggestion: 'Align Text to Right',
    functionWithoutParam: () => AlignText({ horizontal: 'RIGHT' }),
    supportedNodes: ["TEXT"],
  },
  JustifyText: {
    type: "commandWithoutValue",
    alias: ['taj'],
    suggestion: 'Justify Text',
    functionWithoutParam: () => AlignText({ horizontal: 'JUSTIFIED' }),
    supportedNodes: ["TEXT"],
  },
  
  TextAlignTop: {
    type: "commandWithoutValue",
    alias: ['tat'],
    suggestion: 'Align Text to Top',
    functionWithoutParam: () => AlignText({ vertical: 'TOP' }),
    supportedNodes: ["TEXT"],
  },
  
  TextAlignMiddle: {
    type: "commandWithoutValue",
    alias: ['tam'],
    suggestion: 'Align Text to Middle',
    functionWithoutParam: () => AlignText({ vertical: 'CENTER' }),
    supportedNodes: ["TEXT"],
  },
  
  TextAlignBottom: {
    type: "commandWithoutValue",
    alias: ['tab'],
    suggestion: 'Align Text to Bottom',
    functionWithoutParam: () => AlignText({ vertical: 'BOTTOM' }),
    supportedNodes: ["TEXT"],
  },
  
  // Font Size Command
  FontSize: {
    type: "commandWithValue",
    alias: ['fs'],
    valueFormat: 'number' as const,
    suggestion: 'Enter font size in px',
    functionWithParam: (value: string) => setFontSize(value),
    supportedNodes: ['TEXT'],
    specialConditions: ['NoTextStyleApplied'],
  },
  
  RemoveTextStyle: {
    type: "commandWithoutValue",
    alias: ['rts'],
    suggestion: 'Detach Text Style ⛓️‍💥',
    functionWithoutParam:() => removeTextStyle(),
    supportedNodes: ['TEXT'],
    specialConditions: ['TextStyleApplied'],
  },  
  
  // Font Weight Command
  FontWeight: {
    type: "commandWithValue",
    alias: ['fw'],
    valueFormat: 'number' as const,
    suggestion: 'Enter font weight (100-900)',
    functionWithParam: (value: string) => setFontWeight(value),
    supportedNodes: ['TEXT'],
    specialConditions: ['NoTextStyleApplied'],
  },
  
  // Letter Spacing Command
  LetterSpacing: {
    type: "commandWithValue",
    alias: ['ls'],
    valueFormat: 'number' as const,
    suggestion: 'Enter letter spacing in px',
    functionWithParam: (value: string) => setLetterSpacing(value),
    supportedNodes: ['TEXT'],
    specialConditions: ['NoTextStyleApplied'],
  },
  
  // Line Height Command
  LineHeight: {
    type: "optionalValueCommand",
    alias: ['lh'],
    valueFormat: 'number' as const,
    suggestion: 'In px or % (No value = Auto)',
    functionWithParam: (value: string) => setLineHeight(value),
    functionWithoutParam: () => setLineHeight('AUTO'),
    supportedNodes: ['TEXT'],
    specialConditions: ['NoTextStyleApplied'],
  },
  
  
  // Original Text Case
  TextCaseOriginal: {
    type: "commandWithoutValue",
    alias: ['tco'],
    suggestion: 'Reset Text to Original Case',
    functionWithoutParam: () => setTextCase('ORIGINAL'),
    supportedNodes: ['TEXT'],
    specialConditions: ['NoTextStyleApplied'],
  },
  
  // Uppercase Text
  TextCaseUppercase: {
    type: "commandWithoutValue",
    alias: ['tcu'],
    suggestion: 'Convert Text to UPPERCASE',
    functionWithoutParam: () => setTextCase('UPPER'),
    supportedNodes: ['TEXT'],
    specialConditions: ['NoTextStyleApplied'],
  },
  
  // Lowercase Text
  TextCaseLowercase: {
    type: "commandWithoutValue",
    alias: ['tcl'],
    suggestion: 'Convert Text to lowercase',
    functionWithoutParam: () => setTextCase('LOWER'),
    supportedNodes: ['TEXT'],
    specialConditions: ['NoTextStyleApplied'],
  },
  
  // Title Case Text
  TextCaseTitle: {
    type: "commandWithoutValue",
    alias: ['tct'],
    suggestion: 'Convert Text to Title Case',
    functionWithoutParam: () => setTextCase('TITLE'),
    supportedNodes: ['TEXT'],
    specialConditions: ['NoTextStyleApplied'],
  },
  
  // Small Caps Text
  TextCaseSmallCaps: {
    type: "commandWithoutValue",
    alias: ['tcs'],
    suggestion: 'Convert Text to Small Caps',
    functionWithoutParam: () => setTextCase('SMALL_CAPS'),
    supportedNodes: ['TEXT'],
    specialConditions: ['NoTextStyleApplied'],
  },
  
  // Small Caps Forced Text
  TextCaseSmallCapsForced: {
    type: "commandWithoutValue",
    alias: ['tcsf'],
    suggestion: 'Convert Text to Forced Small Caps',
    functionWithoutParam: () => setTextCase('SMALL_CAPS_FORCED'),
    supportedNodes: ['TEXT'],
    specialConditions: ['NoTextStyleApplied'],
  },
  
  // Text Decoration Commands
  RemoveTextDecoration: {
    type: "commandWithoutValue",
    alias: ['rtd'],
    suggestion: 'Remove Text Decoration 🗑️',
    functionWithoutParam: () => toggleTextDecoration('NONE'),
    supportedNodes: ['TEXT'],
  },
  TextUnderline: {
    type: "commandWithoutValue",
    alias: ['tu'],
    suggestion: 'Add/Remove Underline',
    functionWithoutParam: () => toggleTextDecoration('UNDERLINE'),
    supportedNodes: ['TEXT'],
  },
  
  TextStrikethrough: {
    type: "commandWithoutValue",
    alias: ['ts'],
    suggestion: 'Add/Remove Strikethrough',
    functionWithoutParam: () => toggleTextDecoration('STRIKETHROUGH'),
    supportedNodes: ['TEXT'],
  },
  
  // List Type Commands
  TextOrderedList: {
    type: "commandWithoutValue",
    alias: ['tol'],
    suggestion: 'Convert to Ordered List',
    functionWithoutParam: () => setTextListOptions('ORDERED'),
    supportedNodes: ['TEXT'],
  },
  
  TextUnorderedList: {
    type: "commandWithoutValue",
    alias: ['tul'],
    suggestion: 'Convert to Unordered List',
    functionWithoutParam: () => setTextListOptions('UNORDERED'),
    supportedNodes: ['TEXT'],
  },
  
  TextRemoveList: {
    type: "commandWithoutValue",
    alias: ['trl'],
    suggestion: 'Remove List Formatting 🗑️',
    functionWithoutParam: () => setTextListOptions('NONE'),
    supportedNodes: ['TEXT'],
  },
  
  AlignTopLeft: {
    type: "commandWithoutValue",
    alias: ['atl','alt'],
    suggestion: 'Autolayout Align Top Left ↖',
    functionWithoutParam: () => setAutoLayoutAlignment({ primary: 'MIN', counter: 'MIN' },{ primary: 'MIN', counter: 'MIN' }),
    specialConditions: ['IsAutoLayout'],
  },
  AlignTopCenter: {
    type: "commandWithoutValue",
    alias: ['atc','act'],
    suggestion: 'Autolayout Align Top Center ↑',
    functionWithoutParam: () => setAutoLayoutAlignment({ primary: 'CENTER', counter: 'MIN' },{ primary: 'MIN', counter: 'CENTER' }),
    specialConditions: ['IsAutoLayout'],
  },
  AlignTopRight: {
    type: "commandWithoutValue",
    alias: ['atr','art'],
    suggestion: 'Autolayout Align Top Right ↗',
    functionWithoutParam: () => setAutoLayoutAlignment({ primary: 'MAX', counter: 'MIN' },{ primary: 'MIN', counter: 'MAX' }),
    specialConditions: ['IsAutoLayout'],
  },
  AlignCenterLeft: {
    type: "commandWithoutValue",
    alias: ['acl','alc'],
    suggestion: 'Autolayout Align Center Left ←',
    functionWithoutParam: () => setAutoLayoutAlignment({ primary: 'MIN', counter: 'CENTER' },{ primary: 'CENTER', counter: 'MIN' }),
    specialConditions: ['IsAutoLayout'],
  },
  AlignCenterCenter: {
    type: "commandWithoutValue",
    alias: ['acc'],
    suggestion: 'Autolayout Align Center Center ・',
    functionWithoutParam: () => setAutoLayoutAlignment({ primary: 'CENTER', counter: 'CENTER' },{ primary: 'CENTER', counter: 'CENTER' }),
    specialConditions: ['IsAutoLayout'],
  },
  AlignCenterRight: {
    type: "commandWithoutValue",
    alias: ['acr','arc'],
    suggestion: 'Autolayout Align Center Right →',
    functionWithoutParam: () => setAutoLayoutAlignment({ primary: 'MAX', counter: 'CENTER' },{ primary: 'CENTER', counter: 'MAX' }),
    specialConditions: ['IsAutoLayout'],
  },
  AlignBottomLeft: {
    type: "commandWithoutValue",
    alias: ['abl','alb'],
    suggestion: 'Autolayout Align Bottom Left ↙',
    functionWithoutParam: () => setAutoLayoutAlignment({ primary: 'MIN', counter: 'MAX' },{ primary: 'MAX', counter: 'MIN' }),
    specialConditions: ['IsAutoLayout'],
  },
  AlignBottomRight: {
    type: "commandWithoutValue",
    alias: ['abr','arb'],
    suggestion: 'Autolayout Align Bottom Right ↘',
    functionWithoutParam: () => setAutoLayoutAlignment({ primary: 'MAX', counter: 'MAX' },{ primary: 'MAX', counter: 'MAX' }),
    specialConditions: ['IsAutoLayout'],
  },
  AlignBottomCenter: {
    type: "commandWithoutValue",
    alias: ['abc','acb'],
    suggestion: 'Autolayout Align Bottom Center ↓',
    functionWithoutParam: () => setAutoLayoutAlignment({ primary: 'CENTER', counter: 'MAX' },{ primary: 'MAX', counter: 'CENTER' }),
    specialConditions: ['IsAutoLayout'],
  },
  MaxHeight: {
    type: "optionalValueCommand",
    alias: ['maxh'],
    valueFormat: 'number' as const,
    suggestion: '↕ in px (No value = toggle)',
    functionWithParam: (value: string) => maxDimension({value:value, type: 'max', direction: 'height', null: false}),
    functionWithoutParam: () => maxDimension({type: 'max', direction: 'height', null: true}),
    specialConditions: ['IsInAutoLayout','IsAutoLayout'],
  },
  MaxWidth: {
    type: "optionalValueCommand",
    alias: ['maxw'],
    valueFormat: 'number' as const,
    suggestion: '↔ in px (No value = toggle)',
    functionWithParam: (value: string) => maxDimension({value:value, type: 'max', direction: 'width', null: false}),
    functionWithoutParam: () => maxDimension({type: 'max', direction: 'width', null: true}),
    specialConditions: ['IsInAutoLayout','IsAutoLayout'],
  },
  MinHeight: {
    type: "optionalValueCommand",
    alias: ['minh'],
    valueFormat: 'number' as const,
    suggestion: '↓↑ in px (No value = toggle)',
    functionWithParam: (value: string) => maxDimension({value:value, type: 'min', direction: 'height', null: false}),
    functionWithoutParam: () => maxDimension({type: 'min', direction: 'height', null: true}),
    specialConditions: ['IsInAutoLayout','IsAutoLayout'],
  },
  MinWidth: {
    type: "optionalValueCommand",
    alias: ['minw'],
    valueFormat: 'number' as const,
    suggestion: '→← in px (No value = toggle)',
    functionWithParam: (value: string) => maxDimension({value:value, type: 'min', direction: 'width', null: false}),
    functionWithoutParam: () => maxDimension({type: 'min', direction: 'width', null: true}),
    specialConditions: ['IsInAutoLayout','IsAutoLayout'],
  },
  RemoveEffect: {
    type: "commandWithoutValue",
    alias: ['re'],
    suggestion: '🗑️✨',
    functionWithoutParam: () => removeEffect()
  },
  ExportSVG: {
    type: "commandWithoutValue",
    alias: ['svg'],
    suggestion: '🎨',
    functionWithoutParam: () => exportAs({format:'SVG',constraintType: 'SCALE',constraintValue: '1'}),
  },
  ExportPDF: {
    type: "commandWithoutValue",
    alias: ['pdf'],
    suggestion: '📄',
    functionWithoutParam: () => exportAs({format:'PDF',constraintType: 'SCALE',constraintValue: '1'}),
  },
  ExportPNG: {
    type: "optionalValueCommand",
    alias: ['png'],
    valueFormat: 'number' as const,
    suggestion: 'Opt: Scale (e.g. png2 = 2x)',
    functionWithParam: (value: string) => exportAs({format:'PNG',constraintType: 'SCALE',constraintValue: value}),
    functionWithoutParam: () => exportAs({format:'PNG',constraintType: 'SCALE',constraintValue: '1'}),
  },
  ExportJPG: {
    type: "optionalValueCommand",
    alias: ['jpg'],
    valueFormat: 'number' as const,
    suggestion: 'Opt: Scale (e.g. jpg2 = 2x)',
    functionWithParam: (value: string) => exportAs({format:'JPG',constraintType: 'SCALE',constraintValue: value}),
    functionWithoutParam: () => exportAs({format:'JPG',constraintType: 'SCALE',constraintValue: '1'}),
  },
  ExportPNGWidth: {
    type: "commandWithValue",
    alias: ['pngw'],
    valueFormat: 'number' as const,
    suggestion: 'Export Width in px',
    functionWithParam: (value: string) => exportAs({format:'PNG',constraintType: 'WIDTH',constraintValue: value}),
  },
  ExportJPGWidth: {
    type: "commandWithValue",
    alias: ['jpgw'],
    valueFormat: 'number' as const,
    suggestion: 'Export Width in px',
    functionWithParam: (value: string) => exportAs({format:'JPG',constraintType: 'WIDTH',constraintValue: value}),
  },
  ExportPNGHeight: {
    type: "commandWithValue",
    alias: ['pngh'],
    valueFormat: 'number' as const,
    suggestion: 'Export Height in px',
    functionWithParam: (value: string) => exportAs({format:'PNG',constraintType: 'HEIGHT',constraintValue: value}),
  },
  ExportJPGHeight: {
    type: "commandWithValue",
    alias: ['jpgh'],
    valueFormat: 'number' as const,
    suggestion: 'Export Height in px',
    functionWithParam: (value: string) => exportAs({format:'JPG',constraintType: 'HEIGHT',constraintValue: value}),
  },
  // Horizontal Constraints
  ConstraintLeft: {
    type: "commandWithoutValue",
    alias: ['cl'],
    suggestion: 'Set horizontal constraint to left',
    functionWithoutParam: () => setConstraints('HORIZONTAL', 'MIN'),
    specialConditions: ['IsNotInAutoLayout'],
  },
  ConstraintCenterHorizontal: {
    type: "commandWithoutValue",
    alias: ['cch'],
    suggestion: 'Set horizontal constraint to center',
    functionWithoutParam: () => setConstraints('HORIZONTAL', 'CENTER'),
    specialConditions: ['IsNotInAutoLayout'],
  },
  ConstraintRight: {
    type: "commandWithoutValue",
    alias: ['cr'],
    suggestion: 'Set horizontal constraint to right',
    functionWithoutParam: () => setConstraints('HORIZONTAL', 'MAX'),
    specialConditions: ['IsNotInAutoLayout'],
  },
  ConstraintLeftAndRight: {
    type: "commandWithoutValue",
    alias: ['clr'],
    suggestion: 'Set horizontal constraint to left + right',
    functionWithoutParam: () => setConstraints('HORIZONTAL', 'STRETCH'),
    specialConditions: ['IsNotInAutoLayout'],
  },
  ConstraintScaleHorizontal: {
    type: "commandWithoutValue",
    alias: ['csh'],
    suggestion: 'Set horizontal constraint to scale',
    functionWithoutParam: () => setConstraints('HORIZONTAL', 'SCALE'),
    specialConditions: ['IsNotInAutoLayout'],
  },
  // Vertical Constraints
  ConstraintTop: {
    type: "commandWithoutValue",
    alias: ['ct'],
    suggestion: 'Set vertical constraint to top',
    functionWithoutParam: () => setConstraints('VERTICAL', 'MIN'),
    specialConditions: ['IsNotInAutoLayout'],
  },
  ConstraintCenterVertical: {
    type: "commandWithoutValue",
    alias: ['ccv'],
    suggestion: 'Set vertical constraint to center',
    functionWithoutParam: () => setConstraints('VERTICAL', 'CENTER'),
    specialConditions: ['IsNotInAutoLayout'],
  },
  ConstraintBottom: {
    type: "commandWithoutValue",
    alias: ['cb'],
    suggestion: 'Set vertical constraint to bottom',
    functionWithoutParam: () => setConstraints('VERTICAL', 'MAX'),
    specialConditions: ['IsNotInAutoLayout'],
  },
  ConstraintTopAndBottom: {
    type: "commandWithoutValue",
    alias: ['ctb'],
    suggestion: 'Set vertical constraint to top + bottom',
    functionWithoutParam: () => setConstraints('VERTICAL', 'STRETCH'),
    specialConditions: ['IsNotInAutoLayout'],
  },
  ConstraintScaleVertical: {
    type: "commandWithoutValue",
    alias: ['csv'],
    suggestion: 'Set vertical constraint to scale',
    functionWithoutParam: () => setConstraints('VERTICAL', 'SCALE'),
    specialConditions: ['IsNotInAutoLayout'],
  },
  CornerSmoothing: {
    type: "commandWithValue",
    alias: ['cs'],
    valueFormat: "number",
    suggestion: "Corner smoothing (0-100)",
    functionWithParam: (value: string) => setCornerSmoothing(value),
  },
  CornerSmoothingIOS: {
    type: "commandWithoutValue",
    alias: ['csi'],
    suggestion: "📱 (IOS)",
    functionWithoutParam: () => setCornerSmoothing("60"),
  },
  AlignTop: {
    type: "commandWithoutValue",
    alias: ['at'],
    suggestion: "Align item(s) to top",
    functionWithoutParam: () => alignNodes('TOP'),
    specialConditions: ['IsNotInAutoLayout'],
  },
  AlignBottom: {
    type: "commandWithoutValue",
    alias: ['ab'],
    suggestion: "Align item(s) to bottom",
    functionWithoutParam: () => alignNodes('BOTTOM'),
    specialConditions: ['IsNotInAutoLayout'],
  },
  AlignLeft: {
    type: "commandWithoutValue",
    alias: ['al'],
    suggestion: "Align item(s) to left",
    functionWithoutParam: () => alignNodes('LEFT'),
    specialConditions: ['IsNotInAutoLayout'],
  },
  AlignRight: {
    type: "commandWithoutValue",
    alias: ['ar'],
    suggestion: "Align item(s) to right",
    functionWithoutParam: () => alignNodes('RIGHT'),
    specialConditions: ['IsNotInAutoLayout'],
  },
  AlignVerticalCenter: {
    type: "commandWithoutValue",
    alias: ['avc'],
    suggestion: "Align item(s) to vertical center",
    functionWithoutParam: () => alignNodes('VERTICAL_CENTER'),
  },
  AlignHorizontalCenter: {
    type: "commandWithoutValue",
    alias: ['ahc'],
    suggestion: "Align item(s) to horizontal center",
    functionWithoutParam: () => alignNodes('HORIZONTAL_CENTER'),
  },
} satisfies Record<string, CommandWithValue | CommandWithoutValue | OptionalValueCommand>;

// Create an array from COMMAND_DEFINITIONS
const COMMANDS: Array<Command & { name: CommandName }> = (Object.keys(COMMAND_DEFINITIONS) as CommandName[])
.map((name) => {
  const def = COMMAND_DEFINITIONS[name];
  return { name, ...def };
});

// ===============
// Helper functions
// ===============

function checkSpecialConditions(node: SceneNode, conditions: SpecialCondition[]): boolean {
  if (!conditions || conditions.length === 0) return true;
  
  return conditions.some(condition => {
    switch (condition) {
      case 'IsAutoLayout':
      return 'layoutMode' in node && node.layoutMode !== 'NONE';
      case 'IsInAutoLayout':
      return node.parent && 'layoutMode' in node.parent && node.parent.layoutMode !== 'NONE';
      case 'IsAbsoluteInAutoLayout':
      return node.parent && 
      'layoutMode' in node.parent && 
      node.parent.layoutMode !== 'NONE' && 
      'layoutPositioning' in node &&
      node.layoutPositioning === 'ABSOLUTE';
      case 'NoTextStyleApplied':
      return node.type === 'TEXT' && 
      (!node.textStyleId || 
        node.textStyleId === '');
        case 'TextStyleApplied':
        return node.type === 'TEXT' && 
        node.textStyleId !== '' && 
        node.textStyleId !== undefined;
        
        case 'IsNotInAutoLayout':
        return node.parent && 'layoutMode' in node.parent && node.parent.layoutMode === 'NONE';
        case 'IsAutoLayoutWrap':
        return 'layoutMode' in node && node.layoutMode !== 'NONE' && 'layoutWrap' in node && node.layoutWrap === 'WRAP';
        case 'IsVisible':
        return node.visible;
        default:
        return false;
      }
    });
  }
  
  // Unified findCommand function
  function findCommand(part: string): Array<Command & { name: CommandName }> {
    const commandPart = part.match(COMMAND_PART_REGEX)?.[0];
    
    if (!commandPart) {
      return [];
    }
    
    const cmdLower = commandPart.toLowerCase();
    const selection = figma.currentPage.selection;
    
    // Helper function to check if command supports current selection
    const supportsCurrentSelection = (cmd: Command) => {
      if (!cmd.supportedNodes && !cmd.specialConditions) return true;
      if (selection.length === 0) return true;
      
      // Check both supportedNodes and specialConditions
      const supportsNodeTypes = !cmd.supportedNodes || selection.every(node => 
        cmd.supportedNodes!.indexOf(node.type) !== -1
      );
      
      const meetsSpecialConditions = !cmd.specialConditions || selection.every(node =>
        checkSpecialConditions(node, cmd.specialConditions!)
      );
      
      return supportsNodeTypes && meetsSpecialConditions;
    };
    
    // First, check for exact alias matches
    const exactAliasMatches = COMMANDS.filter(cmd => {
      const aliases = Array.isArray(cmd.alias) ? cmd.alias : [cmd.alias];
      return aliases.some(alias => alias.toLowerCase() === cmdLower) && supportsCurrentSelection(cmd);
    });
    
    if (exactAliasMatches.length > 0) {
      return exactAliasMatches;
    }
    
    // Then, split results into "starts with" and "contains"
    const startsWithMatches: Array<Command & { name: CommandName }> = [];
    const containsMatches: Array<Command & { name: CommandName }> = [];
    
    COMMANDS.forEach(cmd => {
      // First check if command supports current selection
      if (!supportsCurrentSelection(cmd)) return;
      
      const nameLower = cmd.name.toLowerCase();
      const aliases = Array.isArray(cmd.alias) ? cmd.alias : [cmd.alias];
      
      // Check if name or any alias starts with the search term
      if (nameLower.startsWith(cmdLower) || 
      aliases.some(alias => alias.toLowerCase().startsWith(cmdLower))) {
        startsWithMatches.push(cmd);
      }
      // If not starting with, check if it contains the term
      else if (nameLower.includes(cmdLower) ||
      aliases.some(alias => alias.toLowerCase().includes(cmdLower))) {
        containsMatches.push(cmd);
      }
    });
    
    // Combine the results with "starts with" matches first
    return [...startsWithMatches, ...containsMatches];
  }
  
  const COMMAND_SPLITTER_REGEX = /[\s,]+/;
  const COMMAND_PART_REGEX = /^(-(?![\d])|(-)?[\p{L}]+(-[\p{L}]+)*?)(?=\s|[\d]|-[\d]|-$|$|#|:)/u;
  
  // Updated number regex to allow parentheses and 'x' as multiplication
  const VALUE_FORMAT_REGEX = {
    number: /-?\s*\(?(\d+(\.\d+)?(?:\s*[-+*/x]\s*\(?-?\d+(\.\d+)?\)?)*\)?%?)/,
    hex: /#[0-9a-fA-F]{0,6}/,
  };
  
  
  function calculateExpression(expression: string): string {
    // Check if the expression ends with %
    const isPercentage = expression.endsWith('%');
    
    // Remove % sign and spaces, normalize 'x' to '*'
    const sanitizedExp = expression
    .replace(/%$/, '')
    .replace(/\s+/g, '')
    .replace(/x/gi, '*');
    
    // Validate the expression
    if (!/^-?\(?\d+(\.\d+)?(?:[-+*/]\(?-?\d+(\.\d+)?\)?)*\)?$/.test(sanitizedExp)) {
      throw new Error('Invalid calculation format');
    }
    
    try {
      // Calculate the numeric result
      const result = Function(`return ${sanitizedExp}`)();
      
      // Return the result with % if the input had %
      return isPercentage ? `${result}%` : result.toString();
    } catch (error) {
      throw new Error('Invalid calculation');
    }
  }
  
  
  // ================
  // Suggestion Helper
  // ================
  
  function getCommandSuggestions(
    commands: Array<Command & { name: CommandName }>,
    searchTerm: string = '',
    excludeCommand?: Command,
    includeSuggestion: boolean = false,
    previousCommands: Record<string, string> = {}
  ) {
    const selection = figma.currentPage.selection;
    
    const filteredCommands = commands.filter(cmd => {
      // Exclude the specific command (so it doesn't show up as a "related" suggestion to itself)
      if (excludeCommand && cmd.name === excludeCommand.name) return false;
      
      // Check specialConditions (e.g. IsAutoLayout, etc.)
      if (cmd.specialConditions && selection.length > 0) {
        if (!selection.every(node => checkSpecialConditions(node, cmd.specialConditions!))) {
          return false;
        }
      }
      
      // Check supportedNodes if selection exists
      if (cmd.supportedNodes && selection.length > 0) {
        if (!selection.every(node => cmd.supportedNodes!.indexOf(node.type) !== -1)) {
          return false;
        }
      }      
      
      // If the user typed nothing (searchTerm is empty):
      // - For the initial top-level suggestions, we return all commands.
      // - For "related" suggestions (excludeCommand is set), we don't return everything
      //   (otherwise you'd see random commands that have nothing to do with the matched command).
      if (!searchTerm) {
        return !excludeCommand; // Return true if no excludeCommand, false if we are in "related" mode
      }
      
      // Otherwise, normal search filtering
      const lowerSearch = searchTerm.toLowerCase();
      return (
        cmd.name.toLowerCase().startsWith(lowerSearch) ||
        cmd.name.toLowerCase().includes(lowerSearch) ||
        cmd.alias.some(alias =>
          alias.toLowerCase().startsWith(lowerSearch) ||
          alias.toLowerCase().includes(lowerSearch)
        )
      );
    });
    
    // Sort results
    const sortedCommands = filteredCommands.sort((a, b) => {
      // If no search term (and we're showing top-level suggestions),
      // just sort by shortest alias first, then name
      if (!searchTerm && !excludeCommand) {
        if (a.alias[0].length !== b.alias[0].length) {
          return a.alias[0].length - b.alias[0].length;
        }
        return a.name.localeCompare(b.name);
      }
      
      // With a search term, do an exact-match-first, then "starts with," then "contains"
      const lowerSearch = searchTerm.toLowerCase();
      const aLower = a.name.toLowerCase();
      const bLower = b.name.toLowerCase();
      
      // Exact match first
      const aExact = aLower === lowerSearch;
      const bExact = bLower === lowerSearch;
      if (aExact !== bExact) return bExact ? 1 : -1;
      
      // "Starts with" next
      const aStarts = aLower.startsWith(lowerSearch);
      const bStarts = bLower.startsWith(lowerSearch);
      if (aStarts !== bStarts) return bStarts ? 1 : -1;
      
      // "Contains" afterwards
      const aContains = aLower.includes(lowerSearch);
      const bContains = bLower.includes(lowerSearch);
      if (aContains !== bContains) return bContains ? 1 : -1;
      
      // Finally, alphabetical
      return a.name.localeCompare(b.name);
    });
    
    // Build suggestion strings
    return sortedCommands.map((cmd, index) => {
      const previousValue = previousCommands[cmd.name];
      let infoText = '';
      
      if (previousValue !== undefined) {
        // If we previously set this command
        infoText =
        cmd.type === 'commandWithoutValue'
        ? 'ℹ️ already set'
        : `ℹ️ already set to '${previousValue}'`;
      } else if (includeSuggestion && index === 0) {
        // If this is the top suggestion, show the command's built-in suggestion (if any)
        infoText = cmd.suggestion || '';
      }
      
      const separator = infoText ? ' -- ' : '';
      return `${cmd.alias.join(', ')} · ${cmd.name}${separator}${infoText}`;
    });
  }
  
  
  // ================
  // New Setup Logic
  // ================
  
  // Keep track of the current input handler so we can remove it
  let currentInputHandler: ((event: ParameterInputEvent) => void) | null = null;
  
  function setupInputHandler() {
    // If there's an existing handler, remove it
    if (currentInputHandler) {
      figma.parameters.off('input', currentInputHandler);
    }
    
    // Define a new handler
    currentInputHandler = ({ key, query, result }) => {
      if (key !== 'command') return;
      originalInput = query;
      
      const parts = query.split(' ');
      const currentPart = parts[parts.length - 1];
      
      // Track previous commands
      const previousCommands: Record<string, string> = {};
      parts.slice(0, -1).forEach(part => {
        const matchedCommand = findCommand(part)[0];
        if (matchedCommand) {
          if (matchedCommand.type === 'commandWithoutValue') {
            previousCommands[matchedCommand.name] = '';
          } else {
            const hasHex = VALUE_FORMAT_REGEX.hex.exec(part);
            const hasNumber = VALUE_FORMAT_REGEX.number.exec(part);
            if (hasHex && matchedCommand.valueFormat === 'hex') {
              previousCommands[matchedCommand.name] = hasHex[0];
            } else if (hasNumber) {
              try {
                const computedValue = calculateExpression(hasNumber[0]);
                previousCommands[matchedCommand.name] = computedValue.toString();
              } catch {
                previousCommands[matchedCommand.name] = hasNumber[0];
              }
            }
          }
        }
      });
      
      // If query is empty or ends with space, show all commands
      if (!query || query.endsWith(' ')) {
        result.setSuggestions(getCommandSuggestions(COMMANDS, '', undefined, true, previousCommands));
        return;
      }
      
      // Summarize previously defined commands (not used below except for display)
      const completeCommands = parts.slice(0, -1).map((part) => {
        const matchedCommand = findCommand(part)[0];
        if (!matchedCommand) {
          return "Not Found";
        }
        
        const { name, type } = matchedCommand;
        
        // Process hex or number value if present
        const processValue = (): string | null => {
          const hasHex = VALUE_FORMAT_REGEX.hex.exec(part);
          if (hasHex) {
            return hasHex[0];
          }
          
          const hasNumber = VALUE_FORMAT_REGEX.number.exec(part);
          if (hasNumber) {
            try {
              return calculateExpression(hasNumber[0]);
            } catch {
              return hasNumber[0];
            }
          }
          
          return null;
        };
        
        // Format command with optional value
        const formatCommand = (value: string | null): string => {
          return value ? `${name}:${value}` : name;
        };
        
        const value = processValue();
        
        if (type === 'commandWithValue') {
          return value ? formatCommand(value) : undefined;
        } else if (type === 'optionalValueCommand') {
          return formatCommand(value);
        } else {
          return name;
        }
      });
      
      
      // Process current (last) command
      const matchedCommand = findCommand(currentPart)[0];
      const hasNumber = VALUE_FORMAT_REGEX.number.exec(currentPart);
      const hasHex = VALUE_FORMAT_REGEX.hex.exec(currentPart);
      
      if (matchedCommand) {
        const isValidValue =
        (matchedCommand.type === "commandWithValue" || matchedCommand.type === "optionalValueCommand") &&
        'valueFormat' in matchedCommand && (
          matchedCommand.valueFormat === 'hex' ? hasHex :
          matchedCommand.valueFormat === 'number' ? hasNumber :
          true
        );
        
        let suggestions: string[] = [];
        
        // Manage already matched commands
        if (
          matchedCommand.name.toLowerCase().includes(currentPart.toLowerCase()) ||
          matchedCommand.alias.some(alias => alias.toLowerCase().includes(currentPart.toLowerCase()))
        ) {
          const previousCommand = previousCommands[matchedCommand.name];
          const suggestion = previousCommand 
          ? `ℹ️ already set to '${previousCommand}'`
          : matchedCommand.suggestion;
          suggestions.push(`${matchedCommand.alias.join(', ')} · ${matchedCommand.name} -- ${suggestion}`);
        }
        
        // Handle valid values
        if (isValidValue && (hasHex || hasNumber)) {
          if (matchedCommand.valueFormat === 'hex' && hasHex) {
            completeCommands.push(`${matchedCommand.name}:${hasHex[0]}`);
            suggestions[0] = completeCommands.join(' | ');
          } else if (matchedCommand.valueFormat === 'number' && hasNumber) {
            try {
              const computedValue = calculateExpression(hasNumber[0]);
              completeCommands.push(`${matchedCommand.name}:${computedValue}`);
              suggestions[0] = completeCommands.join(' | ');
            } catch {
              completeCommands.push(`${matchedCommand.name}:${hasNumber[0]}`);
              suggestions[0] = completeCommands.join(' | ');
            }
          }
        }
        
        if (matchedCommand.type === 'commandWithoutValue') {
          // Modified logic here: Show suggestion in summary only if it's the first command
          if (completeCommands.length === 0 && matchedCommand.suggestion) {
            completeCommands.push(`${matchedCommand.name} -- ${matchedCommand.suggestion}`);
          } else {
            completeCommands.push(`${matchedCommand.name}`);
          }
          suggestions[0] = completeCommands.join(' | ');
        }
        
        // Add related suggestions
        const relatedSuggestions = getCommandSuggestions(COMMANDS, currentPart, matchedCommand, false, previousCommands);
        suggestions = [...suggestions, ...relatedSuggestions];
        
        result.setSuggestions(suggestions);
      } else {
        // first try to see if a command by that name exists at all
        const allMatchingCommands = COMMANDS.filter(cmd => {
          const nameLower = cmd.name.toLowerCase();
          const cmdLower = currentPart.toLowerCase();
          return (
            nameLower.includes(cmdLower) ||
            cmd.alias.some(alias => alias.toLowerCase().includes(cmdLower))
          );
        });
        
        // If no command by that name
        if (allMatchingCommands.length === 0) {
          result.setSuggestions([`No command found for "${currentPart}"`]);
        } else {
          // If commands exist but none are valid for current selection
          const availableCommands = allMatchingCommands.filter(cmd => {
            const selection = figma.currentPage.selection;
            
            const supportsNodeTypes = !cmd.supportedNodes || selection.length === 0 ||
            selection.every(node => cmd.supportedNodes!.indexOf(node.type) !== -1);
            
            const meetsSpecialConditions = !cmd.specialConditions || selection.length === 0 ||
            selection.every(node => checkSpecialConditions(node, cmd.specialConditions!));
            
            return supportsNodeTypes && meetsSpecialConditions;
          });
          
          if (availableCommands.length === 0) {
            const suggestions = allMatchingCommands.map(cmd => `'${cmd.name}' not available on selection`);
            result.setSuggestions(suggestions);
          } else {
            result.setSuggestions([`No command found for "${currentPart}"`]);
          }
        }
      }
    };
    
    // Register the new handler
    figma.parameters.on('input', currentInputHandler);
  }
  
  // Set up the initial input handler
  setupInputHandler();
  
  // Whenever the selection changes, re-run setup so the suggestions always match
  figma.on('selectionchange', () => {
    setupInputHandler();
  });
  
  // ===================
  // figma.on('run') etc
  // ===================
  figma.on('run', async (parameters) => {
    const commandString = originalInput.trim();
    const commands = commandString.split(COMMAND_SPLITTER_REGEX).filter(Boolean);

    console.log("parameters", parameters);
    console.log("commands", commands);
    
    try {
      // If we have original input and command doesn't contain pipe
      if (parameters.parameters?.command && !parameters.parameters.command.includes('|')) {
        // Execute all commands except the last one
        for (let i = 0; i < commands.length - 1; i++) {
          const cmd = commands[i];
          await executeCommand(cmd);
        }
        console.log("parameters.parameters.command", parameters.parameters.command);
        await executeCommand(parameters.parameters.command);
      } else {
        for (const cmd of commands) {
          console.log("cmd", cmd);
          await executeCommand(cmd);
        }
      }
      figma.closePlugin();
    } catch (error) {
      figma.notify(error instanceof Error ? error.message : 'An unknown error occurred');
      figma.closePlugin();
    }
  });
  
  // =================
  // Command Execution
  // =================
  async function processCommand(commandName: CommandName, value?: string): Promise<void> {
    const command = COMMAND_DEFINITIONS[commandName];
    if (!command) return;

    console.log("process command", command);
    
    if (command.type === 'commandWithValue') {
      await command.functionWithParam(value || '');
    } else if (command.type === 'commandWithoutValue') {
      await command.functionWithoutParam();
    } else if (command.type === 'optionalValueCommand') {
      if (value) {
        await command.functionWithParam(value);
      } else {
        await command.functionWithoutParam();
      }
    }
  }
  
  async function executeCommand(cmd: string): Promise<void> {
    if (!cmd) return;
    
    // Clean the command string by removing suggestions and aliases
    const cleanCmd = cmd.split('•')[0]  // Remove everything after the bullet point
                       .split(',')[0]    // Take only the first part before any comma
                       .trim();          // Remove whitespace
    
    const command = findCommand(cleanCmd)[0];
    if (!command) {
        return;
    }

    console.log("execute cleaned command:", cleanCmd);
    console.log("execute matched command:", command);
    
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const loadingNotification = figma.notify(`Executing command(s)...`, { timeout: 0 });
    
    try {
      await delay(1);
      if (command.type === 'commandWithoutValue') {
        await processCommand(command.name);
      } else {
        const value = extractValue(cmd, command.valueFormat as ValueFormat);
        console.log("value", value);
        if (command.type === 'commandWithValue') {
          if (value) {
            await processCommand(command.name, value);
          } else {
            figma.notify(`No value provided for ${command.name}`);
          }
        } else if (command.type === 'optionalValueCommand') {
          if (value) {
            console.log("optional value command", value);
            await command.functionWithParam(value);
          } else {
            console.log("optional value command without param");
            await command.functionWithoutParam();
          }
        }
      }
    } finally {
      await delay(1);
      loadingNotification.cancel();
    }
  }
  
  function extractValue(text: string, format: ValueFormat): string | null {
    console.log("extract value", text);
    const match = text.match(VALUE_FORMAT_REGEX[format]);
    console.log("extract value", match);
    if (!match) return null;
    
    if (format === 'hex') {
      const value = match[0];
      return value.startsWith('#') ? value : `#${value}`;
    }
    
    if (format === 'number') {
      const expression = match[0];
      try {
        const result = calculateExpression(expression);
        return result.toString();
      } catch {
        return expression;
      }
    }

    return match[0];
  }
  
  // ================================
  // Functions
  // ================================
  
  // Functions
  
  function resize(value: string, resizeType: 'width' | 'height') {
    const numValue = Number(value);
    if (isNaN(numValue)) throw new Error('Invalid number provided');
    
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      throw new Error('No items selected');
    }
    
    for (const node of selection) {
      if ('resize' in node) {
        const newSize = {
          width: resizeType === 'width' ? numValue : node.width,
          height: resizeType === 'height' ? numValue : node.height
        };
        node.resize(newSize.width, newSize.height);
      }
    }
    
    figma.notify(`${resizeType} set to ${value} for all selected items`);
  }
  
  function setFill(value: string) {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      throw new Error('No items selected');
    }
    // Convert input to a standardized hex string
    
    let hexColor = value.toString();
    
    // Remove # if present
    hexColor = hexColor.replace('#', '');
    
    // Convert 3-digit hex to 6-digit hex
    if (hexColor.length === 3) {
      hexColor = hexColor.split('').map(char => char + char).join('');
    }
    
    // Validate hex format
    if (!/^[0-9A-Fa-f]{6}$/.test(hexColor)) {
      throw new Error('Invalid hex color format');
    }
    
    // Convert hex to RGB values (0-1 range for Figma)
    const r = parseInt(hexColor.substring(0, 2), 16) / 255;
    const g = parseInt(hexColor.substring(2, 4), 16) / 255;
    const b = parseInt(hexColor.substring(4, 6), 16) / 255;
    
    // Apply fill to selected nodes
    for (const node of selection) {
      if ('fills' in node) {
        const newFills: Paint[] = [{
          type: 'SOLID',
          color: { r, g, b },
          opacity: 1
        } as SolidPaint];
        node.fills = newFills;
      }
    }
  }
  
  function toggleFill() {
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
  
  function createAutoLayout(direction: 'HORIZONTAL' | 'VERTICAL' = 'HORIZONTAL') {
    const selection = figma.currentPage.selection;
    
    if (selection.length === 0) {
      throw new Error('No items selected');
    }
    
    // If the selection is a single group, convert it directly
    if (selection.length === 1 && selection[0].type === 'GROUP') {
      const group = selection[0];
      const parentFrame = group.parent;
      if (!parentFrame) return;
      
      // Create a new frame with the same size and position as the group
      const frame = figma.createFrame();
      frame.x = group.x;
      frame.y = group.y;
      frame.resize(group.width, group.height);
      frame.layoutMode = direction;
      frame.primaryAxisSizingMode = 'AUTO';
      frame.counterAxisSizingMode = 'AUTO';
      frame.fills = []; // Remove default white background
      frame.paddingLeft = 0;
      frame.paddingRight = 0;
      frame.paddingTop = 0;
      frame.paddingBottom = 0;
      
      // Sort the group's children by position
      const sortedChildren = [...group.children].sort((a, b) => {
        if (direction === 'HORIZONTAL') {
          return a.x - b.x;
        } else {
          return a.y - b.y;
        }
      });
      
      // Calculate spacing based on the first two children if they exist
      let spacing = 0;
      if (sortedChildren.length > 1) {
        if (direction === 'HORIZONTAL') {
          spacing = sortedChildren[1].x - (sortedChildren[0].x + sortedChildren[0].width);
        } else {
          spacing = sortedChildren[1].y - (sortedChildren[0].y + sortedChildren[0].height);
        }
      }
      frame.itemSpacing = Math.max(0, spacing);
      
      // Add the frame to the parent
      parentFrame.appendChild(frame);
      
      // Move all children from group to the new frame
      sortedChildren.forEach(child => {
        frame.appendChild(child);
      });
      
      // Select the new frame
      figma.currentPage.selection = [frame];
      figma.notify(`Group converted to ${direction.toLowerCase()} auto-layout frame`);
      return;
    }
    
    // Original code for multiple selections or non-group selections
    const parentFrame = selection[0].parent;
    if (!parentFrame) return;
    
    const firstNodeX = selection[0].x;
    const firstNodeY = selection[0].y;
    
    let spacing = 0;
    if (selection.length > 1) {
      if (direction === 'HORIZONTAL') {
        spacing = selection[1].x - (selection[0].x + selection[0].width);
      } else {
        spacing = selection[1].y - (selection[0].y + selection[0].height);
      }
    }
    
    const frame = figma.createFrame();
    frame.layoutMode = direction;
    frame.primaryAxisSizingMode = 'AUTO';
    frame.counterAxisSizingMode = 'AUTO';
    frame.fills = [];
    frame.paddingLeft = 0;
    frame.paddingRight = 0;
    frame.paddingTop = 0;
    frame.paddingBottom = 0;
    frame.itemSpacing = Math.max(0, spacing);
    
    parentFrame.appendChild(frame);
    frame.x = firstNodeX;
    frame.y = firstNodeY;
    
    const sortedSelection = [...selection].sort((a, b) => {
      if (direction === 'HORIZONTAL') {
        return a.x - b.x;
      } else {
        return a.y - b.y;
      }
    });
    
    sortedSelection.forEach(node => {
      frame.appendChild(node);
    });
    
    figma.currentPage.selection = [frame];
    figma.notify(`Auto-layout frame created in ${direction.toLowerCase()} direction`);
  }
  
  function setPadding({ paddingLeft, paddingRight, paddingTop, paddingBottom }: {
    paddingLeft?: string;
    paddingRight?: string;
    paddingTop?: string;
    paddingBottom?: string;
  }) {
    const selection = figma.currentPage.selection;
    
    if (selection.length === 0) {
      throw new Error('No items selected');
    }
    
    for (const node of selection) {
      if ('paddingLeft' in node) {
        if (paddingLeft !== undefined) node.paddingLeft = Number(paddingLeft);
        if (paddingRight !== undefined) node.paddingRight = Number(paddingRight);
        if (paddingTop !== undefined) node.paddingTop = Number(paddingTop);
        if (paddingBottom !== undefined) node.paddingBottom = Number(paddingBottom);
      }
    }
    
    figma.notify('Padding updated for all selected items');
  }
  
  function rotate(value: number) {
    if (!value && value !== 0) throw new Error('No value provided');
    const selection = figma.currentPage.selection;
    
    if (selection.length === 0) {
      throw new Error('No items selected');
    }
    
    for (const node of selection) {
      if ('rotation' in node) {
        // Get or store original position
        let originalX = node.getPluginData('originalX');
        let originalY = node.getPluginData('originalY');
        
        // If no stored position, use current position and store it
        if (!originalX || !originalY) {
          originalX = node.x.toString();
          originalY = node.y.toString();
          node.setPluginData('originalX', originalX);
          node.setPluginData('originalY', originalY);
        }
        
        // Convert to numbers
        const origX = parseFloat(originalX);
        const origY = parseFloat(originalY);
        
        // Reset rotation
        node.rotation = 0;
        const theta = value * (Math.PI/180); // radians
        
        // Use original position for center calculation
        const cx = origX + node.width/2;
        const cy = origY + node.height/2;
        
        // Calculate new position using original coordinates
        const newx = Math.cos(theta) * origX + origY * Math.sin(theta) 
        - cy * Math.sin(theta) - cx * Math.cos(theta) + cx;
        const newy = -Math.sin(theta) * origX + cx * Math.sin(theta) 
        + origY * Math.cos(theta) - cy * Math.cos(theta) + cy;
        
        node.relativeTransform = [
          [Math.cos(theta), Math.sin(theta), newx],
          [-Math.sin(theta), Math.cos(theta), newy]
        ];
      }
    }
    
    figma.notify(`Rotated ${value}° for all selected items`);
  }
  
  
  
  
  function move(direction: 'TOP' | 'RIGHT' | 'LEFT' | 'BOTTOM', value: string) {
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
  
  function scale(value?: string, dimension?: 'width' | 'height') {
    if (value === undefined) throw new Error('No value provided');
    const selection = figma.currentPage.selection;
    
    if (selection.length === 0) {
      throw new Error('No items selected');
    }
    
    for (const node of selection) {
      if ('rescale' in node) {
        let scaleFactor: number;
        
        if (dimension === 'width') {
          scaleFactor = Number(value) / node.width;
        } else if (dimension === 'height') {
          scaleFactor = Number(value) / node.height;
        } else {
          scaleFactor = Number(value) / 100;
        }
        
        if (scaleFactor < 0.01) throw new Error('Scale factor must be at least 1%');
        node.rescale(scaleFactor);
      }
    }
    
    const message = dimension 
    ? `Scaled items to ${value}${dimension === 'width' ? 'w' : 'h'}`
    : `Scaled items to ${value}%`;
    
    figma.notify(message);
  }
  
  function layoutSizing(direction: 'HORIZONTAL' | 'VERTICAL', value: 'HUG' | 'FIXED' | 'FILL') {
    const selection = figma.currentPage.selection;
    
    if (selection.length === 0) {
      throw new Error('No items selected');
    }
    
    selection.forEach(node => {
      // Handle frames: add auto-layout if needed
      if ('layoutMode' in node) {
        // Enable auto-layout if not already set
        if (node.layoutMode === 'NONE') {
          node.layoutMode = direction;
        }
        try {
          if (direction === 'HORIZONTAL') {
            if ('layoutSizingHorizontal' in node) {
              node.layoutSizingHorizontal = value;
              figma.notify(`Horizontal layout sizing set to ${value.toLowerCase()}`);
            }
          } else {
            if ('layoutSizingVertical' in node) {
              node.layoutSizingVertical = value;
              figma.notify(`Vertical layout sizing set to ${value.toLowerCase()}`);
            }
          }
          return;
        } catch (error) {
          console.warn(`Failed to set layout sizing on node:`, error);
          figma.notify('Failed to set layout sizing');
          return;
        }
      }
      
      // For non-frames, check if the node is inside an auto-layout frame
      const parent = node.parent;
      if (!parent || !('layoutMode' in parent) || parent.layoutMode === 'NONE') {
        figma.notify('Selected item must be inside an auto-layout frame');
        return;
      }
      
      try {
        // Attempt to set the layout sizing directly
        if (direction === 'HORIZONTAL') {
          if ('layoutSizingHorizontal' in node) {
            node.layoutSizingHorizontal = value;
            figma.notify(`Horizontal layout sizing set to ${value.toLowerCase()}`);
          }
        } else {
          if ('layoutSizingVertical' in node) {
            node.layoutSizingVertical = value;
            figma.notify(`Vertical layout sizing set to ${value.toLowerCase()}`);
          }
        }
      } catch (error) {
        console.warn(`Failed to set layout sizing on node:`, error);
        figma.notify('Failed to set layout sizing');
      }
    });
  }
  
  // Set primary axis gap (horizontal)
  function setPrimaryGap(gap: string | 'AUTO') {
    const selection = figma.currentPage.selection;
    
    if (selection.length === 0) {
      throw new Error('No items selected');
    }
    
    selection.forEach(node => {
      if (node.type === 'FRAME') {
        if (!('layoutMode' in node)) {
          figma.notify('Selected frame must be an auto-layout frame');
          return;
        }
        
        if (gap === 'AUTO') {
          node.primaryAxisAlignItems = 'SPACE_BETWEEN';
          figma.notify('Primary gap set to AUTO');
        } else {
          node.primaryAxisAlignItems = 'MIN';
          node.itemSpacing = Number(gap);
          figma.notify(`Primary gap set to ${gap}`);
        }
      }
    });
  }
  
  // Set counter axis gap (vertical for wrap layouts)
  function setCounterGap(gap: string | 'AUTO') {
    const selection = figma.currentPage.selection;
    
    if (selection.length === 0) {
      throw new Error('No items selected');
    }
    
    selection.forEach(node => {
      if (node.type === 'FRAME') {
        if (!('layoutMode' in node) || node.layoutWrap !== 'WRAP') {
          figma.notify('Selected frame must be a wrap auto-layout frame');
          return;
        }
        
        if (gap === 'AUTO') {
          node.counterAxisAlignContent = 'SPACE_BETWEEN';
          figma.notify('Counter gap set to AUTO');
        } else {
          node.counterAxisAlignContent = 'AUTO';
          node.counterAxisSpacing = Number(gap);
          figma.notify(`Counter gap set to ${gap}`);
        }
      }
    });
  }
  
  
  function setLayout(mode: 'HORIZONTAL' | 'VERTICAL' | 'WRAP' | 'NONE') {
    const selection = figma.currentPage.selection;
    
    if (selection.length === 0) {
      throw new Error('No items selected');
    }
    
    selection.forEach(node => {
      if (node.type === 'FRAME') {
        if (mode === 'WRAP') {
          node.layoutMode = 'HORIZONTAL'; // Set to HORIZONTAL for WRAP
          node.layoutWrap = 'WRAP';
        } else {
          node.layoutMode = mode as 'HORIZONTAL' | 'VERTICAL' | 'NONE';
          node.layoutWrap = 'NO_WRAP';
        }
        
        figma.notify(`${mode.toLowerCase()} layout applied`);
      } else {
        console.warn('Selected item is not a frame:', node);
      }
    });
  }
  
  function deleteSelection() {
    const selection = figma.currentPage.selection;
    
    if (selection.length === 0) {
      throw new Error('No items selected');
    }
    
    for (const node of selection) {
      node.remove();
    }
    figma.notify('Items deleted');
  }
  
  function setRadius({ 
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
        if (topLeftRadius !== undefined) node.topLeftRadius = Number(topLeftRadius);
        if (topRightRadius !== undefined) node.topRightRadius = Number(topRightRadius)  ;
        if (bottomLeftRadius !== undefined) node.bottomLeftRadius = Number(bottomLeftRadius);
        if (bottomRightRadius !== undefined) node.bottomRightRadius = Number(bottomRightRadius);
      }
    }
    
    figma.notify('Radius updated for all selected items');
  }
  
  
  function flip(direction: 'horizontal' | 'vertical') {
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
  
  function setCornerSmoothing(value: string) {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      throw new Error('No items selected');
    }
    
    // Convert value from 0-100 range to 0-1 range and clamp
    const inputValue = Math.max(0, Math.min(100, Number(value)));
    const smoothing = inputValue / 100;
    
    for (const node of selection) {
      if ('cornerSmoothing' in node) {
        node.cornerSmoothing = smoothing;
      }
    }
    
    figma.notify(`Corner smoothing set to ${inputValue}%`);
  }
  
  function grouping(action: 'group' | 'ungroup') {
    const selection = figma.currentPage.selection;
    
    if (action === 'group') {
      if (selection.length < 2) {
        throw new Error('Select at least 2 items to group');
      }
      
      const parent = selection[0].parent;
      if (!parent) throw new Error('No parent found for selected items');
      
      for (const node of selection) {
        if (node.parent !== parent) {
          throw new Error('All selected items must share the same parent to group');
        }
      }
      
      const groupNode = figma.group(selection, parent);
      figma.currentPage.selection = [groupNode];
      figma.notify('Items grouped');
      
    } else if (action === 'ungroup') {
      if (selection.length === 0) throw new Error('No items selected');
      
      const ungroupedChildren: SceneNode[] = [];
      for (const node of selection) {
        if ((node.type === 'GROUP' || node.type === 'FRAME') && 'children' in node) {
          const children = figma.ungroup(node);
          ungroupedChildren.push(...children);
        }
      }
      
      if (ungroupedChildren.length > 0) {
        figma.currentPage.selection = ungroupedChildren;
      }
      
      figma.notify('Items ungrouped');
    }
  }
  
  function clipContent() {
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
  
  function toggleVisibility() {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      throw new Error('No items selected');
    }
    
    for (const node of selection) {
      if ('visible' in node) {
        node.visible = !node.visible;
      }
    }
  }
  
  function toggleOpacity() {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      throw new Error('No items selected');
    }
    
    for (const node of selection) {
      if ('opacity' in node) {
        node.opacity = node.opacity === 0 ? 1 : 0;
      }
    }
    
    const firstNode = selection[0];
    if ('opacity' in firstNode) {
      const newOpacity = firstNode.opacity === 0 ? 0 : 100;
      figma.notify(`Opacity toggled to ${newOpacity}%`);
    }
  }
  
  function setOpacity(value: string) {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      throw new Error('No items selected');
    }
    
    for (const node of selection) {
      if ('opacity' in node) {
        node.opacity = Math.max(0, Math.min(100, Number(value))) / 100;
      }
    }
    
    figma.notify(`Opacity set to ${Math.min(100, Math.max(0, Number(value)))}%`);
  }
  
  // Store the last used offset outside the function to persist between calls
  let lastOffset = { x: 0, y: 0 };
  
  function duplicate() {
    const selection = figma.currentPage.selection;
    
    if (selection.length === 0) {
      throw new Error('No items selected');
    }
    
    // If this is a subsequent duplication, we can calculate the offset
    // from the first selected item's position relative to its original
    if (selection[0].getPluginData('originalPosition')) {
      const originalX = parseFloat(selection[0].getPluginData('originalPosition').split(',')[0]);
      const originalY = parseFloat(selection[0].getPluginData('originalPosition').split(',')[1]);
      
      // Calculate the offset from the original position
      lastOffset = {
        x: selection[0].x - originalX,
        y: selection[0].y - originalY
      };
    }
    
    const duplicates = selection.map(node => {
      const clone = node.clone();
      const parent = node.parent;
      
      if (parent) {
        parent.appendChild(clone);
        
        // Apply the stored offset to the new clone
        clone.x = node.x + lastOffset.x;
        clone.y = node.y + lastOffset.y;
        
        // Store the original position in the new clone
        clone.setPluginData('originalPosition', `${node.x},${node.y}`);
      }
      
      return clone;
    });
    
    figma.currentPage.selection = duplicates;
    figma.notify('Items duplicated');
  }
  
  
  
  // Helper function to get existing border style or create new one
  function getOrCreateBorder(node: SceneNode): Paint[] {
    if ('strokes' in node && node.strokes.length > 0) {
      // Create a new array from the readonly borders
      return [...node.strokes];
    }
    return [{
      type: 'SOLID' as const,
      color: { r: 0, g: 0, b: 0 },
      opacity: 1
    }];
  }
  
  function setBorder(side: 'all' | 'left' | 'right' | 'top' | 'bottom', width: string) {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      throw new Error('No items selected');
    }
    
    for (const node of selection) {
      if (!('strokes' in node) || !('strokeWeight' in node) || 
      !('strokeLeftWeight' in node) || !('strokeRightWeight' in node) || 
      !('strokeTopWeight' in node) || !('strokeBottomWeight' in node)) {
        continue;
      }
      
      // If no strokes are set, initialize with all sides at 0
      if (node.strokes.length === 0) {
        node.strokes = getOrCreateBorder(node);
        node.strokeAlign = 'INSIDE';
        
        // Reset all sides to 0
        node.strokeLeftWeight = 0;
        node.strokeRightWeight = 0;
        node.strokeTopWeight = 0;
        node.strokeBottomWeight = 0;
      }
      
      if (side !== 'all') {
        node.strokeAlign = 'INSIDE';
      }
      
      switch (side) {
        case 'all':
        node.strokeWeight = Number(width);
        break;
        case 'left':
        node.strokeLeftWeight = Number(width);
        break;
        case 'right':
        node.strokeRightWeight = Number(width);
        break;
        case 'top':
        node.strokeTopWeight = Number(width);
        break;
        case 'bottom':
        node.strokeBottomWeight = Number(width);
        break;
      }
    }
    
    figma.notify(`${side.charAt(0).toUpperCase() + side.slice(1)} stroke set to ${Number(width)}px`);
  }
  
  
  function toggleBorder(side: 'all' | 'left' | 'right' | 'top' | 'bottom') {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      throw new Error('No items selected');
    }
    
    for (const node of selection) {
      if (!('strokes' in node) || !('strokeWeight' in node) ||
      !('strokeLeftWeight' in node) || !('strokeRightWeight' in node) ||
      !('strokeTopWeight' in node) || !('strokeBottomWeight' in node)) {
        continue;
      }
      
      // Handle 'all' separately
      if (side === 'all') {
        if (node.strokes.length === 0 || node.strokeWeight === 0)
          {
          node.strokes = getOrCreateBorder(node);
          node.strokeWeight = 1;
        } else {
          node.strokes = [];
        }
        continue;
      }
      
      // If no strokes are set, this means no visible stroke. 
      // Set all sides to 0, then apply stroke to the toggled side.
      const noVisibleBorder = (node.strokes.length === 0 || node.strokeWeight === 0);
      
      if (noVisibleBorder) {
        node.strokes = getOrCreateBorder(node);
        node.strokeAlign = 'INSIDE';
        
        node.strokeLeftWeight = 0;
        node.strokeRightWeight = 0;
        node.strokeTopWeight = 0;
        node.strokeBottomWeight = 0;
        
        // Since we know there's no visible stroke, just set this side to 1
        switch (side) {
          case 'left':
          node.strokeLeftWeight = 1;
          break;
          case 'right':
          node.strokeRightWeight = 1;
          break;
          case 'top':
          node.strokeTopWeight = 1;
          break;
          case 'bottom':
          node.strokeBottomWeight = 1;
          break;
        }
        
        figma.notify(`${side.charAt(0).toUpperCase() + side.slice(1)} stroke toggled`);
        continue;
      }
      
      // If we reach here, some stroke exists. Toggle on/off this side without affecting others.
      node.strokeAlign = 'INSIDE';
      
      const currentWeight = (() => {
        switch (side) {
          case 'left': return node.strokeLeftWeight;
          case 'right': return node.strokeRightWeight;
          case 'top': return node.strokeTopWeight;
          case 'bottom': return node.strokeBottomWeight;
        }
      })();
      
      const hasAnyBorder =
      node.strokeLeftWeight > 0 ||
      node.strokeRightWeight > 0 ||
      node.strokeTopWeight > 0 ||
      node.strokeBottomWeight > 0;
      
      let newWidth: number;
      if (currentWeight > 0) {
        // This side currently has a border, remove it
        newWidth = 0;
      } else {
        // This side has no border currently
        if (!hasAnyBorder) {
          // If somehow no border is set (shouldn't happen here because we handled noVisibleBorder above),
          // just set this side to 1.
          newWidth = 1;
        } else {
          // Some other side has a border, match its thickness
          const widths = [
            node.strokeLeftWeight,
            node.strokeRightWeight,
            node.strokeTopWeight,
            node.strokeBottomWeight
          ].filter(w => w > 0);
          const existingWidth = widths[0] || 1;
          newWidth = existingWidth;
        }
      }
      
      // Apply the new width
      switch (side) {
        case 'left':
        node.strokeLeftWeight = newWidth;
        break;
        case 'right':
        node.strokeRightWeight = newWidth;
        break;
        case 'top':
        node.strokeTopWeight = newWidth;
        break;
        case 'bottom':
        node.strokeBottomWeight = newWidth;
        break;
      }
      
      figma.notify(`${side.charAt(0).toUpperCase() + side.slice(1)} border toggled`);
    }
  }
  
  async function toggleTheme() {
    const selection = figma.currentPage.selection;
    if (!selection.length) return;
    
    async function findThemeCollection() {
      const localCollections = await figma.variables.getLocalVariableCollectionsAsync();
      const themeCollection = localCollections.find(c =>
        c.name.toLowerCase().includes("theme") || c.name.toLowerCase().includes("appearance")
      );
      if (themeCollection) return themeCollection;
      
      const libraryCollections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
      const libraryTheme = libraryCollections.find(c =>
        c.name.toLowerCase().includes("theme") || c.name.toLowerCase().includes("appearance")
      );
      if (!libraryTheme) return;
      
      const libraryVars = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(libraryTheme.key);
      if (!libraryVars.length) return;
      
      const importedVar = await figma.variables.importVariableByKeyAsync(libraryVars[0].key);
      return figma.variables.getVariableCollectionByIdAsync(importedVar.variableCollectionId);
    }
    
    const themeCollection = await findThemeCollection();
    if (!themeCollection) return;
    
    const lightMode = themeCollection.modes.find(m => /light|day/i.test(m.name));
    const darkMode = themeCollection.modes.find(m => /dark|night/i.test(m.name));
    if (!lightMode || !darkMode) return;
    
    for (const node of selection) {
      const currentModeId = node.resolvedVariableModes[themeCollection.id];
      if (node.boundVariables && themeCollection.id in node.resolvedVariableModes) {
        if (currentModeId === lightMode.modeId) {
          node.setExplicitVariableModeForCollection(themeCollection, darkMode.modeId);
        } else if (currentModeId === darkMode.modeId) {
          node.clearExplicitVariableModeForCollection(themeCollection);
        }
      } else {
        if (themeCollection.defaultModeId === lightMode.modeId) {
          node.setExplicitVariableModeForCollection(themeCollection, darkMode.modeId);
        } else if (themeCollection.defaultModeId === darkMode.modeId) {
          node.setExplicitVariableModeForCollection(themeCollection, lightMode.modeId);
        }
      }
    }
  }
  
  
  type PrimaryAxisAlignment = 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  type CounterAxisAlignment = 'MIN' | 'CENTER' | 'MAX' | 'BASELINE';
  
  // Define a type for nodes that support auto-layout
  type AutoLayoutNode = FrameNode | ComponentNode | InstanceNode;
  
  // Helper function to check if a node supports auto-layout
  function isAutoLayoutNode(node: SceneNode): node is AutoLayoutNode {
    return 'layoutMode' in node &&
    'primaryAxisAlignItems' in node &&
    'counterAxisAlignItems' in node;
  }
  
  function alignItems(
    direction: 'PRIMARY' | 'COUNTER',
    value: PrimaryAxisAlignment | CounterAxisAlignment,
    node: AutoLayoutNode
  ) {
    try {
      if (direction === 'PRIMARY') {
        node.primaryAxisAlignItems = value as PrimaryAxisAlignment;
      } else {
        node.counterAxisAlignItems = value as CounterAxisAlignment;
      }
    } catch (error) {
      console.warn(`Failed to set axis alignment on node:`, error);
      figma.notify('Failed to set axis alignment');
    }
  }
  
  // Function for AutoLayout alignment
  async function setAutoLayoutAlignment(horizontal: {
    primary: PrimaryAxisAlignment,
    counter: CounterAxisAlignment
  }, vertical: {
    primary: PrimaryAxisAlignment,
    counter: CounterAxisAlignment
  }) {
    const selection = figma.currentPage.selection;
    
    if (selection.length === 0) {
      throw new Error('No items selected');
    }
    
    for (const node of selection) {
      if (!isAutoLayoutNode(node)) {
        figma.notify('Only auto-layout frames can have axis alignment');
        continue;
      }
      
      if (node.layoutMode === 'NONE') {
        figma.notify('Frame must have auto-layout enabled');
        continue;
      }
      
      const isHorizontal = node.layoutMode === 'HORIZONTAL';
      const { primary, counter } = isHorizontal ? horizontal : vertical;
      
      alignItems('PRIMARY', primary, node);
      alignItems('COUNTER', counter, node);
      
      figma.notify(`Alignment set for ${isHorizontal ? 'horizontal' : 'vertical'} layout`);
    }
  }
  
  // Function for Text alignment with separate horizontal and vertical control
  async function AlignText(options: {
    horizontal?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED',
    vertical?: 'TOP' | 'CENTER' | 'BOTTOM'
  }) {
    const selection = figma.currentPage.selection;
    
    if (selection.length === 0) {
      throw new Error('No items selected');
    }
    
    for (const node of selection) {
      if (node.type === 'TEXT') {
        try {
          // Load all fonts used in the text node
          const fonts = node.getRangeAllFontNames(0, node.characters.length);
          await Promise.all(fonts.map(font => figma.loadFontAsync(font)));
          
          // Set horizontal alignment if specified
          if (options.horizontal) {
            node.textAlignHorizontal = options.horizontal;
          }
          
          // Set vertical alignment if specified
          if (options.vertical) {
            node.textAlignVertical = options.vertical;
          }
          
          // Prepare notification message
          const alignments = [];
          if (options.horizontal) {
            alignments.push(`horizontal: ${options.horizontal.toLowerCase()}`);
          }
          if (options.vertical) {
            alignments.push(`vertical: ${options.vertical.toLowerCase()}`);
          }
          
          figma.notify(`Text alignment updated (${alignments.join(', ')})`);
        } catch (err) {
          figma.notify('Error loading font');
        }
      } else {
        figma.notify('Selected node is not a text layer');
      }
    }
  }
  
  
  interface DimensionOptions {
    type: 'max' | 'min';
    direction: 'width' | 'height';
    null: boolean;
    value?: string;
  }
  
  function maxDimension({ type, direction, null: isNull, value }: DimensionOptions): void {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      throw new Error('No items selected');
    }
    
    for (const node of selection) {
      // Check if node supports max/min width/height properties
      if ('maxWidth' in node && 'maxHeight' in node) {
        if (isNull) {
          // Set the property to null to remove constraint
          if (type === 'max' && direction === 'width') {
            node.maxWidth = null;
          } else if (type === 'max' && direction === 'height') {
            node.maxHeight = null;
          } else if (type === 'min' && direction === 'width') {
            node.minWidth = null;
          } else if (type === 'min' && direction === 'height') {
            node.minHeight = null;
          }
        } else {
          // Set the constraint value   
          if (value !== undefined && Number(value) > 0) {
            if (type === 'max' && direction === 'width') {
              node.maxWidth = Number(value);
            } else if (type === 'max' && direction === 'height') {
              node.maxHeight = Number(value);
            } else if (type === 'min' && direction === 'width') {
              node.minWidth = Number(value);
            } else if (type === 'min' && direction === 'height') {
              node.minHeight = Number(value);
            }
          }
        }
      }
    }
    
    const dimensionType = `${type} ${direction}`;
    const message = isNull 
    ? `Removed ${dimensionType} constraint`
    : `Set ${dimensionType} to ${value}px`;
    
    figma.notify(message);
  }
  
  
  // Remove effects
  function removeEffect() {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      throw new Error('No items selected');
    }
    
    for (const node of selection) {
      if ('effects' in node) {
        node.effects = [];
      }
    }
  }
  
  async function exportAs({
    format,
    constraintType,
    constraintValue
  }: {
    format: 'SVG' | 'PNG' | 'PDF' | 'JPG';
    constraintType?: 'SCALE' | 'WIDTH' | 'HEIGHT';
    constraintValue: string;
  }) {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      throw new Error('No items selected');
    }
    // Create export settings object based on format
    const settings: ExportSettings = (() => {
      switch (format) {
        case 'PDF':
        return {
          format: 'PDF',
        };
        case 'SVG':
        return {
          format: 'SVG',
        };
        case 'PNG':
        case 'JPG':
        return {
          format: format,
          constraint: {
            type: constraintType || 'SCALE',
            value: Number(constraintValue)
          }
        };
        default:
        throw new Error(`Unsupported format: ${format}`);
      }
    })();
    
    try {
      // Export each selected node
      const exportResults = [];
      for (const node of selection) {
        const exportResult = await node.exportAsync(settings);
        exportResults.push({
          name: node.name,
          format,
          bytes: exportResult
        });
      }
      figma.showUI(__html__, { visible: false });
      figma.ui.postMessage(exportResults);
    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    }
    
    // Handle messages from UI
    return new Promise(resolve => {
      figma.ui.onmessage = msg => {
        resolve(msg);
        figma.closePlugin();
      };
    });
  }
  
  function absolutePosition() {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      throw new Error('No items selected');
    }
    
    for (const node of selection) {
      if ('layoutPositioning' in node) {
        if (node.layoutPositioning === 'ABSOLUTE') {
          node.layoutPositioning = 'AUTO';
        } else {
          node.layoutPositioning = 'ABSOLUTE';
        }
      }
      break;
    }
  }
  
  function setConstraints(direction: 'VERTICAL' | 'HORIZONTAL', value: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE') {
    const selection = figma.currentPage.selection;
    
    if (selection.length === 0) {
      throw new Error('No items selected');
    }
    
    selection.forEach(node => {
      // Check if node has constraints property
      if ('constraints' in node) {
        try {
          // Create new constraints object maintaining the other direction's value
          const newConstraints = { ...node.constraints };
          
          // Update the specified direction
          if (direction === 'HORIZONTAL') {
            newConstraints.horizontal = value;
          } else {
            newConstraints.vertical = value;
          }
          
          // Set the new constraints
          node.constraints = newConstraints;
          figma.notify(`${direction.toLowerCase()} constraint set to ${value.toLowerCase()}`);
        } catch (error) {
          console.warn(`Failed to set constraints on node:`, error);
          figma.notify('Failed to set constraints');
        }
      } else {
        figma.notify('Selected item does not support constraints');
      }
    });
  }
  
  // Main positioning function that handles all sides
  function position(value: string, side: 'left' | 'right' | 'top' | 'bottom') {
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
  
  function setBorderAlign(alignment: 'CENTER' | 'INSIDE' | 'OUTSIDE') {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      throw new Error('No items selected');
    }
    
    for (const node of selection) {
      // Check if the node supports border alignment
      if (!('strokeAlign' in node)) {
        continue;
      }
      
      // Set the border alignment
      node.strokeAlign = alignment;
    }
    
    figma.notify(`Border alignment set to ${alignment.toLowerCase()}`);
  }
  
  async function selectMasterComponent() {
    const selection = figma.currentPage.selection;
    
    if (selection.length === 0) {
      figma.notify('No items selected');
      return;
    }
    
    const selectedNode = selection[0];
    
    if ('getMainComponentAsync' in selectedNode) {
      try {
        const mainComponent = await selectedNode.getMainComponentAsync();
        
        if (!mainComponent) {
          figma.notify('No master component found');
          return;
        }
        
        if (mainComponent.remote) {
          figma.notify('Master component is in a different file');
          return;
        }
        
        // Find the page containing the master component
        let componentPage = mainComponent.parent;
        while (componentPage && componentPage.type !== 'PAGE') {
          componentPage = componentPage.parent;
        }
        
        if (componentPage) {
          // Switch to the page if different
          if (componentPage.id !== figma.currentPage.id) {
            await figma.setCurrentPageAsync(componentPage);
          }
          
          figma.currentPage.selection = [mainComponent];
          figma.viewport.scrollAndZoomIntoView([mainComponent]);
          
          figma.notify(componentPage.id !== figma.currentPage.id 
            ? `Master component selected (on page "${componentPage.name}")`
            : 'Master component selected');
          }
        } catch (error) {
          figma.notify('Error accessing master component');
        }
      } else {
        figma.notify('Selected item is not an instance');
      }
    }
    
    function alignNodes(alignment: 'TOP' | 'RIGHT' | 'LEFT' | 'BOTTOM' | 'VERTICAL_CENTER' | 'HORIZONTAL_CENTER') {
      const selection = figma.currentPage.selection;
      
      if (selection.length === 0) {
        figma.notify('Please select at least 1 item to align');
        return;
      }
      
      // Filter nodes that have x and y properties
      const validNodes = selection.filter(node => 'x' in node && 'y' in node);
      
      if (validNodes.length !== selection.length) {
        figma.notify('Some selected items cannot be aligned');
        return;
      }
      
      if (validNodes.length === 1) {
        // Single node alignment relative to parent
        const node = validNodes[0];
        const parent = node.parent;
        
        if (!parent || !('width' in parent) || !('height' in parent)) {
          figma.notify('Cannot align: parent container not found or invalid');
          return;
        }
        
        switch (alignment) {
          case 'LEFT':
          node.x = 0;
          break;
          case 'RIGHT':
          if ('width' in node) {
            node.x = parent.width - node.width;
          }
          break;
          case 'TOP':
          node.y = 0;
          break;
          case 'BOTTOM':
          if ('height' in node) {
            node.y = parent.height - node.height;
          }
          break;
          case 'VERTICAL_CENTER': {
            if ('height' in node) {
              node.y = (parent.height - node.height) / 2;
            }
            break;
          }
          case 'HORIZONTAL_CENTER': {
            if ('width' in node) {
              node.x = (parent.width - node.width) / 2;
            }
            break;
          }
        }
        
        figma.notify(`Aligned node to ${alignment.toLowerCase().replace('_', ' ')} of parent`);
        return;
      }
      
      // Multiple node alignment logic (unchanged)
      const positions = validNodes.map(node => ({
        x: node.x,
        y: node.y,
        width: 'width' in node ? node.width : 0,
        height: 'height' in node ? node.height : 0
      }));
      
      const leftmost = Math.min(...positions.map(p => p.x));
      const rightmost = Math.max(...positions.map(p => p.x + p.width));
      const topmost = Math.min(...positions.map(p => p.y));
      const bottommost = Math.max(...positions.map(p => p.y + p.height));
      
      for (const node of validNodes) {
        switch (alignment) {
          case 'LEFT':
          node.x = leftmost;
          break;
          case 'RIGHT':
          if ('width' in node) {
            node.x = rightmost - node.width;
          }
          break;
          case 'TOP':
          node.y = topmost;
          break;
          case 'BOTTOM':
          if ('height' in node) {
            node.y = bottommost - node.height;
          }
          break;
          case 'VERTICAL_CENTER': {
            const centerY = topmost + (bottommost - topmost) / 2;
            if ('height' in node) {
              node.y = centerY - (node.height / 2);
            }
            break;
          }
          case 'HORIZONTAL_CENTER': {
            const centerX = leftmost + (rightmost - leftmost) / 2;
            if ('width' in node) {
              node.x = centerX - (node.width / 2);
            }
            break;
          }
        }
      }
      
      figma.notify(`Aligned ${validNodes.length} items to ${alignment.toLowerCase().replace('_', ' ')}`);
    }
    
    function setTextAutoResize(resizeType: 'NONE' | 'WIDTH_AND_HEIGHT' | 'HEIGHT') {
      const selection = figma.currentPage.selection;
      if (selection.length === 0) {
        throw new Error('No items selected');
      }
      
      for (const node of selection) {
        if (node.type === 'TEXT') {
          // Ensure the font is loaded before setting textAutoResize
          if (node.fontName !== figma.mixed) {
            figma.loadFontAsync(node.fontName).then(() => {
              node.textAutoResize = resizeType;
            });
          }
        }
      }
    }
    
    function textTruncation(maxLines?: string) {
      const selection = figma.currentPage.selection;
      if (selection.length === 0) {
        throw new Error('No items selected');
      }
      
      for (const node of selection) {
        if (node.type === 'TEXT') {
          if (node.fontName !== figma.mixed) {
            figma.loadFontAsync(node.fontName).then(() => {
              if (maxLines === undefined) {
                // Toggle mode
                const newTruncation = node.textTruncation === 'DISABLED' ? 'ENDING' : 'DISABLED';
                node.textTruncation = newTruncation;
              } else {
                // Set mode with max lines
                const lines = parseInt(maxLines);
                if (isNaN(lines) || lines < 1) {
                  throw new Error('Please provide a valid number greater than or equal to 1');
                }
                node.textTruncation = 'ENDING';
                node.maxLines = lines;
              }
            });
          }
        }
      }
    }
    
    
    function setFontSize(size: string) {
      const selection = figma.currentPage.selection;
      if (selection.length === 0) {
        throw new Error('No items selected');
      }
      
      const fontSize = parseInt(size);
      if (isNaN(fontSize) || fontSize < 1) {
        throw new Error('Please provide a valid font size greater than 0');
      }
      
      for (const node of selection) {
        if (node.type === 'TEXT') {
          if (node.fontName !== figma.mixed) {
            figma.loadFontAsync(node.fontName).then(() => {
              node.fontSize = fontSize;
            });
          }
        }
      }
    }
    
    function setFontWeight(weight: string) {
      const selection = figma.currentPage.selection;
      if (selection.length === 0) {
        throw new Error('No items selected');
      }
      
      const fontWeight = parseInt(weight);
      if (isNaN(fontWeight) || fontWeight < 100 || fontWeight > 900 || fontWeight % 100 !== 0) {
        throw new Error('Please provide a valid font weight (100-900 in steps of 100)');
      }
      
      for (const node of selection) {
        if (node.type === 'TEXT' && node.fontName !== figma.mixed) {
          const currentFont = node.fontName as FontName;
          const newFontName = {
            family: currentFont.family,
            style: fontWeight.toString()
          };
          
          figma.loadFontAsync(newFontName).then(() => {
            node.fontName = newFontName;
          });
        }
      }
    }
    
    function setLetterSpacing(spacing: string) {
      const selection = figma.currentPage.selection;
      if (selection.length === 0) {
        throw new Error('No items selected');
      }
      
      const letterSpacing = parseFloat(spacing);
      if (isNaN(letterSpacing)) {
        throw new Error('Please provide a valid number for letter spacing');
      }
      
      for (const node of selection) {
        if (node.type === 'TEXT') {
          if (node.fontName !== figma.mixed) {
            figma.loadFontAsync(node.fontName).then(() => {
              node.letterSpacing = { value: letterSpacing, unit: 'PIXELS' };
            });
          }
        }
      }
    }
    
    function setLineHeight(height: string) {
      const selection = figma.currentPage.selection;
      if (selection.length === 0) {
        throw new Error('No items selected');
      }
      
      for (const node of selection) {
        if (node.type === 'TEXT') {
          if (node.fontName !== figma.mixed) {
            figma.loadFontAsync(node.fontName).then(() => {
              if (height === 'AUTO') {
                node.lineHeight = { unit: 'AUTO' };
              } else {
                // Check if the height value ends with %
                const isPercentage = height.endsWith('%');
                
                // Remove % if present and parse the number
                const value = parseFloat(isPercentage ? height.slice(0, -1) : height);
                
                if (isNaN(value) || value < 0) {
                  throw new Error('Please provide a valid number for line height');
                }
                
                // Set line height based on whether it's a percentage or pixel value
                node.lineHeight = isPercentage 
                ? { unit: 'PERCENT', value: value }
                : { unit: 'PIXELS', value: value };
              }
            });
          }
        }
      }
    }
    
    
    
    function setTextCase(textCase: TextCase) {
      const selection = figma.currentPage.selection;
      if (selection.length === 0) {
        throw new Error('No items selected');
      }
      
      for (const node of selection) {
        if (node.type === 'TEXT') {
          if (node.fontName !== figma.mixed) {
            figma.loadFontAsync(node.fontName).then(() => {
              node.textCase = textCase;
            });
          }
        }
      }
    }
    
    function toggleTextDecoration(decoration: TextDecoration) {
      const selection = figma.currentPage.selection;
      if (selection.length === 0) {
        throw new Error('No items selected');
      }
      
      for (const node of selection) {
        if (node.type === 'TEXT') {
          if (node.fontName !== figma.mixed) {
            figma.loadFontAsync(node.fontName).then(() => {
              node.textDecoration = node.textDecoration === decoration ? 'NONE' : decoration;
            });
          }
        }
      }
    }
    
    function setTextListOptions(listType: 'ORDERED' | 'UNORDERED' | 'NONE') {
      const selection = figma.currentPage.selection;
      if (selection.length === 0) {
        throw new Error('No items selected');
      }
      
      for (const node of selection) {
        if (node.type === 'TEXT') {
          if (node.fontName !== figma.mixed) {
            figma.loadFontAsync(node.fontName).then(() => {
              // Select all text in the node
              const length = node.characters.length;
              node.setRangeListOptions(0, length, { type: listType });
            });
          }
        }
      }
    }
    
    function toggleVerticalTrim() {
      const selection = figma.currentPage.selection;
      if (selection.length === 0) {
        throw new Error('No items selected');
      }
      
      for (const node of selection) {
        if (node.type === 'TEXT') {
          if (node.fontName !== figma.mixed) {
            figma.loadFontAsync(node.fontName).then(() => {
              // Toggle between CAP_HEIGHT and NONE
              node.leadingTrim = (node.leadingTrim === figma.mixed || 
                !node.leadingTrim || 
                node.leadingTrim === 'CAP_HEIGHT')
                ? 'NONE'
                : 'CAP_HEIGHT';
              });
            }
          }
        }
      }
      
      function removeTextStyle() {
        if (figma.currentPage.selection[0].type === 'TEXT') {
          figma.currentPage.selection[0].setTextStyleIdAsync('');
        }
      }
      