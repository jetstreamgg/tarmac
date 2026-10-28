import { useId, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { t } from '@lingui/core/macro';
import { Checkbox } from '@/components/ui/checkbox';
import { ModalSummaryGrid } from '@/components/product/ModalSummaryGrid';
import { toGridCells } from '@/components/product/ModalGridCells';
import { TokenTransferHero } from '@/components/product/TokenTransferHero';
import type { BridgeNetworkId } from '../model/networks';
import type { BridgeRoute, BridgeRouteKind } from '../model/types';
import { formatAddress, formatBigInt } from '@/utils';
import { cn } from '@/lib/cn';
import { buildBridgeModalRows, formatEta, formatEtaWords } from './bridgeModalRows';
import { BridgeNetworkBadge } from './BridgeNetworkIcon';
import { BridgeFastBadge, BridgeRoutePicker } from './BridgeRoutePicker';
import type { RouteOptionCard } from './bridgeRouteOptions';
import { BridgeWarningBox } from './BridgeWarningBox';

export const bridgeFootnote = (route: BridgeRoute): string => {
  const eta = formatEtaWords(route.etaMinutes);
  const actions = route.kind === 'native' ? route.steps.map(step => step.action) : [];
  if (actions.includes('prove'))
    return t`The withdrawal takes about ${eta}. You will need to come back to Ethereum twice: to prove it, usually within an hour or two, and to finalize it once the waiting period ends. Both steps need ETH on Ethereum for gas.`;
  if (actions.includes('finalize'))
    return t`The withdrawal takes about ${eta}. Once it's ready, finalize it on Ethereum to receive your USDS. This step needs ETH on Ethereum for gas.`;
  return route.requiresClaim
    ? t`The transaction will be processed on the blockchain and is expected to complete within approximately ${eta}. You will need to claim your asset manually afterward.`
    : t`The transaction will be processed on the blockchain and is expected to complete within approximately ${eta}. Your funds will arrive automatically.`;
};

type BridgeTransferHeroProps = {
  amount: bigint;
  from: BridgeNetworkId;
  to: BridgeNetworkId;
  /** Sender and recipient, shown under each amount when they differ (Figma 3957:56201). */
  addresses?: { from: string; to: string };
  /** A continued CCTP bridge sends the USDC its swap left (Figma 91). */
  fromToken?: 'USDS' | 'USDC';
  testId?: string;
};

/** USDS from → to hero with each side's network badge (Figma 3574:64110). */
export function BridgeTransferHero({
  amount,
  from,
  to,
  addresses,
  fromToken = 'USDS',
  testId
}: BridgeTransferHeroProps) {
  const formatted = formatBigInt(amount, { minDecimals: 2, maxDecimals: 2 });
  return (
    <TokenTransferHero
      from={{
        symbol: fromToken,
        amount: formatted,
        badge: <BridgeNetworkBadge network={from} />,
        caption: addresses && formatAddress(addresses.from, 5, 3),
        testId: 'bridge-modal-from-amount'
      }}
      to={{
        symbol: 'USDS',
        amount: formatted,
        badge: <BridgeNetworkBadge network={to} />,
        caption: addresses && formatAddress(addresses.to, 5, 3),
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
  bridgeFee?: string;
  /** Sender and recipient, when the bridge pays another address. */
  addresses?: { from: string; to: string };
  /** The token sent, USDC for a continued CCTP bridge. */
  fromToken?: 'USDS' | 'USDC';
  /** A Safe's unused Arbitrum fee is refunded to its L2 alias. */
  aliasedRefund?: boolean;
  /** A CCTP claim minting to another address: only its wallet can claim, once told. */
  recipientWarning?: boolean;
  /** A contract wallet's CCTP claim to itself, which it confirms it can send on Ethereum. */
  contractWallet?: { accepted: boolean; onAcceptedChange: (accepted: boolean) => void };
  /** A Safe's CCTP legs are separate Safe transactions, and no swap of a Safe is kept to continue. */
  safeQueue?: boolean;
  /** Browser storage takes no writes, so this bridge isn't kept to come back to. */
  storageNote?: boolean;
  /**
   * The routes the user can pick between from the Bridge type row (Figma 50, 60). With `beside`,
   * the caller draws the options next to the review (Figma 3964:74437); without, they swap in place.
   */
  routePicker?: {
    cards: RouteOptionCard[];
    onPick: (kind: BridgeRouteKind) => void;
    beside?: { open: boolean; onOpenChange: (open: boolean) => void };
  };
};

/** The arrival with the slowest pickable route struck out, when the picked one is faster (Figma 3964:74437). */
const arrivalAgainst = (route: BridgeRoute, cards: RouteOptionCard[] | undefined) => {
  const slower = Math.max(
    ...(cards ?? [])
      .filter(card => !card.unavailable && card.kind !== route.kind)
      .map(card => card.etaMinutes)
  );
  if (!(slower > route.etaMinutes)) return undefined;
  return (
    <span className="flex items-center gap-1" data-testid="bridge-modal-eta">
      <s className="text-fgSecondary text-xs leading-[18px] font-normal">{formatEta(slower)}</s>
      <BridgeFastBadge testId="bridge-modal-eta-fast">{formatEta(route.etaMinutes)}</BridgeFastBadge>
    </span>
  );
};

/** Read-only body of the "Review USDS bridge" modal: hero, summary grid, route footnote. */
export function BridgeReviewContent({
  amount,
  from,
  to,
  route,
  networkFee,
  bridgeFee,
  addresses,
  fromToken,
  aliasedRefund,
  recipientWarning,
  contractWallet,
  safeQueue,
  storageNote,
  routePicker
}: BridgeReviewContentProps) {
  const [choosing, setChoosing] = useState(false);
  const built = buildBridgeModalRows({ route, networkFee, bridgeFee, fromToken });
  const [[bridgeType, ...firstRow], [arrival, ...secondRow], ...rest] = built;
  const fastArrival = arrivalAgainst(route, routePicker?.cards);
  const arrivalRow = [
    fastArrival ? { label: arrival.label, kind: 'node' as const, node: fastArrival } : arrival,
    ...secondRow
  ];
  const beside = routePicker?.beside;
  const rows = routePicker
    ? [
        [
          {
            ...bridgeType,
            action: (
              <button
                type="button"
                onClick={() => (beside ? beside.onOpenChange(!beside.open) : setChoosing(true))}
                aria-label={t`Change bridge type`}
                aria-expanded={beside?.open}
                className="text-fgSecondary flex items-center"
                data-testid="bridge-modal-route-toggle"
              >
                <ChevronRight size={12} className={cn(beside?.open && 'rotate-180')} aria-hidden />
              </button>
            )
          },
          ...firstRow
        ],
        arrivalRow,
        ...rest
      ]
    : built;
  const contractCheckboxId = useId();
  if (routePicker && !beside && choosing)
    return (
      <BridgeRoutePicker
        cards={routePicker.cards}
        selected={route.kind}
        onPick={kind => {
          routePicker.onPick(kind);
          setChoosing(false);
        }}
        onBack={() => setChoosing(false)}
      />
    );
  return (
    <div className="flex flex-col gap-8 sm:gap-12" data-testid="bridge-modal-review">
      <BridgeTransferHero amount={amount} from={from} to={to} addresses={addresses} fromToken={fromToken} />
      <div className="flex flex-col gap-6">
        <ModalSummaryGrid rows={toGridCells(rows, 'bridge-modal-row')} dividerClassName="h-6" />
        <p className="text-fgSecondary text-xs leading-[18px]" data-testid="bridge-modal-footnote">
          {bridgeFootnote(route)}
        </p>
        {aliasedRefund && (
          <p className="text-fgSecondary text-xs leading-[18px]" data-testid="bridge-modal-aliased-refund">
            {t`Unused ETH from the bridge fee is refunded to your Safe's aliased address on Arbitrum, not to your Safe.`}
          </p>
        )}
        {recipientWarning && (
          <BridgeWarningBox title={t`Sending to another wallet`} dataTestId="bridge-modal-recipient-warning">
            {t`The recipient won't see this transfer automatically. Share the claim link or the transaction hash with them once it's sent. They need to claim on Ethereum from a wallet that controls the recipient address, so an exchange deposit address won't work.`}
          </BridgeWarningBox>
        )}
        {safeQueue && (
          <p className="text-fgSecondary text-xs leading-[18px]" data-testid="bridge-modal-safe-queue">
            {t`Your Safe sends this bridge as separate transactions. Sign and execute every one of them in your Safe's queue. If the swap executes but the burn doesn't, this app can't continue the bridge, and the USDC stays in your Safe.`}
          </p>
        )}
        {storageNote && (
          <p className="text-fgSecondary text-xs leading-[18px]" data-testid="bridge-modal-storage-note">
            {t`Your browser can't save this bridge. Copy the claim link after sending, or you'll need the transaction hash to find it later.`}
          </p>
        )}
        {contractWallet && (
          <div className="flex flex-col gap-3" data-testid="bridge-modal-contract-wallet">
            <p className="text-fgSecondary text-xs leading-[18px]">
              {t`Your wallet is a smart contract wallet. The USDC is minted to the same address on Ethereum and has to be claimed there from that wallet. Continue only if you control this address on Ethereum.`}
            </p>
            <div className="flex items-start gap-2">
              <Checkbox
                id={contractCheckboxId}
                checked={contractWallet.accepted}
                onCheckedChange={checked => contractWallet.onAcceptedChange(checked === true)}
                className="mt-0.5"
              />
              <label
                htmlFor={contractCheckboxId}
                className="text-fgSecondary cursor-pointer text-xs leading-[18px]"
              >
                {t`I control this address on Ethereum and can claim from it there.`}
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
