import { useEffect, useState } from 'react'
import { Swords, Coins, Check, X } from 'lucide-react'
import { fetchFriendsLeaderboard, getFriends, type LeaderRow } from '../lib/leaderboard'
import { fetchDuels, settleFinishedDuels, duelOutcome, DUEL_LEN, type DuelRow } from '../lib/duel'
import { Avatar } from './Avatar'

interface Props {
  configured: boolean
  userId: string | null
  balance: number
  version: number
  onSignIn: () => void
  onChallenge: (opponent: { user_id: string; handle: string; avatar: string }, wager: number) => void
  onPlay: (duel: DuelRow) => void
  onDecline: (duel: DuelRow) => void
  /** Bump app progress when a duel settles (so the PP balance refreshes). */
  onChanged: () => void
}

export default function DuelsScreen({
  configured,
  userId,
  balance,
  version,
  onSignIn,
  onChallenge,
  onPlay,
  onDecline,
  onChanged,
}: Props) {
  const [friends, setFriends] = useState<LeaderRow[]>([])
  const [duels, setDuels] = useState<DuelRow[]>([])
  const [pick, setPick] = useState<string>('') // selected friend user_id
  const [wager, setWager] = useState<string>('0')

  useEffect(() => {
    if (!userId) return
    fetchFriendsLeaderboard(getFriends()).then((r) => setFriends(r.filter((f) => f.user_id !== userId)))
    fetchDuels(userId).then((d) => {
      if (settleFinishedDuels(userId, d)) onChanged() // a wager paid out → refresh PP
      setDuels(d)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, version])

  if (!configured)
    return <p className="px-1 pt-6 text-center text-sm text-ink2">Duels need cloud sync to be configured.</p>
  if (!userId)
    return (
      <div className="mx-auto mt-10 max-w-sm panel flex flex-col items-center gap-3 p-5 text-center text-sm text-ink2">
        <Swords size={28} className="text-clay" />
        <p>Sign in and add a friend to challenge them to a duel.</p>
        <button onClick={onSignIn} className="btn btn-primary px-4 py-2 text-sm">Sign in</button>
      </div>
    )

  const opponent = friends.find((f) => f.user_id === pick)
  const wagerNum = Math.max(0, Math.floor(Number(wager) || 0))
  const wagerOk = wagerNum <= balance && (!opponent || wagerNum <= opponent.pp_earned)
  const incoming = duels.filter((d) => d.opponent === userId && d.status === 'pending')
  const history = duels.filter((d) => !(d.opponent === userId && d.status === 'pending'))

  return (
    <div className="px-4 pb-28 pt-6 max-w-xl lg:max-w-2xl mx-auto flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Swords size={20} className="text-clay" />
        <h1 className="serif text-2xl text-ink">Duels</h1>
        <span className="ml-auto flex items-center gap-1 text-sm font-bold tabular-nums text-clay">
          <Coins size={14} /> {balance}
        </span>
      </div>
      <p className="-mt-2 text-sm text-ink2">
        Best of {DUEL_LEN} questions, head to head. Wager Poker Points and the winner takes the pot.
      </p>

      {/* challenge a friend */}
      <section className="panel flex flex-col gap-3 p-4">
        <h2 className="text-sm font-semibold text-ink">Challenge a friend</h2>
        {friends.length === 0 ? (
          <p className="text-sm text-ink3">Add friends from the Profile tab to duel them.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {friends.map((f) => (
                <button
                  key={f.user_id}
                  onClick={() => setPick(f.user_id)}
                  className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-sm transition ${
                    pick === f.user_id ? 'border-sage/50 bg-sage/10 text-ink' : 'border-line bg-paper2 text-ink2'
                  }`}
                >
                  <Avatar id={f.avatar} size={22} />
                  <span className="max-w-[8rem] truncate font-semibold">{f.handle}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink2">Wager</span>
              <input
                type="number"
                min={0}
                value={wager}
                onChange={(e) => setWager(e.target.value)}
                style={{ fontSize: '16px' }}
                className="w-28 rounded-xl border border-line bg-paper2 px-3 py-2 text-ink outline-none focus:border-sage tabular-nums"
              />
              <span className="text-xs text-ink3">PP (0 = for pride)</span>
            </div>
            <button
              onClick={() => opponent && onChallenge({ user_id: opponent.user_id, handle: opponent.handle, avatar: opponent.avatar }, wagerNum)}
              disabled={!opponent || !wagerOk}
              className="btn btn-primary flex items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-50"
            >
              <Swords size={15} />
              {!opponent ? 'Pick a friend' : !wagerOk ? 'Wager too high' : `Duel ${opponent.handle}`}
            </button>
          </>
        )}
      </section>

      {/* incoming challenges */}
      {incoming.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-xs uppercase tracking-wide text-ink3">Challenges · {incoming.length}</h2>
          {incoming.map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-xl border border-clay/30 bg-clay/[0.08] px-3 py-2.5">
              <Avatar id={d.challenger_avatar} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{d.challenger_handle}</p>
                <p className="text-xs text-ink3">
                  challenges you{d.wager > 0 ? ` · ${d.wager} PP` : ' · for pride'}
                </p>
              </div>
              <button onClick={() => onPlay(d)} className="btn btn-primary flex shrink-0 items-center gap-1 px-2.5 py-1.5 text-xs">
                <Swords size={13} /> Play
              </button>
              <button
                onClick={() => onDecline(d)}
                className="shrink-0 rounded-lg p-1.5 text-ink3 hover:bg-ink/[0.06] hover:text-ink2"
                aria-label="Decline duel"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </section>
      )}

      {/* duel history */}
      {history.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-xs uppercase tracking-wide text-ink3">Your duels</h2>
          {history.map((d) => {
            const them = d.challenger === userId
              ? { handle: d.opponent_handle, avatar: d.opponent_avatar }
              : { handle: d.challenger_handle, avatar: d.challenger_avatar }
            const mineScore = d.challenger === userId ? d.challenger_score : d.opponent_score
            const theirScore = d.challenger === userId ? d.opponent_score : d.challenger_score
            const out = d.status === 'done' ? duelOutcome(d, userId) : null
            return (
              <div key={d.id} className="flex items-center gap-3 rounded-xl border border-line bg-paper2 px-3 py-2.5">
                <Avatar id={them.avatar} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{them.handle}</p>
                  <p className="text-xs text-ink3">
                    {d.status === 'declined'
                      ? 'declined'
                      : d.status === 'pending'
                        ? d.opponent === userId ? 'awaiting you' : 'waiting for them'
                        : `${mineScore ?? 0}–${theirScore ?? 0}`}
                  </p>
                </div>
                {out && (
                  <span
                    className={`shrink-0 text-sm font-bold tabular-nums ${
                      out === 'win' ? 'text-sage-dark' : out === 'loss' ? 'text-clay' : 'text-ink3'
                    }`}
                  >
                    {out === 'win' ? `Won +${d.wager}` : out === 'loss' ? `Lost −${d.wager}` : 'Push'}
                  </span>
                )}
                {d.status === 'pending' && d.challenger === userId && (
                  <Check size={16} className="shrink-0 text-ink3" />
                )}
              </div>
            )
          })}
        </section>
      )}
    </div>
  )
}
