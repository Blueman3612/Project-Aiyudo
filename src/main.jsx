import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './lib/i18n' // Import i18n configuration
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
