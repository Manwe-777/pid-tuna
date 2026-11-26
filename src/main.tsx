import './parser/compat'; // Must run before any blackbox-log code is imported.
import '@fontsource-variable/inter';
import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { applyTheme } from './theme/applyTheme';

// Stamp the resolved theme onto <html> before first paint so there's no flash.
applyTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
