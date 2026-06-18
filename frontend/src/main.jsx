import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ensureRuntimeAuth } from './api/runtimeConfig.js'

ensureRuntimeAuth()
  .then(() => {
    createRoot(document.getElementById('root')).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
  .catch((error) => {
    document.body.innerHTML = `<pre style="padding:1rem;color:#b91c1c;">${error.message}</pre>`
  })
