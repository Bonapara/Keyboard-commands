// ================================
// Export Functions
// ================================

import { EXPORT_TIMEOUT } from '../constants';

export async function exportAs({
  format,
  constraintType,
  constraintValue
}: {
  format: 'SVG' | 'PNG' | 'PDF' | 'JPG';
  constraintType?: 'SCALE' | 'WIDTH' | 'HEIGHT';
  constraintValue: string;
}) {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  // Create export settings object based on format
  const settings: ExportSettings = (() => {
    switch (format) {
      case 'PDF':
      return {
        format: 'PDF',
      };
      case 'SVG':
      return {
        format: 'SVG',
      };
      case 'PNG':
      case 'JPG':
      return {
        format: format,
        constraint: {
          type: constraintType || 'SCALE',
          value: Number(constraintValue)
        }
      };
      default:
      throw new Error(`Unsupported format: ${format}`);
    }
  })();
  
  try {
    // Export each selected node
    const exportResults = [];
    for (const node of selection) {
      const exportResult = await node.exportAsync(settings);
      exportResults.push({
        name: node.name,
        format,
        bytes: exportResult
      });
    }
    figma.showUI(__html__, { visible: false });
    figma.ui.postMessage(exportResults);
  } catch (error) {
    console.error('Export failed:', error);
    figma.notify('Export failed. Please try again.');
    throw error;
  }
  
  // Handle messages from UI with timeout to prevent hanging
  return new Promise((resolve, _reject) => {
    const timeout = setTimeout(() => {
      figma.notify('Export completed');
      resolve('Export timeout - files may still be downloading');
    }, EXPORT_TIMEOUT);
    
    figma.ui.onmessage = msg => {
      clearTimeout(timeout);
      resolve(msg);
      figma.closePlugin();
    };
  });
}

