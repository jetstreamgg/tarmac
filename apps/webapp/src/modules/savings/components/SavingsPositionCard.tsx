import { ReactNode, useState } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { X } from 'lucide-react';
import { SavingsWidget, L2SavingsWidget, SavingsFlow } from '@/widgets';
import { useSavingsData, useTokenBalance, TOKENS } from '@/hooks';
import { formatNumber, isL2ChainId } from '@/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';

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
 * `position` slot). Supply/Withdraw open a modal hosting the existing
 * SavingsWidget — the inline launch() migration is deferred to D3.
 */
export function SavingsPositionCard() {
  const chainId = useChainId();
  const { address, isConnected } = useConnection();
  const { data: savingsData } = useSavingsData();
  const { data: susdsBalance } = useTokenBalance({ address, chainId, token: TOKENS.susds.address[chainId] });

  const [open, setOpen] = useState(false);
  const [flow, setFlow] = useState<SavingsFlow>(SavingsFlow.SUPPLY);
  const Widget = isL2ChainId(chainId) ? L2SavingsWidget : SavingsWidget;

  const openFlow = (next: SavingsFlow) => {
    setFlow(next);
    setOpen(true);
  };

  const position = isConnected ? formatToken(savingsData?.userSavingsBalance) : NO_VALUE;
  const susds = isConnected ? formatToken(susdsBalance?.value) : NO_VALUE;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div
        className="bg-card flex flex-col overflow-hidden rounded-[20px]"
        data-testid="savings-position-card"
      >
        {/* Hero — position value over the brand gradient (cloud art placeholder). */}
        <div className="flex min-h-[160px] flex-col justify-between bg-[radial-gradient(120%_120%_at_20%_0%,_#7E6BF2_0%,_#3B2E7D_60%,_#2A1E63_100%)] p-5">
          <span className="text-text/80 text-sm">
            <Trans>My position</Trans>
          </span>
          <span className="text-text flex items-center gap-2 text-3xl font-semibold">
            <TokenIcon token={{ symbol: 'USDS' }} width={28} showChainIcon={false} className="h-7 w-7" />
            {position}
          </span>
        </div>

        <div className="flex flex-col gap-4 p-5">
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
        </div>
      </div>

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
        <Widget key={flow} externalWidgetState={{ flow }} />
      </DialogContent>
    </Dialog>
  );
}
