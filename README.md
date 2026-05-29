# Keyboard Commands

Design faster in Figma with a compact command language for editing selections from the keyboard. Keyboard Commands lets you resize, align, restyle, bind variables, swap instance properties, manage libraries, export layers, and replay command history without moving through Figma panels.

## What It Does

- Runs as a Figma plugin parameter named `Command`.
- Provides 190+ selection-aware commands with autocomplete.
- Supports command chains such as `w320 h180 r12 f?brand`.
- Parses numbers, arithmetic expressions, percentages, deltas, hex colors, strings, and comma-separated shorthand values.
- Searches local styles, variables, published plugin libraries, instance properties, component swaps, override resets, and colors in the current selection.
- Stores command history and recent binding values in `figma.clientStorage`.
- Exports one or more selected layers as SVG, PDF, PNG, or JPG.

## Command Examples

| Command | Effect |
| --- | --- |
| `w320 h180` | Set width and height. |
| `w+24 h/2` | Resize relatively with delta values. |
| `p24,32 r12` | Set vertical/horizontal padding and all corner radii. |
| `hf vf g16` | Set horizontal fill, vertical fill, and auto-layout gap. |
| `f#ff6600 bc?border` | Apply a literal fill and search for a stroke color/style/variable. |
| `ip?State:Active` | Set an instance property from autocomplete. |
| `cs?Primary : Danger` | Replace one selection color with another style, variable, or literal color. |
| `hi` | Replay a recent command sequence. |

Use `?` to enter binding search mode. `;` is supported as an AZERTY-friendly alternative, so `f?blue` and `f;blue` are equivalent.

## Install Locally

1. Install dependencies:

   ```sh
   npm install
   ```

2. Build the plugin:

   ```sh
   npm run build
   ```

3. In Figma, open `Plugins > Development > Import plugin from manifest...` and select `manifest.json`.

4. Run the plugin from Figma's plugin menu or Quick Actions, then type into the `Command` parameter.

## Development

```sh
npm test          # run the full test suite
npm run build    # run tests, then bundle src/index.ts into dist/index.js
npm run watch    # rebuild on changes
npm run lint     # run ESLint
```

The build output is `dist/index.js`, which is the file referenced by `manifest.json`.

## Project Layout

- `src/commands.ts` - command registry and aliases.
- `src/index.ts` - Figma parameter input, autocomplete, history, and execution flow.
- `src/command-input.ts` - dropdown selection behavior.
- `src/command-execution-plan.ts` - command and binding parsing.
- `src/implementations/` - command behavior grouped by feature area.
- `src/storage.ts`, `src/history.ts`, `src/recent-values.ts` - client-storage backed persistence.
- `tests/` - command parser, registry, runtime, persistence, and implementation tests.
- `docs/` - detailed command language and feature reference.

## Documentation

Start with [docs/README.md](docs/README.md), then read:

- [Command Language](docs/command-language.md)
- [Runtime And Storage](docs/runtime-and-storage.md)
- [Geometry, Layout, And Alignment](docs/reference/geometry-layout-and-alignment.md)
- [Styles And Effects](docs/reference/styles-and-effects.md)
- [Text](docs/reference/text.md)
- [Components And Instances](docs/reference/components-and-instances.md)
- [Layers, Export, History, And Libraries](docs/reference/layers-export-history-and-libraries.md)

## License

`bonapara`
