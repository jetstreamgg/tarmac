import { describe, expect, it } from 'vitest';
import { lsSkySkyRewardAddress, lsSkySpkRewardAddress, lsSkyUsdsRewardAddress } from '@/hooks';
import { farmRewardSymbol } from './farmRewardSymbol';

describe('farmRewardSymbol', () => {
  it('maps each generated farm address book to its reward token on mainnet', () => {
    expect(farmRewardSymbol(lsSkySkyRewardAddress[1], 1)).toBe('SKY');
    expect(farmRewardSymbol(lsSkyUsdsRewardAddress[1], 1)).toBe('USDS');
    expect(farmRewardSymbol(lsSkySpkRewardAddress[1], 1)).toBe('SPK');
  });

  it('is case-insensitive on the address', () => {
    expect(farmRewardSymbol(lsSkySkyRewardAddress[1].toLowerCase(), 1)).toBe('SKY');
  });

  it('returns undefined for unknown farms, missing addresses, and unknown chains', () => {
    expect(farmRewardSymbol('0x0000000000000000000000000000000000000001', 1)).toBeUndefined();
    expect(farmRewardSymbol(undefined, 1)).toBeUndefined();
    expect(farmRewardSymbol(lsSkySkyRewardAddress[1], 999999)).toBeUndefined();
  });
});
