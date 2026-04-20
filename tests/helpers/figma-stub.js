export function createFigmaStub({
  selection = [],
  storageSeed = {},
  rootName = 'Test Library',
  localPaintStyles = [],
  localTextStyles = [],
  localEffectStyles = [],
  localGridStyles = [],
  localVariables = [],
  localVariableCollections = [],
  importedVariablesByKey = {},
} = {}) {
  const storage = new Map(Object.entries(storageSeed));
  const notifications = [];
  const variablesById = new Map(localVariables.map((variable) => [variable.id, variable]));
  const importedByKey = new Map(Object.entries(importedVariablesByKey));

  const figma = {
    mixed: Symbol('figma.mixed'),
    currentPage: { selection },
    root: {
      name: rootName,
      children: [],
      findOne() {
        return null;
      },
    },
    parameters: {
      on() {},
      off() {},
    },
    clientStorage: {
      async getAsync(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      async setAsync(key, value) {
        storage.set(key, value);
      },
    },
    teamLibrary: {
      async getAvailableLibraryVariableCollectionsAsync() {
        return [];
      },
      async getVariablesInLibraryCollectionAsync() {
        return [];
      },
    },
    variables: {
      async getVariableByIdAsync(id) {
        return variablesById.get(id) ?? null;
      },
      async importVariableByKeyAsync(key) {
        const imported = importedByKey.get(key) ?? null;
        if (imported) {
          variablesById.set(imported.id, imported);
        }
        return imported;
      },
      async getLocalVariablesAsync() {
        return localVariables;
      },
      async getLocalVariableCollectionsAsync() {
        return localVariableCollections;
      },
      async getVariableCollectionByIdAsync() {
        return null;
      },
      setBoundVariableForPaint(paint) {
        return paint;
      },
    },
    async getLocalPaintStylesAsync() {
      return localPaintStyles;
    },
    async getLocalTextStylesAsync() {
      return localTextStyles;
    },
    async getLocalEffectStylesAsync() {
      return localEffectStyles;
    },
    async getLocalGridStylesAsync() {
      return localGridStyles;
    },
    async loadFontAsync() {},
    notify(message, options) {
      notifications.push({ message, options });
      return { cancel() {} };
    },
    on() {},
    closePlugin() {},
  };

  return { figma, storage, notifications };
}
