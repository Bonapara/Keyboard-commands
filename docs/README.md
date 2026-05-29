# Keyboard Commands Plugin Docs

This folder documents the current behavior of the `Keyboard Commands` Figma plugin as implemented in this repository.

The plugin is not just a flat list of shortcuts. It is a small command language with:

- `192` registered commands in `src/commands.ts`
- typed value parsing for numbers, expressions, colors, strings, binding references, and comma-chains
- autocomplete that is selection-aware
- binding search for styles, variables, libraries, instance properties, component swaps, selection colors, and override resets
- command history and per-command recent-value memory
- export flows backed by a hidden UI and ZIP bundling
- a custom local library index stored in `figma.clientStorage`

## What To Read First

- [Command Language](./command-language.md)
  Explains how users type commands, chain them, use bindings, trigger autocomplete, and replay history.
- [Runtime And Storage](./runtime-and-storage.md)
  Explains plugin metadata, storage keys, caching, export UI behavior, library indexing, and search resolution.

## Feature Reference

- [Components And Instances](./reference/components-and-instances.md)
- [Geometry, Layout, And Alignment](./reference/geometry-layout-and-alignment.md)
- [Styles And Effects](./reference/styles-and-effects.md)
- [Text](./reference/text.md)
- [Layers, Export, History, And Libraries](./reference/layers-export-history-and-libraries.md)

## Source Of Truth

These docs are derived from the current implementation, mainly:

- `src/commands.ts`
- `src/index.ts`
- `src/command-execution-plan.ts`
- `src/command-input.ts`
- `src/utils.ts`
- `src/storage.ts`
- `src/history.ts`
- `src/recent-values.ts`
- `src/implementations/*.ts`
- `tests/*.js`

If behavior ever diverges, the source files above win.
