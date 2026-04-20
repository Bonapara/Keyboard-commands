# Geometry, Layout, And Alignment

This file covers spatial editing, auto-layout, grids, grouping, booleans, sizing, constraints, and alignment behavior.

## Size Commands

### Direct resize

- `w`: set width
- `h`: set height
- `hw`, `wh`: set width and height together

Behavior:

- works on `RESIZABLE` node types
- uses `resolveDelta()`, so values like `+10` and `/2` are relative
- clamps width and height to at least `0.01`

## Move And Position Commands

### Relative move

- `mt`, `-my`: move up
- `mb`, `my`: move down
- `ml`, `-mx`: move left
- `mr`, `mx`: move right

Behavior:

- supported on `POSITIONABLE` nodes
- guarded by `IsNotInAutoLayout` or `IsAbsoluteInAutoLayout`
- uses absolute numeric movement, not delta-aware movement

### Absolute position in parent

- `pol`, `x`: distance from left
- `por`, `-x`: distance from right
- `pot`, `y`: distance from top
- `pob`, `-y`: distance from bottom

Behavior:

- uses parent width or height for right/bottom placement
- requires a dimensioned parent container
- guarded by `IsNotInAutoLayout` or `IsAbsoluteInAutoLayout`

## Auto-Layout Creation And Removal

- `alh`: wrap selection into a horizontal auto-layout frame
- `alv`: wrap selection into a vertical auto-layout frame
- `ra`: remove auto-layout by setting layout mode to `NONE`

`alh` and `alv` have special conversion logic:

- if exactly one group is selected, the plugin converts the group directly into a frame
- the new frame inherits the group's size and position
- default white frame fill is removed
- padding starts at `0`
- if exactly one frame is selected, the plugin enables auto-layout on that frame instead of wrapping it in a new parent
- group children and selected frame children are sorted by x or y before insertion
- spacing is inferred from the first two children

For multiple selected nodes:

- nodes are wrapped in a new frame at the first node's position
- selection order is normalized by x or y before insertion
- spacing is inferred from the first two selected nodes

## Auto-Layout Direction And Sizing

### Container direction

- `lh`: set auto-layout direction to horizontal
- `lv`: set auto-layout direction to vertical
- `lw`: set auto-layout wrap

Notes:

- `lh` and `lv` only appear when the selection is already frame-like and in auto-layout
- `lw` can be applied to frame-like nodes directly

### Child/container sizing shortcuts

- `vf`: vertical fill
- `vh`: vertical hug
- `hf`: horizontal fill
- `hh`: horizontal hug

Important runtime behavior:

- if `fill` is requested on a child inside a plain non-auto-layout frame, the plugin resizes the node to match the parent dimension instead of setting a layout property
- if the selected node itself is frame-like and has no auto-layout, the plugin can enable auto-layout before setting its layout sizing property
- `vh` and `hh` require auto-layout contexts
- `vf` and `hf` are available in more than one context because of the special-condition guard setup

## Gaps And Padding

### Primary gap

- `g`: set primary gap, or `AUTO` when no value is given
- `sb`: force space-between

Behavior:

- only for row/column auto-layout containers
- numeric values are delta-aware
- numeric values also force `primaryAxisAlignItems = MIN`
- no value switches to `SPACE_BETWEEN`

### Counter gap for wrap layouts

- `vg`: set vertical/counter gap, or `AUTO` with no value
- `vsb`: force counter-axis space-between

Behavior:

- only for wrapped auto-layout containers
- numeric values update `counterAxisSpacing` on wrap layouts
- no value switches `counterAxisAlignContent` to `SPACE_BETWEEN` on wrap layouts

### Grid gaps

- `cg`: set grid column gap
- `rg`: set grid row gap

Behavior:

- only for grid layouts
- numeric values are delta-aware
- values update `gridColumnGap` and `gridRowGap`

### Tidy / inferred layout gaps

- `tg`: set tidy / smart selection gap on the current selection, or use the dominant existing gap with no value
- `trg`: set tidy / smart selection row gap on the current selection

Behavior:

- works on multi-selected sibling layers that form a row, column, or grid-like tidy selection
- also works on a single plain frame when Figma exposes `inferredAutoLayout`
- numeric values reposition layers to emulate tidy-up spacing
- on multi-row or multi-column tidy selections, `tg` normalizes shared columns or rows instead of spacing each row or column independently
- `tg` with no value uses the dominant existing gap on the active tidy axis
- tidy row gap requires at least 2 inferred rows or columns

### Padding commands

- `p`: all sides, with 1/2/3/4-value shorthand
- `ph`: horizontal padding
- `pv`: vertical padding
- `pl`: left padding
- `pt`: top padding
- `pr`: right padding
- `pb`: bottom padding

Shorthand behavior:

- `p20` -> all four sides `20`
- `p20,30` -> top/bottom `20`, left/right `30`
- `p20,30,40` -> top `20`, left/right `30`, bottom `40`
- `p20,30,40,50` -> top/right/bottom/left

Important notes:

- padding values are delta-aware
- negative results are clamped to `0`
- no-value side commands reset their scope to `0`
- only frame-like nodes are supported

### Clip content

- `c`: toggle clip content

Supported on:

- frames
- components
- component sets
- instances

## Layout Grids

- `lg`: set uniform grid size, or toggle grid visibility with no value
- `lgc`: set stretch column count
- `lgr`: set stretch row count
- `lgg`: set row/column gutter size
- `lgm`: set row/column margin/offset
- `lgrm`: remove all layout grids

Important behavior:

- `lg` only manages the `GRID` pattern and leaves row/column grids intact
- `lgc` and `lgr` replace only their respective pattern
- `lgg` and `lgm` update existing row/column grids only
- if no row/column grids exist, `lgg` and `lgm` notify instead of creating one
- `lg` with no value toggles visibility on existing grids only

Defaults:

- row/column gutter default: `20`
- row/column offset default: `0`

## Transform And Scale

### Rotation

- `ro`: set rotation
- `ro` with no value resets rotation to `0`

Behavior:

- delta-aware
- rotates around the current visual center
- clears legacy plugin data keys `originalX` and `originalY` if present

### Flip

- `fh`: horizontal flip
- `fv`: vertical flip

Behavior:

- mirrors the relative transform
- then compensates x or y so the node stays visually in place

### Scale

- `s`: scale by percent, where `s100` means `100%`
- `sw`: scale to a target width
- `sh`: scale to a target height

Behavior:

- uses Figma `rescale()`
- minimum scale factor is `1%`

## Min/Max And Absolute Positioning

- `maxh`: set or clear max height
- `maxw`: set or clear max width
- `minh`: set or clear min height
- `minw`: set or clear min width
- `ap`: toggle absolute positioning inside auto-layout

Notes:

- `max*` and `min*` are optional-value commands
- no value clears the stored min/max property by setting it to `null`
- numeric values are delta-aware against the current min/max if present, otherwise against the node's current size
- `ap` toggles `layoutPositioning` between `ABSOLUTE` and `AUTO`

## Constraints

Horizontal:

- `cl`: left
- `cch`: center
- `cr`: right
- `clr`: left and right / stretch
- `csh`: scale

Vertical:

- `ct`: top
- `ccv`: center
- `cb`: bottom
- `ctb`: top and bottom / stretch
- `csv`: scale

Behavior:

- only exposed outside auto-layout
- preserves the untouched axis while changing the requested axis

## Smart Auto-Layout Alignment

These nine commands use `smartAlign()` and are intended for auto-layout frames, with optional parent-forcing behavior.

- `atl`, `alt`: top left
- `atc`, `act`: top center
- `atr`, `art`: top right
- `acl`, `alc`: center left
- `acc`: center
- `acr`, `arc`: center right
- `abl`, `alb`: bottom left
- `abc`, `acb`: bottom center
- `abr`, `arb`: bottom right

Behavior:

- with no value, scope is `AUTO`
- with any value starting with `p`, scope is forced to `PARENT`
- in `AUTO` scope, auto-layout alignment is attempted first
- if auto-layout handling does not apply, the plugin falls back to aligning the node inside its parent by x/y coordinates

## Free-Layout Alignment

### Align relative to selection bounds or parent

- `at`: top
- `ab`: bottom
- `al`: left
- `ar`: right
- `avc`: vertical center
- `ahc`: horizontal center

Behavior:

- with one selected node, alignment is relative to the parent container
- with multiple selected nodes, alignment is relative to the shared selection bounds
- `at`, `ab`, `al`, and `ar` are intentionally guarded to non-auto-layout contexts
- `avc` and `ahc` do not carry that registry guard

## Parent-Only Alignment Commands

- `atlp`, `altp`: parent top left
- `atcp`, `actp`: parent top center
- `atrp`, `artp`: parent top right
- `aclp`, `alcp`: parent center left
- `accp`: parent center
- `acrp`, `arcp`: parent center right
- `ablp`, `albp`: parent bottom left
- `abcp`, `acbp`: parent bottom center
- `abrp`, `arbp`: parent bottom right

Behavior:

- always align directly inside the parent
- can operate on multiple selected nodes independently

## Grouping And Boolean Operations

### Grouping

- `gr`: group selection
- `ugr`: ungroup groups or frames

Important notes:

- grouping requires at least two selected items
- all selected nodes must share the same parent
- ungrouping collects the resulting children and selects them
- ungrouping accepts both groups and frames

### Boolean operations

- `un`, `u`: union
- `su`, `sub`: subtract
- `in`, `int`: intersect
- `ex`: exclude

Behavior:

- requires at least two selected layers
- runs against the current page

## Corner Smoothing

- `csm`: set corner smoothing explicitly
- `csi`: shortcut to `60`, matching the plugin's "iOS" preset

Behavior:

- `csm` is delta-aware
- the runtime clamps values between `0` and `100`
- stored Figma value is normalized to the `0..1` range internally
