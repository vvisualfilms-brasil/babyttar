import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { init } from './data/store'
import './styles.css'

init()
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
