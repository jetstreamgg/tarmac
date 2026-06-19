import { describe, expect, it } from 'vitest';
import {
  RING_DEFAULT,
  RING_MORPHO,
  RING_PENDLE,
  isMorphoVault,
  isPendleFixed,
  productIconSymbol,
  productRingColor
} from './productVisuals';

describe('productVisuals', () => {
  it('rings Morpho vaults blue', () => {
    expect(isMorphoVault({ id: 'vault-morpho-0x1', kind: 'vault' })).toBe(true);
    expect(productRingColor({ id: 'vault-morpho-0x1', kind: 'vault' })).toBe(RING_MORPHO);
  });

  it('rings non-Morpho vaults (Sky/Spark) gray', () => {
    expect(isMorphoVault({ id: 'vault-sky-0x1', kind: 'vault' })).toBe(false);
    expect(productRingColor({ id: 'vault-sky-0x1', kind: 'vault' })).toBe(RING_DEFAULT);
  });

  it('rings Pendle fixed-yield green', () => {
    expect(isPendleFixed({ id: 'fixed-0x1', kind: 'fixed' })).toBe(true);
    expect(productRingColor({ id: 'fixed-0x1', kind: 'fixed' })).toBe(RING_PENDLE);
  });

  it('rings savings, rewards and stUSDS gray', () => {
    expect(productRingColor({ id: 'savings', kind: 'savings' })).toBe(RING_DEFAULT);
    expect(productRingColor({ id: 'rewards-spk', kind: 'rewards' })).toBe(RING_DEFAULT);
    expect(productRingColor({ id: 'stusds', kind: 'stusds' })).toBe(RING_DEFAULT);
  });

  it('uses the reward token for the rewards icon, the display token otherwise', () => {
    expect(productIconSymbol({ id: 'rewards-spk', kind: 'rewards', tokenSymbol: 'USDS' })).toBe('SPK');
    expect(productIconSymbol({ id: 'savings', kind: 'savings', tokenSymbol: 'USDS' })).toBe('USDS');
  });
});
