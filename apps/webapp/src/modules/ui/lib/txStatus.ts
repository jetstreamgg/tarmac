export enum TxStatus {
  IDLE = 'idle',
  INITIALIZED = 'initialized',
  LOADING = 'loading',
  SUCCESS = 'success',
  CANCELLED = 'cancelled',
  ERROR = 'error'
}

export enum BatchStatus {
  ENABLED = 'enabled',
  DISABLED = 'disabled'
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

export enum NotificationType {
  INSUFFICIENT_BALANCE = 'insufficient_balance',
  DAI_RECEIVED = 'dai_received',
  MKR_RECEIVED = 'mkr_received',
  USDS_RECEIVED = 'usds_received',
  SKY_RECEIVED = 'sky_received',
  USDC_RECEIVED = 'usdc_received',
  SUSDS_RECEIVED = 'susds_received'
}
