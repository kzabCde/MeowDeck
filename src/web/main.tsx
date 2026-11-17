import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './styles.css';

const node = document.getElementById('root');
if (!node) throw new Error('MeowDeck root element was not found');

createRoot(node).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
