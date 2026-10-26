import type { Call } from 'viem';
import { t } from '@lingui/core/macro';
import { NO_VALUE } from '@/lib/constants';
import { formatBigInt, math } from '@/utils';
import { ConvertReviewContent } from '@/modules/convert/components/ConvertReviewContent';
import { useModalFeeCell } from '@/modules/ui/hooks/useModalFeeCell';
import { useNetworkName } from '@/modules/ui/hooks/useNetworkName';
import { BridgeWarningBox } from './BridgeWarningBox';

const formatUsdc = (amount: bigint) => formatBigInt(amount, { unit: 6, minDecimals: 2, maxDecimals: 2 });

type CctpConvertReviewProps = {
  /** The USDC (6 decimals) it sells. */
  amount: bigint;
  /** The USDC the bridge minted. */
  bridged: bigint;
  chainId: number;
  calls: Call[];
  isBatch: boolean;
};

/** "Review conversion" of the USDC a CCTP claim left in the wallet (Figma 94), warning when the wallet holds less than the bridge (Figma 95). */
export function CctpConvertReview({ amount, bridged, chainId, calls, isBatch }: CctpConvertReviewProps) {
  const networkName = useNetworkName(chainId);
  const feeCell = useModalFeeCell({ calls, chainId, shouldUseBatch: isBatch, enabled: calls.length > 0 });
  const held = formatUsdc(amount);
  const total = formatUsdc(bridged);

  return (
    <div className="flex flex-col gap-10">
      <ConvertReviewContent
        originSymbol="USDC"
        targetSymbol="USDS"
        originAmount={amount}
        targetAmount={math.convertUSDCtoWad(amount)}
        originDecimals={6}
        targetDecimals={18}
        networkName={networkName}
        networkFee={feeCell.fee?.formatted ?? NO_VALUE}
        feeCell={feeCell}
      />
      {amount < bridged && (
        <BridgeWarningBox title={t`Converting ${held} USDC`} dataTestId="cctp-convert-partial-warning">
          {t`This wallet holds ${held} of the ${total} USDC from your bridge, so we'll convert what's here to USDS at 1:1. If you move the rest back, you can convert it later from the Swap tab.`}
        </BridgeWarningBox>
      )}
    </div>
  );
}
