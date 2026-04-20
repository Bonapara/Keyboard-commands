# Text

This file covers text sizing, alignment, typography controls, text styles, case/decorations, and list formatting.

## General Text Constraints

All text commands operate on `TEXT` nodes only.

Many text operations load fonts before writing:

- if a required font cannot be loaded, the plugin notifies instead of crashing the whole run

Some commands are intentionally guard-gated by style state:

- `fs`, `fw`, `tco`, `tcu`, `tcl`, `tct`, `tcs`, `tcsf` are only shown when no text style is applied
- `rts` is only shown when a text style is applied

## Text Auto Resize

- `taw`: set `WIDTH_AND_HEIGHT`
- `tah`: set `HEIGHT`
- `tfs`: set `NONE`

Behavior:

- loads the node font first
- then writes `textAutoResize`

## Truncation And Vertical Trim

- `tt`: toggle truncation or set max lines
- `vt`: toggle vertical trim

`tt` behavior:

- no value toggles `textTruncation` between `DISABLED` and `ENDING`
- numeric value enables `ENDING` truncation and writes `maxLines`
- max lines must be at least `1`

`vt` behavior:

- toggles `leadingTrim` between `NONE` and `CAP_HEIGHT`

## Text Alignment

Horizontal:

- `tal`: left
- `tac`: center
- `tar`: right
- `taj`: justified

Vertical:

- `tat`: top
- `tam`: middle
- `tab`: bottom

Behavior:

- loads all fonts used in the text node range
- applies only the requested horizontal or vertical dimension

## Text Style Application

- `ft`: apply a text style from local or stored libraries
- `rts`: detach the currently applied text style

`ft` details:

- binding support is text styles and stored-library styles
- no-value `ft` currently does nothing; there is no toggle path

`rts` details:

- calls `setTextStyleIdAsync('')`
- reports how many layers were detached

## Font Size And Weight

- `fs`: font size
- `fw`: font weight

`fs` details:

- delta-aware
- minimum resulting size is `1`

`fw` details:

- accepts only `100` to `900` in steps of `100`
- rewrites the current font using the same family and the requested style string
- if that style name does not exist for the family, the command notifies

## Letter Spacing, Line Height, Paragraph Spacing, Paragraph Indent

- `ls`: letter spacing
- `lnh`: line height
- `ps`: paragraph spacing
- `pi`: paragraph indent

Binding support:

- float variables

Value behavior:

- `ls` accepts px or `%`
- `lnh` accepts px or `%`
- `lnh` with no value sets line height to `AUTO`
- `ps` and `pi` are pixel values

Variable behavior:

- imports library float variables if needed
- binds the corresponding text property directly

Literal behavior:

- `ls` writes `{ value, unit }`
- `lnh` writes `{ value, unit }` or `{ unit: 'AUTO' }`
- `ps` and `pi` write plain numeric values

## Text Case

- `tco`: original
- `tcu`: upper
- `tcl`: lower
- `tct`: title
- `tcs`: small caps
- `tcsf`: forced small caps

Behavior:

- writes `textCase` directly after loading the font
- these commands are intentionally hidden when a text style is applied

## Text Decoration

- `rtd`: remove decoration
- `tu`: toggle underline
- `ts`: toggle strikethrough

Behavior:

- underline and strikethrough are toggle commands
- if the target decoration is already active, the command resets to `NONE`
- `rtd` explicitly sets `NONE`

## Lists

- `tol`: ordered list
- `tul`: unordered list
- `trl`: remove list formatting

Behavior:

- loads the font
- applies the list option over the full text range in the node

## Text-Specific Micro Features

- all text formatting commands operate on the full node, not a user text selection inside the node
- commands that require fonts are tolerant of failures on a per-node basis
- variable-bound text metrics stay variable-bound; they are not flattened to literal numbers once set
