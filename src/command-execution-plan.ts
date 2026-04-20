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

// A segment separator is normally 2+ spaces, but users often string bindings
// with a single space ("f?white bc;red"). Without splitting, parseBindingSegment
// matches only the first trigger and the rest gets swallowed into the value —
// so "bc;red" became part of the Fill search and fuzzy-matched the wrong style.
// Split at each inner "alias[?;]" so every binding becomes its own sub-segment.
function splitAtInnerBindings(segment: string): string[] {
  const triggerRegex = /[a-z]+[?;]/gi;
  const positions: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = triggerRegex.exec(segment)) !== null) {
    positions.push(match.index);
  }
  if (positions.length <= 1) return [segment];

  const pieces: string[] = [];
  pieces.push(segment.slice(0, positions[1]).trim());
  for (let i = 1; i < positions.length; i++) {
    const start = positions[i];
    const end = i + 1 < positions.length ? positions[i + 1] : segment.length;
    pieces.push(segment.slice(start, end).trim());
  }
  return pieces.filter(Boolean);
}

export function buildExecutionPlan(segments: string[]): ExecutionStep[] {
  const steps: ExecutionStep[] = [];

  for (const rawSegment of segments) {
    const trimmed = rawSegment.trim();
    if (!trimmed) continue;

    for (const segment of splitAtInnerBindings(trimmed)) {
      const parsed = parseBindingSegment(segment);
      if (parsed) {
        if (parsed.prefix) {
          appendSimpleCommands(steps, parsed.prefix);
        }

        steps.push({ kind: 'binding', parsed });
        continue;
      }

      appendSimpleCommands(steps, segment);
    }
  }

  return steps;
}
