// Cosmetic shop catalog. Three kinds of item, background colours, flairs, and
// animal avatars, bought with Poker Points and shown on your profile and the
// leaderboards. Avatar artwork comes later; for now each avatar renders an emoji
// placeholder (the `art` field), so the economy and UI work end-to-end today.

// Tarot card-back artwork (bottom-row plain designs on the cheap backs, top-row
// elaborate ones on the dear + legendary backs).
import deckClassic from '../assets/cardbacks/deck-classic.png'
import deckMidnight from '../assets/cardbacks/deck-midnight.png'
import deckEmerald from '../assets/cardbacks/deck-emerald.png'
import deckSlate from '../assets/cardbacks/deck-slate.png'
import deckPlum from '../assets/cardbacks/deck-plum.png'
import deckCandy from '../assets/cardbacks/deck-candy.png'
import deckRoyal from '../assets/cardbacks/deck-royal.png'
import deckGold from '../assets/cardbacks/deck-gold.png'
import deckMirage from '../assets/cardbacks/deck-mirage.png'
import deckImperial from '../assets/cardbacks/deck-imperial.png'

export type CosmeticType = 'background' | 'flair' | 'avatar' | 'cardback' | 'felt'

export interface ShopItem {
  id: string
  type: CosmeticType
  name: string
  cost: number
  /** Render payload: a CSS colour for backgrounds, an emoji for flairs/avatars. */
  art: string
  /** Ultra-rare: never buyable and never in a normal loot pool, only obtainable
   *  via the rare loot-box pull (see SPECIAL_PULL_RATE). */
  special?: boolean
  /** Legendary: buyable from the shop at a high price, but kept OUT of the loot
   *  pool so it can only be earned by saving up (never randomly dropped). */
  legendary?: boolean
}

// Free defaults every player owns from the start, so profiles always render.
export const DEFAULT_AVATAR = 'avatar-chip'
export const DEFAULT_FLAIR = ''
export const DEFAULT_BACKGROUND = 'bg-felt'
export const DEFAULT_CARDBACK = 'deck-classic'
export const DEFAULT_FELT = 'felt-classic'

export const SHOP: ShopItem[] = [
  // ---- backgrounds (profile header wash) ----
  { id: 'bg-felt', type: 'background', name: 'Classic felt', cost: 0, art: 'linear-gradient(135deg,#5b7461,#43544a)' },
  { id: 'bg-sunset', type: 'background', name: 'Sunset', cost: 150, art: 'linear-gradient(135deg,#b16a52,#c79a4a)' },
  { id: 'bg-ocean', type: 'background', name: 'Ocean', cost: 150, art: 'linear-gradient(135deg,#3a5a8c,#5b7461)' },
  { id: 'bg-plum', type: 'background', name: 'Plum', cost: 200, art: 'linear-gradient(135deg,#6d4a6b,#3a5a8c)' },
  { id: 'bg-mono', type: 'background', name: 'Graphite', cost: 250, art: 'linear-gradient(135deg,#3a3630,#221f19)' },
  { id: 'bg-rose', type: 'background', name: 'Rosewood', cost: 300, art: 'linear-gradient(135deg,#7d3b4a,#46232c)' },
  { id: 'bg-aurora', type: 'background', name: 'Aurora', cost: 450, art: 'linear-gradient(135deg,#2f6d5e,#3a5a8c 55%,#6d4a6b)' },
  { id: 'bg-midnight', type: 'background', name: 'Midnight run', cost: 500, art: 'linear-gradient(135deg,#1f2a44,#0f1626)' },
  { id: 'bg-gold', type: 'background', name: 'High roller', cost: 600, art: 'linear-gradient(135deg,#c79a4a,#8a6d2f)' },
  { id: 'bg-ember', type: 'background', name: 'Ember', cost: 800, art: 'linear-gradient(135deg,#b1442c,#6d2118)' },
  { id: 'bg-prism', type: 'background', name: 'Prism', cost: 1200, art: 'linear-gradient(120deg,#b16a52,#c79a4a 35%,#5b7461 70%,#3a5a8c)' },

  // ---- flairs (a little badge beside your name) ----
  { id: 'flair-fire', type: 'flair', name: 'On fire', cost: 200, art: '🔥' },
  { id: 'flair-star', type: 'flair', name: 'Rising star', cost: 200, art: '⭐' },
  { id: 'flair-clover', type: 'flair', name: 'Lucky clover', cost: 250, art: '🍀' },
  { id: 'flair-spade', type: 'flair', name: 'Spade', cost: 250, art: '♠️' },
  { id: 'flair-target', type: 'flair', name: 'Sharpshooter', cost: 350, art: '🎯' },
  { id: 'flair-crown', type: 'flair', name: 'Crown', cost: 500, art: '👑' },
  { id: 'flair-rocket', type: 'flair', name: 'Rocket', cost: 500, art: '🚀' },
  { id: 'flair-diamond', type: 'flair', name: 'Diamond', cost: 800, art: '💎' },
  { id: 'flair-goat', type: 'flair', name: 'GOAT', cost: 1500, art: '🐐' },

  // ---- avatars (animal placeholders; real art later) ----
  { id: 'avatar-chip', type: 'avatar', name: 'House chip', cost: 0, art: '🎰' },
  { id: 'avatar-owl', type: 'avatar', name: 'Owl', cost: 400, art: '🦉' },
  { id: 'avatar-octopus', type: 'avatar', name: 'Kraken', cost: 550, art: '🐙' },
  { id: 'avatar-snake', type: 'avatar', name: 'Cobra', cost: 600, art: '🐍' },
  { id: 'avatar-wolf', type: 'avatar', name: 'Wolf', cost: 800, art: '🐺' },
  { id: 'avatar-eagle', type: 'avatar', name: 'Eagle', cost: 900, art: '🦅' },
  { id: 'avatar-croc', type: 'avatar', name: 'Croc', cost: 1100, art: '🐊' },
  { id: 'avatar-whale', type: 'avatar', name: 'Whale', cost: 2500, art: '🐋' },
  { id: 'avatar-dragon', type: 'avatar', name: 'Dragon', cost: 1500, art: '🐉' },
  { id: 'avatar-unicorn', type: 'avatar', name: 'Unicorn', cost: 1200, art: '🦄' },

  // ---- card backs (the design on opponents' face-down cards at the table) ----
  // Layered CSS backgrounds: a centre sheen / pattern over a base gradient, so
  // each deck reads as an actual card-back motif (weave, argyle, dots, medallion)
  // rather than a flat wash. Top layer first.
  {
    id: 'deck-classic',
    type: 'cardback',
    name: 'Claret',
    cost: 0,
    art: `url(\"${deckClassic}\") center / cover no-repeat`,
  },
  {
    id: 'deck-midnight',
    type: 'cardback',
    name: 'Midnight weave',
    cost: 300,
    art: `url(\"${deckMidnight}\") center / cover no-repeat`,
  },
  {
    id: 'deck-emerald',
    type: 'cardback',
    name: 'Emerald weave',
    cost: 300,
    art: `url(\"${deckEmerald}\") center / cover no-repeat`,
  },
  {
    id: 'deck-slate',
    type: 'cardback',
    name: 'Slate pinstripe',
    cost: 400,
    art: `url(\"${deckSlate}\") center / cover no-repeat`,
  },
  {
    id: 'deck-plum',
    type: 'cardback',
    name: 'Plum argyle',
    cost: 450,
    art: `url(\"${deckPlum}\") center / cover no-repeat`,
  },
  {
    id: 'deck-candy',
    type: 'cardback',
    name: 'Bubblegum dots',
    cost: 600,
    art: `url(\"${deckCandy}\") center / cover no-repeat`,
  },
  {
    id: 'deck-royal',
    type: 'cardback',
    name: 'Royal cross',
    cost: 700,
    art: `url(\"${deckRoyal}\") center / cover no-repeat`,
  },
  {
    id: 'deck-gold',
    type: 'cardback',
    name: 'Gold medallion',
    cost: 1000,
    art: `url(\"${deckGold}\") center / cover no-repeat`,
  },
  // store-exclusive legendary card backs (buyable only, never dropped from loot)
  {
    id: 'deck-mirage',
    type: 'cardback',
    name: 'Mirage',
    cost: 6000,
    legendary: true,
    art: `url(\"${deckMirage}\") center / cover no-repeat`,
  },
  {
    id: 'deck-imperial',
    type: 'cardback',
    name: 'Imperial',
    cost: 9000,
    legendary: true,
    art: `url(\"${deckImperial}\") center / cover no-repeat`,
  },

  // ---- ultra-rare specials (loot-box only, ~2% pull; never buyable) ----
  { id: 'avatar-celestial', type: 'avatar', name: 'Celestial Dragon', cost: 5000, art: '🐲', special: true },
  { id: 'avatar-fish', type: 'avatar', name: 'Fish', cost: 5000, art: '🐟', special: true },

  // ---- legendary (buyable only, never dropped from a loot box) ----
  { id: 'avatar-donkey', type: 'avatar', name: 'Donkey', cost: 10000, art: '🫏', legendary: true },
  { id: 'avatar-shark', type: 'avatar', name: 'Shark', cost: 20000, art: '🦈', legendary: true },

  // ---- table felts (the colour of the felt you play on) ----
  { id: 'felt-classic', type: 'felt', name: 'Casino green', cost: 0, art: 'radial-gradient(circle at 50% 34%,#7e9a85 0%,#67836f 46%,#51695a 100%)' },
  { id: 'felt-sapphire', type: 'felt', name: 'Sapphire', cost: 350, art: 'radial-gradient(circle at 50% 34%,#6f88a8 0%,#56708f 46%,#41566f 100%)' },
  { id: 'felt-crimson', type: 'felt', name: 'Crimson', cost: 400, art: 'radial-gradient(circle at 50% 34%,#a86b6b 0%,#8c5050 46%,#6f3a3a 100%)' },
  { id: 'felt-violet', type: 'felt', name: 'Violet', cost: 450, art: 'radial-gradient(circle at 50% 34%,#8a7298 0%,#6d5780 46%,#523f63 100%)' },
  { id: 'felt-onyx', type: 'felt', name: 'Onyx', cost: 500, art: 'radial-gradient(circle at 50% 34%,#545b63 0%,#3f454c 46%,#2c3036 100%)' },
  { id: 'felt-teal', type: 'felt', name: 'Teal', cost: 600, art: 'radial-gradient(circle at 50% 34%,#5e9a93 0%,#467a74 46%,#2f5a55 100%)' },
  { id: 'felt-sahara', type: 'felt', name: 'Sahara', cost: 900, art: 'radial-gradient(circle at 50% 34%,#c2b08a 0%,#a89570 46%,#8a7a56 100%)' },
]

const BY_ID = new Map(SHOP.map((i) => [i.id, i]))
export const shopItem = (id: string | undefined | null): ShopItem | undefined => (id ? BY_ID.get(id) : undefined)

/** Items free for everyone, never need buying, always "owned". */
export const FREE_IDS: string[] = SHOP.filter((i) => i.cost === 0).map((i) => i.id)

export const itemsOfType = (type: CosmeticType): ShopItem[] => SHOP.filter((i) => i.type === type)

// ---- loot box --------------------------------------------------------------
// One Mystery Box: a flat 400 PP gamble for a random cosmetic you don't own yet.
// Everything in the shop is on the table, from a 150 PP background up to the
// 20000 Shark and the legendary card backs, plus a rare 2% shot at an ultra-rare
// special. Free items are never in the pool (you already own them); the specials
// are reachable via the 2% pull, so every item in the game can be won from a box.
export interface LootBox {
  id: string
  name: string
  /** PP price to open. */
  cost: number
  blurb: string
  /** Emoji shown on the box. */
  art: string
  /** Accent colour for the card. */
  tint: string
  /** Candidate item ids this box can yield (before filtering out owned ones). */
  pool: () => string[]
}

/** Ids of the ultra-rare specials (loot-only) and the buyable legendaries. Both
 *  are "rare" drops: they only ever arrive via the 2% per-item pull, never from
 *  the normal band. Specials must stay obtainable (they can't be bought), so a
 *  box can still guarantee one when nothing else is left; legendaries can just be
 *  bought, so a box is NOT openable when only legendaries remain. */
export const SPECIAL_IDS: string[] = SHOP.filter((i) => i.special).map((i) => i.id)
export const LEGENDARY_IDS: string[] = SHOP.filter((i) => i.legendary).map((i) => i.id)
/** Every rare that rides the 2% pull, in the order it's rolled. */
export const RARE_PULL_IDS: string[] = [...SPECIAL_IDS, ...LEGENDARY_IDS]
export const SPECIAL_PULL_RATE = 0.02

export const LOOT_BOXES: LootBox[] = [
  {
    id: 'box-mystery',
    name: 'Mystery Box',
    cost: 400,
    blurb: 'A random item you don’t own, plus a rare 2% shot at a special or legendary',
    art: '🎁',
    tint: '#c79a4a',
    // the normal band is commons only; specials AND legendaries are excluded and
    // only reachable via the 2% rare pull (see openLootBox).
    pool: () => SHOP.filter((i) => !i.special && !i.legendary && i.cost > 0).map((i) => i.id),
  },
]

/** The single mystery box. */
export const MYSTERY_BOX = LOOT_BOXES[0]

export const lootBox = (id: string | undefined | null): LootBox | undefined =>
  id ? LOOT_BOXES.find((b) => b.id === id) : undefined
