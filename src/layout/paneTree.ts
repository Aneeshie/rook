export type Axis = 'row' | 'column' // row = side by side (cuts along x-axis), column = stacked (cuts along y axis)

export type Leaf = { kind: 'leaf', id: string, from?: string } // a pane p: "stop cutting, this piece is a terminal"

export type Split = {
  kind: 'split';
  axis: Axis;
  children: PaneNode[];
  sizes: number[]; // sizes[i] = fᵢ, children[i]'s fraction; f₀ + f₁ + … + fₖ₋₁ = 1
}

export type PaneNode = Leaf | Split;

export type Rect = { x: number; y: number; width: number; height: number; }

export type Divider = {
  path: number[]; // which split this divider belongs to
  index: number; // sits between children[index] and children[index + 1]
  axis: Axis; // the split's axis so the UI knows to use a col-resize or row-resize cursor
  rect: Rect;
  available: number; // the split's `available` pixels, so dragging Δ px means δ = Δ / available
}

export const DIVIDER_SIZE = 4; // d

export type Layout = {
  panes: Map<string, Rect>;
  dividers: Divider[];
}

// L(node, R): give every pane inside node its rectangle, starting from rectangle R
export function computeLayout(root: PaneNode, bounds: Rect): Layout {
  const panes = new Map<string, Rect>();
  const dividers: Divider[] = [];

  const visit = (node: PaneNode, rect: Rect, path: number[]): void => { // node, R = rect
    // leaf rule: L(leaf p, R) = { p gets R }
    if (node.kind === 'leaf') {
      panes.set(node.id, rect);
      return;
    }

    // pick which line of the rectangle to cut, the other one is copied unchanged
    //   row:    S = x, T = width
    //   column: S = y, T = height
    const isRow = node.axis === 'row';
    const start = isRow ? rect.x : rect.y; // S
    const total = isRow ? rect.width : rect.height; // T

    const count = node.children.length; // k

    // take the dividers out before cutting, k children have k − 1 dividers between them
    //   available = T − d × (k − 1)
    const available = total - DIVIDER_SIZE * (count - 1);

    let cumulative = 0; // f₀ + f₁ + … + fᵢ the fractions so far
    let prevEdge = 0; // edgeᵢ₋₁, where the previous piece ended (edge₋₁ = 0)

    node.children.forEach((child, index) => { // index = i
      cumulative += node.sizes[index]; // add fᵢ

      //edgeᵢ = round(available × (f₀ + … + fᵢ))
      // the last edge is basically available so directly write it, since 1/3 + 1/3 + 1/3 can come out as 0.9999999
      const edge = index === count - 1 ? available : Math.round(available * cumulative);

      // lengthᵢ = edgeᵢ − edgeᵢ₋₁
      const length = edge - prevEdge;

      // startᵢ = S + edgeᵢ₋₁ + d × i (piece i has i dividers in front of it)
      const offset = start + prevEdge + DIVIDER_SIZE * index;

      // Rᵢ, cut the chosen line, copy the other one
      const childRect: Rect = isRow
        ? { x: offset, y: rect.y, width: length, height: rect.height } // row: x = startᵢ, width = lengthᵢ
        : { x: rect.x, y: offset, width: rect.width, height: length }; // column: y = startᵢ, height = lengthᵢ

      // recursion: L(childᵢ, Rᵢ)
      visit(child, childRect, [...path, index]);

      //  the divider after piece i starts at startᵢ + lengthᵢ and is d thick
      // (only between pieces, so not after the last one)
      if (index < count - 1) {
        const dividerStart = offset + length;
        dividers.push({
          path,
          index,
          axis: node.axis,
          rect: isRow
            ? { x: dividerStart, y: rect.y, width: DIVIDER_SIZE, height: rect.height }
            : { x: rect.x, y: dividerStart, width: rect.width, height: DIVIDER_SIZE },
          available,
        })
      }

      prevEdge = edge; // this edgeᵢ becomes the next piece's edgeᵢ₋₁
    })
  }

  visit(root, bounds, []); // L(root, window)
  return { panes, dividers };
}

// all pane ids, left to right / top to bottom
export function leaves(node: PaneNode): string[] {
  return node.kind === 'leaf' ? [node.id] : node.children.flatMap(leaves);
}

// path to the pane with this id, eg [1,0 ] null if its not there in the tree
export function findPath(node: PaneNode, id: string): number[] | null {
  if (node.kind === 'leaf') return node.id === id ? [] : null;

  for (let i = 0; i < node.children.length; i++) {
    const rest = findPath(node.children[i], id);
    if (rest) return [i, ...rest]; // found inside child i so the path starts with i
  }
  return null;
}

//follow a path down from the root
export function getNode(node: PaneNode, path: number[]): PaneNode {
  let current = node;
  for (const i of path) {
    if (current.kind === 'leaf') throw new Error('path goes through a leaf');
    current = current.children[i];
  }

  return current;
}

// replace the node at path with update(node), copying only the nodes along the path
export function updateAt(
  node: PaneNode,
  path: number[],
  update: (target: PaneNode) => PaneNode,
): PaneNode {
  if (path.length === 0) return update(node) // we have arrived

  if (node.kind === 'leaf') throw new Error('path goes through a leaf')

  const [i, ...rest] = path;
  const children = [...node.children]; // copy this level
  children[i] = updateAt(children[i], rest, update); // recurse into child i

  return { ...node, children }

}

// split part
// direction gives us -> the axis: left/right means side by side (row), up/down means stacked(col),
// -> which side the new pane goes: right/down means after, left/up means before

// there are two cases 
// case -1 -> the parent already cuts this axis. Add new pane as a sibling and halve the pane's fraction.
// case - 2 -> otherwise (including when pane is the root ) replace the pane with a new split [pane,new], at [0.5,0.5]

// case -1 -> fi -> fi/2, fi/2 (parent has a fraction f0...fk-1 and pane is child i)
// case -2 the pane's slot keeps its fraction fi in the parent, inside the slot there's a new split with [1/2, 1/2]/ Each 
// half is fi * 1/2 of the parent, the same "multiply down the path" rule as before

export type Direction = 'left' | 'right' | 'up' | 'down';

const axisOf = (direction: Direction): Axis =>
  direction === 'left' || direction === 'right' ? 'row' : 'column';

// right/down put the new pane after the current one left/up before it
const isAfter = (direction: Direction) => direction === 'right' || direction === 'down';

export function splitPane(
  root: PaneNode,
  targetId: string,
  newId: string,
  direction: Direction,
): PaneNode {
  const path = findPath(root, targetId)
  if (!path) return root;

  const axis = axisOf(direction);
  const after = isAfter(direction);
  const newLeaf: Leaf = { kind: 'leaf', id: newId, from: targetId };

  //case - 1 add a sibling because parent already cuts along this axis
  if (path.length > 0) {
    const parentPath = path.slice(0, -1); // drop the last index
    const i = path[path.length - 1];      // our position inside the parent
    const parent = getNode(root, parentPath) as Split;

    if (parent.axis === axis) {
      return updateAt(root, parentPath, () => {
        const half = parent.sizes[i] / 2; // fᵢ → fᵢ/2, fᵢ/2

        const children = [...parent.children];
        children.splice(after ? i + 1 : i, 0, newLeaf); // insert next to the pane

        const sizes = [...parent.sizes];
        sizes.splice(i, 1, half, half); // replace fᵢ with two halves

        return { ...parent, children, sizes };
      });
    }


  }
  // case 2 wrap the pane in a new split
  return updateAt(root, path, (target) => ({
    kind: 'split',
    axis,
    children: after ? [target, newLeaf] : [newLeaf, target],
    sizes: [0.5, 0.5],
  }));
}


// normalize and close 
// to close a pane 
// (1) remove it from its parent 
// (2) give its fraction to a nbr; the previous sibling, or the next one if it was first.
// (3) run normalize to clean up the tree

// rule 1 a split with one child becomes that child
// rule 2 a child split with the same axis as its parent gets merged into the parent

export function normalize(node: PaneNode): PaneNode {
  if (node.kind === 'leaf') return node;

  const children: PaneNode[] = [];
  const sizes: number[] = [];

  node.children.forEach((original, i) => {
    const child = normalize(original); // clean up the bottom first

    if (child.kind === 'split' && child.axis === node.axis) {
      // rule 2 the grandchildren move up, each with fᵢ × gⱼ
      child.children.forEach((grandchild, j) => {
        children.push(grandchild);
        sizes.push(node.sizes[i] * child.sizes[j]);
      });
    } else {
      children.push(child);
      sizes.push(node.sizes[i]);
    }
  });

  if (children.length === 1) return children[0]; // rule 1

  return { ...node, children, sizes };
}

// returns null when the last pane is closed
export function closePane(root: PaneNode, id: string): PaneNode | null {
  const path = findPath(root, id);
  if (!path) return root;
  if (path.length === 0) return null; // the root itself is the last pane

  const parentPath = path.slice(0, -1);
  const i = path[path.length - 1];

  const updated = updateAt(root, parentPath, (node) => {
    const parent = node as Split;
    const closing = parent.children[i];
    const origin = closing.kind === 'leaf' && closing.from
      ? parent.children.findIndex((child) => child.kind === 'leaf' && child.id === closing.from)
      : -1;
    const neighbour = origin !== -1 && Math.abs(origin - i) === 1 ? origin : i > 0 ? i - 1 : 1;

    const sizes = [...parent.sizes];
    sizes[neighbour] += sizes[i]; // fⱼ → fⱼ + fᵢ
    sizes.splice(i, 1);           // remove fᵢ

    const children = parent.children.filter((_, j) => j !== i);
    return { ...parent, children, sizes };
  });

  return normalize(updated);
}


// resizing is moving the divider

const MIN_FRACTION = 0.1; // no pane gets smaller than 10% of its split

// move the divider between children[index] and children[index + 1] of the split at `path` by delta
export function resizeDivider(
  root: PaneNode,
  path: number[],
  index: number,
  delta: number,
): PaneNode {
  return updateAt(root, path, (node) => {
    const split = node as Split;
    const sizes = [...split.sizes];

    // clamp δ into [min(0, m − f_index), max(0, f_index+1 − m)]
    const lower = Math.min(0, MIN_FRACTION - sizes[index]);
    const upper = Math.max(0, sizes[index + 1] - MIN_FRACTION);
    const d = Math.max(lower, Math.min(delta, upper));

    sizes[index] += d;
    sizes[index + 1] -= d;
    return { ...split, sizes };
  });
}

// keyboard resize move the nearest divider beside the pane in direction
export function resizePane(
  root: PaneNode,
  id: string,
  direction: Direction,
  step = 0.05,
): PaneNode {
  const path = findPath(root, id);
  if (!path) return root;

  const axis = axisOf(direction);

  // walk up from the pane towards the root, looking for a split along this axis
  for (let level = path.length - 1; level >= 0; level--) {
    const splitPath = path.slice(0, level);
    const split = getNode(root, splitPath) as Split;
    if (split.axis !== axis) continue;

    const i = path[level]; // which child of this split we're inside
    const index = i < split.children.length - 1 ? i : i - 1; // divider after us, or before if we're last
    const delta = isAfter(direction) ? step : -step;

    return resizeDivider(root, splitPath, index, delta);
  }

  return root;
}
// the closest pane in `direction` from `fromId` that shares some length on the other axis
//   gap     = how far past our edge the candidate starts (must be ≥ 0)
//   overlap = how much the two share on the other axis (must be > 0)
// smallest gap wins, ties go to the biggest overlap
export function findNeighbour(
  panes: Map<string, Rect>,
  fromId: string,
  direction: Direction,
): string | null {
  const from = panes.get(fromId);
  if (!from) return null;

  const horizontal = direction === 'left' || direction === 'right';
  let best: { id: string; gap: number; overlap: number } | null = null;

  for (const [id, rect] of panes) {
    if (id === fromId) continue;

    const gap =
      direction === 'right' ? rect.x - (from.x + from.width)
      : direction === 'left' ? from.x - (rect.x + rect.width)
      : direction === 'down' ? rect.y - (from.y + from.height)
      : from.y - (rect.y + rect.height);

    const overlap = horizontal
      ? Math.min(from.y + from.height, rect.y + rect.height) - Math.max(from.y, rect.y)
      : Math.min(from.x + from.width, rect.x + rect.width) - Math.max(from.x, rect.x);

    if (gap < 0 || overlap <= 0) continue;

    if (!best || gap < best.gap || (gap === best.gap && overlap > best.overlap)) {
      best = { id, gap, overlap };
    }
  }

  return best?.id ?? null;
}
