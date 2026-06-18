import { useEffect, useState } from 'react'
import { Check, Coins, Lock, Sparkles, UserPlus, UserMinus, Search, ChevronDown } from 'lucide-react'
import { getAchievements, type Achievement } from '../lib/achievements'
import { pointsState, owned, equipped, equip, buyItem } from '../lib/points'
import { itemsOfType, type ShopItem, type CosmeticType } from '../lib/shop'
import {
  getHandle,
  setHandle,
  upsertProfile,
  fetchDailyLeaderboard,
  fetchAllTimeLeaderboard,
  fetchFriendsLeaderboard,
  searchByHandle,
  getFriends,
  addFriend,
  removeFriend,
  claimDailyWinIfTop,
  type DailyRow,
  type LeaderRow,
} from '../lib/leaderboard'
import { gatherLocal } from '../lib/sync'
import { dayKey } from '../lib/daily'
import { Avatar, Flair } from './Avatar'

interface Props {
  version: number
  configured: boolean
  userId: string | null
  onSignIn: () => void
  /** Bump app progress so PP/cosmetics refresh elsewhere. */
  onChanged: () => void
}

type Section = 'achievements' | 'daily' | 'alltime' | 'friends' | 'shop'
const SECTIONS: { id: Section; label: string }[] = [
  { id: 'achievements', label: 'Achievements' },
  { id: 'daily', label: 'Daily' },
  { id: 'alltime', label: 'All-time' },
  { id: 'friends', label: 'Friends' },
  { id: 'shop', label: 'Shop' },
]

const GROUPS: Achievement['group'][] = ['Volume', 'Accuracy', 'Streaks', 'Learning']

export default function ProfileScreen({ version, configured, userId, onSignIn, onChanged }: Props) {
  const [section, setSection] = useState<Section>('achievements')
  const [items, setItems] = useState<Achievement[] | null>(null)
  const [balance, setBalance] = useState(0)
  const [eq, setEq] = useState(equipped())
  const [ownedIds, setOwnedIds] = useState<string[]>(owned())
  const [handle, setHandleState] = useState(getHandle())
  const [daily, setDaily] = useState<DailyRow[] | null>(null)
  const [allTime, setAllTime] = useState<LeaderRow[] | null>(null)
  const [friendIds, setFriendIds] = useState<string[]>(getFriends())
  const [friendRows, setFriendRows] = useState<LeaderRow[] | null>(null)
  const [friendSearch, setFriendSearch] = useState('')
  const [searchResults, setSearchResults] = useState<LeaderRow[] | null>(null)
  const [searching, setSearching] = useState(false)

  const refreshLocal = () => {
    pointsState().then((s) => setBalance(s.balance))
    setEq(equipped())
    setOwnedIds(owned())
  }

  useEffect(() => {
    getAchievements().then(setItems)
    refreshLocal()
  }, [version])

  // claim yesterday's daily-win bonus if we topped the board
  useEffect(() => {
    if (configured && userId) claimDailyWinIfTop(userId).then((won) => won && onChanged())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, userId])

  useEffect(() => {
    if (section === 'daily') fetchDailyLeaderboard(dayKey()).then(setDaily)
    if (section === 'alltime') fetchAllTimeLeaderboard().then(setAllTime)
    if (section === 'friends') fetchFriendsLeaderboard(friendIds).then(setFriendRows)
  }, [section, version, friendIds])

  async function saveHandle() {
    setHandle(handle)
    setHandleState(getHandle())
    if (userId) {
      await upsertProfile(userId, await gatherLocal())
      onChanged()
    }
  }

  async function onEquip(slot: CosmeticType, id: string) {
    equip(slot, id)
    setEq(equipped())
    if (userId) await upsertProfile(userId, await gatherLocal())
    onChanged()
  }

  async function onBuy(item: ShopItem) {
    const res = await buyItem(item.id)
    if (res.ok) {
      await onEquip(item.type, item.id)
      refreshLocal()
      onChanged()
    }
  }

  if (!items) return null
  const done = items.filter((a) => a.done).length

  return (
    <div className="px-4 pb-28 pt-6 max-w-xl lg:max-w-2xl mx-auto flex flex-col gap-5">
      {/* profile header */}
      <div
        className="relative overflow-hidden rounded-3xl border border-line p-5"
        style={{ background: undefined }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-90" style={{ background: bgWash(eq.background) }} />
        <div className="relative flex items-center gap-4">
          <Avatar id={eq.avatar} size={64} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <input
                value={handle}
                onChange={(e) => setHandleState(e.target.value)}
                onBlur={saveHandle}
                placeholder="Player"
                maxLength={24}
                className="min-w-0 flex-1 border-b border-transparent bg-transparent py-0.5 font-semibold text-white outline-none placeholder:text-white/60 focus:border-white/50"
                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}
              />
              <Flair id={eq.flair} size={18} />
            </div>
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1 text-sm font-bold tabular-nums text-white backdrop-blur">
              <Coins size={14} /> {balance} PP
            </span>
          </div>
        </div>
      </div>

      {/* section switch — scrollable so 5 tabs fit on narrow screens */}
      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-line bg-ink/[0.06] p-1 text-sm [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition ${
              section === s.id ? 'bg-sage text-white shadow-[0_4px_12px_-4px_rgba(67,84,72,0.6)]' : 'text-ink2 hover:text-ink'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === 'achievements' && (
        <>
          <p className="px-1 text-sm text-ink2">{done} of {items.length} unlocked. Keep drilling to fill the bars.</p>
          {GROUPS.map((g) => {
            const rows = items.filter((a) => a.group === g)
            if (!rows.length) return null
            return (
              <section key={g} className="flex flex-col gap-2.5">
                <h2 className="px-1 text-xs uppercase tracking-wide text-ink3">{g}</h2>
                {rows.map((a) => (
                  <AchRow key={a.id} a={a} />
                ))}
              </section>
            )
          })}
        </>
      )}

      {section === 'daily' && (
        <LeaderboardPanel
          configured={configured}
          userId={userId}
          onSignIn={onSignIn}
          empty="No scores yet today — be the first to climb the ladder."
          rows={daily}
          render={(r: DailyRow, i) => (
            <Row key={r.user_id} rank={i + 1} me={r.user_id === userId} avatar={r.avatar} flair={r.flair} name={r.handle}>
              <span className="flex shrink-0 items-center gap-1 text-sm font-bold tabular-nums text-sage-dark">
                {r.score}
                <span className="text-ink3">/20</span>
              </span>
            </Row>
          )}
        />
      )}

      {section === 'alltime' && (
        <LeaderboardPanel
          configured={configured}
          userId={userId}
          onSignIn={onSignIn}
          empty="No players yet — earn some Poker Points to appear here."
          rows={allTime}
          render={(r: LeaderRow, i) => (
            <Row key={r.user_id} rank={i + 1} me={r.user_id === userId} avatar={r.avatar} flair={r.flair} name={r.handle}>
              <span className="flex shrink-0 items-center gap-1 text-sm font-bold tabular-nums text-clay">
                <Coins size={13} /> {r.pp_earned}
              </span>
            </Row>
          )}
        />
      )}

      {section === 'friends' && (
        <FriendsPanel
          configured={configured}
          userId={userId}
          onSignIn={onSignIn}
          friendIds={friendIds}
          friendRows={friendRows}
          friendSearch={friendSearch}
          setFriendSearch={setFriendSearch}
          searchResults={searchResults}
          searching={searching}
          onSearch={async () => {
            setSearching(true)
            setSearchResults(await searchByHandle(friendSearch))
            setSearching(false)
          }}
          onAdd={(id) => {
            addFriend(id)
            const next = getFriends()
            setFriendIds(next)
            setSearchResults(null)
            setFriendSearch('')
          }}
          onRemove={(id) => {
            removeFriend(id)
            setFriendIds(getFriends())
          }}
        />
      )}

      {section === 'shop' && (
        <Shop balance={balance} owned={ownedIds} equipped={eq} onBuy={onBuy} onEquip={onEquip} />
      )}
    </div>
  )
}

/** Subtle gradient wash behind the profile header from the equipped background. */
function bgWash(id: string): string {
  // shop background `art` is itself a CSS gradient string
  const item = itemsOfType('background').find((b) => b.id === id)
  return item?.art ?? 'linear-gradient(135deg,#5b7461,#43544a)'
}

function AchRow({ a }: { a: Achievement }) {
  const Icon = a.icon
  const pct = Math.round(a.progress * 100)
  return (
    <div className={`rounded-xl border p-3.5 ${a.done ? 'bg-sage/10 border-sage/30' : 'bg-paper2 border-line'}`}>
      <div className="flex items-center gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            a.done ? 'bg-sage text-white dark:text-paper animate-spring' : 'bg-ink/[0.06] text-ink3'
          }`}
        >
          {a.done ? <Check size={18} /> : <Icon size={17} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className={`font-semibold ${a.done ? 'text-sage-dark' : 'text-ink'}`}>{a.title}</span>
            <span className="flex shrink-0 items-center gap-2 text-xs tabular-nums text-ink3">
              {a.reward > 0 && <span className="text-clay">+{a.reward} PP</span>}
              {a.label}
            </span>
          </div>
          <p className="text-[13px] text-ink2 leading-snug">{a.desc}</p>
        </div>
      </div>
      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.07]">
        <div className={`h-full rounded-full transition-all ${a.done ? 'bg-sage' : 'bg-sage/60'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Row({
  rank,
  me,
  avatar,
  flair,
  name,
  children,
  onClick,
}: {
  rank: number
  me: boolean
  avatar: string
  flair: string
  name: string
  children: React.ReactNode
  /** When set, the row is tappable (used to expand a friend's stats). */
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
        me ? 'bg-sage/10 border-sage/30' : 'bg-paper2 border-line'
      } ${onClick ? 'cursor-pointer select-none transition hover:border-sage/40' : ''}`}
    >
      <span className="w-5 shrink-0 text-center text-sm font-bold tabular-nums text-ink3">{rank}</span>
      <Avatar id={avatar} size={30} />
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="truncate font-semibold text-ink">{name}</span>
        <Flair id={flair} />
      </span>
      {children}
    </div>
  )
}

/** Headline stats shown when a friend row is expanded. */
function FriendStats({ r }: { r: LeaderRow }) {
  const stats: { label: string; value: string | number }[] = [
    { label: 'Hands', value: r.hands_played },
    { label: 'Accuracy', value: `${r.accuracy}%` },
    { label: 'Best run', value: r.best_streak },
    { label: 'PP', value: r.pp_earned },
  ]
  return (
    <div className="-mt-0.5 grid grid-cols-4 gap-2 rounded-xl border border-line bg-ink/[0.03] px-3 py-3">
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col items-center gap-0.5">
          <span className="text-sm font-bold tabular-nums text-ink">{s.value}</span>
          <span className="text-center text-[10px] uppercase leading-tight tracking-wide text-ink3">{s.label}</span>
        </div>
      ))}
    </div>
  )
}

function LeaderboardPanel<T>({
  configured,
  userId,
  onSignIn,
  rows,
  render,
  empty,
}: {
  configured: boolean
  userId: string | null
  onSignIn: () => void
  rows: T[] | null
  render: (row: T, i: number) => React.ReactNode
  empty: string
}) {
  if (!configured)
    return <p className="px-1 text-sm text-ink2">Leaderboards turn on once cloud sync is configured.</p>
  if (!userId)
    return (
      <div className="panel flex items-center justify-between gap-3 p-4 text-sm text-ink2">
        <span>Sign in to compare with everyone.</span>
        <button onClick={onSignIn} className="btn btn-primary shrink-0 px-3 py-2 text-sm">
          Sign in
        </button>
      </div>
    )
  if (rows === null) return <p className="px-1 text-sm text-ink2">Loading…</p>
  if (rows.length === 0) return <p className="px-1 text-sm text-ink2">{empty}</p>
  return <div className="flex flex-col gap-1.5">{rows.map(render)}</div>
}

function FriendsPanel({
  configured,
  userId,
  onSignIn,
  friendIds,
  friendRows,
  friendSearch,
  setFriendSearch,
  searchResults,
  searching,
  onSearch,
  onAdd,
  onRemove,
}: {
  configured: boolean
  userId: string | null
  onSignIn: () => void
  friendIds: string[]
  friendRows: LeaderRow[] | null
  friendSearch: string
  setFriendSearch: (q: string) => void
  searchResults: LeaderRow[] | null
  searching: boolean
  onSearch: () => void
  onAdd: (id: string) => void
  onRemove: (id: string) => void
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  if (!configured)
    return <p className="px-1 text-sm text-ink2">Friends require cloud sync to be configured.</p>
  if (!userId)
    return (
      <div className="panel flex items-center justify-between gap-3 p-4 text-sm text-ink2">
        <span>Sign in to add friends.</span>
        <button onClick={onSignIn} className="btn btn-primary shrink-0 px-3 py-2 text-sm">Sign in</button>
      </div>
    )

  return (
    <div className="flex flex-col gap-4">
      {/* search */}
      <div className="flex gap-2">
        <input
          value={friendSearch}
          onChange={(e) => setFriendSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          placeholder="Search by username…"
          style={{ fontSize: '16px' }}
          className="min-w-0 flex-1 rounded-xl border border-line bg-paper2 px-3 py-2 text-ink outline-none focus:border-sage"
        />
        <button
          onClick={onSearch}
          disabled={searching || !friendSearch.trim()}
          className="btn btn-primary flex shrink-0 items-center gap-1.5 px-3 py-2 text-sm disabled:opacity-50"
        >
          <Search size={14} /> {searching ? '…' : 'Search'}
        </button>
      </div>

      {/* search results */}
      {searchResults !== null && (
        <div className="flex flex-col gap-1.5">
          {searchResults.length === 0 && (
            <p className="px-1 text-sm text-ink3">No players found.</p>
          )}
          {searchResults.filter((r) => r.user_id !== userId).map((r) => {
            const isFriend = friendIds.includes(r.user_id)
            return (
              <div key={r.user_id} className="flex items-center gap-3 rounded-xl border border-line bg-paper2 px-3 py-2.5">
                <Avatar id={r.avatar} size={30} />
                <span className="min-w-0 flex-1 truncate font-semibold text-ink">{r.handle}</span>
                <span className="shrink-0 text-xs tabular-nums text-ink3">{r.pp_earned} PP</span>
                <button
                  onClick={() => isFriend ? onRemove(r.user_id) : onAdd(r.user_id)}
                  className={`shrink-0 rounded-lg p-1.5 transition ${isFriend ? 'text-clay hover:bg-clay/10' : 'text-sage-dark hover:bg-sage/10'}`}
                >
                  {isFriend ? <UserMinus size={16} /> : <UserPlus size={16} />}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* friends list */}
      {friendIds.length === 0 ? (
        <p className="px-1 text-sm text-ink3">Search for a player by username to add them as a friend.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <p className="px-1 text-xs uppercase tracking-wide text-ink3">Your friends</p>
          {friendRows === null ? (
            <p className="px-1 text-sm text-ink2">Loading…</p>
          ) : friendRows.map((r, i) => {
            const open = expanded === r.user_id
            return (
              <div key={r.user_id} className="flex flex-col gap-1.5">
                <Row
                  rank={i + 1}
                  me={r.user_id === userId}
                  avatar={r.avatar}
                  flair={r.flair}
                  name={r.handle}
                  onClick={() => setExpanded(open ? null : r.user_id)}
                >
                  <span className="flex shrink-0 items-center gap-1 text-sm font-bold tabular-nums text-clay">
                    <Coins size={13} /> {r.pp_earned}
                  </span>
                  <ChevronDown
                    size={15}
                    className={`shrink-0 text-ink3 transition-transform ${open ? 'rotate-180' : ''}`}
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemove(r.user_id) }}
                    className="ml-1 shrink-0 rounded-lg p-1 text-ink3 hover:text-clay hover:bg-clay/10 transition"
                  >
                    <UserMinus size={15} />
                  </button>
                </Row>
                {open && <FriendStats r={r} />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Shop({
  balance,
  owned,
  equipped,
  onBuy,
  onEquip,
}: {
  balance: number
  owned: string[]
  equipped: { avatar: string; flair: string; background: string }
  onBuy: (item: ShopItem) => void
  onEquip: (slot: CosmeticType, id: string) => void
}) {
  const groups: { type: CosmeticType; label: string }[] = [
    { type: 'avatar', label: 'Avatars' },
    { type: 'flair', label: 'Flairs' },
    { type: 'background', label: 'Backgrounds' },
  ]
  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => (
        <section key={g.type} className="flex flex-col gap-2.5">
          <h2 className="px-1 text-xs uppercase tracking-wide text-ink3">{g.label}</h2>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {itemsOfType(g.type).map((item) => {
              const isOwned = owned.includes(item.id)
              const isOn = equipped[g.type] === item.id
              const affordable = balance >= item.cost
              return (
                <div
                  key={item.id}
                  className={`flex flex-col items-center gap-2 rounded-2xl border p-3 ${
                    isOn ? 'border-sage/50 bg-sage/10' : 'border-line bg-paper2'
                  }`}
                >
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-line text-2xl"
                    style={{ background: g.type === 'background' ? item.art : 'rgb(var(--c-paper))' }}
                  >
                    {g.type !== 'background' && item.art}
                  </span>
                  <span className="text-center text-xs font-semibold text-ink">{item.name}</span>
                  {isOwned ? (
                    <button
                      onClick={() => onEquip(g.type, item.id)}
                      disabled={isOn}
                      className={`w-full rounded-lg py-1.5 text-xs font-semibold transition ${
                        isOn ? 'bg-sage/15 text-sage-dark' : 'bg-ink/[0.06] text-ink hover:bg-ink/10'
                      }`}
                    >
                      {isOn ? 'Equipped' : 'Equip'}
                    </button>
                  ) : (
                    <button
                      onClick={() => onBuy(item)}
                      disabled={!affordable}
                      className={`flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-bold transition ${
                        affordable ? 'bg-clay/15 text-clay hover:bg-clay/25' : 'bg-ink/[0.05] text-ink3'
                      }`}
                    >
                      {affordable ? <Coins size={12} /> : <Lock size={12} />} {item.cost}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ))}
      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-ink3">
        <Sparkles size={13} /> Earn Poker Points for every correct hand, achievement, and daily challenge.
      </p>
    </div>
  )
}
