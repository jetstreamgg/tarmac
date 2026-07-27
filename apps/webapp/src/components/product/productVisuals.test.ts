import { describe, expect, it } from 'vitest';
import { isMorphoVault, isPendleFixed, productIconSymbol, productStatusType } from './productVisuals';

describe('productVisuals', () => {
  it('tints Morpho vaults info-blue', () => {
    expect(isMorphoVault({ id: 'vault-morpho-0x1', kind: 'vault' })).toBe(true);
    expect(productStatusType({ id: 'vault-morpho-0x1', kind: 'vault' })).toBe('info');
  });

  it('leaves non-Morpho vaults (Sky/Spark) on the default ring', () => {
    expect(isMorphoVault({ id: 'vault-sky-0x1', kind: 'vault' })).toBe(false);
    expect(productStatusType({ id: 'vault-sky-0x1', kind: 'vault' })).toBeUndefined();
  });

  it('tints Pendle fixed-yield success-green', () => {
    expect(isPendleFixed({ id: 'fixed-0x1', kind: 'fixed' })).toBe(true);
    expect(productStatusType({ id: 'fixed-0x1', kind: 'fixed' })).toBe('success');
  });

  it('leaves savings, rewards and stUSDS on the default ring', () => {
    expect(productStatusType({ id: 'savings', kind: 'savings' })).toBeUndefined();
    expect(productStatusType({ id: 'rewards-spk', kind: 'rewards' })).toBeUndefined();
    expect(productStatusType({ id: 'stusds', kind: 'stusds' })).toBeUndefined();
  });

  it('uses the reward token for the rewards icon, the display token otherwise', () => {
    expect(productIconSymbol({ id: 'rewards-spk', kind: 'rewards', tokenSymbol: 'USDS' })).toBe('SPK');
    expect(productIconSymbol({ id: 'savings', kind: 'savings', tokenSymbol: 'USDS' })).toBe('USDS');
  });
});
