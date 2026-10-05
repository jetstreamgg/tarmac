import { isAddress } from 'viem';
import type { BridgeNetwork } from './networks';

const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** Whether `value` is a valid receiving address on the destination's address family. */
export const isValidRecipient = (value: string, family: BridgeNetwork['family']): boolean =>
  family === 'solana' ? SOLANA_ADDRESS.test(value) : isAddress(value);
