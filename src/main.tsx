import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './ErrorBoundary';
import { seedIfEmpty } from './db';
import './styles.css';

seedIfEmpty()
  .then(() => {
    createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>,
    );
  })
  .catch(err => {
    console.error('Failed to initialise storage:', err);
    const root = document.getElementById('root')!;
    root.innerHTML = '';
    const message = document.createElement('p');
    message.className = 'empty';
    message.textContent =
      'Storage unavailable — close other tabs or free up space, then reload.';
    const button = document.createElement('button');
    button.className = 'big';
    button.textContent = 'Reload';
    button.onclick = () => location.reload();
    root.append(message, button);
  });
