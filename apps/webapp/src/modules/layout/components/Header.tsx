import React from 'react';
import { Link } from 'react-router-dom';
import { HEADER_HEIGHT } from './constants';
import { defaultConfig } from '../../config/default-config';
import { CustomConnectButton } from './CustomConnectButton';
import { MockConnectButton } from './MockConnectButton';
import { ChainModal } from '@/modules/ui/components/ChainModal';
import { BP, useBreakpointIndex } from '@/modules/ui/hooks/useBreakpointIndex';
import { BATCH_TX_ENABLED } from '@/lib/constants';
import { BatchTransactionsToggle } from '@/components/BatchTransactionsToggle';
import { useRetainedQueryParams } from '@/modules/ui/hooks/useRetainedQueryParams';
// import { erc20Abi, parseEther } from 'viem';
// import {
//   daiUsdsAbi,
//   daiUsdsAddress,
//   getWriteContractCall,
//   mcdDaiAddress,
//   sUsdsAddress,
//   sUsdsImplementationAbi,
//   usdsAddress
// } from '@jetstreamgg/sky-hooks';
// import { mainnet } from 'viem/chains';
// import { useConnection } from 'wagmi';
// import { Button } from '@/components/ui/button';

const useMock = import.meta.env.VITE_USE_MOCK_WALLET === 'true';

export function Header(): React.ReactElement {
  const { bpi } = useBreakpointIndex();
  const isMobile = bpi < BP.md;
  const homeLink = useRetainedQueryParams('/?widget=balances');
  // const { address: connectedAddress, isConnected } = useConnection();

  // const amount = parseEther('2');

  // const approveDaiCall = getWriteContractCall({
  //   to: mcdDaiAddress[mainnet.id],
  //   abi: erc20Abi,
  //   functionName: 'approve',
  //   args: [daiUsdsAddress[mainnet.id], amount]
  // });

  // const upgradeCall = getWriteContractCall({
  //   to: daiUsdsAddress[mainnet.id],
  //   abi: daiUsdsAbi,
  //   functionName: 'daiToUsds',
  //   args: [connectedAddress!, amount]
  // });

  // const approveUsdsCall = getWriteContractCall({
  //   to: usdsAddress[mainnet.id],
  //   abi: erc20Abi,
  //   functionName: 'approve',
  //   args: [sUsdsAddress[mainnet.id], amount]
  // });

  // const supplyCall = getWriteContractCall({
  //   to: sUsdsAddress[mainnet.id],
  //   abi: sUsdsImplementationAbi,
  //   functionName: 'deposit',
  //   args: [amount, connectedAddress!, 0]
  // });

  // const calls = [approveDaiCall, upgradeCall, approveUsdsCall, supplyCall];

  // const enabled = isConnected && !!amount && amount !== 0n && !!connectedAddress;

  // const { execute, prepared } = useTransactionFlow({
  //   calls,
  //   chainId: mainnet.id,
  //   enabled,
  //   shouldUseBatch: true
  // });

  return (
    <div
      className={`flex w-full items-center justify-center px-3 py-2 min-h-[${HEADER_HEIGHT}px] max-h-[${HEADER_HEIGHT}px] md:mb-2`}
    >
      <div className="flex w-full items-center justify-between pr-0 pl-3 sm:px-5">
        <Link to={homeLink} title="Home page">
          <div className="min-w-[96px]">
            <img src={defaultConfig.logo} alt="logo" width={96} />
          </div>
        </Link>
        <div className="flex items-center gap-3">
          {/* <Button variant="connectPrimary" onClick={execute} disabled={!prepared}>
            Test batch upgrade and savings supply
          </Button> */}
          <ChainModal dataTestId="chain-modal-trigger-header" showLabel={!isMobile} />
          <CustomConnectButton />
          {useMock ? <MockConnectButton /> : null}
          {BATCH_TX_ENABLED && <BatchTransactionsToggle />}
        </div>
      </div>
    </div>
  );
}
