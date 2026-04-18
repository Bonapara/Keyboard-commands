import { COMMAND_SPLITTER_REGEX } from './constants';

// Binding triggers: "?" (QWERTY-friendly) and ";" (AZERTY-friendly, unshifted
// on French layouts). Both are accepted interchangeably.
const BINDING_TRIGGER = '[?;]';

// Lenient: accepts a prefix directly adjacent to the alias (e.g. "w100f?blue").
// Used when parsing a finalized command string for execution / previous-command
// tracking — we want to interpret as much as possible.
const BINDING_PATTERN = new RegExp(`^(.*?)\\s*([a-z]+)${BINDING_TRIGGER}(.*)$`, 'i');

// Strict: requires whitespace between prefix and alias (or no prefix at all).
// Used while the user is still typing, so we don't surface binding suggestions
// for ambiguous mashed-together input like "w100f?blue".
const BINDING_INPUT_WITH_PREFIX = new RegExp(`^(.*?)\\s+([a-z]+)${BINDING_TRIGGER}(.*)$`, 'i');
const BINDING_INPUT_NO_PREFIX = new RegExp(`^([a-z]+)${BINDING_TRIGGER}(.*)$`, 'i');

export const BINDING_TRIGGER_CHARS = '?;';

export interface ParsedBinding {
  prefix: string;
  alias: string;
  value: string;
}

export interface TypedBinding {
  alias: string;
  searchTerm: string;
}

export interface SimpleExecutionStep {
  kind: 'simple';
  command: string;
}

export interface BindingExecutionStep {
  kind: 'binding';
  parsed: ParsedBinding;
}

export type ExecutionStep = SimpleExecutionStep | BindingExecutionStep;

export function parseBindingSegment(segment: string): ParsedBinding | null {
  const match = segment.match(BINDING_PATTERN);
  if (!match) return null;
  return { prefix: match[1].trim(), alias: match[2], value: match[3] };
}

export function parseTypedBindingSegment(segment: string): TypedBinding | null {
  const withPrefix = segment.match(BINDING_INPUT_WITH_PREFIX);
  if (withPrefix) {
    return { alias: withPrefix[2], searchTerm: withPrefix[3] };
  }

  const noPrefix = segment.match(BINDING_INPUT_NO_PREFIX);
  if (noPrefix) {
    return { alias: noPrefix[1], searchTerm: noPrefix[2] };
  }

  return null;
}

function appendSimpleCommands(steps: ExecutionStep[], value: string): void {
  steps.push(
    ...value
      .split(COMMAND_SPLITTER_REGEX)
      .filter(Boolean)
      .map((command) => ({ kind: 'simple' as const, command }))
  );
}

export function buildExecutionPlan(segments: string[]): ExecutionStep[] {
  const steps: ExecutionStep[] = [];

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;

    const parsed = parseBindingSegment(trimmed);
    if (parsed) {
      if (parsed.prefix) {
        appendSimpleCommands(steps, parsed.prefix);
      }

      steps.push({ kind: 'binding', parsed });
      continue;
    }

    appendSimpleCommands(steps, trimmed);
  }

  return steps;
}
