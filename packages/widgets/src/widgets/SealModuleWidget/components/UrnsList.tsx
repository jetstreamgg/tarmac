import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { useSealCurrentIndex, TOKENS } from '@jetstreamgg/sky-hooks';
import { UrnPosition } from './UrnPosition';
import { Heading, Text } from '@widgets/shared/components/ui/Typography';
import { Trans } from '@lingui/react/macro';
import { OnSealUrnChange } from '../lib/types';
import { useContext } from 'react';
import { SealModuleWidgetContext } from '../context/context';
import { ViewSkyMkrButton } from './ViewSkyMkrButton';
import { Warning } from '@widgets/shared/components/icons/Warning';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { ExternalLink } from '@widgets/shared/components/ExternalLink';

export const UrnsList = ({
  claimPrepared,
  mkrSkyUpgradeUrl,
  claimExecute,
  onSealUrnChange,
  onExternalLinkClicked
}: {
  claimPrepared: boolean;
  mkrSkyUpgradeUrl?: string;
  claimExecute: () => void;
  onSealUrnChange?: OnSealUrnChange;
  onNavigateToStakeWidget?: () => void;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
}) => {
  const { displayToken, setDisplayToken } = useContext(SealModuleWidgetContext);
  const { data: currentIndex } = useSealCurrentIndex();
  const amountOfUrns = Array.from(Array(Number(currentIndex || 0n)).keys());

  if (!currentIndex) return null;

  return (
    <VStack gap={6}>
      <HStack className="items-start" gap={2}>
        <Warning boxSize={32} viewBox="0 0 16 16" className="mt-1" />
        <Text variant="small" className="text-error">
          <Trans>
            The Seal Engine is now deprecated. Please close your positions and open new positions in the
            Staking Engine.
          </Trans>
          <ExternalLink
            href={mkrSkyUpgradeUrl || ''}
            showIcon={false}
            className="ml-1 text-blue-500 underline"
            onExternalLinkClicked={onExternalLinkClicked}
          >
            <Trans>Learn more</Trans>
          </ExternalLink>
        </Text>
      </HStack>
      <Heading tag="h3" variant="small" className="leading-6">
        <div className="flex items-center">
          <Trans>Your positions</Trans>
          <div className="ml-2 flex">
            <ViewSkyMkrButton
              onClick={() => setDisplayToken(displayToken === TOKENS.mkr ? TOKENS.sky : TOKENS.mkr)}
              displayToken={displayToken}
            />
          </div>
        </div>
      </Heading>
      <div className="h-1/2 overflow-auto">
        <div className="flex flex-col gap-6">
          {amountOfUrns.map(index => {
            return (
              <UrnPosition
                key={index}
                index={BigInt(index)}
                claimPrepared={claimPrepared}
                claimExecute={claimExecute}
                onSealUrnChange={onSealUrnChange}
              />
            );
          })}
        </div>
      </div>
    </VStack>
  );
};
