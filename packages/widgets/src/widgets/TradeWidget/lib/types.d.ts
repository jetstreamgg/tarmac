import { Token } from '@jetstreamgg/sky-hooks';
import { EthFlowTxStatus } from './constants';
import { MessageDescriptor } from '@lingui/core';

export interface NativeCurrency {
  chainId: number;
  decimals: number;
  name: string;
  symbol: string;
  readonly isNative: true;
  readonly isToken: false;
}

export type TradeToken = Token | NativeCurrency;

export type EthTxCardCopyText = {
  [EthFlowTxStatus.INITIALIZED]: MessageDescriptor;
  [EthFlowTxStatus.SENDING_ETH]: MessageDescriptor;
  [EthFlowTxStatus.CREATING_ORDER]: MessageDescriptor;
  [EthFlowTxStatus.ORDER_CREATED]: MessageDescriptor;
  [EthFlowTxStatus.SUCCESS]: MessageDescriptor;
  [EthFlowTxStatus.ERROR]: MessageDescriptor;
  [EthFlowTxStatus.CANCELLED]: MessageDescriptor;
};
