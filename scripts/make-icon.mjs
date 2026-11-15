// Genera el icono pixel-art y el splash en assets/ (PNG, sin dependencias).
// Después: npx @capacitor/assets generate --android   (o `npm run icons`)
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [11, 13, 20, 255];
const ROWS = [
  [95, 191, 74], // pradera
  [255, 160, 64], // cueva
  [111, 182, 255], // hielo
  [224, 80, 46], // lava
  [160, 122, 255], // espacio
];

/** Dibujo de 32x32: ladrillos de los 5 mundos con un túnel, bola y pala. */
function art() {
  const px = new Map();
  const set = (x, y, c) => px.set(`${x},${y}`, c);
  for (let y = 5; y < 15; y++) {
    for (let x = 4; x < 28; x++) {
      const base = ROWS[Math.floor((y - 5) / 2)];
      const k = (x * 7 + y * 13) % 5 === 0 ? 0.8 : (x + y) % 2 ? 1 : 0.9;
      set(x, y, [base[0] * k, base[1] * k, base[2] * k, 255]);
    }
  }
  // Túnel excavado por la bola
  const tunnel = [
    [16, 14], [17, 14], [16, 13], [17, 13], [15, 12], [16, 12], [14, 11], [15, 11], [16, 11],
    [13, 10], [14, 10], [12, 9], [13, 9], [12, 8], [13, 8], [14, 8], [13, 7], [14, 7], [15, 7], [15, 6], [16, 6],
    [22, 14], [23, 14], [22, 13], [8, 14], [8, 13], [9, 14],
  ];
  for (const [x, y] of tunnel) px.delete(`${x},${y}`);
  // Bola
  for (const [x, y] of [[17, 18], [18, 18], [16, 19], [17, 19], [18, 19], [19, 19], [16, 20], [17, 20], [18, 20], [19, 20], [17, 21], [18, 21]]) {
    set(x, y, [255, 255, 255, 255]);
  }
  set(16, 22, [255, 225, 77, 255]);
  set(15, 23, [255, 225, 77, 180]);
  // Pala
  for (let x = 9; x < 23; x++) {
    const end = x < 11 || x > 20;
    set(x, 26, end ? [157, 255, 106, 255] : [233, 237, 247, 255]);
    set(x, 27, end ? [95, 191, 74, 255] : [170, 178, 200, 255]);
  }
  return px;
}

function render(size, cell, bg) {
  const buf = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) buf.set(bg, i * 4);
  const off = Math.floor((size - cell * 32) / 2);
  for (const [key, c] of art()) {
    const [gx, gy] = key.split(',').map(Number);
    for (let y = 0; y < cell; y++) {
      for (let x = 0; x < cell; x++) {
        // 1/8 de celda de sombra abajo y a la derecha para dar relieve
        const edge = x >= cell - Math.ceil(cell / 8) || y >= cell - Math.ceil(cell / 8);
        const k = edge ? 0.72 : 1;
        const i = ((off + gy * cell + y) * size + off + gx * cell + x) * 4;
        buf[i] = c[0] * k;
        buf[i + 1] = c[1] * k;
        buf[i + 2] = c[2] * k;
        buf[i + 3] = c[3];
      }
    }
  }
  return buf;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(b) {
  let c = 0xffffffff;
  for (const v of b) c = crcTable[(c ^ v) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bits
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('assets', { recursive: true });
const out = {
  'icon-only.png': [1024, 32, BG],
  'icon-foreground.png': [1024, 20, [0, 0, 0, 0]],
  'icon-background.png': [1024, 0, BG],
  'splash.png': [2732, 24, BG],
  'splash-dark.png': [2732, 24, BG],
};
for (const [name, [size, cell, bg]] of Object.entries(out)) {
  writeFileSync(`assets/${name}`, png(size, cell ? render(size, cell, bg) : render(size, 1, bg).fill(0).map((_, i) => bg[i % 4])));
  console.log('assets/' + name);
}
