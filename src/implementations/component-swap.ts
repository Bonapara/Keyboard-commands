// Instance swap (`is`) and the component values of instance-swap properties
// (`ip Icon:…`): one scored pool of candidates, rows that carry the
// component key, and a swap that picks the closest existing variant.

import { getStoredLibraries, getActiveLibraries } from './library';
import {
  getCachedMainComponent,
  getComponentPropertyDefinitions,
  findPropertyKey,
  parseVariantName,
  pluralize,
} from './instance-shared';
import { ICONS, applyThumbnails, prepareThumbnail, withThumbnail, type ThumbnailRequest } from './suggestion-icons';

const LOCAL_LIBRARY = 'this file';
const MAX_ROWS = 100;
const COMPONENT_TOKEN_REGEX = /\[\[kc-component=([^\]]*)\]\]/;

type SuggestionRow = { name: string; data: string; icon?: string };

export interface ComponentTarget {
  set: ComponentSetNode | null;
  // The set's default variant, or the standalone component.
  component: ComponentNode;
}

export interface SwapCandidate {
  name: string;
  library: string;
  key: string | null;
  keyIsSet: boolean;
  nodeId: string | null;
  preferredIndex: number;
  // Known for components in this file and ones imported during this run.
  target: ComponentTarget | null;
}

interface ComponentToken {
  n: string;
  l: string;
  k?: string;
  s?: 1;
  id?: string;
}

export interface RankedCandidate {
  candidate: SwapCandidate;
  score: number;
}

// ================================
// Row values
// ================================

function encodeComponentToken(candidate: SwapCandidate): string {
  const token: ComponentToken = { n: candidate.name, l: candidate.library };
  if (candidate.nodeId) token.id = candidate.nodeId;
  if (candidate.key) token.k = candidate.key;
  if (candidate.keyIsSet) token.s = 1;
  return `[[kc-component=${encodeURIComponent(JSON.stringify(token))}]]`;
}

function parseComponentToken(value: string): ComponentToken | null {
  const match = value.match(COMPONENT_TOKEN_REGEX);
  if (!match) return null;

  try {
    const token = JSON.parse(decodeURIComponent(match[1]));
    return token && typeof token.n === 'string' ? token : null;
  } catch {
    return null;
  }
}

// The readable part keeps history and chained bindings legible; the token is
// what execution trusts.
export function formatComponentValue(candidate: SwapCandidate): string {
  return `${candidate.name} (${candidate.library || 'library'}) ${encodeComponentToken(candidate)}`;
}

export function leafName(name: string): string {
  const index = name.lastIndexOf('/');
  return (index === -1 ? name : name.slice(index + 1)).trim();
}

function folderOf(name: string): string {
  const segments = name.split('/').map(segment => segment.trim().toLowerCase()).filter(Boolean);
  return segments.slice(0, -1).join('/');
}

// ================================
// Candidate pool
// ================================

let localCandidates: Promise<SwapCandidate[]> | null = null;
const importedTargets = new Map<string, Promise<ComponentTarget | null>>();

function createCandidate(fields: Partial<SwapCandidate> & { name: string; library: string }): SwapCandidate {
  return {
    key: null,
    keyIsSet: false,
    nodeId: null,
    preferredIndex: -1,
    target: null,
    ...fields,
  };
}

async function collectLocalCandidates(): Promise<SwapCandidate[]> {
  if (!localCandidates) {
    localCandidates = (async () => {
      await figma.loadAllPagesAsync();
      // eslint-disable-next-line @figma/figma-plugins/dynamic-page-find-method-advice
      const nodes = figma.root.findAllWithCriteria({ types: ['COMPONENT_SET', 'COMPONENT'] });
      const candidates: SwapCandidate[] = [];

      for (const node of nodes) {
        if (node.type === 'COMPONENT_SET') {
          candidates.push(createCandidate({
            name: node.name,
            library: LOCAL_LIBRARY,
            key: node.defaultVariant.key,
            nodeId: node.id,
            target: { set: node, component: node.defaultVariant },
          }));
        } else if (node.type === 'COMPONENT' && node.parent?.type !== 'COMPONENT_SET') {
          candidates.push(createCandidate({
            name: node.name,
            library: LOCAL_LIBRARY,
            key: node.key,
            nodeId: node.id,
            target: { set: null, component: node },
          }));
        }
      }

      return candidates;
    })().catch(error => {
      // Library candidates still work without the local scan.
      console.error('Error scanning local components:', error);
      localCandidates = null;
      return [];
    });
  }

  return await localCandidates;
}

async function collectIndexedCandidates(): Promise<SwapCandidate[]> {
  const [libraries, activeLibraries] = await Promise.all([getStoredLibraries(), getActiveLibraries()]);
  const candidates: SwapCandidate[] = [];

  for (const library of activeLibraries) {
    for (const item of libraries[library] || []) {
      if (item[2] !== 'COMPONENT') continue;
      candidates.push(createCandidate({ name: item[0], library, key: item[1] }));
    }
  }

  return candidates;
}

function importTarget(key: string, keyIsSet: boolean): Promise<ComponentTarget | null> {
  const cacheKey = `${keyIsSet ? 'set' : 'component'}:${key}`;
  let pending = importedTargets.get(cacheKey);

  if (!pending) {
    pending = (async () => {
      try {
        if (keyIsSet) {
          const set = await figma.importComponentSetByKeyAsync(key);
          return { set, component: set.defaultVariant };
        }

        const component = await figma.importComponentByKeyAsync(key);
        const set = component.parent?.type === 'COMPONENT_SET' ? component.parent : null;
        return { set, component };
      } catch {
        return null;
      }
    })();
    importedTargets.set(cacheKey, pending);
  }

  return pending;
}

async function buildCandidatePool(preferredValues: InstanceSwapPreferredValue[]): Promise<SwapCandidate[]> {
  const [locals, indexed] = await Promise.all([
    collectLocalCandidates(),
    collectIndexedCandidates(),
  ]);

  const pool: SwapCandidate[] = [];
  const byKey = new Map<string, SwapCandidate>();
  const byNodeId = new Map<string, SwapCandidate>();
  const bySetKey = new Map<string, SwapCandidate>();

  const add = (candidate: SwapCandidate): SwapCandidate => {
    const existing = (candidate.nodeId && byNodeId.get(candidate.nodeId)) ||
      (candidate.key && byKey.get(candidate.key));
    if (existing) return existing;

    pool.push(candidate);
    if (candidate.nodeId) byNodeId.set(candidate.nodeId, candidate);
    if (candidate.key) byKey.set(candidate.key, candidate);
    if (candidate.target?.set) bySetKey.set(candidate.target.set.key, candidate);
    return candidate;
  };

  // Copies: preferred marks below belong to this search only, while the local
  // scan is cached for the whole run.
  locals.forEach(candidate => add({ ...candidate }));
  indexed.forEach(add);

  // Preferred sets are stored by set key while the lp index stores default
  // variant keys, so unknown ones are imported once per run to map them.
  const resolvedPreferred = await Promise.all(preferredValues.map(async value => {
    const isSet = value.type === 'COMPONENT_SET';
    const known = isSet ? bySetKey.get(value.key) : byKey.get(value.key);
    if (known) return known;

    const target = await importTarget(value.key, isSet);
    if (!target) return null;

    const defaultKey = target.set ? target.set.defaultVariant.key : target.component.key;
    const indexedMatch = defaultKey ? byKey.get(defaultKey) : undefined;
    if (indexedMatch) {
      indexedMatch.target = indexedMatch.target || target;
      return indexedMatch;
    }

    return add(createCandidate({
      name: target.set ? target.set.name : target.component.name,
      library: '',
      key: value.key,
      keyIsSet: isSet,
      target,
    }));
  }));

  resolvedPreferred.forEach((candidate, index) => {
    if (candidate && candidate.preferredIndex === -1) candidate.preferredIndex = index;
  });

  return pool;
}

// ================================
// Ranking
// ================================

function words(value: string): string[] {
  return value.toLowerCase().split(/[\s/_-]+/).filter(Boolean);
}

function isSubsequence(query: string, target: string): boolean {
  let index = 0;
  for (const char of target) {
    if (char === query[index]) index++;
    if (index === query.length) return true;
  }
  return query.length === 0;
}

function editDistance(a: string, b: string): number {
  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i++) rows[i] = [i];
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      }
    }
  }

  return rows[a.length][b.length];
}

// Exact leaf > leaf prefix > every word prefixed in any order > substring >
// abbreviation ("btn") > one typo ("buton"). 0 means no match.
export function scoreComponentName(rawQuery: string, name: string): number {
  const query = rawQuery.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!query) return 1;

  const leaf = leafName(name).toLowerCase();
  if (leaf === query) return 100;
  if (leaf.startsWith(query)) return 90 - (leaf.length - query.length) * 0.1;

  const nameWords = words(name);
  const queryTokens = query.split(' ');
  if (queryTokens.every(token => nameWords.some(word => word.startsWith(token)))) return 75;
  if (name.toLowerCase().includes(query)) return 60;

  const compactQuery = query.replace(/ /g, '');
  const leafWords = words(leaf);
  for (let start = 0; start < leafWords.length; start++) {
    const tail = leafWords.slice(start).join('');
    if (tail[0] === compactQuery[0] && isSubsequence(compactQuery, tail)) {
      return start === 0 ? 45 : 42;
    }
  }

  const hasOneTypo = queryTokens.every(token =>
    token.length >= 4 &&
    nameWords.some(word => editDistance(token, word) <= 1 || editDistance(token, word.slice(0, token.length)) <= 1)
  );
  return hasOneTypo ? 35 : 0;
}

interface RankingContext {
  excluded: Set<string>;
  folder: string;
  library: string | null;
}

function candidateIdentities(candidate: SwapCandidate): string[] {
  return [candidate.nodeId, candidate.key].filter((value): value is string => !!value);
}

export function rankCandidates(pool: SwapCandidate[], query: string, context: RankingContext): RankedCandidate[] {
  const ranked: RankedCandidate[] = [];

  for (const candidate of pool) {
    if (candidateIdentities(candidate).some(identity => context.excluded.has(identity))) continue;

    const base = scoreComponentName(query, candidate.name);
    if (base <= 0) continue;

    let score = base;
    if (candidate.preferredIndex !== -1) score += 12;
    if (context.folder && folderOf(candidate.name) === context.folder) score += 5;
    if (context.library !== null && candidate.library === context.library) score += 2;
    ranked.push({ candidate, score });
  }

  const order = (index: number) => (index === -1 ? Number.MAX_SAFE_INTEGER : index);
  return ranked.sort((a, b) =>
    (b.score - a.score) ||
    (order(a.candidate.preferredIndex) - order(b.candidate.preferredIndex)) ||
    leafName(a.candidate.name).localeCompare(leafName(b.candidate.name))
  );
}

// ================================
// Selection context
// ================================

async function getCurrentVariantValues(instance: InstanceNode): Promise<Record<string, string>> {
  const mainComponent = await getCachedMainComponent(instance);
  if (!mainComponent) return {};

  const definitions = getComponentPropertyDefinitions(mainComponent);
  const values: Record<string, string> = {};
  for (const [key, property] of Object.entries(instance.componentProperties)) {
    if (definitions[key]?.type === 'VARIANT') {
      values[key] = String(property.value);
    }
  }
  return values;
}

async function getComponentIdentities(instance: InstanceNode): Promise<string[]> {
  const mainComponent = await getCachedMainComponent(instance);
  if (!mainComponent) return [];

  const set = mainComponent.parent?.type === 'COMPONENT_SET' ? mainComponent.parent : null;
  return [
    mainComponent.id,
    mainComponent.key,
    set?.id,
    set?.key,
    set?.defaultVariant?.key,
  ].filter((value): value is string => !!value);
}

async function buildRankingContext(instances: InstanceNode[], pool: SwapCandidate[]): Promise<RankingContext> {
  if (instances.length === 0) {
    return { excluded: new Set(), folder: '', library: null };
  }

  // Only hide the current component when every selected instance uses it.
  const identityLists = await Promise.all(instances.map(getComponentIdentities));
  const excluded = new Set(identityLists[0].filter(identity =>
    identityLists.every(list => list.includes(identity))
  ));

  const mainComponent = await getCachedMainComponent(instances[0]);
  const sourceName = mainComponent
    ? (mainComponent.parent?.type === 'COMPONENT_SET' ? mainComponent.parent.name : mainComponent.name)
    : '';
  const current = pool.find(candidate => candidateIdentities(candidate).some(identity => identityLists[0].includes(identity)));

  return {
    excluded,
    folder: folderOf(sourceName),
    library: current ? current.library : null,
  };
}

async function findContainingInstanceSwapProperty(
  instance: InstanceNode,
  propertyReference: string
): Promise<ComponentPropertyDefinitions[string] | null> {
  let current: BaseNode | null = instance.parent;

  while (current) {
    if (current.type === 'COMPONENT' || current.type === 'COMPONENT_SET') {
      const { definition } = findPropertyKey(propertyReference, current.componentPropertyDefinitions);
      if (definition) return definition;
    } else if (current.type === 'INSTANCE') {
      const mainComponent = await getCachedMainComponent(current);
      if (mainComponent) {
        const { definition } = findPropertyKey(propertyReference, getComponentPropertyDefinitions(mainComponent));
        if (definition) return definition;
      }
    }

    current = current.parent;
  }

  return null;
}

async function collectPreferredValues(instances: InstanceNode[]): Promise<InstanceSwapPreferredValue[]> {
  const values: InstanceSwapPreferredValue[] = [];
  const seen = new Set<string>();

  for (const instance of instances) {
    const propertyReference = instance.componentPropertyReferences?.mainComponent;
    if (!propertyReference) continue;

    const definition = await findContainingInstanceSwapProperty(instance, propertyReference);
    if (!definition || definition.type !== 'INSTANCE_SWAP' || !definition.preferredValues) continue;

    for (const value of definition.preferredValues) {
      const dedupeKey = `${value.type}:${value.key}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      values.push(value);
    }
  }

  return values;
}

// ================================
// Variant matching
// ================================

interface VariantChoice {
  variant: ComponentNode;
  kept: Array<{ property: string; value: string }>;
  reset: string[];
}

// Pick the existing variant that keeps the most current values (earlier
// properties break ties), so the swap never lands on a combination that throws.
function chooseVariant(target: ComponentTarget, currentValues: Record<string, string>): VariantChoice {
  const current = Object.entries(currentValues);

  if (!target.set) {
    return { variant: target.component, kept: [], reset: current.map(([property]) => property) };
  }

  const properties = Object.entries(target.set.componentPropertyDefinitions)
    .filter(([, definition]) => definition.type === 'VARIANT')
    .map(([property]) => property);
  const currentByName = new Map(current.map(([property, value]) => [property.toLowerCase(), value.toLowerCase()]));
  const variants = 'children' in target.set
    ? target.set.children.filter((child): child is ComponentNode => child.type === 'COMPONENT')
    : [];

  let best = target.set.defaultVariant;
  let bestScore = -1;
  for (const variant of variants) {
    const values = parseVariantName(variant.name);
    let score = 0;
    properties.forEach((property, index) => {
      const wanted = currentByName.get(property.toLowerCase());
      if (wanted !== undefined && values[property]?.toLowerCase() === wanted) {
        score += 1000 + properties.length - index;
      }
    });

    if (score > bestScore || (score === bestScore && variant === target.set.defaultVariant)) {
      best = variant;
      bestScore = score;
    }
  }

  const chosenValues = parseVariantName(best.name);
  const kept: VariantChoice['kept'] = [];
  const reset: string[] = [];
  for (const [property, value] of current) {
    const targetProperty = properties.find(name => name.toLowerCase() === property.toLowerCase());
    if (targetProperty && chosenValues[targetProperty]?.toLowerCase() === value.toLowerCase()) {
      kept.push({ property: targetProperty, value: chosenValues[targetProperty] });
    } else {
      reset.push(property);
    }
  }

  return { variant: best, kept, reset };
}

function describeCarry(choice: Pick<VariantChoice, 'kept' | 'reset'>): string {
  const kept = choice.kept.map(entry => `${entry.property}=${entry.value}`);
  if (kept.length > 0) {
    return `↵ keeps ${kept.join(', ')}` + (choice.reset.length > 0 ? ` · resets ${choice.reset.join(', ')}` : '');
  }
  return choice.reset.length > 0 ? `↵ resets ${choice.reset.join(', ')}` : '';
}

// ================================
// Suggestions
// ================================

function selectedInstances(): InstanceNode[] {
  return figma.currentPage.selection.filter(node => node.type === 'INSTANCE') as InstanceNode[];
}

async function describeSources(): Promise<string> {
  const sources = [...await getActiveLibraries(), LOCAL_LIBRARY];
  return sources.length === 1
    ? sources[0]
    : `${sources.slice(0, -1).join(', ')} or ${sources[sources.length - 1]}`;
}

export interface ComponentRowsOptions {
  instances: InstanceNode[];
  preferredValues: InstanceSwapPreferredValue[];
  query: string;
  // Hide the selection's current component (is), or keep it (ip).
  excludeCurrent: boolean;
}

export interface ComponentRow {
  candidate: SwapCandidate;
  label: string;
  value: string;
  thumbnail: ThumbnailRequest | null;
}

// Components in this file (or imported this run) render right away; library
// ones import first, which is never waited for.
function getThumbnailRequest(candidate: SwapCandidate): ThumbnailRequest | null {
  const id = candidate.nodeId || (candidate.key ? `${candidate.keyIsSet ? 'set' : 'component'}:${candidate.key}` : null);
  if (!id) return null;

  return {
    id,
    slow: !candidate.target,
    load: async () => {
      if (!candidate.target && candidate.key) candidate.target = await importTarget(candidate.key, candidate.keyIsSet);
      return candidate.target ? candidate.target.component : null;
    },
  };
}

// The current component's export warms up the exporter while the pool builds.
export function prepareSelectionThumbnail(instances: InstanceNode[]): void {
  const [instance] = instances;
  if (instance) prepareThumbnail({ id: `selection:${instance.id}`, load: () => getCachedMainComponent(instance) });
}

// Shared by `is` and `ip Icon:` — ranked rows with readable labels and
// key-carrying values.
export async function findComponentRows(options: ComponentRowsOptions): Promise<ComponentRow[]> {
  const pool = await buildCandidatePool(options.preferredValues);
  const context = await buildRankingContext(options.instances, pool);
  if (!options.excludeCurrent) context.excluded.clear();

  const ranked = rankCandidates(pool, options.query, context).slice(0, MAX_ROWS);
  const leafCounts = new Map<string, number>();
  for (const { candidate } of ranked) {
    const leaf = leafName(candidate.name).toLowerCase();
    leafCounts.set(leaf, (leafCounts.get(leaf) || 0) + 1);
  }

  return ranked.map(({ candidate }) => {
    const shownName = (leafCounts.get(leafName(candidate.name).toLowerCase()) || 0) > 1
      ? candidate.name
      : leafName(candidate.name);
    const where = candidate.preferredIndex !== -1 ? 'preferred' : candidate.library || 'library';
    const mark = candidate.preferredIndex !== -1 ? '★ ' : '';

    return {
      candidate,
      label: `${mark}${shownName} · ${where}`,
      value: formatComponentValue(candidate),
      thumbnail: getThumbnailRequest(candidate),
    };
  });
}

export async function formatNoComponentMatch(query: string): Promise<string> {
  const sources = await describeSources();
  return query.trim()
    ? `No component matches "${query.trim()}" in ${sources}`
    : `No components found in ${sources}`;
}

export async function searchComponentsForSwap(searchTerm: string): Promise<Array<string | SuggestionRow>> {
  const instances = selectedInstances();
  prepareSelectionThumbnail(instances);
  const rows = await findComponentRows({
    instances,
    preferredValues: await collectPreferredValues(instances),
    query: searchTerm,
    excludeCurrent: true,
  });

  if (rows.length === 0) {
    return [await formatNoComponentMatch(searchTerm)];
  }

  const suggestions: SuggestionRow[] = rows.map(row =>
    withThumbnail({ name: row.label, data: row.value, icon: ICONS.component }, row.thumbnail)
  );
  const thumbnails = applyThumbnails(suggestions);

  const top = rows[0];
  if (top.candidate.target && instances.length > 0) {
    const hint = describeCarry(chooseVariant(top.candidate.target, await getCurrentVariantValues(instances[0])));
    if (hint) suggestions[0].name = `${top.label}    ${hint}`;
  }

  await thumbnails;
  return suggestions;
}

// ================================
// Resolution and swap
// ================================

function parseLegacyValue(value: string, libraries: string[]): { name: string; library: string | null } {
  const trimmed = value.trim();
  const byLength = [...libraries, LOCAL_LIBRARY].sort((a, b) => b.length - a.length);

  for (const library of byLength) {
    const suffix = ` (${library})`;
    if (trimmed.endsWith(suffix)) {
      return { name: trimmed.slice(0, -suffix.length).trim(), library };
    }
  }

  return { name: trimmed, library: null };
}

async function resolveLegacyValue(value: string): Promise<{ target: ComponentTarget; name: string } | null> {
  const { name, library } = parseLegacyValue(value, await getActiveLibraries());
  const pool = await buildCandidatePool([]);
  const exact = pool.filter(candidate => candidate.name === name);
  const matches = exact.length > 0
    ? exact
    : pool.filter(candidate => candidate.name.toLowerCase() === name.toLowerCase());
  const chosen = matches.find(candidate => library !== null && candidate.library === library) || matches[0];

  if (!chosen) {
    figma.notify(`No component named "${name}" in this file or active libraries`, { error: true });
    return null;
  }

  return await resolveCandidate(chosen);
}

async function resolveCandidate(candidate: SwapCandidate): Promise<{ target: ComponentTarget; name: string } | null> {
  const token: ComponentToken = { n: candidate.name, l: candidate.library };
  if (candidate.nodeId) token.id = candidate.nodeId;
  if (candidate.key) token.k = candidate.key;
  if (candidate.keyIsSet) token.s = 1;
  return await resolveToken(token);
}

async function resolveToken(token: ComponentToken): Promise<{ target: ComponentTarget; name: string } | null> {
  let target: ComponentTarget | null = null;

  if (token.id) {
    const node = await figma.getNodeByIdAsync(token.id);
    if (node?.type === 'COMPONENT_SET') {
      target = { set: node, component: node.defaultVariant };
    } else if (node?.type === 'COMPONENT') {
      target = { set: node.parent?.type === 'COMPONENT_SET' ? node.parent : null, component: node };
    }
  }

  if (!target && token.k) {
    target = await importTarget(token.k, token.s === 1);
  }

  if (!target) {
    const message = token.id && !token.k
      ? `Couldn't find ${leafName(token.n)} in this file. Nothing was swapped.`
      : `Couldn't import ${leafName(token.n)}${token.l ? ` from ${token.l}` : ''} (removed or unpublished). Nothing was swapped.`;
    figma.notify(message, { error: true });
    return null;
  }

  return { target, name: target.set ? target.set.name : target.component.name };
}

// Accepts a row value ("Name (Library) [[kc-component=…]]") or a bare
// "Name (Library)" reference. Never falls back to a partial name match.
export async function resolveComponentValue(value: string): Promise<{ target: ComponentTarget; name: string } | null> {
  const token = parseComponentToken(value);
  return token ? await resolveToken(token) : await resolveLegacyValue(value);
}

function summarizeKept(choices: VariantChoice[]): { kept: string[]; reset: string[] } {
  const [first, ...rest] = choices;
  const kept = first.kept
    .filter(entry => rest.every(choice => choice.kept.some(other => other.property === entry.property)))
    .map(entry => {
      const uniform = rest.every(choice => choice.kept.find(other => other.property === entry.property)?.value === entry.value);
      return uniform ? `${entry.property}=${entry.value}` : entry.property;
    });
  const reset = [...new Set(choices.flatMap(choice => choice.reset))];
  return { kept, reset };
}

export async function swapInstance(value: string) {
  const instances = selectedInstances();
  if (instances.length === 0) {
    throw new Error('No instances selected');
  }

  const resolved = await resolveComponentValue(value);
  if (!resolved) return;

  const label = leafName(resolved.name);
  const choices: VariantChoice[] = [];
  const failures: string[] = [];

  for (const instance of instances) {
    try {
      const choice = chooseVariant(resolved.target, await getCurrentVariantValues(instance));
      instance.swapComponent(choice.variant);
      choices.push(choice);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (choices.length === 0) {
    figma.notify(`Couldn't swap to ${label}: ${failures[0]}`, { error: true });
    return;
  }

  const { kept, reset } = summarizeKept(choices);
  const count = instances.length > 1 ? ` ${choices.length}${failures.length > 0 ? ` of ${instances.length}` : ''}` : '';
  const message = `Swapped${count} → ${label}` +
    (kept.length > 0 ? ` · kept ${kept.join(', ')}` : '') +
    (reset.length > 0 ? ` · reset ${reset.join(', ')}` : '') +
    (failures.length > 0 ? ` · ${failures.length} ${pluralize(failures.length, 'instance')} failed: ${failures[0]}` : '');

  figma.notify(message, failures.length > 0 ? { error: true } : undefined);
}
