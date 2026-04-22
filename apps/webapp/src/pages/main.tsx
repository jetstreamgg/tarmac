import { initSentry } from '../modules/sentry/init';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { i18n } from '@lingui/core';
import { ConfigProvider } from '../modules/config/context/ConfigProvider';
import { App } from './App';
import { ErrorBoundary } from '../modules/layout/components/ErrorBoundary';

import '../modules/analytics/gtag';
import '../globals.css';

initSentry();

// Prime Lingui synchronously so `<I18nProvider>`'s first render has a non-null
// context. ConfigProvider's async dynamicActivate loads the real catalog after.
i18n.loadAndActivate({ locale: 'en', messages: {} });

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ConfigProvider>
        <App />
      </ConfigProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
