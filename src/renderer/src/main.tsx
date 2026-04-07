import React from 'react'
import ReactDOM from 'react-dom/client'
import { CharacterOverlay } from './CharacterOverlay'
import { SettingsApp } from './SettingsApp'

const isSettings = window.location.hash === '#settings'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isSettings ? <SettingsApp /> : <CharacterOverlay />}
  </React.StrictMode>
)
