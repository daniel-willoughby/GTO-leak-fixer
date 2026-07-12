// PotKing Pro entitlement. The PWA is a free testing surface: every feature is
// unlocked there. Only the native (Capacitor) app gates features, so all checks
// funnel through isPro(), which is always true on the web.
//
// Purchases are not wired yet (needs the paid Apple Developer account). When it
// exists, RevenueCat plugs in here and nothing outside this file changes:
//   1. npm i @revenuecat/purchases-capacitor && npx cap sync
//   2. Purchases.configure({ apiKey: <ios public key> }) inside initNative()
//   3. purchasePro(): getOfferings() -> purchasePackage(monthly|yearly)
//   4. on entitlement 'pro' active -> setProEntitlement(true)
//   5. restorePro(): Purchases.restorePurchases() -> same entitlement check
import { Capacitor } from '@capacitor/core'
import { dayKey } from './daily'

export const IS_NATIVE = Capacitor.isNativePlatform()

// Display prices. The App Store localises real prices; these label the paywall
// until RevenueCat supplies store-formatted ones.
export const PRICE_MONTHLY = '£2.99'
export const PRICE_YEARLY = '£15'

/** Free native users get this many fresh postflop/Freeplay hands per UTC day. */
export const FREE_POSTFLOP_PER_DAY = 10

/** The first N curriculum lessons are free on native; the rest are Pro. */
export const FREE_LESSONS = 3

const PRO_KEY = 'lt-pro'
const QUOTA_KEY = 'lt-pf-quota'

/** True when every Pro feature is available: always on the web, entitled on native. */
export function isPro(): boolean {
  try {
    // testing hook: preview the FREE tier anywhere (can only restrict, never unlock)
    if (localStorage.getItem('lt-pro-sim') === '1') return false
    if (!IS_NATIVE) return true
    return localStorage.getItem(PRO_KEY) === '1'
  } catch {
    return !IS_NATIVE
  }
}

/** Cache the store entitlement locally (called by the purchase/restore flow). */
export function setProEntitlement(on: boolean): void {
  localStorage.setItem(PRO_KEY, on ? '1' : '0')
}

type Quota = { day: string; used: number }

function quota(): Quota {
  try {
    const q = JSON.parse(localStorage.getItem(QUOTA_KEY) ?? 'null') as Quota | null
    if (q && q.day === dayKey()) return q
  } catch {
    /* fall through to a fresh day */
  }
  return { day: dayKey(), used: 0 }
}

/** Fresh postflop hands left today for a free native user (Infinity when Pro). */
export function postflopLeft(): number {
  if (isPro()) return Infinity
  return Math.max(0, FREE_POSTFLOP_PER_DAY - quota().used)
}

/** Record one fresh postflop/Freeplay hand against today's free quota. */
export function consumePostflop(): void {
  if (isPro()) return
  const q = quota()
  localStorage.setItem(QUOTA_KEY, JSON.stringify({ day: q.day, used: q.used + 1 }))
}

export type ProPlan = 'monthly' | 'yearly'

/** Buy Pro. Stubbed until RevenueCat is configured (see header comment). */
export async function purchasePro(_plan: ProPlan): Promise<{ ok: boolean; message?: string }> {
  return { ok: false, message: 'Purchases arrive with the App Store release' }
}

/** Restore a previous purchase. Stubbed until RevenueCat is configured. */
export async function restorePro(): Promise<{ ok: boolean; message?: string }> {
  return { ok: false, message: 'Purchases arrive with the App Store release' }
}
