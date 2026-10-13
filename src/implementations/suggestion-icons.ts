// 16px icons for the is / ip / rio suggestion rows. Glyphs are prebuilt
// strings and swatches are cheap to build; component thumbnails render in the
// background and are kept for the run, so typing never waits on a library
// import and waits at most THUMBNAIL_BUDGET_MS on exports.

// Mid grey reads on both the light and the dark quick actions menu.
const GLYPH_COLOR = '#8C8C8C';
// About what the menu shows without scrolling; later rows keep their glyph.
const THUMBNAIL_ROWS = 8;
const THUMBNAIL_BUDGET_MS = 40;
// Bigger exports would slow every keystroke's message to the menu.
const MAX_THUMBNAIL_LENGTH = 12000;

function svg(content: string): string {
  return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">${content}</svg>`;
}

function line(d: string, width = 1.25): string {
  return `<path d="${d}" stroke="${GLYPH_COLOR}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

const SWATCH_FRAME = '<rect x="0.5" y="0.5" width="15" height="15" rx="2.5" stroke="#000000" stroke-opacity="0.12"/>';

export const ICONS = {
  component: svg(`<path d="M8 1.75 10.25 4 8 6.25 5.75 4ZM12 5.75 14.25 8 12 10.25 9.75 8ZM8 9.75 10.25 12 8 14.25 5.75 12ZM4 5.75 6.25 8 4 10.25 1.75 8Z" fill="${GLYPH_COLOR}"/>`),
  variant: svg(line('M8 2.5 13.5 8 8 13.5 2.5 8Z')),
  on: svg(`<rect x="1.5" y="4.5" width="13" height="7" rx="3.5" fill="${GLYPH_COLOR}"/><circle cx="11" cy="8" r="2" fill="#FFFFFF"/>`),
  off: svg(`<rect x="2" y="5" width="12" height="6" rx="3" stroke="${GLYPH_COLOR}" stroke-width="1.25"/><circle cx="5" cy="8" r="1.5" fill="${GLYPH_COLOR}"/>`),
  text: svg(line('M3.5 3.5h9M8 3.5v9', 1.5)),
  typography: svg(line('M3 13 8 3l5 10M4.75 9.5h6.5', 1.4)),
  size: svg(line('M9.5 2.5h4v4M13.5 2.5 9.25 6.75M6.5 13.5h-4v-4M2.5 13.5l4.25-4.25')),
  visibility: svg(`${line('M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8s-2.4 4.5-6.5 4.5S1.5 8 1.5 8Z')}<circle cx="8" cy="8" r="1.75" fill="${GLYPH_COLOR}"/>`),
  opacity: svg(`<circle cx="8" cy="8" r="5.5" stroke="${GLYPH_COLOR}" stroke-width="1.25"/><path d="M8 2.5a5.5 5.5 0 0 1 0 11Z" fill="${GLYPH_COLOR}"/>`),
  radius: svg(line('M3 13V8a5 5 0 0 1 5-5h5', 1.4)),
  effects: svg(`<rect x="2.5" y="2.5" width="8" height="8" rx="1.5" stroke="${GLYPH_COLOR}" stroke-width="1.25"/>${line('M13 5.5v6a1.5 1.5 0 0 1-1.5 1.5h-6', 1.75)}`),
  name: svg(`${line('M2.5 3.5v4.1l6 6 5-5-6-6H3.5a1 1 0 0 0-1 1Z')}<circle cx="5.5" cy="5.5" r="1" fill="${GLYPH_COLOR}"/>`),
  reset: svg(line('M3.25 8a4.75 4.75 0 1 0 1.4-3.36M4.5 2.25v2.5H7')),
  override: svg(`<circle cx="8" cy="8" r="2.5" fill="${GLYPH_COLOR}"/>`),
  fill: svg(`<rect x="2.5" y="2.5" width="11" height="11" rx="2" fill="${GLYPH_COLOR}"/>`),
  stroke: svg(`<rect x="3" y="3" width="10" height="10" rx="2" stroke="${GLYPH_COLOR}" stroke-width="2"/>`),
  noPaint: svg(`<rect width="16" height="16" rx="3" fill="#FFFFFF"/>${SWATCH_FRAME}<path d="M3.5 12.5l9-9" stroke="#F24822" stroke-width="1.25"/>`),
  gradient: svg(`<defs><linearGradient id="kc-gradient" x1="2" y1="2" x2="14" y2="14" gradientUnits="userSpaceOnUse"><stop stop-color="#FFFFFF"/><stop offset="1" stop-color="#5C5C5C"/></linearGradient></defs><rect x="1" y="1" width="14" height="14" rx="2" fill="url(#kc-gradient)"/>${SWATCH_FRAME}`),
  image: svg(`<rect width="16" height="16" rx="3" fill="#F5F5F5"/><rect x="2" y="3" width="12" height="10" rx="1" fill="#E0E0E0"/><circle cx="5" cy="6" r="1.5" fill="#BDBDBD"/><path d="M2 11 5.5 8 8 10l3-3 3 4v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1Z" fill="#BDBDBD"/>${SWATCH_FRAME}`),
};

function toHex(color: RGB): string {
  const channel = (value: number) => Math.round(value * 255).toString(16).padStart(2, '0');
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
}

// The color a fill row restores as a swatch; stroke rows show it as a ring.
export function getPaintIcon(paints: unknown, kind: 'fill' | 'stroke'): string {
  if (!Array.isArray(paints)) return kind === 'fill' ? ICONS.fill : ICONS.stroke;

  const visible = (paints as Paint[]).filter(paint => paint.visible !== false);
  if (visible.length === 0) return ICONS.noPaint;

  const first = visible[0];
  if (first.type === 'SOLID') {
    const color = toHex(first.color);
    const opacity = first.opacity === undefined ? 1 : Math.round(first.opacity * 100) / 100;
    const paint = kind === 'fill'
      ? `<rect x="2" y="2" width="12" height="12" rx="2" fill="${color}" fill-opacity="${opacity}"/>`
      : `<rect x="3.25" y="3.25" width="9.5" height="9.5" rx="2" stroke="${color}" stroke-opacity="${opacity}" stroke-width="2.5"/>`;
    return svg(`<rect width="16" height="16" rx="3" fill="#FFFFFF"/>${paint}${SWATCH_FRAME}`);
  }
  if (first.type.startsWith('GRADIENT')) return ICONS.gradient;
  if (first.type === 'IMAGE' || first.type === 'VIDEO') return ICONS.image;
  return kind === 'fill' ? ICONS.fill : ICONS.stroke;
}

// ================================
// Component thumbnails
// ================================

export interface ThumbnailRequest {
  id: string;
  load: () => Promise<SceneNode | null>;
  // Needs a library import first: started, but never waited for.
  slow?: boolean;
}

const thumbnails = new Map<string, string | null>();
const pendingThumbnails = new Map<string, Promise<void>>();
const rowRequests = new WeakMap<object, ThumbnailRequest>();
let thumbnailCount = 0;

// The export on a light tile, so dark icons stay visible in the dark menu.
// Ids get a per-thumbnail prefix so menus that inline several don't collide.
function frameThumbnail(exported: string): string | null {
  const source = exported.trim();
  const open = source.match(/^<svg\b([^>]*)>/);
  const viewBox = open?.[1].match(/viewBox="([^"]+)"/)?.[1];
  if (!open || !viewBox || !source.endsWith('</svg>')) return null;

  const prefix = `kc${++thumbnailCount}-`;
  const body = source
    .slice(open[0].length, -'</svg>'.length)
    .replace(/\bid="([^"]+)"/g, `id="${prefix}$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${prefix}$1)`)
    .replace(/href="#([^"]+)"/g, `href="#${prefix}$1"`);

  return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
    '<rect x="0.5" y="0.5" width="15" height="15" rx="3" fill="#E6E6E6" stroke="#000000" stroke-opacity="0.08"/>' +
    `<svg x="2" y="2" width="12" height="12" viewBox="${viewBox}" fill="none">${body}</svg></svg>`;
}

async function renderThumbnail(node: SceneNode | null): Promise<string | null> {
  if (!node || !('exportAsync' in node)) return null;

  const exported = await node.exportAsync({ format: 'SVG_STRING', svgOutlineText: true, svgIdAttribute: false });
  return exported.length <= MAX_THUMBNAIL_LENGTH ? frameThumbnail(exported) : null;
}

function startThumbnail(request: ThumbnailRequest): Promise<void> | undefined {
  if (!thumbnails.has(request.id) && !pendingThumbnails.has(request.id)) {
    const pending = Promise.resolve()
      .then(() => request.load())
      .then(renderThumbnail)
      .catch(() => null)
      .then(icon => {
        thumbnails.set(request.id, icon);
        pendingThumbnails.delete(request.id);
      });
    pendingThumbnails.set(request.id, pending);
  }
  return pendingThumbnails.get(request.id);
}

// Starts an export early (the first one in a run is the slowest) while the
// rest of the search is still running.
export function prepareThumbnail(request: ThumbnailRequest): void {
  void startThumbnail(request);
}

export function withThumbnail<T extends object>(row: T, request: ThumbnailRequest | null): T {
  if (request) rowRequests.set(row, request);
  return row;
}

// Swaps the glyph of the first rows for their component thumbnail when it is
// ready within the budget. Rows still waiting get it on a later keystroke.
export async function applyThumbnails(rows: readonly unknown[]): Promise<void> {
  const entries: Array<{ row: { icon?: string }; request: ThumbnailRequest }> = [];
  for (const row of rows.slice(0, THUMBNAIL_ROWS)) {
    const request = row && typeof row === 'object' ? rowRequests.get(row) : undefined;
    if (request) entries.push({ row: row as { icon?: string }, request });
  }

  const waiting = entries
    .map(({ request }) => {
      const pending = startThumbnail(request);
      return request.slow ? undefined : pending;
    })
    .filter((pending): pending is Promise<void> => !!pending);

  if (waiting.length > 0) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      Promise.all(waiting),
      new Promise<void>(resolve => { timer = setTimeout(resolve, THUMBNAIL_BUDGET_MS); }),
    ]);
    if (timer !== undefined) clearTimeout(timer);
  }

  for (const { row, request } of entries) {
    const icon = thumbnails.get(request.id);
    if (icon) row.icon = icon;
  }
}
