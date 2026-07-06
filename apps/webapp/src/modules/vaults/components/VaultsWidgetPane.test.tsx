import { act, type ReactNode } from 'react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { createRoot } from 'react-dom/client';
import { mainnet } from 'wagmi/chains';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VaultsWidgetPane } from './VaultsWidgetPane';
import { sparkUsdtVaultAddress } from '@/hooks/generated';

const SPARK_USDT_VAULT_ADDRESS = sparkUsdtVaultAddress[mainnet.id];

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
i18n.load('en', {});
i18n.activate('en');

const mocks = vi.hoisted(() => ({
  chainId: 1, // mainnet.id — literal because vi.hoisted runs before imports
  setSelectedVaultsOption: vi.fn()
}));

let mockSearchParams = new URLSearchParams();

const setSearchParamsMock = vi.fn(
  (next: URLSearchParams | ((params: URLSearchParams) => URLSearchParams)) => {
    mockSearchParams =
      typeof next === 'function' ? next(new URLSearchParams(mockSearchParams)) : new URLSearchParams(next);
  }
);

vi.mock('@/widgets', async importOriginal => {
  const actual = await importOriginal<typeof import('@/widgets')>();
  return {
    ...actual,
    CardAnimationWrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    WidgetContainer: ({ children, header }: { children: ReactNode; header?: ReactNode }) => (
      <div>
        {header}
        {children}
      </div>
    )
  };
});

vi.mock('@/modules/config/hooks/useConfigContext', () => ({
  useConfigContext: () => ({
    selectedVaultsOption: undefined,
    setSelectedVaultsOption: mocks.setSelectedVaultsOption
  })
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

// Keep the real VAULTS registry (so Spark + Morpho vaults are present); only stub
// the user-balance hook so every vault lands in the "All vaults" list.
vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useAllMorphoVaultsUserAssets: () => ({ data: undefined })
  };
});

// The detail pane is never reached (no vault selected on initial render); stub it.
vi.mock('@/modules/morpho/components/MorphoVaultWidgetPane', () => ({
  MorphoVaultWidgetPane: () => <div>morpho-vault-widget-pane</div>
}));

// Render each vault card as a button labelled by its name so the test can click it
// and assert the resulting search params — not the click internals.
vi.mock('@/modules/expert/components/VaultStatsCard', () => ({
  VaultStatsCard: ({ vaultName, onClick }: { vaultName: string; onClick?: () => void }) => (
    <button onClick={onClick} type="button">
      {vaultName}
    </button>
  )
}));

vi.mock('motion/react', async importOriginal => {
  const actual = await importOriginal<typeof import('motion/react')>();
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
    motion: new Proxy(
      {},
      {
        get:
          () =>
          ({ children }: { children: ReactNode }) => <div>{children}</div>
      }
    )
  };
});

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

function clickButtonByText(container: HTMLElement, matcher: RegExp) {
  const button = Array.from(container.querySelectorAll('button')).find(node =>
    matcher.test(node.textContent || '')
  );

  if (!button) {
    throw new Error(`Could not find button matching ${matcher}`);
  }

  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('VaultsWidgetPane card-select URL build', () => {
  beforeEach(() => {
    mocks.chainId = mainnet.id;
    mocks.setSelectedVaultsOption.mockReset();
    mockSearchParams = new URLSearchParams('widget=vaults');
    setSearchParamsMock.mockClear();
  });

  it('writes vault_module=sky and the vault address when the Spark vault card is selected', () => {
    const { container } = renderComponent(
      <VaultsWidgetPane {...({ rightHeaderComponent: <div /> } as any)} />
    );

    clickButtonByText(container, /Tether Savings/i);

    expect(mockSearchParams.get('vault_module')).toBe('sky');
    expect(mockSearchParams.get('vault')?.toLowerCase()).toBe(SPARK_USDT_VAULT_ADDRESS.toLowerCase());
  });

  it('writes vault_module=morpho when a Morpho vault card is selected', () => {
    const { container } = renderComponent(
      <VaultsWidgetPane {...({ rightHeaderComponent: <div /> } as any)} />
    );

    clickButtonByText(container, /USDS Flagship/i);

    expect(mockSearchParams.get('vault_module')).toBe('morpho');
  });
});
