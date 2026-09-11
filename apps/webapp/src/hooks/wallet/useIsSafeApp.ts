import { useConnection } from 'wagmi';
import { SAFE_CONNECTOR_ID } from '../shared/constants';

/**
 * Whether the app is running inside the Safe{Wallet} iframe (the `safe`
 * connector). Only then does the Safe UI own the session: nothing to
 * disconnect, and the network is whatever Safe the user opened us from.
 *
 * A Safe account reached over WalletConnect is NOT this — see
 * `useIsSafeWallet` for "the connected account is a Safe".
 */
export const useIsSafeApp = () => {
  const { connector } = useConnection();
  return connector?.id === SAFE_CONNECTOR_ID;
};
