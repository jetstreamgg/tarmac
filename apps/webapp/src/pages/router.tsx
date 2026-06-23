import * as Sentry from '@sentry/react';
import { RouteObject, createBrowserRouter, redirect } from 'react-router-dom';
import Home from './Home';
import ErrorPage from './ErrorPage';
import { NotFound } from '../modules/layout/components/NotFound';
import Dev from './Dev';
import { SealEngine } from './SealEngine';
import { BatchTransactionsLegal } from './BatchTransactionsLegal';
import { rewriteLegacyWidgetParams } from '@/modules/utils/validateSearchParams';
import { mainnet } from 'viem/chains';
import { IntentMapping, QueryParams, SUSDT_VAULT_ENABLED } from '@/lib/constants';
import { Intent } from '@/lib/enums';
import { vaultModuleForProvider } from '@/lib/vaults/vaultProviderMapping';
import { sparkUsdtVaultAddress } from '@/hooks';

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

// sUSDT is mainnet-only, so the network is pinned in the deep-link.
export const susdtRedirectLoader = () => {
  // The sUSDT vault is feature-flagged (APP-323). While it's hidden, this vanity
  // route must not deep-link into a vault that no longer resolves — the vault
  // panes fall back to `VAULTS[0]` (an unrelated Morpho vault), so send visitors
  // to the app root instead of silently opening the wrong vault.
  if (!SUSDT_VAULT_ENABLED) {
    return redirect('/');
  }

  const params = new URLSearchParams({
    [QueryParams.Network]: 'ethereum',
    [QueryParams.Widget]: IntentMapping[Intent.VAULTS_INTENT],
    [QueryParams.VaultModule]: vaultModuleForProvider('sky'),
    [QueryParams.Vault]: sparkUsdtVaultAddress[mainnet.id]
  });
  return redirect('/?' + params.toString());
};

const routes: RouteObject[] = [
  {
    path: '/',
    element: <Home />,
    loader: legacyWidgetLoader,
    errorElement: <ErrorPage />
  },
  {
    path: '/susdt',
    loader: susdtRedirectLoader,
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

const sentryCreateBrowserRouter = Sentry.wrapCreateBrowserRouterV6(createBrowserRouter);

export const router = sentryCreateBrowserRouter(routes);
