// Gera os ícones PNG do app (sem dependências): fundo sálvia, lua creme, coração rosa.
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const SAGE = [143, 169, 143], CREAM = [250, 247, 242], PINK = [232, 169, 179]

function shade(x, y) { // coordenadas 0..1
  // lua crescente: círculo creme menos círculo deslocado
  const inMoon = Math.hypot(x - 0.5, y - 0.48) < 0.27 && Math.hypot(x - 0.62, y - 0.40) > 0.23
  // coração pequeno
  const hx = (x - 0.62) / 0.11, hy = (0.60 - y) / 0.11
  const inHeart = Math.pow(hx * hx + hy * hy - 1, 3) - hx * hx * hy * hy * hy < 0
  if (inHeart) return PINK
  if (inMoon) return CREAM
  return SAGE
}

function png(size) {
  const ss = 4, raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0]
      for (let i = 0; i < ss; i++) for (let j = 0; j < ss; j++) {
        const c = shade((x + (i + 0.5) / ss) / size, (y + (j + 0.5) / ss) / size)
        acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]
      }
      const o = y * (size * 4 + 1) + 1 + x * 4
      raw[o] = acc[0] / ss / ss; raw[o + 1] = acc[1] / ss / ss; raw[o + 2] = acc[2] / ss / ss; raw[o + 3] = 255
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
  const crc = (b) => { let c = 0xffffffff; for (const v of b) c = crcTable[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td))
    return Buffer.concat([len, td, c])
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

writeFileSync('public/icon-192.png', png(192))
writeFileSync('public/icon-512.png', png(512))
writeFileSync('public/apple-touch-icon.png', png(180))
writeFileSync('public/favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#8FA98F"/><mask id="m"><rect width="100" height="100" fill="#fff"/><circle cx="62" cy="40" r="23" fill="#000"/></mask><circle cx="50" cy="48" r="27" fill="#FAF7F2" mask="url(#m)"/></svg>`)
console.log('ícones gerados')
