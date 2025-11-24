# Smart Alignment Commands Walkthrough

I have updated the alignment commands to be "smart" and flexible. They adapt their behavior based on the selected node type, but you can also force a specific behavior using a parameter or explicit commands.

## Behavior

1.  **Default (No Parameter)**:
    *   **AutoLayout Nodes**: Aligns the **items inside** the frame (Children).
    *   **Regular Nodes**: Aligns the **node itself** relative to its parent container (Parent).

2.  **With Parameter (`p`)**:
    *   Forces alignment to the **Parent**, even for AutoLayout nodes.
    *   Example: `acc p` will center the AutoLayout frame itself within its parent.

3.  **Explicit Parent Commands (`...p`)**:
    *   Shortcuts for parent alignment.
    *   Example: `accp` is the same as `acc p`.

## Command List

| Position | Smart Command (Auto/Parent) | Explicit Parent Command |
| :--- | :--- | :--- |
| **Top Left** | `atl` | `atlp` |
| **Top Center** | `atc` | `atcp` |
| **Top Right** | `atr` | `atrp` |
| **Center Left** | `acl` | `aclp` |
| **Center Center** | `acc` | `accp` |
| **Center Right** | `acr` | `acrp` |
| **Bottom Left** | `abl` | `ablp` |
| **Bottom Center** | `abc` | `abcp` |
| **Bottom Right** | `abr` | `abrp` |

## Changes

### `src/implementations/alignment.ts`

-   Updated `smartAlign` signature: `smartAlign(position, scope: 'AUTO' | 'CHILDREN' | 'PARENT' = 'AUTO')`.
-   Renamed terminology to match Figma API best practices:
    -   `PARENT`: Aligns to `node.parent`.
    -   `CHILDREN`: Aligns `node.children` (via AutoLayout properties).
    -   `AUTO`: Original smart logic.

### `src/commands.ts`

-   Updated all calls to `smartAlign` to use the new `PARENT` / `CHILDREN` terminology.
-   Functionality remains the same: `val.startsWith('p') ? 'PARENT' : 'AUTO'`.

## Verification

To verify the changes:

1.  **AutoLayout Inside Test**:
    -   Select an AutoLayout frame.
    -   Run `acc`.
    -   Verify children are centered.

2.  **AutoLayout Outside Test (Parameter)**:
    -   Select the same AutoLayout frame.
    -   Run `acc p`.
    -   Verify the AutoLayout frame itself moves to the center of its parent.

3.  **AutoLayout Outside Test (Explicit Command)**:
    -   Select the same AutoLayout frame.
    -   Run `accp`.
    -   Verify the AutoLayout frame itself moves to the center of its parent.
