const AA_THRESHOLDS = { text: 4.5, large: 3, ui: 3 };

/** Parse #rgb / #rrggbb (hash optional, any case) into 0–255 channels. */
export function parseHex(hex) {
  const raw = String(hex).trim().replace(/^#/, '');
  if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(raw)) {
    throw new Error(`Not a hex colour: ${hex}`);
  }
  const full = raw.length === 3 ? raw.replace(/./g, (c) => c + c) : raw;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

const toLinear = (channel) => {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** WCAG 2.x relative luminance, 0 (black) – 1 (white). */
export function relativeLuminance({ r, g, b }) {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG contrast ratio, 1–21. Order-independent. */
export function contrastRatio(a, b) {
  const la = relativeLuminance(parseHex(a));
  const lb = relativeLuminance(parseHex(b));
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Does this ratio clear WCAG 2.2 AA for the given kind of content? */
export function meetsAA(ratio, kind) {
  const threshold = AA_THRESHOLDS[kind];
  if (threshold === undefined) {
    throw new Error(`Unknown contrast kind: ${kind}. Use 'text', 'large' or 'ui'.`);
  }
  return ratio >= threshold;
}
