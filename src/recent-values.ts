const RECENT_KEY = 'KB_COMMANDS_RECENT_VALUES';
const MAX_PER_COMMAND = 5;

type RecentMap = Record<string, string[]>;

let cached: RecentMap | null = null;

async function load(): Promise<RecentMap> {
  if (cached) return cached;
  const stored = await figma.clientStorage.getAsync(RECENT_KEY);
  cached = (stored && typeof stored === 'object') ? stored as RecentMap : {};
  return cached;
}

export async function getRecentValues(alias: string): Promise<string[]> {
  const all = await load();
  return all[alias] || [];
}

export async function recordRecentValue(alias: string, value: string): Promise<void> {
  const trimmed = value.trim();
  if (!trimmed) return;

  const all = await load();
  const existing = all[alias] || [];
  const filtered = existing.filter(v => v !== trimmed);
  filtered.unshift(trimmed);
  all[alias] = filtered.slice(0, MAX_PER_COMMAND);
  cached = all;
  await figma.clientStorage.setAsync(RECENT_KEY, all);
}
