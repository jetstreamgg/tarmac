import { describe, expect, it } from 'vitest';
import { isValidRecipient } from './recipient';

describe('isValidRecipient', () => {
  it('accepts an EVM address and rejects junk on EVM', () => {
    expect(isValidRecipient('0x71C7656EC7ab88b098defB751B7401B5f6d8976F', 'evm')).toBe(true);
    expect(isValidRecipient('0x123', 'evm')).toBe(false);
  });

  it('accepts a base58 Solana address and rejects an EVM one on Solana', () => {
    expect(isValidRecipient('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', 'solana')).toBe(true);
    expect(isValidRecipient('0x71C7656EC7ab88b098defB751B7401B5f6d8976F', 'solana')).toBe(false);
  });
});
