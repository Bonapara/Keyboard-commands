// ================================
// Layout Functions
// ================================

import type { NumberResolution } from '../types';
import { clearNodeBoundVariables, resolveDelta, resolveNumberValue, resolveNumberVariable, setNodeBoundVariable } from '../utils';

type ConvertibleAutoLayoutNode = FrameNode | ComponentNode;
type PositionedSceneNode = SceneNode & {
  x: number;
  y: number;
  width: number;
  height: number;
};

type WrapTrack = {
  nodes: PositionedSceneNode[];
  minCross: number;
  maxCross: number;
};

function isConvertibleAutoLayoutNode(node: SceneNode): node is ConvertibleAutoLayoutNode {
  return node.type === 'FRAME' || node.type === 'COMPONENT';
}

function isPositionedSceneNode(node: SceneNode): node is PositionedSceneNode {
  return 'x' in node && 'y' in node && 'width' in node && 'height' in node;
}

function sortNodesForAutoLayout<T extends SceneNode>(nodes: T[], direction: 'HORIZONTAL' | 'VERTICAL') {
  return [...nodes].sort((a, b) => {
    if (direction === 'HORIZONTAL') {
      return a.x - b.x;
    }

    return a.y - b.y;
  });
}

function inferAutoLayoutSpacing(nodes: SceneNode[], direction: 'HORIZONTAL' | 'VERTICAL') {
  if (nodes.length < 2) {
    return 0;
  }

  if (direction === 'HORIZONTAL') {
    return nodes[1].x - (nodes[0].x + nodes[0].width);
  }

  return nodes[1].y - (nodes[0].y + nodes[0].height);
}

function getPrimaryStart(node: PositionedSceneNode, direction: 'HORIZONTAL' | 'VERTICAL') {
  return direction === 'HORIZONTAL' ? node.x : node.y;
}

function getPrimarySize(node: PositionedSceneNode, direction: 'HORIZONTAL' | 'VERTICAL') {
  return direction === 'HORIZONTAL' ? node.width : node.height;
}

function setPrimaryStart(node: PositionedSceneNode, direction: 'HORIZONTAL' | 'VERTICAL', value: number) {
  if (direction === 'HORIZONTAL') {
    node.x = value;
  } else {
    node.y = value;
  }
}

function getCrossStart(node: PositionedSceneNode, direction: 'HORIZONTAL' | 'VERTICAL') {
  return direction === 'HORIZONTAL' ? node.y : node.x;
}

function getCrossEnd(node: PositionedSceneNode, direction: 'HORIZONTAL' | 'VERTICAL') {
  return getCrossStart(node, direction) + (direction === 'HORIZONTAL' ? node.height : node.width);
}

function getOppositeDirection(direction: 'HORIZONTAL' | 'VERTICAL') {
  return direction === 'HORIZONTAL' ? 'VERTICAL' : 'HORIZONTAL';
}

function intervalsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return Math.min(aEnd, bEnd) > Math.max(aStart, bStart);
}

function buildWrapTracks(nodes: PositionedSceneNode[], direction: 'HORIZONTAL' | 'VERTICAL') {
  const sorted = [...nodes].sort((a, b) => {
    const crossDelta = getCrossStart(a, direction) - getCrossStart(b, direction);
    if (crossDelta !== 0) {
      return crossDelta;
    }

    return getPrimaryStart(a, direction) - getPrimaryStart(b, direction);
  });

  const tracks: WrapTrack[] = [];

  for (const node of sorted) {
    const nodeCrossStart = getCrossStart(node, direction);
    const nodeCrossEnd = getCrossEnd(node, direction);
    const matchingTrack = tracks.find(track =>
      intervalsOverlap(nodeCrossStart, nodeCrossEnd, track.minCross, track.maxCross)
    );

    if (!matchingTrack) {
      tracks.push({
        nodes: [node],
        minCross: nodeCrossStart,
        maxCross: nodeCrossEnd,
      });
      continue;
    }

    matchingTrack.nodes.push(node);
    matchingTrack.minCross = Math.min(matchingTrack.minCross, nodeCrossStart);
    matchingTrack.maxCross = Math.max(matchingTrack.maxCross, nodeCrossEnd);
  }

  tracks.sort((a, b) => a.minCross - b.minCross);
  for (const track of tracks) {
    track.nodes.sort((a, b) => getPrimaryStart(a, direction) - getPrimaryStart(b, direction));
  }

  return tracks;
}

function repositionNodesAlongPrimary(nodes: PositionedSceneNode[], direction: 'HORIZONTAL' | 'VERTICAL', gap: number) {
  if (nodes.length === 0) {
    return;
  }

  let cursor = getPrimaryStart(nodes[0], direction);
  for (const node of nodes) {
    setPrimaryStart(node, direction, cursor);
    cursor += getPrimarySize(node, direction) + gap;
  }
}

function getTrackStart(track: WrapTrack, direction: 'HORIZONTAL' | 'VERTICAL') {
  return Math.min(...track.nodes.map(node => getPrimaryStart(node, direction)));
}

function getTrackSize(track: WrapTrack, direction: 'HORIZONTAL' | 'VERTICAL') {
  return Math.max(...track.nodes.map(node => getPrimarySize(node, direction)));
}

function collectTrackGaps(tracks: WrapTrack[], direction: 'HORIZONTAL' | 'VERTICAL') {
  const sortedTracks = [...tracks].sort((a, b) => getTrackStart(a, direction) - getTrackStart(b, direction));
  const gaps: number[] = [];

  for (let index = 1; index < sortedTracks.length; index += 1) {
    gaps.push(
      getTrackStart(sortedTracks[index], direction) -
      (getTrackStart(sortedTracks[index - 1], direction) + getTrackSize(sortedTracks[index - 1], direction))
    );
  }

  return gaps;
}

function repositionTracksAlongAxis(tracks: WrapTrack[], direction: 'HORIZONTAL' | 'VERTICAL', gap: number) {
  if (tracks.length === 0) {
    return;
  }

  const sortedTracks = [...tracks].sort((a, b) => getTrackStart(a, direction) - getTrackStart(b, direction));
  let cursor = getTrackStart(sortedTracks[0], direction);

  for (const track of sortedTracks) {
    for (const node of track.nodes) {
      setPrimaryStart(node, direction, cursor);
    }

    cursor += getTrackSize(track, direction) + gap;
  }
}

function collectPrimaryGaps(nodes: PositionedSceneNode[], direction: 'HORIZONTAL' | 'VERTICAL') {
  const gaps: number[] = [];
  const sortedNodes = sortNodesForAutoLayout(nodes, direction);

  for (let index = 1; index < sortedNodes.length; index += 1) {
    gaps.push(
      getPrimaryStart(sortedNodes[index], direction) -
      (getPrimaryStart(sortedNodes[index - 1], direction) + getPrimarySize(sortedNodes[index - 1], direction))
    );
  }

  return gaps;
}

function getDominantGap(gaps: number[]) {
  if (gaps.length === 0) {
    return 0;
  }

  const counts = new Map<string, { value: number; count: number }>();
  for (const gap of gaps) {
    const normalized = Math.round(gap * 1000) / 1000;
    const key = normalized.toString();
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, { value: normalized, count: 1 });
    }
  }

  let winner = counts.values().next().value as { value: number; count: number };
  for (const candidate of counts.values()) {
    if (candidate.count > winner.count) {
      winner = candidate;
    }
  }

  return winner.value;
}

function applyGapToInferredLayout(
  node: FrameNode,
  gap: string | undefined,
  resolution: NumberResolution,
  axis: 'PRIMARY' | 'COUNTER'
) {
  const inferred = node.inferredAutoLayout;
  if (!inferred || inferred.layoutMode === 'NONE') {
    return false;
  }

  const children = node.children.filter(isPositionedSceneNode);
  if (children.length < 2) {
    figma.notify('Inferred layout needs at least 2 child layers');
    return true;
  }

  if (resolution.type === 'variable') {
    figma.notify('Variables are not supported on tidy / smart selection gaps');
    return true;
  }

  const direction = inferred.layoutMode;
  const counterDirection = getOppositeDirection(direction);

  if (axis === 'PRIMARY') {
    const lineTracks = buildWrapTracks(children, direction);
    const axisTracks = buildWrapTracks(children, counterDirection);
    const isGridLike = inferred.layoutWrap === 'WRAP' && lineTracks.length > 1 && axisTracks.length > 1;

    if (isGridLike) {
      const dominant = getDominantGap(collectTrackGaps(axisTracks, direction));
      const current = typeof inferred.itemSpacing === 'number'
        ? inferred.itemSpacing
        : dominant;
      const next = gap === undefined
        ? Math.max(0, dominant)
        : Math.max(0, resolveDelta(gap, current));
      repositionTracksAlongAxis(axisTracks, direction, next);
      figma.notify(`Tidy gap set to ${next}`);
      return true;
    }

    const sortedChildren = sortNodesForAutoLayout(children, direction);
    const dominant = getDominantGap(collectPrimaryGaps(sortedChildren, direction));
    const current = typeof inferred.itemSpacing === 'number'
      ? inferred.itemSpacing
      : inferAutoLayoutSpacing(sortedChildren, direction);
    const next = gap === undefined
      ? Math.max(0, dominant)
      : Math.max(0, resolveDelta(gap, current));
    repositionNodesAlongPrimary(sortedChildren, direction, next);
    figma.notify(`Tidy gap set to ${next}`);
    return true;
  }

  if (inferred.layoutWrap !== 'WRAP') {
    figma.notify('Selected frame must have an inferred wrap layout');
    return true;
  }

  const lineTracks = buildWrapTracks(children, direction);
  if (lineTracks.length < 2) {
    figma.notify('Inferred wrap layout needs at least 2 tracks');
    return true;
  }

  const current = typeof inferred.counterAxisSpacing === 'number'
    ? inferred.counterAxisSpacing
    : getDominantGap(collectTrackGaps(lineTracks, counterDirection));
  const next = Math.max(0, resolveDelta(gap, current));
  repositionTracksAlongAxis(lineTracks, counterDirection, next);
  figma.notify(`Tidy row gap set to ${gap}`);
  return true;
}

function inferTidyArrangement(nodes: PositionedSceneNode[]) {
  const horizontalTracks = buildWrapTracks(nodes, 'HORIZONTAL');
  const verticalTracks = buildWrapTracks(nodes, 'VERTICAL');

  let direction: 'HORIZONTAL' | 'VERTICAL';
  if (horizontalTracks.length < verticalTracks.length) {
    direction = 'HORIZONTAL';
  } else if (verticalTracks.length < horizontalTracks.length) {
    direction = 'VERTICAL';
  } else {
    direction = 'HORIZONTAL';
  }

  return {
    direction,
    lineTracks: direction === 'HORIZONTAL' ? horizontalTracks : verticalTracks,
    axisTracks: direction === 'HORIZONTAL' ? verticalTracks : horizontalTracks,
  };
}

function applyGapToSelection(
  nodes: PositionedSceneNode[],
  gap: string | undefined,
  axis: 'PRIMARY' | 'COUNTER'
) {
  if (nodes.length < 2) {
    figma.notify('Tidy selection needs at least 2 layers');
    return;
  }

  const { direction, lineTracks, axisTracks } = inferTidyArrangement(nodes);
  const counterDirection = getOppositeDirection(direction);
  const isGridLike = lineTracks.length > 1 && axisTracks.length > 1;

  if (axis === 'PRIMARY') {
    if (!isGridLike) {
      const sortedNodes = sortNodesForAutoLayout(nodes, direction);
      const dominant = getDominantGap(collectPrimaryGaps(sortedNodes, direction));
      const current = inferAutoLayoutSpacing(sortedNodes, direction);
      const next = gap === undefined
        ? Math.max(0, dominant)
        : Math.max(0, resolveDelta(gap, current));
      repositionNodesAlongPrimary(sortedNodes, direction, next);
      figma.notify(`Tidy gap set to ${next}`);
      return;
    }

    const dominant = getDominantGap(collectTrackGaps(axisTracks, direction));
    const next = gap === undefined
      ? Math.max(0, dominant)
      : Math.max(0, resolveDelta(gap, dominant));
    repositionTracksAlongAxis(axisTracks, direction, next);
    figma.notify(`Tidy gap set to ${next}`);
    return;
  }

  if (lineTracks.length < 2) {
    figma.notify('Tidy selection needs at least 2 rows or columns');
    return;
  }

  const current = getDominantGap(collectTrackGaps(lineTracks, counterDirection));
  const next = Math.max(0, resolveDelta(gap, current));
  repositionTracksAlongAxis(lineTracks, counterDirection, next);
  figma.notify(`Tidy row gap set to ${gap}`);
}

export function createAutoLayout(direction: 'HORIZONTAL' | 'VERTICAL' = 'HORIZONTAL') {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    throw new Error('No items selected');
  }

  // If the selection is a single group, convert it directly
  if (selection.length === 1 && selection[0].type === 'GROUP') {
    const group = selection[0];
    const parentFrame = group.parent;
    if (!parentFrame) return;

    // Create a new frame with the same size and position as the group
    const frame = figma.createFrame();
    frame.x = group.x;
    frame.y = group.y;
    frame.resize(group.width, group.height);
    frame.layoutMode = direction;
    frame.primaryAxisSizingMode = 'AUTO';
    frame.counterAxisSizingMode = 'AUTO';
    frame.fills = []; // Remove default white background
    frame.paddingLeft = 0;
    frame.paddingRight = 0;
    frame.paddingTop = 0;
    frame.paddingBottom = 0;

    const sortedChildren = sortNodesForAutoLayout([...group.children], direction);
    frame.itemSpacing = Math.max(0, inferAutoLayoutSpacing(sortedChildren, direction));

    // Add the frame to the parent
    parentFrame.appendChild(frame);

    // Move all children from group to the new frame
    sortedChildren.forEach(child => {
      frame.appendChild(child);
    });

    // Select the new frame
    figma.currentPage.selection = [frame];
    figma.notify(`Group converted to ${direction.toLowerCase()} auto-layout frame`);
    return;
  }

  if (selection.length === 1 && isConvertibleAutoLayoutNode(selection[0])) {
    const frame = selection[0];
    const sortedChildren = sortNodesForAutoLayout([...frame.children], direction);
    frame.itemSpacing = Math.max(0, inferAutoLayoutSpacing(sortedChildren, direction));

    sortedChildren.forEach((child, index) => {
      frame.insertChild(index, child);
    });

    frame.layoutMode = direction;
    figma.currentPage.selection = [frame];
    figma.notify(`Selected frame converted to ${direction.toLowerCase()} auto-layout`);
    return;
  }

  // Original code for multiple selections or non-group selections
  const parentFrame = selection[0].parent;
  if (!parentFrame) return;

  const firstNodeX = selection[0].x;
  const firstNodeY = selection[0].y;

  const sortedSelection = sortNodesForAutoLayout([...selection], direction);
  const spacing = inferAutoLayoutSpacing(sortedSelection, direction);

  const frame = figma.createFrame();
  frame.layoutMode = direction;
  frame.primaryAxisSizingMode = 'AUTO';
  frame.counterAxisSizingMode = 'AUTO';
  frame.fills = [];
  frame.paddingLeft = 0;
  frame.paddingRight = 0;
  frame.paddingTop = 0;
  frame.paddingBottom = 0;
  frame.itemSpacing = Math.max(0, spacing);

  parentFrame.appendChild(frame);
  frame.x = firstNodeX;
  frame.y = firstNodeY;

  sortedSelection.forEach(node => {
    frame.appendChild(node);
  });

  figma.currentPage.selection = [frame];
  figma.notify(`Auto-layout frame created in ${direction.toLowerCase()} direction`);
}

export async function setPadding({ paddingLeft, paddingRight, paddingTop, paddingBottom }: {
  paddingLeft?: string;
  paddingRight?: string;
  paddingTop?: string;
  paddingBottom?: string;
}) {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    throw new Error('No items selected');
  }

  const resolutions = {
    paddingLeft: paddingLeft !== undefined ? await resolveNumberValue(paddingLeft) : undefined,
    paddingRight: paddingRight !== undefined ? await resolveNumberValue(paddingRight) : undefined,
    paddingTop: paddingTop !== undefined ? await resolveNumberValue(paddingTop) : undefined,
    paddingBottom: paddingBottom !== undefined ? await resolveNumberValue(paddingBottom) : undefined,
  };

  for (const node of selection) {
    if ('paddingLeft' in node) {
      if (paddingLeft !== undefined) {
        const resolution = resolutions.paddingLeft!;
        if (resolution.type === 'variable') {
          setNodeBoundVariable(node, 'paddingLeft', await resolveNumberVariable(resolution));
        } else {
          clearNodeBoundVariables(node, 'paddingLeft');
          node.paddingLeft = Math.max(0, resolveDelta(paddingLeft, node.paddingLeft));
        }
      }
      if (paddingRight !== undefined) {
        const resolution = resolutions.paddingRight!;
        if (resolution.type === 'variable') {
          setNodeBoundVariable(node, 'paddingRight', await resolveNumberVariable(resolution));
        } else {
          clearNodeBoundVariables(node, 'paddingRight');
          node.paddingRight = Math.max(0, resolveDelta(paddingRight, node.paddingRight));
        }
      }
      if (paddingTop !== undefined) {
        const resolution = resolutions.paddingTop!;
        if (resolution.type === 'variable') {
          setNodeBoundVariable(node, 'paddingTop', await resolveNumberVariable(resolution));
        } else {
          clearNodeBoundVariables(node, 'paddingTop');
          node.paddingTop = Math.max(0, resolveDelta(paddingTop, node.paddingTop));
        }
      }
      if (paddingBottom !== undefined) {
        const resolution = resolutions.paddingBottom!;
        if (resolution.type === 'variable') {
          setNodeBoundVariable(node, 'paddingBottom', await resolveNumberVariable(resolution));
        } else {
          clearNodeBoundVariables(node, 'paddingBottom');
          node.paddingBottom = Math.max(0, resolveDelta(paddingBottom, node.paddingBottom));
        }
      }
    }
  }

  figma.notify('Padding updated for all selected items');
}

export function layoutSizing(direction: 'HORIZONTAL' | 'VERTICAL', value: 'HUG' | 'FIXED' | 'FILL') {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    throw new Error('No items selected');
  }

  selection.forEach(node => {
    const parent = node.parent;
    const parentIsPlainFrame =
      !!parent && 'layoutMode' in parent && parent.layoutMode === 'NONE';

    // If parent is a non-auto-layout frame and FILL is requested,
    // resize the node so it matches the parent's fixed width/height.
    if (value === 'FILL' && parentIsPlainFrame && 'resize' in node && 'width' in parent && 'height' in parent) {
      try {
        const newWidth = direction === 'HORIZONTAL' ? parent.width : node.width;
        const newHeight = direction === 'VERTICAL' ? parent.height : node.height;
        node.resize(newWidth, newHeight);
        figma.notify(
          direction === 'HORIZONTAL' ? 'Width matched to parent' : 'Height matched to parent'
        );
      } catch (error) {
        console.warn('Failed to resize node:', error);
        figma.notify('Failed to resize node');
      }
      return;
    }

    // Handle frames: add auto-layout if needed
    if ('layoutMode' in node) {
      // Enable auto-layout if not already set
      if (node.layoutMode === 'NONE') {
        node.layoutMode = direction;
      }
      try {
        if (direction === 'HORIZONTAL') {
          if ('layoutSizingHorizontal' in node) {
            node.layoutSizingHorizontal = value;
            figma.notify(`Horizontal layout sizing set to ${value.toLowerCase()}`);
          }
        } else {
          if ('layoutSizingVertical' in node) {
            node.layoutSizingVertical = value;
            figma.notify(`Vertical layout sizing set to ${value.toLowerCase()}`);
          }
        }
        return;
      } catch (error) {
        console.warn(`Failed to set layout sizing on node:`, error);
        figma.notify('Failed to set layout sizing');
        return;
      }
    }

    // For non-frames, check if the node is inside an auto-layout frame
    if (!parent || !('layoutMode' in parent) || parent.layoutMode === 'NONE') {
      figma.notify('Selected item must be inside an auto-layout frame');
      return;
    }

    try {
      // Attempt to set the layout sizing directly
      if (direction === 'HORIZONTAL') {
        if ('layoutSizingHorizontal' in node) {
          node.layoutSizingHorizontal = value;
          figma.notify(`Horizontal layout sizing set to ${value.toLowerCase()}`);
        }
      } else {
        if ('layoutSizingVertical' in node) {
          node.layoutSizingVertical = value;
          figma.notify(`Vertical layout sizing set to ${value.toLowerCase()}`);
        }
      }
    } catch (error) {
      console.warn(`Failed to set layout sizing on node:`, error);
      figma.notify('Failed to set layout sizing');
    }
  });
}

// Set primary axis gap (horizontal)
export async function setPrimaryGap(gap: string | 'AUTO') {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    throw new Error('No items selected');
  }

  const resolution = gap === 'AUTO' ? null : await resolveNumberValue(gap);

  for (const node of selection) {
    if (!('layoutMode' in node) || node.layoutMode === 'NONE') {
      figma.notify('Selected node must be an auto-layout');
      continue;
    }

    if (node.layoutMode === 'GRID') {
      if (gap === 'AUTO') {
        figma.notify('Grid layouts require an explicit column gap value');
        continue;
      }

      if (resolution!.type === 'variable') {
        setNodeBoundVariable(node, 'gridColumnGap', await resolveNumberVariable(resolution!));
      } else {
        clearNodeBoundVariables(node, 'gridColumnGap');
        node.gridColumnGap = Math.max(0, resolveDelta(gap, node.gridColumnGap));
      }
      figma.notify(`Grid column gap set to ${gap}`);
      continue;
    }

    if (gap === 'AUTO') {
      clearNodeBoundVariables(node, 'itemSpacing');
      node.primaryAxisAlignItems = 'SPACE_BETWEEN';
      figma.notify('Primary gap set to AUTO');
      continue;
    }

    if (node.primaryAxisAlignItems === 'SPACE_BETWEEN') {
      node.primaryAxisAlignItems = 'MIN';
    }
    if (resolution!.type === 'variable') {
      setNodeBoundVariable(node, 'itemSpacing', await resolveNumberVariable(resolution!));
    } else {
      clearNodeBoundVariables(node, 'itemSpacing');
      node.itemSpacing = Math.max(0, resolveDelta(gap, node.itemSpacing));
    }
    figma.notify(`Primary gap set to ${gap}`);
  }
}

// Set counter axis gap (vertical for wrap layouts)
export async function setCounterGap(gap: string | 'AUTO') {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    throw new Error('No items selected');
  }

  const resolution = gap === 'AUTO' ? null : await resolveNumberValue(gap);

  for (const node of selection) {
    if (!('layoutMode' in node)) {
      figma.notify('Selected node must be a wrap auto-layout or grid layout');
      continue;
    }

    if (node.layoutMode === 'GRID') {
      if (gap === 'AUTO') {
        figma.notify('Grid layouts require an explicit row gap value');
        continue;
      }

      if (resolution!.type === 'variable') {
        setNodeBoundVariable(node, 'gridRowGap', await resolveNumberVariable(resolution!));
      } else {
        clearNodeBoundVariables(node, 'gridRowGap');
        node.gridRowGap = Math.max(0, resolveDelta(gap, node.gridRowGap));
      }
      figma.notify(`Grid row gap set to ${gap}`);
      continue;
    }

    if ('layoutWrap' in node && node.layoutWrap === 'WRAP') {
      if (gap === 'AUTO') {
        clearNodeBoundVariables(node, 'counterAxisSpacing');
        node.counterAxisAlignContent = 'SPACE_BETWEEN';
        figma.notify('Counter gap set to AUTO');
      } else {
        node.counterAxisAlignContent = 'AUTO';
        if (resolution!.type === 'variable') {
          setNodeBoundVariable(node, 'counterAxisSpacing', await resolveNumberVariable(resolution!));
        } else {
          clearNodeBoundVariables(node, 'counterAxisSpacing');
          const current = typeof node.counterAxisSpacing === 'number' ? node.counterAxisSpacing : 0;
          node.counterAxisSpacing = Math.max(0, resolveDelta(gap, current));
        }
        figma.notify(`Counter gap set to ${gap}`);
      }
    } else {
      figma.notify('Selected node must be a wrap auto-layout or grid layout');
    }
  }
}

export async function setTidyGap(gap?: string) {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    throw new Error('No items selected');
  }

  const resolution = gap === undefined
    ? { type: 'literal', value: 0, unit: 'PIXELS' as const }
    : await resolveNumberValue(gap);

  if (selection.length === 1) {
    const [node] = selection;
    if (node.type === 'FRAME' && applyGapToInferredLayout(node, gap, resolution, 'PRIMARY')) {
      return;
    }

    figma.notify('Selected frame must have an inferred row/column layout');
    return;
  }

  if (resolution.type === 'variable') {
    figma.notify('Variables are not supported on tidy / smart selection gaps');
    return;
  }

  const nodes = selection.filter(isPositionedSceneNode);
  if (nodes.length !== selection.length) {
    figma.notify('Tidy selection only supports positionable layers');
    return;
  }

  applyGapToSelection(nodes, gap, 'PRIMARY');
}

export async function setTidyRowGap(gap: string) {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    throw new Error('No items selected');
  }

  const resolution = await resolveNumberValue(gap);

  if (selection.length === 1) {
    const [node] = selection;
    if (node.type === 'FRAME' && applyGapToInferredLayout(node, gap, resolution, 'COUNTER')) {
      return;
    }

    figma.notify('Selected frame must have an inferred wrap layout');
    return;
  }

  if (resolution.type === 'variable') {
    figma.notify('Variables are not supported on tidy / smart selection gaps');
    return;
  }

  const nodes = selection.filter(isPositionedSceneNode);
  if (nodes.length !== selection.length) {
    figma.notify('Tidy selection only supports positionable layers');
    return;
  }

  applyGapToSelection(nodes, gap, 'COUNTER');
}

export function setLayout(mode: 'HORIZONTAL' | 'VERTICAL' | 'WRAP' | 'NONE') {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    throw new Error('No items selected');
  }

  selection.forEach(node => {
    if (node.type === 'FRAME') {
      if (mode === 'WRAP') {
        node.layoutMode = 'HORIZONTAL'; // Set to HORIZONTAL for WRAP
        node.layoutWrap = 'WRAP';
      } else {
        node.layoutMode = mode as 'HORIZONTAL' | 'VERTICAL' | 'NONE';
        node.layoutWrap = 'NO_WRAP';
      }

      figma.notify(`${mode.toLowerCase()} layout applied`);
    } else {
      console.warn('Selected item is not a frame:', node);
    }
  });
}
