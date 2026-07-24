import { JSX } from 'react';

export enum HighlightColor {
  Bullish = 'bullish',
  Bearish = 'bearish'
}

export interface HistoryRow {
  id: string;
  type?: string;
  textLeft: string | JSX.Element;
  tokenLeft?: string;
  iconLeft?: JSX.Element;
  textRight?: string;
  tokenRight?: string;
  formattedDate: string;
  rawDate: Date;
  transactionHash: string;
  highlightText?: boolean;
  highlightColor?: HighlightColor;
  cowOrderStatus?: string;
  useCowExplorer?: boolean;
}

export interface HistoryTableProps {
  history?: HistoryRow[];
  itemsPerPage?: number;
  error?: Error | null;
  isLoading: boolean;
  errorText: string;
  noWalletText: string;
  noTransactionsText: string;
  transactionHeader: string;
  typeColumn?: boolean;
  statusColumn?: boolean;
  typeHeader?: string;
  dataTestId?: string;
  /** Fired on page navigation with the page landed on and the current page count — lets keyset-paginated sources fetch more when the user reaches the end. */
  onPageChange?: (page: number, totalPages: number) => void;
}

export enum SortDirection {
  asc = 'asc',
  desc = 'desc'
}
