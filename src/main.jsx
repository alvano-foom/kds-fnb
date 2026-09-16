import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

async function bootstrap() {
  if (import.meta.env.VITE_USE_MOCKS === 'true') {
    const { worker } = await import('./api/mocks/browser')
    await worker.start({ onUnhandledRequest: 'bypass' })
  }

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

bootstrap()
