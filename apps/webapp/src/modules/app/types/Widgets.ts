import React from 'react';
import { Intent } from '@/lib/enums';
import { IconProps } from '@/widgets/shared/components/icons/Icon';

export type SharedProps = {
  rightHeaderComponent: React.JSX.Element;
};

export type WidgetSubItem = {
  label: string;
  icon?: React.ReactNode;
  /** Path to navigate to when this sub-item is clicked */
  to: string;
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
