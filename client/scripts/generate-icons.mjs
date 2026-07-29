/**
 * Generates the PWA icon set into client/public/icons/.
 *
 * The repo has no image tooling (sharp/canvas), so this writes PNGs directly:
 * shapes are sampled at 4x and box-filtered down for antialiasing, then encoded
 * as RGBA8 PNG. Re-run with `npm run icons` after changing the mark or colours.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'app');

const BRAND = [0x25, 0x63, 0xeb]; // #2563EB — same blue as the sidebar logo mark
const INK = [0xff, 0xff, 0xff];

/* ── PNG encoding ─────────────────────────────────────────────────────── */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(size, rgba) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ── The mark: two stacked "T"s on a blue tile ────────────────────────── */

const inRect = (x, y, rx, ry, w, h) => x >= rx && x < rx + w && y >= ry && y < ry + h;

function inRoundedRect(x, y, rx, ry, w, h, r) {
  if (!inRect(x, y, rx, ry, w, h)) return false;
  const cx = Math.min(Math.max(x, rx + r), rx + w - r);
  const cy = Math.min(Math.max(y, ry + r), ry + h - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

// One "T" glyph: crossbar plus centred stem, all in unit coordinates.
function inT(x, y, left, top, w, h) {
  const bar = h * 0.26;
  const stem = w * 0.32;
  return (
    inRect(x, y, left, top, w, bar) ||
    inRect(x, y, left + (w - stem) / 2, top, stem, h)
  );
}

/**
 * @param {number} size    output edge length in px
 * @param {boolean} bleed  true for maskable/apple icons (square, full-bleed bg)
 * @param {number} scale   glyph scale — shrunk for maskable so the mark stays
 *                         inside the 80% safe zone Android may crop to
 */
function drawIcon(size, { bleed = false, scale = 1 } = {}) {
  const SS = 4; // supersampling factor
  const px = Buffer.alloc(size * size * 4);

  // Glyph geometry in unit space, centred as a pair.
  const gw = 0.28 * scale;
  const gh = 0.34 * scale;
  const gap = 0.05 * scale;
  const left = 0.5 - (gw * 2 + gap) / 2;
  const top = 0.5 - gh / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) / size;
          const v = (y + (sy + 0.5) / SS) / size;

          const onTile = bleed || inRoundedRect(u, v, 0, 0, 1, 1, 0.22);
          if (!onTile) continue;

          const onGlyph =
            inT(u, v, left, top, gw, gh) || inT(u, v, left + gw + gap, top, gw, gh);
          const [cr, cg, cb] = onGlyph ? INK : BRAND;
          r += cr;
          g += cg;
          b += cb;
          a += 255;
        }
      }

      const samples = SS * SS;
      const i = (y * size + x) * 4;
      // Premultiplied average, un-premultiplied back out for straight-alpha PNG.
      px[i] = a ? Math.round(r / (a / 255)) : 0;
      px[i + 1] = a ? Math.round(g / (a / 255)) : 0;
      px[i + 2] = a ? Math.round(b / (a / 255)) : 0;
      px[i + 3] = Math.round(a / samples);
    }
  }

  return encodePNG(size, px);
}

/* ── Emit ─────────────────────────────────────────────────────────────── */

mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-maskable-192.png', 192, { bleed: true, scale: 0.72 }],
  ['icon-maskable-512.png', 512, { bleed: true, scale: 0.72 }],
  ['apple-touch-icon.png', 180, { bleed: true, scale: 0.85 }],
];

for (const [name, size, opts] of targets) {
  writeFileSync(join(OUT_DIR, name), drawIcon(size, opts));
  console.log(`wrote public/icons/${name}`);
}

// Next.js picks this up as the favicon via the app/icon convention.
writeFileSync(join(APP_DIR, 'icon.png'), drawIcon(256, {}));
console.log('wrote app/icon.png');
