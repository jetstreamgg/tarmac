import { useMemo } from 'react';
import { useChainId, useChains } from 'wagmi';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { ChevronDown } from 'lucide-react';
import { productNetworks } from '@/hooks';
import { getChainIcon } from '@/utils';
import { Intent } from '@/lib/enums';
import { Text } from '@/modules/layout/components/Typography';
import { ChainModal } from '@/modules/ui/components/ChainModal';
import { ArrowDown } from '@/modules/icons';
import { ConvertAmountInput } from './ConvertAmountInput';
import type { useConvertForm } from '../hooks/useConvertForm';

export type ConvertFormModel = ReturnType<typeof useConvertForm>;

/**
 * The centered swap card (Figma 486:31193): Network row → From input → flip
 * button → To input. Pure presentation over the `useConvertForm` model — the
 * Review button lives outside the card on the page, matching the Figma stack.
 */
export function ConvertCard({ form }: { form: ConvertFormModel }) {
  const chainId = useChainId();
  const chains = useChains();

  // The networks Convert is live on among the configured chains (includes the
  // Tenderly fork in dev mode) — scopes the network selector like the product
  // pages do. PSM addresses exist on every supported chain, so no address map.
  const networks = useMemo(
    () =>
      productNetworks(
        Intent.CONVERT_INTENT,
        chains.map(chain => chain.id)
      ),
    [chains]
  );
  const networkName = chains.find(chain => chain.id === chainId)?.name ?? 'Ethereum';

  return (
    <div
      className="bg-container border-borderPrimary w-full rounded-3xl border backdrop-blur-[50px]"
      data-testid="convert-card"
    >
      <ChainModal variant="wrapper" chainIds={networks} dataTestId="convert-network">
        <span className="border-borderPrimary flex w-full items-center justify-between gap-2 border-b px-6 py-4">
          <span className="flex items-center gap-2">
            <Text className="text-textSecondary text-sm">
              <Trans>Network</Trans>
            </Text>
            <span className="flex items-center gap-1.5">
              {getChainIcon(chainId, 'h-4 w-4')}
              <Text className="text-text text-sm font-medium">{networkName}</Text>
            </span>
          </span>
          <ChevronDown width={14} height={14} className="text-textSecondary" />
        </span>
      </ChainModal>

      <div className="relative flex flex-col">
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
        <div className="border-borderPrimary relative border-t">
          <button
            type="button"
            onClick={form.flip}
            aria-label={t`Flip conversion direction`}
            data-testid="convert-flip"
            className="bg-panel border-borderPrimary text-textSecondary hover:text-text absolute left-1/2 top-0 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border transition-colors"
          >
            <ArrowDown width={16} height={16} />
          </button>
        </div>
        <ConvertAmountInput
          side="to"
          symbol={form.targetSymbol}
          onTokenChange={symbol => form.selectToken('to', symbol)}
          value={form.targetValue}
          balance={form.targetBalance}
          decimals={form.targetDecimals}
          isConnected={form.isConnected}
        />
      </div>
    </div>
  );
}
