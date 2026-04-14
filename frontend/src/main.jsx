import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'

// SPA 404 fallback: if redirected from 404.html, restore the original path
const params = new URLSearchParams(window.location.search)
const redirectPath = params.get('redirect')
if (redirectPath) {
  window.history.replaceState(null, '', redirectPath)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
