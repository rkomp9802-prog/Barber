import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App'
import './styles.css'
import { initTelegram } from './telegram'

initTelegram()

const container = document.getElementById('root')
if (!container) throw new Error('Не найден элемент #root')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
