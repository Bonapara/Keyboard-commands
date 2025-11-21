// ==========================
// Type Definitions
// ==========================

export type SupportedNodeType = SceneNode['type'];
export type SpecialCondition = 'IsAutoLayout' | 'IsInAutoLayout' | 'IsAbsoluteInAutoLayout' | 'IsAutoLayoutWrap' | 'TextStyleApplied' | 'NoTextStyleApplied' | 'IsNotInAutoLayout';

export type ValueFormat = 'number' | 'hex' | 'string';

// Style and variable binding support
export type StyleBindingType = 'PAINT' | 'TEXT' | 'EFFECT';
export type VariableResolvedType = 'BOOLEAN' | 'COLOR' | 'FLOAT' | 'STRING';

export interface BindingSupport {
  styles?: StyleBindingType[];
  variables?: VariableResolvedType[];
  instanceProperties?: boolean;
  instanceSwap?: boolean;
  libraries?: boolean;
  libraryStyles?: boolean;
  libraryComponents?: boolean;
}

export type CommandWithValue = {
  type: "commandWithValue";
  alias: Array<string>;
  valueFormat: ValueFormat;
  functionWithParam: (value: string) => void;
  suggestion: string;
  supportedNodes?: SupportedNodeType[];
  specialConditions?: SpecialCondition[];
  bindingSupport?: BindingSupport;
};

export type CommandWithoutValue = {
  type: "commandWithoutValue";
  alias: Array<string>;
  functionWithoutParam: () => void;
  suggestion: string;
  supportedNodes?: SupportedNodeType[];
  specialConditions?: SpecialCondition[];
  bindingSupport?: BindingSupport;
};

export type OptionalValueCommand = {
  type: "optionalValueCommand";
  alias: Array<string>;
  valueFormat?: ValueFormat;
  suggestion: string;
  functionWithoutParam: () => void;
  functionWithParam: (value: string) => void;
  supportedNodes?: SupportedNodeType[];
  specialConditions?: SpecialCondition[];
  bindingSupport?: BindingSupport;
};

export type Command = {
  name: string;
  type: "commandWithValue" | "commandWithoutValue" | "optionalValueCommand"
} & (CommandWithValue | CommandWithoutValue | OptionalValueCommand);

// Resolution result
export interface PaintResolution {
  type: 'style' | 'variable' | 'literal';
  styleKey?: string;      // For library import
  variableId?: string;
  variableName?: string;  // For error messages
  isLibraryVariable?: boolean; // Flag for library variables that need importing
  color?: RGB;
}

