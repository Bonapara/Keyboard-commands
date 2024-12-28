// Type definitions
type ValueFormat = 'number' | 'hex' | 'text';

type CommandWithValue = {
  type: "commandWithValue";
  alias: Array<string>;
  valueFormat: ValueFormat;
  functionWithParam: (value: string) => void;
  suggestion: string;
};

type CommandWithoutValue = {
  type: "commandWithoutValue";
  alias: Array<string>;
  functionWithoutParam: () => void;
  suggestion: string;
};

type OptionalValueCommand = {
  type: "optionalValueCommand";
  alias: Array<string>;
  valueFormat?: ValueFormat;
  suggestion: string;
  functionWithoutParam: () => void;
  functionWithParam: (value: string) => void;
};

type CommandName = keyof typeof COMMAND_DEFINITIONS;
type Command = { name: CommandName, type: "commandWithValue" | "commandWithoutValue" | "optionalValueCommand"} & (CommandWithValue | CommandWithoutValue | OptionalValueCommand);

// Example commands using the simplified types
const COMMAND_DEFINITIONS = {
  Width: {
    type: "commandWithValue",
    alias: ['w'],
    valueFormat: 'number' as const,
    suggestion: ' - Enter width in pixels',
    functionWithParam: (value: string) => resize(value, 'width'),
  },
  Height: {
    type: "commandWithValue",
    alias: ['h'],
    valueFormat: "number",
    suggestion: " - Enter height in pixels",
    functionWithParam: (value: string) => resize(value, 'height'),
  },
  GoToMainComponent: {
    type: "commandWithoutValue",
    alias: ['m'],
    suggestion: " - use ⌘Z to come back",
    functionWithoutParam: () => selectMasterComponent(),
  },
  MoveTop: {
    type: "commandWithValue",
    alias: ['mt', '-my'],
    valueFormat: 'number' as const,
    suggestion: " - Move X pixels up",
    functionWithParam: (value: string) => move('TOP', value),
  },
  MoveBottom: {
    type: "commandWithValue",
    alias: ['mb', 'my'],
    valueFormat: 'number' as const,
    suggestion: " - Move X pixels down",
    functionWithParam: (value: string) => move('BOTTOM', value),
  },
  MoveLeft: {
    type: "commandWithValue",
      alias: ['ml', '-mx'],
    valueFormat: 'number' as const,
    suggestion: " - Move X pixels left",
    functionWithParam: (value: string) => move('LEFT', value),
  },
  MoveRight: {
    type: "commandWithValue",
    alias: ['mr', 'mx'],
    valueFormat: 'number' as const,
    suggestion: " - Move X pixels right",
    functionWithParam: (value: string) => move('RIGHT', value),
  },
  PositionLeft: {
    type: "commandWithValue",
    alias: ['pol', 'x'],
    valueFormat: "number",
    suggestion: " - Position in px from left",
    functionWithParam: (value: string) => position(value, 'left'),
  },
  PositionRight: {
    type: "commandWithValue",
    alias: ['por', '-x'],
    valueFormat: "number",
    suggestion: " - Position in px from right",
    functionWithParam: (value: string) => position(value, 'right'),
  },
  PositionTop: {
    type: "commandWithValue",
    alias: ['pot', 'y'],
    valueFormat: "number",
    suggestion: " - Position in px from top",
    functionWithParam: (value: string) => position(value, 'top'),
  },
  PositionBottom: {
    type: "commandWithValue",
    alias: ['pob', '-y'],
    valueFormat: "number",
    suggestion: " - Position in px from bottom",
    functionWithParam: (value: string) => position(value, 'bottom'),
  },
  Delete: {
    type: "commandWithoutValue",
    alias: ['de'],
    suggestion: ' - 🗑️',
    functionWithoutParam: () => deleteSelection()
  },
  AutoLayout: {
    type: "commandWithoutValue",
    alias: ['a'],
    suggestion: ' - →',
    functionWithoutParam: () => createAutoLayout('HORIZONTAL'),
  },
  AutoLayoutVertical: {
    type: "commandWithoutValue",
    alias: ['av'],
    suggestion: " - ↓",
    functionWithoutParam: () => createAutoLayout('VERTICAL'),
  },
  RemoveAutoLayout: {
    type: "commandWithoutValue",
    alias: ['ra'],
    suggestion: ' 📐🗑️',
    functionWithoutParam: () => setLayout('NONE')
  },
  FlipHorizontal: {
    type: "commandWithoutValue",
    alias: ['fh'],
    suggestion: ' - ↔',
    functionWithoutParam: () => flip('horizontal')
  },
  FlipVertical: {
    type: "commandWithoutValue",
    alias: ['fv'],
    suggestion: ' - ↕',
    functionWithoutParam: () => flip('vertical')
  },
  Group: {
    type: "commandWithoutValue",
    alias: ['gr'],
    suggestion: ' - 👥',
    functionWithoutParam: () => grouping('group')
  },
  Ungroup: {
    type: "commandWithoutValue",
    alias: ['ugr'],
    suggestion: ' - 👤',
    functionWithoutParam: () => grouping('ungroup')
  },
  VerticalFill: {
    type: "commandWithoutValue",
    alias: ['vf'],
    suggestion: " - ↕",
    functionWithoutParam: () => layoutSizing('VERTICAL', 'FILL'),
  },
  VerticalHug: {
    type: "commandWithoutValue",
    alias: ['vh'],
    suggestion: " - ↓↑",
    functionWithoutParam: () => layoutSizing('VERTICAL', 'HUG'),
  },
  HorizontalFill: {
    type: "commandWithoutValue",
    alias: ['hf'],
    suggestion: " - ↔",
    functionWithoutParam: () => layoutSizing('HORIZONTAL', 'FILL'),
  },
  HorizontalHug: {
    type: "commandWithoutValue",
    alias: ['hh'],
    suggestion: " - →←",
    functionWithoutParam: () => layoutSizing('HORIZONTAL', 'HUG'),
  },
  Gap: {
    type: "commandWithValue",
    alias: ['g'],
    valueFormat: "number",
    suggestion: " - Gap in px",
    functionWithParam: (value: string) => setPrimaryGap(value),
  },
  SpaceBetween: {
    type: "commandWithValue",
    alias: ['sb'],
    valueFormat: "number",
    suggestion: " - Auto",
    functionWithParam: () => setPrimaryGap('AUTO'),
  },
  VerticalGap: {
    type: "commandWithValue",
    alias: ['vg'],
    valueFormat: "number",
    suggestion: " - Vertical Gap in px",
    functionWithParam: (value: string) => setCounterGap(value),
  },
  VerticalSpaceBetween: {
    type: "commandWithoutValue",
    alias: ['vsb'],
    suggestion: " - Auto",
    functionWithoutParam: () => setCounterGap('AUTO'),
  },
  LayoutHorizontal: {
    type: "commandWithoutValue",
    alias: ['lh'],
    suggestion: " - →",
    functionWithoutParam: () => setLayout('HORIZONTAL'),
  },
  LayoutVertical: {
    type: "commandWithoutValue",
    alias: ['lv'],
    suggestion: " - ↓",
    functionWithoutParam: () => setLayout('VERTICAL'),
  },
  LayoutWrap: {
    type: "commandWithoutValue",
    alias: ['lw'],
    suggestion: " - ↩️",
    functionWithoutParam: () => setLayout('WRAP'),
  },
  AbsolutePosition: {
    type: "commandWithoutValue",
    alias: ['ap'],
    suggestion: " - ignore auto-layout (toggle)",
    functionWithoutParam: () => absolutePosition(),
  },
  Padding: {
    type: "commandWithValue",
    alias: ['p'],
    valueFormat: "number",
    suggestion: " - Enter padding for all sides",
    functionWithParam: (value: string) => setPadding({paddingLeft: value, paddingRight: value, paddingTop: value, paddingBottom: value}),
  },
  PaddingHorizontal: {
    type: "commandWithValue",
      alias: ['ph'],
    valueFormat: "number",
    suggestion: " - Enter horizontal padding",
    functionWithParam: (value: string) => setPadding({paddingLeft: value, paddingRight: value}),
  },
  PaddingVertical: {
    type: "commandWithValue",
    alias: ['pv'],
    valueFormat: "number",
    suggestion: " - Enter vertical padding",
    functionWithParam: (value: string) => setPadding({paddingTop: value, paddingBottom: value}),
  },
  PaddingLeft: {
    type: "commandWithValue",
    alias: ['pl'],
    valueFormat: "number",
    suggestion: " - Enter left padding",
    functionWithParam: (value: string) => setPadding({paddingLeft: value}),
  },
  PaddingTop: {
    type: "commandWithValue",
    alias: ['pt'],
    valueFormat: "number",
    suggestion: " - Enter top padding",
    functionWithParam: (value: string) => setPadding({paddingTop: value}),
  },
  PaddingRight: {
    type: "commandWithValue",
    alias: ['pr'],
    valueFormat: "number",
    suggestion: " - Enter right padding",
    functionWithParam: (value: string) => setPadding({paddingRight: value}),
  },
  PaddingBottom: {
    type: "commandWithValue",
    alias: ['pb'],
    valueFormat: "number",
    suggestion: " - Enter bottom padding",
    functionWithParam: (value: string) => setPadding({paddingBottom: value}),
  },
  Fill: {
    type: "optionalValueCommand",
    alias: ['f'],
    valueFormat: 'hex' as const,
    suggestion: ' - Enter #HEX color (No value = toggle)',
    functionWithoutParam: () => toggleFill(),
    functionWithParam: (value: string) => setFill(value),
  },
  Rotate: {
    type: "optionalValueCommand",
    alias: ['ro'],
    valueFormat: 'number' as const,
    suggestion: ' - Enter rotation angle in degrees',
    functionWithoutParam: () => rotate(0),
    functionWithParam: (value: string) => {rotate(parseInt(value));
    }
  },
  Scale: {
    type: "commandWithValue",
    alias: ['s'],
    valueFormat: "number",
    suggestion: " - Value in % (x1 = 100%)",
    functionWithParam: (value: string) => scale(value),
  },
  ScaleWidth: {
    type: "commandWithValue",
    alias: ['sw'],
    valueFormat: "number",
    suggestion: " - New desired width in px",
    functionWithParam: (value: string) => scale(value, 'width'),
  },
  ScaleHeight: {
    type: "commandWithValue",
    alias: ['sh'],
    valueFormat: "number",
    suggestion: " - New desired height in px",
    functionWithParam: (value: string) => scale(value, 'height'),
  },
  RadiusTopLeft: {
    type: "commandWithValue",
    alias: ['rtl'],
    valueFormat: 'number' as const,
    suggestion: ' - Top left radius',
    functionWithParam: (value: string) => setRadius({topLeftRadius: value}),
  },
  RadiusTopRight: {
    type: "commandWithValue",
    alias: ['rtr'],
    valueFormat: 'number' as const,
    suggestion: ' - Top right radius',
    functionWithParam: (value: string) => setRadius({topRightRadius: value}),
  },
  RadiusBottomRight: {
    type: "commandWithValue",
    alias: ['rbr'],
    valueFormat: 'number' as const,
    suggestion: ' - Bottom right radius',
    functionWithParam: (value: string) => setRadius({bottomRightRadius: value}),
  },
  RadiusBottomLeft: {
    type: "commandWithValue",
    alias: ['rbl'],
    valueFormat: 'number' as const,
    suggestion: ' - Bottom left radius',
    functionWithParam: (value: string) => setRadius({bottomLeftRadius: value}),
  },
  RadiusAll: {
    type: "commandWithValue",
    alias: ['r'],
    valueFormat: 'number' as const,
    suggestion: ' - All corners radius',
    functionWithParam: (value: string) => setRadius({topLeftRadius: value, topRightRadius: value, bottomRightRadius: value, bottomLeftRadius: value}),
  },
  RadiusLeft: {
    type: "commandWithValue",
    alias: ['rl'],
    valueFormat: 'number' as const,
    suggestion: ' - Left side radius',
    functionWithParam: (value: string) => setRadius({topLeftRadius: value, bottomLeftRadius: value}),
  },
  RadiusTop: {
    type: "commandWithValue",
    alias: ['rt'],
    valueFormat: 'number' as const,
    suggestion: ' - Top side radius',
    functionWithParam: (value: string) => setRadius({topLeftRadius: value, topRightRadius: value}),
  },
  RadiusRight: {
    type: "commandWithValue",
    alias: ['rr'],
    valueFormat: 'number' as const,
    suggestion: ' - Right side radius',
    functionWithParam: (value: string) => setRadius({topRightRadius: value, bottomRightRadius: value}),
  },
  RadiusBottom: {
    type: "commandWithValue",
    alias: ['rb'],
    valueFormat: 'number' as const,
    suggestion: ' - Bottom side radius',
    functionWithParam: (value: string) => setRadius({bottomLeftRadius: value, bottomRightRadius: value}), 
  },
  ClipContent: {
    type: "commandWithoutValue",
    alias: ['cc'],
    suggestion: ' - 📎',
    functionWithoutParam: () => clipContent()
  },
  Visible: {
    type: "commandWithoutValue",
    alias: ['v'],
    suggestion: ' - 👁️',
    functionWithoutParam: () => toggleVisibility()
  },
  Opacity: {
    type: "optionalValueCommand",
    alias: ['o'],
    valueFormat: 'number' as const,
    suggestion: ' - In % (No value = 0% ↔️ 100%)',
    functionWithParam: (value: string) => setOpacity(value),
    functionWithoutParam: () => toggleOpacity(),
  },
  Duplicate: {
    type: "commandWithoutValue",
    alias: ['d'],
    suggestion: ' - 🔄',
    functionWithoutParam: () => duplicate()
  },
  Stroke: {
    type: "optionalValueCommand",
    alias: ['st','b'],
    valueFormat: 'number' as const,
    suggestion: ' - border in px (No value = toggle)',
    functionWithParam: (value: string) => setBorder('all', value),
    functionWithoutParam: () => toggleBorder('all'),
  },
  StrokeLeft: {
    type: "optionalValueCommand",
    alias: ['stl','bl'],
    valueFormat: 'number' as const,
    suggestion: ' - border in px (No value = toggle)',
    functionWithParam: (value: string) => setBorder('left', value),
    functionWithoutParam: () => toggleBorder('left'),
  },
  StrokeRight: {
    type: "optionalValueCommand",
    alias: ['str','br'],
    valueFormat: 'number' as const,
    suggestion: ' - border in px (No value = toggle)',
    functionWithParam: (value: string) => setBorder('right', value),
    functionWithoutParam: () => toggleBorder('right'),
  },
  StrokeTop: {
    type: "optionalValueCommand",
    alias: ['stt','bt'],
    valueFormat: 'number' as const,
    suggestion: ' - border in px (No value = toggle)',
    functionWithParam: (value: string) => setBorder('top', value),
    functionWithoutParam: () => toggleBorder('top'),
  },
  StrokeBottom: {
    type: "optionalValueCommand",
    alias: ['stb','bb'],
    valueFormat: 'number' as const,
    suggestion: ' - border in px (No value = toggle)',
    functionWithParam: (value: string) => setBorder('bottom', value),
    functionWithoutParam: () => toggleBorder('bottom'),
  },
  StrokeAlignCenter: {
    type: "commandWithoutValue",
    alias: ['stc','bc'],
    suggestion: ' - ◌',
    functionWithoutParam: () => setBorderAlign('CENTER')
  },
  StrokeAlignInside: {
    type: "commandWithoutValue",
    alias: ['sti','bi'],
    suggestion: ' - ⊖',
    functionWithoutParam: () => setBorderAlign('INSIDE')
  },
  StrokeAlignOutside: {
    type: "commandWithoutValue",
    alias: ['sto','bo'],
    suggestion: ' - ◯',
    functionWithoutParam: () => setBorderAlign('OUTSIDE')
  },
  ToggleTheme: {
    type: "commandWithoutValue",
    alias: ['t'],
    suggestion: ' - 🌗',
    functionWithoutParam: () => toggleTheme()
  },
  
  AlignTopLeft: {
    type: "commandWithoutValue",
    alias: ['atl','alt'],
    suggestion: ' - ↖',
    functionWithoutParam: () => setAlignment({ primary: 'MIN', counter: 'MIN' },{ primary: 'MIN', counter: 'MIN' }),
  },
  AlignTopCenter: {
    type: "commandWithoutValue",
    alias: ['atc','act'],
    suggestion: ' - ↑',
    functionWithoutParam: () => setAlignment({ primary: 'CENTER', counter: 'MIN' },{ primary: 'MIN', counter: 'CENTER' }),
  },
  AlignTopRight: {
    type: "commandWithoutValue",
    alias: ['atr','art'],
    suggestion: ' - ↗',
    functionWithoutParam: () => setAlignment({ primary: 'MAX', counter: 'MIN' },{ primary: 'MIN', counter: 'MAX' }),
  },
  AlignCenterLeft: {
    type: "commandWithoutValue",
    alias: ['acl','alc'],
    suggestion: ' - ←',
    functionWithoutParam: () => setAlignment({ primary: 'MIN', counter: 'CENTER' },{ primary: 'CENTER', counter: 'MIN' }),
  },
  AlignCenterCenter: {
    type: "commandWithoutValue",
    alias: ['acc'],
    suggestion: ' - ・',
    functionWithoutParam: () => setAlignment({ primary: 'CENTER', counter: 'CENTER' },{ primary: 'CENTER', counter: 'CENTER' }),
  },
  AlignCenterRight: {
    type: "commandWithoutValue",
    alias: ['acr','arc'],
    suggestion: ' - →',
    functionWithoutParam: () => setAlignment({ primary: 'MAX', counter: 'CENTER' },{ primary: 'CENTER', counter: 'MAX' }),
  },
  AlignBottomLeft: {
    type: "commandWithoutValue",
    alias: ['abl','alb'],
    suggestion: ' - ↙',
    functionWithoutParam: () => setAlignment({ primary: 'MIN', counter: 'MAX' },{ primary: 'MAX', counter: 'MIN' }),
  },
  AlignBottomRight: {
    type: "commandWithoutValue",
    alias: ['abr','arb'],
    suggestion: ' - ↘',
    functionWithoutParam: () => setAlignment({ primary: 'MAX', counter: 'MAX' },{ primary: 'MAX', counter: 'MAX' }),
  },
  AlignBottomCenter: {
    type: "commandWithoutValue",
    alias: ['abc','acb'],
    suggestion: ' - ↓',
    functionWithoutParam: () => setAlignment({ primary: 'CENTER', counter: 'MAX' },{ primary: 'MAX', counter: 'CENTER' }),
  },
  MaxHeight: {
    type: "optionalValueCommand",
    alias: ['maxh'],
    valueFormat: 'number' as const,
    suggestion: ' - ↕ in px (No value = toggle)',
    functionWithParam: (value: string) => maxDimension({value:value, type: 'max', direction: 'height', null: false}),
    functionWithoutParam: () => maxDimension({type: 'max', direction: 'height', null: true}),
  },
  MaxWidth: {
    type: "optionalValueCommand",
    alias: ['maxw'],
    valueFormat: 'number' as const,
    suggestion: ' - ↔ in px (No value = toggle)',
    functionWithParam: (value: string) => maxDimension({value:value, type: 'max', direction: 'width', null: false}),
    functionWithoutParam: () => maxDimension({type: 'max', direction: 'width', null: true}),
  },
  MinHeight: {
    type: "optionalValueCommand",
    alias: ['minh'],
    valueFormat: 'number' as const,
    suggestion: ' - ↓↑ in px (No value = toggle)',
    functionWithParam: (value: string) => maxDimension({value:value, type: 'min', direction: 'height', null: false}),
    functionWithoutParam: () => maxDimension({type: 'min', direction: 'height', null: true}),
  },
  MinWidth: {
    type: "optionalValueCommand",
    alias: ['minw'],
    valueFormat: 'number' as const,
    suggestion: ' - →← in px (No value = toggle)',
    functionWithParam: (value: string) => maxDimension({value:value, type: 'min', direction: 'width', null: false}),
    functionWithoutParam: () => maxDimension({type: 'min', direction: 'width', null: true}),
  },
  RemoveEffect: {
    type: "commandWithoutValue",
    alias: ['re'],
    suggestion: ' - 📎',
    functionWithoutParam: () => removeEffect()
  },
  ExportSVG: {
    type: "commandWithoutValue",
    alias: ['svg'],
    suggestion: ' - 🎨',
    functionWithoutParam: () => exportAs({format:'SVG',constraintType: 'SCALE',constraintValue: '1'}),
  },
  ExportPDF: {
    type: "commandWithoutValue",
    alias: ['pdf'],
    suggestion: ' - 📄',
    functionWithoutParam: () => exportAs({format:'PDF',constraintType: 'SCALE',constraintValue: '1'}),
  },
  ExportPNG: {
    type: "optionalValueCommand",
    alias: ['png'],
    valueFormat: 'number' as const,
    suggestion: ' - Opt: Scale (e.g. png2 = 2x)',
    functionWithParam: (value: string) => exportAs({format:'PNG',constraintType: 'SCALE',constraintValue: value}),
    functionWithoutParam: () => exportAs({format:'PNG',constraintType: 'SCALE',constraintValue: '1'}),
  },
  ExportJPG: {
    type: "optionalValueCommand",
    alias: ['jpg'],
    valueFormat: 'number' as const,
    suggestion: ' - Opt: Scale (e.g. jpg2 = 2x)',
    functionWithParam: (value: string) => exportAs({format:'JPG',constraintType: 'SCALE',constraintValue: value}),
    functionWithoutParam: () => exportAs({format:'JPG',constraintType: 'SCALE',constraintValue: '1'}),
  },
  ExportPNGWidth: {
    type: "commandWithValue",
    alias: ['pngw'],
    valueFormat: 'number' as const,
    suggestion: ' - Export Width in px',
    functionWithParam: (value: string) => exportAs({format:'PNG',constraintType: 'WIDTH',constraintValue: value}),
  },
  ExportJPGWidth: {
    type: "commandWithValue",
    alias: ['jpgw'],
    valueFormat: 'number' as const,
    suggestion: ' - Export Width in px',
    functionWithParam: (value: string) => exportAs({format:'JPG',constraintType: 'WIDTH',constraintValue: value}),
  },
  ExportPNGHeight: {
    type: "commandWithValue",
    alias: ['pngh'],
    valueFormat: 'number' as const,
    suggestion: ' - Export Height in px',
    functionWithParam: (value: string) => exportAs({format:'PNG',constraintType: 'HEIGHT',constraintValue: value}),
  },
  ExportJPGHeight: {
    type: "commandWithValue",
    alias: ['jpgh'],
    valueFormat: 'number' as const,
    suggestion: ' - Export Height in px',
    functionWithParam: (value: string) => exportAs({format:'JPG',constraintType: 'HEIGHT',constraintValue: value}),
  },
  // Horizontal Constraints
  ConstraintLeft: {
    type: "commandWithoutValue",
    alias: ['cl'],
    suggestion: ' - Set horizontal constraint to left',
    functionWithoutParam: () => setConstraints('HORIZONTAL', 'MIN'),
  },
  
  ConstraintCenterHorizontal: {
    type: "commandWithoutValue",
    alias: ['cch'],
    suggestion: ' - Set horizontal constraint to center',
    functionWithoutParam: () => setConstraints('HORIZONTAL', 'CENTER'),
  },
  
  ConstraintRight: {
    type: "commandWithoutValue",
    alias: ['cr'],
    suggestion: ' - Set horizontal constraint to right',
    functionWithoutParam: () => setConstraints('HORIZONTAL', 'MAX'),
  },
  
  ConstraintLeftAndRight: {
    type: "commandWithoutValue",
    alias: ['clr'],
    suggestion: ' - Set horizontal constraint to left + right',
    functionWithoutParam: () => setConstraints('HORIZONTAL', 'STRETCH'),
  },
  
  ConstraintScaleHorizontal: {
    type: "commandWithoutValue",
    alias: ['csh'],
    suggestion: ' - Set horizontal constraint to scale',
    functionWithoutParam: () => setConstraints('HORIZONTAL', 'SCALE'),
  },
  
  // Vertical Constraints
  ConstraintTop: {
    type: "commandWithoutValue",
    alias: ['ct'],
    suggestion: ' - Set vertical constraint to top',
    functionWithoutParam: () => setConstraints('VERTICAL', 'MIN'),
  },
  
  ConstraintCenterVertical: {
    type: "commandWithoutValue",
    alias: ['ccv'],
    suggestion: ' - Set vertical constraint to center',
    functionWithoutParam: () => setConstraints('VERTICAL', 'CENTER'),
  },
  
  ConstraintBottom: {
    type: "commandWithoutValue",
    alias: ['cb'],
    suggestion: ' - Set vertical constraint to bottom',
    functionWithoutParam: () => setConstraints('VERTICAL', 'MAX'),
  },
  
  ConstraintTopAndBottom: {
    type: "commandWithoutValue",
    alias: ['ctb'],
    suggestion: ' - Set vertical constraint to top + bottom',
    functionWithoutParam: () => setConstraints('VERTICAL', 'STRETCH'),
  },
  
  ConstraintScaleVertical: {
    type: "commandWithoutValue",
    alias: ['csv'],
    suggestion: ' - Set vertical constraint to scale',
    functionWithoutParam: () => setConstraints('VERTICAL', 'SCALE'),
  },  
  CornerSmoothing: {
    type: "commandWithValue",
    alias: ['cs'],
    valueFormat: "number",
    suggestion: " - Corner smoothing (0-100)",
    functionWithParam: (value: string) => setCornerSmoothing(value),
  },
  CornerSmoothingIOS: {
    type: "commandWithoutValue",
    alias: ['csi'],
    suggestion: " - 📱 (IOS)",
    functionWithoutParam: () => setCornerSmoothing("60"),
  },
} satisfies Record<string, CommandWithValue | CommandWithoutValue | OptionalValueCommand>;


const COMMANDS: Array<Command & { name: CommandName }> = (Object.keys(COMMAND_DEFINITIONS) as CommandName[])
.map((name) => {
  const def = COMMAND_DEFINITIONS[name];
  return { name, ...def };
})
.sort((a, b) => {
  // First sort by alias length
  if (a.alias[0].length !== b.alias[0].length) {
    return a.alias[0].length - b.alias[0].length;
  }
  
  // If lengths are equal, sort alphabetically
  return a.alias[0].toLowerCase().localeCompare(b.alias[0].toLowerCase());
});

// Unified findCommand function that handles both exact and partial matches
function findCommand<T extends boolean>(
  part: string, 
  exact: T
): T extends true ? (Command & { name: CommandName }) | null : Array<Command & { name: CommandName }> {
  const commandPart = part.match(COMMAND_PART_REGEX)?.[0];
  console.log('Part:', part);
  console.log('Command part:', commandPart);
  
  if (!commandPart) {
    return (exact ? null : []) as T extends true 
      ? (Command & { name: CommandName }) | null 
      : Array<Command & { name: CommandName }>;
  }
  
  const matcher = (cmd: Command & { name: CommandName }) => {
    const cmdLower = commandPart.toLowerCase();
    const nameLower = cmd.name.toLowerCase();
    const aliases = Array.isArray(cmd.alias) ? cmd.alias : [cmd.alias];
    
    if (exact) {
      return aliases.some(alias => alias.toLowerCase() === cmdLower) || 
             nameLower === cmdLower;
    }
    return aliases.some(alias => alias.toLowerCase().startsWith(cmdLower)) || 
           nameLower.startsWith(cmdLower);
  };
  
  return (exact 
    ? COMMANDS.find(matcher) || null
    : COMMANDS.filter(matcher)
  ) as T extends true 
    ? (Command & { name: CommandName }) | null 
    : Array<Command & { name: CommandName }>;
}


// Update the VALUE_FORMAT_REGEX for numbers
const VALUE_FORMAT_REGEX = {
  // Support parentheses and 'x' for multiplication
  number: /-?\s*\(?(\d+(\.\d+)?(?:\s*[-+*/x]\s*\(?-?\d+(\.\d+)?\)?)*\)?)/, 
  hex: /#?[0-9a-fA-F]{3,6}\b/,
  text: /.+/
};

function calculateExpression(expression: string): number {
  // Remove spaces and normalize 'x' to '*'
  const sanitizedExp = expression
  .replace(/\s+/g, '')
  .replace(/x/gi, '*');
  
  // Validate the expression contains only numbers, allowed operators, and parentheses
  if (!/^-?\(?\d+(\.\d+)?(?:[-+*/]\(?-?\d+(\.\d+)?\)?)*\)?$/.test(sanitizedExp)) {
    throw new Error('Invalid calculation format');
  }
  
  try {
    // Using Function constructor is safe here since we've validated the input
    // eslint-disable-next-line no-new-func
    return Function(`return ${sanitizedExp}`)();
  } catch (error) {
    throw new Error('Invalid calculation');
  }
}

const COMMAND_SPLITTER_REGEX = /[\s,]+/;
const COMMAND_PART_REGEX = /^(-(?![\d])|(-)?[\p{L}]+(-[\p{L}]+)*)(?=[\d]|-[\d]|-$|$)/u;



let originalInput = '';


// Manages command suggestions and autocompletion as the user types
figma.parameters.on('input', ({ key, query, result }) => {
  
  // Only process 'command' parameter inputs
  if (key !== 'command') return;
  originalInput = query;
  
  // Split input into parts by spaces
  const parts = query.split(' ');
  const currentPart = parts[parts.length - 1];
  
  // If query is empty or ends with space, show all available commands
  if (!query || query.endsWith(' ')) {
    result.setSuggestions(COMMANDS.map((cmd) => `${cmd.name} (${cmd.alias.join(', ')})`));
    return;
  }
  
  // Display a summary of already defined commands
  const completeCommands = parts.slice(0, -1).map((part) => {
    const matchedCommand = findCommand(part, true);
    const hasHex = VALUE_FORMAT_REGEX.hex.exec(part);
    const hasNumber = VALUE_FORMAT_REGEX.number.exec(part);
    
    if (matchedCommand) {
      if (matchedCommand.type === 'commandWithValue') {
        if (hasHex) return `${matchedCommand.name}:${hasHex[0]}`;
        if (hasNumber) {
          try {
            const computedValue = calculateExpression(hasNumber[0]);
            return `${matchedCommand.name}:${computedValue}`;
          } catch {
            return `${matchedCommand.name}:${hasNumber[0]}`;
          }
        }
      }
      else if (matchedCommand.type === 'optionalValueCommand') {
        if (hasHex) {
          return `${matchedCommand.name}:${hasHex[0]}`;
        } else if (hasNumber) {
          try {
            const computedValue = calculateExpression(hasNumber[0]);
            return `${matchedCommand.name}:${computedValue}`;
          } catch {
            return `${matchedCommand.name}:${hasNumber[0]}`;
          }
        } else {
          return `${matchedCommand.name}`;
        }
      }
      else {
        return matchedCommand.name;
      }
    } else {
      return "Not Found";
    }
  });
  
  // Generate filtered and sorted command suggestions based on current input
  const suggestions = (findCommand(currentPart, false))
  .map((cmd) => {
    if (cmd.alias.some(alias => currentPart.toLowerCase() === alias.toLowerCase())) {
      return {
        name: `${currentPart} (${cmd.name})${cmd.suggestion}`,
        priority: 1  // Give exact alias matches highest priority
      };
    }
    if (currentPart.toLowerCase() === cmd.name.toLowerCase()) {
      return {
        name: `${cmd.name}${cmd.suggestion}`,
        priority: 2  // Give exact name matches second priority
      };
    }
    return {
      name: `${cmd.name} (${cmd.alias.join(', ')})`,
      priority: 3  // Give partial matches lowest priority
    };
  })
  .sort((a, b) => a.priority - b.priority)
  .map(suggestion => ({ name: suggestion.name }));  // Remove priority before setting suggestions
  
  // Process the current (last) command
  const matchedCommand = findCommand(currentPart, true);
  
  const hasNumber = VALUE_FORMAT_REGEX.number.exec(currentPart);
  const hasHex = VALUE_FORMAT_REGEX.hex.exec(currentPart);
  
  if (matchedCommand) {
    // Only show command summary if we have a valid value for the command type
    const isValidValue = 
    (matchedCommand.type === "commandWithValue" || matchedCommand.type === "optionalValueCommand") && 
    'valueFormat' in matchedCommand && (
      matchedCommand.valueFormat === 'hex' ? hasHex :
      matchedCommand.valueFormat === 'number' ? hasNumber :
      true
    );
    
    if (isValidValue && (hasHex || hasNumber)) {
      if (matchedCommand.valueFormat === 'hex' && hasHex) {
        completeCommands.push(`${matchedCommand.name}:${hasHex[0]}`);
      }
      else if (matchedCommand.valueFormat === 'number' && hasNumber) {
        try {
          const computedValue = calculateExpression(hasNumber[0]);
          completeCommands.push(`${matchedCommand.name}:${computedValue}`);
        } catch {
          completeCommands.push(`${matchedCommand.name}:${hasNumber[0]}`);
        }
      }
      result.setSuggestions([completeCommands.join(' | ')]);
      return;
    } else if ('valueFormat' in matchedCommand && matchedCommand.valueFormat === 'hex' && !hasHex) {
      // Show full suggestion for hex commands without valid hex value
      result.setSuggestions([`${matchedCommand.name} (${matchedCommand.alias[0]})${matchedCommand.suggestion}`]);
      return;
    } else if (completeCommands.length > 0 && matchedCommand && (matchedCommand.type === 'optionalValueCommand' || matchedCommand.type === 'commandWithoutValue')) {
      // Show combined suggestion for optional value commands
      result.setSuggestions([`${completeCommands.join(' | ')} | ${matchedCommand.name} (${matchedCommand.alias[0]})${matchedCommand.suggestion}`]);
      return;
    }
  }
  
  // Set final suggestions, showing "No command found" message if no matches
  if (suggestions.length === 0) {
    result.setSuggestions([`No command found for "${currentPart}"`]);
  } else {
    result.setSuggestions(suggestions);
  }
});

figma.on('run', async (parameters) => {
  try {    
    // If we have original input, use that
    if (originalInput.trim()) {
      const commandString = originalInput.trim();
      const commands = commandString.split(COMMAND_SPLITTER_REGEX).filter(Boolean);
      
      for (const cmd of commands) {
        if (findCommand(cmd, true)) {
          console.log('Command found: ', cmd);
          await executeCommand(cmd);
        } else {
          // If command try with parameters
          console.log('Command not found: ', cmd);
          await executeCommand(parameters.parameters?.command || '');
        }
      }
    } 
    // Only use parameters if we don't have any inputs
    else if (parameters?.parameters?.command) {
      await executeCommand(parameters.parameters.command);
    }
    
    figma.closePlugin();
    
  } catch (error) {
    figma.notify(error instanceof Error ? error.message : 'An unknown error occurred');
    figma.closePlugin();
  }
});

async function processCommand(commandName: CommandName, value?: string): Promise<void> {
  const command = COMMAND_DEFINITIONS[commandName];
  if (!command) return;
  
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
  
  const command = findCommand(cmd, true);
  if (!command) {
    return;
  }
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  
  const loadingNotification = figma.notify(`Executing ${command.name}...`, { timeout: 0 });
  
  try {
    await delay(1);
    if (command.type === 'commandWithoutValue') {
      await processCommand(command.name);
    } else {
      const value = extractValue(cmd, command.valueFormat as ValueFormat);
      if (command.type === 'commandWithValue') {
        if (value) {
          await processCommand(command.name, value);
        }
        else {
          figma.notify(`No value provided for ${command.name}`);
        }
      } else if (command.type === 'optionalValueCommand') {
        if (value) {
          await command.functionWithParam(value);
        } else {
          await command.functionWithoutParam();
        }
      }
    }
  } finally {
    await delay(1);
    loadingNotification.cancel();
  }
}

// Update the input handler to use generic value detection
// Update the extractValue function
function extractValue(text: string, format: ValueFormat): string | null {
  const match = text.match(VALUE_FORMAT_REGEX[format]);
  if (!match) return null;
  
  if (format === 'hex') {
    const value = match[0];
    return value.startsWith('#') ? value : `#${value}`;
  }
  
  if (format === 'number') {
    const expression = match[0];
    try {
      // Calculate the result if it's an expression
      const result = calculateExpression(expression);
      return result.toString();
    } catch {
      return expression;
    }
  }
  
  return match[0];
}

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
      // Store original position if not already stored
      if (!node.getPluginData('originalX')) {
        node.setPluginData('originalX', node.x.toString());
        node.setPluginData('originalY', node.y.toString());
      }
      
      // Get original position
      const originalX = parseFloat(node.getPluginData('originalX'));
      const originalY = parseFloat(node.getPluginData('originalY'));
      
      // Reset rotation
      node.rotation = 0;
      const theta = value * (Math.PI/180); // radians
      
      // Use original position for center calculation
      const cx = originalX + node.width/2;
      const cy = originalY + node.height/2;
      
      // Calculate new position using original coordinates
      const newx = Math.cos(theta) * originalX + originalY * Math.sin(theta) 
                  - cy * Math.sin(theta) - cx * Math.cos(theta) + cx;
      const newy = -Math.sin(theta) * originalX + cx * Math.sin(theta) 
                  + originalY * Math.cos(theta) - cy * Math.cos(theta) + cy;
      
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

function duplicate() {
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  const duplicates = selection.map(node => node.clone());
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

function setAlignment(horizontal: {
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
  
  selection.forEach(node => {
    if (!isAutoLayoutNode(node)) {
      figma.notify('Only auto-layout frames can have axis alignment');
      return;
    }
    
    if (node.layoutMode === 'NONE') {
      figma.notify('Frame must have auto-layout enabled');
      return;
    }
    
    const isHorizontal = node.layoutMode === 'HORIZONTAL';
    const { primary, counter } = isHorizontal ? horizontal : vertical;
    
    alignItems('PRIMARY', primary, node);
    alignItems('COUNTER', counter, node);
    
    figma.notify(`Alignment set for ${isHorizontal ? 'horizontal' : 'vertical'} layout`);
  });
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
        console.log("value:", value);
        console.log("direction:", direction);
        console.log("type:", type);        
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
  console.log("hzezf -- constraintValue:", constraintValue);
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
      console.log('Message from UI:', msg);
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