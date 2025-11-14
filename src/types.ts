// ==========================
// Type Definitions
// ==========================

export type SupportedNodeType = SceneNode['type'];
export type SpecialCondition = 'IsAutoLayout' | 'IsInAutoLayout' | 'IsAbsoluteInAutoLayout' | 'IsAutoLayoutWrap' | 'IsVisible' | 'TextStyleApplied' | 'NoTextStyleApplied' | 'IsNotInAutoLayout';

export type ValueFormat = 'number' | 'hex';

export type CommandWithValue = {
  type: "commandWithValue";
  alias: Array<string>;
  valueFormat: ValueFormat;
  functionWithParam: (value: string) => void;
  suggestion: string;
  supportedNodes?: SupportedNodeType[];
  specialConditions?: SpecialCondition[];
};

export type CommandWithoutValue = {
  type: "commandWithoutValue";
  alias: Array<string>;
  functionWithoutParam: () => void;
  suggestion: string;  
  supportedNodes?: SupportedNodeType[];
  specialConditions?: SpecialCondition[];
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
};

export type Command = {
  name: string;
  type: "commandWithValue" | "commandWithoutValue" | "optionalValueCommand"
} & (CommandWithValue | CommandWithoutValue | OptionalValueCommand);

