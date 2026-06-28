import { shopItem, DEFAULT_AVATAR } from '../lib/shop'

/** Round avatar with an optional background wash. Emoji art for now. Prestige
 *  avatars (loot-only specials + buyable legendaries) gently pulse to stand out. */
export function Avatar({ id, background, size = 40 }: { id?: string; background?: string; size?: number }) {
  const item = shopItem(id || DEFAULT_AVATAR)
  const art = item?.art ?? '🎰'
  const prestige = !!(item?.special || item?.legendary)
  const bg = background ? shopItem(background)?.art : undefined
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border ${prestige ? 'border-amber-400/60' : 'border-line'}`}
      style={{ width: size, height: size, background: bg ?? 'rgb(var(--c-paper2))' }}
    >
      <span className={prestige ? 'animate-prestige' : undefined} style={{ fontSize: size * 0.56, lineHeight: 1 }}>
        {art}
      </span>
    </span>
  )
}

/** Small flair badge beside a name, or nothing if none equipped. */
export function Flair({ id, size = 14 }: { id?: string; size?: number }) {
  const art = id ? shopItem(id)?.art : undefined
  if (!art) return null
  return (
    <span aria-hidden style={{ fontSize: size, lineHeight: 1 }}>
      {art}
    </span>
  )
}
