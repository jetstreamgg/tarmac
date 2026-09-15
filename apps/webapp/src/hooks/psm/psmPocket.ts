import { mainnet } from 'wagmi/chains';
import { TENDERLY_CHAIN_ID } from '../constants';

// The PSM's pocket holds the USDC backing; it has no ABI of its own in the
// wagmi codegen, so only the address lives here. The wrapper ABI and address
// come from `hooks/generated.ts`.
export const psmPocketAddress = {
  [mainnet.id]: '0x37305B1cD40574E4C5Ce33f8e8306Be057fD7341',
  [TENDERLY_CHAIN_ID]: '0x37305B1cD40574E4C5Ce33f8e8306Be057fD7341'
} as const;
