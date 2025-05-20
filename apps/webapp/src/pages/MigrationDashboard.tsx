import { Layout } from '@/modules/layout/components/Layout';
import { useQuery } from '@tanstack/react-query';
import { useChainId } from 'wagmi';
import { useMigrationOverview, type MigrationUrn, type MigrationOverview } from '@jetstreamgg/hooks';
import { Card } from '@/components/ui/card';
import { Text } from '@/modules/layout/components/Typography';
import { VStack } from '@/modules/layout/components/VStack';
import { HStack } from '@/modules/layout/components/HStack';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatEther } from 'viem';
import { Link } from 'react-router-dom';

export function MigrationDashboard() {
  const chainId = useChainId();
  const { fetchMigrationData } = useMigrationOverview(chainId);

  const { data, isLoading, error } = useQuery<MigrationOverview>({
    queryKey: ['seal-migration', chainId],
    queryFn: fetchMigrationData,
    enabled: !!chainId
  });

  if (isLoading) {
    return (
      <Layout>
        <Text>Loading...</Text>
      </Layout>
    );
  }

  if (error) {
    console.log(error);
    return (
      <Layout>
        <Text className="text-error">Error loading migration data</Text>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout>
        <Text>No migration data found</Text>
      </Layout>
    );
  }

  // Sort urns by MKR locked in descending order
  const sortedUrns = [...data.urns].sort((a, b) => {
    const mkrA = BigInt(a.mkrLocked);
    const mkrB = BigInt(b.mkrLocked);
    return mkrB > mkrA ? 1 : mkrB < mkrA ? -1 : 0;
  });

  return (
    <Layout>
      <VStack gap={6} className="p-6">
        <Card className="w-full">
          <VStack gap={4}>
            <Text variant="large">Migration Overview</Text>

            <HStack className="justify-between">
              <Text>Total Urns:</Text>
              <Text>{data.stats.totalUrns}</Text>
            </HStack>

            <HStack className="justify-between">
              <Text>Urns with Debt:</Text>
              <Text>{data.stats.urnsWithDebt}</Text>
            </HStack>

            <HStack className="justify-between">
              <Text>Urns with MKR:</Text>
              <Text>{data.stats.urnsWithMkr}</Text>
            </HStack>

            <HStack className="justify-between">
              <Text>Urns with SKY:</Text>
              <Text>{data.stats.urnsWithSky}</Text>
            </HStack>
          </VStack>
        </Card>

        <Card className="w-full">
          <VStack gap={4}>
            <Text variant="large">Urns to Migrate</Text>

            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Urn Address</TableHead>
                    <TableHead className="whitespace-nowrap">Owner</TableHead>
                    <TableHead className="whitespace-nowrap">Index</TableHead>
                    <TableHead className="whitespace-nowrap">MKR Locked</TableHead>
                    <TableHead className="whitespace-nowrap">SKY Locked</TableHead>
                    <TableHead className="whitespace-nowrap">USDS Debt</TableHead>
                    <TableHead className="whitespace-nowrap">Auctions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedUrns.map((urn: MigrationUrn) => (
                    <TableRow key={urn.id}>
                      <TableCell className="whitespace-nowrap">
                        <Link to={`/seal-engine/${urn.id}`} className="text-blue-300 hover:underline">
                          {urn.id}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{urn.owner}</TableCell>
                      <TableCell className="whitespace-nowrap">{urn.index}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatEther(BigInt(urn.mkrLocked))} MKR
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{urn.skyLocked}</TableCell>
                      <TableCell className="whitespace-nowrap">{urn.usdsDebt}</TableCell>
                      <TableCell className="whitespace-nowrap">{urn.auctionsCount}</TableCell>
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
