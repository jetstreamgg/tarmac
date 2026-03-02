import { RouteObject, createBrowserRouter, redirect } from 'react-router-dom';
import Home from './Home';
import ErrorPage from './ErrorPage';
import { NotFound } from '../modules/layout/components/NotFound';
import Dev from './Dev';
import { SealEngine } from './SealEngine';
import { BatchTransactionsLegal } from './BatchTransactionsLegal';
import { rewriteLegacyWidgetParams } from '@/modules/utils/validateSearchParams';

const restrictedBuild = import.meta.env.VITE_RESTRICTED_BUILD === 'true';

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

const commonRoutes = [
  {
    path: '/',
    element: <Home />,
    loader: legacyWidgetLoader,
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
