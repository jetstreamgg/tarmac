import { TableCell, TableRow } from '@/components/ui/table';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { Text } from '@/modules/layout/components/Typography';
import { ArrowRightLong } from '@/modules/icons';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { formatAddress, getCowExplorerLink, getEtherscanLink, getExplorerName } from '@jetstreamgg/sky-utils';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { CopyToClipboard } from '../CopyToClipboard';
import { HighlightColor, HistoryRow as HistoryRowType } from './types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { LoadingErrorWrapper } from '../LoadingErrorWrapper';
import { Fragment, useMemo } from 'react';
import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipPortal,
  TooltipTrigger
} from '@/components/ui/tooltip';

type HistoryRowProps = {
  row?: HistoryRowType;
  chainId: number;
  index: number;
  typeColumn?: boolean;
  statusColumn?: boolean;
  transactionArrow?: boolean;
  cowExplorerLink?: boolean;
};

const TableCellSkeleton = ({ className }: { className?: string }) => (
  <Skeleton className={cn('h-4 w-full', className)} />
);

const BaseRow = ({
  typeColumn,
  statusColumn,
  content
}: {
  content: React.ReactNode[];
  typeColumn?: boolean;
  statusColumn?: boolean;
}) => {
  return (
    <>
      <TableCell className="pr-2 lg:pr-4">
        <div className="flex items-center gap-2">{content[0]}</div>
      </TableCell>
      <TableCell className="flex items-center px-0 lg:px-4 xl:table-cell xl:max-w-10">{content[1]}</TableCell>
      <TableCell className="pl-2 pr-0 lg:px-4">
        <div className="flex items-center gap-2">{content[2]}</div>
      </TableCell>
      {(typeColumn || statusColumn) && <TableCell className="grow">{content[3]}</TableCell>}
      <TableCell className="h-auto w-full pb-2.5 xl:w-auto xl:pb-4">{content[4]}</TableCell>
      <TableCell className="h-auto w-full pt-2.5 xl:w-auto xl:pt-4">
        <Text variant="small" className="text-selectActive xl:hidden">
          <Trans>Tx hash</Trans>
        </Text>
        <div className="flex justify-between space-x-2 lg:justify-start xl:justify-end">{content[5]}</div>
      </TableCell>
    </>
  );
};

const LoadingHistoryRow = ({ index, typeColumn }: Omit<HistoryRowProps, 'chainId'>) => {
  const content = useMemo(
    () => [
      <TableCellSkeleton key="first" />,
      <TableCellSkeleton key="second" className="w-1/2 translate-x-1/2" />,
      <TableCellSkeleton key="third" />,
      <TableCellSkeleton
        key="fourth"
        className={index % 2 === 0 ? 'w-1/2 translate-x-full' : 'w-3/4 translate-x-1/3'}
      />,
      <TableCellSkeleton
        key="fifth"
        className={index % 2 === 0 ? 'w-1/2 translate-x-full' : 'w-3/4 translate-x-1/3'}
      />,
      <TableCellSkeleton key="sixth" className={index % 2 === 0 ? 'w-1/2' : 'w-3/4'} />
    ],
    [index]
  );

  return <BaseRow typeColumn={typeColumn} content={content} />;
};

const HistoryRowContent = ({
  row,
  chainId,
  index,
  typeColumn,
  statusColumn,
  cowExplorerLink = false
}: HistoryRowProps) => {
  const explorerName = getExplorerName(chainId, false);

  const content = useMemo(
    () => [
      <Fragment key="first-content">
        {row?.tokenLeft && <TokenIcon token={{ symbol: row?.tokenLeft }} className="h-6 w-6" />}
        {row?.iconLeft && row?.iconLeft}
        {typeof row?.textLeft === 'string' ? (
          <Text
            className={
              row?.highlightText
                ? row?.highlightColor === HighlightColor.Bearish
                  ? 'text-error'
                  : 'text-bullish'
                : 'text-text'
            }
            data-testid={index === 0 ? 'history-transaction-left-text' : undefined}
          >
            {row?.textLeft} {row?.tokenLeft}
          </Text>
        ) : (
          row?.textLeft
        )}
      </Fragment>,
      <Fragment key="second-content">
        {row?.textLeft && row?.textRight && <ArrowRightLong width={14} height={10} />}
      </Fragment>,
      <Fragment key="third-content">
        {row?.tokenRight && <TokenIcon token={{ symbol: row?.tokenRight }} className="h-6 w-6" />}
        <Text data-testid={index === 0 ? 'history-transaction-right-text' : undefined}>
          {row?.textRight} {row?.tokenRight}
        </Text>
      </Fragment>,
      <Text key="fourth-content" className="text-right xl:text-left">
        {row?.type || row?.cowOrderStatus}
      </Text>,
      <Fragment key="fifth-content">
        <Text variant="small" className="text-selectActive xl:hidden">
          <Trans>Date</Trans>
        </Text>
        <Text className="text-left xl:text-right">{row?.formattedDate}</Text>
      </Fragment>,
      <div key="sixth-content" className="flex justify-between space-x-2 lg:justify-start xl:justify-end">
        <Text>{formatAddress(row?.transactionHash || '', 6, 4)}</Text>
        <div className="flex space-x-4 xl:space-x-2">
          <Tooltip>
            <TooltipTrigger>
              <ExternalLink
                href={
                  cowExplorerLink
                    ? getCowExplorerLink(chainId, row?.transactionHash || '')
                    : getEtherscanLink(chainId, row?.transactionHash || '', 'tx')
                }
                iconSize={13}
              />
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent arrowPadding={10}>
                <Text variant="small">
                  {cowExplorerLink ? (
                    <Trans>View transaction on CoW Explorer</Trans>
                  ) : (
                    t`View transaction on ${explorerName}`
                  )}
                </Text>
                <TooltipArrow width={12} height={8} />
              </TooltipContent>
            </TooltipPortal>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger>
              <CopyToClipboard text={row?.transactionHash || ''} />
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent arrowPadding={10}>
                <Text variant="small">
                  <Trans>Copy transaction hash</Trans>
                </Text>
                <TooltipArrow width={12} height={8} />
              </TooltipContent>
            </TooltipPortal>
          </Tooltip>
        </div>
      </div>
    ],
    [row, chainId, index]
  );

  return <BaseRow typeColumn={typeColumn} statusColumn={statusColumn} content={content} />;
};

export const HistoryRow = ({
  row,
  chainId,
  index,
  typeColumn,
  statusColumn,
  cowExplorerLink
}: HistoryRowProps) => {
  return (
    <TableRow className="flex flex-wrap xl:table-row">
      <LoadingErrorWrapper
        isLoading={!row}
        loadingComponent={<LoadingHistoryRow index={index} typeColumn={typeColumn} />}
        error={null}
      >
        <HistoryRowContent
          row={row}
          chainId={chainId}
          index={index}
          typeColumn={typeColumn}
          statusColumn={statusColumn}
          cowExplorerLink={cowExplorerLink}
        />
      </LoadingErrorWrapper>
    </TableRow>
  );
};
