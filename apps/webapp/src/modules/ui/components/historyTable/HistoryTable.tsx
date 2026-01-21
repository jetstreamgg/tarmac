import { useMemo, useState } from 'react';
import { useConnection, useChainId } from 'wagmi';
import { t } from '@lingui/core/macro';
import { Table, TableBody } from '@/components/ui/table';
import { CustomPagination } from '../CustomPagination';
import { LoadingErrorWrapper } from '../LoadingErrorWrapper';
import { HistoryTableProps, SortDirection } from './types';
import { HistoryTableHeader } from './HistoryTableHeader';
import { LoadingHistoryTable } from './LoadingHistoryTable';
import { ErrorHistoryTable } from './ErrorHistoryTable';
import { HistoryRow } from './HistoryRow';

function HistoryTableUiComponents({
  history,
  error,
  itemsPerPage = 5,
  errorText,
  noWalletText,
  noTransactionsText,
  isLoading,
  transactionHeader,
  typeColumn = false,
  typeHeader,
  statusColumn = false,
  dataTestId
}: HistoryTableProps) {
  const { address } = useConnection();
  const chainId = useChainId();
  const [sortDirection, setSortDirection] = useState<SortDirection>(SortDirection.desc);
  const [startIndex, setStartIndex] = useState(0);

  const sortedHistory = useMemo(
    () =>
      history
        ? [...history].sort((a, b) => {
            if (a.rawDate > b.rawDate) {
              return sortDirection === SortDirection.asc ? 1 : -1;
            }
            if (a.rawDate < b.rawDate) {
              return sortDirection === SortDirection.asc ? -1 : 1;
            }
            return 0;
          })
        : [],
    [history, sortDirection]
  );

  const rowsToShow = useMemo(
    () => sortedHistory.slice(startIndex, startIndex + itemsPerPage),
    [sortedHistory, startIndex]
  );

  const toggleSortDirection = () => {
    setSortDirection(prevValue => (prevValue === SortDirection.asc ? SortDirection.desc : SortDirection.asc));
  };

  const onPageChange = (page: number) => {
    setStartIndex((page - 1) * itemsPerPage);
  };

  const shouldShowError = !isLoading && (!address || (address && !rowsToShow.length));
  const historyTableError = shouldShowError
    ? new Error(
        error
          ? errorText
          : !address
            ? noWalletText
            : address && !rowsToShow.length
              ? noTransactionsText
              : undefined
      )
    : null;
  const headerProps = {
    transactionHeader,
    typeColumn,
    typeHeader,
    statusColumn,
    toggleSortDirection,
    sortDirection,
    chainId
  };

  return (
    <div className="w-full" data-testid={dataTestId}>
      <LoadingErrorWrapper
        isLoading={isLoading}
        loadingComponent={<LoadingHistoryTable {...headerProps} />}
        error={historyTableError}
        errorComponent={<ErrorHistoryTable error={historyTableError} />}
      >
        <Table key="table-loading">
          <HistoryTableHeader {...headerProps} />
          <TableBody>
            {rowsToShow.map((row, index) => (
              <HistoryRow
                key={row.id}
                row={row}
                chainId={chainId}
                index={index}
                typeColumn={typeColumn}
                statusColumn={statusColumn}
              />
            ))}
          </TableBody>
        </Table>
        {history && history.length > itemsPerPage && (
          <CustomPagination
            dataLength={history.length}
            onPageChange={onPageChange}
            itemsPerPage={itemsPerPage}
          />
        )}
      </LoadingErrorWrapper>
    </div>
  );
}

export function HistoryTable(props: Partial<HistoryTableProps>) {
  const errorText = props.errorText || t`There was an error fetching this data`;
  const noWalletText = props.noWalletText || t`Please connect your wallet to view your history`;
  const noTransactionsText = props.noTransactionsText || t`No transactions found`;
  const transactionHeader = props.transactionHeader || t`Transactions`;
  const typeHeader = props.typeHeader || t`Type`;

  return (
    <HistoryTableUiComponents
      {...props}
      isLoading={props.isLoading || false}
      errorText={errorText}
      noWalletText={noWalletText}
      noTransactionsText={noTransactionsText}
      transactionHeader={transactionHeader}
      typeHeader={typeHeader}
      statusColumn={props.statusColumn || false}
    />
  );
}
