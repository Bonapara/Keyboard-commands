# Components And Instances

This file covers the component, instance, variant, slot, and override workflows.

## Command Family Overview

- `is`: swap selected instance(s) to another component
- `i`, `ip`: inspect or change instance properties
- `rio`: reset a specific override
- `ri`: reset all overrides
- `di`: detach instance(s)
- `ss`: select similar nodes by hierarchy signature
- `po`: push supported overrides back to the main component
- `cc`: create component(s) from the current selection
- `av`: add a new variant
- `csl`: create slot(s)
- `rsl`: reset slot(s)

## `is` / Instance Swap

- Aliases: `is`
- Value type: `string`
- Binding support: `instanceSwap`
- Supported nodes: instances only
- Implementation: `src/implementations/component-swap.ts`

Search behavior:

- searches one pool: components in this file (all pages), components of the active `lp` libraries, and the preferred values of the instance-swap property that exposes the selection
- ranks by match quality, then context: exact name › name prefix › every word prefixed in any order (`right arrow`) › substring › abbreviation (`btn`) › one typo (`buton`)
- boosts preferred values, the current component's folder and library; ties keep the preferred order, then A→Z
- trims the query and hides the selection's current component
- labels rows `Name · Library` (`★ Name · preferred`), with the full path when two rows share a name
- the top row previews what Enter keeps, for example `↵ keeps Size=20 · resets State`
- preferred component sets are imported once per run to learn their names and library, never on every keystroke
- when nothing matches, the input shows `No component matches "…" in …` and Enter does nothing

Swap behavior:

- every row carries the component key (or node id for this file); Enter imports exactly that component and never falls back to a partial name match
- a bare `Component Name (Library Name)` value still works, matched by exact name only
- picks the existing variant that keeps the most current variant values, earlier properties breaking ties, then calls `swapComponent` once, so a missing combination can't leave instances on defaults
- the toast names the component and what was kept or reset: `Swapped 3 → Split button · kept Variant=Secondary · reset Size, State`
- a component that can't be imported or found reports it and swaps nothing

## `i` / `ip` / Instance Property

- Aliases: `i`, `ip`
- Value type: `string`
- Binding support: `instanceProperties`
- Supported nodes: instances only

This is the densest instance feature in the plugin.

### Every row is an action

Without a `:`, each matching property expands into rows that do one thing:

- variant: one row per option (`Size → L`), the current one marked `Size · M · current`
- boolean: explicit `Has icon → On` / `Has icon → Off` rows, with `· 2 of 3 change` on mixed selections
- text: `Label · "Buy now" · type : to edit`; Enter explains the `ip?Label:` syntax
- instance swap: `Icon · Arrow right · type : to swap`; Enter explains the `ip?Icon:` syntax

Search tokens match property names and option values, so `ip?large` finds `Size → Large`, and an option typed in full (`ip?size s`) goes first. The top variant row shows what it replaces: `Size → XS    now M`.

### `Property:Value`

Examples:

- `ip Size:Large`
- `ip Label:Buy now`
- `ip Has icon:on`
- `ip Icon:Search`

Behavior by property type:

- variant: options rank exact › prefix › contains, so `ip?size:s` puts `S` above `XS`; the current option reads `already set`, and choosing it leaves the instance alone
- text: everything after the first `:` that follows a property name is the text, including commas, `?` and further colons; `ip?Label:` offers `Label → clear`
- boolean: accepts `on`/`off` (and `true`, `false`, `yes`, `no`, `show`, `hide`)
- instance swap: searches components like `is` (preferred values first, rows carry the component key) and sets the property to that component

Variant properties are consolidated across selected instances when the cleaned
property name and the full variant option set match. This allows a header
component and cell component that both expose `State: Default, Selected` to be
changed together with `ip State:Selected`.

When several instances are selected, suggestions only include properties shared
by every selected root instance. A selected component exposing `State: Default,
Selected, Sorted` and another exposing `State: Default, Selected` will not show
`State` as a shared editable property for that multi-selection.

### Bare property name

Examples:

- `ip Disabled`
- `ip has icon`

Behavior:

- toggles a boolean property when every selected instance shares its value
- turns a boolean on everywhere when the selection is mixed, so it ends up consistent
- for text, variant and instance-swap properties, explains how to set them instead of guessing

### Empty-property search by option

Example:

- `ip?:prim`

Behavior:

- when the typed search starts with `:`, the plugin searches variant options across all available properties
- this helps when the user remembers the desired option value but not the property name

### Comma-chained multi-update

Example:

- `ip Size:Large,State:Active,Label:Submit`

Behavior:

- pairs apply left to right
- a comma inside a text or component value stays part of the value unless another property of the selection follows it (`Label:Hello, world` is one pair; `Label:Hi,Size:L` is two)

### Exposed-instance support

The command does not stop at top-level properties.

- it can inspect properties exposed through nested instances
- it applies updates to exposed instances when the property is found there
- nested properties are prefixed with the exposed instance name, for example `Field icon › Icon`

### Toasts

- `Size → L on 3 instances (2 changed)`
- `Label → "Hello, world" on 1 instance`, `Cleared Label on 1 instance`
- `Size is already M`
- failures name the property and the reason

## `rio` / Reset Specific Override

- Aliases: `rio`
- Value type: `string`
- Binding support: `instanceOverrides`
- Supported nodes: instances only
- Implementation: `src/implementations/overrides.ts`

Search behavior:

- one row per overridden layer and field, in layer order, showing what Enter restores: `Label · Text "Hello" → "Title"`, `Box · Height 56 → 40`, `Icon · Size 24 → 16`
- layers inside a nested instance are prefixed with it: `chevron-right › Vector · Stroke #000000 1px → Text/Tertiary 1.1px`; bound colors show the variable name
- layers that share a name get their own rows; the values tell them apart
- scans the selected instances and the instances above them, keeping only layers inside the selection
- also lists styles a nested-instance swap dropped, which Figma records no override for: an icon swapped inside a wrapper like `Icon/Tabler` that lost the wrapper's stroke color and weight. Fills, strokes, effects, opacity, visibility and text style/font/size are checked on layers under a swapped instance, including slot content
- on multi-selections, rows for the same layer path and field merge (`· 3 instances`)
- search matches layer names, field names and values (`rio?hello`)
- a last row resets every override on the selection (same as `ri`) and restores the styles a swap dropped

Reset behavior:

- each field comes from the outermost component that sets it, otherwise from the layer's own component; past a swapped instance the layer must keep its name (how Figma carries overrides over), and slot content is only compared with its own component
- an instance's layer name resets to its component set's name, not the variant's
- restored paints stay bound to their color variables
- loads the node's fonts before restoring text fields (and the source fonts for font or text-style resets)
- restores width and height through `resize()`
- restores grouped fields such as the stroke and radius families together
- toasts say what was restored (`Reset Label text → "Title"`) or why it couldn't be (`Couldn't reset Label: font "Inter Regular" isn't available`)

Accepted reference formats:

- row payloads (`{ "v": 2, "path": [...], "field": ... }`)
- older JSON payloads with a node id
- human-readable strings like `NodeName -> Field`

## `ri` / Reset Instance

- Aliases: `ri`
- Supported nodes: instances only

Behavior:

- calls `removeOverrides()` on each selected instance
- resets all overrides back to the master component state

## `di` / Detach Instance

- Aliases: `di`
- Supported nodes: instances only

Behavior:

- detaches each selected instance to a frame
- replaces the selection with the detached frames

## `po` / Push Overrides To Main

- Aliases: `po`
- Supported nodes: instances only

Behavior:

- takes the first selected instance
- resolves its main component
- pushes a limited override set from the instance to the main component

Supported override classes:

- fills
- strokes
- stroke weight and stroke alignment
- dash pattern
- effects
- corner radius and individual radii

Not pushed:

- text content
- layout settings
- constraints
- instance properties in general

This is a style-overrides push, not a full component diff sync.

## `ss` / Select Similar

- Aliases: `ss`

Important nuance:

- the registry description says "similar instances", but the implementation works from the first selected node regardless of type

Behavior:

- derives a hierarchy signature from the selected node's path under the nearest suitable root
- the preferred root is the nearest ancestor frame with `layoutMode === 'NONE'`
- otherwise it falls back to the page
- selects other nodes with the same name-and-type path signature

This makes it useful for repeated structures in a frame, not just identical instance types.

## `cc` / Create Component

- Aliases: `cc`

Behavior:

- converts each selected non-slice scene node into a component
- skips slices
- selects the newly created components

## `av` / Add Variant

- Aliases: `av`
- Supported nodes: `COMPONENT`, `COMPONENT_SET`

Behavior depends on what is selected.

### If a component set is selected

- clones the default variant
- appends a new variant to the set

### If a variant component inside a set is selected

- clones that specific variant
- appends the clone to the same set

### If a standalone component is selected

- first converts the component into a component set
- applies component-set styling:
  - dashed purple inside stroke
  - `20px` padding on all sides
- repositions the original component inside the new set

Placement behavior:

- names the clone with the next available numeric suffix
- places the new variant below the lowest existing variant
- uses `20px` vertical spacing
- resizes the component set to fit all variants plus padding

## `csl` / Create Slot

- Aliases: `csl`
- Supported nodes: components and component sets

Behavior:

- creates slots from selected component nodes
- if a component set is selected, iterates all child variants and creates slots where possible
- selects the new slot nodes

## `rsl` / Reset Slot

- Aliases: `rsl`
- Supported nodes: slot nodes only

Behavior:

- calls `resetSlot()` on each selected slot
- leaves non-slot nodes untouched

## Cross-Cutting Notes

- instance-property and override flows rely heavily on autocomplete; these commands are much harder to use blind than simple numeric commands
- all component/library lookup flows respect the plugin's active-library list, not every indexed library by default
