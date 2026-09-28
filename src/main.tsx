import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigErrorScreen } from './components/ConfigErrorScreen'
import { readSupabaseConfig } from './lib/supabaseConfig'
import './index.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root is missing from index.html')
}

const root = createRoot(rootElement)

// Report a missing Supabase configuration instead of crashing on import.
// `App` is imported dynamically so `src/lib/supabase.ts` is never evaluated
// when the configuration is invalid.
const { missingKeys } = readSupabaseConfig()

if (missingKeys.length > 0) {
  root.render(<ConfigErrorScreen missingKeys={missingKeys} />)
} else {
  const { default: App } = await import('./App')

  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}
