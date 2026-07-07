import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
// Bodoni Moda: a free high-contrast Didone, the close match to the Bodoni Z37
// used for the wordmark. Drives the app's serif display type.
import '@fontsource-variable/bodoni-moda'
// Poker table type: Archivo (a grotesque that pairs with the Didone, kept clear
// at small sizes) + JetBrains Mono for tabular bet/stack figures.
import '@fontsource-variable/archivo'
import '@fontsource-variable/jetbrains-mono'
import './index.css'
import App from './App.tsx'
import { loadFreeplayNodes } from './data/freeplay'
import { initNative } from './lib/native'

// Fetch the all-seats Freeplay dataset in the background; until it lands,
// vs-GTO Freeplay falls back to the other generators.
void loadFreeplayNodes()

// Native shell (Capacitor): style the status bar + dismiss the splash. No-op on web.
void initNative()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
