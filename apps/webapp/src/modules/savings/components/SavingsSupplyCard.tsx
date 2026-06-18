import { Trans } from '@lingui/react/macro';
import { SavingsSupplyWithdrawPanel } from './SavingsSupplyWithdrawPanel';

/**
 * No-position Savings action card (Figma 527:7404). Shown when the user holds no
 * savings position: a focused single-flow "Supply" entry rendered inline on the
 * product page — amount input + token, a "You'll receive" sUSDS preview, a
 * "1Y projected earnings" row (stubbed), and a full-width Supply CTA. There is no
 * Withdraw control and no Supply/Withdraw tabs. Confirming opens the existing
 * review modal via useSavingsLaunch, so calldata is unchanged.
 */
export function SavingsSupplyCard({ onSuccess }: { onSuccess?: () => void }) {
  return (
    <div
      className="bg-panel flex flex-col gap-4 rounded-[20px] p-5 backdrop-blur-2xl"
      data-testid="savings-supply-card"
    >
      <span className="text-text text-lg font-medium">
        <Trans>Supply</Trans>
      </span>
      <SavingsSupplyWithdrawPanel flow="supply" projection onSuccess={onSuccess} />
    </div>
  );
}
