// ================================
// Text Functions
// ================================

export async function setTextAutoResize(resizeType: 'NONE' | 'WIDTH_AND_HEIGHT' | 'HEIGHT') {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  for (const node of selection) {
    if (node.type === 'TEXT') {
      try {
        // Ensure the font is loaded before setting textAutoResize
        if (node.fontName !== figma.mixed) {
          await figma.loadFontAsync(node.fontName);
          node.textAutoResize = resizeType;
        }
      } catch (error) {
        console.error('Error loading font:', error);
        figma.notify(`Failed to set text auto-resize for "${node.name}"`);
      }
    }
  }
  figma.notify(`Text auto-resize set to ${resizeType.toLowerCase().replace('_', ' ')}`);
}

export async function textTruncation(maxLines?: string) {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  for (const node of selection) {
    if (node.type === 'TEXT') {
      try {
        if (node.fontName !== figma.mixed) {
          await figma.loadFontAsync(node.fontName);
          if (maxLines === undefined) {
            // Toggle mode
            const newTruncation = node.textTruncation === 'DISABLED' ? 'ENDING' : 'DISABLED';
            node.textTruncation = newTruncation;
            figma.notify(`Text truncation ${newTruncation === 'ENDING' ? 'enabled' : 'disabled'}`);
          } else {
            // Set mode with max lines
            const lines = parseInt(maxLines);
            if (isNaN(lines) || lines < 1) {
              throw new Error('Please provide a valid number greater than or equal to 1');
            }
            node.textTruncation = 'ENDING';
            node.maxLines = lines;
            figma.notify(`Text truncation set to ${lines} lines`);
          }
        }
      } catch (error) {
        console.error('Error setting text truncation:', error);
        figma.notify(`Failed to set text truncation for "${node.name}"`);
      }
    }
  }
}

export async function setFontSize(size: string) {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  const fontSize = parseInt(size);
  if (isNaN(fontSize) || fontSize < 1) {
    throw new Error('Please provide a valid font size greater than 0');
  }
  
  for (const node of selection) {
    if (node.type === 'TEXT') {
      try {
        if (node.fontName !== figma.mixed) {
          await figma.loadFontAsync(node.fontName);
          node.fontSize = fontSize;
        }
      } catch (error) {
        console.error('Error loading font:', error);
        figma.notify(`Failed to set font size for "${node.name}"`);
      }
    }
  }
  figma.notify(`Font size set to ${fontSize}px`);
}

export async function setFontWeight(weight: string) {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  const fontWeight = parseInt(weight);
  if (isNaN(fontWeight) || fontWeight < 100 || fontWeight > 900 || fontWeight % 100 !== 0) {
    throw new Error('Please provide a valid font weight (100-900 in steps of 100)');
  }
  
  for (const node of selection) {
    if (node.type === 'TEXT' && node.fontName !== figma.mixed) {
      try {
        const currentFont = node.fontName as FontName;
        const newFontName = {
          family: currentFont.family,
          style: fontWeight.toString()
        };
        
        await figma.loadFontAsync(newFontName);
        node.fontName = newFontName;
      } catch (error) {
        console.error('Error loading font weight:', error);
        figma.notify(`Failed to set font weight for "${node.name}" - weight ${fontWeight} may not be available`);
      }
    }
  }
  figma.notify(`Font weight set to ${fontWeight}`);
}

export async function setLetterSpacing(spacing: string) {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  const letterSpacing = parseFloat(spacing);
  if (isNaN(letterSpacing)) {
    throw new Error('Please provide a valid number for letter spacing');
  }
  
  for (const node of selection) {
    if (node.type === 'TEXT') {
      try {
        if (node.fontName !== figma.mixed) {
          await figma.loadFontAsync(node.fontName);
          node.letterSpacing = { value: letterSpacing, unit: 'PIXELS' };
        }
      } catch (error) {
        console.error('Error loading font:', error);
        figma.notify(`Failed to set letter spacing for "${node.name}"`);
      }
    }
  }
  figma.notify(`Letter spacing set to ${letterSpacing}px`);
}

export async function setLineHeight(height: string) {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  for (const node of selection) {
    if (node.type === 'TEXT') {
      try {
        if (node.fontName !== figma.mixed) {
          await figma.loadFontAsync(node.fontName);
          if (height === 'AUTO') {
            node.lineHeight = { unit: 'AUTO' };
          } else {
            // Check if the height value ends with %
            const isPercentage = height.endsWith('%');
            
            // Remove % if present and parse the number
            const value = parseFloat(isPercentage ? height.slice(0, -1) : height);
            
            if (isNaN(value) || value < 0) {
              throw new Error('Please provide a valid number for line height');
            }
            
            // Set line height based on whether it's a percentage or pixel value
            node.lineHeight = isPercentage 
            ? { unit: 'PERCENT', value: value }
            : { unit: 'PIXELS', value: value };
          }
        }
      } catch (error) {
        console.error('Error loading font:', error);
        figma.notify(`Failed to set line height for "${node.name}"`);
      }
    }
  }
  figma.notify(`Line height set to ${height}`);
}

export async function setTextCase(textCase: TextCase) {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  for (const node of selection) {
    if (node.type === 'TEXT') {
      try {
        if (node.fontName !== figma.mixed) {
          await figma.loadFontAsync(node.fontName);
          node.textCase = textCase;
        }
      } catch (error) {
        console.error('Error loading font:', error);
        figma.notify(`Failed to set text case for "${node.name}"`);
      }
    }
  }
  figma.notify(`Text case set to ${textCase.toLowerCase().replace('_', ' ')}`);
}

export async function toggleTextDecoration(decoration: TextDecoration) {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  for (const node of selection) {
    if (node.type === 'TEXT') {
      try {
        if (node.fontName !== figma.mixed) {
          await figma.loadFontAsync(node.fontName);
          const newDecoration = node.textDecoration === decoration ? 'NONE' : decoration;
          node.textDecoration = newDecoration;
          figma.notify(`Text decoration ${newDecoration === 'NONE' ? 'removed' : 'set to ' + decoration.toLowerCase()}`);
        }
      } catch (error) {
        console.error('Error loading font:', error);
        figma.notify(`Failed to toggle text decoration for "${node.name}"`);
      }
    }
  }
}

export async function setTextListOptions(listType: 'ORDERED' | 'UNORDERED' | 'NONE') {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  for (const node of selection) {
    if (node.type === 'TEXT') {
      try {
        if (node.fontName !== figma.mixed) {
          await figma.loadFontAsync(node.fontName);
          // Select all text in the node
          const length = node.characters.length;
          node.setRangeListOptions(0, length, { type: listType });
        }
      } catch (error) {
        console.error('Error loading font:', error);
        figma.notify(`Failed to set list options for "${node.name}"`);
      }
    }
  }
  figma.notify(`List type set to ${listType.toLowerCase()}`);
}

export async function toggleVerticalTrim() {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error('No items selected');
  }
  
  for (const node of selection) {
    if (node.type === 'TEXT') {
      try {
        if (node.fontName !== figma.mixed) {
          await figma.loadFontAsync(node.fontName);
          // Toggle between CAP_HEIGHT and NONE
          const newTrim = (node.leadingTrim === figma.mixed || 
            !node.leadingTrim || 
            node.leadingTrim === 'CAP_HEIGHT')
            ? 'NONE'
            : 'CAP_HEIGHT';
          node.leadingTrim = newTrim;
          figma.notify(`Vertical trim ${newTrim === 'NONE' ? 'disabled' : 'enabled'}`);
        }
      } catch (error) {
        console.error('Error loading font:', error);
        figma.notify(`Failed to toggle vertical trim for "${node.name}"`);
      }
    }
  }
}
  
export function removeTextStyle() {
  if (figma.currentPage.selection[0].type === 'TEXT') {
    figma.currentPage.selection[0].setTextStyleIdAsync('');
  }
}

