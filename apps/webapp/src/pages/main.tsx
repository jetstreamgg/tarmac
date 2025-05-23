import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from '../modules/config/context/ConfigContext';
import { App } from './App';
import { ErrorBoundary } from '../modules/layout/components/ErrorBoundary';

import '../globals.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ConfigProvider>
        <App />
      </ConfigProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
