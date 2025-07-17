import { RouteObject, createBrowserRouter } from 'react-router-dom';
import Home from './Home';
import ErrorPage from './ErrorPage';
import { NotFound } from '../modules/layout/components/NotFound';
import Dev from './Dev';
import { SealEngine } from './SealEngine';
import { BatchTransactionsLegal } from './BatchTransactionsLegal';

const restrictedBuild = import.meta.env.VITE_RESTRICTED_BUILD === 'true';

const commonRoutes = [
  {
    path: '/',
    element: <Home />,
    errorElement: <ErrorPage />
  } as RouteObject,
  {
    path: '/seal-engine',
    element: <SealEngine />,
    errorElement: <ErrorPage />
  } as RouteObject,
  {
    path: '/batch-transactions-legal-notice',
    element: <BatchTransactionsLegal />,
    errorElement: <ErrorPage />
  } as RouteObject,
  // catch all and show NotFound component
  {
    path: '*',
    element: <NotFound />,
    errorElement: <ErrorPage />
  } as RouteObject
];

const restrictedRoutes = [] as RouteObject[];

const devRoutes = [
  {
    path: '/dev',
    element: <Dev />,
    errorElement: <ErrorPage />
  } as RouteObject
];

const routes = restrictedBuild
  ? [...commonRoutes, ...(import.meta.env.DEV ? devRoutes : [])]
  : [...commonRoutes, ...restrictedRoutes, ...(import.meta.env.DEV ? devRoutes : [])];

export const router = createBrowserRouter(routes);
