import { initSentry } from '../modules/sentry/init';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from '../modules/config/context/ConfigProvider';
import { App } from './App';
import { ErrorBoundary } from '../modules/layout/components/ErrorBoundary';
// Keep the router import after App: the page graph must not be evaluated ahead
// of the config modules (circular-init TDZ, see modules/sentry/init.ts).
import { router } from './router';

import '../modules/analytics/gtag';
import '../globals.css';

initSentry(router);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ConfigProvider>
        <App />
      </ConfigProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
