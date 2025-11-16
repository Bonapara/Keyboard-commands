// ================================
// Sizing Functions
// ================================

import { MIN_SCALE_FACTOR } from '../constants';

export function resize(value: string, resizeType?: 'width' | 'height') {
  const numValue = Number(value);
  if (isNaN(numValue)) throw new Error('Invalid number provided');
  
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  for (const node of selection) {
    if ('resize' in node) {
      const newSize = {
        width: resizeType ? (resizeType === 'width' ? numValue : node.width) : numValue,
        height: resizeType ? (resizeType === 'height' ? numValue : node.height) : numValue
      };
      node.resize(newSize.width, newSize.height);
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
      } else {
        // Set the constraint value   
        if (value !== undefined && Number(value) > 0) {
          if (type === 'max' && direction === 'width') {
            node.maxWidth = Number(value);
          } else if (type === 'max' && direction === 'height') {
            node.maxHeight = Number(value);
          } else if (type === 'min' && direction === 'width') {
            node.minWidth = Number(value);
          } else if (type === 'min' && direction === 'height') {
            node.minHeight = Number(value);
          }
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
      if (node.layoutPositioning === 'ABSOLUTE') {
        node.layoutPositioning = 'AUTO';
      } else {
        node.layoutPositioning = 'ABSOLUTE';
      }
    }
    break;
  }
}

