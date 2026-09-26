import { TENDERLY_CHAIN_ID } from '@/data/wagmi/config/testTenderlyChain';
import { usdcRiskCapitalVaultAddress } from '@/hooks/generated';

/** USDC Risk Capital Morpho vault on the Tenderly fork. */
export const USDC_RISK_CAPITAL_VAULT = usdcRiskCapitalVaultAddress[TENDERLY_CHAIN_ID];

export const morphoVaultPath = (vaultAddress: string) => `/earn/vaults/morpho/${vaultAddress}`;
