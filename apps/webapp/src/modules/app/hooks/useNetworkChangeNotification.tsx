import { useEffect, useRef } from 'react';
import { useChainId, useChains } from 'wagmi';
import { toast } from '@/components/ui/use-toast';
import { Text } from '@/modules/layout/components/Typography';
import { getChainIcon } from '@jetstreamgg/sky-utils';
import { ArrowRightLong } from '@/modules/icons';

export function useNetworkChangeNotification() {
  const chainId = useChainId();
  const chains = useChains();
  const previousChainRef = useRef<{ id: number; name: string } | undefined>(undefined);
  useEffect(() => {
    const chain = chains.find(c => c.id === chainId);
    if (chain?.name) {
      if (previousChainRef.current && previousChainRef.current.name !== chain.name) {
        toast({
          title: 'The network has changed:',
          description: (
            <div className="mt-3 flex items-center gap-5">
              <div className="flex items-center gap-2">
                {getChainIcon(previousChainRef.current.id, 'h-[22px] w-[22px]')}
                <Text className="text-small sm:text-medium md:text-large">
                  {previousChainRef.current.name}
                </Text>
              </div>
              <ArrowRightLong width={18} height={18} />
              <div className="flex items-center gap-2">
                {getChainIcon(chainId, 'h-[22px] w-[22px]')}
                <Text className="text-small sm:text-medium md:text-large">{chain.name}</Text>
              </div>
            </div>
          ),
          duration: 5000
        });
      }
      previousChainRef.current = { id: chain.id, name: chain.name };
    }
  }, [chainId, chains]);
}
