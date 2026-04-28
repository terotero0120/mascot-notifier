import React from 'react';
import ReactDOM from 'react-dom/client';
import { SettingsApp } from './SettingsApp';

const hash = window.location.hash;
const initialTab = hash === '#history' ? 'history' : 'settings';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <SettingsApp initialTab={initialTab} />
  </React.StrictMode>,
);
