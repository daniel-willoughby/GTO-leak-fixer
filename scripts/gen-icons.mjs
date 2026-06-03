// Render the LeakTutor logo SVG to the PNG icons the PWA manifest needs.
// Run: node scripts/gen-icons.mjs
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pub = join(root, 'public')

const logo = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1e293b"/>
      <stop offset="1" stop-color="#0f172a"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <ellipse cx="256" cy="262" rx="150" ry="120" fill="#065f46"/>
  <ellipse cx="256" cy="262" rx="150" ry="120" fill="none" stroke="#92400e" stroke-width="14"/>
  <!-- spade -->
  <path transform="translate(256 250) scale(11) translate(-12 -12)"
    d="M12 2C12 2 5 8.5 5 13a4 4 0 0 0 6.2 3.3C11 18.5 9.5 20 8 20h8c-1.5 0-3-1.5-3.2-3.7A4 4 0 0 0 19 13c0-4.5-7-11-7-11z"
    fill="#f59e0b"/>
  <circle cx="372" cy="372" r="34" fill="#ef4444"/>
  <circle cx="372" cy="372" r="14" fill="#0f172a"/>
</svg>`

await mkdir(pub, { recursive: true })

const targets = [
  ['pwa-192.png', 192],
  ['pwa-512.png', 512],
  ['apple-touch-icon.png', 180],
  ['favicon-32.png', 32],
]

for (const [name, size] of targets) {
  await sharp(Buffer.from(logo(size))).resize(size, size).png().toFile(join(pub, name))
  console.log('wrote', name, `${size}x${size}`)
}
