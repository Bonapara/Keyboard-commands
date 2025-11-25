// ================================
// Color Swapping Functions
// ================================

import { resolvePaintValue } from '../utils';
import { PaintResolution } from '../types';

interface ColorInfo {
    rgb: RGB;
    bindingType: 'style' | 'variable' | 'literal';
    name?: string;
    key?: string;
    usageCount: number;
    locations: ('fill' | 'stroke' | 'effect')[];
}

// ... existing code ...

// ... existing code ...

function colorsMatch(color1: RGB, color2: RGB, tolerance: number = 0.001): boolean {
    return (
        Math.abs(color1.r - color2.r) < tolerance &&
        Math.abs(color1.g - color2.g) < tolerance &&
        Math.abs(color1.b - color2.b) < tolerance
    );
}

function rgbToHex(rgb: RGB): string {
    const toHex = (n: number): string => {
        const hex = Math.round(n * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

function createColorSwatchSVG(rgb: RGB): string {
    const hexColor = rgbToHex(rgb);
    return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="16" height="16" fill="white"/>
  <rect x="1" y="1" width="14" height="14" fill="${hexColor}"/>
  <rect x="0.5" y="0.5" width="15" height="15" stroke="#00000033" stroke-opacity="0.2"/>
</svg>`;
}

async function extractColorFromPaint(paint: Paint): Promise<{ rgb: RGB; bindingType: 'style' | 'variable' | 'literal'; name?: string; key?: string } | null> {
    if (paint.type !== 'SOLID' || paint.visible === false) {
        return null;
    }

    const solidPaint = paint as SolidPaint;

    // Check if it's bound to a variable
    if (solidPaint.boundVariables && solidPaint.boundVariables.color) {
        const variableId = solidPaint.boundVariables.color.id;
        try {
            const variable = await figma.variables.getVariableByIdAsync(variableId);
            if (variable) {
                return {
                    rgb: solidPaint.color,
                    bindingType: 'variable',
                    name: variable.name,
                    key: variableId
                };
            }
        } catch (e) {
            // Variable not found, treat as literal
        }
    }

    return {
        rgb: solidPaint.color,
        bindingType: 'literal',
    };
}

function traverseNode(node: SceneNode, callback: (node: SceneNode) => void) {
    callback(node);

    // Recursively traverse children if the node has children
    if ('children' in node) {
        for (const child of node.children) {
            traverseNode(child, callback);
        }
    }
}

async function extractUniqueColors(selection: readonly SceneNode[]): Promise<ColorInfo[]> {
    const colorMap = new Map<string, ColorInfo>();

    // Collect all nodes including nested children
    const allNodes: SceneNode[] = [];
    for (const node of selection) {
        traverseNode(node, (currentNode) => {
            allNodes.push(currentNode);
        });
    }

    // Extract colors from all collected nodes
    for (const node of allNodes) {
        await extractColorsFromNode(node, colorMap);
    }

    return Array.from(colorMap.values());
}

async function extractColorsFromNode(node: SceneNode, colorMap: Map<string, ColorInfo>): Promise<void> {
    // Extract from fills
    if ('fills' in node) {
        const fills = node.fills;
        if (fills !== figma.mixed && Array.isArray(fills)) {
            // Check if fill is using a style
            let fillStyleName: string | undefined;
            let fillStyleKey: string | undefined;

            if ('fillStyleId' in node && typeof node.fillStyleId === 'string' && node.fillStyleId !== '') {
                try {
                    const style = await figma.getStyleByIdAsync(node.fillStyleId);
                    if (style && style.type === 'PAINT') {
                        fillStyleName = style.name;
                        fillStyleKey = style.key;
                    }
                } catch (e) {
                    // Style not found
                }
            }

            for (const paint of fills) {
                const colorInfo = await extractColorFromPaint(paint);
                if (!colorInfo) continue;

                // If we have a fill style, use it
                if (fillStyleName && fillStyleKey) {
                    colorInfo.bindingType = 'style';
                    colorInfo.name = fillStyleName;
                    colorInfo.key = fillStyleKey;
                }

                const key = `${colorInfo.rgb.r},${colorInfo.rgb.g},${colorInfo.rgb.b},${colorInfo.bindingType},${colorInfo.key || colorInfo.name || 'literal'}`;

                if (colorMap.has(key)) {
                    const existing = colorMap.get(key)!;
                    existing.usageCount++;
                    if (!existing.locations.includes('fill')) {
                        existing.locations.push('fill');
                    }
                } else {
                    colorMap.set(key, {
                        ...colorInfo,
                        usageCount: 1,
                        locations: ['fill']
                    });
                }
            }
        }
    }

    // Extract from strokes
    if ('strokes' in node) {
        const strokes = node.strokes;
        if (Array.isArray(strokes)) {
            // Check if stroke is using a style
            let strokeStyleName: string | undefined;
            let strokeStyleKey: string | undefined;

            if ('strokeStyleId' in node && typeof node.strokeStyleId === 'string' && node.strokeStyleId !== '') {
                try {
                    const style = await figma.getStyleByIdAsync(node.strokeStyleId);
                    if (style && style.type === 'PAINT') {
                        strokeStyleName = style.name;
                        strokeStyleKey = style.key;
                    }
                } catch (e) {
                    // Style not found
                }
            }

            for (const paint of strokes) {
                const colorInfo = await extractColorFromPaint(paint);
                if (!colorInfo) continue;

                // If we have a stroke style, use it
                if (strokeStyleName && strokeStyleKey) {
                    colorInfo.bindingType = 'style';
                    colorInfo.name = strokeStyleName;
                    colorInfo.key = strokeStyleKey;
                }

                const key = `${colorInfo.rgb.r},${colorInfo.rgb.g},${colorInfo.rgb.b},${colorInfo.bindingType},${colorInfo.key || colorInfo.name || 'literal'}`;

                if (colorMap.has(key)) {
                    const existing = colorMap.get(key)!;
                    existing.usageCount++;
                    if (!existing.locations.includes('stroke')) {
                        existing.locations.push('stroke');
                    }
                } else {
                    colorMap.set(key, {
                        ...colorInfo,
                        usageCount: 1,
                        locations: ['stroke']
                    });
                }
            }
        }
    }

    // Extract from effects
    if ('effects' in node && Array.isArray(node.effects)) {
        for (const effect of node.effects) {
            if ((effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') && effect.visible !== false) {
                const effectColor = effect.color;
                const rgb: RGB = { r: effectColor.r, g: effectColor.g, b: effectColor.b };

                const key = `${rgb.r},${rgb.g},${rgb.b},literal,effect`;

                if (colorMap.has(key)) {
                    const existing = colorMap.get(key)!;
                    existing.usageCount++;
                    if (!existing.locations.includes('effect')) {
                        existing.locations.push('effect');
                    }
                } else {
                    colorMap.set(key, {
                        rgb,
                        bindingType: 'literal',
                        usageCount: 1,
                        locations: ['effect']
                    });
                }
            }
        }
    }
}

export async function searchSelectionColors(searchTerm: string): Promise<Array<string | { name: string; data: unknown; icon?: string }>> {
    const selection = figma.currentPage.selection;

    if (selection.length === 0) {
        return ['No selection'];
    }

    const colors = await extractUniqueColors(selection);

    if (colors.length === 0) {
        return ['No colors found in selection'];
    }

    const normalizeString = (str: string) => str.toLowerCase().replace(/[/\-_]/g, ' ').replace(/\s+/g, ' ').trim();
    const normalizedSearch = normalizeString(searchTerm);

    const results = colors
        .filter(color => {
            if (!searchTerm || searchTerm.trim() === '') return true;

            // Match by name if available
            if (color.name && normalizeString(color.name).includes(normalizedSearch)) {
                return true;
            }

            // Match by hex value
            const hex = rgbToHex(color.rgb);
            if (hex.toLowerCase().includes(normalizedSearch)) {
                return true;
            }

            return false;
        })
        .map((color, index) => {
            const hex = rgbToHex(color.rgb);
            const _locations = color.locations.join(', ');
            const usageText = `${color.usageCount}`;
            const hint = index === 0 ? ' -> Type :: to swap' : '';

            let displayName: string;
            if (color.name) {
                const type = color.bindingType === 'style' ? 'Style' : 'Variable';
                displayName = `${color.name} (${type}) - ${usageText}${hint}`;
            } else {
                displayName = `${hex} - ${usageText}${hint}`;
            }

            return {
                name: displayName,
                data: color.name || hex,
                icon: createColorSwatchSVG(color.rgb)
            };
        });

    return results.length > 0 ? results : ['No matching colors'];
}

export async function swapSelectionColors(value: string) {
    const selection = figma.currentPage.selection;

    if (selection.length === 0) {
        throw new Error('No items selected');
    }

    // Parse the value to extract source and target colors
    const delimiterIndex = value.indexOf('::');

    if (delimiterIndex === -1) {
        throw new Error('Invalid format. Use: scs?sourceColor :: targetColor');
    }

    const sourceValue = value.substring(0, delimiterIndex).trim();
    const targetValue = value.substring(delimiterIndex + 2).trim();

    if (!sourceValue || !targetValue) {
        throw new Error('Both source and target colors must be specified');
    }

    // Extract unique colors first to help resolve the source color
    const uniqueColors = await extractUniqueColors(selection);

    // Try to find the source color in the unique colors list
    let sourceRGB: RGB | null = null;
    let sourceResolution: PaintResolution;

    // Helper to strip metadata from name for comparison
    const cleanName = (name: string) => name.split(' (')[0].trim();

    // Clean the source value as well, as it might come with metadata (e.g. "Name (Variable)")
    const cleanedSourceValue = cleanName(sourceValue);

    let matchingColor = uniqueColors.find(c => {
        const cleaned = c.name ? cleanName(c.name) : '';
        const hex = rgbToHex(c.rgb).toLowerCase();

        if (c.name && cleaned === cleanedSourceValue) return true;
        if (c.bindingType === 'literal' && hex === cleanedSourceValue.toLowerCase()) return true;
        return false;
    });

    // If no exact match, try fuzzy match (case-insensitive substring)
    if (!matchingColor) {
        const lowerSource = cleanedSourceValue.toLowerCase();
        matchingColor = uniqueColors.find(c => {
            if (c.name) {
                const cleaned = cleanName(c.name).toLowerCase();
                return cleaned.includes(lowerSource);
            }
            return false;
        });
    }

    if (matchingColor) {
        sourceRGB = matchingColor.rgb;

        if (matchingColor.bindingType === 'style' && matchingColor.key) {
            sourceResolution = {
                type: 'style',
                styleKey: matchingColor.key,
                styleName: matchingColor.name,
                styleType: 'PAINT'
            };
        } else if (matchingColor.bindingType === 'variable' && matchingColor.key) {
            sourceResolution = {
                type: 'variable',
                variableId: matchingColor.key,
                variableName: matchingColor.name,
                isLibraryVariable: true // Assume library to force import if needed
            };
        } else {
            sourceResolution = {
                type: 'literal',
                color: matchingColor.rgb
            };
        }
    } else {
        // Fallback to standard resolution if not found in selection (e.g. user typed a hex not in selection?)
        // This shouldn't happen for source color if user picked from suggestions, but possible if typed manually
        sourceResolution = await resolvePaintValue(sourceValue);

        if (sourceResolution.type === 'literal') {
            sourceRGB = sourceResolution.color!;
        } else if (sourceResolution.type === 'variable') {
            // Get the variable's color value
            let variableId = sourceResolution.variableId!;

            if (sourceResolution.isLibraryVariable) {
                const importedVar = await figma.variables.importVariableByKeyAsync(variableId);
                variableId = importedVar.id;
            }

            const variable = await figma.variables.getVariableByIdAsync(variableId);
            if (variable && variable.resolvedType === 'COLOR') {
                const modeId = Object.keys(variable.valuesByMode)[0];
                if (modeId) {
                    const value = variable.valuesByMode[modeId];
                    if (value && typeof value === 'object' && 'r' in value) {
                        sourceRGB = value as RGB;
                    }
                }
            }
        } else if (sourceResolution.type === 'style') {
            // Get the style's color value
            if (sourceResolution.styleKey) {
                const localStyles = await figma.getLocalPaintStylesAsync();
                let style = localStyles.find(s => s.key === sourceResolution.styleKey);

                if (!style) {
                    const importedStyle = await figma.importStyleByKeyAsync(sourceResolution.styleKey);
                    if (importedStyle.type === 'PAINT') {
                        style = importedStyle as PaintStyle;
                    }
                }

                if (style) {
                    for (const paint of style.paints) {
                        if (paint.type === 'SOLID') {
                            sourceRGB = paint.color;
                            break;
                        }
                    }
                }
            }
        }
    }

    // Resolve target color (standard resolution)
    const targetResolution = await resolvePaintValue(targetValue);

    if (!sourceResolution) {
        throw new Error('Could not resolve source color');
    }

    if (!sourceRGB) {
        throw new Error('Could not determine source color');
    }

    // Now swap colors in the selection
    let swapCount = 0;

    // Helper to process paints (fills/strokes)
    const processPaints = async (paints: readonly Paint[], sourceRGB: RGB, targetResolution: PaintResolution): Promise<{ modified: boolean, newPaints: Paint[] }> => {
        let modified = false;
        const newPaints: Paint[] = [];

        for (const paint of paints) {
            if (paint.type === 'SOLID' && colorsMatch(paint.color, sourceRGB)) {
                modified = true;
                swapCount++;

                switch (targetResolution.type) {
                    case 'style':
                        newPaints.push(paint);
                        break;
                    case 'variable': {
                        let variableId = targetResolution.variableId!;
                        if (targetResolution.isLibraryVariable) {
                            const importedVar = await figma.variables.importVariableByKeyAsync(variableId);
                            variableId = importedVar.id;
                        }
                        const variable = await figma.variables.getVariableByIdAsync(variableId);
                        if (variable) {
                            newPaints.push(figma.variables.setBoundVariableForPaint(paint, 'color', variable));
                        } else {
                            newPaints.push(paint);
                        }
                        break;
                    }
                    case 'literal':
                        newPaints.push({ type: 'SOLID', color: targetResolution.color! });
                        break;
                }
            } else {
                newPaints.push(paint);
            }
        }
        return { modified, newPaints };
    };

    // Helper to apply style to node
    const applyStyleToNode = async (node: SceneNode, styleKey: string, property: 'fill' | 'stroke') => {
        const localStyles = await figma.getLocalPaintStylesAsync();
        let style = localStyles.find(s => s.key === styleKey);

        if (!style) {
            const importedStyle = await figma.importStyleByKeyAsync(styleKey);
            if (importedStyle.type === 'PAINT') {
                style = importedStyle as PaintStyle;
            }
        }

        if (style) {
            if (property === 'fill' && 'fillStyleId' in node) await node.setFillStyleIdAsync(style.id);
            if (property === 'stroke' && 'strokeStyleId' in node) await node.setStrokeStyleIdAsync(style.id);
        }
    };

    // Recursive function to swap colors in a node and its children
    const swapColorsInNode = async (node: SceneNode) => {
        // Swap fills
        if ('fills' in node && node.fills !== figma.mixed && Array.isArray(node.fills)) {
            const { modified, newPaints } = await processPaints(node.fills, sourceRGB!, targetResolution);
            if (modified) {
                node.fills = newPaints;
                if (targetResolution.type === 'style' && targetResolution.styleKey) {
                    await applyStyleToNode(node, targetResolution.styleKey, 'fill');
                }
            }
        }

        // Swap strokes
        if ('strokes' in node && Array.isArray(node.strokes)) {
            const { modified, newPaints } = await processPaints(node.strokes, sourceRGB!, targetResolution);
            if (modified) {
                node.strokes = newPaints;
                if (targetResolution.type === 'style' && targetResolution.styleKey) {
                    await applyStyleToNode(node, targetResolution.styleKey, 'stroke');
                }
            }
        }

        // Swap effect colors
        if ('effects' in node && Array.isArray(node.effects)) {
            let modified = false;
            const newEffects: Effect[] = [];

            for (const effect of node.effects) {
                if ((effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') &&
                    colorsMatch({ r: effect.color.r, g: effect.color.g, b: effect.color.b }, sourceRGB!)) {
                    modified = true;
                    swapCount++;

                    if (targetResolution.type === 'literal') {
                        newEffects.push({
                            ...effect,
                            color: { ...effect.color, ...targetResolution.color! }
                        });
                    } else {
                        newEffects.push(effect);
                    }
                } else {
                    newEffects.push(effect);
                }
            }

            if (modified) {
                node.effects = newEffects;
            }
        }

        // Recursively process children
        if ('children' in node) {
            for (const child of node.children) {
                await swapColorsInNode(child);
            }
        }
    };

    for (const node of selection) {
        await swapColorsInNode(node);
    }

    if (swapCount === 0) {
        figma.notify('No matching colors found to swap');
    } else {
        figma.notify(`Swapped ${swapCount} color${swapCount !== 1 ? 's' : ''}`);
    }
}
