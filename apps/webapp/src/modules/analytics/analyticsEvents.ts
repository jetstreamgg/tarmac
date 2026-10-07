export enum WidgetAnalyticsEventType {
  REVIEW_VIEWED = 'review_viewed',
  TRANSACTION_STARTED = 'transaction_started',
  TRANSACTION_COMPLETED = 'transaction_completed',
  TRANSACTION_ERROR = 'transaction_error',
  TRANSACTION_CANCELLED = 'transaction_cancelled'
}

export type WidgetAnalyticsEvent = {
  event: WidgetAnalyticsEventType;
  action: string | null;
  flow: string | null;
  txHash?: string;
  amount?: number;
  assetSymbol?: string;
  data?: Record<string, unknown>;
  // Raw tx error, classified into bounded properties by useWidgetAnalytics. Never stored verbatim.
  error?: unknown;
};
