import { RouteObject, createBrowserRouter } from 'react-router-dom';
import Home from './Home';
import ErrorPage from './ErrorPage';
import { NotFound } from '../modules/layout/components/NotFound';
import Dev from './Dev';
import { SealEngine } from './SealEngine';
import { SealEngineUrnViewer } from './SealEngineUrnViewer';
import { MigrationDashboard } from './MigrationDashboard';

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
    path: '/seal-engine/:urnAddress',
    element: <SealEngineUrnViewer />,
    errorElement: <ErrorPage />
  } as RouteObject,
  {
    path: '/migration-dashboard',
    element: <MigrationDashboard />,
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
