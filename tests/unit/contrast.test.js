import { describe, it, expect } from 'vitest';
import { parseHex, relativeLuminance, contrastRatio, meetsAA } from '../../scripts/contrast.mjs';

describe('parseHex', () => {
  it('parses six-digit hex', () => {
    expect(parseHex('#3D5AFE')).toEqual({ r: 61, g: 90, b: 254 });
  });

  it('parses three-digit shorthand', () => {
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('is case-insensitive and tolerates a missing hash', () => {
    expect(parseHex('3d5afe')).toEqual({ r: 61, g: 90, b: 254 });
  });

  it('throws on malformed input', () => {
    expect(() => parseHex('#12345')).toThrow(/hex/i);
    expect(() => parseHex('rebeccapurple')).toThrow(/hex/i);
  });
});

describe('relativeLuminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(relativeLuminance(parseHex('#000000'))).toBeCloseTo(0, 5);
    expect(relativeLuminance(parseHex('#FFFFFF'))).toBeCloseTo(1, 5);
  });

  it('matches the WCAG reference value for mid grey', () => {
    expect(relativeLuminance(parseHex('#808080'))).toBeCloseTo(0.2159, 3);
  });
});

describe('contrastRatio', () => {
  it('is 21 for black on white', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 2);
  });

  it('is 1 for a colour against itself', () => {
    expect(contrastRatio('#3D5AFE', '#3D5AFE')).toBeCloseTo(1, 5);
  });

  it('is order-independent', () => {
    expect(contrastRatio('#3D5AFE', '#FFFFFF')).toBeCloseTo(contrastRatio('#FFFFFF', '#3D5AFE'), 5);
  });

  it('gives the brand primary at least AA on white', () => {
    expect(contrastRatio('#3D5AFE', '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
  });
});

describe('meetsAA', () => {
  it('requires 4.5 for body text', () => {
    expect(meetsAA(4.5, 'text')).toBe(true);
    expect(meetsAA(4.49, 'text')).toBe(false);
  });

  it('requires 3 for large text and UI boundaries', () => {
    expect(meetsAA(3, 'large')).toBe(true);
    expect(meetsAA(3, 'ui')).toBe(true);
    expect(meetsAA(2.99, 'ui')).toBe(false);
  });

  it('rejects an unknown kind rather than silently passing', () => {
    expect(() => meetsAA(21, 'decorative')).toThrow(/kind/i);
  });
});
