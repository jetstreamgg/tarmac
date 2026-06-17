import { ReactNode } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { useSavingsData, useTokenBalance, TOKENS } from '@/hooks';
import { formatNumber } from '@/utils';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { SavingsSupplyWithdrawPanel } from './SavingsSupplyWithdrawPanel';

const NO_VALUE = '–';

const formatToken = (value?: bigint) =>
  value === undefined ? NO_VALUE : formatNumber(parseFloat(formatUnits(value, 18)), { maxDecimals: 2 });

function StatRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-textSecondary text-sm">{label}</span>
      <span className="text-text flex items-center gap-1.5 text-sm font-medium">{children}</span>
    </div>
  );
}

// TODO(C3): 'Already earned' + '1Y projected earnings' have no data source yet
// (cost-basis / projection hooks pending) — both rows render this placeholder,
// intentionally unwired per the C3 scope decision.
const TodoValue = () => <span className="text-textSecondary text-sm italic">TODO</span>;

/**
 * The "My position" card for the Savings product page (ProductDetailTemplate
 * `position` slot).
 *
 * D3: supply AND withdraw run inline on the new transaction surface
 * (`SavingsSupplyWithdrawPanel` → `useSavingsLaunch().launch()`) on both mainnet
 * (sUSDS deposit/withdraw + DAI upgrade) and L2 (PSM swap). The legacy
 * `SavingsWidget` / `L2SavingsWidget` stack is fully retired in the closeout slice.
 */
export function SavingsPositionCard() {
  const chainId = useChainId();
  const { address, isConnected } = useConnection();
  const { data: savingsData, mutate: mutateSavings } = useSavingsData();
  const { data: susdsBalance, refetch: refetchSusds } = useTokenBalance({
    address,
    chainId,
    token: TOKENS.susds.address[chainId]
  });

  // Refresh position card + sUSDS balance after a successful inline supply/withdraw.
  const refreshPosition = () => {
    mutateSavings();
    refetchSusds();
  };

  const position = isConnected ? formatToken(savingsData?.userSavingsBalance) : NO_VALUE;
  const susds = isConnected ? formatToken(susdsBalance?.value) : NO_VALUE;

  return (
    <div
      className="bg-panel flex flex-col gap-3 rounded-[20px] p-2 backdrop-blur-2xl"
      data-testid="savings-position-card"
    >
      {/* Hero — position value over the brand gradient (cloud art placeholder),
          inset within the glass card. */}
      <div className="flex min-h-[160px] flex-col justify-between overflow-hidden rounded-2xl bg-[radial-gradient(120%_120%_at_20%_0%,_#7E6BF2_0%,_#3B2E7D_60%,_#2A1E63_100%)] p-5">
        <span className="text-text/80 text-sm">
          <Trans>My position</Trans>
        </span>
        <span className="text-text flex items-center gap-2 text-3xl font-semibold">
          <TokenIcon token={{ symbol: 'USDS' }} width={28} showChainIcon={false} className="h-7 w-7" />
          {position}
        </span>
      </div>

      <div className="flex flex-col gap-4 px-3 pb-3">
        <div className="flex flex-col gap-3">
          <StatRow label={<Trans>sUSDS balance</Trans>}>
            <TokenIcon
              token={{ symbol: 'sUSDS' }}
              width={18}
              showChainIcon={false}
              className="h-[18px] w-[18px]"
            />
            {susds}
          </StatRow>
          <StatRow label={<Trans>Already earned</Trans>}>
            <TodoValue />
          </StatRow>
          <StatRow label={<Trans>1Y projected earnings</Trans>}>
            <TodoValue />
          </StatRow>
        </div>
        {/* Supply/withdraw run inline on the new transaction surface across all
            networks (mainnet sUSDS / DAI-upgrade, L2 PSM swap). */}
        <SavingsSupplyWithdrawPanel onSuccess={refreshPosition} />
      </div>
    </div>
  );
}
