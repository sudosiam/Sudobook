// Generates placeholder PNG icons for the PWA (no external deps).
// Production icons are copied from appstore-images (android launchericon-*).
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../public/icons');
mkdirSync(outDir, { recursive: true });

// Brand blue #0F3D91 with a lighter rounded square + "₹"-ish glyph block.
const BG = [10, 10, 10]; // #0a0a0a
const BRAND = [15, 61, 145]; // #0F3D91
const TEXT = [245, 245, 245]; // #F5F5F5

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function png(size, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  const raw = Buffer.alloc((size * 3 + 1) * size);
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixels(x, y, size);
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
    }
  }
  const idat = deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function drawer(maskable) {
  return (x, y, size) => {
    const pad = maskable ? 0 : Math.floor(size * 0.08);
    const inner = size - pad * 2;
    const rx = x - pad;
    const ry = y - pad;
    if (rx < 0 || ry < 0 || rx >= inner || ry >= inner) return maskable ? BRAND : BG;
    // rounded square brand background
    const radius = inner * 0.22;
    const cx = Math.min(rx, inner - rx);
    const cy = Math.min(ry, inner - ry);
    if (cx < radius && cy < radius) {
      const dx = radius - cx;
      const dy = radius - cy;
      if (dx * dx + dy * dy > radius * radius) return maskable ? BRAND : BG;
    }
    // central bar block resembling a ledger glyph
    const bx = inner * 0.34;
    const bw = inner * 0.32;
    const by = inner * 0.3;
    const bh = inner * 0.1;
    for (let i = 0; i < 3; i++) {
      const yy = by + i * inner * 0.16;
      if (rx > bx && rx < bx + bw + i * inner * 0.02 && ry > yy && ry < yy + bh) return TEXT;
    }
    return BRAND;
  };
}

writeFileSync(path.join(outDir, 'icon-192.png'), png(192, drawer(false)));
writeFileSync(path.join(outDir, 'icon-512.png'), png(512, drawer(false)));
writeFileSync(path.join(outDir, 'icon-512-maskable.png'), png(512, drawer(true)));
console.log('Icons generated in', outDir);
