import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mainnet } from 'wagmi/chains';
import { BalancesSuggestedActions } from './BalancesSuggestedActions';
import { sparkUsdtVaultAddress } from '@/hooks';

const SPARK_USDT_VAULT_ADDRESS = sparkUsdtVaultAddress[mainnet.id];

let mockSearch: Record<string, string> = {};
let lastNavigation: { to: string; search: Record<string, string> } | undefined;

const navigateMock = vi.fn(
  ({ to, search }: { to: string; search: (prev: Record<string, string>) => Record<string, string> }) => {
    lastNavigation = { to, search: search(mockSearch) };
  }
);

const setIsSwitchingNetworkMock = vi.fn();

vi.mock('@tanstack/react-router', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    useNavigate: () => navigateMock
  };
});

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => 1,
    useChains: () => [{ id: 1, name: 'Ethereum' }]
  };
});

vi.mock('@/modules/ui/context/NetworkSwitchContext', () => ({
  useNetworkSwitch: () => ({
    setIsSwitchingNetwork: setIsSwitchingNetworkMock
  })
}));

vi.mock('@/modules/geo-config', () => ({
  useGeoConfig: () => ({
    isModuleEnabled: () => true,
    isRegionRestricted: false
  })
}));

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useOverallSkyData: () => ({ data: undefined, isLoading: false }),
    useStUsdsData: () => ({ data: undefined, isLoading: false }),
    useMorphoVaultMultipleRateApiData: () => ({ data: [], isLoading: false }),
    useSparkVaultResolvedRate: () => ({ formattedRate: '6.01%', isLoading: false }),
    useAvailableTokenRewardContracts: () => [],
    useRewardsChartInfo: () => ({ data: undefined, isLoading: false }),
    useHighestRateFromChartData: () => undefined,
    filterDeprecatedRewardContracts: () => [],
    useStakeRewardContracts: () => ({ data: [], isLoading: false }),
    useMultipleRewardsChartInfo: () => ({ data: [], isLoading: false }),
    usePendleMarketsApiData: () => ({ data: undefined, isLoading: false, error: null, refetch: () => {} })
  };
});

vi.mock('@/utils', async importOriginal => {
  const actual = await importOriginal<typeof import('@/utils')>();
  return {
    ...actual,
    formatDecimalPercentage: (value: number) => `${value}%`,
    calculateApyFromStr: (value: string) => Number(value),
    isTestnetId: () => false,
    isMainnetId: (chainId: number) => chainId === 1,
    chainId: { mainnet: 1, tenderly: 314310 }
  };
});

vi.mock('@/widgets', async importOriginal => {
  const actual = await importOriginal<typeof import('@/widgets')>();
  return {
    ...actual,
    Morpho: () => <div>morpho</div>,
    PopoverRateInfo: () => <div>popover-rate-info</div>
  };
});

describe('BalancesSuggestedActions', () => {
  beforeEach(() => {
    mockSearch = { lang: 'en' };
    lastNavigation = undefined;
    navigateMock.mockClear();
    setIsSwitchingNetworkMock.mockClear();
  });

  it('renders the featured 1:1 Conversion card first for token actions', () => {
    render(<BalancesSuggestedActions widget="tokens" variant="card-sm" />);

    const buttons = screen.getAllByRole('button');
    expect(buttons[0].textContent).toContain('1:1 Conversion');
    expect(screen.getByText('Get USDS')).toBeTruthy();
    expect(screen.getByText('Get SKY')).toBeTruthy();
  });

  it('navigates to convert psm when the featured card is clicked', () => {
    render(<BalancesSuggestedActions widget="tokens" variant="card-sm" />);

    fireEvent.click(screen.getByRole('button', { name: /1:1 Conversion/i }));

    expect(setIsSwitchingNetworkMock).not.toHaveBeenCalled();
    expect(lastNavigation?.to).toBe('/convert/psm');
    expect(lastNavigation?.search).toEqual({
      source_token: 'USDC',
      network: 'ethereum',
      lang: 'en'
    });
  });

  it('renders the Tether Savings (sUSDT) card with a New badge for stables', () => {
    render(<BalancesSuggestedActions widget="stables" variant="card" />);

    const card = screen.getByRole('button', { name: /Tether Savings \(sUSDT\)/i });
    expect(card.textContent).toContain('New');
    expect(card.textContent).toContain('6.01%');
  });

  it('deep-links to the sUSDT vault when the Tether Savings card is clicked', () => {
    render(<BalancesSuggestedActions widget="stables" variant="card" />);

    fireEvent.click(screen.getByRole('button', { name: /Tether Savings \(sUSDT\)/i }));

    expect(lastNavigation?.to).toBe(`/earn/vaults/sky/${SPARK_USDT_VAULT_ADDRESS}`);
    expect(lastNavigation?.search).toEqual({ network: 'ethereum', lang: 'en' });
  });

  // The Tether Savings action links to the vault by address (it bypasses the
  // VAULTS registry), so it must be gated separately by the feature flag (APP-323).
  it('hides the Tether Savings (sUSDT) card when the feature flag is off', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_SUSDT_VAULT_ENABLED', 'false');
    const { BalancesSuggestedActions: GatedActions } = await import('./BalancesSuggestedActions');

    render(<GatedActions widget="stables" variant="card" />);

    expect(screen.queryByRole('button', { name: /Tether Savings \(sUSDT\)/i })).toBeNull();
    // Other stables suggestions are unaffected.
    expect(screen.getByRole('button', { name: /Sky Savings Rate/i })).toBeTruthy();

    vi.unstubAllEnvs();
    vi.resetModules();
  });
});
