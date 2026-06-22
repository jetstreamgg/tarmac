import { useConnection } from 'wagmi';
import { ConnectedPortfolio } from './ConnectedPortfolio';
import { UnconnectedPortfolio } from './UnconnectedPortfolio';

/**
 * The /portfolio destination. Branches on wallet connection: connected wallets
 * get their positions and earnings; disconnected visitors get a connect prompt,
 * the Earn marketplace, and Sky-wide statistics. Each branch owns its own hooks
 * so neither runs the other's data fetches.
 */
export function PortfolioPage() {
  const { isConnected } = useConnection();
  return isConnected ? <ConnectedPortfolio /> : <UnconnectedPortfolio />;
}
