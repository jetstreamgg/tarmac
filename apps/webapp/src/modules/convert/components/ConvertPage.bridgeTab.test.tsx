/**
 * @vitest-environment happy-dom
 */
import { useState } from 'react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import type { useBridgeForm } from '@/modules/bridge/hooks/useBridgeForm';

// The real Bridge form under the real Swap | Bridge tabs; only its chain reads and launchers are faked.

vi.mock('posthog-js/react', async () => {
  const posthog = (await import('posthog-js')).default;
  return { usePostHog: () => posthog };
});
vi.mock('wagmi', async importOriginal => ({
  ...(await importOriginal<typeof import('wagmi')>()),
  useChainId: () => 1,
  useConnection: () => ({ isConnected: true, address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F' }),
  useChains: () => [1, 8453, 10, 42161, 130].map(id => ({ id })),
  useReadContract: () => ({ status: 'pending', data: undefined })
}));
vi.mock('@/hooks', async importOriginal => ({
  ...(await importOriginal<typeof import('@/hooks')>()),
  useAppChainId: () => 1,
  useSafeWalletStatus: () => 'not-safe',
  useTokenBalance: () => ({ data: { value: 10n ** 18n }, isLoading: false, refetch: vi.fn() })
}));
vi.mock('@/modules/ui/context/NetworkSwitchContext', () => ({
  useNetworkSwitch: () => ({ canSwitchChain: true, handleSwitchChain: vi.fn() })
}));
vi.mock('@/modules/ui/context/ConnectThenActContext', () => ({
  useConnectThenAct: (action: () => void) => action
}));
vi.mock('@/modules/ui/hooks/useTransactionRunActive', () => ({ useTransactionRunActive: () => false }));
vi.mock('@/lib/navigation', () => ({
  useAppSearchParams: () => {
    const [params, setParams] = useState(() => new URLSearchParams());
    return [
      params,
      (next: (current: URLSearchParams) => URLSearchParams) => setParams(next(new URLSearchParams(params)))
    ];
  }
}));

vi.mock('../hooks/useConvertForm', () => ({ useConvertForm: () => ({ isConnected: true, isZero: true }) }));
vi.mock('../hooks/useConvertLaunch', () => ({
  useConvertLaunch: () => ({ launch: vi.fn(), conversion: {}, locked: false, restore: vi.fn() })
}));
vi.mock('./ConvertCard', () => ({ ConvertCard: () => null }));

vi.mock('@/modules/bridge/hooks/useSafeConfig', () => ({
  useSafeConfig: () => ({ lookup: undefined, isChecking: false })
}));
vi.mock('@/modules/bridge/hooks/useCctpGate', () => ({ useCctpGate: () => undefined }));
vi.mock('@/modules/bridge/hooks/useAddressCode', () => ({
  useAddressCode: () => ({ code: 'none', isChecking: false })
}));
vi.mock('@/modules/bridge/hooks/useBridgeLaunch', () => ({
  useBridgeLaunch: () => ({ launch: vi.fn(), locked: false, restore: vi.fn() })
}));
vi.mock('@/modules/bridge/hooks/useDestinationActionLaunch', () => ({
  useDestinationActionLaunch: () => ({
    launch: vi.fn(),
    canLaunch: vi.fn(),
    actionHint: vi.fn(),
    locked: false
  })
}));
vi.mock('@/modules/bridge/hooks/useCctpResumeLaunch', () => ({
  useCctpResumeLaunch: () => ({ launch: vi.fn() })
}));
vi.mock('@/modules/bridge/hooks/useCctpSwapConvertLaunch', () => ({
  useCctpSwapConvertLaunch: () => ({ launch: vi.fn() })
}));
vi.mock('@/modules/bridge/components/PendingBridges', () => ({ PendingBridges: () => null }));
vi.mock('@/modules/bridge/components/BridgeClaimLookup', () => ({
  BridgeClaimLookup: () => null,
  hasBridgeClaimLookup: () => false
}));
// The card's network pickers need the whole wallet stack; the form's own fields stand in for them.
vi.mock('@/modules/bridge/components/BridgeCard', () => ({
  BridgeCard: ({ form }: { form: ReturnType<typeof useBridgeForm> }) => (
    <>
      <input data-testid="bridge-amount" value={form.value} onChange={e => form.onInput(e.target.value)} />
      <button data-testid="bridge-to-arbitrum" onClick={() => form.selectTo('arbitrum')} />
      <span data-testid="bridge-to">{form.to}</span>
    </>
  )
}));

import { ConvertPage } from './ConvertPage';
import { AnalyticsFlowProvider } from '@/modules/analytics/context/AnalyticsFlowContext';

beforeAll(() => i18n.loadAndActivate({ locale: 'en', messages: {} }));
afterEach(cleanup);

const openTab = (name: 'swap' | 'bridge') =>
  fireEvent.mouseDown(screen.getByTestId(`convert-tab-${name}`), { button: 0 });

it('keeps what was typed in the Bridge tab after a visit to Swap, as the Swap tab does', () => {
  render(
    <I18nProvider i18n={i18n}>
      <AnalyticsFlowProvider>
        <ConvertPage />
      </AnalyticsFlowProvider>
    </I18nProvider>
  );
  openTab('bridge');
  fireEvent.change(screen.getByTestId('bridge-amount'), { target: { value: '12.5' } });
  fireEvent.click(screen.getByTestId('bridge-to-arbitrum'));
  expect(screen.getByTestId('bridge-to').textContent).toBe('arbitrum');

  openTab('swap');
  expect(screen.queryByTestId('bridge-amount')).toBeNull();
  openTab('bridge');

  expect((screen.getByTestId('bridge-amount') as HTMLInputElement).value).toBe('12.5');
  expect(screen.getByTestId('bridge-to').textContent).toBe('arbitrum');
});
