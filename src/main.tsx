import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
// Bodoni Moda: a free high-contrast Didone, the close match to the Bodoni Z37
// used for the wordmark. Drives the app's serif display type.
import '@fontsource-variable/bodoni-moda'
import './index.css'
import App from './App.tsx'
import { loadFreeplayNodes } from './data/freeplay'

// Fetch the all-seats Freeplay dataset in the background; until it lands,
// vs-GTO Freeplay falls back to the other generators.
void loadFreeplayNodes()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
