import React from 'react';
import { Intent } from '@/lib/enums';

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

export type WidgetSubItem = {
  label: string;
  icon?: React.ReactNode;
  /** Query params to set when this sub-item is clicked */
  params: Record<string, string>;
  /** Target intent for network determination (defaults to parent widget's intent) */
  intent?: Intent;
};

export type WidgetItem = [
  Intent,
  string,
  (props: IconProps) => React.ReactNode,
  React.ReactNode | null,
  boolean,
  { disabled?: boolean }?,
  string?, // description for tooltip
  WidgetSubItem[]? // sub-items for quick navigation in tooltip
];

export type WidgetGroup = {
  id: string;
  items: WidgetItem[];
};

export type WidgetContent = WidgetGroup[];
