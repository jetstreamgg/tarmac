import { Layout } from '@/modules/layout/components/Layout';
import { useQuery } from '@tanstack/react-query';
import { useChainId } from 'wagmi';
import { useMigrationOverview, type MigrationUrn, type MigrationOverview } from '@jetstreamgg/hooks';
import { Card } from '@/components/ui/card';
import { Text } from '@/modules/layout/components/Typography';
import { VStack } from '@/modules/layout/components/VStack';
import { HStack } from '@/modules/layout/components/HStack';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function SealMigration() {
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

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Urn Address</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Index</TableHead>
                  <TableHead>MKR Locked</TableHead>
                  <TableHead>SKY Locked</TableHead>
                  <TableHead>USDS Debt</TableHead>
                  <TableHead>Auctions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.urns.map((urn: MigrationUrn) => (
                  <TableRow key={urn.id}>
                    <TableCell>{urn.id}</TableCell>
                    <TableCell>{urn.owner}</TableCell>
                    <TableCell>{urn.index}</TableCell>
                    <TableCell>{urn.mkrLocked}</TableCell>
                    <TableCell>{urn.skyLocked}</TableCell>
                    <TableCell>{urn.usdsDebt}</TableCell>
                    <TableCell>{urn.auctionsCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </VStack>
        </Card>
      </VStack>
    </Layout>
  );
}
