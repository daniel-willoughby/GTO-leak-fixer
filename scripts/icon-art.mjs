// PotKing app-icon artwork — the single source of truth consumed by
// gen-icons.mjs (PWA/favicon) and gen-native-assets.mjs (iOS icon + splash).
//
// Design language (mirrors the app's Zen palette in src/index.css):
//   • sage-felt ground with the same top-lit radial the poker table uses
//   • a paper-cream spade wearing a gold coronet — Pot *King*
//   • fine cream keyline inset, echoing the card backs' cream borders
//   • heartred dealer button as the asymmetric accent
//   • subtle diagonal weave + vignette so it reads rich, not flat
//
// `glyph(rx)` returns the inner artwork for a 512×512 frame; rx=0 gives the
// full-bleed square iOS masks itself, rx≈112 the pre-rounded PWA/splash tile.

export const ICON_BG_DARKEST = '#2c3a31' // splash background pairs

export function glyph(rx) {
  return `
  <defs>
    <radialGradient id="felt" cx="0.5" cy="0.32" r="0.95">
      <stop offset="0" stop-color="#6f8a76"/>
      <stop offset="0.45" stop-color="#5b7461"/>
      <stop offset="1" stop-color="#3c4f43"/>
    </radialGradient>
    <radialGradient id="vign" cx="0.5" cy="0.5" r="0.72">
      <stop offset="0.62" stop-color="#000000" stop-opacity="0"/>
      <stop offset="1" stop-color="#1c241f" stop-opacity="0.55"/>
    </radialGradient>
    <linearGradient id="paper" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fcfaf4"/>
      <stop offset="0.7" stop-color="#f5f2ea"/>
      <stop offset="1" stop-color="#e9e3d3"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e0b76a"/>
      <stop offset="0.55" stop-color="#c79a4a"/>
      <stop offset="1" stop-color="#a37c33"/>
    </linearGradient>
    <radialGradient id="btn" cx="0.36" cy="0.3" r="1">
      <stop offset="0" stop-color="#c95a3e"/>
      <stop offset="0.6" stop-color="#b1442c"/>
      <stop offset="1" stop-color="#8d3423"/>
    </radialGradient>
    <radialGradient id="shadow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#243029" stop-opacity="0.5"/>
      <stop offset="1" stop-color="#243029" stop-opacity="0"/>
    </radialGradient>
    <pattern id="weave" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="14" height="14" fill="none"/>
      <rect width="7" height="14" fill="#ffffff" opacity="0.028"/>
    </pattern>
    <clipPath id="frame"><rect width="512" height="512" rx="${rx}"/></clipPath>
  </defs>

  <g clip-path="url(#frame)">
    <rect width="512" height="512" fill="url(#felt)"/>
    <rect width="512" height="512" fill="url(#weave)"/>
    <rect width="512" height="512" fill="url(#vign)"/>

    <!-- cream keyline, the card-back border motif -->
    <rect x="25" y="25" width="462" height="462" rx="${Math.max(rx - 18, 58)}"
      fill="none" stroke="#efe6d2" stroke-opacity="0.5" stroke-width="4"/>

    <!-- grounding shadow under the mark -->
    <ellipse cx="256" cy="416" rx="140" ry="26" fill="url(#shadow)"/>

    <!-- coronet: sits just above the spade's tip so the mark reads as one emblem -->
    <g stroke="#7c5d1f" stroke-opacity="0.35" stroke-width="2" stroke-linejoin="round">
      <path d="M188 142 L188 112 L200 68 L229 104 L256 58 L283 104 L312 68 L324 112 L324 142
               Q290 132 256 132 Q222 132 188 142 Z" fill="url(#gold)"/>
      <circle cx="200" cy="62" r="8.5" fill="url(#gold)"/>
      <circle cx="256" cy="50" r="9.5" fill="url(#gold)"/>
      <circle cx="312" cy="62" r="8.5" fill="url(#gold)"/>
      <circle cx="198" cy="59" r="3" fill="#f3e3bd" opacity="0.9" stroke="none"/>
      <circle cx="254" cy="47" r="3.4" fill="#f3e3bd" opacity="0.9" stroke="none"/>
      <circle cx="310" cy="59" r="3" fill="#f3e3bd" opacity="0.9" stroke="none"/>
    </g>

    <!-- paper spade: waisted Didone stem with a flared serif foot -->
    <g>
      <path d="M256 156
               C 232 192, 150 254, 150 322
               A 53 53 0 0 0 251 344
               L 261 344
               A 53 53 0 0 0 362 322
               C 362 254, 280 192, 256 156 Z"
        fill="url(#paper)"/>
      <path d="M256 334
               C 251 364, 240 386, 218 404
               L 294 404
               C 272 386, 261 364, 256 334 Z"
        fill="url(#paper)"/>
      <rect x="206" y="400" width="100" height="14" rx="7" fill="url(#paper)"/>
    </g>

    <!-- heartred dealer button, cream-ringed like the app's chips -->
    <circle cx="396" cy="398" r="33" fill="url(#btn)"/>
    <circle cx="396" cy="398" r="33" fill="none" stroke="#efe6d2" stroke-opacity="0.9" stroke-width="5"/>
    <circle cx="387" cy="389" r="9" fill="#ffffff" opacity="0.22"/>
  </g>`
}

export const iconSvg = (rx) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${glyph(rx)}</svg>`
