// ==================================
// Tabler Icons Registry
// ==================================
// SVG icons from https://tabler.io/icons (MIT License)
// Icons are 24x24 viewBox rendered at 16x16 for Figma suggestions

/**
 * Creates a 16x16 SVG string from Tabler icon paths
 * Uses currentColor for stroke to inherit Figma's text color
 * Icons are rendered at 40% opacity for better visual hierarchy
 */
function createIcon(paths: string, strokeWidth: number = 2): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="0.4">${paths}</svg>`;
}

// ==================================
// Icon Definitions
// ==================================

export const ICONS = {
  // Sizing
  'arrows-horizontal': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 8l-4 4l4 4"/><path d="M17 8l4 4l-4 4"/><path d="M3 12l18 0"/>'),
  'arrows-vertical': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M8 7l4 -4l4 4"/><path d="M8 17l4 4l4 -4"/><path d="M12 3l0 18"/>'),
  'resize': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 11v8a1 1 0 0 0 1 1h8m-9 -14v-1a1 1 0 0 1 1 -1h1m5 0h2m5 0h1a1 1 0 0 1 1 1v1m0 5v2m0 5v1a1 1 0 0 1 -1 1h-1"/><path d="M4 12h7a1 1 0 0 1 1 1v7"/>'),
  'dimensions': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 5h11"/><path d="M12 7l2 -2l-2 -2"/><path d="M5 3l-2 2l2 2"/><path d="M19 10v11"/><path d="M17 19l2 2l2 -2"/><path d="M21 12l-2 -2l-2 2"/><path d="M3 10m0 2a2 2 0 0 1 2 -2h7a2 2 0 0 1 2 2v7a2 2 0 0 1 -2 2h-7a2 2 0 0 1 -2 -2z"/>'),

  // Position & Move
  'arrows-move': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M18 9l3 3l-3 3"/><path d="M15 12h6"/><path d="M6 9l-3 3l3 3"/><path d="M3 12h6"/><path d="M9 18l3 3l3 -3"/><path d="M12 15v6"/><path d="M15 6l-3 -3l-3 3"/><path d="M12 3v6"/>'),
  'arrow-up': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 5l0 14"/><path d="M18 11l-6 -6"/><path d="M6 11l6 -6"/>'),
  'arrow-down': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 5l0 14"/><path d="M18 13l-6 6"/><path d="M6 13l6 6"/>'),
  'arrow-left': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l14 0"/><path d="M5 12l6 6"/><path d="M5 12l6 -6"/>'),
  'arrow-right': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l14 0"/><path d="M13 18l6 -6"/><path d="M13 6l6 6"/>'),
  'chevron-down': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 9l6 6l6 -6"/>'),
  'chevron-up': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 15l6 -6l6 6"/>'),
  'chevrons-down': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 7l5 5l5 -5"/><path d="M7 13l5 5l5 -5"/>'),
  'chevrons-up': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 11l5 -5l5 5"/><path d="M7 17l5 -5l5 5"/>'),
  'pin': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4"/><path d="M9 15l-4.5 4.5"/><path d="M14.5 4l5.5 5.5"/>'),
  'crosshair': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 12h4m4 0h8"/><path d="M12 4v4m0 4v8"/><path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/>'),

  // Instance & Component
  'replace': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 3m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/><path d="M15 15m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/><path d="M21 11v-3a2 2 0 0 0 -2 -2h-6l3 3m0 -6l-3 3"/><path d="M3 13v3a2 2 0 0 0 2 2h6l-3 -3m0 6l3 -3"/>'),
  'adjustments': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 10a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M6 4v4"/><path d="M6 12v8"/><path d="M10 16a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M12 4v10"/><path d="M12 18v2"/><path d="M16 7a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M18 4v1"/><path d="M18 9v11"/>'),
  'refresh': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/>'),
  'unlink': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M17 22v-2"/><path d="M9 15l6 -6"/><path d="M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464"/><path d="M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463"/><path d="M20 17h2"/><path d="M2 7h2"/><path d="M7 2v2"/>'),
  'select': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 3m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z"/><path d="M9 11l3 3l3 -3"/>'),
  'upload': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"/><path d="M7 9l5 -5l5 5"/><path d="M12 4l0 12"/>'),
  'component': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 12l9 -9l9 9l-9 9z"/><path d="M12 3v18"/><path d="M3 12h18"/>'),
  'plus': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 5l0 14"/><path d="M5 12l14 0"/>'),
  'copy': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z"/><path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1"/>'),

  // Layout
  'layout-columns': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z"/><path d="M12 4l0 16"/>'),
  'layout-rows': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z"/><path d="M4 12l16 0"/>'),
  'layout-off': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M8 4h10a2 2 0 0 1 2 2v10m-.586 3.414a2 2 0 0 1 -1.414 .586h-12a2 2 0 0 1 -2 -2v-12c0 -.547 .22 -1.043 .576 -1.405"/><path d="M4 9h6m4 0h6"/><path d="M9 4v2m0 4v10"/><path d="M3 3l18 18"/>'),
  'text-wrap': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 6l16 0"/><path d="M4 18l5 0"/><path d="M4 12h13a3 3 0 0 1 0 6h-4l2 -2m0 4l-2 -2"/>'),
  'spacing-horizontal': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M20 20h-2a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h2"/><path d="M4 20h2a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2"/><path d="M12 8v8"/>'),
  'spacing-vertical': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 20v-2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v2"/><path d="M4 4v2a2 2 0 0 0 2 -2h12a2 2 0 0 0 2 -2v-2"/><path d="M8 12h8"/>'),
  'box-padding': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 4h16v16h-16z"/><path d="M8 8h8v8h-8z"/>'),

  // Transform
  'flip-horizontal': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 12l18 0"/><path d="M7 16l10 0l-10 5l0 -5"/><path d="M7 8l10 0l-10 -5l0 5"/>'),
  'flip-vertical': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 3l0 18"/><path d="M16 7l0 10l5 -10l-5 0"/><path d="M8 7l0 10l-5 -10l5 0"/>'),
  'rotate': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M19.95 11a8 8 0 1 0 -.5 4m.5 5v-5h-5"/>'),

  // Grouping
  'folder': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2"/>'),
  'folder-off': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 3l18 18"/><path d="M19 19h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 1.172 -1.821m3.828 -.179h1l3 3h7a2 2 0 0 1 2 2v8"/>'),

  // Boolean
  'square-plus': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 3m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z"/><path d="M9 12l6 0"/><path d="M12 9l0 6"/>'),
  'square-minus': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 3m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z"/><path d="M9 12l6 0"/>'),
  'circles-relation': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9.183 6.117a6 6 0 1 0 4.511 3.986"/><path d="M14.813 17.883a6 6 0 1 0 -4.496 -3.954"/>'),
  'circle-off': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M20.042 16.045a9 9 0 0 0 -12.087 -12.087m-2.318 1.677a9 9 0 1 0 12.725 12.73"/><path d="M3 3l18 18"/>'),

  // Visibility & Lock
  'eye': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6"/>'),
  'lock': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6z"/><path d="M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0"/><path d="M8 11v-4a4 4 0 1 1 8 0v4"/>'),
  'mask': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0"/>'),

  // Sizing modes
  'arrows-maximize': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M16 4l4 0l0 4"/><path d="M14 10l6 -6"/><path d="M8 20l-4 0l0 -4"/><path d="M4 20l6 -6"/><path d="M16 20l4 0l0 -4"/><path d="M14 14l6 6"/><path d="M8 4l-4 0l0 4"/><path d="M4 4l6 6"/>'),
  'arrows-minimize': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 9l4 0l0 -4"/><path d="M3 3l6 6"/><path d="M5 15l4 0l0 4"/><path d="M3 21l6 -6"/><path d="M19 9l-4 0l0 -4"/><path d="M15 9l6 -6"/><path d="M19 15l-4 0l0 4"/><path d="M15 15l6 6"/>'),

  // Colors & Fill
  'paint': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 3m0 2a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2z"/><path d="M19 6h1a2 2 0 0 1 2 2a5 5 0 0 1 -5 5l-5 0v2"/><path d="M10 15m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z"/>'),
  'palette': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 21a9 9 0 0 1 0 -18c4.97 0 9 3.582 9 8c0 1.06 -.474 2.078 -1.318 2.828c-.844 .75 -1.989 1.172 -3.182 1.172h-2.5a2 2 0 0 0 -1 3.75a1.3 1.3 0 0 1 -1 2.25"/><path d="M8.5 10.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M12.5 7.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M16.5 10.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/>'),
  'droplet': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7.502 19.423c2.602 2.105 6.395 2.105 8.996 0c2.602 -2.105 3.262 -5.708 1.566 -8.546l-4.89 -7.26c-.42 -.625 -1.287 -.803 -1.936 -.397a1.376 1.376 0 0 0 -.41 .397l-4.893 7.26c-1.695 2.838 -1.035 6.441 1.567 8.546z"/>'),
  'switch-horizontal': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M16 3l4 4l-4 4"/><path d="M10 7l10 0"/><path d="M8 13l-4 4l4 4"/><path d="M4 17l10 0"/>'),

  // Stroke & Border
  'border-style': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 18v.01"/><path d="M8 18v.01"/><path d="M12 18v.01"/><path d="M16 18v.01"/><path d="M20 18v.01"/><path d="M18 12h2"/><path d="M11 12h2"/><path d="M4 12h2"/><path d="M4 6h16"/>'),
  'border-radius': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 12v-4a4 4 0 0 1 4 -4h4"/><path d="M16 4l0 16"/><path d="M4 16l0 4"/>'),
  'radius-top-left': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 19v-6a8 8 0 0 1 8 -8h6" />'),
  'radius-top-right': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 5h6a8 8 0 0 1 8 8v6" />'),
  'radius-bottom-left': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M19 19h-6a8 8 0 0 1 -8 -8v-6" />'),
  'radius-bottom-right': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M19 5v6a8 8 0 0 1 -8 8h-6" />'),
  'border-top': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 4l16 0"/><path d="M4 8l0 .01"/><path d="M12 8l0 .01"/><path d="M20 8l0 .01"/><path d="M4 12l0 .01"/><path d="M8 12l0 .01"/><path d="M12 12l0 .01"/><path d="M16 12l0 .01"/><path d="M20 12l0 .01"/><path d="M4 16l0 .01"/><path d="M12 16l0 .01"/><path d="M20 16l0 .01"/><path d="M4 20l0 .01"/><path d="M8 20l0 .01"/><path d="M12 20l0 .01"/><path d="M16 20l0 .01"/><path d="M20 20l0 .01"/>'),
  'border-bottom': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 20l16 0"/><path d="M4 16l0 .01"/><path d="M12 16l0 .01"/><path d="M20 16l0 .01"/><path d="M4 12l0 .01"/><path d="M8 12l0 .01"/><path d="M12 12l0 .01"/><path d="M16 12l0 .01"/><path d="M20 12l0 .01"/><path d="M4 8l0 .01"/><path d="M12 8l0 .01"/><path d="M20 8l0 .01"/><path d="M4 4l0 .01"/><path d="M8 4l0 .01"/><path d="M12 4l0 .01"/><path d="M16 4l0 .01"/><path d="M20 4l0 .01"/>'),
  'border-left': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 4l0 16"/><path d="M8 4l0 .01"/><path d="M8 12l0 .01"/><path d="M8 20l0 .01"/><path d="M12 4l0 .01"/><path d="M12 8l0 .01"/><path d="M12 12l0 .01"/><path d="M12 16l0 .01"/><path d="M12 20l0 .01"/><path d="M16 4l0 .01"/><path d="M16 12l0 .01"/><path d="M16 20l0 .01"/><path d="M20 4l0 .01"/><path d="M20 8l0 .01"/><path d="M20 12l0 .01"/><path d="M20 16l0 .01"/><path d="M20 20l0 .01"/>'),
  'border-right': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M20 4l0 16"/><path d="M16 4l0 .01"/><path d="M16 12l0 .01"/><path d="M16 20l0 .01"/><path d="M12 4l0 .01"/><path d="M12 8l0 .01"/><path d="M12 12l0 .01"/><path d="M12 16l0 .01"/><path d="M12 20l0 .01"/><path d="M8 4l0 .01"/><path d="M8 12l0 .01"/><path d="M8 20l0 .01"/><path d="M4 4l0 .01"/><path d="M4 8l0 .01"/><path d="M4 12l0 .01"/><path d="M4 16l0 .01"/><path d="M4 20l0 .01"/>'),
  'border-all': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z"/><path d="M4 12l16 0"/><path d="M12 4l0 16"/>'),
  'border-inner': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 12l16 0"/><path d="M12 4l0 16"/><path d="M4 4l0 .01"/><path d="M8 4l0 .01"/><path d="M16 4l0 .01"/><path d="M20 4l0 .01"/><path d="M4 8l0 .01"/><path d="M20 8l0 .01"/><path d="M4 16l0 .01"/><path d="M20 16l0 .01"/><path d="M4 20l0 .01"/><path d="M8 20l0 .01"/><path d="M16 20l0 .01"/><path d="M20 20l0 .01"/>'),
  'border-outer': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z"/><path d="M12 8l0 .01"/><path d="M8 12l0 .01"/><path d="M12 12l0 .01"/><path d="M16 12l0 .01"/><path d="M12 16l0 .01"/>'),
  'circle-dot': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/>'),
  'circle-minus': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M9 12l6 0"/>'),
  'circle': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/>'),

  // Text
  'typography': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 20l3 0"/><path d="M14 20l7 0"/><path d="M6.9 15l6.9 0"/><path d="M10.2 6.3l5.8 13.7"/><path d="M5 20l6 -16l2 0l7 16"/>'),
  'text-size': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 7v-2h13v2"/><path d="M10 5v14"/><path d="M12 19h-4"/><path d="M15 13v-1h6v1"/><path d="M18 12v7"/><path d="M17 19h2"/>'),
  'letter-spacing': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12v-5.5a2.5 2.5 0 0 1 5 0v5.5m0 -4h-5"/><path d="M13 4l3 8l3 -8"/><path d="M5 18h14"/><path d="M3 18l2 -2l-2 -2"/><path d="M21 18l-2 -2l2 -2"/>'),
  'line-height': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 8l3 -3l3 3"/><path d="M3 16l3 3l3 -3"/><path d="M6 5l0 14"/><path d="M13 6l7 0"/><path d="M13 12l7 0"/><path d="M13 18l7 0"/>'),
  'align-left': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 6l16 0"/><path d="M4 12l10 0"/><path d="M4 18l14 0"/>'),
  'align-center': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 6l16 0"/><path d="M7 12l10 0"/><path d="M5 18l14 0"/>'),
  'align-right': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 6l16 0"/><path d="M10 12l10 0"/><path d="M6 18l14 0"/>'),
  'align-justified': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 6l16 0"/><path d="M4 12l16 0"/><path d="M4 18l12 0"/>'),
  'baseline': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 20l16 0"/><path d="M8 16v-8a4 4 0 1 1 8 0v8"/><path d="M8 10h8"/>'),
  'text-wrap-disabled': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 6l16 0"/><path d="M4 18l9 0"/><path d="M4 12h17l-3 -3m0 6l3 -3"/>'),
  'letter-case-upper': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 19v-10.5a3.5 3.5 0 0 1 7 0v10.5"/><path d="M3 13h7"/><path d="M14 19v-10.5a3.5 3.5 0 0 1 7 0v10.5"/><path d="M14 13h7"/>'),
  'letter-case-lower': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6.5 15.5m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0"/><path d="M10 12v7"/><path d="M17.5 15.5m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0"/><path d="M21 12v7"/>'),
  'letter-case': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M17.5 15.5m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0"/><path d="M3 19v-10.5a3.5 3.5 0 0 1 7 0v10.5"/><path d="M3 13h7"/><path d="M21 12v7"/>'),
  'small-caps': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 7h7v-2h-7z"/><path d="M14 7h7v-2h-7z"/><path d="M6 20h5v-14h-5z"/><path d="M15 20h5v-11h-5z"/>'),
  'underline': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 5v5a5 5 0 0 0 10 0v-5"/><path d="M5 19h14"/>'),
  'strikethrough': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l14 0"/><path d="M16 6.5a4 2 0 0 0 -4 -1.5h-1a3.5 3.5 0 0 0 0 7h2a3.5 3.5 0 0 1 0 7h-1.5a4 2 0 0 1 -4 -1.5"/>'),
  'list-numbers': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M11 6h9"/><path d="M11 12h9"/><path d="M12 18h8"/><path d="M4 16a2 2 0 1 1 4 0c0 .591 -.5 1 -1 1.5l-3 2.5h4"/><path d="M6 10v-6l-2 2"/>'),
  'list': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 6l11 0"/><path d="M9 12l11 0"/><path d="M9 18l11 0"/><path d="M5 6l0 .01"/><path d="M5 12l0 .01"/><path d="M5 18l0 .01"/>'),
  'list-check': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3.5 5.5l1.5 1.5l2.5 -2.5"/><path d="M3.5 11.5l1.5 1.5l2.5 -2.5"/><path d="M3.5 17.5l1.5 1.5l2.5 -2.5"/><path d="M11 6l9 0"/><path d="M11 12l9 0"/><path d="M11 18l9 0"/>'),

  // Effects
  'sparkles': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6z"/>'),
  'sparkles-off': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 3l18 18"/><path d="M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2z"/><path d="M9 18a6 6 0 0 1 3.28 -5.346m2.531 -1.46a6.001 6.001 0 0 1 .189 -.194a6 6 0 0 1 -6 -6c0 1.623 .644 3.095 1.691 4.173"/>'),

  // Export
  'download': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"/><path d="M7 11l5 5l5 -5"/><path d="M12 4l0 12"/>'),
  'file-type-svg': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M5 12v-7a2 2 0 0 1 2 -2h7l5 5v4"/><path d="M4 20.25c0 .414 .336 .75 .75 .75h1.5a1.5 1.5 0 0 0 0 -3h-1.5a1.5 1.5 0 0 1 0 -3h1.5a.75 .75 0 0 1 .75 .75"/><path d="M10 15l2 6l2 -6"/><path d="M20 15h-1a2 2 0 0 0 -2 2v2a2 2 0 0 0 2 2h1v-3"/>'),
  'file-type-pdf': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M5 12v-7a2 2 0 0 1 2 -2h7l5 5v4"/><path d="M5 18h1.5a1.5 1.5 0 0 0 0 -3h-1.5v6"/><path d="M17 18h2"/><path d="M20 15h-3v6"/><path d="M11 15v6h1a2 2 0 0 0 2 -2v-2a2 2 0 0 0 -2 -2h-1z"/>'),
  'photo': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M15 8h.01"/><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12z"/><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5"/><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3"/>'),
  'jpg': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M21 8h-2a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h2v-4h-1"/><path d="M10 16v-8h2a2 2 0 1 1 0 4h-2"/><path d="M3 8v6a2 2 0 0 0 2 2h.5a.5 .5 0 0 0 .5 -.5"/>'),

  // Alignment
  'box-align-top': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v1a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z"/><path d="M4 15l0 .01"/><path d="M20 15l0 .01"/><path d="M4 20l0 .01"/><path d="M8 20l0 .01"/><path d="M12 20l0 .01"/><path d="M16 20l0 .01"/><path d="M20 20l0 .01"/>'),
  'box-align-bottom': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 14m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v1a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z"/><path d="M4 9l0 .01"/><path d="M20 9l0 .01"/><path d="M4 4l0 .01"/><path d="M8 4l0 .01"/><path d="M12 4l0 .01"/><path d="M16 4l0 .01"/><path d="M20 4l0 .01"/>'),
  'box-align-left': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 4m0 2a2 2 0 0 1 2 -2h1a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-1a2 2 0 0 1 -2 -2z"/><path d="M15 4l0 .01"/><path d="M15 20l0 .01"/><path d="M20 4l0 .01"/><path d="M20 8l0 .01"/><path d="M20 12l0 .01"/><path d="M20 16l0 .01"/><path d="M20 20l0 .01"/>'),
  'box-align-right': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M15 4m0 2a2 2 0 0 1 2 -2h1a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-1a2 2 0 0 1 -2 -2z"/><path d="M9 4l0 .01"/><path d="M9 20l0 .01"/><path d="M4 4l0 .01"/><path d="M4 8l0 .01"/><path d="M4 12l0 .01"/><path d="M4 16l0 .01"/><path d="M4 20l0 .01"/>'),
  'layout-align-top': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 4l16 0"/><path d="M9 8m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z"/>'),
  'layout-align-bottom': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 20l16 0"/><path d="M9 4m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z"/>'),
  'layout-align-left': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 4l0 16"/><path d="M8 9m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z"/>'),
  'layout-align-right': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M20 4l0 16"/><path d="M4 9m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z"/>'),
  'layout-align-center': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 4l0 5"/><path d="M12 15l0 5"/><path d="M6 9m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z"/>'),
  'layout-align-middle': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 12l5 0"/><path d="M15 12l5 0"/><path d="M9 6m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z"/>'),
  'layout-distribute-vertical': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 4l16 0"/><path d="M4 20l16 0"/><path d="M6 9m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z"/>'),
  'layout-distribute-horizontal': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 4l0 16"/><path d="M20 4l0 16"/><path d="M9 6m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z"/>'),
  'corner-up-left': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M18 18v-6a3 3 0 0 0 -3 -3h-10l4 -4m0 8l-4 -4" />'),
  'corner-up-right': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 18v-6a3 3 0 0 1 3 -3h10l-4 -4m0 8l4 -4" />'),
  'corner-down-left': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M18 6v6a3 3 0 0 1 -3 3h-10l4 -4m0 8l-4 -4" />'),
  'corner-down-right': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 6v6a3 3 0 0 0 3 3h10l-4 -4m0 8l4 -4" />'),
  'align-box-center-top': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 19v-14a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z" /><path d="M11 13h2" /><path d="M9 10h6" /><path d="M10 7h4" />'),
  'align-box-center-middle': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 19v-14a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z" /><path d="M11 15h2" /><path d="M9 12h6" /><path d="M10 9h4" />'),
  'align-box-center-bottom': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 19v-14a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z" /><path d="M11 17h2" /><path d="M9 14h6" /><path d="M10 11h4" />'),
  'align-box-left-middle': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 3m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z" /><path d="M9 15h-2" /><path d="M13 12h-6" /><path d="M11 9h-4" />'),
  'align-box-right-middle': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M15 15h2" /><path d="M3 5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14z" /><path d="M11 12h6" /><path d="M13 9h4" />'),
  'align-box-left-top': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 3m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z" /><path d="M9 13h-2" /><path d="M13 10h-6" /><path d="M11 7h-4" />'),
  'align-box-right-top': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 3m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z" /><path d="M15 13h2" /><path d="M11 10h6" /><path d="M13 7h4" />'),
  'align-box-left-bottom': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 3m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z" /><path d="M9 17h-2" /><path d="M13 14h-6" /><path d="M11 11h-4" />'),
  'align-box-right-bottom': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 3m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z" /><path d="M15 17h2" /><path d="M11 14h6" /><path d="M13 11h4" />'),

  // Constraints
  'anchor': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 9a2 2 0 1 0 0 -4a2 2 0 0 0 0 4z"/><path d="M12 9v12"/><path d="M4 13l3 3l-3 3"/><path d="M20 13l-3 3l3 3"/><path d="M7 16h-3v-2"/><path d="M17 16h3v-2"/>'),
  'arrows-diagonal': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M16 4l4 0l0 4"/><path d="M14 10l6 -6"/><path d="M8 20l-4 0l0 -4"/><path d="M4 20l6 -6"/>'),
  'arrow-bar-to-left': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10 12l10 0"/><path d="M10 12l4 4"/><path d="M10 12l4 -4"/><path d="M4 4l0 16"/>'),
  'arrow-bar-to-right': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M14 12l-10 0"/><path d="M14 12l-4 4"/><path d="M14 12l-4 -4"/><path d="M20 4l0 16"/>'),
  'arrow-bar-to-up': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 10l0 10"/><path d="M12 10l4 4"/><path d="M12 10l-4 4"/><path d="M4 4l16 0"/>'),
  'arrow-bar-to-down': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 14l0 -10"/><path d="M12 14l4 -4"/><path d="M12 14l-4 -4"/><path d="M4 20l16 0"/>'),

  // Transitions
  'transition-left': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M18 3a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3"/><path d="M6 18v-12a3 3 0 1 0 -6 0v12a3 3 0 0 0 6 0z"/><path d="M15 12h-8"/><path d="M10 9l-3 3l3 3"/>'),
  'transition-right': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 3a3 3 0 0 0 -3 3v12a3 3 0 0 0 3 3"/><path d="M18 18v-12a3 3 0 1 1 6 0v12a3 3 0 0 1 -6 0z"/><path d="M9 12h8"/><path d="M14 9l3 3l-3 3"/>'),
  'transition-top': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M21 6a3 3 0 0 0 -3 -3h-12a3 3 0 0 0 -3 3"/><path d="M3 21m0 -3a3 3 0 0 1 3 3h12a3 3 0 0 1 3 -3v0a3 3 0 0 1 -3 -3h-12a3 3 0 0 1 -3 3z"/><path d="M12 15v-8"/><path d="M9 10l3 -3l3 3"/>'),
  'transition-bottom': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M21 18a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3"/><path d="M3 3m0 3a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v0a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z"/><path d="M12 9v8"/><path d="M9 14l3 3l3 -3"/>'),

  // Layers
  'stack': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 6l-8 4l8 4l8 -4l-8 -4"/><path d="M4 14l8 4l8 -4"/>'),
  'stack-front': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 5m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/><path d="M9 9m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" fill="currentColor"/><path d="M13 13m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/>'),
  'stack-back': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 5m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" fill="currentColor"/><path d="M9 9m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/><path d="M13 13m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/>'),
  'bring-forward': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 5m0 2a2 2 0 0 1 2 -2h5a2 2 0 0 1 2 2v5a2 2 0 0 1 -2 2h-5a2 2 0 0 1 -2 -2z"/><path d="M12 12l0 -3a2 2 0 0 1 2 -2l3 0"/><path d="M12 12m0 2a2 2 0 0 1 2 -2h5a2 2 0 0 1 2 2v5a2 2 0 0 1 -2 2h-5a2 2 0 0 1 -2 -2z"/>'),
  'send-backward': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 12m0 2a2 2 0 0 1 2 -2h5a2 2 0 0 1 2 2v5a2 2 0 0 1 -2 2h-5a2 2 0 0 1 -2 -2z"/><path d="M12 5m0 2a2 2 0 0 1 2 -2h5a2 2 0 0 1 2 2v5a2 2 0 0 1 -2 2h-5a2 2 0 0 1 -2 -2z"/><path d="M12 12l0 3a2 2 0 0 1 -2 2h-3"/>'),

  // Other
  'trash': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 7l16 0"/><path d="M10 11l0 6"/><path d="M14 11l0 6"/><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"/><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"/>'),
  'layers-subtract': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M8 4m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z"/><path d="M16 16v2a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2v-8a2 2 0 0 1 2 -2h2"/>'),
  'scissors': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 7m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M6 17m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M8.6 8.6l10.4 10.4"/><path d="M8.6 15.4l10.4 -10.4"/>'),
  'sun-moon': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9.173 14.83a4 4 0 1 1 5.657 -5.657"/><path d="M11.294 12.707l.174 .247a7.5 7.5 0 0 0 8.845 2.492a9 9 0 0 1 -14.671 2.914"/><path d="M3 12h1"/><path d="M12 3v1"/><path d="M5.6 5.6l.7 .7"/><path d="M3 21l18 -18"/>'),
  'percentage': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M17 17m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M7 7m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M6 18l12 -12"/>'),
  'adjustments-horizontal': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M14 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M4 6l8 0"/><path d="M16 6l4 0"/><path d="M8 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M4 12l2 0"/><path d="M10 12l10 0"/><path d="M17 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M4 18l11 0"/><path d="M19 18l1 0"/>'),
  'library': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 3m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z"/><path d="M4.012 7.26a2.005 2.005 0 0 0 -1.012 1.737v10c0 1.1 .9 2 2 2h10c.75 0 1.158 -.385 1.5 -1"/><path d="M11 10h6"/><path d="M11 14h3"/>'),
  'database': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 6m-8 0a8 3 0 1 0 16 0a8 3 0 1 0 -16 0"/><path d="M4 6v6a8 3 0 0 0 16 0v-6"/><path d="M4 12v6a8 3 0 0 0 16 0v-6"/>'),
  'box': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9l8 -4.5"/><path d="M12 12l8 -4.5"/><path d="M12 12l0 9"/><path d="M12 12l-8 -4.5"/>'),
  'brand-figma': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M15 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M6 3m0 3a3 3 0 0 1 3 -3h6a3 3 0 0 1 3 3v0a3 3 0 0 1 -3 3h-6a3 3 0 0 1 -3 -3z"/><path d="M9 9a3 3 0 0 0 0 6h3m-3 0a3 3 0 1 0 3 3v-15"/>'),
  'device-floppy': createIcon('<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2"/><path d="M12 14m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M14 4l0 4l-6 0l0 -4"/>'),
} as const;

export type IconName = keyof typeof ICONS;

/**
 * Get an SVG icon string by name
 * Returns undefined if icon doesn't exist
 */
export function getIcon(name: string): string | undefined {
  return ICONS[name as IconName];
}

/**
 * Get an SVG icon string by name with custom opacity
 * Used for the first search result which should be more prominent (80% opacity)
 */
export function getIconWithOpacity(name: string, opacity: number): string | undefined {
  const icon = ICONS[name as IconName];
  if (!icon) return undefined;
  // Replace the default opacity (0.4) with the custom opacity
  return icon.replace(/opacity="0\.4"/, `opacity="${opacity}"`);
}

/**
 * Get an SVG icon string by name with custom color and opacity
 * Used for the first search result to make it stand out with accent color
 */
export function getIconWithColor(name: string, color: string, opacity: number = 1.0): string | undefined {
  const icon = ICONS[name as IconName];
  if (!icon) return undefined;
  // Replace stroke color and opacity
  return icon
    .replace(/stroke="currentColor"/, `stroke="${color}"`)
    .replace(/opacity="0\.4"/, `opacity="${opacity}"`);
}

