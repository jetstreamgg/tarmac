import { Layout } from '@/modules/layout/components/Layout';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { useChainId } from 'wagmi';
import { useUrnViewer } from '@jetstreamgg/hooks';
import { Card } from '@/components/ui/card';
import { Text } from '@/modules/layout/components/Typography';
import { VStack } from '@/modules/layout/components/VStack';
import { HStack } from '@/modules/layout/components/HStack';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Transaction {
  type: string;
  amount: string;
  blockNumber: string;
  transactionHash: string;
}

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

  // Combine all transactions into a single array
  const transactions: Transaction[] = [
    ...urn.wipes.map(tx => ({
      type: 'Wipe',
      amount: tx.wad,
      blockNumber: tx.blockNumber,
      transactionHash: tx.transactionHash
    })),
    ...urn.draws.map(tx => ({
      type: 'Draw',
      amount: tx.wad,
      blockNumber: tx.blockNumber,
      transactionHash: tx.transactionHash
    })),
    ...urn.onKicks.map(tx => ({
      type: 'Kick',
      amount: tx.wad,
      blockNumber: tx.blockNumber,
      transactionHash: tx.transactionHash
    })),
    ...urn.onTakes.map(tx => ({
      type: 'Take',
      amount: tx.wad,
      blockNumber: tx.blockNumber,
      transactionHash: tx.transactionHash
    })),
    ...urn.onRemoves.map(tx => ({
      type: 'Remove',
      amount: tx.sold,
      blockNumber: tx.blockNumber,
      transactionHash: tx.transactionHash
    })),
    ...urn.barks.map(tx => ({
      type: 'Bark',
      amount: tx.id,
      blockNumber: tx.blockNumber,
      transactionHash: tx.transactionHash
    })),
    ...urn.locks.map(tx => ({
      type: 'Lock',
      amount: tx.wad,
      blockNumber: tx.blockNumber,
      transactionHash: tx.transactionHash
    })),
    ...urn.frees.map(tx => ({
      type: 'Free',
      amount: tx.wad,
      blockNumber: tx.blockNumber,
      transactionHash: tx.transactionHash
    }))
  ].sort((a, b) => parseInt(b.blockNumber) - parseInt(a.blockNumber));

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

            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Type</TableHead>
                    <TableHead className="whitespace-nowrap">Amount</TableHead>
                    <TableHead className="whitespace-nowrap">Block</TableHead>
                    <TableHead className="whitespace-nowrap">Transaction</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx, index) => (
                    <TableRow key={`${tx.type}-${index}`}>
                      <TableCell className="whitespace-nowrap">{tx.type}</TableCell>
                      <TableCell className="whitespace-nowrap">{tx.amount}</TableCell>
                      <TableCell className="whitespace-nowrap">{tx.blockNumber}</TableCell>
                      <TableCell className="whitespace-nowrap">{tx.transactionHash}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </VStack>
        </Card>
      </VStack>
    </Layout>
  );
}
