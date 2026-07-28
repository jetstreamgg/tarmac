import { useId, useMemo, type ReactNode } from 'react';
import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { NetworkFeeLabel } from '@/modules/ui/components/NetworkFeeLabel';
import { BundleSavingsPromo } from '@/modules/ui/components/BundleSavingsPromo';
import { NetworkFeeValue, useBundleFeeState } from '@/modules/ui/components/NetworkFeeValue';
import { useNetworkFee } from '@/hooks';
import { formatBigInt, formatDecimalPercentage, formatNumber, projectAnnualEarnings } from '@/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Text } from '@/modules/layout/components/Typography';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { useModalEntryBody } from '@/modules/ui/hooks/useModalEntryBody';
import { useStUsdsLaunch, type StUsdsLaunchFlow } from '../hooks/useStUsdsLaunch';
import { useStUsdsTransactionForm, type StUsdsModalPreset } from '../hooks/useStUsdsTransactionForm';
import { stUsdsPrepareErrorMessage } from '../lib/prepareErrorMessage';
import { PRICE_IMPACT_HIGH_THRESHOLD_BPS, PRICE_IMPACT_WARNING_THRESHOLD_BPS } from '../lib/providerNotice';
import { StUsdsProviderNotice } from './StUsdsProviderNotice';

export type { StUsdsModalPreset } from '../hooks/useStUsdsTransactionForm';

const NO_VALUE = '–';

type ModalRow = { label: ReactNode; value: ReactNode };

function Row({ label, value }: ModalRow) {
  return (
    <div className="flex items-center justify-between">
      <Text className="text-textSecondary text-sm">{label}</Text>
      <Text className="text-text text-sm font-medium">{value}</Text>
    </div>
  );
}

/**
 * Editable body for the stUSDS "Supply / Withdraw" modals, mounted as the
 * shared modal's entry screen — the stUSDS analogue of `SavingsModalForm` /
 * `VaultModalForm`, plus the three surfaces the provider routing needs:
 * the route notice (native vs Curve + reason), the ≥2% price-impact
 * acknowledgement, and the one-time expert-risk acknowledgement on supply.
 *
 * Amounts are USDS-denominated in both flows (the withdraw input is the USDS
 * you want back; the Curve quote derives the stUSDS input). Analytics-free by
 * design, following the savings-modal precedent.
 */
export function StUsdsModalForm({
  sessionId,
  flow,
  preset
}: {
  sessionId: string;
  flow: StUsdsLaunchFlow;
  preset?: StUsdsModalPreset;
}) {
  const form = useStUsdsTransactionForm({ flow, preset });
  const {
    isConnected,
    isSupply,
    decimals,
    value,
    amount,
    available,
    insufficient,
    blocked,
    amountReady,
    rate,
    engineParams,
    providerSelection,
    priceImpactBps,
    needsImpactAcknowledgement,
    impactAccepted,
    setImpactAccepted,
    needsRiskAcknowledgement,
    riskAccepted,
    acceptRisk,
    toast,
    transactionScreenContent,
    onInput,
    setMaxAmount
  } = form;

  const { execute, steps, prepared, error, calls, isBatch } = useStUsdsLaunch(engineParams);
  // Read-only: the row shows a dash until this resolves, and the confirm button never
  // waits on it.
  const { data: networkFee } = useNetworkFee({ calls, shouldUseBatch: isBatch, enabled: amountReady });

  const bundleState = useBundleFeeState(calls.length, networkFee);

  const disabled =
    !amountReady ||
    !prepared ||
    providerSelection.isLoading ||
    (needsImpactAcknowledgement && !impactAccepted) ||
    (needsRiskAcknowledgement && !riskAccepted);

  // Stable confirm over a live `execute` ref + the `updateModalContent` push that
  // keeps the shared modal's confirm gating / step labels / wallet summary / toast
  // titles in sync, and the entry-slot portal. Returns the slot renderer.
  const renderInSlot = useModalEntryBody({
    sessionId,
    execute,
    confirmDisabled: disabled,
    steps,
    transactionScreenContent,
    toast
  });

  const impactCheckboxId = useId();
  const riskCheckboxId = useId();

  const amountUsd = parseFloat(formatUnits(amount, decimals));
  const quote = providerSelection.selectedQuote;
  // Supply receives the quoted stUSDS; a withdraw receives the entered USDS
  // (the quote's job there is deriving the stUSDS input).
  const receiveValue = isSupply
    ? quote
      ? `${formatBigInt(quote.outputAmount, { unit: decimals, maxDecimals: 2 })} stUSDS`
      : NO_VALUE
    : `${formatNumber(amountUsd, { maxDecimals: 2 })} USDS`;

  const rows: ModalRow[] = isSupply
    ? [
        { label: <Trans>You&apos;ll receive</Trans>, value: receiveValue },
        { label: <Trans>Rate</Trans>, value: rate !== undefined ? formatDecimalPercentage(rate) : NO_VALUE },
        {
          label: <Trans>Est. earnings (1Y)</Trans>,
          value: `$${formatNumber(projectAnnualEarnings(amountUsd, rate), { maxDecimals: 2 })}`
        },
        { label: <Trans>Product</Trans>, value: 'stUSDS' },
        {
          label: <NetworkFeeLabel />,
          value: <NetworkFeeValue fee={networkFee} state={bundleState} />
        }
      ]
    : [
        { label: <Trans>You&apos;ll receive</Trans>, value: receiveValue },
        { label: <Trans>Product</Trans>, value: 'stUSDS' },
        {
          label: <NetworkFeeLabel />,
          value: <NetworkFeeValue fee={networkFee} state={bundleState} />
        }
      ];

  const prepareErrorMessage = useMemo(() => stUsdsPrepareErrorMessage(error?.message), [error]);

  const impactPercent = priceImpactBps !== undefined ? Math.floor(priceImpactBps / 100) : 0;
  const impactColor =
    priceImpactBps !== undefined && priceImpactBps > PRICE_IMPACT_HIGH_THRESHOLD_BPS
      ? 'text-error'
      : priceImpactBps !== undefined && priceImpactBps > PRICE_IMPACT_WARNING_THRESHOLD_BPS
        ? 'text-amber-400'
        : 'text-text';

  const body = (
    <div className="flex flex-col gap-3" data-testid={`stusds-modal-${flow}-form`}>
      <div className="bg-panel flex items-center justify-between gap-2 rounded-xl p-3">
        <input
          inputMode="decimal"
          placeholder="0"
          value={value}
          onChange={e => onInput(e.target.value)}
          disabled={!isConnected}
          aria-label={isSupply ? t`Supply amount` : t`Withdraw amount`}
          data-testid="stusds-modal-amount-input"
          className="text-text placeholder:text-textSecondary w-full min-w-0 bg-transparent text-2xl font-medium outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div className="text-text flex shrink-0 items-center gap-1.5" data-testid="stusds-modal-asset">
          <TokenIcon token={{ symbol: 'USDS' }} width={20} showChainIcon={false} className="h-5 w-5" />
          <Text className="font-medium">USDS</Text>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Text className="text-textSecondary text-sm">
          {isSupply ? <Trans>Balance</Trans> : <Trans>Withdrawable</Trans>}:{' '}
          {isConnected
            ? formatNumber(parseFloat(formatUnits(available, decimals)), { maxDecimals: 2 })
            : NO_VALUE}
        </Text>
        <button
          type="button"
          onClick={setMaxAmount}
          className="text-textEmphasis text-sm font-medium"
          data-testid="stusds-modal-amount-max"
        >
          <Trans>Max</Trans>
        </button>
      </div>

      {insufficient && (
        <Text className="text-error text-sm" data-testid="stusds-modal-amount-error">
          {isSupply ? <Trans>Insufficient balance</Trans> : <Trans>Amount exceeds your position</Trans>}
        </Text>
      )}
      {!insufficient && blocked && !providerSelection.allProvidersBlocked && (
        <Text className="text-error text-sm" data-testid="stusds-modal-capacity-error">
          <Trans>Amount exceeds the module&apos;s remaining supply capacity</Trans>
        </Text>
      )}

      <StUsdsProviderNotice providerSelection={providerSelection} flow={flow} />

      <div className="flex flex-col gap-3 pt-1">
        {rows.map((row, index) => (
          <Row key={index} label={row.label} value={row.value} />
        ))}
      </div>

      {bundleState.promoVisible && <BundleSavingsPromo saving={networkFee!.batchSaving!} />}

      {needsImpactAcknowledgement && (
        <div className="flex items-start gap-2 pt-1" data-testid="stusds-modal-impact-acknowledgement">
          <Checkbox
            id={impactCheckboxId}
            checked={impactAccepted}
            onCheckedChange={checked => setImpactAccepted(checked === true)}
            className="mt-0.5"
          />
          <label htmlFor={impactCheckboxId} className="cursor-pointer">
            <Text variant="small" className={impactColor}>
              <Trans>
                I understand the price impact exceeds {impactPercent}% and choose to proceed anyway
              </Trans>
            </Text>
          </label>
        </div>
      )}

      {needsRiskAcknowledgement && (
        <div className="flex items-start gap-2 pt-1" data-testid="stusds-modal-risk-acknowledgement">
          <Checkbox
            id={riskCheckboxId}
            checked={riskAccepted}
            onCheckedChange={checked => acceptRisk(checked === true)}
            className="mt-0.5"
          />
          <label htmlFor={riskCheckboxId} className="cursor-pointer">
            <Text variant="small" className="text-textSecondary">
              <Trans>
                I understand stUSDS is an expert module that may function differently than other modules, and
                I have reviewed the associated{' '}
                <ExternalLink
                  href="https://docs.sky.money/user-risks"
                  showIcon={false}
                  className="text-textEmphasis"
                >
                  User Risks
                </ExternalLink>
                .
              </Trans>
            </Text>
          </label>
        </div>
      )}

      {prepareErrorMessage && amountReady && (
        <Text className="text-error text-sm" data-testid="stusds-modal-error">
          {prepareErrorMessage}
        </Text>
      )}
    </div>
  );

  return renderInSlot(body);
}
