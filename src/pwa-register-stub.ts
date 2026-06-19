// Stand-in for `virtual:pwa-register/react` used in native (Capacitor) builds,
// where vite-plugin-pwa is disabled so the virtual module doesn't exist. The
// native shell handles updates by shipping a new bundle, so this is a no-op.
export function useRegisterSW(_opts?: unknown) {
  return {
    needRefresh: [false, (_v: boolean) => {}] as [boolean, (v: boolean) => void],
    offlineReady: [false, (_v: boolean) => {}] as [boolean, (v: boolean) => void],
    updateServiceWorker: async (_reload?: boolean) => {},
  }
}
