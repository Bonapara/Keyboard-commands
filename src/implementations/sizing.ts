// ================================
// Sizing Functions
// ================================

import { MIN_SCALE_FACTOR } from '../constants';
import { resolveDelta } from '../utils';

export function resize(value: string, resizeType?: 'width' | 'height') {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }

  for (const node of selection) {
    if ('resize' in node) {
      const width = resizeType === 'height'
        ? node.width
        : Math.max(0.01, resolveDelta(value, node.width));
      const height = resizeType === 'width'
        ? node.height
        : Math.max(0.01, resolveDelta(value, node.height));
      node.resize(width, height);
    }
  }

  const message = resizeType
    ? `${resizeType} set to ${value} for all selected items`
    : `width and height set to ${value} for all selected items`;
  figma.notify(message);
}

export function scale(value?: string, dimension?: 'width' | 'height') {
  if (value === undefined) throw new Error('No value provided');
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  for (const node of selection) {
    if ('rescale' in node) {
      let scaleFactor: number;
      
      if (dimension === 'width') {
        scaleFactor = Number(value) / node.width;
      } else if (dimension === 'height') {
        scaleFactor = Number(value) / node.height;
      } else {
        scaleFactor = Number(value) / 100;
      }
      
      if (scaleFactor < MIN_SCALE_FACTOR) throw new Error('Scale factor must be at least 1%');
      node.rescale(scaleFactor);
    }
  }
  
  const message = dimension 
  ? `Scaled items to ${value}${dimension === 'width' ? 'w' : 'h'}`
  : `Scaled items to ${value}%`;
  
  figma.notify(message);
}

interface DimensionOptions {
  type: 'max' | 'min';
  direction: 'width' | 'height';
  null: boolean;
  value?: string;
}

export function maxDimension({ type, direction, null: isNull, value }: DimensionOptions): void {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  for (const node of selection) {
    // Check if node supports max/min width/height properties
    if ('maxWidth' in node && 'maxHeight' in node) {
      if (isNull) {
        // Set the property to null to remove constraint
        if (type === 'max' && direction === 'width') {
          node.maxWidth = null;
        } else if (type === 'max' && direction === 'height') {
          node.maxHeight = null;
        } else if (type === 'min' && direction === 'width') {
          node.minWidth = null;
        } else if (type === 'min' && direction === 'height') {
          node.minHeight = null;
        }
      } else if (value !== undefined) {
        const currentMap = {
          'max:width': node.maxWidth ?? node.width,
          'max:height': node.maxHeight ?? node.height,
          'min:width': node.minWidth ?? node.width,
          'min:height': node.minHeight ?? node.height,
        };
        const next = resolveDelta(value, currentMap[`${type}:${direction}`] as number);
        if (next > 0) {
          if (type === 'max' && direction === 'width') node.maxWidth = next;
          else if (type === 'max' && direction === 'height') node.maxHeight = next;
          else if (type === 'min' && direction === 'width') node.minWidth = next;
          else if (type === 'min' && direction === 'height') node.minHeight = next;
        }
      }
    }
  }
  
  const dimensionType = `${type} ${direction}`;
  const message = isNull 
  ? `Removed ${dimensionType} constraint`
  : `Set ${dimensionType} to ${value}px`;
  
  figma.notify(message);
}

export function absolutePosition() {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  for (const node of selection) {
    if ('layoutPositioning' in node) {
      node.layoutPositioning = node.layoutPositioning === 'ABSOLUTE' ? 'AUTO' : 'ABSOLUTE';
    }
  }
}

