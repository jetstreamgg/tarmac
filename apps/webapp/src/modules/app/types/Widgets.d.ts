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

export type WidgetItem = [
  Intent,
  string,
  (props: IconProps) => React.ReactNode,
  React.ReactNode | null,
  boolean,
  { disabled?: boolean }?,
  string? // description for tooltip
];

export type WidgetGroup = {
  id: string;
  items: WidgetItem[];
};

export type WidgetContent = WidgetGroup[];
