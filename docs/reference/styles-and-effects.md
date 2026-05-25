# Styles And Effects

This file covers fills, strokes, color swaps, corner styling, effects, and theme toggling.

## Match Style

- `mst`: copy style from the first selected node to the rest of the selection

Behavior:

- copies fill, stroke, effects, radius, opacity, and text styling
- preserves linked fill/stroke/effect/text styles when the source node uses them
- only applies properties that both the source and target node types support

## Fill

- `f`: apply a fill value, or toggle fill when no value is given

Binding support:

- local paint styles
- stored-library paint styles
- color variables

Value forms:

- hex literal like `#ff6600`
- style reference from autocomplete
- variable reference from autocomplete

No-value behavior:

- if the node currently has fills, remove them
- if the node has no fills, add a black solid fill

Variable behavior:

- imports library variables if required
- binds the paint's `color` field instead of flattening the variable to a literal

Style behavior:

- imports remote styles if needed
- sets the node fill style id asynchronously

## Radius Family

- `rtl`: top-left radius
- `rtr`: top-right radius
- `rbr`: bottom-right radius
- `rbl`: bottom-left radius
- `r`: all corners, with shorthand
- `rl`: left side
- `rt`: top side
- `rr`: right side
- `rb`: bottom side

Shorthand behavior for `r`:

- `r10` -> all corners `10`
- `r10,20` -> top-left/bottom-right `10`, top-right/bottom-left `20`
- `r10,20,30` -> top-left `10`, top-right/bottom-left `20`, bottom-right `30`
- `r10,20,30,40` -> top-left/top-right/bottom-right/bottom-left

Notes:

- values are delta-aware
- no-value forms on optional commands reset the targeted corner set to `0`
- unsupported nodes are filtered by the `CORNER_RADIUS` node group

## Corner Smoothing

- `csm`: explicit smoothing value
- `csi`: preset smoothing value `60`

Behavior:

- the explicit command is delta-aware
- values are clamped into `0..100`

## Stroke Width Commands

- `st`, `b`: all sides
- `stl`, `bl`: left side
- `str`, `br`: right side
- `stt`, `bt`: top side
- `stb`, `bb`: bottom side

Binding support:

- float variables for width values

Important nuance:

- numeric `+10` is not relative here; the border-width path resolves numbers as absolute values unless a bound variable is chosen

No-value behavior:

- `st` toggles the overall border on or off
- side commands toggle just that side

Per-side implementation details:

- if the node is not already using `INSIDE` stroke alignment, the plugin switches it to `INSIDE` before editing side weights
- when converting from a uniform stroke, existing weight is seeded into all sides first
- if the stroke was previously invisible, all side weights are zeroed before enabling the requested side

Default toggle width:

- `1px`

## Stroke Color

- `stc`, `bc`: set stroke color/style/variable

Binding support:

- local paint styles
- stored-library paint styles
- color variables

Important no-value behavior:

- `stc` / `bc` with no value does not only toggle color
- it routes to `toggleBorder('all')`, which toggles overall stroke presence

## Stroke Alignment

- `sac`, `scc`: align stroke center
- `sti`, `bi`: align stroke inside
- `sto`, `bo`: align stroke outside

Behavior:

- simply writes the stroke alignment on supported nodes

## Swap Fill And Stroke

- `sfs`: swap fill and stroke paints

Behavior:

- swaps current fill and stroke paint arrays
- if the node gains a stroke but had `0` weight, the plugin sets stroke weight to `1`
- skips nodes that do not expose both fills and strokes

## Effect Commands

- `e`: apply effect style
- `re`: remove all effects

`e` details:

- binding support is effect styles only
- in practice, the implementation applies effect styles and ignores literal non-style values
- remote styles are imported before use

`re` details:

- clears `effects` on every selected node that supports them

## Selection Color Swapping

- `scs`, `cs`: swap selection colors

Binding support:

- selection colors from the current selection
- local paint styles
- stored-library paint styles
- color variables

### No-value behavior

- if the selection contains exactly two unique colors, the plugin swaps them bidirectionally
- otherwise it errors and tells the user to use `cs?`

### Search behavior

The selection-color system recursively scans:

- fills
- strokes
- shadow effects
- nested children inside the selected subtree

It deduplicates by:

- RGB value
- binding origin: style, variable, or literal
- style key or variable id when available

### Two-stage binding

Form:

- `cs?source : target`

Behavior:

- stage 1 searches colors already present in the selection
- stage 2 searches replacement colors/styles/variables
- when exactly two colors exist, autocomplete also offers a prebuilt bidirectional swap row

### Replacement behavior

Literal target:

- fills and strokes become literal solid colors
- matching shadow effects are recolored too

Style target:

- matching fills and strokes are restyled with the selected paint style
- effects are not restyled

Variable target:

- matching fills and strokes bind paint color to the chosen variable
- effects are not variable-bound

## Theme Toggle

- `t`: toggle theme variables on the current selection

Behavior:

- searches both local and team-library variable collections whose names include `theme`, `appearance`, or `palette`
- only works with collections that expose both a light mode and a dark mode
- toggles each selected node's explicit variable mode per matching collection
- prefers clearing an explicit override when auto inheritance would already produce the opposite theme

Important nuance:

- the implementation does not currently notify on success
- if no matching theme collections are found, the command silently does nothing
