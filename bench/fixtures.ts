export const COLS = 200;
export const ROWS = 50;
const SIZE = 4 * 1024 * 1024;

const prng = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) % 2 ** 31;
  return seed / 2 ** 31;
};

const WORDS = ['const', 'return', 'error', 'info', 'GET', '/api/v1/users', 'ok', '200', '404', 'build', 'src/main.rs', 'warning'];
const WIDE = ['日本語', '中文', '한국어', '😀', '🚀', '✓', '→', 'é', 'ß'];

const fill = (next: () => string) => {
  const parts: string[] = [];
  let length = 0;
  while (length < SIZE) {
    const part = next();
    parts.push(part);
    length += part.length;
  }
  return parts.join('');
};

const plain = () => {
  let n = 1;
  return fill(() => `${n++}\r\n`);
};

const colored = () => {
  const random = prng(1);
  return fill(() => {
    const words = Array.from({ length: 12 }, () => {
      const color = 31 + Math.floor(random() * 7);
      const word = WORDS[Math.floor(random() * WORDS.length)];
      return random() < 0.5 ? `\x1b[${color}m${word}\x1b[0m` : `\x1b[1;38;2;${color * 4};120;200m${word}\x1b[0m`;
    });
    return words.join(' ') + '\r\n';
  });
};

const unicode = () => {
  const random = prng(2);
  return fill(() => {
    const words = Array.from({ length: 16 }, () =>
      random() < 0.4 ? WIDE[Math.floor(random() * WIDE.length)] : WORDS[Math.floor(random() * WORDS.length)],
    );
    return words.join(' ') + '\r\n';
  });
};

const redraw = () => {
  const random = prng(3);
  return fill(() => {
    const rows: string[] = ['\x1b[?2026h\x1b[H'];
    for (let row = 1; row <= ROWS; row++) {
      rows.push(`\x1b[${row};1H\x1b[38;5;${Math.floor(random() * 256)}m${String(row).padStart(4)} \x1b[0m`);
      let line = '';
      while (line.length < COLS - 6) line += WORDS[Math.floor(random() * WORDS.length)] + ' ';
      rows.push(line.slice(0, COLS - 6), '\x1b[K');
    }
    rows.push(`\x1b[${ROWS};1H\x1b[7m NORMAL \x1b[0m\x1b[?2026l`);
    return rows.join('');
  });
};

export const FIXTURES = { plain, colored, unicode, redraw } as const;
export type FixtureName = keyof typeof FIXTURES;

export const encode = (text: string) => new TextEncoder().encode(text);
