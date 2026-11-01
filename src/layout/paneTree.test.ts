import { describe, expect, test } from 'bun:test';
import {
  DIVIDER_SIZE,
  closePane,
  computeLayout,
  findNeighbour,
  findPath,
  leaves,
  normalize,
  resizeDivider,
  resizePane,
  splitPane,
} from './paneTree';
import type { PaneNode, Rect, Split } from './paneTree';

const leaf = (id: string, from?: string): PaneNode => (from ? { kind: 'leaf', id, from } : { kind: 'leaf', id });
const split = (axis: Split['axis'], children: PaneNode[], sizes?: number[]): PaneNode => ({
  kind: 'split',
  axis,
  children,
  sizes: sizes ?? children.map(() => 1 / children.length),
});

const WINDOW: Rect = { x: 0, y: 0, width: 1000, height: 600 };

const expectValid = (root: PaneNode) => {
  const visit = (node: PaneNode, parentAxis?: Split['axis']) => {
    if (node.kind === 'leaf') return;
    expect(node.children.length).toBeGreaterThanOrEqual(2);
    expect(node.sizes.length).toBe(node.children.length);
    for (const size of node.sizes) expect(size).toBeGreaterThan(0);
    expect(node.sizes.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    expect(node.axis).not.toBe(parentAxis);
    node.children.forEach((child) => visit(child, node.axis));
  };
  visit(root);

  const ids = leaves(root);
  expect(new Set(ids).size).toBe(ids.length);
};

describe('computeLayout', () => {
  test('a single pane fills the window', () => {
    const { panes, dividers } = computeLayout(leaf('a'), WINDOW);
    expect(panes.get('a')).toEqual(WINDOW);
    expect(dividers).toEqual([]);
  });

  test('a row cuts along x and leaves room for the divider', () => {
    const { panes, dividers } = computeLayout(split('row', [leaf('a'), leaf('b')]), WINDOW);
    const available = WINDOW.width - DIVIDER_SIZE;

    expect(panes.get('a')).toEqual({ x: 0, y: 0, width: available / 2, height: 600 });
    expect(panes.get('b')).toEqual({ x: available / 2 + DIVIDER_SIZE, y: 0, width: available / 2, height: 600 });
    expect(dividers).toHaveLength(1);
    expect(dividers[0]).toMatchObject({ path: [], index: 0, axis: 'row', available });
    expect(dividers[0].rect).toEqual({ x: available / 2, y: 0, width: DIVIDER_SIZE, height: 600 });
  });

  test('a column cuts along y', () => {
    const { panes } = computeLayout(split('column', [leaf('a'), leaf('b')]), WINDOW);
    expect(panes.get('a')).toMatchObject({ x: 0, width: 1000, y: 0 });
    expect(panes.get('b')!.y).toBe(panes.get('a')!.height + DIVIDER_SIZE);
  });

  test('pieces and dividers add up exactly, with no 1px gaps from rounding', () => {
    const root = split('row', [leaf('a'), leaf('b'), leaf('c')]);
    const bounds = { x: 10, y: 0, width: 1001, height: 600 };
    const { panes } = computeLayout(root, bounds);

    const widths = ['a', 'b', 'c'].map((id) => panes.get(id)!.width);
    for (const width of widths) expect(Number.isInteger(width)).toBe(true);
    expect(widths.reduce((a, b) => a + b, 0) + 2 * DIVIDER_SIZE).toBe(bounds.width);

    const c = panes.get('c')!;
    expect(c.x + c.width).toBe(bounds.x + bounds.width);
  });

  test('nested splits get their parent piece, and dividers carry their split path', () => {
    const root = split('row', [leaf('a'), split('column', [leaf('b'), leaf('c')])]);
    const { panes, dividers } = computeLayout(root, WINDOW);

    const b = panes.get('b')!;
    const c = panes.get('c')!;
    expect(b.x).toBe(c.x);
    expect(b.width).toBe(c.width);
    expect(b.height + DIVIDER_SIZE + c.height).toBe(WINDOW.height);
    expect(dividers.map((d) => d.path)).toEqual([[], [1]]);
  });
});

describe('findPath', () => {
  const root = split('row', [leaf('a'), split('column', [leaf('b'), leaf('c')])]);

  test('returns child indices from the root', () => {
    expect(findPath(root, 'a')).toEqual([0]);
    expect(findPath(root, 'c')).toEqual([1, 1]);
    expect(findPath(leaf('a'), 'a')).toEqual([]);
  });

  test('returns null for a missing pane', () => {
    expect(findPath(root, 'nope')).toBeNull();
  });
});

describe('splitPane', () => {
  test('wraps a lone pane in a new split, new pane after for right/down', () => {
    expect(splitPane(leaf('a'), 'a', 'b', 'right')).toEqual(split('row', [leaf('a'), leaf('b', 'a')], [0.5, 0.5]));
    expect(splitPane(leaf('a'), 'a', 'b', 'down')).toEqual(split('column', [leaf('a'), leaf('b', 'a')], [0.5, 0.5]));
  });

  test('puts the new pane before for left/up', () => {
    expect(splitPane(leaf('a'), 'a', 'b', 'left')).toEqual(split('row', [leaf('b', 'a'), leaf('a')], [0.5, 0.5]));
    expect(splitPane(leaf('a'), 'a', 'b', 'up')).toEqual(split('column', [leaf('b', 'a'), leaf('a')], [0.5, 0.5]));
  });

  test('along the parent axis it adds a sibling and halves the pane', () => {
    const root = split('row', [leaf('a'), leaf('b')], [0.6, 0.4]);
    const result = splitPane(root, 'b', 'c', 'right') as Split;

    expect(leaves(result)).toEqual(['a', 'b', 'c']);
    expect(result.sizes[0]).toBeCloseTo(0.6);
    expect(result.sizes[1]).toBeCloseTo(0.2);
    expect(result.sizes[2]).toBeCloseTo(0.2);
    expectValid(result);
  });

  test('across the parent axis it nests a split', () => {
    const root = split('row', [leaf('a'), leaf('b')]);
    const result = splitPane(root, 'b', 'c', 'down');
    expect(result).toEqual(split('row', [leaf('a'), split('column', [leaf('b'), leaf('c', 'b')], [0.5, 0.5])]));
    expectValid(result);
  });

  test('leaves the tree alone for an unknown pane', () => {
    const root = split('row', [leaf('a'), leaf('b')]);
    expect(splitPane(root, 'nope', 'c', 'right')).toBe(root);
  });

  test('does not mutate the original tree', () => {
    const root = split('row', [leaf('a'), leaf('b')]);
    const before = structuredClone(root);
    splitPane(root, 'a', 'c', 'right');
    expect(root).toEqual(before);
  });
});

describe('closePane', () => {
  test('closing the last pane returns null', () => {
    expect(closePane(leaf('a'), 'a')).toBeNull();
  });

  test('a split left with one child collapses into it', () => {
    expect(closePane(split('row', [leaf('a'), leaf('b')]), 'b')).toEqual(leaf('a'));
  });

  test('the fraction goes to the previous sibling, or the next one if first', () => {
    const root = split('row', [leaf('a'), leaf('b'), leaf('c')], [0.2, 0.3, 0.5]);

    const withoutB = closePane(root, 'b') as Split;
    expect(leaves(withoutB)).toEqual(['a', 'c']);
    expect(withoutB.sizes[0]).toBeCloseTo(0.5);
    expect(withoutB.sizes[1]).toBeCloseTo(0.5);

    const withoutA = closePane(root, 'a') as Split;
    expect(withoutA.sizes[0]).toBeCloseTo(0.5);
    expect(withoutA.sizes[1]).toBeCloseTo(0.5);
  });

  test('merges a child split into a parent with the same axis', () => {
    const root = split('row', [leaf('a'), split('column', [leaf('b'), split('row', [leaf('c'), leaf('d')])])]);
    const result = closePane(root, 'b') as Split;

    expect(result.axis).toBe('row');
    expect(leaves(result)).toEqual(['a', 'c', 'd']);
    expect(result.sizes[1]).toBeCloseTo(0.25);
    expect(result.sizes[2]).toBeCloseTo(0.25);
    expectValid(result);
  });

  test('splitting and then closing restores the original layout', () => {
    const root = split('row', [leaf('a'), split('column', [leaf('b'), leaf('c')], [0.3, 0.7])], [0.4, 0.6]);
    for (const direction of ['left', 'right', 'up', 'down'] as const) {
      const reopened = closePane(splitPane(root, 'c', 'x', direction), 'x')!;
      expect(computeLayout(reopened, WINDOW).panes).toEqual(computeLayout(root, WINDOW).panes);
    }
  });

  test('leaves the tree alone for an unknown pane', () => {
    const root = split('row', [leaf('a'), leaf('b')]);
    expect(closePane(root, 'nope')).toBe(root);
  });
});

describe('normalize', () => {
  test('keeps fractions when merging, as parent × child', () => {
    const root = split('row', [leaf('a'), split('row', [leaf('b'), leaf('c')], [0.25, 0.75])], [0.6, 0.4]);
    const result = normalize(root) as Split;
    expect(leaves(result)).toEqual(['a', 'b', 'c']);
    expect(result.sizes[1]).toBeCloseTo(0.1);
    expect(result.sizes[2]).toBeCloseTo(0.3);
  });
});

describe('resizeDivider', () => {
  const root = split('row', [leaf('a'), leaf('b')], [0.5, 0.5]);

  test('moves size from one side of the divider to the other', () => {
    const result = resizeDivider(root, [], 0, 0.1) as Split;
    expect(result.sizes[0]).toBeCloseTo(0.6);
    expect(result.sizes[1]).toBeCloseTo(0.4);
  });

  test('clamps so neither pane goes below 10%', () => {
    const grown = resizeDivider(root, [], 0, 0.9) as Split;
    expect(grown.sizes[0]).toBeCloseTo(0.9);
    expect(grown.sizes[1]).toBeCloseTo(0.1);

    const shrunk = resizeDivider(root, [], 0, -0.9) as Split;
    expect(shrunk.sizes[0]).toBeCloseTo(0.1);
    expect(shrunk.sizes[1]).toBeCloseTo(0.9);
  });

  test('changes only the split at the path', () => {
    const nested = split('row', [leaf('a'), split('column', [leaf('b'), leaf('c')])], [0.5, 0.5]);
    const result = resizeDivider(nested, [1], 0, 0.2) as Split;
    expect(result.sizes).toEqual([0.5, 0.5]);
    expect((result.children[1] as Split).sizes[0]).toBeCloseTo(0.7);
    expectValid(result);
  });
});

describe('resizePane', () => {
  test('uses the nearest split along the direction', () => {
    const root = split('row', [leaf('a'), split('column', [leaf('b'), leaf('c')])], [0.5, 0.5]);
    const result = resizePane(root, 'c', 'left') as Split;
    expect(result.sizes[0]).toBeCloseTo(0.45);
    expect((result.children[1] as Split).sizes).toEqual([0.5, 0.5]);
  });

  test('the last pane moves the divider before it', () => {
    const root = split('row', [leaf('a'), leaf('b')], [0.5, 0.5]);
    expect((resizePane(root, 'b', 'right') as Split).sizes[0]).toBeCloseTo(0.55);
  });

  test('does nothing without a split along that axis', () => {
    const root = split('row', [leaf('a'), leaf('b')]);
    expect(resizePane(root, 'a', 'up')).toBe(root);
  });
});

describe('findNeighbour', () => {
  const { panes } = computeLayout(split('row', [leaf('a'), split('column', [leaf('b'), leaf('c')])]), WINDOW);

  test('finds the pane in each direction', () => {
    expect(findNeighbour(panes, 'b', 'down')).toBe('c');
    expect(findNeighbour(panes, 'c', 'up')).toBe('b');
    expect(findNeighbour(panes, 'b', 'left')).toBe('a');
  });

  test('ties on distance go to the biggest overlap', () => {
    const lopsided = computeLayout(
      split('row', [leaf('a'), split('column', [leaf('b'), leaf('c')], [0.2, 0.8])]),
      WINDOW,
    ).panes;
    expect(findNeighbour(lopsided, 'a', 'right')).toBe('c');
  });

  test('returns null at the edge or for an unknown pane', () => {
    expect(findNeighbour(panes, 'a', 'left')).toBeNull();
    expect(findNeighbour(panes, 'b', 'up')).toBeNull();
    expect(findNeighbour(panes, 'nope', 'up')).toBeNull();
  });
});

describe('invariants under random operations', () => {
  const random = (seed: number) => () => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return seed / 2 ** 31;
  };

  test('hold after 500 random splits, closes and resizes', () => {
    const next = random(42);
    const directions = ['left', 'right', 'up', 'down'] as const;
    const pick = <T,>(items: readonly T[]) => items[Math.floor(next() * items.length)];

    let root: PaneNode = leaf('p0');
    let counter = 1;

    for (let step = 0; step < 500; step++) {
      const ids = leaves(root);
      const target = pick(ids);
      const roll = next();

      if ((roll < 0.5 || ids.length === 1) && ids.length < 16) {
        root = splitPane(root, target, `p${counter++}`, pick(directions));
      } else if (roll < 0.8) {
        root = closePane(root, target)!;
      } else {
        root = resizePane(root, target, pick(directions), next() * 0.3);
      }

      expectValid(root);

      const { panes } = computeLayout(root, WINDOW);
      expect(panes.size).toBe(leaves(root).length);
      for (const rect of panes.values()) {
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.y).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width).toBeLessThanOrEqual(WINDOW.width);
        expect(rect.y + rect.height).toBeLessThanOrEqual(WINDOW.height);
      }
    }
  });
});
