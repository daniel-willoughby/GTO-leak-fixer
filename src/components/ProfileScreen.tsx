import { useEffect, useState } from 'react'
import { Check, Coins, Lock, Sparkles, UserPlus, UserCheck, Search, ChevronDown, Pencil, X } from 'lucide-react'
import { getAchievements, type Achievement } from '../lib/achievements'
import { pointsState, owned, equipped, equip, buyItem, claimNamedBonus } from '../lib/points'
import { itemsOfType, type ShopItem, type CosmeticType } from '../lib/shop'
import {
  getHandle,
  setHandle,
  sanitizeHandle,
  upsertProfile,
  syncDailyScores,
  fetchDailyLeaderboard,
  fetchAllTimeLeaderboard,
  fetchCrownsLeaderboard,
  fetchFriendsLeaderboard,
  searchByHandle,
  getFriends,
  addFriend,
  claimDailyWinIfTop,
  sendFriendRequest,
  fetchIncomingRequests,
  deleteFriendRequest,
  type DailyRow,
  type LeaderRow,
  type FriendRequest,
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

type Section = 'achievements' | 'leaderboards' | 'friends' | 'shop'
const SECTIONS: { id: Section; label: string }[] = [
  { id: 'achievements', label: 'Achievements' },
  { id: 'leaderboards', label: 'Leaderboards' },
  { id: 'friends', label: 'Friends' },
  { id: 'shop', label: 'Shop' },
]

// the Leaderboards tab switches between these boards with a sub-toggle
type BoardMode = 'daily' | 'alltime' | 'crowns'
const BOARD_MODES: { id: BoardMode; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'alltime', label: 'All-time' },
  { id: 'crowns', label: 'Crowns' },
]

const GROUPS: Achievement['group'][] = ['Volume', 'Accuracy', 'Streaks', 'Learning', 'Collection']

export default function ProfileScreen({ version, configured, userId, onSignIn, onChanged }: Props) {
  const [section, setSection] = useState<Section>('achievements')
  const [boardMode, setBoardMode] = useState<BoardMode>('daily')
  const [items, setItems] = useState<Achievement[] | null>(null)
  const [balance, setBalance] = useState(0)
  const [eq, setEq] = useState(equipped())
  const [ownedIds, setOwnedIds] = useState<string[]>(owned())
  const [handle, setHandleState] = useState(getHandle())
  const [daily, setDaily] = useState<DailyRow[] | null>(null)
  const [allTime, setAllTime] = useState<LeaderRow[] | null>(null)
  const [crowns, setCrowns] = useState<LeaderRow[] | null>(null)
  const [friendIds, setFriendIds] = useState<string[]>(getFriends())
  const [friendRows, setFriendRows] = useState<LeaderRow[] | null>(null)
  const [friendSearch, setFriendSearch] = useState('')
  const [searchResults, setSearchResults] = useState<LeaderRow[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [requests, setRequests] = useState<FriendRequest[]>([])

  const loadRequests = () => {
    if (userId) fetchIncomingRequests(userId).then(setRequests)
  }

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
    // Refetch only when the viewed section or friend set changes — not on every
    // `version` bump (which fires on each answered hand). The 30s read cache in
    // leaderboard.ts coalesces the rest.
    if (section === 'leaderboards' && boardMode === 'daily') fetchDailyLeaderboard(dayKey()).then(setDaily)
    if (section === 'leaderboards' && boardMode === 'alltime') fetchAllTimeLeaderboard().then(setAllTime)
    if (section === 'leaderboards' && boardMode === 'crowns') fetchCrownsLeaderboard().then(setCrowns)
    if (section === 'friends') {
      fetchFriendsLeaderboard(friendIds).then(setFriendRows)
      loadRequests()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, boardMode, friendIds])

  // keep the incoming-request inbox fresh whenever the signed-in user changes
  useEffect(() => {
    loadRequests()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // Friends are permanent once added — adding is idempotent, with no un-add.
  // Adding also pings the other player so they're notified and can add back.
  const addOnly = (id: string) => {
    if (getFriends().includes(id)) return
    addFriend(id)
    setFriendIds(getFriends())
    if (userId) sendFriendRequest(userId, id)
    onChanged() // persist the friends list to the cloud snapshot
  }

  // Accept an incoming request: add them back, then clear the request.
  const acceptRequest = async (req: FriendRequest) => {
    if (!getFriends().includes(req.from_user)) {
      addFriend(req.from_user)
      setFriendIds(getFriends())
    }
    await deleteFriendRequest(req.id)
    setRequests((rs) => rs.filter((r) => r.id !== req.id))
    if (section === 'friends') fetchFriendsLeaderboard(getFriends()).then(setFriendRows)
    onChanged()
  }

  const dismissRequest = async (req: FriendRequest) => {
    await deleteFriendRequest(req.id)
    setRequests((rs) => rs.filter((r) => r.id !== req.id))
  }

  async function saveHandle() {
    setHandle(handle)
    setHandleState(getHandle())
    // picking up a qualifying name (e.g. George) claims its one-off PP gift
    if (claimNamedBonus(getHandle())) refreshLocal()
    if (userId) {
      await upsertProfile(userId, await gatherLocal())
      // refresh the denormalised name on today's daily-leaderboard row too
      await syncDailyScores(userId)
      onChanged()
    }
  }

  async function onEquip(slot: CosmeticType, id: string) {
    equip(slot, id)
    setEq(equipped())
    if (userId) {
      await upsertProfile(userId, await gatherLocal())
      // the daily leaderboard renders a *denormalised* avatar/flair/background
      // copied onto each daily_scores row, so re-skinning must re-publish it or
      // the board keeps showing the old look until the next ladder run.
      await syncDailyScores(userId)
    }
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
            <div className="flex items-center gap-1.5">
              <input
                value={handle}
                onChange={(e) => setHandleState(sanitizeHandle(e.target.value))}
                onBlur={saveHandle}
                placeholder="Player"
                maxLength={24}
                size={Math.max((handle || 'Player').length, 4)}
                aria-label="Your display name"
                title="Tap to rename"
                // dashed underline + pencil hint so it reads as editable, not a label;
                // firms up to a solid line on focus
                className="min-w-0 max-w-full border-b border-dashed border-white/40 bg-transparent py-0.5 text-lg font-semibold text-white outline-none placeholder:text-white/60 focus:border-solid focus:border-white/70"
                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}
              />
              <Pencil size={13} className="shrink-0 text-white/55" aria-hidden />
              <Flair id={eq.flair} size={18} />
            </div>
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1 text-sm font-bold tabular-nums text-white backdrop-blur">
              <Coins size={14} /> {balance} PP
            </span>
          </div>
        </div>
      </div>

      {/* section switch — four tabs share the bar evenly (flex-1 each) */}
      <div className="flex gap-1 rounded-2xl border border-line bg-ink/[0.06] p-1 text-sm">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`flex-1 rounded-xl px-1 py-2 text-center text-xs font-semibold transition ${
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

      {section === 'leaderboards' && (
        <div className="flex flex-col gap-4">
          {/* sub-toggle: Daily ↔ All-time, both boards under one tab */}
          <div className="flex gap-1 rounded-xl border border-line bg-ink/[0.06] p-1 text-sm">
            {BOARD_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setBoardMode(m.id)}
                className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  boardMode === m.id ? 'bg-sage text-white shadow-[0_4px_12px_-4px_rgba(67,84,72,0.6)]' : 'text-ink2 hover:text-ink'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {boardMode === 'daily' ? (
            <LeaderboardPanel
              configured={configured}
              userId={userId}
              onSignIn={onSignIn}
              empty="No scores yet today — be the first to climb the ladder."
              rows={daily}
              render={(r: DailyRow, i) => {
                const me = r.user_id === userId
                const isFriend = friendIds.includes(r.user_id)
                return (
                  <Row
                    key={r.user_id}
                    rank={i + 1}
                    me={me}
                    avatar={r.avatar}
                    flair={r.flair}
                    name={r.handle}
                    background={r.background}
                    onClick={me || isFriend ? undefined : () => addOnly(r.user_id)}
                  >
                    <span className="flex shrink-0 items-center gap-1 text-sm font-bold tabular-nums text-sage-dark">
                      {r.score}
                      <span className="text-ink3">/20</span>
                    </span>
                    {!me && <FriendToggle isFriend={isFriend} />}
                  </Row>
                )
              }}
            />
          ) : boardMode === 'alltime' ? (
            <LeaderboardPanel
              configured={configured}
              userId={userId}
              onSignIn={onSignIn}
              empty="No players yet — earn some Poker Points to appear here."
              rows={allTime}
              render={(r: LeaderRow, i) => {
                const me = r.user_id === userId
                const isFriend = friendIds.includes(r.user_id)
                return (
                  <Row
                    key={r.user_id}
                    rank={i + 1}
                    me={me}
                    avatar={r.avatar}
                    flair={r.flair}
                    name={r.handle}
                    background={r.background}
                    onClick={me || isFriend ? undefined : () => addOnly(r.user_id)}
                  >
                    <span className="flex shrink-0 items-center gap-1 text-sm font-bold tabular-nums text-clay">
                      <Coins size={13} /> {r.pp_earned}
                    </span>
                    {!me && <FriendToggle isFriend={isFriend} />}
                  </Row>
                )
              }}
            />
          ) : (
            <LeaderboardPanel
              configured={configured}
              userId={userId}
              onSignIn={onSignIn}
              empty="No crowns yet — top the daily ladder to win one at reset."
              rows={crowns}
              render={(r: LeaderRow, i) => {
                const me = r.user_id === userId
                const isFriend = friendIds.includes(r.user_id)
                return (
                  <Row
                    key={r.user_id}
                    rank={i + 1}
                    me={me}
                    avatar={r.avatar}
                    flair={r.flair}
                    name={r.handle}
                    background={r.background}
                    onClick={me || isFriend ? undefined : () => addOnly(r.user_id)}
                  >
                    <span className="flex shrink-0 items-center gap-1 text-sm font-bold tabular-nums text-clay">
                      👑 {r.crowns}
                    </span>
                    {!me && <FriendToggle isFriend={isFriend} />}
                  </Row>
                )
              }}
            />
          )}
        </div>
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
          onAdd={addOnly}
          requests={requests}
          onAccept={acceptRequest}
          onDismiss={dismissRequest}
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
  background,
  children,
  onClick,
}: {
  rank: number
  me: boolean
  avatar: string
  flair: string
  name: string
  /** Equipped background id — tints the row with that player's colour. */
  background?: string
  children: React.ReactNode
  /** When set, the row is tappable (used to expand a friend's stats). */
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl border ${
        me ? 'bg-sage/10 border-sage/30' : 'bg-paper2 border-line'
      } ${onClick ? 'cursor-pointer select-none transition hover:border-sage/40' : ''}`}
    >
      {background && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{ background: bgWash(background) }}
        />
      )}
      <div className="relative flex items-center gap-3 px-3 py-2.5">
        <span className="w-5 shrink-0 text-center text-sm font-bold tabular-nums text-ink3">{rank}</span>
        <Avatar id={avatar} size={30} />
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="truncate font-semibold text-ink">{name}</span>
          <Flair id={flair} />
        </span>
        {children}
      </div>
    </div>
  )
}

/** Trailing indicator on a tappable leaderboard row: add or already-added. */
function FriendToggle({ isFriend }: { isFriend: boolean }) {
  return isFriend ? (
    <UserCheck size={16} className="shrink-0 text-sage-dark" />
  ) : (
    <UserPlus size={16} className="shrink-0 text-ink3" />
  )
}

/** Format a street accuracy that may be missing (-1 → no hands yet). */
const accLabel = (v: number): string => (v < 0 ? '—' : `${v}%`)

/** Headline stats shown when a friend row is expanded. */
function FriendStats({ r }: { r: LeaderRow }) {
  const stats: { label: string; value: string | number }[] = [
    { label: 'Hands', value: r.hands_played },
    { label: 'Best run', value: r.best_streak },
    { label: 'Preflop', value: accLabel(r.pre_acc) },
    { label: 'Postflop', value: accLabel(r.post_acc) },
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
  requests,
  onAccept,
  onDismiss,
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
  requests: FriendRequest[]
  onAccept: (req: FriendRequest) => void
  onDismiss: (req: FriendRequest) => void
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
      {/* incoming friend requests — the "you've been added" notification */}
      {requests.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="px-1 text-xs uppercase tracking-wide text-ink3">
            Friend requests · {requests.length}
          </p>
          {requests.map((req) => (
            <div
              key={req.id}
              className="flex items-center gap-3 rounded-xl border border-sage/30 bg-sage/[0.08] px-3 py-2.5"
            >
              <Avatar id={req.from_avatar} size={30} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 truncate">
                  <span className="truncate font-semibold text-ink">{req.from_handle}</span>
                  {req.from_flair && <Flair id={req.from_flair} size={14} />}
                </div>
                <p className="text-xs text-ink3">added you as a friend</p>
              </div>
              <button
                onClick={() => onAccept(req)}
                className="btn btn-primary flex shrink-0 items-center gap-1 px-2.5 py-1.5 text-xs"
              >
                <UserCheck size={14} /> Add back
              </button>
              <button
                onClick={() => onDismiss(req)}
                className="shrink-0 rounded-lg p-1.5 text-ink3 transition hover:bg-ink/[0.06] hover:text-ink2"
                aria-label={`Dismiss request from ${req.from_handle}`}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

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
                {isFriend ? (
                  <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-sage-dark">
                    <UserCheck size={15} /> Added
                  </span>
                ) : (
                  <button
                    onClick={() => onAdd(r.user_id)}
                    className="shrink-0 rounded-lg p-1.5 text-sage-dark transition hover:bg-sage/10"
                    aria-label={`Add ${r.handle} as a friend`}
                  >
                    <UserPlus size={16} />
                  </button>
                )}
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
                  background={r.background}
                  onClick={() => setExpanded(open ? null : r.user_id)}
                >
                  <span className="flex shrink-0 items-center gap-1 text-sm font-bold tabular-nums text-clay">
                    <Coins size={13} /> {r.pp_earned}
                  </span>
                  <ChevronDown
                    size={15}
                    className={`shrink-0 text-ink3 transition-transform ${open ? 'rotate-180' : ''}`}
                  />
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
  equipped: { avatar: string; flair: string; background: string; cardback: string; felt: string }
  onBuy: (item: ShopItem) => void
  onEquip: (slot: CosmeticType, id: string) => void
}) {
  const groups: { type: CosmeticType; label: string }[] = [
    { type: 'avatar', label: 'Avatars' },
    { type: 'flair', label: 'Flairs' },
    { type: 'background', label: 'Backgrounds' },
    { type: 'cardback', label: 'Card backs' },
    { type: 'felt', label: 'Table felts' },
  ]
  // these render their gradient `art` as the swatch fill (vs an emoji glyph)
  const isGradient = (t: CosmeticType) => t === 'background' || t === 'cardback' || t === 'felt'
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
                    className={`flex h-12 w-12 items-center justify-center border border-line text-2xl ${
                      g.type === 'cardback' ? 'rounded-lg' : 'rounded-full'
                    }`}
                    style={{ background: isGradient(g.type) ? item.art : 'rgb(var(--c-paper))' }}
                  >
                    {!isGradient(g.type) && item.art}
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
