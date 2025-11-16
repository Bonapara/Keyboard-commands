// ================================
// Theme Functions
// ================================

export async function toggleTheme() {
  const selection = figma.currentPage.selection;
  if (!selection.length) return;
  
  async function findThemeCollection() {
    const localCollections = await figma.variables.getLocalVariableCollectionsAsync();
    const themeCollection = localCollections.find(c =>
      c.name.toLowerCase().includes("theme") || c.name.toLowerCase().includes("appearance")
    );
    if (themeCollection) return themeCollection;
    
    const libraryCollections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
    const libraryTheme = libraryCollections.find(c =>
      c.name.toLowerCase().includes("theme") || c.name.toLowerCase().includes("appearance")
    );
    if (!libraryTheme) return;
    
    const libraryVars = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(libraryTheme.key);
    if (!libraryVars.length) return;
    
    const importedVar = await figma.variables.importVariableByKeyAsync(libraryVars[0].key);
    return figma.variables.getVariableCollectionByIdAsync(importedVar.variableCollectionId);
  }
  
  const themeCollection = await findThemeCollection();
  if (!themeCollection) return;
  
  const lightMode = themeCollection.modes.find(m => /light|day/i.test(m.name));
  const darkMode = themeCollection.modes.find(m => /dark|night/i.test(m.name));
  if (!lightMode || !darkMode) return;
  
  for (const node of selection) {
    const currentModeId = node.resolvedVariableModes[themeCollection.id];
    if (node.boundVariables && themeCollection.id in node.resolvedVariableModes) {
      if (currentModeId === lightMode.modeId) {
        node.setExplicitVariableModeForCollection(themeCollection, darkMode.modeId);
      } else if (currentModeId === darkMode.modeId) {
        node.clearExplicitVariableModeForCollection(themeCollection);
      }
    } else {
      if (themeCollection.defaultModeId === lightMode.modeId) {
        node.setExplicitVariableModeForCollection(themeCollection, darkMode.modeId);
      } else if (themeCollection.defaultModeId === darkMode.modeId) {
        node.setExplicitVariableModeForCollection(themeCollection, lightMode.modeId);
      }
    }
  }
}

