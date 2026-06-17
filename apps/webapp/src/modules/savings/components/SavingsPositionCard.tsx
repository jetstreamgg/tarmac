import { ReactNode, useState } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { X } from 'lucide-react';
import { L2SavingsWidget, SavingsFlow } from '@/widgets';
import { useSavingsData, useTokenBalance, TOKENS } from '@/hooks';
import { formatNumber, isL2ChainId } from '@/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
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
 * D3: on mainnet, supply AND withdraw run inline on the new transaction surface
 * (`SavingsSupplyWithdrawPanel` → `useSavingsLaunch().launch()`). L2 PSM
 * supply/withdraw still opens the legacy `L2SavingsWidget` modal until the L2
 * slices migrate it; the legacy stack is fully retired in the closeout slice.
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

  const isL2 = isL2ChainId(chainId);
  const [open, setOpen] = useState(false);
  const [flow, setFlow] = useState<SavingsFlow>(SavingsFlow.SUPPLY);

  const openFlow = (next: SavingsFlow) => {
    setFlow(next);
    setOpen(true);
  };

  // Refresh position card + sUSDS balance after a successful inline supply/withdraw.
  const refreshPosition = () => {
    mutateSavings();
    refetchSusds();
  };

  const position = isConnected ? formatToken(savingsData?.userSavingsBalance) : NO_VALUE;
  const susds = isConnected ? formatToken(susdsBalance?.value) : NO_VALUE;

  const card = (
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
        {isL2 ? (
          // L2 PSM supply/withdraw still runs on the legacy widget until the L2 slices.
          <div className="flex gap-3">
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => openFlow(SavingsFlow.SUPPLY)}
              data-testid="position-supply"
            >
              <Trans>Supply</Trans>
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => openFlow(SavingsFlow.WITHDRAW)}
              data-testid="position-withdraw"
            >
              <Trans>Withdraw</Trans>
            </Button>
          </div>
        ) : (
          <SavingsSupplyWithdrawPanel onSuccess={refreshPosition} />
        )}
      </div>
    </div>
  );

  // Mainnet runs fully inline on the new transaction surface — no modal.
  if (!isL2) return card;

  // L2 still hands off to the legacy widget in a modal until the L2 slices land.
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {card}

      <DialogContent aria-describedby={undefined} className="bg-background">
        <DialogTitle className="sr-only">
          <Trans>Manage your Sky Savings position</Trans>
        </DialogTitle>
        <DialogClose asChild>
          <Button
            variant="outline"
            className="text-text absolute top-4 right-4 h-8 w-8 rounded-full p-0"
            data-testid="position-modal-close"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogClose>
        {/* key on flow → reopening with a different action remounts the widget
            on the correct supply/withdraw tab. */}
        <L2SavingsWidget key={flow} externalWidgetState={{ flow }} />
      </DialogContent>
    </Dialog>
  );
}
