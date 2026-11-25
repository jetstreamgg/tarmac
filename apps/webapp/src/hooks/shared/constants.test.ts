import { describe, expect, it } from 'vitest';
import { chainId, forkChainId } from '@/utils/chainId';
import { SAFE_TRANSACTION_SERVICE_URL } from './constants';

describe('SAFE_TRANSACTION_SERVICE_URL', () => {
  it.each(Object.entries(forkChainId))('asks the real service for fork %s in every build', (network, id) => {
    expect(SAFE_TRANSACTION_SERVICE_URL[id]).toBe(
      SAFE_TRANSACTION_SERVICE_URL[chainId[network as keyof typeof chainId]]
    );
  });
});
