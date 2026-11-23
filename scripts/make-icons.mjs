// Generates placeholder PNG icons without dependencies (node:zlib only).
// Teal background, white "ledger" shape. Real icons follow in phase 6.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const TEAL = [15, 118, 110];
const WHITE = [255, 255, 255];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([len, typed, crc]);
}

// contentScale: share of the icon used by the white shape (smaller for maskable safe zone).
function icon(size, contentScale) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const box = size * contentScale;
  const x0 = (size - box * 0.75) / 2;
  const x1 = size - x0;
  const y0 = (size - box) / 2;
  const y1 = size - y0;
  const line = Math.max(2, Math.round(size / 40));

  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      let color = TEAL;
      if (x >= x0 && x < x1 && y >= y0 && y < y1) {
        color = WHITE;
        // three teal "rows" on the white sheet
        const rel = (y - y0) / (y1 - y0);
        const inRow = [0.3, 0.5, 0.7].some((r) => Math.abs(rel - r) * (y1 - y0) < line);
        const inMargin = x < x0 + box * 0.12 || x > x1 - box * 0.12;
        if (inRow && !inMargin) color = TEAL;
      }
      raw.set(color, y * (size * 3 + 1) + 1 + x * 3);
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public', { recursive: true });
writeFileSync('public/icon-192.png', icon(192, 0.7));
writeFileSync('public/icon-512.png', icon(512, 0.7));
writeFileSync('public/icon-maskable-512.png', icon(512, 0.5));
writeFileSync('public/apple-touch-icon.png', icon(180, 0.6));
writeFileSync(
  'public/favicon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#0f766e"/><rect x="16" y="10" width="32" height="44" fill="#fff"/><g fill="#0f766e"><rect x="20" y="22" width="24" height="3"/><rect x="20" y="31" width="24" height="3"/><rect x="20" y="40" width="24" height="3"/></g></svg>\n`,
);
console.log('Icons written to public/');
