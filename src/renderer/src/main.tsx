import React from 'react';
import ReactDOM from 'react-dom/client';
import { CharacterOverlay } from './CharacterOverlay';
import { SettingsApp } from './SettingsApp';

const hash = window.location.hash;
const isSettings = hash === '#settings' || hash === '#history';
const initialTab = hash === '#history' ? 'history' : 'settings';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    {isSettings ? <SettingsApp initialTab={initialTab} /> : <CharacterOverlay />}
  </React.StrictMode>,
);
