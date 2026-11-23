import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { consumeRedirectResult } from './auth';
import { SpikePage } from './spike/SpikePage';
import './index.css';

// Must run before anything reads location.hash (hash routing comes later).
const cameBackFromRedirect = consumeRedirectResult();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SpikePage cameBackFromRedirect={cameBackFromRedirect} />
  </StrictMode>,
);
