# Command Language

This plugin behaves like a compact command DSL for Figma selection editing. The important part is not only what each command does, but how input is parsed and how suggestions are resolved.

## Input Surface

- The manifest exposes one plugin parameter: `command`.
- The plugin runs in the Figma editor only.
- The active code path lives in `src/index.ts`.

## Command Lookup Rules

Commands are registered in `src/commands.ts` and resolved by `findCommand()` in `src/utils.ts`.

Lookup order:

1. exact alias match
2. exact command-name match
3. prefix matches
4. contains matches

Selection filtering happens during lookup:

- unsupported node types are filtered out
- unmet special conditions are filtered out

That means autocomplete is intentionally context-sensitive. A command can exist in the registry and still disappear if the current selection cannot use it.

## Separators And Chaining

There are two important separator concepts.

### 1. Normal command splitting

Simple commands are split on:

- whitespace
- a comma followed by optional whitespace and then a letter

Examples:

- `w100 h80`
- `hf, vf`
- `w100 hf f?blue`

Numeric comma lists stay intact:

- `p20,30`
- `r10,20,30,40`

### 2. Segment breaks

`COMMAND_BREAK_PATTERN` is `\\s{2,}`.

Two or more spaces create a new segment. Segments matter for:

- chained suggestion summaries
- history replay summaries
- binding resolution order
- tracking what commands were already set earlier in the chain

Examples:

- `w100  h200`
- `hf  f?blue`

Single-space chains still execute, but double-space segmentation gives the input system more structure.

## Value Formats

Commands use one of three value formats.

- `number`
- `hex`
- `string`

### Number values

Number extraction supports:

- plain numbers: `w100`
- negative values: `y-20`
- arithmetic expressions: `w 1 + 2 x 3`
- percentages: `ls120%`
- comma lists for shorthand commands: `p20,30`, `r10,20,30,40`
- delta syntax: `+10`, `-8`, `*2`, `/2`

Important nuance:

- delta syntax is only truly relative for implementations that call `resolveDelta()`
- commands that only call `Number(...)` or `resolveNumberValue()` treat `+10` as absolute `10`

Delta-aware implementations include:

- resize commands
- rotate
- padding
- radius and corner smoothing
- auto-layout gaps
- max/min dimension constraints
- opacity
- font size

Not every numeric command is delta-aware.

### Hex values

Hex extraction accepts `#abcdef` and normalizes it to a leading `#`.

### String values

String extraction also preserves richer forms used by the binding system:

- `Source : Target`
- `NodeName -> Field`
- `PropertyName:Value`
- `Blue / 500 (Library)`

## Binding Mode

Binding mode is the plugin’s search-driven command form.

### Triggers

Both of these trigger binding mode:

- `?`
- `;`

`;` exists specifically as an AZERTY-friendly alternative.

Examples:

- `f?blue`
- `f;blue`
- `ip?size:large`
- `cs;brand : danger`

### Parsing rules

There are two parsers:

- `parseTypedBindingSegment()` for live typing and suggestions
- `parseBindingSegment()` for final execution

The typed parser is stricter:

- it requires whitespace before the binding alias when a prefix exists
- it avoids ambiguous suggestion mode for mashed input like `w100f?blue`

The execution parser is more lenient:

- it can still interpret `w100f?blue` as `w100` then `f?blue`

### Multiple bindings in one segment

The execution planner splits inner bindings, so this works:

- `f?white bc;red`

Without that split, the second binding would be swallowed into the first search term. This behavior is explicitly tested in `tests/command-input.test.js`.

## Binding Suggestion Sources

Depending on the command, binding suggestions come from different backends.

- styles and variables
- stored libraries
- instance properties
- swap candidates for instances
- override-reset candidates
- colors found in the current selection

Supported binding families in the registry:

- `styles`
- `variables`
- `instanceProperties`
- `instanceSwap`
- `instanceOverrides`
- `libraries`
- `libraryStyles`
- `libraryComponents`
- `selectionColors`

## Two-Stage Binding

Selection-color swapping is the only binding mode that intentionally treats `:` as a two-stage separator.

Form:

- `cs?source : target`

Stage behavior:

1. the left side searches colors already present in the current selection
2. the right side searches replacement styles, variables, or literal colors

Other bindings also use `:`, but there it is part of the value itself, not a two-stage separator.

Examples:

- `ip?State:Active`
- `cs?Primary : Danger`

## Autocomplete Behavior

Autocomplete is implemented in `src/index.ts` and `src/command-input.ts`.

Important details:

- empty input shows all commands
- pristine empty input also prepends up to `3` recent command sequences
- already-used commands in the current chain are annotated as `already set`
- the currently matched command shows its suggestion text
- numeric matches show computed values in the suggestion summary
- command suggestions are display strings, not executable command text
- binding suggestions use `data` as the canonical execution value

### Dropdown selection behavior

When a suggestion is chosen:

- command suggestions replace the last token with the command name
- summary strings containing `|` are not executed directly
- binding selections are resolved later from the original typed input
- trailing separators are preserved so the selection is appended instead of lost

This logic is tested directly in `tests/command-input.test.js`.

## History

History is a first-class command.

- command name: `History`
- aliases: `z`, `hi`

Behavior:

- stored sequences are replayed exactly
- deduplication is based on the summarized sequence
- max history length is `10`
- empty history produces a friendly no-history message

History also powers:

- the `hi` command suggestions
- the recent-sequence suggestions shown when the command input is completely empty

## Recent Values

Binding commands can surface per-command recent values.

Rules:

- stored per command name, not globally
- max `5` recent values per command
- duplicates are moved to the front
- instance-property comma chains are split and stored pair-by-pair

Recent values are intentionally skipped for library toggles because library suggestions are action lists, not value histories.

## Search Matching Rules

Style and variable search is not plain substring matching.

The search layer normalizes:

- `/`, `_`, and `-`
- spaces
- mixed alpha-numeric tokens like `gray500`

Ranking favors:

- exact matches
- normalized exact matches
- compact exact matches
- token-contiguous matches
- starts-with matches
- substring matches

Result shaping:

- deduplicates by item name
- sorts by score, then collection, then natural-name order
- limits to `20` results
- adds color or image icons where possible

## Selection Guards

The registry uses node groups plus special conditions.

### Node-group gates

Examples:

- `RESIZABLE`
- `POSITIONABLE`
- `FILLS_AND_STROKES`
- `CORNER_RADIUS`
- `FRAME_LIKE`
- `TEXT_ONLY`
- `INSTANCE_ONLY`
- `COMPONENT_VARIANT_ONLY`
- `DELETABLE`

### Special-condition gates

Supported conditions:

- `IsAutoLayout`
- `IsInAutoLayout`
- `IsAbsoluteInAutoLayout`
- `IsAutoLayoutWrap`
- `TextStyleApplied`
- `NoTextStyleApplied`
- `IsNotInAutoLayout`

Important nuance:

- `checkSpecialConditions()` uses `some()`, not `every()`
- if a command lists multiple conditions, matching any listed condition is enough

That is why commands like `vf` and `hf` can apply in more than one layout context.

## Error Handling

Execution errors are caught in `executeCommand()` and surfaced as notifications.

Special message shaping exists for:

- font-loading failures
- permission errors
- read-only nodes or properties

Otherwise the original error message is shown.
