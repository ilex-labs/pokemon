import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import plexSans400 from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2?url'
import './index.css'
import App from './App.tsx'

const preload = document.createElement('link')
preload.rel = 'preload'
preload.as = 'font'
preload.type = 'font/woff2'
preload.crossOrigin = 'anonymous'
preload.href = plexSans400
document.head.appendChild(preload)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename="/pokemon">
      <App />
    </BrowserRouter>
  </StrictMode>,
)
