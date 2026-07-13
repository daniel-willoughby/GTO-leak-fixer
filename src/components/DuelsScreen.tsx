import { useEffect, useState } from 'react'
import { Swords, Coins, Check, X, Globe } from 'lucide-react'
import { fetchFriendsLeaderboard, getFriends, type LeaderRow } from '../lib/leaderboard'
import {
  fetchDuels,
  fetchOpenDuels,
  fetchPublicLedger,
  duelOutcome,
  duelWinnerSide,
  DUEL_LEN,
  type DuelRow,
  type LedgerSort,
} from '../lib/duel'
import { MAX_DEBT } from '../lib/points'
import { useStickyState } from '../lib/uiState'
import { Avatar } from './Avatar'

interface Props {
  configured: boolean
  userId: string | null
  balance: number
  version: number
  onSignIn: () => void
  onChallenge: (opponent: { user_id: string; handle: string; avatar: string }, wager: number) => void
  onCreateOpen: (wager: number) => void
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
  onCreateOpen,
  onPlay,
  onDecline,
}: Props) {
  const [friends, setFriends] = useState<LeaderRow[]>([])
  const [duels, setDuels] = useState<DuelRow[]>([])
  const [open, setOpen] = useState<DuelRow[]>([])
  const [ledger, setLedger] = useState<DuelRow[]>([])
  const [pick, setPick] = useState<string>('') // selected friend user_id
  const [wager, setWager] = useState<string>('0')
  const [openWager, setOpenWager] = useState<string>('0')
  const [ledgerSort, setLedgerSort] = useState<LedgerSort>('recent')
  // one "Duels" panel, toggled between your own duels and everyone's results,
  // so the public history isn't buried at the bottom of a long scroll
  const [duelsView, setDuelsView] = useStickyState<'mine' | 'all'>('lt-ui-duels-view', 'mine')

  useEffect(() => {
    if (!userId) return
    fetchFriendsLeaderboard(getFriends()).then((r) => setFriends(r.filter((f) => f.user_id !== userId)))
    fetchDuels(userId).then(setDuels)
    fetchOpenDuels(userId).then(setOpen)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, version])

  useEffect(() => {
    if (!userId) return
    fetchPublicLedger(ledgerSort).then(setLedger)
  }, [userId, version, ledgerSort])

  if (!configured)
    return <p className="px-1 pt-6 text-center text-sm text-ink2">Duels need cloud sync to be configured.</p>
  if (!userId)
    return (
      <div className="mx-auto mt-10 max-w-sm panel flex flex-col items-center gap-3 p-5 text-center text-sm text-ink2">
        <Swords size={28} className="text-clay" />
        <p>Sign in to challenge friends, or anyone, to a duel.</p>
        <button onClick={onSignIn} className="btn btn-primary px-4 py-2 text-sm">Sign in</button>
      </div>
    )

  // Debt rules: you can't duel while already in the red, and a wager can't push
  // you more than MAX_DEBT below zero.
  const inDebt = balance < 0
  const maxWager = balance + MAX_DEBT
  const opponent = friends.find((f) => f.user_id === pick)
  const wagerNum = Math.max(0, Math.floor(Number(wager) || 0))
  const openWagerNum = Math.max(0, Math.floor(Number(openWager) || 0))
  const wagerOk = !inDebt && wagerNum <= maxWager && (!opponent || wagerNum <= opponent.pp_earned)
  const openWagerOk = !inDebt && openWagerNum <= maxWager

  const incoming = duels.filter((d) => d.opponent === userId && d.status === 'pending')
  const history = duels.filter((d) => !(d.opponent === userId && d.status === 'pending'))

  const wagerHint = (n: number, ok: boolean): string =>
    inDebt ? 'Clear your debt first' : !ok ? `Max wager ${maxWager} PP` : n === 0 ? 'For pride' : `${n} PP at stake`

  return (
    <div className="px-4 pb-28 pt-6 max-w-xl lg:max-w-2xl mx-auto flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Swords size={20} className="text-clay" />
        <h1 className="serif text-2xl text-ink">Duels</h1>
        <span className={`ml-auto flex items-center gap-1 text-sm font-bold tabular-nums ${inDebt ? 'text-clay' : 'text-clay'}`}>
          <Coins size={14} /> {balance}
        </span>
      </div>
      <p className="-mt-2 text-sm text-ink2">
        Best of {DUEL_LEN} questions, head to head. Wager Poker Points and the winner takes the pot; a level score is broken by the faster time.
      </p>

      {inDebt && (
        <div className="rounded-xl border border-clay/40 bg-clay/[0.08] px-3 py-2.5 text-sm text-clay">
          You're {Math.abs(balance)} PP in debt, win some Poker Points back before you can duel again.
        </div>
      )}

      {/* challenge a friend */}
      <section className="panel flex flex-col gap-3 p-4">
        <h2 className="text-sm font-semibold text-ink">Challenge a friend</h2>
        {friends.length === 0 ? (
          <p className="text-sm text-ink3">Add friends from the Profile tab to duel them directly.</p>
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
              <span className="text-xs text-ink3">{wagerHint(wagerNum, wagerOk)}</span>
            </div>
            <button
              onClick={() => opponent && onChallenge({ user_id: opponent.user_id, handle: opponent.handle, avatar: opponent.avatar }, wagerNum)}
              disabled={!opponent || !wagerOk}
              className="btn btn-primary flex items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-50"
            >
              <Swords size={15} />
              {inDebt ? 'In debt' : !opponent ? 'Pick a friend' : !wagerOk ? 'Wager too high' : `Duel ${opponent.handle}`}
            </button>
          </>
        )}
      </section>

      {/* create an open duel */}
      <section className="panel flex flex-col gap-3 p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Globe size={15} className="text-sage" /> Open challenge
        </h2>
        <p className="-mt-1 text-xs text-ink3">Post your run for anyone to accept. First to take it plays your 10 spots.</p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-ink2">Wager</span>
          <input
            type="number"
            min={0}
            value={openWager}
            onChange={(e) => setOpenWager(e.target.value)}
            style={{ fontSize: '16px' }}
            className="w-28 rounded-xl border border-line bg-paper2 px-3 py-2 text-ink outline-none focus:border-sage tabular-nums"
          />
          <span className="text-xs text-ink3">{wagerHint(openWagerNum, openWagerOk)}</span>
        </div>
        <button
          onClick={() => onCreateOpen(openWagerNum)}
          disabled={!openWagerOk}
          className="btn btn-secondary flex items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-50"
        >
          <Globe size={15} /> {inDebt ? 'In debt' : !openWagerOk ? 'Wager too high' : 'Post open duel'}
        </button>
      </section>

      {/* incoming direct challenges */}
      {incoming.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-xs uppercase tracking-wide text-ink3">Challenges · {incoming.length}</h2>
          {incoming.map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-xl border border-clay/30 bg-clay/[0.08] px-3 py-2.5">
              <Avatar id={d.challenger_avatar} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{d.challenger_handle}</p>
                <p className="text-xs text-ink3">challenges you{d.wager > 0 ? ` · ${d.wager} PP` : ' · for pride'}</p>
              </div>
              <button
                onClick={() => onPlay(d)}
                disabled={inDebt || d.wager > maxWager}
                className="btn btn-primary flex shrink-0 items-center gap-1 px-2.5 py-1.5 text-xs disabled:opacity-50"
              >
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

      {/* open duels posted by others */}
      {open.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-1.5 px-1 text-xs uppercase tracking-wide text-ink3">
            <Globe size={13} /> Open duels · {open.length}
          </h2>
          {open.map((d) => {
            const tooRich = d.wager > maxWager
            return (
              <div key={d.id} className="flex items-center gap-3 rounded-xl border border-sage/30 bg-sage/[0.07] px-3 py-2.5">
                <Avatar id={d.challenger_avatar || undefined} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{d.challenger_handle}</p>
                  <p className="text-xs text-ink3">open challenge{d.wager > 0 ? ` · ${d.wager} PP` : ' · for pride'}</p>
                </div>
                <button
                  onClick={() => onPlay(d)}
                  disabled={inDebt || tooRich}
                  className="btn btn-primary flex shrink-0 items-center gap-1 px-2.5 py-1.5 text-xs disabled:opacity-50"
                >
                  <Swords size={13} /> {tooRich ? 'Too high' : 'Accept'}
                </button>
              </div>
            )
          })}
        </section>
      )}

      {/* one panel for both your duels and everyone's results, so the public
          history isn't buried below a long scroll */}
      {(history.length > 0 || ledger.length > 0) && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-2 px-1">
            <div className="flex gap-1 rounded-lg border border-line bg-ink/[0.05] p-0.5 text-xs">
              {([
                { id: 'mine', label: 'Your duels' },
                { id: 'all', label: 'History' },
              ] as const).map((v) => (
                <button
                  key={v.id}
                  onClick={() => setDuelsView(v.id)}
                  className={`rounded-md px-2.5 py-1 font-semibold transition ${
                    duelsView === v.id ? 'bg-sage text-white' : 'text-ink3 hover:text-ink2'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            {duelsView === 'all' && (
              <div className="ml-auto flex gap-1 rounded-lg border border-line bg-ink/[0.05] p-0.5 text-xs">
                {([
                  { id: 'recent', label: 'Recent' },
                  { id: 'wager', label: 'Wager' },
                ] as const).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setLedgerSort(s.id)}
                    className={`rounded-md px-2 py-0.5 font-semibold transition ${
                      ledgerSort === s.id ? 'bg-sage text-white' : 'text-ink3 hover:text-ink2'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {duelsView === 'mine' ? (
            history.length > 0 ? (
              <div className="flex flex-col gap-2">
                {history.map((d) => {
                  const iAmChallenger = d.challenger === userId
                  const them = iAmChallenger
                    ? { handle: d.opponent_handle, avatar: d.opponent_avatar }
                    : { handle: d.challenger_handle, avatar: d.challenger_avatar }
                  const mineScore = iAmChallenger ? d.challenger_score : d.opponent_score
                  const theirScore = iAmChallenger ? d.opponent_score : d.challenger_score
                  const out = d.status === 'done' ? duelOutcome(d, userId) : null
                  const subtitle =
                    d.status === 'declined'
                      ? 'declined'
                      : d.status === 'open'
                        ? 'open, waiting for a taker'
                        : d.status === 'pending'
                          ? d.opponent === userId ? 'awaiting you' : 'waiting for them'
                          : `${mineScore ?? 0}–${theirScore ?? 0}`
                  return (
                    <div key={d.id} className="flex items-center gap-3 rounded-xl border border-line bg-paper2 px-3 py-2.5">
                      <Avatar id={them.avatar || undefined} size={30} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">
                          {them.handle || (d.status === 'open' ? 'Open duel' : 'Opponent')}
                        </p>
                        <p className="text-xs text-ink3">{subtitle}</p>
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
                      {d.status !== 'done' && d.challenger === userId && d.opponent !== userId && (
                        <Check size={16} className="shrink-0 text-ink3" />
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="px-1 py-6 text-center text-sm text-ink3">No duels yet. Challenge a friend above.</p>
            )
          ) : ledger.length > 0 ? (
            <div className="panel flex flex-col divide-y divide-line overflow-hidden">
              {ledger.map((d) => {
                const winner = duelWinnerSide(d)
                const cName = d.challenger_handle || 'Player'
                const oName = d.opponent_handle || 'Player'
                const cs = d.challenger_score ?? 0
                const os = d.opponent_score ?? 0
                return (
                  <div key={d.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <span className={`min-w-0 flex-1 truncate text-right ${winner === 'challenger' ? 'font-bold text-sage-dark' : 'text-ink2'}`}>
                      {cName}
                    </span>
                    <span className="shrink-0 tabular-nums text-ink3">
                      {cs}–{os}
                    </span>
                    <span className={`min-w-0 flex-1 truncate ${winner === 'opponent' ? 'font-bold text-sage-dark' : 'text-ink2'}`}>
                      {oName}
                    </span>
                    <span
                      className={`ml-1 flex w-14 shrink-0 items-center justify-end gap-0.5 text-xs font-semibold tabular-nums ${
                        d.wager > 0 ? 'text-clay' : 'text-ink3'
                      }`}
                    >
                      <Coins size={11} /> {d.wager}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="px-1 py-6 text-center text-sm text-ink3">No completed duels yet.</p>
          )}
        </section>
      )}
    </div>
  )
}
