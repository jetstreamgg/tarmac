import { act, type KeyboardEventHandler, type ReactNode } from 'react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConvertWidgetPane } from './ConvertWidgetPane';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
i18n.load('en', {});
i18n.activate('en');

const analyticsMocks = vi.hoisted(() => ({
  chainId: 1,
  isPending: false,
  switchChain: vi.fn(),
  trackConvertModuleSelected: vi.fn(),
  setSelectedConvertOption: vi.fn(),
  info: vi.fn(),
  error: vi.fn()
}));

let mockSearchParams = new URLSearchParams();

const setSearchParamsMock = vi.fn(
  (next: URLSearchParams | ((params: URLSearchParams) => URLSearchParams)) => {
    mockSearchParams =
      typeof next === 'function' ? next(new URLSearchParams(mockSearchParams)) : new URLSearchParams(next);
  }
);

vi.mock('@jetstreamgg/sky-widgets', async importOriginal => {
  const actual = await importOriginal<typeof import('@jetstreamgg/sky-widgets')>();
  return {
    ...actual,
    CardAnimationWrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    WidgetContainer: ({
      children,
      header,
      subHeader
    }: {
      children: ReactNode;
      header?: ReactNode;
      subHeader?: ReactNode;
    }) => (
      <div>
        {header}
        {subHeader}
        {children}
      </div>
    )
  };
});

vi.mock('@/modules/config/hooks/useConfigContext', () => ({
  useConfigContext: () => ({
    selectedConvertOption: undefined,
    setSelectedConvertOption: analyticsMocks.setSelectedConvertOption
  })
}));

vi.mock('react-router-dom', async importOriginal => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useSearchParams: () => [mockSearchParams, setSearchParamsMock]
  };
});

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    info: analyticsMocks.info,
    error: analyticsMocks.error
  })
}));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();

  return {
    ...actual,
    useChainId: () => analyticsMocks.chainId,
    useChains: () => [
      { id: 1, name: 'Ethereum' },
      { id: 8453, name: 'Base' }
    ],
    useSwitchChain: () => ({
      switchChain: analyticsMocks.switchChain,
      isPending: analyticsMocks.isPending
    })
  };
});

vi.mock('@jetstreamgg/sky-utils', async importOriginal => {
  const actual = await importOriginal<typeof import('@jetstreamgg/sky-utils')>();
  return {
    ...actual,
    isL2ChainId: (chainId: number) => chainId !== 1,
    isMainnetId: (chainId: number) => chainId === 1,
    useIsSafeWallet: () => false
  };
});

vi.mock('@/data/wagmi/config/config.default', () => ({
  getSupportedChainIds: () => [1, 8453],
  tenderly: { id: 314310 }
}));

vi.mock('@/lib/helpers/string/normalizeUrlParam', () => ({
  normalizeUrlParam: (value: string) => value.toLowerCase()
}));

vi.mock('@/modules/analytics/hooks/useAppAnalytics', () => ({
  useAppAnalytics: () => ({
    trackConvertModuleSelected: analyticsMocks.trackConvertModuleSelected
  })
}));

vi.mock('@/modules/upgrade/components/UpgradeWidgetPane', () => ({
  UpgradeWidgetPane: () => <div>upgrade-widget</div>
}));

vi.mock('@/modules/trade/components/TradeWidgetPane', () => ({
  TradeWidgetPane: () => <div>trade-widget</div>
}));

vi.mock('./PsmConversionWidgetPane', () => ({
  PsmConversionWidgetPane: () => <div>psm-widget</div>
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({
    children,
    onClick,
    onKeyDown
  }: {
    children: ReactNode;
    onClick?: () => void;
    onKeyDown?: KeyboardEventHandler<HTMLButtonElement>;
  }) => (
    <button onClick={onClick} onKeyDown={onKeyDown} type="button">
      {children}
    </button>
  ),
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>
}));

vi.mock('@/modules/layout/components/HStack', () => ({
  HStack: ({ children }: { children: ReactNode }) => <div>{children}</div>
}));

vi.mock('@/modules/layout/components/Typography', () => ({
  Heading: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: ReactNode }) => <div>{children}</div>
}));

vi.mock('@/modules/icons', async importOriginal => {
  const actual = await importOriginal<typeof import('@/modules/icons')>();
  return {
    ...actual,
    Convert: () => <span>convert-icon</span>,
    Expert: () => <span>expert-icon</span>,
    RewardsModule: () => <span>rewards-icon</span>,
    Savings: () => <span>savings-icon</span>,
    Seal: () => <span>seal-icon</span>,
    Upgrade: () => <span>upgrade-icon</span>,
    Trade: () => <span>trade-icon</span>,
    Vaults: () => <span>vaults-icon</span>
  };
});

vi.mock('motion/react', async importOriginal => {
  const actual = await importOriginal<typeof import('motion/react')>();
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>
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

describe('ConvertWidgetPane', () => {
  beforeEach(() => {
    analyticsMocks.chainId = 1;
    analyticsMocks.isPending = false;
    analyticsMocks.switchChain.mockReset();
    analyticsMocks.switchChain.mockImplementation(
      (_params: { chainId: number }, callbacks?: { onSuccess?: () => void }) => callbacks?.onSuccess?.()
    );
    analyticsMocks.trackConvertModuleSelected.mockReset();
    analyticsMocks.setSelectedConvertOption.mockReset();
    analyticsMocks.info.mockReset();
    analyticsMocks.error.mockReset();
    mockSearchParams = new URLSearchParams('widget=convert');
    setSearchParamsMock.mockClear();
  });

  it('tracks convert-module selection when the Trade card is chosen', () => {
    const { container } = renderComponent(
      <ConvertWidgetPane {...({ rightHeaderComponent: <div /> } as any)} />
    );

    clickButtonByText(container, /Trade/i);

    expect(analyticsMocks.trackConvertModuleSelected).toHaveBeenCalledWith({
      convertModule: 'trade',
      previousConvertModule: undefined,
      selectionMethod: 'card',
      entrySurface: 'convert_landing',
      chainId: 1
    });
  });

  it('tracks convert-module selection when Upgrade is chosen after an L2 switch', () => {
    analyticsMocks.chainId = 8453;

    const { container } = renderComponent(
      <ConvertWidgetPane {...({ rightHeaderComponent: <div /> } as any)} />
    );

    clickButtonByText(container, /Upgrade/i);

    expect(analyticsMocks.trackConvertModuleSelected).toHaveBeenCalledWith({
      convertModule: 'upgrade',
      previousConvertModule: undefined,
      selectionMethod: 'card',
      entrySurface: 'convert_landing',
      chainId: 8453
    });
  });
});
