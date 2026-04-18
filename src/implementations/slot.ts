// ================================
// Slot Functions
// ================================

import { pluralize } from './instance';

export function createSlot() {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }

  const slots: SlotNode[] = [];
  const errors: string[] = [];

  for (const node of selection) {
    if (node.type === 'COMPONENT') {
      try {
        slots.push(node.createSlot());
      } catch (error) {
        errors.push(`${node.name}: ${(error as Error).message}`);
      }
    } else if (node.type === 'COMPONENT_SET') {
      for (const child of node.children) {
        if (child.type !== 'COMPONENT') continue;
        try {
          slots.push(child.createSlot());
        } catch (error) {
          errors.push(`${child.name}: ${(error as Error).message}`);
        }
      }
    }
  }

  if (slots.length === 0) {
    figma.notify(errors[0] || 'Select a component to create a slot', { error: true });
    return;
  }

  figma.currentPage.selection = slots;
  figma.notify(`Created ${slots.length} ${pluralize(slots.length, 'slot')}`);
}

export function resetSlot() {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }

  let reset = 0;
  for (const node of selection) {
    if (node.type !== 'SLOT') continue;
    node.resetSlot();
    reset++;
  }

  if (reset === 0) {
    figma.notify('Select a slot to reset', { error: true });
    return;
  }

  figma.notify(`Reset ${reset} ${pluralize(reset, 'slot')}`);
}
