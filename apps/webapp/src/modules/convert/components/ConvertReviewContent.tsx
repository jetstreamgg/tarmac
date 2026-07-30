import { formatUnits } from 'viem';
import { formatNumber } from '@/utils';
import { ModalSummaryGrid } from '@/components/product/ModalSummaryGrid';
import { toGridCells } from '@/components/product/ModalGridCells';
import { TokenTransferHero } from '@/components/product/TokenTransferHero';
import { buildConvertModalRows } from './convertModalRows';

// The comps pin two decimals on every amount ("10,000.00", Figma 1036:205517).
const formatAmount = (amount: bigint, decimals: number) =>
  formatNumber(parseFloat(formatUnits(amount, decimals)), { minDecimals: 2, maxDecimals: 2 });

/**
 * Read-only body for the "Review conversion" modal (Figma 1036:205509), passed
 * to `launch()` as `transactionContent`. The from → to hero over the shared
 * summary grid ([Rate pair | Network], [Slippage | Fee], Network fee). Amounts
 * are display-only — the engine (`usePsmConversion`) owns the calldata this
 * screen previews.
 */
export function ConvertReviewContent({
  originSymbol,
  targetSymbol,
  originAmount,
  targetAmount,
  originDecimals,
  targetDecimals,
  networkName,
  networkFee
}: {
  originSymbol: string;
  targetSymbol: string;
  originAmount: bigint;
  targetAmount: bigint;
  originDecimals: number;
  targetDecimals: number;
  networkName: string;
  networkFee: string;
}) {
  const rows = buildConvertModalRows({
    originSymbol,
    targetSymbol,
    network: networkName,
    networkFee
  });

  return (
    <div className="flex flex-col gap-8 sm:gap-12" data-testid="convert-modal-review">
      <TokenTransferHero
        from={{
          symbol: originSymbol,
          amount: formatAmount(originAmount, originDecimals),
          testId: 'convert-modal-from-amount'
        }}
        to={{
          symbol: targetSymbol,
          amount: formatAmount(targetAmount, targetDecimals),
          testId: 'convert-modal-to-amount'
        }}
      />
      <ModalSummaryGrid rows={toGridCells(rows, 'convert-modal-row')} dividerClassName="h-6" />
    </div>
  );
}
