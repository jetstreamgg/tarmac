import React from 'react';

export type SharedProps = {
  onConnect: (() => void) | undefined;
  addRecentTransaction: (transaction: any) => void; // Replace 'any' with the actual transaction type if known
  locale: string;
  rightHeaderComponent: JSX.Element;
  onNotification: (notification: { title: string; description: string; status: TxStatus }) => void;
  enabled: boolean;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  referralCode: number;
  shouldReset: boolean;
  legalBatchTxUrl: string;
};
