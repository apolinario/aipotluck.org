import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import App from './App.jsx';
import { ExplorerApp } from './components/explorer/ExplorerApp.jsx';
import { MinimalLanding } from './components/MinimalLanding.jsx';
import './styles/global.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MinimalLanding />} />
        <Route path="/v2" element={<App />} />
        <Route path="/app" element={<ExplorerApp />} />
        <Route path="/gaps" element={<Navigate to="/app?view=stacks" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
