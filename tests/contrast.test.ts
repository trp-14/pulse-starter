// WCAG contrast guard: parses app/styles/tokens.css (the single source of colour) and checks
// every text pairing in both themes. Translucent surfaces are composited over what they sit on.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type Rgba = [number, number, number, number];
type Theme = 'day' | 'night';
type Pair = [label: string, fg: Rgba, bg: Rgba, min: number];

function stripComments(source: string): string {
  let out = '';
  let index = 0;
  while (index < source.length) {
    const open = source.indexOf('/*', index);
    if (open === -1) return out + source.slice(index);
    out += source.slice(index, open);
    const close = source.indexOf('*/', open + 2);
    index = close === -1 ? source.length : close + 2;
  }
  return out;
}

const css = stripComments(readFileSync(path.resolve(__dirname, '../app/styles/tokens.css'), 'utf8'));
const rootStart = css.indexOf(':root {');
const rootBlock = css.slice(rootStart, css.indexOf('}', rootStart));

function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of value) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current.trim());
  return parts;
}

/** `--name: value;` declarations of the :root block; light-dark(day, night) resolved per theme. */
function parseTokens(theme: Theme): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const declaration of rootBlock.split(';')) {
    const start = declaration.indexOf('--');
    const colon = declaration.indexOf(':', start);
    if (start === -1 || colon === -1) continue;
    const name = declaration.slice(start + 2, colon).trim();
    const raw = declaration.slice(colon + 1).trim();
    if (raw.startsWith('light-dark(') && raw.endsWith(')')) {
      const [day = '', night = ''] = splitTopLevel(raw.slice('light-dark('.length, -1));
      tokens.set(name, theme === 'day' ? day : night);
    } else {
      tokens.set(name, raw);
    }
  }
  return tokens;
}

function parseColor(value: string): Rgba {
  if (/^#[0-9a-f]{6}$/i.test(value)) {
    const n = Number.parseInt(value.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  if (value.startsWith('rgba(') && value.endsWith(')')) {
    const [r = 0, g = 0, b = 0, a = 1] = value
      .slice(5, -1)
      .split(',')
      .map((part) => Number(part.trim()));
    return [r, g, b, a];
  }
  throw new Error(`Unparseable colour: ${value}`);
}

const over = (top: Rgba, bottom: Rgba): Rgba => {
  const [r, g, b, a] = top;
  return [r * a + bottom[0] * (1 - a), g * a + bottom[1] * (1 - a), b * a + bottom[2] * (1 - a), 1];
};

const mix = (from: Rgba, to: Rgba, t: number): Rgba => [
  from[0] + (to[0] - from[0]) * t,
  from[1] + (to[1] - from[1]) * t,
  from[2] + (to[2] - from[2]) * t,
  1,
];

function luminance([r, g, b]: Rgba): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: Rgba, b: Rgba): number {
  const [hi = 0, lo = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Pairs below their minimum, formatted for a readable failure message. */
function failures(pairs: Pair[]): string[] {
  return pairs
    .map(([label, fg, bg, min]) => ({ label, min, ratio: contrast(fg, bg) }))
    .filter(({ ratio, min }) => ratio < min)
    .map(({ label, ratio, min }) => `${label}: ${ratio.toFixed(2)} < ${min}`);
}

const AA = 4.5;
const AA_LARGE = 3;
const STATUSES = ['paid', 'pending', 'shipped', 'cancelled'] as const;

describe.each<Theme>(['day', 'night'])('%s theme contrast (WCAG AA)', (theme) => {
  const tokens = parseTokens(theme);
  const color = (name: string): Rgba => {
    const value = tokens.get(name);
    if (!value) throw new Error(`Missing token --${name}`);
    return parseColor(value);
  };

  const base = color('base');
  const surfaces: Array<[string, Rgba]> = [
    ['base', base],
    ['well', color('well')],
    ['table row', over(color('row-alt'), base)],
    ['toast/ticker', over(color('glass-solid'), base)],
  ];
  // Glass sits on the sky band (and its fade into --base); the sheen covers its top half.
  for (const sky of ['sky-1', 'sky-2', 'sky-3', 'base']) {
    const glass = over(color('glass-bg'), color(sky));
    surfaces.push([`glass on ${sky}`, glass], [`glass sheen on ${sky}`, over(color('sheen'), glass)]);
  }

  const textPairs: Pair[] = surfaces.flatMap(([name, bg]): Pair[] => [
    [`text on ${name}`, color('text'), bg, AA],
    [`text-strong on ${name}`, color('text-strong'), bg, AA],
    [`muted on ${name}`, color('muted'), bg, AA],
  ]);
  const statusTextPairs: Pair[] = surfaces.slice(0, 3).flatMap(([name, bg]): Pair[] => [
    [`live-text on ${name}`, color('live-text'), bg, AA],
    [`alert-text on ${name}`, color('alert-text'), bg, AA],
  ]);
  const pillPairs: Pair[] = STATUSES.flatMap((status): Pair[] =>
    ['bg-1', 'bg-2'].map((stop): Pair => [
      `${status} pill on ${stop}`,
      color(`pill-${status}-text`),
      color(`pill-${status}-${stop}`),
      AA,
    ]),
  );
  const avatarPairs: Pair[] = [1, 2, 3, 4, 5, 6].map((i): Pair => [
    `avatar ${i}`,
    color('avatar-ink'),
    color(`avatar-${i}`),
    AA,
  ]);
  const white = color('on-gloss');
  // Glyphs occupy roughly 34%–66% of the button height; 34% is 68% of the way from stop 1 to stop 2.
  const glossPairs: Pair[] = [
    ['gloss top of glyphs (large text)', white, mix(color('gloss-1'), color('gloss-2'), 0.68), AA_LARGE],
    ['gloss upper half end', white, color('gloss-2'), AA],
    ['gloss lower half start', white, color('gloss-3'), AA],
    ['gloss bottom', white, color('gloss-4'), AA],
  ];
  const nonTextPairs: Pair[] = [
    ['focus ring on base', color('focus'), base, AA_LARGE],
    ['aqua line on well', color('aqua'), color('well'), AA_LARGE],
    ['heat max vs heat min', color('aqua-heat'), color('heat-min'), AA_LARGE],
  ];

  it('body, heading and muted text on every surface', () => {
    expect(failures(textPairs)).toEqual([]);
  });

  it('live and alert text', () => {
    expect(failures(statusTextPairs)).toEqual([]);
  });

  it('status pills against both gradient stops', () => {
    expect(failures(pillPairs)).toEqual([]);
  });

  it('avatar initials on every pastel', () => {
    expect(failures(avatarPairs)).toEqual([]);
  });

  it('gloss button text (19px/800 = WCAG large text) over the band behind the glyphs', () => {
    expect(failures(glossPairs)).toEqual([]);
  });

  it('non-text contrast: focus ring, chart line, heat max (3:1)', () => {
    expect(failures(nonTextPairs)).toEqual([]);
  });

  it('reads every token it needs from tokens.css', () => {
    const all = [...textPairs, ...statusTextPairs, ...pillPairs, ...avatarPairs, ...glossPairs, ...nonTextPairs];
    expect(all.length).toBeGreaterThan(60);
    if (process.env.PRINT_CONTRAST) {
      const lines = all.map(([label, fg, bg]) => `${label}: ${contrast(fg, bg).toFixed(2)}`);
      process.stdout.write(`\n[${theme}]\n${lines.join('\n')}\n`);
    }
  });
});
