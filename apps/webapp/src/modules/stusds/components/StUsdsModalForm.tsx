import { useId, useMemo } from 'react';
import { useChainId, useChains } from 'wagmi';
import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { StUsdsProviderType, TOKENS, stUsdsAddress } from '@/hooks';
import { withdrawalWording } from '@/components/product/withdrawalAvailability';
import { BundleSavingsPromo } from '@/modules/ui/components/BundleSavingsPromo';
import { useBundleFeeState } from '@/modules/ui/components/NetworkFeeValue';
import { useNetworkFee } from '@/hooks';
import { formatBigInt, formatDecimalPercentage, formatNumber, projectAnnualEarnings } from '@/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Text } from '@/modules/layout/components/Typography';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { ModalAmountField } from '@/components/product/ModalAmountField';
import { ModalSummaryGrid } from '@/components/product/ModalSummaryGrid';
import { toGridCells } from '@/components/product/ModalGridCells';
import { TokenSelectorPill } from '@/components/product/TokenSelectorPill';
import { useModalEntryBody } from '@/modules/ui/hooks/useModalEntryBody';
import type { TransactionAnalytics } from '@/modules/ui/context/transactionContract';
import { signedAmount } from '@/modules/analytics/constants';
import { useStUsdsLaunch, type StUsdsLaunchFlow } from '../hooks/useStUsdsLaunch';
import { useStUsdsTransactionForm, type StUsdsModalPreset } from '../hooks/useStUsdsTransactionForm';
import { stUsdsPrepareErrorMessage } from '../lib/prepareErrorMessage';
import { PRICE_IMPACT_HIGH_THRESHOLD_BPS, PRICE_IMPACT_WARNING_THRESHOLD_BPS } from '../lib/providerNotice';
import { StUsdsProviderNotice } from './StUsdsProviderNotice';
import { buildStUsdsEntryRows, buildStUsdsReviewRows } from './stUsdsModalRows';

export type { StUsdsModalPreset } from '../hooks/useStUsdsTransactionForm';

const NO_VALUE = '–';
const DECIMALS = 18;

// Decision-12 standard: amounts pin two decimals (hero + grid + balance line).
const formatUsds = (units: bigint) =>
  formatNumber(parseFloat(formatUnits(units, DECIMALS)), { minDecimals: 2, maxDecimals: 2 });

/**
 * Editable body for the stUSDS "Supply / Withdraw" modals, mounted as the
 * shared modal's entry screen — restyled onto the vault-family template
 * (no dedicated comps; grid shapes per `stUsdsModalRows.ts`): the DS amount
 * field (label + 24px icon + Heading-3 input, balance + 25/50/100% chips +
 * static USDS chip), the two-column entry grid, and a review stage whose
 * breakdown pairs the from→to hero with the review grid. The provider-routing
 * surfaces stay: the route notice (reason/warning states), the ≥2%
 * price-impact acknowledgement, and the one-time expert-risk acknowledgement
 * on supply — both acknowledgements live on the entry below the grid and gate
 * the Review CTA, logic and copy untouched (restyle only).
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
  const chainId = useChainId();
  const chains = useChains();
  const { i18n } = useLingui();

  const form = useStUsdsTransactionForm({ flow, preset });
  const {
    isConnected,
    isSupply,
    decimals,
    value,
    amount,
    available,
    isZero,
    insufficient,
    blocked,
    amountReady,
    rate,
    position,
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
    setPercentAmount
  } = form;

  const { execute, steps, prepared, error, calls, isBatch } = useStUsdsLaunch(engineParams);
  // Read-only: the row shows a dash until this resolves, and the confirm button never
  // waits on it.
  const { data: networkFee, error: networkFeeError } = useNetworkFee({
    calls,
    shouldUseBatch: isBatch,
    enabled: amountReady
  });

  const bundleState = useBundleFeeState(calls.length, networkFee, !!networkFeeError);
  // Scalar deps, not the objects: `useBundleFeeState` returns a fresh object
  // every render, so depending on its identity would give the review breakdown a
  // new identity every render — and the live push that carries it would re-enter
  // the provider on each of its re-renders (the update loop the modal forms guard
  // against). Same field-by-field list the convert launch hook keeps.
  const feeCell = useMemo(
    () => ({ fee: networkFee, state: bundleState }),
    [
      networkFee?.formatted,
      networkFee?.batchSaving,
      bundleState.ready,
      bundleState.settled,
      bundleState.canBundle,
      bundleState.promoVisible
    ]
  );

  const disabled =
    !amountReady ||
    !prepared ||
    providerSelection.isLoading ||
    (needsImpactAcknowledgement && !impactAccepted) ||
    (needsRiskAcknowledgement && !riskAccepted);

  const impactCheckboxId = useId();
  const riskCheckboxId = useId();

  const networkName = chains.find(c => c.id === chainId)?.name ?? 'Ethereum';
  const rateDisplay = rate !== undefined ? formatDecimalPercentage(rate) : NO_VALUE;
  const projectEarnings = (units: bigint) =>
    rate !== undefined
      ? formatNumber(projectAnnualEarnings(parseFloat(formatUnits(units, DECIMALS)), rate), {
          minDecimals: 2,
          maxDecimals: 2
        })
      : NO_VALUE;

  // Position after the action, clamped at zero for over-withdrawals (the
  // insufficient gate blocks submission anyway).
  const positionAfter = isSupply ? position + amount : position > amount ? position - amount : 0n;

  const rows = buildStUsdsEntryRows({
    rate: rateDisplay,
    network: networkName,
    supplyBefore: formatUsds(position),
    supplyAfter: formatUsds(positionAfter),
    earningsBefore: projectEarnings(position),
    earningsAfter: projectEarnings(positionAfter),
    hasAmount: !isZero,
    networkFee: networkFee?.formatted ?? NO_VALUE
  });

  // Review breakdown: the from→to hero the wallet screen also draws, over the
  // review grid. Supply's receive cell is the quoted stUSDS out; withdraw
  // receives the entered USDS back. Scalar deps keep the memo stable.
  const quote = providerSelection.selectedQuote;
  const amountDisplay = formatUsds(amount);
  const receiveDisplay = isSupply
    ? quote
      ? formatBigInt(quote.outputAmount, { unit: DECIMALS, minDecimals: 2, maxDecimals: 2 })
      : NO_VALUE
    : amountDisplay;
  const earningsAfterDisplay = projectEarnings(positionAfter);
  const isCurveRoute = providerSelection.selectedProvider === StUsdsProviderType.CURVE;
  const impactPercent = priceImpactBps !== undefined ? Math.floor(priceImpactBps / 100) : 0;
  // A checked acknowledgement lapses if the impact floors above the accepted
  // percent while the user sits on review (the checkbox lives on the entry
  // screen) — this line explains the disabled confirm in place.
  const impactLapsed = needsImpactAcknowledgement && !impactAccepted;
  const transactionContent = useMemo(
    () => (
      <div className="flex flex-col gap-8 sm:gap-12" data-testid={`stusds-modal-${flow}-review`}>
        {transactionScreenContent}
        <div className="flex flex-col gap-4">
          <ModalSummaryGrid
            rows={toGridCells(
              buildStUsdsReviewRows(flow, {
                amount: amountDisplay,
                receive: receiveDisplay,
                estEarnings: earningsAfterDisplay,
                rate: rateDisplay,
                route: isCurveRoute ? t`Curve` : t`Native`,
                routeDetail: isCurveRoute ? t`Curve pool` : t`stUSDS module`,
                withdrawal: i18n._(withdrawalWording('stusds', flow)),
                network: networkName,
                networkFee: networkFee?.formatted ?? NO_VALUE
              }),
              'stusds-modal-row',
              feeCell
            )}
            dividerClassName="h-6"
          />
          {impactLapsed && (
            <Text
              className="text-fgSecondary text-xs leading-[18px]"
              data-testid="stusds-modal-review-impact-lapsed"
            >
              <Trans>
                The price impact has risen and now exceeds {impactPercent}%. Go back to accept the new price
                impact before confirming.
              </Trans>
            </Text>
          )}
        </div>
      </div>
    ),
    [
      flow,
      transactionScreenContent,
      amountDisplay,
      receiveDisplay,
      earningsAfterDisplay,
      rateDisplay,
      isCurveRoute,
      networkName,
      feeCell,
      networkFee,
      impactLapsed,
      impactPercent
    ]
  );

  // Legacy StUSDSWidget payload shape (APP-444 B5): widget_name 'expert',
  // assetSymbol hardcoded USDS (both directions move USDS), no assetAddress.
  const analytics = useMemo<TransactionAnalytics>(
    () => ({
      widgetName: 'expert',
      flow,
      action: flow,
      data: {
        module: 'expert',
        product: 'stUSDS',
        productAddress: stUsdsAddress[chainId as keyof typeof stUsdsAddress],
        assetSymbol: 'USDS',
        isBatchTx: isBatch,
        provider: isCurveRoute ? 'curve' : 'native',
        amount: signedAmount(parseFloat(formatUnits(amount, DECIMALS)), flow)
      }
    }),
    [flow, chainId, isBatch, isCurveRoute, amount]
  );

  // Stable confirm over a live `execute` ref + the `updateModalContent` push that
  // keeps the shared modal's confirm gating / review breakdown / step labels /
  // wallet summary / toast titles in sync, and the entry-slot portal.
  const renderInSlot = useModalEntryBody({
    sessionId,
    execute,
    confirmDisabled: disabled,
    transactionContent,
    transactionScreenContent,
    steps,
    toast,
    analytics
  });

  const prepareErrorMessage = useMemo(() => stUsdsPrepareErrorMessage(error?.message), [error]);

  const impactColor =
    priceImpactBps !== undefined && priceImpactBps > PRICE_IMPACT_HIGH_THRESHOLD_BPS
      ? 'text-error'
      : priceImpactBps !== undefined && priceImpactBps > PRICE_IMPACT_WARNING_THRESHOLD_BPS
        ? 'text-statusWarning'
        : 'text-fgSecondary';

  const amountError = insufficient ? (
    <Text className="text-error text-sm" data-testid="stusds-modal-amount-error">
      {isSupply ? <Trans>Insufficient balance</Trans> : <Trans>Amount exceeds your position</Trans>}
    </Text>
  ) : blocked && !providerSelection.allProvidersBlocked ? (
    <Text className="text-error text-sm" data-testid="stusds-modal-capacity-error">
      <Trans>Amount exceeds the module&apos;s remaining supply capacity</Trans>
    </Text>
  ) : undefined;

  const body = (
    <div className="flex flex-col gap-8 sm:gap-12" data-testid={`stusds-modal-${flow}-form`}>
      <ModalAmountField
        label={<Trans>Amount</Trans>}
        tokenSymbol="USDS"
        value={value}
        decimals={decimals}
        onInput={onInput}
        disabled={!isConnected}
        balance={
          <>
            {isSupply ? <Trans>Balance</Trans> : <Trans>Withdrawable</Trans>}:{' '}
            {isConnected ? formatUsds(available) : NO_VALUE}
          </>
        }
        onPercent={setPercentAmount}
        selector={
          // stUSDS moves exactly one asset — the pill collapses to its static chip.
          <TokenSelectorPill tokens={[TOKENS.usds]} selected={TOKENS.usds} testId="stusds-modal-asset" />
        }
        error={amountError}
        inputAriaLabel={isSupply ? t`Supply amount` : t`Withdraw amount`}
        inputTestId="stusds-modal-amount-input"
        maxTestId="stusds-modal-amount-max"
      />

      <div className="flex flex-col gap-4">
        <StUsdsProviderNotice providerSelection={providerSelection} flow={flow} />

        <ModalSummaryGrid rows={toGridCells(rows, 'stusds-modal-row', feeCell)} dividerClassName="h-8" />

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
              <Text className={`font-graphik text-xs leading-[18px] ${impactColor}`}>
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
              <Text className="font-graphik text-fgSecondary text-xs leading-[18px]">
                <Trans>
                  I understand stUSDS is an expert module that may function differently than other modules,
                  and I have reviewed the associated{' '}
                  <ExternalLink
                    href="https://docs.sky.money/user-risks"
                    showIcon={false}
                    className="text-fgBrand"
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
    </div>
  );

  return renderInSlot(body);
}
