import { MessageDescriptor } from '@lingui/core';
import { TxStatus } from '@/modules/ui/lib/txStatus';

export type TxCardCopyText = {
  [TxStatus.INITIALIZED]: MessageDescriptor;
  [TxStatus.LOADING]: MessageDescriptor;
  [TxStatus.SUCCESS]: MessageDescriptor;
  [TxStatus.ERROR]: MessageDescriptor;
};
