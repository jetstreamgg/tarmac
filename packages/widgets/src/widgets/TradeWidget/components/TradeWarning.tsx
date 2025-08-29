import { Trans } from '@lingui/react/macro';
import { Text } from '@widgets/shared/components/ui/Typography';
import { TokenForChain } from '@jetstreamgg/sky-hooks';
import { Info } from '@widgets/shared/components/icons/Info';

export const TradeWarning = ({
  originToken,
  currentAllowance,
  neededAllowance,
  batchEnabled = true
}: {
  originToken?: TokenForChain;
  currentAllowance?: bigint;
  neededAllowance?: bigint;
  batchEnabled?: boolean;
}) => {
  const isUsdt = originToken?.symbol === 'USDT';

  // Show warning if:
  // 1. Token is USDT
  // 2. We have allowance data
  // 3. Current allowance is greater than 0 but less than needed
  const needsReset =
    isUsdt &&
    currentAllowance !== undefined &&
    neededAllowance !== undefined &&
    currentAllowance > 0n &&
    currentAllowance < neededAllowance;

  if (!needsReset) return null;

  return (
    <div className="ml-3 mt-2 flex items-start text-white">
      <Info className="mt-1 shrink-0" />
      <Text variant="small" className="ml-2 flex gap-2">
        {batchEnabled ? (
          <Trans>
            USDT allowance will be reset to 0 then set to the required amount in a single batched transaction.
          </Trans>
        ) : (
          <Trans>
            USDT requires allowance reset. Please enable batch transactions to complete this trade.
          </Trans>
        )}
      </Text>
    </div>
  );
};
