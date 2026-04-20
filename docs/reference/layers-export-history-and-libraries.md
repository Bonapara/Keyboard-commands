# Layers, Export, History, And Libraries

This file covers layer-state commands, z-ordering, exports, history replay, and library-management commands.

## Layer Deletion And Duplication

- `de`: delete selection
- `d`: duplicate selection

`de` behavior:

- removes every selected deletable node

`d` behavior:

- clones each selected node
- skips slot nodes
- offsets each clone by `10px` on x and y
- replaces the selection with the clones

## Selection Traversal

- `selp`, `sp`: select parent layer
- `selc`, `sc`: select direct children of the current selection

Behavior:

- `selp` and `sp` deduplicate shared parents, so sibling selections collapse to one parent selection
- `selp` and `sp` stop at the page level and report that there is no higher selectable parent
- `selc` and `sc` union the direct children of every selected container
- both commands mutate the active selection immediately, so later commands in the same chain target the new selection
- example: `sc p24 sp p32` applies `24px` padding to the children, then `32px` padding to their parent

## Lock, Mask, Flatten, Outline

- `l`, `lock`: toggle lock
- `m`, `mask`: toggle mask
- `fl`: flatten selection
- `os`: outline stroke

`lock` behavior:

- if all selected nodes are locked, unlock all of them
- otherwise lock all of them

`mask` behavior:

- uses the first selected node to decide the next mask state
- applies that state to every selected node that supports masking
- if the first node cannot be masked, the command reports that and does nothing useful

`fl` behavior:

- calls `figma.flatten(selection)`

`os` behavior:

- calls `outlineStroke()` only on nodes that support it
- reports how many nodes were outlined

## Visibility And Opacity

- `v`: toggle visibility
- `o`: set opacity, or toggle between `0%` and `100%` with no value

`o` details:

- numeric values are delta-aware
- results are clamped to `0..100`
- no-value toggle uses the first selected node's final opacity for the message

## Z-Order

- `zf`: bring to front
- `zu`: bring forward
- `zd`: send backward
- `zb`: send to back

Behavior:

- reorders each node inside its current parent
- does not reparent nodes

## Export Commands

- `svg`, `exportsvg`: export SVG
- `pdf`, `exportpdf`: export PDF
- `png`, `exportpng`: export PNG, default `1x`
- `jpg`, `jpeg`, `exportjpg`: export JPG, default `1x`
- `pngw`: PNG by width
- `jpgw`: JPG by width
- `pngh`: PNG by height
- `jpgh`: JPG by height

Important behavior:

- single exported node downloads directly as `<node-name>.<ext>`
- multiple exported nodes download as a ZIP
- PNG/JPG value forms mean:
  - `png2` -> scale `2x`
  - `jpg3` -> scale `3x`
  - `pngw512` -> width `512`
  - `jpgh256` -> height `256`

Runtime notes:

- export uses the hidden `ui.html`
- ZIP creation relies on `JSZip` from `cdnjs`
- the plugin waits up to `10` seconds for the UI completion message

## History Replay

- `z`, `hi`: replay recent command sequences

Behavior:

- suggestions show stored command sequences instead of normal related commands
- selecting a history entry replays the whole stored sequence
- invoking `hi` without picking an entry does not execute anything; it prompts the user to choose from suggestions

Persistence details:

- max `10` history entries
- deduplicated by summarized command meaning, not only by raw string

## Publish, Toggle, Remove, And Inspect Libraries

- `plib`: publish the current file into the plugin's local library index
- `tlib`: toggle active libraries
- `rlib`: remove indexed libraries
- `ms`: inspect approximate storage usage

### `plib`

Behavior:

- requires the file to be saved and named
- indexes styles, variables, and components from the current file
- scans all pages for components
- auto-enables the published library
- stores the result in compressed client storage

### `tlib`

Behavior:

- no value: notifies the user with the list of available libraries and suggests using search
- with a value or binding selection: toggles that library on or off

Formatting accepted:

- plain library name
- checkbox suggestion format like `[x] Library Name (216 items)`

### `rlib`

Behavior:

- no value: lists removable libraries in a notification
- with a value or binding selection: deletes the library from storage and also removes it from the active list

### `ms`

Behavior:

- reports library count, total indexed items, compressed storage size in KB, approximate percentage of a `~5MB` client-storage budget, and active-library count

## Cross-Cutting Notes

- library commands operate on the plugin's own indexed library catalog, not on every library connected to the Figma account
- export and library commands are the main places where this plugin leaves the pure "selection editing" domain and behaves more like a small productivity toolchain
