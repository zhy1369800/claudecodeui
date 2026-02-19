import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import 'katex/dist/katex.min.css'

// Initialize i18n
import './i18n/config.js'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Hide static startup splash after first React paint.
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const splash = document.getElementById('app-splash')
    if (!splash) return
    splash.classList.add('app-splash-hide')
    setTimeout(() => splash.remove(), 220)
  })
})
