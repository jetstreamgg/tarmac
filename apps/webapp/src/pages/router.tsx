import * as Sentry from '@sentry/react';
import { RouteObject, createBrowserRouter, redirect } from 'react-router-dom';
import Home from './Home';
import ErrorPage from './ErrorPage';
import { NotFound } from '../modules/layout/components/NotFound';
import Dev from './Dev';
import { SealEngine } from './SealEngine';
import { BatchTransactionsLegal } from './BatchTransactionsLegal';
import { rewriteLegacyWidgetParams } from '@/modules/utils/validateSearchParams';

// TODO: Remove once all references to widget=trade|upgrade are migrated
const legacyWidgetLoader = ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const before = url.searchParams.toString();
  rewriteLegacyWidgetParams(url.searchParams);
  if (url.searchParams.toString() !== before) {
    return redirect(url.pathname + '?' + url.searchParams.toString());
  }
  return null;
};

const routes: RouteObject[] = [
  {
    path: '/',
    element: <Home />,
    loader: legacyWidgetLoader,
    errorElement: <ErrorPage />
  },
  {
    path: '/seal-engine',
    element: <SealEngine />,
    errorElement: <ErrorPage />
  },
  {
    path: '/batch-transactions-legal-notice',
    element: <BatchTransactionsLegal />,
    errorElement: <ErrorPage />
  },
  // catch all and show NotFound component
  {
    path: '*',
    element: <NotFound />,
    errorElement: <ErrorPage />
  },
  ...(import.meta.env.DEV
    ? [
        {
          path: '/dev',
          element: <Dev />,
          errorElement: <ErrorPage />
        }
      ]
    : [])
];

const sentryCreateBrowserRouter = Sentry.wrapCreateBrowserRouterV6(createBrowserRouter);

export const router = sentryCreateBrowserRouter(routes);
