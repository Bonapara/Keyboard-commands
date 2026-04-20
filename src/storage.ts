import * as LZString from 'lz-string';
import { LibraryData } from './types';

export const STORAGE_KEY = 'KB_COMMANDS_LIBRARY_DATA';
const ACTIVE_LIBRARIES_KEY = 'KB_COMMANDS_ACTIVE_LIBRARIES';

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

export async function saveLibraries(data: LibraryData): Promise<void> {
    cachedLibraries = data;
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

export async function setActiveLibraries(active: string[]): Promise<void> {
    cachedActiveLibraries = active;
    await figma.clientStorage.setAsync(ACTIVE_LIBRARIES_KEY, active);
}
