# Effect Command Implementation

I have refactored the previous `Style` command into a dedicated `Effect` command, as requested.

## Changes

### 1. `src/commands.ts`
- Renamed `Style` command to `Effect`.
- Updated aliases to `effect` and `ef`.
- Restricted `bindingSupport` to `styles: ['EFFECT']` only (removed PAINT, TEXT, GRID, and variables).
- Updated the command to call `impl.setEffect(value)`.

### 2. `src/implementations/styling.ts`
- Renamed `setStyle` to `setEffect`.
- Updated the function logic to:
    - Only handle `EFFECT` style types.
    - Use `figma.importStyleByKeyAsync(key)` to correctly resolve the style object (works for both local and imported styles).
    - Apply the style ID to `node.effectStyleId`.

## Verification

To verify the changes:
1.  Run the plugin.
2.  Select a node (e.g., a Rectangle or Frame).
3.  Open the command palette (Cmd+P).
4.  Type `effect` or `ef` followed by an effect style name (e.g., `ef Shadow`, `ef Blur`).
5.  Verify that only effect styles are suggested.
6.  Verify that the selected effect style is correctly applied to the node.
