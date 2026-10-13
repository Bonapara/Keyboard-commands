import { COMMAND_SPLITTER_REGEX } from './constants';

// Binding triggers: "?" (QWERTY-friendly) and ";" (AZERTY-friendly, unshifted
// on French layouts). Both are accepted interchangeably.
const BINDING_TRIGGER = '[?;]';
const BINDING_ALIAS = '-?[a-z]+';

// Lenient: accepts a prefix directly adjacent to the alias (e.g. "w100f?blue").
// Used when parsing a finalized command string for execution / previous-command
// tracking — we want to interpret as much as possible.
const BINDING_PATTERN = new RegExp(`^(.*?)\\s*(${BINDING_ALIAS})${BINDING_TRIGGER}(.*)$`, 'i');

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

// The binding being typed is the last "alias?" (at the start or after a
// space). Past the first one, only binding command aliases count, so
// "ip?Label:Delete item?" stays one Instance Property search instead of a
// search for an "item" command.
export function parseTypedBindingSegment(
  segment: string,
  isBindingAlias: (alias: string) => boolean
): TypedBinding | null {
  const triggerRegex = new RegExp(`(^|\\s)(${BINDING_ALIAS})${BINDING_TRIGGER}`, 'gi');
  let typed: TypedBinding | null = null;
  let match: RegExpExecArray | null;

  while ((match = triggerRegex.exec(segment)) !== null) {
    if (typed && !isBindingAlias(match[2])) continue;
    typed = { alias: match[2], searchTerm: segment.slice(match.index + match[0].length) };
  }

  return typed;
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
// Split at each later "alias?" that starts a word and names a binding command;
// any other "?" or ";" belongs to the value ("ip?Label:Delete item?").
function splitAtInnerBindings(segment: string, isBindingAlias: (alias: string) => boolean): string[] {
  const triggerRegex = /-?[a-z]+[?;]/gi;
  const positions: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = triggerRegex.exec(segment)) !== null) {
    const startsWord = match.index === 0 || /\s/.test(segment[match.index - 1]);
    const alias = match[0].slice(0, -1);
    if (positions.length === 0 || (startsWord && isBindingAlias(alias))) {
      positions.push(match.index);
    }
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

export function buildExecutionPlan(
  segments: string[],
  isBindingAlias: (alias: string) => boolean
): ExecutionStep[] {
  const steps: ExecutionStep[] = [];

  for (const rawSegment of segments) {
    const trimmed = rawSegment.trim();
    if (!trimmed) continue;

    for (const segment of splitAtInnerBindings(trimmed, isBindingAlias)) {
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
