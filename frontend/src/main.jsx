import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { applyTheme, getSavedTheme } from './utils/themes.js'

// Apply saved theme immediately before first render so BootScreen gets correct colors
applyTheme(getSavedTheme())

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)