// Generates PWA icons as PNG files using pure Node.js (no dependencies)
import { createDeflate } from 'zlib';
import { writeFileSync } from 'fs';
import { promisify } from 'util';
import { pipeline } from 'stream';
import { Readable, Writable } from 'stream';

const pipe = promisify(pipeline);

function uint32BE(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n, 0);
  return b;
}

function crc32(buf) {
  const table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    return t;
  })();
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const lenBuf = uint32BE(data.length);
  const crcInput = Buffer.concat([typeBytes, data]);
  const crcBuf = uint32BE(crc32(crcInput));
  return Buffer.concat([lenBuf, typeBytes, data, crcBuf]);
}

async function deflate(input) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const d = createDeflate({ level: 6 });
    d.on('data', c => chunks.push(c));
    d.on('end', () => resolve(Buffer.concat(chunks)));
    d.on('error', reject);
    d.end(input);
  });
}

// Parse hex color #rrggbb
function parseColor(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

// Draw a simple "E" letter as pixel art at given position
function drawLetter(pixels, size, fg) {
  // Scale the letter based on icon size
  const scale = Math.floor(size / 10);
  const letterW = 5 * scale;
  const letterH = 7 * scale;
  const offsetX = Math.floor((size - letterW) / 2);
  const offsetY = Math.floor((size - letterH) / 2);

  // "E" pattern (5×7 grid)
  const E = [
    [1,1,1,1,1],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,1,1,1,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,1,1,1,1],
  ];

  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 5; col++) {
      if (E[row][col]) {
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const px = offsetX + col * scale + sx;
            const py = offsetY + row * scale + sy;
            if (px >= 0 && px < size && py >= 0 && py < size) {
              const idx = (py * size + px) * 3;
              pixels[idx] = fg[0];
              pixels[idx + 1] = fg[1];
              pixels[idx + 2] = fg[2];
            }
          }
        }
      }
    }
  }
}

async function generatePNG(size, bgHex, fgHex) {
  const bg = parseColor(bgHex);
  const fg = parseColor(fgHex);

  // RGB pixel data (no alpha)
  const pixels = new Uint8Array(size * size * 3);

  // Fill background
  for (let i = 0; i < size * size; i++) {
    pixels[i * 3] = bg[0];
    pixels[i * 3 + 1] = bg[1];
    pixels[i * 3 + 2] = bg[2];
  }

  // Draw rounded rect border (optional, subtle)
  const radius = Math.floor(size * 0.18);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Corner check
      const dx = Math.max(0, Math.max(radius - x, x - (size - 1 - radius)));
      const dy = Math.max(0, Math.max(radius - y, y - (size - 1 - radius)));
      if (dx * dx + dy * dy > radius * radius) {
        // Outside rounded corner — make it transparent by setting to a special value
        // For PNG without alpha, just keep bg (will look square on white bg but fine)
      }
    }
  }

  // Draw letter
  drawLetter(pixels, size, fg);

  // Build scanlines: each row gets a filter byte (0 = None)
  const scanlines = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    scanlines[y * (size * 3 + 1)] = 0; // filter type None
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 3;
      const dst = y * (size * 3 + 1) + 1 + x * 3;
      scanlines[dst] = pixels[src];
      scanlines[dst + 1] = pixels[src + 1];
      scanlines[dst + 2] = pixels[src + 2];
    }
  }

  const compressed = await deflate(scanlines);

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = pngChunk('IHDR', Buffer.concat([
    uint32BE(size),
    uint32BE(size),
    Buffer.from([8, 2, 0, 0, 0]), // 8-bit depth, RGB, no interlace
  ]));
  const idat = pngChunk('IDAT', compressed);
  const iend = pngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

const BG = '#0f1117';
const FG = '#c4f135';

for (const size of [192, 512]) {
  const png = await generatePNG(size, BG, FG);
  const path = `public/icons/icon-${size}.png`;
  writeFileSync(path, png);
  console.log(`Generated ${path} (${png.length} bytes)`);
}

// Also generate apple-touch-icon (180x180)
const apple = await generatePNG(180, BG, FG);
writeFileSync('public/apple-touch-icon.png', apple);
console.log('Generated public/apple-touch-icon.png');
