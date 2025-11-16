export async function toggleTheme() {
  const selection = figma.currentPage.selection;
  if (!selection.length) return;
  
  // Find theme collections from local and library sources
  const collections: VariableCollection[] = [];
  const localCollections = await figma.variables.getLocalVariableCollectionsAsync();
  
  for (const collection of localCollections) {
    const name = collection.name.toLowerCase();
    if (name.includes("theme") || name.includes("appearance") || name.includes("palette")) {
      collections.push(collection);
    }
  }
  
  const libraryCollections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
  for (const libCollection of libraryCollections) {
    const name = libCollection.name.toLowerCase();
    if (name.includes("theme") || name.includes("appearance") || name.includes("palette")) {
      const libraryVars = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(libCollection.key);
      if (libraryVars.length) {
        const importedVar = await figma.variables.importVariableByKeyAsync(libraryVars[0].key);
        const collection = await figma.variables.getVariableCollectionByIdAsync(importedVar.variableCollectionId);
        if (collection) collections.push(collection);
      }
    }
  }
  
  if (!collections.length) return;
  
  // Filter collections that have both light and dark modes
  const collectionModes = collections.map(collection => {
    const lightMode = collection.modes.find(m => /light/i.test(m.name) && !/auto/i.test(m.name));
    const darkMode = collection.modes.find(m => /dark/i.test(m.name) && !/auto/i.test(m.name));
    return { collection, lightMode, darkMode };
  }).filter(cm => cm.lightMode && cm.darkMode);
  
  if (!collectionModes.length) return;
  
  // Toggle each node
  for (const node of selection) {
    const toggleActions: Array<{ collection: VariableCollection, modeId: string | null }> = [];
    
    for (const { collection, lightMode, darkMode } of collectionModes) {
      const collectionId = collection.id;
      if (!(collectionId in node.resolvedVariableModes)) continue;
      
      const currentModeId = node.resolvedVariableModes[collectionId];
      const isExplicit = collectionId in node.explicitVariableModes;
      
      // Determine what Auto would resolve to (parent mode or collection default)
      let autoResolvesTo = collection.defaultModeId;
      if ('parent' in node && node.parent && 'resolvedVariableModes' in node.parent) {
        const parentModes = (node.parent as BaseNode & { resolvedVariableModes: Record<string, string> }).resolvedVariableModes;
        if (collectionId in parentModes) autoResolvesTo = parentModes[collectionId];
      }
      
      let targetModeId: string | null;
      
      if (isExplicit) {
        // If explicit Light/Dark and Auto would give opposite, prefer Auto
        const isLight = currentModeId === lightMode!.modeId;
        const oppositeMode = isLight ? darkMode!.modeId : lightMode!.modeId;
        targetModeId = autoResolvesTo === oppositeMode ? null : oppositeMode;
      } else {
        // If Auto, set explicit to opposite of current resolved mode
        targetModeId = currentModeId === lightMode!.modeId ? darkMode!.modeId : lightMode!.modeId;
      }
      
      toggleActions.push({ collection, modeId: targetModeId });
    }
    
    // Apply all toggles
    for (const { collection, modeId } of toggleActions) {
      if (modeId === null) {
        node.clearExplicitVariableModeForCollection(collection);
      } else {
        node.setExplicitVariableModeForCollection(collection, modeId);
      }
    }
  }
}

