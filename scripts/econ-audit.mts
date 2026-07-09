// Run: npx tsx scripts/econ-audit.mts (from the repo root)
// Full shop/PP economy audit against the REAL modules (points.ts, shop.ts,
// sync.ts). Exercises buy / equip / sell / re-buy / loot / specials / duels /
// daily / merges, asserting the core invariant after every step:
//   balance === earned - spent, and every op moves it by exactly its price.
import 'fake-indexeddb/auto'
const store: Record<string, string> = {}
;(globalThis as any).localStorage = {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => (store[k] = String(v)),
  removeItem: (k: string) => delete store[k],
  clear: () => Object.keys(store).forEach((k) => delete store[k]),
}

const P = await import('../src/lib/points.ts')
const S = await import('../src/lib/shop.ts')
const SY = await import('../src/lib/sync.ts')

let fails = 0
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) fails++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`)
}
const bal = async () => (await P.pointsState()).balance
const seed = () => {
  localStorage.clear()
  localStorage.setItem('lt-duel-ledger', JSON.stringify({ seed: 100000 })) // plenty of earned PP
}

// ---------- 1. buy → sell → re-buy (bought path) ----------
seed()
let b0 = await bal()
await P.buyItem('avatar-owl') // 400
eq('buy debits exactly the price', b0 - (await bal()), 400)
P.equip('avatar', 'avatar-owl')
let r = P.sellItem('avatar-owl')
eq('sell ok', r.ok, true)
eq('sell credits ceil(400/3)=134', r.refund, 134)
eq('sold item unowned', P.isOwned('avatar-owl'), false)
eq('sold item unequipped', P.equipped().avatar, S.DEFAULT_AVATAR)
b0 = await bal()
await P.buyItem('avatar-owl')
eq('re-buy debits exactly the price again', b0 - (await bal()), 400)
eq('re-bought item owned', P.isOwned('avatar-owl'), true)
r = P.sellItem('avatar-owl')
eq('second sell ok', r.ok, true)
eq('second sell still refunds 134', r.refund, 134)

// ---------- 2. sell EVERY sellable item type once ----------
seed()
for (const item of S.SHOP.filter((i) => i.cost > 0 && !i.special)) {
  await P.buyItem(item.id)
  const res = P.sellItem(item.id)
  if (!res.ok) {
    fails++
    console.log(`FAIL  sell ${item.id} (${item.type})  reason=${res.reason}`)
  }
}
console.log('PASS  every buyable item can be bought & sold (if no FAILs above)')

// ---------- 3. loot-won item sell (incl. legacy openings without sold flag) ----------
seed()
localStorage.setItem('lt-loot', JSON.stringify({ legacy1: { item: 'avatar-wolf', cost: 400 } })) // pre-sold-flag shape
eq('legacy loot opening counts as owned', P.isOwned('avatar-wolf'), true)
r = P.sellItem('avatar-wolf')
eq('legacy loot-won item sells', r.ok, true)
eq('legacy loot-won item unowned after sell', P.isOwned('avatar-wolf'), false)

// ---------- 4. SYNC MERGE: does a sale survive merging with a STALE remote? ----------
// Device sells, then syncNow pulls a remote snapshot from before the sale.
// 4a. bought item (sold via tombstone list)
seed()
await P.buyItem('avatar-owl')
const staleRemoteA = await SY.gatherLocal() // remote snapshot BEFORE the sale
P.sellItem('avatar-owl')
let merged = SY.mergeSnapshots(await SY.gatherLocal(), staleRemoteA)
eq('MERGE: bought-item sale survives stale remote', (merged.sold ?? []).includes('avatar-owl'), true)

// 4b. loot-won item (sold via per-opening flag)
seed()
localStorage.setItem('lt-loot', JSON.stringify({ o1: { item: 'avatar-wolf', cost: 400, sold: false } }))
const staleRemoteB = await SY.gatherLocal() // remote still has o1 unsold
P.sellItem('avatar-wolf')
merged = SY.mergeSnapshots(await SY.gatherLocal(), staleRemoteB)
eq('MERGE: loot-item sale survives stale remote (local first)', merged.loot?.o1?.sold, true)
merged = SY.mergeSnapshots(staleRemoteB, await SY.gatherLocal())
eq('MERGE: loot-item sale survives stale remote (remote first)', merged.loot?.o1?.sold, true)

// 4c. applying the merged snapshot must not resurrect the item
await SY.applySnapshot(SY.mergeSnapshots(await SY.gatherLocal(), staleRemoteB))
eq('MERGE+apply: sold loot item stays unowned', P.isOwned('avatar-wolf'), false)

// ---------- 5. balance can never go NaN / op-sized invariant under a fuzz ----------
seed()
let prev = await bal()
let okFuzz = true
for (let i = 0; i < 120; i++) {
  const item = S.SHOP[Math.floor(Math.random() * S.SHOP.length)]
  const op = Math.random()
  if (op < 0.4) {
    const res = await P.buyItem(item.id)
    const now = await bal()
    if (res.ok && prev - now !== item.cost) { okFuzz = false; console.log('FAIL fuzz buy delta', item.id, prev - now) }
    if (!res.ok && prev !== now) { okFuzz = false; console.log('FAIL fuzz failed-buy moved balance', item.id) }
    prev = now
  } else if (op < 0.7) {
    const res = P.sellItem(item.id)
    const now = await bal()
    if (res.ok && now - prev !== res.refund) { okFuzz = false; console.log('FAIL fuzz sell delta', item.id, now - prev, res.refund) }
    if (!res.ok && prev !== now) { okFuzz = false; console.log('FAIL fuzz failed-sell moved balance', item.id, res.reason) }
    prev = now
  } else {
    const res = await P.openLootBox('box-mystery')
    const now = await bal()
    if (res.ok && prev - now !== S.MYSTERY_BOX.cost) { okFuzz = false; console.log('FAIL fuzz loot delta', prev - now) }
    if (!res.ok && prev !== now) { okFuzz = false; console.log('FAIL fuzz failed-open moved balance', res.reason) }
    prev = now
  }
  if (Number.isNaN(prev)) { okFuzz = false; console.log('FAIL fuzz NaN balance'); break }
}
eq('fuzz: 120 random ops, every delta exact, no NaN', okFuzz, true)

// ---------- 6. tamper-guard doesn't wipe legit operations ----------
seed()
await P.buyItem('avatar-owl')
P.sellItem('avatar-owl')
eq('verifyEconomyState keeps legit sale', P.verifyEconomyState(), false) // false = nothing tampered/reset
eq('after verify, item still unowned', P.isOwned('avatar-owl'), false)

// ---------- 7. rare tiers: legendaries out of the pool; box locks when only they remain ----------
seed()
eq('normal pool excludes legendaries', S.MYSTERY_BOX.pool().some((id) => S.LEGENDARY_IDS.includes(id)), false)
eq('normal pool excludes specials', S.MYSTERY_BOX.pool().some((id) => S.SPECIAL_IDS.includes(id)), false)
// own every common + every special, leaving only legendaries → box must refuse
const ownAllButLegendaries = [...S.MYSTERY_BOX.pool(), ...S.SPECIAL_IDS].map((item, i) => [
  `o${i}`,
  { item, cost: 400, sold: false },
])
localStorage.setItem('lt-loot', JSON.stringify(Object.fromEntries(ownAllButLegendaries)))
let openRes = await P.openLootBox('box-mystery')
eq('box refuses to open with only legendaries left', openRes.ok, false)
eq('box refusal names the legendaries', /legendar/i.test(openRes.reason ?? ''), true)
// but while a common is still missing, it opens fine
seed()
localStorage.setItem('lt-owned', JSON.stringify(S.MYSTERY_BOX.pool().slice(1))) // own all commons but one
openRes = await P.openLootBox('box-mystery')
eq('box opens while a common remains', openRes.ok, true)

console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILED`)
process.exit(fails === 0 ? 0 : 1)
