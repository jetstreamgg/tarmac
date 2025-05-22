import { mainnet } from 'viem/chains';
import { SupportedCollateralTypes } from './vaults.constants';
import { TENDERLY_CHAIN_ID } from '../constants';

// SupportedCollateralTypes.LSEV2_SKY_A correspond to the current ilkName used in the Tenderly testnet
// `Copy of mainnet_2025_apr_15_0`, https://virtual.mainnet.rpc.tenderly.co/9ccec3fd-557a-4e67-9566-71d969dd3ec4;
// TODO: Update the value to `LSEV2_SKY_A` when we switch to a new testnet
export const getIlkName = (chainId: number, version: number = 1): SupportedCollateralTypes => {
  switch (chainId) {
    case mainnet.id:
      return version === 1 ? SupportedCollateralTypes.LSE_MKR_A : SupportedCollateralTypes.LSEV2_SKY_A;
    case TENDERLY_CHAIN_ID:
    default:
      return version === 1 ? SupportedCollateralTypes.LSE_MKR_A : SupportedCollateralTypes.LSEV2_A;
  }
};
