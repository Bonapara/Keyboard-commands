
import { notify } from '../utils';
import { LibraryItem, LibraryItemType } from '../types';

// ==================================
// Types & Constants
// ==================================

// Map<LibraryName, LibraryItem[]>
export type LibraryData = Record<string, LibraryItem[]>;

import {
    getStoredLibraries,
    saveLibraries,
    getActiveLibraries,
    setActiveLibraries,
    STORAGE_KEY
} from '../storage';

export {
    getStoredLibraries,
    saveLibraries,
    getActiveLibraries,
    setActiveLibraries,
    STORAGE_KEY
};

// ==================================
// Core Functions
// ==================================

export async function publishLibrary() {
    console.clear();
    console.log('🚀 Publishing library...');

    const libraryName = figma.root.name;
    if (!libraryName) {
        notify('❌ File must be saved to publish as a library');
        return;
    }
    console.log(`📚 "${libraryName}"`);

    const startTime = Date.now();

    // Custom French locale number formatter (Figma doesn't support Intl)
    const fmt = (num: number): string => {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    };

    // Helper to convert RGB to Hex
    const rgbToHex = (c: RGB): string => {
        const toHex = (n: number) => {
            const hex = Math.round(n * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        return `${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`;
    };

    // Collect Styles (file-level, available from all pages)
    const paintStyles = await figma.getLocalPaintStylesAsync();
    const textStyles = await figma.getLocalTextStylesAsync();
    const effectStyles = await figma.getLocalEffectStylesAsync();

    // Collect Variables
    const variables = await figma.variables.getLocalVariablesAsync();

    const items: LibraryItem[] = [];

    paintStyles.forEach(s => {
        let colorHex: string | undefined;
        // Extract color from the first paint that has a color
        for (const paint of s.paints) {
            if (paint.type === 'SOLID' && paint.visible !== false) {
                colorHex = rgbToHex(paint.color);
                break;
            } else if ((paint.type === 'GRADIENT_LINEAR' || paint.type === 'GRADIENT_RADIAL' || paint.type === 'GRADIENT_ANGULAR' || paint.type === 'GRADIENT_DIAMOND') && paint.visible !== false) {
                if (paint.gradientStops && paint.gradientStops.length > 0) {
                    colorHex = rgbToHex(paint.gradientStops[0].color);
                    break;
                }
            }
        }
        items.push([s.name, s.key, 'PAINT', colorHex]);
    });

    textStyles.forEach(s => items.push([s.name, s.key, 'TEXT']));
    effectStyles.forEach(s => items.push([s.name, s.key, 'EFFECT']));

    // Process Variables
    for (const v of variables) {
        // Only index supported types
        if (v.resolvedType === 'COLOR' || v.resolvedType === 'FLOAT' || v.resolvedType === 'STRING' || v.resolvedType === 'BOOLEAN') {
            let colorHex: string | undefined;

            if (v.resolvedType === 'COLOR') {
                const modeId = Object.keys(v.valuesByMode)[0];
                if (modeId) {
                    let value = v.valuesByMode[modeId];

                    // Resolve VARIABLE_ALIAS
                    let attempts = 0;
                    while (value && typeof value === 'object' && 'type' in value && (value as { type: string }).type === 'VARIABLE_ALIAS' && attempts < 10) {
                        attempts++;
                        const aliasId = (value as { id: string }).id;

                        try {
                            const aliasedVar = await figma.variables.getVariableByIdAsync(aliasId);
                            if (aliasedVar) {
                                if (aliasedVar.resolvedType === 'COLOR') {
                                    const aliasedModeId = Object.keys(aliasedVar.valuesByMode)[0];

                                    if (aliasedModeId) {
                                        value = aliasedVar.valuesByMode[aliasedModeId];
                                    } else {
                                        console.warn(`No modes found for aliased var ${aliasedVar.name}`);
                                        break;
                                    }
                                } else {
                                    console.warn(`Aliased var ${aliasedVar.name} is not COLOR`);
                                    break;
                                }
                            } else {
                                console.warn(`Aliased var not found: ${aliasId}`);
                                break;
                            }
                        } catch (e) {
                            console.error(`Error resolving alias:`, e);
                            break;
                        }
                    }

                    if (value && typeof value === 'object' && 'r' in value && 'g' in value && 'b' in value) {
                        colorHex = rgbToHex(value as RGB);
                    }
                }
            }

            // Use key for variables so they can be imported later if needed (though we mostly use them by ID if local, or key if library)
            // Ideally we store key, but getLocalVariablesAsync returns objects with .key? No, .id and .key (if remote).
            // Local variables have .key too.

            // Map resolvedType to LibraryItemType
            let itemType: LibraryItemType;
            switch (v.resolvedType) {
                case 'COLOR': itemType = 'VARIABLE_COLOR'; break;
                case 'FLOAT': itemType = 'VARIABLE_FLOAT'; break;
                case 'STRING': itemType = 'VARIABLE_STRING'; break;
                case 'BOOLEAN': itemType = 'VARIABLE_BOOLEAN'; break;
                default: itemType = 'VARIABLE_COLOR'; // Should not happen due to if check above
            }

            items.push([v.name, v.key, itemType, colorHex]);
        }
    }

    console.log(`✅ ${fmt(items.length)} items (styles + variables)`);

    // Collect Components from ALL pages
    await figma.loadAllPagesAsync();
    const pages = figma.root.children;
    console.log(`🔍 Scanning ${fmt(pages.length)} pages...\n`);

    notify(`🔍 Scanning ${pages.length} pages... (see console F12)`, { timeout: Infinity });

    let totalComponentsFound = 0;
    let totalNodesScanned = 0;

    for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const pageNum = i + 1;

        console.log(`📄 ${pageNum}/${pages.length}: "${page.name}"`);
        notify(`📄 ${pageNum}/${pages.length}: "${page.name}"`, { timeout: Infinity });

        let pageNodesScanned = 0;
        const pageStartTime = Date.now();

        const components = page.findAll((node) => {
            pageNodesScanned++;
            totalNodesScanned++;

            // Log every 5000 nodes to show progress
            if (pageNodesScanned % 5000 === 0) {
                console.log(`   ${fmt(pageNodesScanned)} nodes...`);
            }

            return node.type === 'COMPONENT' || node.type === 'COMPONENT_SET';
        }) as (ComponentNode | ComponentSetNode)[];

        const pageDuration = ((Date.now() - pageStartTime) / 1000).toString().replace('.', ',');
        console.log(`   ✅ ${fmt(components.length)} components, ${fmt(pageNodesScanned)} nodes (${pageDuration}s)\n`);

        // Add components to items
        components.forEach(c => {
            if (c.type === 'COMPONENT_SET') {
                // Store the key of the DEFAULT VARIANT, not the set itself.
                // This ensures importComponentByKeyAsync retrieves a ComponentNode, avoiding 404s with Sets.
                items.push([c.name, c.defaultVariant.key, 'COMPONENT']);
                totalComponentsFound++;
            } else if (c.type === 'COMPONENT') {
                // Only add components that are NOT part of a component set (variants)
                if (c.parent?.type !== 'COMPONENT_SET') {
                    items.push([c.name, c.key, 'COMPONENT']);
                    totalComponentsFound++;
                }
            }
        });
    }

    console.log(`\n📦 ${fmt(totalComponentsFound)} components from ${fmt(totalNodesScanned)} nodes`);

    if (items.length === 0) {
        notify('⚠️ No styles or components found to publish');
        return;
    }

    // Save to Storage
    const libraries = await getStoredLibraries();
    libraries[libraryName] = items;
    await saveLibraries(libraries);

    // Auto-enable the library
    const active = await getActiveLibraries();
    if (active.indexOf(libraryName) === -1) {
        active.push(libraryName);
        await setActiveLibraries(active);
    }

    const totalDuration = ((Date.now() - startTime) / 1000).toString().replace('.', ',');

    console.log(`\n✅ Published ${fmt(items.length)} items (${totalDuration}s)`);
    console.log(`   ${fmt(paintStyles.length)} paint, ${fmt(textStyles.length)} text, ${fmt(effectStyles.length)} effect, ${fmt(totalComponentsFound)} components`);

    notify(`✅ Published "${libraryName}" with ${fmt(items.length)} items in ${totalDuration}s`);
}

// Helper function to get library suggestions with checkboxes
export async function getLibrarySuggestions(): Promise<string[]> {
    const libraries = await getStoredLibraries();
    const libraryNames = Object.keys(libraries);

    if (libraryNames.length === 0) {
        return [];
    }

    const active = await getActiveLibraries();

    // Format: "☑ LibraryName (ItemCount items)" or "☐ LibraryName (ItemCount items)"
    return libraryNames.map(name => {
        const isActive = active.indexOf(name) >= 0;
        const checkbox = isActive ? '☑' : '☐';
        const itemCount = libraries[name].length;
        return `${checkbox} ${name} (${itemCount} items)`;
    });
}

// Search function for library names (used by binding system)
export async function searchLibraries(searchTerm: string): Promise<string[]> {
    const libraries = await getStoredLibraries();
    const libraryNames = Object.keys(libraries);

    if (libraryNames.length === 0) {
        return [];
    }

    const active = await getActiveLibraries();
    const searchLower = searchTerm.toLowerCase();

    // Filter and format libraries based on search term
    const filtered = libraryNames
        .filter(name => name.toLowerCase().indexOf(searchLower) >= 0)
        .map(name => {
            const isActive = active.indexOf(name) >= 0;
            const checkbox = isActive ? '☑' : '☐';
            const itemCount = libraries[name].length;
            return `${checkbox} ${name} (${itemCount} items)`;
        });

    return filtered.slice(0, 20); // Limit to 20 results
}

export async function toggleLibrary() {
    const libraries = await getStoredLibraries();
    const libraryNames = Object.keys(libraries);

    if (libraryNames.length === 0) {
        notify('⚠️ No libraries found in storage');
        return;
    }

    const active = await getActiveLibraries();

    notify(`ℹ️ Active Libraries: ${active.join(', ')} (Total Available: ${libraryNames.length})`);
}

// We need a version that takes a parameter for the actual action
export async function toggleLibraryByName(nameOrFormatted: string) {
    // Parse library name from formatted string: "☑ Twenty (216 items)" -> "Twenty"
    // or handle plain name: "Twenty"
    let name = nameOrFormatted;
    const formattedMatch = nameOrFormatted.match(/^[☑☐]\s+(.+?)\s+\(\d+\s+items\)$/);
    if (formattedMatch) {
        name = formattedMatch[1];
    }

    const libraries = await getStoredLibraries();
    if (!libraries[name]) {
        notify(`❌ Library "${name}" not found`);
        return;
    }

    const active = await getActiveLibraries();
    const index = active.indexOf(name);

    if (index >= 0) {
        active.splice(index, 1);
        notify(`Checking off "${name}"... 🔕`);
    } else {
        active.push(name);
        notify(`Checking on "${name}"... 🔔`);
    }

    await setActiveLibraries(active);
}

export async function removeLibrary() {
    const libraries = await getStoredLibraries();
    const libraryNames = Object.keys(libraries);

    if (libraryNames.length === 0) {
        notify('⚠️ No libraries found in storage');
        return;
    }

    const active = await getActiveLibraries();
    const suggestions = libraryNames.map(name => {
        const isActive = active.indexOf(name) >= 0;
        const checkbox = isActive ? '☑' : '☐';
        const itemCount = libraries[name].length;
        return `${checkbox} ${name} (${itemCount} items)`;
    });

    notify(`🗑️ Libraries:\n${suggestions.join('\n')}\n\nUse: rlib? to search and delete`);
}

export async function removeLibraryByName(nameOrFormatted: string) {
    // Parse library name from formatted string: "☑ Twenty (216 items)" -> "Twenty"
    // or handle plain name: "Twenty"
    let name = nameOrFormatted;
    const formattedMatch = nameOrFormatted.match(/^[☑☐]\s+(.+?)\s+\(\d+\s+items\)$/);
    if (formattedMatch) {
        name = formattedMatch[1];
    }

    const libraries = await getStoredLibraries();
    if (!libraries[name]) {
        notify(`❌ Library "${name}" not found`);
        return;
    }

    delete libraries[name];
    await saveLibraries(libraries);

    const active = await getActiveLibraries();
    const newActive = active.filter(lib => lib !== name);
    if (newActive.length !== active.length) {
        await setActiveLibraries(newActive);
    }
    notify(`🗑️ Removed library "${name}"`);
}

export async function monitorStorage() {
    const libraries = await getStoredLibraries();
    const active = await getActiveLibraries();

    // const json = JSON.stringify(libraries);
    // Approximation: 1 char = 1 byte (for ASCII) or 2 bytes (UTF-16). 
    // clientStorage limit is usually about string length.
    // Let's just use string length as a proxy for "usage".
    const compressed = await figma.clientStorage.getAsync(STORAGE_KEY);
    const compressedLength = compressed ? compressed.length : 0;

    // 5MB limit roughly 5,000,000 characters if we consider 1 char = 1 unit of storage cost
    // (though strictly it's bytes, but JS strings are UTF-16).
    const limit = 5 * 1024 * 1024;

    const usagePercent = (compressedLength / limit) * 100;

    const libraryCount = Object.keys(libraries).length;
    const totalItems = Object.keys(libraries).reduce((acc: number, key: string) => acc + libraries[key].length, 0);

    notify(
        `📊 Storage: ${libraryCount} libs, ${totalItems} items. ` +
        `Size: ${(compressedLength / 1024).toFixed(2)}KB ` +
        `(${usagePercent.toFixed(1)}% of ~5MB). ` +
        `Active: ${active.length}`
    );
}

export async function applyLibraryStyle(value: string, type: LibraryItemType) {
    // value format: "StyleName (LibraryName)"
    const match = value.match(/^(.+?)\s+\((.+?)\)$/);
    if (!match) {
        notify('❌ Invalid style format');
        return;
    }

    const styleName = match[1];
    const libraryName = match[2];

    const libraries = await getStoredLibraries();
    const libraryItems = libraries[libraryName];

    if (!libraryItems) {
        notify(`❌ Library "${libraryName}" not found`);
        return;
    }

    const item = libraryItems.find(i => i[0] === styleName && i[2] === type);
    if (!item) {
        notify(`❌ Style "${styleName}" not found in "${libraryName}"`);
        return;
    }

    const key = item[1];
    const selection = figma.currentPage.selection;

    if (selection.length === 0) {
        notify('⚠️ Select a layer first');
        return;
    }

    try {
        const style = await figma.importStyleByKeyAsync(key);

        for (const node of selection) {
            if (type === 'TEXT' && node.type === 'TEXT') {
                await node.setTextStyleIdAsync(style.id);
            } else if (type === 'PAINT' && 'fillStyleId' in node) {
                await node.setFillStyleIdAsync(style.id);
            } else if (type === 'EFFECT' && 'effectStyleId' in node) {
                await node.setEffectStyleIdAsync(style.id);
            }
        }

        notify(`✅ Applied "${styleName}"`);
    } catch (e) {
        console.error(e);
        notify(`❌ Failed to apply style: ${e}`);
    }
}
