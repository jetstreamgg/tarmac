import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BalancesSuggestedActions } from './BalancesSuggestedActions';

let mockSearchParams = new URLSearchParams();

const setSearchParamsMock = vi.fn(
  (
    next:
      | URLSearchParams
      | ((params: URLSearchParams) => URLSearchParams)
  ) => {
    mockSearchParams =
      typeof next === 'function' ? next(new URLSearchParams(mockSearchParams)) : new URLSearchParams(next);
  }
);

const setIsSwitchingNetworkMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [mockSearchParams, setSearchParamsMock]
}));

vi.mock('wagmi', () => ({
  useChainId: () => 1,
  useChains: () => [{ id: 1, name: 'Ethereum' }]
}));

vi.mock('@/modules/ui/context/NetworkSwitchContext', () => ({
  useNetworkSwitch: () => ({
    setIsSwitchingNetwork: setIsSwitchingNetworkMock
  })
}));

vi.mock('@jetstreamgg/sky-hooks', () => ({
  TOKENS: { usds: { symbol: 'USDS' }, spk: { symbol: 'SPK' }, cle: { symbol: 'CLE' } },
  MORPHO_VAULTS: [],
  useOverallSkyData: () => ({ data: undefined, isLoading: false }),
  useStUsdsData: () => ({ data: undefined, isLoading: false }),
  useMorphoVaultMultipleRateApiData: () => ({ data: [], isLoading: false }),
  useAvailableTokenRewardContracts: () => [],
  useRewardsChartInfo: () => ({ data: undefined, isLoading: false }),
  useHighestRateFromChartData: () => undefined,
  filterDeprecatedRewardContracts: () => [],
  useStakeRewardContracts: () => ({ data: [], isLoading: false }),
  useMultipleRewardsChartInfo: () => ({ data: [], isLoading: false })
}));

vi.mock('@jetstreamgg/sky-utils', () => ({
  formatDecimalPercentage: (value: number) => `${value}%`,
  calculateApyFromStr: (value: string) => Number(value),
  isTestnetId: () => false,
  isMainnetId: (chainId: number) => chainId === 1,
  chainId: { mainnet: 1, tenderly: 314310 }
}));

vi.mock('@jetstreamgg/sky-widgets', () => ({
  Morpho: () => <div>morpho</div>,
  PopoverRateInfo: () => <div>popover-rate-info</div>
}));

describe('BalancesSuggestedActions', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams('lang=en&details=false&chat=true');
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
    expect(mockSearchParams.get('chat')).toBe('true');
  });
});
