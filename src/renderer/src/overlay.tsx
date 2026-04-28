import React from 'react';
import ReactDOM from 'react-dom/client';
import { CharacterOverlay } from './CharacterOverlay';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <CharacterOverlay />
  </React.StrictMode>,
);
