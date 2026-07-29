import { useMemo } from 'react';
import { useChainId, useChains } from 'wagmi';
import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { type Token, type VaultProvider, useVaultMarketData } from '@/hooks';
import { formatDecimalPercentage, formatNumber, projectAnnualEarnings } from '@/utils';
import { Text } from '@/modules/layout/components/Typography';
import { ModalAmountField } from '@/components/product/ModalAmountField';
import { ModalSummaryGrid } from '@/components/product/ModalSummaryGrid';
import { toGridCells } from '@/components/product/ModalGridCells';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { useModalEntryBody } from '@/modules/ui/hooks/useModalEntryBody';
import { useVaultLaunch, type VaultLaunchFlow } from '../hooks/useVaultLaunch';
import { useVaultTransactionForm, type VaultModalPreset } from '../hooks/useVaultTransactionForm';
import { buildVaultEntryRows, buildVaultReviewRows } from './vaultModalRows';

export type { VaultModalPreset } from '../hooks/useVaultTransactionForm';

const NO_VALUE = '–';

/**
 * The vault's single-asset chip beside the percent presets (Figma 859:38126
 * draws the DS Button / Dropdown pill here, but a vault has exactly one
 * underlying asset — no alternative to pick — so this renders the same pill
 * statically, without the chevron affordance).
 */
function AssetPill({ symbol }: { symbol: string }) {
  return (
    <span
      className="border-glassBorder flex h-7 shrink-0 items-center gap-1 rounded-full border px-1.5"
      data-testid="vault-modal-asset"
    >
      <TokenIcon token={{ symbol }} width={16} showChainIcon={false} className="size-4" />
      <span className="font-circle text-fgPrimary text-sm leading-4 font-medium tracking-[-0.28px]">
        {symbol}
      </span>
    </span>
  );
}

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
  const chains = useChains();

  const form = useVaultTransactionForm({ flow, vaultAddress, assetToken, provider, preset });
  const {
    isConnected,
    isSupply,
    decimals,
    value,
    amount,
    available,
    isZero,
    insufficient,
    amountReady,
    position,
    engineParams,
    toast,
    transactionScreenContent,
    onInput,
    setPercentAmount
  } = form;

  const { execute, steps, prepared } = useVaultLaunch(engineParams);
  const disabled = !amountReady || !prepared;

  // The stars accent marks an incentive-boosted rate, mirroring the vault rate
  // popover (`MorphoRateBreakdownPopover`) — read from the same market data.
  const { data: marketData } = useVaultMarketData({ provider, vaultAddress });
  const boostedRate = (marketData?.rate?.rewards?.length ?? 0) > 0;

  const networkName = chains.find(c => c.id === chainId)?.name ?? 'Ethereum';
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
    networkFee: NO_VALUE
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
              withdrawal: flow === 'supply' ? t`Anytime` : t`Instant`,
              network: networkName,
              networkFee: NO_VALUE
            }),
            'vault-modal-row'
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
      networkName
    ]
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
    toast
  });

  const body = (
    <div className="flex flex-col gap-8 sm:gap-12" data-testid={`vault-modal-${flow}-form`}>
      <ModalAmountField
        label={<Trans>Amount</Trans>}
        tokenSymbol={assetToken.symbol}
        value={value}
        onInput={onInput}
        disabled={!isConnected}
        balance={
          <>
            <Trans>Balance</Trans>: {isConnected ? formatAsset(available) : NO_VALUE}
          </>
        }
        onPercent={setPercentAmount}
        selector={<AssetPill symbol={assetToken.symbol} />}
        error={
          insufficient ? (
            <Text className="text-error text-sm" data-testid="vault-modal-amount-error">
              {isSupply ? <Trans>Insufficient balance</Trans> : <Trans>Amount exceeds your position</Trans>}
            </Text>
          ) : undefined
        }
        inputAriaLabel={isSupply ? t`Supply amount` : t`Withdraw amount`}
        inputTestId="vault-modal-amount-input"
        maxTestId="vault-modal-amount-max"
      />

      <ModalSummaryGrid rows={toGridCells(rows, 'vault-modal-row')} dividerClassName="h-8" />
    </div>
  );

  return renderInSlot(body);
}
