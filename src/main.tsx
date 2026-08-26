import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { seedIfEmpty } from './db';
import './styles.css';

seedIfEmpty().then(() => {
  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
