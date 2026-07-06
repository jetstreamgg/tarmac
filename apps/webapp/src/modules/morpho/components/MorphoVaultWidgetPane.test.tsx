import { act, type ReactNode } from 'react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { createRoot } from 'react-dom/client';
import { mainnet } from 'wagmi/chains';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MorphoVaultWidgetPane } from './MorphoVaultWidgetPane';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
i18n.load('en', {});
i18n.activate('en');

// Capture the widget's onWidgetStateChange so each test can drive a state change
// directly and assert the resulting URL params (the observable behaviour), rather
// than the guard internals.
const captured = vi.hoisted(() => ({
  onWidgetStateChange: undefined as undefined | ((params: any) => void)
}));

const mocks = vi.hoisted(() => ({
  chainId: 1, // mainnet.id — literal because vi.hoisted runs before imports
  updateLinkedActionConfig: vi.fn(),
  exitLinkedActionMode: vi.fn(),
  setSelectedVaultsOption: vi.fn()
}));

let mockSearchParams = new URLSearchParams();

const setSearchParamsMock = vi.fn(
  (next: URLSearchParams | ((params: URLSearchParams) => URLSearchParams)) => {
    mockSearchParams =
      typeof next === 'function' ? next(new URLSearchParams(mockSearchParams)) : new URLSearchParams(next);
  }
);

vi.mock('@/widgets', () => ({
  MorphoVaultWidget: ({ onWidgetStateChange }: { onWidgetStateChange?: (params: any) => void }) => {
    captured.onWidgetStateChange = onWidgetStateChange;
    return <div>morpho-vault-widget</div>;
  },
  TxStatus: { IDLE: 'idle', SUCCESS: 'success' },
  VaultAction: { SUPPLY: 'supply', WITHDRAW: 'withdraw' },
  VaultFlow: { SUPPLY: 'supply', WITHDRAW: 'withdraw' }
}));

vi.mock('@/modules/config/hooks/useConfigContext', () => ({
  useConfigContext: () => ({
    linkedActionConfig: { step: undefined, inputAmount: undefined },
    updateLinkedActionConfig: mocks.updateLinkedActionConfig,
    exitLinkedActionMode: mocks.exitLinkedActionMode,
    setSelectedVaultsOption: mocks.setSelectedVaultsOption
  })
}));

vi.mock('@/modules/config/context/ConfigContext', () => ({
  LinkedActionSteps: { COMPLETED_CURRENT: 'completed_current', COMPLETED_SUCCESS: 'completed_success' }
}));

vi.mock('react-router-dom', async importOriginal => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useSearchParams: () => [mockSearchParams, setSearchParamsMock]
  };
});

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => mocks.chainId
  };
});

const VAULT_ADDRESS = '0x1111111111111111111111111111111111111111' as const;
const ASSET_ADDRESS = '0x2222222222222222222222222222222222222222' as const;

const assetToken = {
  symbol: 'USDT',
  name: 'Tether',
  address: { [mainnet.id]: ASSET_ADDRESS }
} as any;

function renderComponent(ui: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
  });

  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    }
  };
}

function renderPane(provider: 'morpho' | 'sky') {
  return renderComponent(
    <MorphoVaultWidgetPane
      {...({} as any)}
      vaultAddress={{ [mainnet.id]: VAULT_ADDRESS }}
      assetToken={assetToken}
      vaultName="Tether Savings"
      provider={provider}
    />
  );
}

describe('MorphoVaultWidgetPane state→URL guard', () => {
  beforeEach(() => {
    mocks.chainId = mainnet.id;
    mocks.updateLinkedActionConfig.mockReset();
    mocks.exitLinkedActionMode.mockReset();
    mocks.setSelectedVaultsOption.mockReset();
    captured.onWidgetStateChange = undefined;
    setSearchParamsMock.mockClear();
  });

  it('writes amount + flow params for a Spark vault when vault_module=sky', () => {
    mockSearchParams = new URLSearchParams('widget=vaults&vault_module=sky');
    renderPane('sky');

    act(() => {
      captured.onWidgetStateChange?.({
        txStatus: 'idle',
        widgetState: { flow: 'withdraw' },
        originAmount: '100'
      });
    });

    expect(mockSearchParams.get('input_amount')).toBe('100');
    expect(mockSearchParams.get('flow')).toBe('withdraw');
  });

  it('writes amount + flow params for a Morpho vault when vault_module=morpho (unchanged)', () => {
    mockSearchParams = new URLSearchParams('widget=vaults&vault_module=morpho');
    renderPane('morpho');

    act(() => {
      captured.onWidgetStateChange?.({
        txStatus: 'idle',
        widgetState: { flow: 'supply' },
        originAmount: '250'
      });
    });

    expect(mockSearchParams.get('input_amount')).toBe('250');
    expect(mockSearchParams.get('flow')).toBe('supply');
  });

  it('clears the amount param when the amount is emptied on a Spark vault', () => {
    mockSearchParams = new URLSearchParams('widget=vaults&vault_module=sky&input_amount=100');
    renderPane('sky');

    act(() => {
      captured.onWidgetStateChange?.({
        txStatus: 'idle',
        widgetState: {},
        originAmount: ''
      });
    });

    expect(mockSearchParams.get('input_amount')).toBeNull();
  });

  it('does nothing when the vault_module does not match the open vault provider', () => {
    // Spark vault but URL still carries vault_module=morpho — a stale/foreign module.
    mockSearchParams = new URLSearchParams('widget=vaults&vault_module=morpho');
    renderPane('sky');

    act(() => {
      captured.onWidgetStateChange?.({
        txStatus: 'idle',
        widgetState: { flow: 'withdraw' },
        originAmount: '100'
      });
    });

    expect(mockSearchParams.get('input_amount')).toBeNull();
    expect(mockSearchParams.get('flow')).toBeNull();
  });
});
