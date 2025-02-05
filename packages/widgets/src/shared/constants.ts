import { msg } from '@lingui/core/macro';
import { TxCardCopyText } from './types/txCardCopyText';

export enum TxStatus {
  IDLE = 'idle',
  INITIALIZED = 'initialized',
  LOADING = 'loading',
  SUCCESS = 'success',
  CANCELLED = 'cancelled',
  ERROR = 'error'
}

export enum InitialFlow {
  INITIAL = 'initial'
}

export enum InitialAction {
  INITIAL = 'initial'
}

export enum InitialScreen {
  ACTION = 'action',
  TRANSACTION = 'transaction'
}

export const approveLoadingButtonText: TxCardCopyText = {
  [TxStatus.INITIALIZED]: msg`Waiting for confirmation`,
  [TxStatus.LOADING]: msg`Processing transaction`,
  [TxStatus.SUCCESS]: msg`Success`,
  [TxStatus.ERROR]: msg`Error`
};

export const TENDERLY_CHAIN_ID = 314310;
export const TENDERLY_BASE_CHAIN_ID = 8555;
export const TENDERLY_ARBITRUM_CHAIN_ID = 42012;

export const tokenColors = [
  { symbol: 'ETH', color: '#6d7ce3' },
  { symbol: 'WETH', color: '#6d7ce3' },
  { symbol: 'DAI', color: '#fbc854' },
  { symbol: 'MKR', color: '#1aab9b' },
  { symbol: 'USDS', color: '#b66bfc' },
  { symbol: 'SKY', color: '#d56ed7' },
  { symbol: 'USDT', color: '#5a9e7d' },
  { symbol: 'USDC', color: '#4872c4' },
  { symbol: 'SUSDS', color: '#95DC89' }
];

export enum NotificationType {
  INSUFFICIENT_BALANCE = 'insufficient_balance',
  DAI_RECEIVED = 'dai_received',
  MKR_RECEIVED = 'mkr_received',
  USDS_RECEIVED = 'usds_received',
  SKY_RECEIVED = 'sky_received',
  USDC_RECEIVED = 'usdc_received',
  SUSDS_RECEIVED = 'susds_received'
}

export const notificationTypeMaping: Record<string, NotificationType> = {
  DAI: NotificationType.DAI_RECEIVED,
  MKR: NotificationType.MKR_RECEIVED,
  USDS: NotificationType.USDS_RECEIVED,
  SKY: NotificationType.SKY_RECEIVED,
  USDC: NotificationType.USDS_RECEIVED,
  SUSDS: NotificationType.SUSDS_RECEIVED
};

export const EPOCH_LENGTH = 30 * 60; // 30 minutes
