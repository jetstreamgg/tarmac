import { ReactNode, useCallback, useId } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { useSavingsData, useTokenBalance, TOKENS } from '@/hooks';
import { formatNumber } from '@/utils';
import { Button } from '@/components/ui/button';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { SavingsSupplyCard } from './SavingsSupplyCard';
import { SavingsModalForm } from './SavingsModalForm';

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
 * Position-aware action card for the Savings product page (ProductDetailTemplate
 * `position` slot). The savings balance picks the card:
 *  - no position (incl. disconnected) → the no-position "Supply" entry card
 *    (`SavingsSupplyCard`, Figma 527:7404).
 *  - has position → the "My position" summary below, with Supply / Withdraw
 *    buttons that each open the shared editable modal (`SavingsModalForm`) for
 *    the chosen flow.
 *
 * Both branches confirm through `useSavingsLaunch()` (sUSDS deposit/withdraw +
 * DAI upgrade on mainnet, PSM swap on L2) — calldata unchanged.
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
  const { launch } = useTransaction();
  const supplySessionId = useId();
  const withdrawSessionId = useId();

  // Refresh position card + sUSDS balance after a successful supply/withdraw.
  // A no-position supply also flips this card to "My position" once the savings
  // balance refetches above zero.
  const refreshPosition = useCallback(() => {
    mutateSavings();
    refetchSusds();
  }, [mutateSavings, refetchSusds]);

  // Opens the editable "Supply to Sky Savings" modal (Figma 527:7591). The entry
  // body owns the amount and live-syncs the confirm gating + handler; the
  // placeholder onConfirm is replaced by the body's engine execute before it
  // enables. No analytics here — analytics parity is a separate sign-off-gated
  // slice (PRD Out of Scope).
  const openSupplyModal = useCallback(() => {
    launch({
      title: t`Supply to Sky Savings`,
      transactionTitle: t`Confirm in the wallet`,
      subtitles: {
        pending: t`Please confirm the transaction in your wallet.`,
        loading: t`Your supply is being processed on the blockchain. Please wait.`,
        success: t`You've successfully supplied to Sky Savings.`,
        error: t`An error occurred while supplying to Sky Savings.`
      },
      sessionId: supplySessionId,
      entry: {
        content: <SavingsModalForm sessionId={supplySessionId} flow="supply" />,
        confirmLabel: t`Supply`,
        confirmDisabled: true
      },
      onConfirm: () => {},
      onSuccess: refreshPosition
    });
  }, [launch, supplySessionId, refreshPosition]);

  // Opens the editable "Withdraw from Sky Savings" modal (Figma 527:10945). Same
  // entry-step machinery as supply — the body just runs the withdraw flow (its Max
  // redeems the whole position with no dust via maxWithdraw(owner)).
  const openWithdrawModal = useCallback(() => {
    launch({
      title: t`Withdraw from Sky Savings`,
      transactionTitle: t`Confirm in the wallet`,
      subtitles: {
        pending: t`Please confirm the transaction in your wallet.`,
        loading: t`Your withdrawal is being processed on the blockchain. Please wait.`,
        success: t`You've successfully withdrawn from Sky Savings.`,
        error: t`An error occurred while withdrawing from Sky Savings.`
      },
      sessionId: withdrawSessionId,
      entry: {
        content: <SavingsModalForm sessionId={withdrawSessionId} flow="withdraw" />,
        confirmLabel: t`Withdraw`,
        confirmDisabled: true
      },
      onConfirm: () => {},
      onSuccess: refreshPosition
    });
  }, [launch, withdrawSessionId, refreshPosition]);

  const hasPosition = (savingsData?.userSavingsBalance ?? 0n) > 0n;
  if (!hasPosition) {
    return <SavingsSupplyCard onSuccess={refreshPosition} />;
  }

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
        {/* Supply / Withdraw each open the editable modal for their flow. */}
        <div className="flex gap-3">
          <Button
            variant="primary"
            className="flex-1"
            onClick={openSupplyModal}
            disabled={!isConnected}
            data-testid="savings-position-supply"
          >
            <Trans>Supply</Trans>
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            onClick={openWithdrawModal}
            disabled={!isConnected}
            data-testid="savings-position-withdraw"
          >
            <Trans>Withdraw</Trans>
          </Button>
        </div>
      </div>
    </div>
  );
}
