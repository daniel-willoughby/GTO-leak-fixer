// Cosmetic shop catalog. Three kinds of item — background colours, flairs, and
// animal avatars — bought with Poker Points and shown on your profile and the
// leaderboards. Avatar artwork comes later; for now each avatar renders an emoji
// placeholder (the `art` field), so the economy and UI work end-to-end today.

export type CosmeticType = 'background' | 'flair' | 'avatar'

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
  { id: 'avatar-shark', type: 'avatar', name: 'Shark', cost: 1200, art: '🦈' },
  { id: 'avatar-dragon', type: 'avatar', name: 'Dragon', cost: 1500, art: '🐉' },
  { id: 'avatar-unicorn', type: 'avatar', name: 'Unicorn', cost: 2500, art: '🦄' },
]

const BY_ID = new Map(SHOP.map((i) => [i.id, i]))
export const shopItem = (id: string | undefined | null): ShopItem | undefined => (id ? BY_ID.get(id) : undefined)

/** Items free for everyone — never need buying, always "owned". */
export const FREE_IDS: string[] = SHOP.filter((i) => i.cost === 0).map((i) => i.id)

export const itemsOfType = (type: CosmeticType): ShopItem[] => SHOP.filter((i) => i.type === type)
