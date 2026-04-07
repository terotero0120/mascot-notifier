import React from 'react';
import ReactDOM from 'react-dom/client';
import { CharacterOverlay } from './CharacterOverlay';
import { SettingsApp } from './SettingsApp';

const isSettings = window.location.hash === '#settings';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');
ReactDOM.createRoot(root).render(
  <React.StrictMode>{isSettings ? <SettingsApp /> : <CharacterOverlay />}</React.StrictMode>,
);
