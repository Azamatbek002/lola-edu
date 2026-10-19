import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/app.css'

try {
  const theme = localStorage.getItem('lola:theme')
  if (theme) document.documentElement.dataset.theme = theme
} catch {
  /* ignore */
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
