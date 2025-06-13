import { useEffect, useState } from 'react';
import { useChainId } from 'wagmi';
import {
  isBaseChainId,
  isMainnetId,
  isArbitrumChainId,
  isUnichainChainId,
  isOptimismChainId
} from '@jetstreamgg/sky-utils';

const NOT_FOUND = 'image_not_found';
const EXTENSIONS = ['svg', 'png']; // Add more extensions if needed

export const useTokenImage = (symbol: string, chainId?: number, noChain?: boolean) => {
  const [imageSrc, setImageSrc] = useState<string | undefined>();
  const connectedChainId = useChainId();
  const chainIdToUse = noChain ? undefined : chainId || connectedChainId;

  useEffect(() => {
    if (!symbol) return;

    const symbolLower = symbol.toLowerCase();
    let currentIndex = 0;

    const checkNextExtension = () => {
      if (currentIndex >= EXTENSIONS.length) {
        setImageSrc(NOT_FOUND);
        return;
      }

      const extension = EXTENSIONS[currentIndex];
      const path = `/tokens/${!chainIdToUse ? '' : isBaseChainId(chainIdToUse) ? 'base/' : isMainnetId(chainIdToUse) ? 'ethereum/' : isArbitrumChainId(chainIdToUse) ? 'arbitrum/' : isUnichainChainId(chainIdToUse) ? 'unichain/' : isOptimismChainId(chainIdToUse) ? 'optimism/' : ''}${symbolLower}.${extension}`;

      const img = new Image();
      img.onload = () => {
        setImageSrc(path);
      };
      img.onerror = () => {
        currentIndex++;
        checkNextExtension();
      };
      img.src = path;
    };

    checkNextExtension();
  }, [symbol, chainIdToUse]);

  return imageSrc;
};
