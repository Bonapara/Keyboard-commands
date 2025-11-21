import * as LZString from 'lz-string';
import { notify } from '../utils';

// ==================================
// Types & Constants
// ==================================

export type LibraryItemType = 'PAINT' | 'TEXT' | 'EFFECT' | 'COMPONENT';

// [Name, Key, Type]
export type LibraryItem = [string, string, LibraryItemType];

// Map<LibraryName, LibraryItem[]>
export type LibraryData = Record<string, LibraryItem[]>;

const STORAGE_KEY = 'KB_COMMANDS_LIBRARY_DATA';
const ACTIVE_LIBRARIES_KEY = 'KB_COMMANDS_ACTIVE_LIBRARIES';

// ==================================
// Storage Helpers
// ==================================

async function getStoredLibraries(): Promise<LibraryData> {
    const compressed = await figma.clientStorage.getAsync(STORAGE_KEY);
    if (!compressed) return {};

    try {
        const decompressed = LZString.decompressFromUTF16(compressed);
        return decompressed ? JSON.parse(decompressed) : {};
    } catch (e) {
        console.error('Failed to decompress library data', e);
        return {};
    }
}

async function saveLibraries(data: LibraryData): Promise<void> {
    const stringified = JSON.stringify(data);
    const compressed = LZString.compressToUTF16(stringified);
    await figma.clientStorage.setAsync(STORAGE_KEY, compressed);
}

async function getActiveLibraries(): Promise<string[]> {
    const active = await figma.clientStorage.getAsync(ACTIVE_LIBRARIES_KEY);
    return active || [];
}

async function setActiveLibraries(active: string[]): Promise<void> {
    await figma.clientStorage.setAsync(ACTIVE_LIBRARIES_KEY, active);
}

// ==================================
// Core Functions
// ==================================

export async function publishLibrary() {
    console.clear();
    console.log('🚀 [PublishLibrary] Starting...');

    const libraryName = figma.root.name;
    if (!libraryName) {
        notify('❌ File must be saved to publish as a library');
        return;
    }
    console.log(`📚 Library name: "${libraryName}"`);

    const startTime = Date.now();

    // Custom French locale number formatter (Figma doesn't support Intl)
    const fmt = (num: number): string => {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    };

    // 1. Collect Styles (file-level, available from all pages)
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 FETCHING STYLES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    console.log('⏳ Fetching paint styles...');
    const paintStyles = await figma.getLocalPaintStylesAsync();
    console.log(`✅ Paint styles: ${fmt(paintStyles.length)}`);

    console.log('⏳ Fetching text styles...');
    const textStyles = await figma.getLocalTextStylesAsync();
    console.log(`✅ Text styles: ${fmt(textStyles.length)}`);

    console.log('⏳ Fetching effect styles...');
    const effectStyles = await figma.getLocalEffectStylesAsync();
    console.log(`✅ Effect styles: ${fmt(effectStyles.length)}`);

    const items: LibraryItem[] = [];

    console.log('\n⏳ Processing styles...');
    paintStyles.forEach(s => items.push([s.name, s.key, 'PAINT']));
    textStyles.forEach(s => items.push([s.name, s.key, 'TEXT']));
    effectStyles.forEach(s => items.push([s.name, s.key, 'EFFECT']));
    console.log(`✅ Processed ${fmt(items.length)} styles total`);

    // 2. Collect Components from ALL pages
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 SCANNING COMPONENTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    console.log('⏳ Loading all pages...');
    await figma.loadAllPagesAsync();
    const pages = figma.root.children;
    console.log(`✅ Loaded ${fmt(pages.length)} pages\n`);

    // Show notification about scanning (console has details)
    notify(`🔍 Scanning ${pages.length} pages... (check console F12 for progress)`, { timeout: Infinity });

    let totalComponentsFound = 0;
    let totalNodesScanned = 0;

    for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const pageNum = i + 1;

        console.log(`📄 Page ${pageNum}/${pages.length}: "${page.name}"`);
        console.log(`   ⏳ Scanning for components...`);

        // Update notification for current page
        notify(`📄 Scanning page ${pageNum}/${pages.length}: "${page.name}"...`, { timeout: Infinity });

        let pageNodesScanned = 0;
        const pageStartTime = Date.now();

        const components = page.findAll((node) => {
            pageNodesScanned++;
            totalNodesScanned++;

            // Log every 1000 nodes to show progress without overwhelming console
            if (pageNodesScanned % 1000 === 0) {
                console.log(`   [Scanned: ${fmt(pageNodesScanned)} nodes...]`);
            }

            return node.type === 'COMPONENT' || node.type === 'COMPONENT_SET';
        }) as (ComponentNode | ComponentSetNode)[];

        const pageDuration = ((Date.now() - pageStartTime) / 1000).toString().replace('.', ',');

        console.log(`   ✅ Found ${fmt(components.length)} components in ${pageDuration}s`);
        console.log(`   📊 Scanned ${fmt(pageNodesScanned)} nodes total\n`);

        // Add components to items
        components.forEach(c => {
            if (c.type === 'COMPONENT_SET' || c.type === 'COMPONENT') {
                items.push([c.name, c.key, 'COMPONENT']);
                totalComponentsFound++;
            }
        });
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 COMPONENT SCAN SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🔍  Total nodes scanned  : ${fmt(totalNodesScanned)}`);
    console.log(`📦  Components collected : ${fmt(totalComponentsFound)}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (items.length === 0) {
        notify('⚠️ No styles or components found to publish');
        return;
    }

    // 3. Save to Storage
    console.log('💾 Saving to storage...');
    const libraries = await getStoredLibraries();
    libraries[libraryName] = items;
    await saveLibraries(libraries);
    console.log('✅ Saved to storage');

    // Auto-enable the library
    console.log('⏳ Updating active libraries...');
    const active = await getActiveLibraries();
    if (active.indexOf(libraryName) === -1) {
        active.push(libraryName);
        await setActiveLibraries(active);
    }
    console.log('✅ Library activated');

    const totalDuration = ((Date.now() - startTime) / 1000).toString().replace('.', ',');

    console.log('\n🏁 OPERATION COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`⏱️  Total time    : ${totalDuration} s`);
    console.log(`📚  Library name  : "${libraryName}"`);
    console.log(`📦  Total items   : ${fmt(items.length)}`);
    console.log(`   - Paint styles : ${fmt(paintStyles.length)}`);
    console.log(`   - Text styles  : ${fmt(textStyles.length)}`);
    console.log(`   - Effect styles: ${fmt(effectStyles.length)}`);
    console.log(`   - Components   : ${fmt(totalComponentsFound)}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

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

    const json = JSON.stringify(libraries);
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
