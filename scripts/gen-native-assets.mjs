// Render the source images @capacitor/assets needs for the native icon + splash
// set, from the shared artwork in scripts/icon-art.mjs.
//   node scripts/gen-native-assets.mjs   then   npx @capacitor/assets generate --ios
//
// The iOS icon is full-bleed (the OS applies its own rounded mask). The splash
// centres the rounded icon tile on the app's paper background (dark paper for
// the dark variant), so launch blends straight into the app chrome.
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { glyph, iconSvg } from './icon-art.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'assets')

// Splash: app-chrome background with the rounded icon tile centred.
const splash = (bg) => `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732">
  <rect width="2732" height="2732" fill="${bg}"/>
  <g transform="translate(1024 1024) scale(1.34)">
    <svg width="512" height="512" viewBox="0 0 512 512">${glyph(112)}</svg>
  </g>
</svg>`

await mkdir(out, { recursive: true })
await sharp(Buffer.from(iconSvg(0))).resize(1024, 1024).png().toFile(join(out, 'icon-only.png'))
await sharp(Buffer.from(iconSvg(0))).resize(1024, 1024).png().toFile(join(out, 'icon.png'))
await sharp(Buffer.from(splash('#f5f2ea'))).png().toFile(join(out, 'splash.png')) // light paper
await sharp(Buffer.from(splash('#181612'))).png().toFile(join(out, 'splash-dark.png')) // dark paper
console.log('wrote assets/icon.png, icon-only.png, splash.png, splash-dark.png')
