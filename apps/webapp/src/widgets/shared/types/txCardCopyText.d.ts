import { MessageDescriptor } from '@lingui/core';
import { TxStatus } from '../constants';

export type TxCardCopyText = {
  [TxStatus.INITIALIZED]: MessageDescriptor;
  [TxStatus.LOADING]: MessageDescriptor;
  [TxStatus.SUCCESS]: MessageDescriptor;
  [TxStatus.ERROR]: MessageDescriptor;
};

export type TxCardCopyTextWithCancel = TxCardCopyText & { [TxStatus.CANCELLED]: MessageDescriptor };
