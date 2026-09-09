'use strict';
// Генерирует icon-192.png и icon-512.png без сторонних библиотек (iOS не берёт SVG для иконки на домашнем экране).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function makeIcon(size) {
  const bg = [0x2f, 0x7d, 0x6d], white = [255, 255, 255];
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const r = size * 0.22; // радиус скругления
  const cx = size / 2, cy = size / 2;
  // сердце в параметрической форме, масштабированное под иконку
  const inHeart = (x, y) => {
    const nx = (x - cx) / (size * 0.32), ny = -(y - cy - size * 0.02) / (size * 0.32);
    const a = nx * nx + ny * ny - 1;
    return a * a * a - nx * nx * ny * ny * ny <= 0;
  };
  const inCross = (x, y) => {
    const w = size * 0.075, h = size * 0.24, ox = x - cx, oy = y - (cy + size * 0.04);
    return (Math.abs(ox) <= w && Math.abs(oy) <= h) || (Math.abs(oy) <= w && Math.abs(ox) <= h);
  };
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter none
    for (let x = 0; x < size; x++) {
      const dx = Math.max(r - x, x - (size - 1 - r), 0), dy = Math.max(r - y, y - (size - 1 - r), 0);
      const inside = dx * dx + dy * dy <= r * r;
      let px = inside ? bg : [0, 0, 0], alpha = inside ? 255 : 0;
      if (inside && inHeart(x, y)) px = white;
      if (inside && inCross(x, y) && inHeart(x, y)) px = bg;
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = px[0]; raw[o + 1] = px[1]; raw[o + 2] = px[2]; raw[o + 3] = alpha;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const s of [192, 512]) {
  const out = path.join(__dirname, '..', 'public', `icon-${s}.png`);
  fs.writeFileSync(out, makeIcon(s));
  console.log('written', out);
}
