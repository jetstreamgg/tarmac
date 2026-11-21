// Enables the CCTP test attesters on the Tenderly multichain environment's Ethereum fork,
// so the claims the dev server's Iris stand-in signs (vite.forkIris.ts) are received there.
// Keeps the fork's signature threshold. Once per environment; again after it is reset.
// Usage, from apps/webapp: node --env-file=.env scripts/enableForkCctpAttesters.ts
import { createPublicClient, http } from 'viem';
import {
  attestationThreshold,
  enableTestAttesters,
  testAttestersEnabled
} from '../src/test/e2e/utils/cctpTestAttesters.ts';

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const l1Rpc = process.env.VITE_RPC_PROVIDER_TENDERLY || fail('VITE_RPC_PROVIDER_TENDERLY is not set');
const l1 = createPublicClient({ transport: http(l1Rpc) });

const threshold = await attestationThreshold(l1);
if (await testAttestersEnabled(l1, threshold)) {
  console.log(`Already enabled: ${threshold} test attester(s), the fork's threshold.`);
} else {
  await enableTestAttesters(l1);
  if (!(await testAttestersEnabled(l1, threshold))) fail('The test attesters are still not enabled.');
  console.log(`Enabled ${threshold} test attester(s), the fork's threshold.`);
}
