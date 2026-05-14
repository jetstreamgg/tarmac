import { describe, expect, it } from 'vitest';
import { chainId } from './chainId';
describe('Contracts', () => {
  it('Should export the chainId definitions', () => {
    expect(chainId.mainnet).toBeDefined();
    expect(chainId.tenderly).toBeDefined();
  });
});
