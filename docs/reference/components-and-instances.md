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

Behavior:

- swaps every selected instance to the chosen component
- can resolve local components and active-library components
- imports remote components as needed
- accepts values formatted like `Component Name (Library Name)`

Search behavior:

- prioritizes preferred swap components defined on the property
- prioritizes same-frame components from the source component's container
- ranks folder-matched components before unrelated ones
- falls back to other active-library components

Preservation behavior:

- captures existing variant-property values before the swap
- re-applies matching values on the new component when the cleaned property names match and the old value is still valid
- reports how many properties were preserved

## `i` / `ip` / Instance Property

- Aliases: `i`, `ip`
- Value type: `string`
- Binding support: `instanceProperties`
- Supported nodes: instances only

This is the densest instance feature in the plugin.

### Bare property name

Examples:

- `ip Disabled`
- `ip has icon`

Behavior:

- first tries to resolve the property as a boolean property
- toggles the current boolean value
- if no boolean property matches, falls back to general property lookup
- if the property is text, variant, or instance-swap, the command does not guess and instead prompts the user to add `:`

### `Property:Value`

Examples:

- `ip Size:Large`
- `ip Label:Buy now`
- `ip Icon:Search (Core Library)`

Behavior by property type:

- variant: sets the variant option
- text: sets the text property value
- instance swap: resolves and imports the target component, then sets the property to that component id

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

- the command splits comma-chained pairs and applies them left to right
- each pair is also recorded individually in recent-value memory

### Exposed-instance support

The command does not stop at top-level properties.

- it can inspect properties exposed through nested instances
- it applies updates to exposed instances when the property is found there

### Suggestion behavior

The suggestion system is property-type aware.

- boolean properties can be toggled from the bare property name
- variant properties show option search flows
- text properties show the current text value and prompt for replacement text
- instance-swap properties surface preferred values, same-frame components, and library components

## `rio` / Reset Specific Override

- Aliases: `rio`
- Value type: `string`
- Binding support: `instanceOverrides`
- Supported nodes: instances only

Purpose:

- reset one specific override instead of resetting the whole instance

Search behavior:

- scans selected instances and relevant owner-instance contexts
- lists actual overrides only, not every possible field
- filters override suggestions to the selected subtree when nested instances are involved
- includes direct component-property overrides and nested override fields

Accepted reference formats:

- dropdown JSON payloads
- human-readable strings like `NodeName -> Field`
- component-property-specific payloads

Reset behavior:

- resolves the source node from the main component tree
- restores the selected field from the source
- can target grouped fields like stroke/radius families, not only a single raw Figma field
- reports the field label and reset count

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
- recent-value memory is especially helpful for `ip`, `is`, and `rio`
- all component/library lookup flows respect the plugin's active-library list, not every indexed library by default
