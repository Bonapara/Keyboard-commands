export const SELECTION_HISTORY_KEY = 'KB_COMMANDS_SELECTION_HISTORY';

const MAX_SELECTION_HISTORY = 10;
const SNAPSHOT_SEPARATOR = '\x1f';

type SelectionSnapshot = string[];

let cached: SelectionSnapshot[] | null = null;

function dedupeIds(ids: readonly string[]): SelectionSnapshot {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }

  return unique;
}

function normalizeSelection(selection: readonly SceneNode[]): SelectionSnapshot {
  return dedupeIds(selection.map(node => node.id));
}

function normalizeStoredHistory(stored: unknown): SelectionSnapshot[] {
  if (!Array.isArray(stored)) return [];

  return stored
    .filter((snapshot): snapshot is unknown[] => Array.isArray(snapshot))
    .map(snapshot => dedupeIds(snapshot.filter((id): id is string => typeof id === 'string')))
    .filter(snapshot => snapshot.length > 0)
    .slice(0, MAX_SELECTION_HISTORY);
}

function snapshotKey(snapshot: readonly string[]): string {
  return snapshot.join(SNAPSHOT_SEPARATOR);
}

function snapshotsMatch(a: readonly string[], b: readonly string[]): boolean {
  return snapshotKey(a) === snapshotKey(b);
}

async function load(): Promise<SelectionSnapshot[]> {
  if (cached) return cached;
  const stored = await figma.clientStorage.getAsync(SELECTION_HISTORY_KEY);
  cached = normalizeStoredHistory(stored);
  return cached;
}

async function save(history: readonly SelectionSnapshot[]): Promise<void> {
  cached = history.slice(0, MAX_SELECTION_HISTORY).map(snapshot => [...snapshot]);
  await figma.clientStorage.setAsync(SELECTION_HISTORY_KEY, cached);
}

function isSceneNode(node: BaseNode | null): node is SceneNode {
  return !!node && node.type !== 'PAGE' && node.type !== 'DOCUMENT';
}

function isOnCurrentPage(node: SceneNode): boolean {
  const currentPageId = figma.currentPage.id;
  if (!currentPageId) return true;

  let current: BaseNode | null = node;
  while (current) {
    if (current.type === 'PAGE') {
      return current.id === currentPageId;
    }
    current = current.parent;
  }

  return false;
}

async function resolveSelectionSnapshot(snapshot: readonly string[]): Promise<SceneNode[]> {
  const nodes: SceneNode[] = [];

  for (const id of snapshot) {
    const node = await figma.getNodeByIdAsync(id);
    if (isSceneNode(node) && isOnCurrentPage(node)) {
      nodes.push(node);
    }
  }

  return nodes;
}

export async function getSelectionHistory(): Promise<SelectionSnapshot[]> {
  return await load();
}

export async function recordSelectionSnapshot(
  selection: readonly SceneNode[] = figma.currentPage.selection
): Promise<void> {
  const snapshot = normalizeSelection(selection);
  if (snapshot.length === 0) return;

  const history = await load();
  const filtered = history.filter(existing => !snapshotsMatch(existing, snapshot));
  await save([snapshot, ...filtered]);
}

export async function restorePreviousSelection(
  currentSelection: readonly SceneNode[] = figma.currentPage.selection
): Promise<SceneNode[]> {
  const currentSnapshot = normalizeSelection(currentSelection);
  const history = await load();
  const cleanedHistory: SelectionSnapshot[] = [];
  let restoredSelection: SceneNode[] | null = null;

  for (const snapshot of history) {
    if (currentSnapshot.length > 0 && snapshotsMatch(snapshot, currentSnapshot)) {
      cleanedHistory.push(snapshot);
      continue;
    }

    if (!restoredSelection) {
      const resolved = await resolveSelectionSnapshot(snapshot);
      if (resolved.length === 0) continue;

      cleanedHistory.push(normalizeSelection(resolved));
      restoredSelection = resolved;
      continue;
    }

    cleanedHistory.push(snapshot);
  }

  if (cleanedHistory.length !== history.length) {
    await save(cleanedHistory);
  }

  if (!restoredSelection) return [];

  figma.currentPage.selection = restoredSelection;
  return restoredSelection;
}
