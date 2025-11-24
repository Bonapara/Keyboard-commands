# Smart Alignment Commands Walkthrough

I have updated the alignment commands to be strictly separated based on context, avoiding redundancy.

## Behavior

1.  **AutoLayout Commands (`acc`, `atl`, etc.)**:
    *   **Availability**: Only available when selecting an **AutoLayout Frame**.
    *   **Action**: Aligns the **Children** inside the frame.
    *   **Optional Parameter (`p`)**: Can still force alignment of the frame itself to its parent (e.g., `acc p`).

2.  **Parent Alignment Commands (`accp`, `atlp`, etc.)**:
    *   **Availability**: Available for **all positionable nodes** (Frames, Groups, Shapes, etc.).
    *   **Action**: Aligns the **Node itself** to its **Parent**.
    *   **Use Case**: This is the primary way to align regular nodes to their parent.

## Command List

| Position | AutoLayout Only (Align Children) | Universal (Align to Parent) |
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

### `src/commands.ts`

-   Added `specialConditions: ['IsAutoLayout']` to the 9 alignment commands (`atl`...`abr`).
-   Removed `(p = parent)` from suggestions to avoid clutter, as `accp` is the preferred explicit command.

## Verification

To verify the changes:

1.  **Regular Node Test**:
    -   Select a Rectangle.
    -   Try typing `acc`. -> **Should NOT appear**.
    -   Type `accp`. -> **Should appear and center the rectangle**.

2.  **AutoLayout Test**:
    -   Select an AutoLayout frame.
    -   Type `acc`. -> **Should appear without parent hint**.
    -   Run `acc`. -> **Centers children**.
    -   Run `acc p`. -> **Centers frame in parent**.
    -   Run `accp`. -> **Centers frame in parent**.
