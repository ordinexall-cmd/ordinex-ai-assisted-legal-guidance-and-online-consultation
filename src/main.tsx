import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './context/AuthContext'
import { AppSocketProvider } from './context/AppSocketProvider'
import { ErrorBoundary } from './components/ErrorBoundary'
import App from './App'

/** Mark iOS home-screen PWA so CSS can apply safe-area under the status bar. */
try {
  const iosStandalone =
    window.matchMedia('(display-mode: standalone)').matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  if (iosStandalone) {
    document.documentElement.dataset.iosStandalone = 'true';
  }
} catch {
  /* ignore */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <AppSocketProvider>
          <App />
        </AppSocketProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
