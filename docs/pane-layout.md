# Pane layout

Splits are stored as an n-ary tree and laid out by a pure function. All of it lives in `src/layout/paneTree.ts`, with no React, so it can be reasoned about (and tested) on its own.

## The tree

```ts
type PaneNode =
  | { kind: 'leaf'; id: string }
  | { kind: 'split'; axis: 'row' | 'column'; children: PaneNode[]; sizes: number[] };
```

- A **leaf** is a terminal pane.
- A **split** divides its rectangle among its children: `row` places them side by side (cutting along x), `column` stacks them (cutting along y).
- `sizes[i]` is the fraction of the split that `children[i]` gets. Sizes belong to the slot in the parent, not to the child.

```
row [0.5, 0.5]            ┌──────┬──────┐
├── A                     │      │  B   │
└── column [0.5, 0.5]     │  A   ├──────┤
    ├── B                 │      │  C   │
    └── C                 └──────┴──────┘
```

### Invariants

Every operation keeps these true:

1. A split has at least 2 children.
2. A split's sizes are all positive, one per child, and sum to 1.
3. A split never has a child split with the same axis.
4. Each pane id appears once.

`normalize` restores 1 and 3 after a change: a split with one child is replaced by that child, and a child split with its parent's axis is merged into the parent.

## Layout

`computeLayout(root, bounds)` returns a rectangle for every pane and every divider. For a split with `k` children along a line that starts at `S` and is `T` long, with divider thickness `d`:

```
available = T − d·(k − 1)
edgeᵢ     = round(available · (f₀ + … + fᵢ))        (the last edge is exactly `available`)
lengthᵢ   = edgeᵢ − edgeᵢ₋₁                          (edge₋₁ = 0)
startᵢ    = S + edgeᵢ₋₁ + d·i
```

Rounding the cumulative **edges** rather than each length means the pieces always add up to exactly `available`, so there are never 1px gaps. The other axis is copied unchanged, and each child is laid out recursively in its piece.

A pane's area is the window's area times the product of the fractions on its path from the root.

## Operations

| Function | What it does |
|---|---|
| `splitPane(root, id, newId, direction)` | If the pane's parent already cuts along that axis, the new pane becomes a sibling and the pane's fraction is halved. Otherwise the pane is wrapped in a new split `[pane, new]` at `[½, ½]`. |
| `closePane(root, id)` | Removes the pane, gives its fraction to its neighbour, then normalizes. Returns `null` when the last pane closes. |
| `resizeDivider(root, path, index, δ)` | Moves the divider between `children[index]` and `children[index + 1]`: `fᵢ += δ`, `fᵢ₊₁ −= δ`, clamped so neither drops below 10%; a pane already under 10% can grow but not shrink, so a fraction never goes negative. The sum stays 1. |
| `resizePane(root, id, direction)` | Keyboard resize: walks up to the nearest split along that axis and moves the divider beside the pane. |
| `findNeighbour(panes, id, direction)` | Focus movement, done on rectangles: the closest pane in that direction that overlaps on the other axis. |

Because a closed pane hands its fraction to the pane it was split from, splitting and then closing returns the original layout exactly.

Nodes are addressed by **path**: the list of child indices from the root (`[]` is the root, `[1, 0]` is the first child of the second child). Dividers carry their split's path, which is how dragging one finds the sizes to change. A mouse drag of `Δ` pixels becomes `δ = Δ / available`, always measured from where the drag started so the divider never drifts from the pointer.
