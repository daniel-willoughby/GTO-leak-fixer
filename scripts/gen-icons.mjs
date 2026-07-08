// Render the PotKing icon artwork (scripts/icon-art.mjs) to the PNGs the PWA
// manifest + browser need. Run: node scripts/gen-icons.mjs
//
// Corner radii per target:
//   • pwa-192/512 + apple-touch: FULL BLEED — iOS and Android launchers apply
//     their own mask, and baked transparent corners render black on iOS.
//   • favicon-32: soft rounded corners (browser tabs show the bitmap as-is).
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { iconSvg } from './icon-art.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pub = join(root, 'public')

await mkdir(pub, { recursive: true })

const targets = [
  ['pwa-192.png', 192, 0],
  ['pwa-512.png', 512, 0],
  ['apple-touch-icon.png', 180, 0],
  ['favicon-32.png', 32, 64],
]

for (const [name, size, rx] of targets) {
  await sharp(Buffer.from(iconSvg(rx))).resize(size, size).png().toFile(join(pub, name))
  console.log('wrote', name, `${size}x${size}`)
}
