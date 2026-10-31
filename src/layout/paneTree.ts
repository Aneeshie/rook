export type Axis = 'row' | 'column' // row = side by side (cuts along x-axis), column = stacked (cuts along y axis)

export type Leaf = { kind: 'leaf', id: string } // a pane p: "stop cutting, this piece is a terminal"

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
        })
      }

      prevEdge = edge; // this edgeᵢ becomes the next piece's edgeᵢ₋₁
    })
  }

  visit(root, bounds, []); // L(root, window)
  return { panes, dividers };
}
