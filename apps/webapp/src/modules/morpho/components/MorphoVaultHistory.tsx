import { useMemo } from 'react';
import { formatBigInt, useFormatDates } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { absBigInt } from '../../utils/math';
import { SavingsSupply, ArrowDown } from '@/modules/icons';
import { HistoryTable } from '@/modules/ui/components/historyTable/HistoryTable';
import { useMorphoVaultHistory, TransactionTypeEnum, getTokenDecimals } from '@jetstreamgg/sky-hooks';
import { useChainId } from 'wagmi';

type MorphoVaultHistoryProps = {
  vaultAddress: `0x${string}`;
};

export function MorphoVaultHistory({ vaultAddress }: MorphoVaultHistoryProps) {
  const { data: vaultHistory, isLoading, error } = useMorphoVaultHistory({ vaultAddress });

  const chainId = useChainId();
  const { i18n } = useLingui();

  const memoizedDates = useMemo(() => vaultHistory?.map(h => h.blockTimestamp), [vaultHistory]);
  const formattedDates = useFormatDates(memoizedDates, i18n.locale, 'MMM d, yyyy, h:mm a');

  const history = vaultHistory?.map((h, index) => ({
    id: h.transactionHash,
    type: h.type === TransactionTypeEnum.SUPPLY ? t`Supply` : t`Withdrawal`,
    highlightText: h.type === TransactionTypeEnum.SUPPLY,
    textLeft: `${formatBigInt(absBigInt(h.assets), { compact: true, unit: getTokenDecimals(h.token, chainId) })} ${h.token.symbol}`,
    iconLeft:
      h.type === TransactionTypeEnum.SUPPLY ? (
        <SavingsSupply width={14} height={13} className="mr-[17px] flex-shrink-0" />
      ) : (
        <ArrowDown width={10} height={14} className="mr-[19px] flex-shrink-0 fill-white" />
      ),
    formattedDate: formattedDates.length > index ? formattedDates[index] : '',
    rawDate: h.blockTimestamp,
    transactionHash: h.transactionHash
  }));

  return (
    <HistoryTable
      dataTestId="morpho-vault-history"
      history={history}
      error={error}
      isLoading={isLoading}
      transactionHeader={t`Amount`}
      typeColumn
    />
  );
}
