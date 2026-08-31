import { useChainId } from 'wagmi';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { ChevronDown } from 'lucide-react';
import { useProductNetworks } from '@/hooks';
import { getChainIcon } from '@/utils';
import { Intent } from '@/lib/enums';
import { Text } from '@/modules/layout/components/Typography';
import { ChainModal } from '@/modules/ui/components/ChainModal';
import { ConvertAmountInput } from './ConvertAmountInput';
import type { useConvertForm } from '../hooks/useConvertForm';
import { useNetworkName } from '@/modules/ui/hooks/useNetworkName';

export type ConvertFormModel = ReturnType<typeof useConvertForm>;

/**
 * The centered swap card (Figma 486:31198): Network row → From input → flip
 * button → To input. Pure presentation over the `useConvertForm` model — the
 * Review button lives outside the card on the page, matching the Figma stack.
 *
 * Glass construction per the dark design: the card itself has no background or
 * border — it is three translucent `glassSurface` panels separated by 2px gaps
 * that pass through to the page background, clipped to the card radius. The
 * flip control sits over the From/To gap with a `flipRing` ring (the page-base
 * colour), which is what visually "cuts" the gap around the circle.
 */
export function ConvertCard({ form }: { form: ConvertFormModel }) {
  const chainId = useChainId();

  // The networks Convert is live on among the configured chains (includes the
  // Tenderly fork in dev mode) — scopes the network selector like the product
  // pages do. PSM addresses exist on every supported chain, so no address map.
  const networks = useProductNetworks(Intent.CONVERT_INTENT);
  const networkName = useNetworkName(chainId);

  return (
    // Phone tier (comp 1295:25285, M6.9): 16px radius + 16px row padding; the
    // desktop 28px/32px geometry returns at md.
    <div
      className="flex w-full flex-col gap-[2px] overflow-clip rounded-2xl md:rounded-[28px]"
      data-testid="convert-card"
    >
      <ChainModal variant="wrapper" chainIds={networks} dataTestId="convert-network">
        <span className="bg-glassSurface flex w-full items-center justify-between gap-2 p-4 backdrop-blur-[20px] md:px-8 md:py-6">
          <span className="flex items-center gap-3">
            <Text className="text-textSecondary text-sm">
              <Trans>Network</Trans>
            </Text>
            <span className="bg-glassBadge flex items-center gap-1 rounded-full py-1 pr-2 pl-1">
              {getChainIcon(chainId, 'h-4 w-4')}
              <Text className="text-text font-circle text-xs font-medium">{networkName}</Text>
            </span>
          </span>
          <ChevronDown width={16} height={16} className="text-textSecondary" />
        </span>
      </ChainModal>

      <div className="relative flex flex-col gap-[2px]">
        <ConvertAmountInput
          side="from"
          symbol={form.originSymbol}
          onTokenChange={symbol => form.selectToken('from', symbol)}
          value={form.value}
          onInput={form.onInput}
          balance={form.originBalance}
          decimals={form.originDecimals}
          onPercentClick={form.setPercent}
          isConnected={form.isConnected}
        />
        <ConvertAmountInput
          side="to"
          symbol={form.targetSymbol}
          onTokenChange={symbol => form.selectToken('to', symbol)}
          value={form.targetValue}
          balance={form.targetBalance}
          decimals={form.targetDecimals}
          isConnected={form.isConnected}
        />
        <button
          type="button"
          onClick={form.flip}
          aria-label={t`Flip conversion direction`}
          data-testid="convert-flip"
          className="bg-flipSurface border-flipRing text-textSecondary hover:text-text absolute top-1/2 left-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 transition-colors"
        >
          <ChevronDown width={16} height={16} />
        </button>
      </div>
    </div>
  );
}
