/**
 * Görsel kaplama yardımcıları (2026-09).
 * skin.css içindeki sınıflar rengi `--c` (hex) ve `--c-rgb` ("r,g,b")
 * CSS değişkenlerinden alır. Bu yardımcı, bir renkten o iki değişkeni
 * üretir. `var(--app-accent...)` verilirse tema değişkenlerine bağlar.
 */
import type { CSSProperties } from 'react';

function hexToRgbStr(hex: string): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(ch => ch + ch).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some(n => Number.isNaN(n))) return '255,255,255';
  return `${r},${g},${b}`;
}

/** `--c` ve `--c-rgb` değişkenlerini inline style olarak döndürür. */
export function skVars(color: string, extra?: CSSProperties): CSSProperties {
  const isAccent = color.startsWith('var(--app-accent');
  const vars = isAccent
    ? { '--c': 'var(--app-accent, #a855f7)', '--c-rgb': 'var(--app-accent-rgb, 168,85,247)' }
    : { '--c': color, '--c-rgb': hexToRgbStr(color) };
  return { ...(vars as unknown as CSSProperties), ...(extra ?? {}) };
}

/** Albüm paketleri için polaroid yelpaze SVG'si (n = fotoğraf sayısı). */
export function albumFanSvg(n: number, color: string): string {
  const k = Math.min(Math.max(n, 1), 5);
  const w = n === 1 ? 18 : 15;
  const h = n === 1 ? 24 : 20;
  const x = 24 - w / 2;
  const y = n === 1 ? 4 : 6;
  let html = '';
  for (let i = 0; i < k; i++) {
    const a = k === 1 ? 0 : -24 + (48 * i) / (k - 1);
    html +=
      `<g transform="rotate(${a.toFixed(1)} 24 40)">` +
      `<rect x="${x + 1}" y="${y + 1.5}" width="${w}" height="${h}" rx="2.5" fill="rgba(0,0,0,0.35)"/>` +
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2.5" fill="#fff" fill-opacity="0.96"/>` +
      `<rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${h - 7}" rx="1.5" fill="${color}"/>` +
      `<circle cx="${x + w - 5}" cy="${y + 5}" r="1.4" fill="#fff" fill-opacity="0.85"/>` +
      `</g>`;
  }
  return html;
}
