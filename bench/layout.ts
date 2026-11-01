import { closePane, computeLayout, leaves, splitPane } from '../src/layout/paneTree';
import type { Direction, PaneNode } from '../src/layout/paneTree';
import { bench } from './harness';

const WINDOW = { x: 0, y: 0, width: 2560, height: 1440 };
const DIRECTIONS: Direction[] = ['right', 'down', 'left', 'up'];

const sixteenPanes = () => {
  let root: PaneNode = { kind: 'leaf', id: 'p0' };
  for (let i = 1; i < 16; i++) {
    const ids = leaves(root);
    root = splitPane(root, ids[(i * 7) % ids.length], `p${i}`, DIRECTIONS[i % 4]);
  }
  return root;
};

export async function layoutBenchmarks() {
  const root = sixteenPanes();
  const ids = leaves(root);
  const BATCH = 1000;

  return [
    await bench(
      'layout: compute 16 panes',
      () => {
        for (let i = 0; i < BATCH; i++) computeLayout(root, WINDOW);
      },
      { operations: BATCH },
    ),
    await bench(
      'layout: split + close in 16 panes',
      () => {
        for (let i = 0; i < BATCH; i++) {
          closePane(splitPane(root, ids[i % ids.length], 'new', DIRECTIONS[i % 4]), 'new');
        }
      },
      { operations: BATCH },
    ),
  ];
}
