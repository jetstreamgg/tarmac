import { useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { ChevronDown, Wallet } from 'lucide-react';
import { BP, useBreakpointIndex } from '@/hooks';
import { cn } from '@/lib/cn';
import { NO_VALUE } from '@/lib/constants';
import { formatAddress, formatBigInt } from '@/utils';
import { buttonVariants } from '@/components/ui/button';
import { AmountInput } from '@/components/product/AmountInput';
import { RollingValue } from '@/components/ui/rolling-value';
import { Text } from '@/modules/layout/components/Typography';
import { TokenBadge } from '@/modules/ui/components/TransactionAmountHero';
import { BRIDGE_NETWORKS, getBridgeNetwork } from '../model/networks';
import { allowedDestinations } from '../model/pairs';
import type { BridgeFormModel } from '../hooks/useBridgeForm';
import { USDS_DECIMALS } from '../model/usds';
import { BridgeNetworkSelect } from './BridgeNetworkSelect';
import { RecipientAddressModal } from './RecipientAddressModal';

const PERCENT_OPTIONS = [25, 50, 100] as const;

// Same amount typography as the Convert card.
const amountClassName =
  'text-text font-circle w-full min-w-0 text-2xl leading-[26px] font-medium tracking-[-0.48px] md:text-[32px] md:leading-[35px] md:tracking-[-0.64px]';

const panelClassName =
  'bg-glassSurface flex flex-col gap-2 p-4 backdrop-blur-[20px] md:gap-[9px] md:px-8 md:py-7';

const metaClassName = 'text-fgSecondary text-xs md:text-sm md:leading-[22px]';

const formatBalance = (balance: bigint | undefined) =>
  balance === undefined ? NO_VALUE : formatBigInt(balance, { maxDecimals: 2 });

type BridgeCardProps = { form: BridgeFormModel };

/**
 * The Bridge tab card (Figma 3574:64074): From and To glass panels, each with
 * its network dropdown, separated by the flip control. USDS only; the
 * destination amount mirrors the source 1:1. The To panel carries the
 * recipient button (3827:65770) — the wallet glyph, or the saved address.
 */
export function BridgeCard({ form }: BridgeCardProps) {
  const { bpi } = useBreakpointIndex();
  const isMobile = bpi < BP.md;
  const [recipientOpen, setRecipientOpen] = useState(false);
  const destinationFamily = getBridgeNetwork(form.to).family;

  const percentButtons = form.isConnected && (
    <span className="flex items-center gap-1">
      {PERCENT_OPTIONS.map(percent => (
        <button
          key={percent}
          type="button"
          onClick={() => form.setPercent(percent)}
          data-testid={`bridge-from-percent-${percent}`}
          className={cn(buttonVariants({ variant: 'mini', size: 'mini' }), 'text-xs leading-[14px]')}
        >
          {percent}%
        </button>
      ))}
    </span>
  );

  return (
    <div
      className="relative flex w-full flex-col gap-[2px] overflow-clip rounded-2xl md:rounded-[28px]"
      data-testid="bridge-card"
    >
      <div className={panelClassName} data-testid="bridge-from">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Text className={metaClassName}>
              <Trans>From</Trans>
            </Text>
            <BridgeNetworkSelect
              value={form.from}
              options={BRIDGE_NETWORKS.map(network => network.id)}
              onChange={form.selectFrom}
              isStatic={form.isSourceStatic}
              dataTestId="bridge-from-network"
            />
          </span>
          <Text className={metaClassName} dataTestId="bridge-from-balance">
            <Trans>Balance</Trans>: {form.isConnected ? formatBalance(form.sourceBalance) : NO_VALUE}
          </Text>
        </div>
        <div className="flex items-center justify-between gap-3">
          <AmountInput
            value={form.value}
            onChange={form.onInput}
            decimals={USDS_DECIMALS}
            ariaLabel={t`Bridge amount`}
            dataTestId="bridge-from-amount"
            className={cn(amountClassName, 'placeholder:text-text')}
          />
          <span className="flex shrink-0 items-center gap-3">
            {(!isMobile || form.value === '') && percentButtons}
            <TokenBadge symbol="USDS" />
          </span>
        </div>
      </div>

      <div className={panelClassName} data-testid="bridge-to">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Text className={metaClassName}>
              <Trans>To</Trans>
            </Text>
            <BridgeNetworkSelect
              value={form.to}
              options={allowedDestinations(form.from)}
              onChange={form.selectTo}
              dataTestId="bridge-to-network"
            />
          </span>
          <Text className={metaClassName} dataTestId="bridge-to-balance">
            <Trans>Balance</Trans>:{' '}
            {form.isConnected && !form.recipient ? formatBalance(form.destinationBalance) : NO_VALUE}
          </Text>
        </div>
        <div className="flex items-center justify-between gap-3">
          <output
            aria-label={t`Amount received`}
            data-testid="bridge-to-amount"
            className={cn(amountClassName, 'block overflow-hidden whitespace-nowrap')}
          >
            <RollingValue value={form.value === '' ? '0.00' : form.value} speed="stat" />
          </output>
          <span className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setRecipientOpen(true)}
              aria-label={t`Send to a different wallet`}
              data-testid="bridge-recipient-button"
              className={cn(
                buttonVariants({ variant: 'mini', size: 'mini' }),
                form.recipient ? 'h-7 text-xs leading-[14px]' : 'size-7 justify-center p-0'
              )}
            >
              {form.recipient ? formatAddress(form.recipient, 5, 3) : <Wallet className="size-3" />}
            </button>
            <TokenBadge symbol="USDS" />
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={form.flip}
        disabled={form.isSourceStatic}
        aria-label={t`Flip bridge direction`}
        data-testid="bridge-flip"
        className="bg-flipSurface border-flipRing text-textSecondary hover:text-text absolute top-1/2 left-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 transition-colors disabled:pointer-events-none disabled:opacity-50"
      >
        <ChevronDown width={16} height={16} />
      </button>

      <RecipientAddressModal
        open={recipientOpen}
        onOpenChange={setRecipientOpen}
        recipient={form.recipient}
        family={destinationFamily}
        onSave={form.setRecipient}
      />
    </div>
  );
}
