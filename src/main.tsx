import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';

import { App } from './app/App';
import './styles/global.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Heardle root element is missing.');
}

createRoot(root).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>,
);

