import { afterAll, beforeAll, inject } from 'vitest';
import { connect, disconnect } from '@wagmi/core';
import { config, testClientMainnet, testClientBase, testClientArbitrum } from './WagmiWrapper';

beforeAll(async () => {
  await connect(config, { connector: config.connectors[0] });
});

afterAll(async () => {
  await disconnect(config);

  const snapshotIdMainnet =
    (globalThis as Record<string, any>).__snapshotMainnet ?? inject('snapshotIdMainnet');
  const snapshotIdBase = (globalThis as Record<string, any>).__snapshotBase ?? inject('snapshotIdBase');
  const snapshotIdArbitrum =
    (globalThis as Record<string, any>).__snapshotArbitrum ?? inject('snapshotIdArbitrum');

  await Promise.all([
    testClientMainnet.revert({ id: snapshotIdMainnet }),
    testClientBase.revert({ id: snapshotIdBase }),
    testClientArbitrum.revert({ id: snapshotIdArbitrum })
  ]);

  const [newMainnet, newBase, newArbitrum] = await Promise.all([
    testClientMainnet.snapshot(),
    testClientBase.snapshot(),
    testClientArbitrum.snapshot()
  ]);

  (globalThis as Record<string, any>).__snapshotMainnet = newMainnet;
  (globalThis as Record<string, any>).__snapshotBase = newBase;
  (globalThis as Record<string, any>).__snapshotArbitrum = newArbitrum;
});
