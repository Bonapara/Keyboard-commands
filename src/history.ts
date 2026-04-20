const HISTORY_KEY = 'KB_COMMANDS_HISTORY';
const MAX_HISTORY = 10;

let cached: string[] | null = null;

async function load(): Promise<string[]> {
  if (cached) return cached;
  const stored = await figma.clientStorage.getAsync(HISTORY_KEY);
  cached = Array.isArray(stored) ? stored as string[] : [];
  return cached;
}

export async function getHistory(): Promise<string[]> {
  return await load();
}

export async function recordHistory(
  sequence: string,
  getDedupKey: (s: string) => string = (s) => s.trim(),
): Promise<void> {
  const trimmed = sequence.trim();
  if (!trimmed) return;

  const all = await load();
  const newKey = getDedupKey(trimmed);
  const filtered = all.filter(v => getDedupKey(v) !== newKey);
  filtered.unshift(trimmed);
  cached = filtered.slice(0, MAX_HISTORY);
  await figma.clientStorage.setAsync(HISTORY_KEY, cached);
}
