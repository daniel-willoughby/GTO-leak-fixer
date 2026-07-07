// Render the source images @capacitor/assets needs to generate the native app
// icon + splash set. iOS applies its own rounded-corner mask, so the icon is a
// full-bleed square (no rx). The splash centres the logo on the app's dark felt.
//   node scripts/gen-native-assets.mjs   then   npx @capacitor/assets generate --ios
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'assets')

// The wordmark/table glyph, parameterised so we can drop the rounded corners for
// the iOS icon (masked by the OS) and re-use the artwork centred on the splash.
const glyph = (rx) => `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1e293b"/>
      <stop offset="1" stop-color="#0f172a"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${rx}" fill="url(#bg)"/>
  <ellipse cx="256" cy="262" rx="150" ry="120" fill="#065f46"/>
  <ellipse cx="256" cy="262" rx="150" ry="120" fill="none" stroke="#92400e" stroke-width="14"/>
  <path transform="translate(256 250) scale(11) translate(-12 -12)"
    d="M12 2C12 2 5 8.5 5 13a4 4 0 0 0 6.2 3.3C11 18.5 9.5 20 8 20h8c-1.5 0-3-1.5-3.2-3.7A4 4 0 0 0 19 13c0-4.5-7-11-7-11z"
    fill="#f59e0b"/>
  <circle cx="372" cy="372" r="34" fill="#ef4444"/>
  <circle cx="372" cy="372" r="14" fill="#0f172a"/>`

const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 512 512">${glyph(0)}</svg>`

// Splash: dark background filling the frame with the logo tile centred.
const splash = (bg) => `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732">
  <rect width="2732" height="2732" fill="${bg}"/>
  <g transform="translate(1024 1024) scale(1.34)">
    <svg width="512" height="512" viewBox="0 0 512 512">${glyph(112)}</svg>
  </g>
</svg>`

await mkdir(out, { recursive: true })
await sharp(Buffer.from(icon)).resize(1024, 1024).png().toFile(join(out, 'icon-only.png'))
await sharp(Buffer.from(icon)).resize(1024, 1024).png().toFile(join(out, 'icon.png'))
await sharp(Buffer.from(splash('#0f172a'))).png().toFile(join(out, 'splash.png'))
await sharp(Buffer.from(splash('#0b1220'))).png().toFile(join(out, 'splash-dark.png'))
console.log('wrote assets/icon.png, icon-only.png, splash.png, splash-dark.png')
