import { Intent } from '@/lib/enums';
import { IconProps } from '@/modules/icons/Icon';

export type SharedProps = {
  onConnect: (() => void) | undefined;
  addRecentTransaction: (transaction: any) => void; // Replace 'any' with the actual transaction type if known
  locale: string;
  rightHeaderComponent: JSX.Element;
  onNotification: (notification: { title: string; description: string; status: TxStatus }) => void;
};

export type WidgetItem = [
  Intent,
  string,
  (props: IconProps) => React.ReactNode,
  React.ReactNode | null,
  boolean,
  { disabled?: boolean }?
];

export type WidgetGroup = {
  id: string;
  items: WidgetItem[];
};

export type WidgetContent = WidgetGroup[];
