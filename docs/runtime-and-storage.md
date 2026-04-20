# Runtime And Storage

This file documents the runtime surface around the command system: manifest settings, storage keys, cache strategy, export UI, and library indexing.

## Manifest And Plugin Capabilities

From `manifest.json`:

- plugin name: `Keyboard Commands`
- API version: `1.0.0`
- main entry: `dist/index.js`
- editor type: `figma`
- document access: `dynamic-page`
- permissions: `teamlibrary`
- UI file: `ui.html`
- exposed parameter: `command`
- allowed network domain: `https://cdnjs.cloudflare.com`

Why those choices matter:

- `dynamic-page` is required because the plugin walks pages and imports library content at runtime
- `teamlibrary` is required for theme toggling and library-backed variable/component workflows
- `cdnjs` is only used by the hidden export UI to load `JSZip`

## Build And Test Surface

From `package.json`:

- build: `esbuild src/index.ts --bundle --outfile=dist/index.js --target=es6 --minify`
- prebuild runs all tests
- tests cover input parsing, command registry integrity, utility behavior, and persistence

Primary test files:

- `tests/command-input.test.js`
- `tests/command-registry.test.js`
- `tests/utils.test.js`
- `tests/persistence.test.js`

## Client Storage Keys

The plugin uses four persistent client-storage buckets.

### Library index

- key: `KB_COMMANDS_LIBRARY_DATA`
- file owner: `src/storage.ts`
- payload: compressed JSON via `lz-string`

Stored data shape:

- `Record<LibraryName, LibraryItem[]>`

Library items can represent:

- paint styles
- text styles
- effect styles
- grid styles
- components
- color variables
- float variables
- string variables
- boolean variables

### Active libraries

- key: `KB_COMMANDS_ACTIVE_LIBRARIES`
- payload: string array of enabled library names

### Command history

- key: `KB_COMMANDS_HISTORY`
- max length: `10`

### Recent values

- key: `KB_COMMANDS_RECENT_VALUES`
- max entries per command: `5`

## In-Memory Caching

The plugin caches several expensive lookups in memory.

### Storage caches

`src/storage.ts` keeps in-memory copies of:

- stored library data
- active-library list

### Style and variable cache

`src/utils.ts` caches local styles and variables for `5` minutes.

Cached groups:

- local paint styles
- local text styles
- local effect styles
- local grid styles
- local variables
- local variable collections

Important nuance:

- variable colors are resolved lazily only for final visible suggestion rows
- this avoids resolving large variable graphs for off-screen results

### Main component cache

`src/implementations/instance.ts` keeps a `WeakMap` from instance node to main component to avoid repeated `getMainComponentAsync()` calls.

## Library Publishing Model

`plib` runs `publishLibrary()` and indexes the current file into plugin storage.

What gets indexed:

- all local paint styles
- all local text styles
- all local effect styles
- all supported local variables: color, float, string, boolean
- components from all pages

Component-set nuance:

- a component set is stored by the key of its default variant, not the set itself
- that makes later imports compatible with `importComponentByKeyAsync()`

Color metadata nuance:

- paint styles store either a representative hex color or `IMAGE:<hash>`
- color variables resolve aliases recursively, up to a safety limit

Activation nuance:

- publishing automatically enables the library in the active-library list

## Library Search And Toggle Model

The plugin has a local concept of "libraries" that is separate from Figma's native library UI.

Core behaviors:

- only active libraries participate in binding search
- toggles are stored locally, not globally in Figma
- library suggestions show checkbox state and indexed item count
- search is substring based on library name

Formatting examples:

- `[x] Core (216 items)`
- `[ ] Marketing (84 items)`

Those formatted strings are also accepted as input for toggle/remove commands.

## Style And Variable Resolution

The binding system resolves user-facing strings into executable references.

### Paint resolution

`resolvePaintValue()` supports:

- literal hex colors
- paint style references
- color variable references

### Style resolution

`resolveStyleValue()` supports:

- any style type used by the command
- variable references when the command accepts them
- literal hex as a fallback for paint-like commands

### Number resolution

`resolveNumberValue()` supports:

- numeric literals
- percentages
- numeric expressions
- float variable references

## Export Runtime

Export commands call `exportAs()` in `src/implementations/export.ts`.

Runtime flow:

1. export each selected node with Figma `exportAsync()`
2. open `ui.html` invisibly
3. post binary export results to the UI
4. let the UI download a single file directly or ZIP multiple files with `JSZip`
5. wait for a UI completion message or a `10` second timeout

Important behavior:

- single-node export downloads one file with the node name
- multi-node export downloads `export-N-files.zip`
- the plugin allows SVG, PDF, PNG, and JPG
- PNG and JPG can export by scale, width, or height

## Selection-Color Search Runtime

The selection-color subsystem recursively traverses the selection subtree and extracts colors from:

- fills
- strokes
- shadow effects

It distinguishes binding origin as:

- style
- variable
- literal

That is why `cs?` can offer meaningful source choices even when two visually identical colors come from different bindings.

## Theme Toggle Runtime

`t` scans both local and team-library variable collections whose names include:

- `theme`
- `appearance`
- `palette`

It only considers collections with both:

- a light mode
- a dark mode

Auto-mode nuance:

- auto-named modes are ignored when looking for the explicit light/dark pair
- if a node currently has an explicit mode and auto resolution would already yield the opposite, the toggle clears the explicit mode instead of writing another explicit override

This means theme toggling tries to preserve inheritance where possible instead of always hard-coding the next mode.

## Search Result Icons

The suggestion system can attach icons to results.

- solid colors get SVG swatches
- gradient styles use the first visible stop as the preview color
- image paint styles get a dedicated image-style icon
- selection-color swaps can show a dual swatch when exactly two colors are available

## Registry Integrity Guarantees

`tests/command-registry.test.js` asserts:

- every command definition is present in `COMMANDS`
- command names are unique
- aliases are unique across the entire registry
- commands expose the correct execution function shape
- value-format commands declare a value format
- lookup by alias and name works
- top-level suggestions cover the full registry

This is important because the docs in this folder assume the registry is the source of truth.
