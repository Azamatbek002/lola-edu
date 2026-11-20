import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '@fontsource-variable/onest'
import '@fontsource/lora/600.css'
import '@fontsource/lora/600-italic.css'
import './styles/app.css'
import { IconContext } from './components/icons'
import { initInstallPrompt, initServiceWorker } from './lib/pwa'
import { hideBoot } from './lib/boot'

initInstallPrompt()
initServiceWorker()

try {
  const theme = localStorage.getItem('lola:theme')
  if (theme) document.documentElement.dataset.theme = theme
} catch {
  /* ignore */
}

// Ehtiyot uchun: biror sabab bilan kechiksa ham ochilish ekrani 6 soniyadan keyin yo'qoladi
setTimeout(hideBoot, 6000)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <IconContext.Provider value={{ weight: 'regular', mirrored: false }}>
      <App />
    </IconContext.Provider>
  </React.StrictMode>,
)
