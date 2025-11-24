export type SupportedNodeType = SceneNode['type'];
export type SpecialCondition = 'IsAutoLayout' | 'IsInAutoLayout' | 'IsAbsoluteInAutoLayout' | 'IsAutoLayoutWrap' | 'TextStyleApplied' | 'NoTextStyleApplied' | 'IsNotInAutoLayout';

export type ValueFormat = 'number' | 'hex' | 'string';

export type StyleBindingType = 'PAINT' | 'TEXT' | 'EFFECT' | 'GRID';
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

export interface PaintResolution {
  type: 'style' | 'variable' | 'literal';
  styleKey?: string;
  variableId?: string;
  variableName?: string;
  isLibraryVariable?: boolean;
  color?: RGB;
}

export interface StyleResolution {
  type: 'style' | 'variable' | 'literal';
  styleKey?: string;
  styleType?: StyleBindingType;
  variableId?: string;
  variableName?: string;
  isLibraryVariable?: boolean;
  color?: RGB;
}

export type LibraryItemType = 'PAINT' | 'TEXT' | 'EFFECT' | 'GRID' | 'COMPONENT' | 'VARIABLE_COLOR' | 'VARIABLE_FLOAT' | 'VARIABLE_STRING' | 'VARIABLE_BOOLEAN';
export type LibraryItem = [string, string, LibraryItemType, string?];

export type LibraryData = Record<string, LibraryItem[]>;
