import { t } from '@lingui/core/macro';
import { ModalSummaryGrid } from '@/components/product/ModalSummaryGrid';
import { toGridCells } from '@/components/product/ModalGridCells';
import { TokenTransferHero } from '@/components/product/TokenTransferHero';
import type { BridgeNetworkId } from '../model/networks';
import type { BridgeRoute } from '../model/types';
import { formatBigInt } from '@/utils';
import { buildBridgeModalRows, formatEtaWords } from './bridgeModalRows';
import { BridgeNetworkBadge } from './BridgeNetworkIcon';

export const bridgeFootnote = (route: BridgeRoute): string => {
  const eta = formatEtaWords(route.etaMinutes);
  return route.requiresClaim
    ? t`The transaction will be processed on the blockchain and is expected to complete within approximately ${eta}. You will need to claim your asset manually afterward.`
    : t`The transaction will be processed on the blockchain and is expected to complete within approximately ${eta}. Your funds will arrive automatically.`;
};

type BridgeTransferHeroProps = {
  amount: bigint;
  from: BridgeNetworkId;
  to: BridgeNetworkId;
  testId?: string;
};

/** USDS from → to hero with each side's network badge (Figma 3574:64110). */
export function BridgeTransferHero({ amount, from, to, testId }: BridgeTransferHeroProps) {
  const formatted = formatBigInt(amount, { minDecimals: 2, maxDecimals: 2 });
  return (
    <TokenTransferHero
      from={{
        symbol: 'USDS',
        amount: formatted,
        badge: <BridgeNetworkBadge network={from} />,
        testId: 'bridge-modal-from-amount'
      }}
      to={{
        symbol: 'USDS',
        amount: formatted,
        badge: <BridgeNetworkBadge network={to} />,
        testId: 'bridge-modal-to-amount'
      }}
      testId={testId}
    />
  );
}

type BridgeReviewContentProps = {
  amount: bigint;
  from: BridgeNetworkId;
  to: BridgeNetworkId;
  route: BridgeRoute;
  networkFee: string;
};

/** Read-only body of the "Review USDS bridge" modal: hero, summary grid, route footnote. */
export function BridgeReviewContent({ amount, from, to, route, networkFee }: BridgeReviewContentProps) {
  const rows = buildBridgeModalRows({ route, networkFee });
  return (
    <div className="flex flex-col gap-8 sm:gap-12" data-testid="bridge-modal-review">
      <BridgeTransferHero amount={amount} from={from} to={to} />
      <div className="flex flex-col gap-6">
        <ModalSummaryGrid rows={toGridCells(rows, 'bridge-modal-row')} dividerClassName="h-6" />
        <p className="text-fgSecondary text-xs leading-[18px]" data-testid="bridge-modal-footnote">
          {bridgeFootnote(route)}
        </p>
      </div>
    </div>
  );
}
