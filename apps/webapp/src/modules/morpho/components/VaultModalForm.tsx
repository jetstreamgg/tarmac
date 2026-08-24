import { useMemo } from 'react';
import { useChainId } from 'wagmi';
import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { getVaultByAddress, type Token, type VaultProvider, useVaultMarketData } from '@/hooks';
import { withdrawalWording } from '@/components/product/withdrawalAvailability';
import { formatDecimalPercentage, formatNumber, projectAnnualEarnings } from '@/utils';
import { Text } from '@/modules/layout/components/Typography';
import { ModalAmountField } from '@/components/product/ModalAmountField';
import { ModalSummaryGrid } from '@/components/product/ModalSummaryGrid';
import { toGridCells } from '@/components/product/ModalGridCells';
import { TokenSelectorPill } from '@/components/product/TokenSelectorPill';
import { useModalEntryBody } from '@/modules/ui/hooks/useModalEntryBody';
import { enginePrepareErrorMessage } from '@/modules/ui/lib/enginePrepareErrorMessage';
import type { TransactionAnalytics } from '@/modules/ui/context/transactionContract';
import { signedAmount } from '@/modules/analytics/constants';
import { PopoverRateInfo } from '@/widgets/shared/components/ui/PopoverRateInfo';
import { useVaultLaunch, type VaultLaunchFlow } from '../hooks/useVaultLaunch';
import { useVaultTransactionForm, type VaultModalPreset } from '../hooks/useVaultTransactionForm';
import { buildVaultEntryRows, buildVaultReviewRows } from './vaultModalRows';
import { NO_VALUE } from '@/lib/constants';
import { useNetworkName } from '@/modules/ui/hooks/useNetworkName';
import { useModalFeeCell } from '@/modules/ui/hooks/useModalFeeCell';

export type { VaultModalPreset } from '../hooks/useVaultTransactionForm';

/**
 * Editable body for the vault "Supply to / Withdraw from {vault}" modals (Figma
 * 859:38105 / 859:38297 entries, 859:38553 / 859:38234 reviews), mounted as the
 * shared modal's entry screen — the vault analogue of `SavingsModalForm`. One
 * body, two flows.
 *
 * The form model (`useVaultTransactionForm`) owns the amount/Max state and the
 * ERC-4626 reads; this is the presentation: the DS amount field (label + 24px
 * asset icon + Heading-3 input, balance + 25/50/100% chips + asset chip) and
 * the two-column detail grid. The shared modal owns the confirm button and the
 * three-screen sequence (entry → review → wallet): this body keeps the gating +
 * review breakdown + step labels + wallet hero + toast titles live via
 * `updateModalContent` so it never remounts (input stays focused). Confirm on
 * the review fires the engine `execute` from `useVaultLaunch` — calldata is
 * unchanged.
 */
export function VaultModalForm({
  sessionId,
  flow,
  vaultAddress,
  assetToken,
  vaultName,
  provider = 'morpho',
  netRate,
  preset
}: {
  sessionId: string;
  flow: VaultLaunchFlow;
  vaultAddress: `0x${string}`;
  assetToken: Token;
  vaultName: string;
  provider?: VaultProvider;
  /** Net APY as a decimal fraction (e.g. 0.0445) for the rate + projected-earnings cells. */
  netRate?: number;
  preset?: VaultModalPreset;
}) {
  const chainId = useChainId();
  const { i18n } = useLingui();
  // Openable vaults come from the registry, so the lookup only misses on an
  // unsupported chain; the fallback keeps the provider's wording in that case.
  const riskProfile =
    getVaultByAddress(vaultAddress, chainId)?.riskProfile ??
    (provider === 'morpho' ? 'vault-flagship' : 'vault-tether-savings');

  const form = useVaultTransactionForm({ flow, vaultAddress, assetToken, provider, preset });
  const {
    isConnected,
    isSupply,
    decimals,
    value,
    amount,
    available,
    availableKnown,
    isZero,
    insufficient,
    amountReady,
    position,
    isLiquidityConstrained,
    isLiquidityDataUnavailable,
    engineParams,
    toast,
    transactionScreenContent,
    onInput,
    setPercentAmount
  } = form;

  const { execute, steps, prepared, error, calls, isBatch } = useVaultLaunch(engineParams);
  // Read-only: the row shows a dash until this resolves, and the confirm button never
  // waits on it.
  const feeCell = useModalFeeCell({ calls, shouldUseBatch: isBatch, enabled: amountReady });
  const disabled = !amountReady || !prepared;
  const errorMessage = enginePrepareErrorMessage(prepared, error);

  // The stars accent marks an incentive-boosted rate, mirroring the vault rate
  // popover (`MorphoRateBreakdownPopover`) — read from the same market data.
  const { data: marketData } = useVaultMarketData({ provider, vaultAddress });
  const boostedRate = (marketData?.rate?.rewards?.length ?? 0) > 0;

  const networkName = useNetworkName(chainId);
  const rate = netRate !== undefined ? formatDecimalPercentage(netRate) : NO_VALUE;

  const formatAsset = (units: bigint) =>
    formatNumber(parseFloat(formatUnits(units, decimals)), { maxDecimals: 2 });
  const projectEarnings = (units: bigint) =>
    netRate !== undefined
      ? formatNumber(projectAnnualEarnings(parseFloat(formatUnits(units, decimals)), netRate), {
          maxDecimals: 2
        })
      : NO_VALUE;

  // Position after the action, clamped at zero for over-withdrawals (the
  // insufficient gate blocks submission anyway).
  const positionAfter = isSupply ? position + amount : position > amount ? position - amount : 0n;

  // Liquidity copy is provider-specific: Spark/Tether vaults expose instant-withdrawal
  // liquidity, not a Morpho market (same override the widget's SupplyWithdraw applies).
  const liquidityTooltipOverride =
    provider === 'sky'
      ? { description: t`The amount of ${assetToken.symbol} currently available for instant withdrawal.` }
      : undefined;

  // With zero liquidity the notice alone carries the message — the inline error
  // would repeat it word for word.
  const zeroLiquidity = !isSupply && isLiquidityConstrained && available === 0n;

  // Withdraw-only notice, one of three states; wording mirrors the widget's
  // SupplyWithdraw. Error red only for the blocking state.
  const liquidityNotice = !isSupply
    ? zeroLiquidity
      ? {
          tone: 'text-error',
          testId: 'vault-modal-liquidity-zero-notice',
          text: <Trans>Withdrawals are temporarily unavailable due to liquidity constraints.</Trans>
        }
      : isLiquidityDataUnavailable
        ? {
            tone: 'text-text',
            testId: 'vault-modal-liquidity-unknown-notice',
            text: (
              <Trans>
                Liquidity data is temporarily unavailable. Withdrawals may be limited by available liquidity.
              </Trans>
            )
          }
        : isLiquidityConstrained
          ? {
              tone: 'text-text',
              testId: 'vault-modal-liquidity-partial-notice',
              text: <Trans>You cannot withdraw your full balance due to current liquidity limits.</Trans>
            }
          : undefined
    : undefined;

  const rows = buildVaultEntryRows({
    rate,
    boostedRate,
    network: networkName,
    assetSymbol: assetToken.symbol,
    supplyBefore: formatAsset(position),
    supplyAfter: formatAsset(positionAfter),
    earningsBefore: projectEarnings(position),
    earningsAfter: projectEarnings(positionAfter),
    hasAmount: !isZero,
    networkFee: feeCell.fee?.formatted ?? NO_VALUE
  });

  // Review breakdown (Figma 859:38553 / 859:38234): the amount hero the wallet
  // screen also draws, over the review grid. Scalar deps keep the memo stable
  // across unrelated renders (matches the savings form).
  const amountDisplay = formatAsset(amount);
  const earningsAfterDisplay = projectEarnings(positionAfter);
  const transactionContent = useMemo(
    () => (
      <div className="flex flex-col gap-8 sm:gap-12" data-testid={`vault-modal-${flow}-review`}>
        {transactionScreenContent}
        <ModalSummaryGrid
          rows={toGridCells(
            buildVaultReviewRows(flow, {
              amount: amountDisplay,
              assetSymbol: assetToken.symbol,
              estEarnings: earningsAfterDisplay,
              product: vaultName,
              rate,
              boostedRate,
              withdrawal: i18n._(withdrawalWording(riskProfile, flow)),
              network: networkName,
              networkFee: feeCell.fee?.formatted ?? NO_VALUE
            }),
            'vault-modal-row',
            feeCell
          )}
          dividerClassName="h-6"
        />
      </div>
    ),
    [
      flow,
      transactionScreenContent,
      amountDisplay,
      assetToken.symbol,
      earningsAfterDisplay,
      vaultName,
      rate,
      boostedRate,
      networkName,
      feeCell
    ]
  );

  // Legacy VaultWidget payload shape (APP-444 B7): withdraw amounts negative.
  // `module` follows the provider — 'morpho' for every legacy vault (parity),
  // 'sky' for the redesign-only Sky provider vaults.
  const analytics = useMemo<TransactionAnalytics>(
    () => ({
      widgetName: 'vaults',
      flow,
      action: flow,
      data: {
        module: provider,
        product: vaultName,
        productAddress: vaultAddress,
        assetAddress: assetToken.address[chainId],
        assetSymbol: assetToken.symbol,
        isBatchTx: isBatch,
        amount: signedAmount(parseFloat(formatUnits(amount, decimals)), flow)
      }
    }),
    [flow, provider, vaultName, vaultAddress, assetToken, chainId, isBatch, amount, decimals]
  );

  // Stable confirm over a live `execute` ref + the `updateModalContent` push that
  // keeps the shared modal's confirm gating / review breakdown / step labels /
  // wallet summary / toast titles in sync, and the entry-slot portal.
  const renderInSlot = useModalEntryBody({
    sessionId,
    execute,
    confirmDisabled: disabled,
    errorMessage,
    transactionContent,
    transactionScreenContent,
    steps,
    toast,
    analytics
  });

  const body = (
    <div className="flex flex-col gap-8 sm:gap-12" data-testid={`vault-modal-${flow}-form`}>
      <div className="flex flex-col gap-2">
        <ModalAmountField
          label={<Trans>Amount</Trans>}
          tokenSymbol={assetToken.symbol}
          value={value}
          decimals={decimals}
          onInput={onInput}
          disabled={!isConnected}
          balance={
            // "Available", not "Balance", when liquidity caps the figure below the position.
            <>
              {!isSupply && isLiquidityConstrained ? <Trans>Available</Trans> : <Trans>Balance</Trans>}:{' '}
              {isConnected && availableKnown ? formatAsset(available) : NO_VALUE}
            </>
          }
          onPercent={setPercentAmount}
          selector={
            // Figma 859:38126 draws the DS dropdown pill, but a vault has exactly
            // one underlying asset — the pill collapses to its static chip.
            <TokenSelectorPill tokens={[assetToken]} selected={assetToken} testId="vault-modal-asset" />
          }
          error={
            insufficient && !zeroLiquidity ? (
              <Text className="text-statusError text-sm" data-testid="vault-modal-amount-error">
                {isSupply ? (
                  <Trans>Insufficient balance</Trans>
                ) : isLiquidityConstrained ? (
                  // Full precision: a rounded-up cap would name a maximum that itself
                  // fails the gate.
                  <Trans>
                    Insufficient liquidity. Maximum available is {formatUnits(available, decimals)}{' '}
                    {assetToken.symbol}.
                  </Trans>
                ) : (
                  <Trans>Amount exceeds your position</Trans>
                )}
              </Text>
            ) : undefined
          }
          inputAriaLabel={isSupply ? t`Supply amount` : t`Withdraw amount`}
          inputTestId="vault-modal-amount-input"
          maxTestId="vault-modal-amount-max"
        />
        {liquidityNotice && (
          <div
            className={`ml-3 flex items-start ${liquidityNotice.tone}`}
            data-testid={liquidityNotice.testId}
          >
            <PopoverRateInfo
              type="morphoLiquidity"
              tooltipOverride={liquidityTooltipOverride}
              iconClassName={`mt-1 shrink-0 ${liquidityNotice.tone}`}
            />
            <Text variant="small" className="ml-2">
              {liquidityNotice.text}
            </Text>
          </div>
        )}
      </div>

      <ModalSummaryGrid rows={toGridCells(rows, 'vault-modal-row', feeCell)} dividerClassName="h-8" />
    </div>
  );

  return renderInSlot(body);
}
