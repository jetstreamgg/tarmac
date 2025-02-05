import React from 'react';

import { Landing } from '../modules/landing/Landing';
import '../globals.css'; // uncommenting this fixes the padding issues, why?
import { useChainId } from 'wagmi';
import { sepolia, base, arbitrum } from 'wagmi/chains';
import { LandingSepolia } from '@/modules/landing/LandingSepolia';
import { LandingBase } from '@/modules/landing/LandingBase';
import { LandingArbitrum } from '@/modules/landing/LandingArbitrum';
import { TENDERLY_BASE_CHAIN_ID, TENDERLY_ARBITRUM_CHAIN_ID } from '@/modules/providers/wagmi';

function Home(): React.ReactElement {
  const chainId = useChainId();

  if (chainId === sepolia.id) {
    return <LandingSepolia />;
  }

  if (chainId === base.id || chainId === TENDERLY_BASE_CHAIN_ID) {
    return <LandingBase />;
  }

  if (chainId === arbitrum.id || chainId === TENDERLY_ARBITRUM_CHAIN_ID) {
    return <LandingArbitrum />;
  }

  return <Landing />;
}

export default Home;
