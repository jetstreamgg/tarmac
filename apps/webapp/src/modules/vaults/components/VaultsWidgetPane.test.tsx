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

const navigateMock = vi.fn();
let mockEntityParams: Record<string, string | undefined> = {};

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

vi.mock('@tanstack/react-router', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    useNavigate: () => navigateMock
  };
});

vi.mock('@/lib/navigation', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/navigation')>();
  return {
    ...actual,
    useAppSearchParams: () => [mockSearchParams, setSearchParamsMock],
    useRouteEntityParams: () => mockEntityParams
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
// and assert the resulting navigation — not the click internals.
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

describe('VaultsWidgetPane card-select navigation', () => {
  beforeEach(() => {
    mocks.chainId = mainnet.id;
    mocks.setSelectedVaultsOption.mockReset();
    mockSearchParams = new URLSearchParams();
    setSearchParamsMock.mockClear();
    navigateMock.mockClear();
    mockEntityParams = {};
  });

  it('navigates to the sky vault detail path when the Spark vault card is selected', () => {
    const { container } = renderComponent(<VaultsWidgetPane />);

    clickButtonByText(container, /Tether Savings/i);

    expect(navigateMock).toHaveBeenCalledTimes(1);
    const navArg = navigateMock.mock.calls[0][0];
    expect(navArg.to).toBe('/earn/vaults/$provider/$vaultAddress');
    expect(navArg.params.provider).toBe('sky');
    expect(navArg.params.vaultAddress.toLowerCase()).toBe(SPARK_USDT_VAULT_ADDRESS.toLowerCase());
  });

  it('navigates to the morpho vault detail path when a Morpho vault card is selected', () => {
    const { container } = renderComponent(<VaultsWidgetPane />);

    clickButtonByText(container, /USDS Flagship/i);

    expect(navigateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/earn/vaults/$provider/$vaultAddress',
        params: expect.objectContaining({ provider: 'morpho' })
      })
    );
  });
});
