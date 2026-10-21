import React from 'react'
import { createRoot } from 'react-dom/client'
import PopupRoot from './Popup.jsx'
import '../index.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PopupRoot />
  </React.StrictMode>
)
