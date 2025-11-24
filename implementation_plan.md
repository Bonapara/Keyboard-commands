# Add Alias 'e' to Effect Command

## Goal
Add the alias `e` to the `Effect` command to allow users to quickly access it.

## Proposed Changes

### `src/commands.ts`
#### [MODIFY] [commands.ts](file:///Users/thomascolasdesfrancs/code/Keyboard Commands/src/commands.ts)
- Update `Effect` command aliases from `['effect', 'ef']` to `['effect', 'ef', 'e']`.

## Verification Plan

### Manual Verification
1.  Run the plugin.
2.  Open the command palette.
3.  Type `e` and verify that the `Effect` command is suggested.
