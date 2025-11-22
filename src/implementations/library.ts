import * as LZString from 'lz-string';
import { notify } from '../utils';
import { LibraryItem, LibraryItemType } from '../types';

// ==================================
// Types & Constants
// ==================================

// Map<LibraryName, LibraryItem[]>
export type LibraryData = Record<string, LibraryItem[]>;

const STORAGE_KEY = 'KB_COMMANDS_LIBRARY_DATA';
const ACTIVE_LIBRARIES_KEY = 'KB_COMMANDS_ACTIVE_LIBRARIES';

// ==================================
// Storage Helpers
// ==================================

let cachedLibraries: LibraryData | null = null;
let cachedActiveLibraries: string[] | null = null;

export async function getStoredLibraries(): Promise<LibraryData> {
    if (cachedLibraries) return cachedLibraries;

    const compressed = await figma.clientStorage.getAsync(STORAGE_KEY);
    if (!compressed) {
        cachedLibraries = {};
        return {};
    }

    try {
        const decompressed = LZString.decompressFromUTF16(compressed);
        cachedLibraries = decompressed ? JSON.parse(decompressed) : {};
        return cachedLibraries!;
    } catch (e) {
        console.error('Failed to decompress library data', e);
        cachedLibraries = {};
        return {};
    }
}

async function saveLibraries(data: LibraryData): Promise<void> {
    cachedLibraries = data; // Update cache
    const stringified = JSON.stringify(data);
    const compressed = LZString.compressToUTF16(stringified);
    await figma.clientStorage.setAsync(STORAGE_KEY, compressed);
}

export async function getActiveLibraries(): Promise<string[]> {
    if (cachedActiveLibraries) return cachedActiveLibraries;

    const active = await figma.clientStorage.getAsync(ACTIVE_LIBRARIES_KEY);
    cachedActiveLibraries = active || [];
    return cachedActiveLibraries!;
}

async function setActiveLibraries(active: string[]): Promise<void> {
    cachedActiveLibraries = active; // Update cache
    await figma.clientStorage.setAsync(ACTIVE_LIBRARIES_KEY, active);
}

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

    // Collect Styles (file-level, available from all pages)
    const paintStyles = await figma.getLocalPaintStylesAsync();
    const textStyles = await figma.getLocalTextStylesAsync();
    const effectStyles = await figma.getLocalEffectStylesAsync();

    const items: LibraryItem[] = [];

    paintStyles.forEach(s => items.push([s.name, s.key, 'PAINT']));
    textStyles.forEach(s => items.push([s.name, s.key, 'TEXT']));
    effectStyles.forEach(s => items.push([s.name, s.key, 'EFFECT']));
    console.log(`✅ ${fmt(items.length)} styles`);

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
