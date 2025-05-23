import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { useSealCurrentIndex, TOKENS, useSealMigrations, checkUrnMigrationStatus } from '@jetstreamgg/hooks';
import { UrnPosition } from './UrnPosition';
import { Heading, Text } from '@widgets/shared/components/ui/Typography';
import { Trans } from '@lingui/react/macro';
import { OnSealUrnChange } from '../lib/types';
import { useContext } from 'react';
import { SealModuleWidgetContext } from '../context/context';
import { ViewSkyMkrButton } from './ViewSkyMkrButton';
import { Warning } from '@widgets/shared/components/icons/Warning';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { useAccount } from 'wagmi';
import { ZERO_ADDRESS } from '@jetstreamgg/hooks';
import { ExternalLink } from '@widgets/shared/components/ExternalLink';

export const UrnsList = ({
  claimPrepared,
  mkrSkyUpgradeUrl,
  claimExecute,
  onSealUrnChange,
  onNavigateToMigratedUrn,
  onExternalLinkClicked
}: {
  claimPrepared: boolean;
  mkrSkyUpgradeUrl?: string;
  claimExecute: () => void;
  onSealUrnChange?: OnSealUrnChange;
  onNavigateToMigratedUrn?: (index?: bigint) => void;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
}) => {
  const { address } = useAccount();
  const { displayToken, setDisplayToken } = useContext(SealModuleWidgetContext);
  const { data: currentIndex } = useSealCurrentIndex();
  const amountOfUrns = Array.from(Array(Number(currentIndex || 0n)).keys());
  const { data: migrations, isLoading: isMigrationsLoading } = useSealMigrations({
    owner: address || ZERO_ADDRESS
  });

  if (!currentIndex) return null;

  return (
    <VStack gap={6}>
      <HStack className="items-start" gap={2}>
        <Warning boxSize={20} viewBox="0 0 16 16" className="mt-1" />
        <Text variant="small" className="text-error">
          <Trans>The Seal Engine is now deprecated. Migrate your positions to the Staking Engine.</Trans>
          <ExternalLink
            href={mkrSkyUpgradeUrl || ''}
            showIcon={false}
            className="text-error ml-1 underline"
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
            // TEMPORARY: Remove this once the migration is complete

            const { isMigrated } = checkUrnMigrationStatus(migrations, index);

            return (
              <UrnPosition
                key={index}
                index={BigInt(index)}
                claimPrepared={claimPrepared}
                claimExecute={claimExecute}
                onSealUrnChange={onSealUrnChange}
                isMigrated={isMigrationsLoading ? undefined : isMigrated}
                onNavigateToMigratedUrn={onNavigateToMigratedUrn}
              />
            );
          })}
        </div>
      </div>
    </VStack>
  );
};
