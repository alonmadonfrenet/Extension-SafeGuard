import React from 'react'
import { createRoot } from 'react-dom/client'
import BlockPageRoot from './BlockPage.jsx'
import '../index.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BlockPageRoot />
  </React.StrictMode>
)
