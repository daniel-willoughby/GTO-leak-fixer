import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/fraunces'
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
