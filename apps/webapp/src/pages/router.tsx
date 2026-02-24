import { RouteObject, createBrowserRouter } from 'react-router-dom';
import Home from './Home';
import ErrorPage from './ErrorPage';
import { NotFound } from '../modules/layout/components/NotFound';
import Dev from './Dev';
import { SealEngine } from './SealEngine';
import { BatchTransactionsLegal } from './BatchTransactionsLegal';

const routes: RouteObject[] = [
  {
    path: '/',
    element: <Home />,
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

export const router = createBrowserRouter(routes);
