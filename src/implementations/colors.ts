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

function createDualColorSwatchSVG(rgbA: RGB, rgbB: RGB): string {
    const hexA = rgbToHex(rgbA);
    const hexB = rgbToHex(rgbB);
    return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="16" height="16" fill="white"/>
  <path d="M1 1 H15 V15 Z" fill="${hexA}"/>
  <path d="M1 1 V15 H15 Z" fill="${hexB}"/>
  <rect x="0.5" y="0.5" width="15" height="15" stroke="#00000033" stroke-opacity="0.2"/>
</svg>`;
}

function cleanColorReferenceName(value: string): string {
    return value.split(' (')[0].trim();
}

function createColorInfoKey(color: { rgb: RGB; bindingType: ColorInfo['bindingType']; key?: string; name?: string }): string {
    return `${color.rgb.r},${color.rgb.g},${color.rgb.b},${color.bindingType},${color.key || color.name || 'literal'}`;
}

function findMatchingSelectionColor(colors: ColorInfo[], value: string): ColorInfo | undefined {
    const cleanedValue = cleanColorReferenceName(value);
    const lowerValue = cleanedValue.toLowerCase();

    let match = colors.find(c => {
        const cleanedName = c.name ? cleanColorReferenceName(c.name) : '';
        const hex = rgbToHex(c.rgb).toLowerCase();

        if (c.name && cleanedName === cleanedValue) return true;
        if (c.bindingType === 'literal' && hex === lowerValue) return true;
        return false;
    });

    if (!match) {
        match = colors.find(c => c.name && cleanColorReferenceName(c.name).toLowerCase().includes(lowerValue));
    }

    return match;
}

function resolutionFromSelectionColor(color: ColorInfo): PaintResolution {
    if (color.bindingType === 'style' && color.key) {
        return {
            type: 'style',
            styleKey: color.key,
            styleName: color.name,
            styleType: 'PAINT'
        };
    }

    if (color.bindingType === 'variable' && color.key) {
        return {
            type: 'variable',
            variableId: color.key,
            variableName: color.name,
            isLibraryVariable: false
        };
    }

    return {
        type: 'literal',
        color: color.rgb
    };
}

async function normalizePaintResolution(resolution: PaintResolution): Promise<PaintResolution> {
    if (resolution.type !== 'variable' || !resolution.isLibraryVariable) {
        return resolution;
    }

    const importedVar = await figma.variables.importVariableByKeyAsync(resolution.variableId!);
    if (!importedVar) {
        throw new Error(`Variable not found: ${resolution.variableName || resolution.variableId}`);
    }

    return {
        ...resolution,
        variableId: importedVar.id,
        isLibraryVariable: false
    };
}

async function resolvePaintResolutionColor(resolution: PaintResolution): Promise<{ rgb: RGB | null; resolution: PaintResolution }> {
    const normalizedResolution = await normalizePaintResolution(resolution);

    if (normalizedResolution.type === 'literal') {
        return {
            rgb: normalizedResolution.color!,
            resolution: normalizedResolution
        };
    }

    if (normalizedResolution.type === 'variable') {
        const variable = await figma.variables.getVariableByIdAsync(normalizedResolution.variableId!);
        if (variable && variable.resolvedType === 'COLOR') {
            const modeId = Object.keys(variable.valuesByMode)[0];
            if (modeId) {
                const value = variable.valuesByMode[modeId];
                if (value && typeof value === 'object' && 'r' in value) {
                    return {
                        rgb: value as RGB,
                        resolution: normalizedResolution
                    };
                }
            }
        }

        return {
            rgb: null,
            resolution: normalizedResolution
        };
    }

    const localStyles = await figma.getLocalPaintStylesAsync();
    let style = localStyles.find(s => s.key === normalizedResolution.styleKey);

    if (!style) {
        const importedStyle = await figma.importStyleByKeyAsync(normalizedResolution.styleKey!);
        if (importedStyle.type === 'PAINT') {
            style = importedStyle as PaintStyle;
        }
    }

    if (!style) {
        return {
            rgb: null,
            resolution: normalizedResolution
        };
    }

    for (const paint of style.paints) {
        if (paint.type === 'SOLID') {
            return {
                rgb: paint.color,
                resolution: normalizedResolution
            };
        }
    }

    return {
        rgb: null,
        resolution: normalizedResolution
    };
}

function paintMatchesSource(
    paint: Paint,
    sourceRGB: RGB,
    sourceResolution: PaintResolution,
    nodeStyleKey: string | null
): boolean {
    if (paint.type !== 'SOLID' || !colorsMatch(paint.color, sourceRGB)) {
        return false;
    }

    const solidPaint = paint as SolidPaint;

    if (sourceResolution.type === 'literal') {
        return !nodeStyleKey && !solidPaint.boundVariables?.color;
    }

    if (sourceResolution.type === 'variable') {
        return solidPaint.boundVariables?.color?.id === sourceResolution.variableId;
    }

    return nodeStyleKey === sourceResolution.styleKey;
}

function createNodeStyleKeyResolver() {
    const styleKeyCache = new Map<string, string | null>();

    return async (node: SceneNode, property: 'fill' | 'stroke'): Promise<string | null> => {
        const styleId = property === 'fill'
            ? ('fillStyleId' in node && typeof node.fillStyleId === 'string' ? node.fillStyleId : '')
            : ('strokeStyleId' in node && typeof node.strokeStyleId === 'string' ? node.strokeStyleId : '');

        if (!styleId) {
            return null;
        }

        if (styleKeyCache.has(styleId)) {
            return styleKeyCache.get(styleId) ?? null;
        }

        const style = await figma.getStyleByIdAsync(styleId).catch(() => null);
        const styleKey = style && style.type === 'PAINT' ? style.key : null;
        styleKeyCache.set(styleId, styleKey);
        return styleKey;
    };
}

async function buildReplacementPaint(paint: Paint, resolution: PaintResolution): Promise<Paint> {
    const normalizedResolution = await normalizePaintResolution(resolution);

    switch (normalizedResolution.type) {
        case 'style':
            return paint;
        case 'variable': {
            const variable = await figma.variables.getVariableByIdAsync(normalizedResolution.variableId!);
            if (variable && paint.type === 'SOLID') {
                return figma.variables.setBoundVariableForPaint(paint as SolidPaint, 'color', variable);
            }
            return paint;
        }
        case 'literal':
            return { type: 'SOLID', color: normalizedResolution.color! };
    }
}

async function applyStyleToNode(node: SceneNode, styleKey: string, property: 'fill' | 'stroke') {
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

                const key = createColorInfoKey(colorInfo);

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

                const key = createColorInfoKey(colorInfo);

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
            const hint = index === 0 ? ' -> Type : to swap' : '';

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

    if (colors.length === 2 && results.length === 2) {
        const [a, b] = colors;
        const aDisplay = a.name || rgbToHex(a.rgb);
        const bDisplay = b.name || rgbToHex(b.rgb);
        results.push({
            name: `Swap ${aDisplay} ↔ ${bDisplay}`,
            data: `${aDisplay} :: ${bDisplay}`,
            icon: createDualColorSwatchSVG(a.rgb, b.rgb)
        });
    }

    return results.length > 0 ? results : ['No matching colors'];
}

export async function swapTwoSelectionColors() {
    const selection = figma.currentPage.selection;

    if (selection.length === 0) {
        throw new Error('No items selected');
    }

    const uniqueColors = await extractUniqueColors(selection);

    if (uniqueColors.length !== 2) {
        throw new Error(
            `Selection must contain exactly 2 colors to auto-swap (found ${uniqueColors.length}). Use cs? to pick colors.`
        );
    }

    const [a, b] = uniqueColors;
    const aRef = a.name || rgbToHex(a.rgb);
    const bRef = b.name || rgbToHex(b.rgb);
    return await swapSelectionColorsBidirectional(aRef, bRef);
}

export async function swapSelectionColors(value: string) {
    const selection = figma.currentPage.selection;

    if (selection.length === 0) {
        throw new Error('No items selected');
    }

    // No ":" means the user didn't supply a source/target pair. Fall back to
    // auto-swap: if the selection has exactly 2 colors, swap them bidirectionally.
    if (!value.includes(':')) {
        return await swapTwoSelectionColors();
    }

    // "::" marks a bidirectional swap (A↔B) produced by the 3rd autocomplete
    // suggestion when the selection contains exactly two colors.
    if (value.includes('::')) {
        const [aValue, bValue] = value.split('::').map(s => s.trim());
        if (!aValue || !bValue) {
            throw new Error('Both colors must be specified for bidirectional swap');
        }
        return await swapSelectionColorsBidirectional(aValue, bValue);
    }

    // Parse the value to extract source and target colors
    const delimiterIndex = value.indexOf(':');

    if (delimiterIndex === -1) {
        throw new Error('Invalid format. Use: scs?sourceColor : targetColor');
    }

    const sourceValue = value.substring(0, delimiterIndex).trim();
    const targetValue = value.substring(delimiterIndex + 1).trim();

    if (!sourceValue || !targetValue) {
        throw new Error('Both source and target colors must be specified');
    }

    // Extract unique colors first to help resolve the source color
    const uniqueColors = await extractUniqueColors(selection);

    // Try to find the source color in the unique colors list
    let sourceRGB: RGB | null = null;
    let sourceResolution: PaintResolution;

    const matchingColor = findMatchingSelectionColor(uniqueColors, sourceValue);

    if (matchingColor) {
        sourceRGB = matchingColor.rgb;
        sourceResolution = resolutionFromSelectionColor(matchingColor);
    } else {
        const resolvedSource = await resolvePaintResolutionColor(await resolvePaintValue(sourceValue));
        sourceResolution = resolvedSource.resolution;
        sourceRGB = resolvedSource.rgb;
    }

    // Resolve target color (standard resolution)
    const targetResolution = await normalizePaintResolution(await resolvePaintValue(targetValue));

    if (!sourceResolution) {
        throw new Error('Could not resolve source color');
    }

    if (!sourceRGB) {
        throw new Error('Could not determine source color');
    }

    // Now swap colors in the selection
    let swapCount = 0;

    const resolveNodeStyleKey = createNodeStyleKeyResolver();

    // Helper to process paints (fills/strokes)
    const processPaints = async (
        node: SceneNode,
        property: 'fill' | 'stroke',
        paints: readonly Paint[],
        sourceRGB: RGB,
        sourceResolution: PaintResolution,
        targetResolution: PaintResolution
    ): Promise<{ modified: boolean, newPaints: Paint[] }> => {
        let modified = false;
        const newPaints: Paint[] = [];
        const nodeStyleKey = await resolveNodeStyleKey(node, property);

        for (const paint of paints) {
            if (paintMatchesSource(paint, sourceRGB, sourceResolution, nodeStyleKey)) {
                modified = true;
                swapCount++;

                switch (targetResolution.type) {
                    case 'style':
                        newPaints.push(paint);
                        break;
                    case 'variable':
                        newPaints.push(await buildReplacementPaint(paint, targetResolution));
                        break;
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

    // Recursive function to swap colors in a node and its children
    const swapColorsInNode = async (node: SceneNode) => {
        // Swap fills
        if ('fills' in node && node.fills !== figma.mixed && Array.isArray(node.fills)) {
            const { modified, newPaints } = await processPaints(node, 'fill', node.fills, sourceRGB!, sourceResolution, targetResolution);
            if (modified) {
                node.fills = newPaints;
                if (targetResolution.type === 'style' && targetResolution.styleKey) {
                    await applyStyleToNode(node, targetResolution.styleKey, 'fill');
                }
            }
        }

        // Swap strokes
        if ('strokes' in node && Array.isArray(node.strokes)) {
            const { modified, newPaints } = await processPaints(node, 'stroke', node.strokes, sourceRGB!, sourceResolution, targetResolution);
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
                if (sourceResolution.type === 'literal' &&
                    (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') &&
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

async function swapSelectionColorsBidirectional(aValue: string, bValue: string) {
    const selection = figma.currentPage.selection;
    const uniqueColors = await extractUniqueColors(selection);

    const aMatch = findMatchingSelectionColor(uniqueColors, aValue);
    const bMatch = findMatchingSelectionColor(uniqueColors, bValue);
    const a = aMatch ? { rgb: aMatch.rgb, resolution: resolutionFromSelectionColor(aMatch) } : null;
    const b = bMatch ? { rgb: bMatch.rgb, resolution: resolutionFromSelectionColor(bMatch) } : null;
    if (!a || !b) {
        throw new Error('Could not resolve both colors in selection');
    }

    let swapCount = 0;
    const resolveNodeStyleKey = createNodeStyleKeyResolver();

    const processPaints = async (
        node: SceneNode,
        property: 'fill' | 'stroke',
        paints: readonly Paint[]
    ): Promise<{ modified: boolean; newPaints: Paint[]; styleKeyToApply?: string }> => {
        let modified = false;
        let styleKeyToApply: string | undefined;
        const newPaints: Paint[] = [];
        const nodeStyleKey = await resolveNodeStyleKey(node, property);

        for (const paint of paints) {
            if (paintMatchesSource(paint, a.rgb, a.resolution, nodeStyleKey)) {
                modified = true;
                swapCount++;
                newPaints.push(await buildReplacementPaint(paint, b.resolution));
                if (b.resolution.type === 'style') styleKeyToApply = b.resolution.styleKey;
            } else if (paintMatchesSource(paint, b.rgb, b.resolution, nodeStyleKey)) {
                modified = true;
                swapCount++;
                newPaints.push(await buildReplacementPaint(paint, a.resolution));
                if (a.resolution.type === 'style') styleKeyToApply = a.resolution.styleKey;
            } else {
                newPaints.push(paint);
            }
        }

        return { modified, newPaints, styleKeyToApply };
    };

    const swapInNode = async (node: SceneNode) => {
        if ('fills' in node && node.fills !== figma.mixed && Array.isArray(node.fills)) {
            const { modified, newPaints, styleKeyToApply } = await processPaints(node, 'fill', node.fills);
            if (modified) {
                node.fills = newPaints;
                if (styleKeyToApply) await applyStyleToNode(node, styleKeyToApply, 'fill');
            }
        }

        if ('strokes' in node && Array.isArray(node.strokes)) {
            const { modified, newPaints, styleKeyToApply } = await processPaints(node, 'stroke', node.strokes);
            if (modified) {
                node.strokes = newPaints;
                if (styleKeyToApply) await applyStyleToNode(node, styleKeyToApply, 'stroke');
            }
        }

        if ('effects' in node && Array.isArray(node.effects)) {
            let modified = false;
            const newEffects: Effect[] = [];
            for (const effect of node.effects) {
                if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
                    const ec: RGB = { r: effect.color.r, g: effect.color.g, b: effect.color.b };
                    if (a.resolution.type === 'literal' && colorsMatch(ec, a.rgb) && b.resolution.type === 'literal') {
                        modified = true;
                        swapCount++;
                        newEffects.push({ ...effect, color: { ...effect.color, ...b.resolution.color! } });
                        continue;
                    }
                    if (b.resolution.type === 'literal' && colorsMatch(ec, b.rgb) && a.resolution.type === 'literal') {
                        modified = true;
                        swapCount++;
                        newEffects.push({ ...effect, color: { ...effect.color, ...a.resolution.color! } });
                        continue;
                    }
                }
                newEffects.push(effect);
            }
            if (modified) node.effects = newEffects;
        }

        if ('children' in node) {
            for (const child of node.children) await swapInNode(child);
        }
    };

    for (const node of selection) await swapInNode(node);

    if (swapCount === 0) {
        figma.notify('No matching colors found to swap');
    } else {
        figma.notify(`Swapped ${swapCount} color${swapCount !== 1 ? 's' : ''}`);
    }
}
