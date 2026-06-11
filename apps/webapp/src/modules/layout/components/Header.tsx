import React from 'react';
import { Link } from '@tanstack/react-router';
import { AppLink, retainOnNavigate } from '@/lib/navigation';
import { HEADER_HEIGHT } from './constants';
import { defaultConfig } from '../../config/default-config';
import { CustomConnectButton } from './CustomConnectButton';
import { MockConnectButton } from './MockConnectButton';
import { ChainModal } from '@/modules/ui/components/ChainModal';
import { BP, useBreakpointIndex } from '@/modules/ui/hooks/useBreakpointIndex';
import { BATCH_TX_ENABLED } from '@/lib/constants';
import { BatchTransactionsToggle } from '@/components/BatchTransactionsToggle';
// import { erc20Abi, parseEther } from 'viem';
// import {
//   daiUsdsAbi,
//   daiUsdsAddress,
//   getWriteContractCall,
//   mcdDaiAddress,
//   sUsdsAddress,
//   sUsdsImplementationAbi,
//   usdsAddress
// } from '@/hooks';
// import { mainnet } from 'viem/chains';
// import { useConnection } from 'wagmi';
// import { Button } from '@/components/ui/button';

const useMock = import.meta.env.VITE_USE_MOCK_WALLET === 'true';

// Plain route links for the redesigned header nav. No view transition, so
// navigation stays instant (the legacy WidgetNavigation opts into an 830ms
// view transition, which is what made it feel sluggish). retainOnNavigate
// keeps the active network/details params across module switches.
const NAV_ITEMS: { to: string; label: string; exact?: boolean }[] = [
  { to: '/', label: 'Balances', exact: true },
  { to: '/savings', label: 'Savings' },
  { to: '/rewards', label: 'Rewards' },
  { to: '/stake', label: 'Stake' },
  { to: '/convert', label: 'Convert' },
  { to: '/expert', label: 'Expert' },
  { to: '/vaults', label: 'Vaults' },
  { to: '/fixed', label: 'Fixed' }
];

export function Header(): React.ReactElement {
  const { bpi } = useBreakpointIndex();
  const isMobile = bpi < BP.md;
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
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-4 pr-0 pl-3 sm:px-5">
        <AppLink to="/" title="Home page" className="justify-self-start">
          <div className="min-w-[96px]">
            <img src={defaultConfig.logo} alt="logo" width={96} />
          </div>
        </AppLink>

        {/* Redesigned center nav (desktop). Coexists with the legacy
            WidgetNavigation menu during the redesign. */}
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.to}
              to={item.to as '/'}
              search={retainOnNavigate}
              activeOptions={item.exact ? { exact: true } : undefined}
              className="text-textSecondary hover:text-text rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
              activeProps={{ className: 'bg-surface text-text' }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center justify-end gap-3 justify-self-end">
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
