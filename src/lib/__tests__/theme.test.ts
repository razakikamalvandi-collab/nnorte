import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(fileURLToPath(new URL('../../index.css', import.meta.url)), 'utf8');

/** Ambil isi blok CSS pertama untuk selector tertentu. */
function block(selector: string): string {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`Selector tidak ditemukan: ${selector}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

function token(cssBlock: string, name: string): string | undefined {
  return cssBlock.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1]?.trim();
}

const dark = block(':root {');
const light = block(":root[data-theme='light']");
const inputFocus = block('.theme-input:focus');

describe('palet gelap Merah • Biru • Hitam', () => {
  it('memakai kanvas hitam, bukan abu-abu Blackstone', () => {
    expect(token(dark, '--c-bg')).toBe('#0a0a0a');
    expect(token(dark, '--c-sidebar')).toBe('#101012');
    expect(token(dark, '--c-surface')).toBe('#121214');
    expect(token(dark, '--c-surface-2')).toBe('#1a1a1e');
    expect(token(dark, '--c-border')).toBe('#2a2a31');
  });

  it('memakai crimson dan electric blue', () => {
    expect(token(dark, '--c-red')).toBe('#dc2626');
    expect(token(dark, '--c-red-hover')).toBe('#b91c1c');
    expect(token(dark, '--c-red-glow')).toBe('rgba(239, 68, 68, 0.42)');
    expect(token(dark, '--c-blue')).toBe('#1d4ed8');
    expect(token(dark, '--c-blue-hover')).toBe('#2563eb');
    expect(token(dark, '--c-blue-soft')).toBe('#60a5fa');
  });
});

describe('palet terang Merah • Biru • Putih', () => {
  it('memakai kanvas putih dan permukaan putih', () => {
    expect(token(light, '--c-bg')).toBe('#f7f8f9');
    expect(token(light, '--c-sidebar')).toBe('#f4f5f6');
    expect(token(light, '--c-surface')).toBe('#ffffff');
    expect(token(light, '--c-surface-2')).toBe('#f1f3f5');
    expect(token(light, '--c-border')).toBe('#e4e7eb');
  });

  it('memakai merah dan biru brand yang disepakati', () => {
    expect(token(light, '--c-red')).toBe('#dc2626');
    expect(token(light, '--c-red-hover')).toBe('#b91c1c');
    expect(token(light, '--c-blue')).toBe('#2563eb');
    expect(token(light, '--c-blue-hover')).toBe('#1d4ed8');
  });
});

describe('interaksi memakai biru', () => {
  it('fokus input memakai --c-blue, bukan merah', () => {
    expect(inputFocus).toContain('border-color: var(--c-blue)');
  });
});
