import { Layout } from '@/modules/layout/components/Layout';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { useChainId } from 'wagmi';
import { useUrnViewer } from '@jetstreamgg/hooks';
import { Card } from '@/components/ui/card';
import { Text } from '@/modules/layout/components/Typography';
import { VStack } from '@/modules/layout/components/VStack';
import { HStack } from '@/modules/layout/components/HStack';

export function SealEngineUrnViewer() {
  const { urnAddress } = useParams<{ urnAddress: string }>();
  const chainId = useChainId();
  const { fetchUrnData } = useUrnViewer(urnAddress, chainId);

  const {
    data: urns,
    isLoading,
    error
  } = useQuery({
    queryKey: ['seal-urns', urnAddress, chainId],
    queryFn: fetchUrnData,
    enabled: !!urnAddress && !!chainId
  });

  if (isLoading) {
    return <Text>Loading...</Text>;
  }

  if (error) {
    return <Text className="text-error">Error loading Urn data</Text>;
  }

  if (!urns || urns.length === 0) {
    return <Text>No Urn data found</Text>;
  }

  const urn = urns[0];

  return (
    <Layout>
      <VStack gap={6} className="p-6">
        <Card className="w-full">
          <VStack gap={4}>
            <Text variant="large">Seal Urn Details</Text>

            <HStack className="justify-between">
              <Text>Urn Address:</Text>
              <Text>{urn.id}</Text>
            </HStack>

            <HStack className="justify-between">
              <Text>Owner:</Text>
              <Text>{urn.owner}</Text>
            </HStack>

            <HStack className="justify-between">
              <Text>Index:</Text>
              <Text>{urn.index}</Text>
            </HStack>

            <HStack className="justify-between">
              <Text>MKR Locked:</Text>
              <Text>{urn.mkrLocked}</Text>
            </HStack>

            <HStack className="justify-between">
              <Text>SKY Locked:</Text>
              <Text>{urn.skyLocked}</Text>
            </HStack>

            <HStack className="justify-between">
              <Text>USDS Debt:</Text>
              <Text>{urn.usdsDebt}</Text>
            </HStack>

            <HStack className="justify-between">
              <Text>Auctions Count:</Text>
              <Text>{urn.auctionsCount}</Text>
            </HStack>
          </VStack>
        </Card>

        <Card className="w-full">
          <VStack gap={4}>
            <Text variant="large">Transaction History</Text>

            {urn.wipes.length > 0 && (
              <VStack gap={2}>
                <Text variant="medium">Wipes</Text>
                {urn.wipes.map((wipe, index) => (
                  <HStack key={index} className="justify-between">
                    <Text>Amount: {wipe.wad}</Text>
                    <Text>Block: {wipe.blockNumber}</Text>
                    <Text>Tx: {wipe.transactionHash}</Text>
                  </HStack>
                ))}
              </VStack>
            )}

            {urn.draws.length > 0 && (
              <VStack gap={2}>
                <Text variant="medium">Draws</Text>
                {urn.draws.map((draw, index) => (
                  <HStack key={index} className="justify-between">
                    <Text>Amount: {draw.wad}</Text>
                    <Text>Block: {draw.blockNumber}</Text>
                    <Text>Tx: {draw.transactionHash}</Text>
                  </HStack>
                ))}
              </VStack>
            )}

            {urn.onKicks.length > 0 && (
              <VStack gap={2}>
                <Text variant="medium">Kicks</Text>
                {urn.onKicks.map((kick, index) => (
                  <HStack key={index} className="justify-between">
                    <Text>Amount: {kick.wad}</Text>
                    <Text>Block: {kick.blockNumber}</Text>
                    <Text>Tx: {kick.transactionHash}</Text>
                  </HStack>
                ))}
              </VStack>
            )}

            {urn.onTakes.length > 0 && (
              <VStack gap={2}>
                <Text variant="medium">Takes</Text>
                {urn.onTakes.map((take, index) => (
                  <HStack key={index} className="justify-between">
                    <Text>Amount: {take.wad}</Text>
                    <Text>Block: {take.blockNumber}</Text>
                    <Text>Tx: {take.transactionHash}</Text>
                  </HStack>
                ))}
              </VStack>
            )}

            {urn.onRemoves.length > 0 && (
              <VStack gap={2}>
                <Text variant="medium">Removes</Text>
                {urn.onRemoves.map((remove, index) => (
                  <HStack key={index} className="justify-between">
                    <Text>Sold: {remove.sold}</Text>
                    <Text>Block: {remove.blockNumber}</Text>
                    <Text>Tx: {remove.transactionHash}</Text>
                  </HStack>
                ))}
              </VStack>
            )}

            {urn.barks.length > 0 && (
              <VStack gap={2}>
                <Text variant="medium">Barks</Text>
                {urn.barks.map((bark, index) => (
                  <HStack key={index} className="justify-between">
                    <Text>ID: {bark.id}</Text>
                    <Text>Block: {bark.blockNumber}</Text>
                    <Text>Tx: {bark.transactionHash}</Text>
                  </HStack>
                ))}
              </VStack>
            )}

            {urn.locks.length > 0 && (
              <VStack gap={2}>
                <Text variant="medium">Locks</Text>
                {urn.locks.map((lock, index) => (
                  <HStack key={index} className="justify-between">
                    <Text>Amount: {lock.wad}</Text>
                    <Text>Block: {lock.blockNumber}</Text>
                    <Text>Tx: {lock.transactionHash}</Text>
                  </HStack>
                ))}
              </VStack>
            )}

            {urn.frees.length > 0 && (
              <VStack gap={2}>
                <Text variant="medium">Frees</Text>
                {urn.frees.map((free, index) => (
                  <HStack key={index} className="justify-between">
                    <Text>Amount: {free.wad}</Text>
                    <Text>Block: {free.blockNumber}</Text>
                    <Text>Tx: {free.transactionHash}</Text>
                  </HStack>
                ))}
              </VStack>
            )}
          </VStack>
        </Card>
      </VStack>
    </Layout>
  );
}
