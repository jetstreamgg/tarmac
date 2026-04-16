import { Trans } from '@lingui/react/macro';
import { getEtherscanLink, isL2ChainId } from '@jetstreamgg/sky-utils';
import { useChainId } from 'wagmi';
import { psm3L2Address, usdsPsmWrapperAddress } from '@jetstreamgg/sky-hooks';
import { PopoverRateInfo } from '@jetstreamgg/sky-widgets';
import { AboutCard } from './AboutCard';
import { t } from '@lingui/core/macro';
import { ArrowLeftRight } from 'lucide-react';

export const AboutPsmConversion = ({ height }: { height?: number | undefined }) => {
  const chainId = useChainId();

  const psmAddress = isL2ChainId(chainId)
    ? psm3L2Address[chainId as keyof typeof psm3L2Address]
    : usdsPsmWrapperAddress[chainId as keyof typeof usdsPsmWrapperAddress];

  const etherscanLink = getEtherscanLink(chainId, psmAddress, 'address');

  return (
    <AboutCard
      title={t`1:1 Conversion`}
      icon={<ArrowLeftRight size={24} />}
      description={
        <Trans>
          1:1 Conversion uses contracts deployed by Sky Protocol that enable swapping USDC and USDS
          at a fixed rate through the Peg Stability Module (PSM) <PopoverRateInfo type="psm" />.
          This means that unlike market trades, PSM conversions are not exposed to slippage and MEV
          risks, enabling seamless swapping between supported stablecoins.
        </Trans>
      }
      linkHref={etherscanLink}
      colorMiddle="linear-gradient(43deg, #6D28D9 -2.45%, #4F46E5 100%)"
      height={height}
    />
  );
};
