import { afterAll, beforeAll, inject } from 'vitest';
import { connect, disconnect } from '@wagmi/core';
import { config, testClientMainnet, testClientBase, testClientArbitrum } from './WagmiWrapper';

beforeAll(async () => {
  await connect(config, { connector: config.connectors[0] });
});

afterAll(async () => {
  await disconnect(config);

  // Inject the snapshotIdMainnet and snapshotIdBase from the global context, provided from the globalSetup file
  const snapshotIdMainnet = inject('snapshotIdMainnet');
  const snapshotIdBase = inject('snapshotIdBase');
  const snapshotIdArbitrum = inject('snapshotIdArbitrum');
  await Promise.all([
    testClientMainnet.revert({ id: snapshotIdMainnet }),
    testClientBase.revert({ id: snapshotIdBase }),
    testClientArbitrum.revert({ id: snapshotIdArbitrum })
  ]);
});
