import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mainnet } from 'wagmi/chains';
import { BalancesSuggestedActions } from './BalancesSuggestedActions';
import { sparkUsdtVaultAddress } from '@/hooks';

const SPARK_USDT_VAULT_ADDRESS = sparkUsdtVaultAddress[mainnet.id];

let mockSearchParams = new URLSearchParams();

const setSearchParamsMock = vi.fn(
  (next: URLSearchParams | ((params: URLSearchParams) => URLSearchParams)) => {
    mockSearchParams =
      typeof next === 'function' ? next(new URLSearchParams(mockSearchParams)) : new URLSearchParams(next);
  }
);

const setIsSwitchingNetworkMock = vi.fn();

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
    mockSearchParams = new URLSearchParams('lang=en&details=false');
    setSearchParamsMock.mockClear();
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
    expect(mockSearchParams.get('widget')).toBe('convert');
    expect(mockSearchParams.get('convert_module')).toBe('psm');
    expect(mockSearchParams.get('source_token')).toBe('USDC');
    expect(mockSearchParams.get('network')).toBe('ethereum');
    expect(mockSearchParams.get('lang')).toBe('en');
    expect(mockSearchParams.get('details')).toBe('false');
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

    expect(mockSearchParams.get('widget')).toBe('vaults');
    expect(mockSearchParams.get('vault')).toBe(SPARK_USDT_VAULT_ADDRESS);
    expect(mockSearchParams.get('vault_module')).toBe('sky');
    expect(mockSearchParams.get('network')).toBe('ethereum');
    expect(mockSearchParams.get('lang')).toBe('en');
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
