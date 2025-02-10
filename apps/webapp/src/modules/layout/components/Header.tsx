import React from 'react';
import { Link } from 'react-router-dom';
import { HEADER_HEIGHT } from './constants';
import { defaultConfig } from '../../config/default-config';
import { CustomConnectButton } from './CustomConnectButton';
import { MockConnectButton } from './MockConnectButton';
import { ChainModal } from '@/modules/ui/components/ChainModal';
import { BP, useBreakpointIndex } from '@/modules/ui/hooks/useBreakpointIndex';

const useMock = import.meta.env.VITE_USE_MOCK_WALLET === 'true';

export function Header(): React.ReactElement {
  const { bpi } = useBreakpointIndex();
  const isMobile = bpi < BP.md;

  return (
    <div
      className={`flex w-full items-center justify-center px-3 py-2 min-h-[${HEADER_HEIGHT}px] max-h-[${HEADER_HEIGHT}px] md:mb-2`}
    >
      <div className="flex w-full items-center justify-between pl-3 pr-0 sm:px-5">
        <Link to="/?widget=balances" title="Home page">
          <div className="min-w-[96px]">
            <img src={defaultConfig.logo} alt="logo" width={96} />
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <ChainModal dataTestId="chain-modal-trigger-header" showLabel={!isMobile} />
          <CustomConnectButton />
          {useMock ? <MockConnectButton /> : null}
        </div>
      </div>
    </div>
  );
}
