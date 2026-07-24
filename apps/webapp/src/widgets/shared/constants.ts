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

export const TENDERLY_CHAIN_ID = 314310;

// Stablecoin values follow the DS chart variables (Components/Charts/bg-* and
// Components/Charts-Hover/bg-*-hover; Figma 5051:133511 pie chart, 5270:15609
// tokens composition — APP-416). Both Figma color modes carry the same values,
// so the hexes are theme-invariant. Tokens without a DS chart variable
// (ETH/WETH/DAI/MKR/SKY) keep their legacy brand hues and have no hover swap.
export const tokenColors: { symbol: string; color: string; hoverColor?: string }[] = [
  { symbol: 'ETH', color: '#6d7ce3' },
  { symbol: 'WETH', color: '#6d7ce3' },
  { symbol: 'DAI', color: '#fbc854' },
  { symbol: 'MKR', color: '#1aab9b' },
  { symbol: 'USDS', color: '#d2a679', hoverColor: '#ffc74f' },
  { symbol: 'SKY', color: '#d56ed7' },
  { symbol: 'USDT', color: '#91dbc2', hoverColor: '#7af2c9' },
  { symbol: 'USDC', color: '#1d5da1', hoverColor: '#2177d4' },
  { symbol: 'SUSDS', color: '#47b2a0', hoverColor: '#20c7ab' },
  { symbol: 'STUSDS', color: '#deb3b5', hoverColor: '#ff8389' },
  { symbol: 'SPK', color: '#d66a8e', hoverColor: '#f54882' }
];

/**
 * DS generic chart slots (Components/Charts/bg-chart1/2 + hovers) — cycled for
 * chart series whose token has no dedicated chart variable.
 */
export const CHART_GENERIC_COLORS: { color: string; hoverColor: string }[] = [
  { color: '#757dff', hoverColor: '#4e58ff' },
  { color: '#1dd9ba', hoverColor: '#00f2ca' }
];

// Neutral fallback for tokens without a brand color (keeps charts/legends from
// breaking on an unmapped symbol).
export const FALLBACK_TOKEN_COLOR = '#7e7e8f';

/**
 * Brand color for a token symbol, case-insensitive (the map keys are
 * uppercase, but `Token.symbol` casing varies, e.g. 'sUSDS'). Returns
 * {@link FALLBACK_TOKEN_COLOR} when the symbol isn't mapped.
 */
export function resolveTokenColor(symbol: string): string {
  const upper = symbol.toUpperCase();
  return tokenColors.find(token => token.symbol === upper)?.color ?? FALLBACK_TOKEN_COLOR;
}

/**
 * Base + hover chart colors for a token symbol, or undefined when the symbol
 * has no mapping at all (callers then pick from {@link CHART_GENERIC_COLORS}).
 * Legacy brand hues without a DS hover variable reuse the base color on hover.
 */
export function resolveTokenChartColors(symbol: string): { color: string; hoverColor: string } | undefined {
  const entry = tokenColors.find(token => token.symbol === symbol.toUpperCase());
  return entry ? { color: entry.color, hoverColor: entry.hoverColor ?? entry.color } : undefined;
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

export const notificationTypeMaping: Record<string, NotificationType> = {
  DAI: NotificationType.DAI_RECEIVED,
  MKR: NotificationType.MKR_RECEIVED,
  USDS: NotificationType.USDS_RECEIVED,
  SKY: NotificationType.SKY_RECEIVED,
  USDC: NotificationType.USDS_RECEIVED,
  SUSDS: NotificationType.SUSDS_RECEIVED
};

export const EPOCH_LENGTH = 30 * 60; // 30 minutes
