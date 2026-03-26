import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { migrateLocalStorageToIDB } from './stores/idbStorage.ts'

// Migrate existing localStorage saves to IndexedDB (one-time, non-blocking)
migrateLocalStorageToIDB().catch(() => {});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
