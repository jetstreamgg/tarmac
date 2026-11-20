import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockWagmiConfig } from './config.e2e';

describe('createMockWagmiConfig', () => {
  afterEach(() => {
    delete window.__MOCK_SAFE_HOST__;
  });

  it('has only the two mock connectors when no Safe host is installed', () => {
    expect(createMockWagmiConfig().connectors.map(c => c.id)).toEqual(['mock', 'mock']);
  });

  it('appends the safe connector when Playwright installs a Safe host, without calling it yet', () => {
    const host = vi.fn();
    window.__MOCK_SAFE_HOST__ = host;

    expect(createMockWagmiConfig().connectors.map(c => c.id)).toEqual(['mock', 'mock', 'safe']);
    expect(host).not.toHaveBeenCalled();
  });
});
