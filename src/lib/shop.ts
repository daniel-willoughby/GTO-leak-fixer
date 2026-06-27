// Cosmetic shop catalog. Three kinds of item — background colours, flairs, and
// animal avatars — bought with Poker Points and shown on your profile and the
// leaderboards. Avatar artwork comes later; for now each avatar renders an emoji
// placeholder (the `art` field), so the economy and UI work end-to-end today.

export type CosmeticType = 'background' | 'flair' | 'avatar' | 'cardback' | 'felt'

export interface ShopItem {
  id: string
  type: CosmeticType
  name: string
  cost: number
  /** Render payload: a CSS colour for backgrounds, an emoji for flairs/avatars. */
  art: string
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
  { id: 'flair-ice', type: 'flair', name: 'Ice cold', cost: 400, art: '🧊' },
  { id: 'flair-joker', type: 'flair', name: 'Wildcard', cost: 450, art: '🃏' },
  { id: 'flair-crown', type: 'flair', name: 'Crown', cost: 500, art: '👑' },
  { id: 'flair-rocket', type: 'flair', name: 'Rocket', cost: 500, art: '🚀' },
  { id: 'flair-brain', type: 'flair', name: 'Big brain', cost: 600, art: '🧠' },
  { id: 'flair-diamond', type: 'flair', name: 'Diamond', cost: 800, art: '💎' },
  { id: 'flair-goat', type: 'flair', name: 'GOAT', cost: 1500, art: '🐐' },

  // ---- avatars (animal placeholders; real art later) ----
  { id: 'avatar-chip', type: 'avatar', name: 'House chip', cost: 0, art: '🎰' },
  { id: 'avatar-fox', type: 'avatar', name: 'Fox', cost: 400, art: '🦊' },
  { id: 'avatar-owl', type: 'avatar', name: 'Owl', cost: 400, art: '🦉' },
  { id: 'avatar-octopus', type: 'avatar', name: 'Kraken', cost: 550, art: '🐙' },
  { id: 'avatar-snake', type: 'avatar', name: 'Cobra', cost: 600, art: '🐍' },
  { id: 'avatar-wolf', type: 'avatar', name: 'Wolf', cost: 800, art: '🐺' },
  { id: 'avatar-eagle', type: 'avatar', name: 'Eagle', cost: 900, art: '🦅' },
  { id: 'avatar-lion', type: 'avatar', name: 'Lion', cost: 1000, art: '🦁' },
  { id: 'avatar-croc', type: 'avatar', name: 'Croc', cost: 1100, art: '🐊' },
  { id: 'avatar-shark', type: 'avatar', name: 'Shark', cost: 2500, art: '🦈' },
  { id: 'avatar-dragon', type: 'avatar', name: 'Dragon', cost: 1500, art: '🐉' },
  { id: 'avatar-unicorn', type: 'avatar', name: 'Unicorn', cost: 1200, art: '🦄' },

  // ---- card backs (the design on opponents' face-down cards at the table) ----
  { id: 'deck-classic', type: 'cardback', name: 'Claret', cost: 0, art: 'linear-gradient(150deg,#9c4234,#863a2d 48%,#6f2f25)' },
  { id: 'deck-midnight', type: 'cardback', name: 'Midnight', cost: 300, art: 'linear-gradient(150deg,#2b3a63,#1d2747 48%,#141b33)' },
  { id: 'deck-emerald', type: 'cardback', name: 'Emerald', cost: 300, art: 'linear-gradient(150deg,#2f6d54,#245742 48%,#173a2c)' },
  { id: 'deck-slate', type: 'cardback', name: 'Slate', cost: 400, art: 'linear-gradient(150deg,#3a4048,#2a2f36 48%,#1c2026)' },
  { id: 'deck-plum', type: 'cardback', name: 'Plum', cost: 450, art: 'linear-gradient(150deg,#6d4a6b,#4f3450 48%,#33213a)' },
  { id: 'deck-candy', type: 'cardback', name: 'Bubblegum', cost: 600, art: 'linear-gradient(150deg,#c45a7a,#a23f60 48%,#7c2c47)' },
  { id: 'deck-gold', type: 'cardback', name: 'Gold leaf', cost: 1000, art: 'linear-gradient(150deg,#caa24c,#a8812f 48%,#7c5d1f)' },

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

/** Items free for everyone — never need buying, always "owned". */
export const FREE_IDS: string[] = SHOP.filter((i) => i.cost === 0).map((i) => i.id)

export const itemsOfType = (type: CosmeticType): ShopItem[] => SHOP.filter((i) => i.type === type)

// ---- loot boxes ------------------------------------------------------------
// A gamble for the indecisive: pay a fixed price for a random cosmetic you
// don't own yet, drawn from a price band. The box price sits a little above the
// band's average — you trade choice (and a small premium) for the thrill, with
// a real shot at an item worth far more than the box (a Vault can drop the 2500
// Shark). Free items are never in a pool — you already own them.
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

const inBand = (lo: number, hi: number): string[] => SHOP.filter((i) => i.cost > lo && i.cost <= hi).map((i) => i.id)

export const LOOT_BOXES: LootBox[] = [
  {
    id: 'box-lucky',
    name: 'Lucky Dip',
    cost: 250,
    blurb: 'A random common cosmetic',
    art: '🎁',
    tint: '#5b7461',
    pool: () => inBand(0, 300),
  },
  {
    id: 'box-chest',
    name: 'Treasure Chest',
    cost: 600,
    blurb: 'A mid-tier surprise',
    art: '🧰',
    tint: '#b16a52',
    pool: () => inBand(300, 800),
  },
  {
    id: 'box-vault',
    name: 'Legendary Vault',
    cost: 1400,
    blurb: 'A premium or rare drop',
    art: '💰',
    tint: '#c79a4a',
    pool: () => SHOP.filter((i) => i.cost > 800).map((i) => i.id),
  },
]

export const lootBox = (id: string | undefined | null): LootBox | undefined =>
  id ? LOOT_BOXES.find((b) => b.id === id) : undefined
