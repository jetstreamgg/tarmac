import { request, gql } from 'graphql-request';
import { getMakerSubgraphUrl } from '../helpers/getSubgraphUrl';

export interface MigrationUrn {
  id: string;
  owner: string;
  index: string;
  mkrLocked: string;
  skyLocked: string;
  usdsDebt: string;
  auctionsCount: string;
}

interface MigrationUrnsResponse {
  sealUrns: MigrationUrn[];
}

export interface MigrationOverview {
  urns: MigrationUrn[];
  stats: {
    totalUrns: number;
    urnsWithDebt: number;
    urnsWithMkr: number;
    urnsWithSky: number;
  };
}

async function fetchUrnsWithDebt(urlSubgraph: string): Promise<MigrationUrn[]> {
  const query = gql`
    {
      sealUrns(where: { usdsDebt_gt: "0" }, orderBy: usdsDebt, orderDirection: asc) {
        id
        owner
        index
        mkrLocked
        skyLocked
        usdsDebt
        auctionsCount
      }
    }
  `;

  const response = (await request(urlSubgraph, query)) as MigrationUrnsResponse;
  return response.sealUrns;
}

async function fetchUrnsWithMkr(urlSubgraph: string): Promise<MigrationUrn[]> {
  const query = gql`
    {
      sealUrns(where: { mkrLocked_gt: "0" }, orderBy: usdsDebt, orderDirection: asc) {
        id
        owner
        index
        mkrLocked
        skyLocked
        usdsDebt
        auctionsCount
      }
    }
  `;

  const response = (await request(urlSubgraph, query)) as MigrationUrnsResponse;
  return response.sealUrns;
}

async function fetchUrnsWithSky(urlSubgraph: string): Promise<MigrationUrn[]> {
  const query = gql`
    {
      sealUrns(where: { skyLocked_gt: "0" }, orderBy: usdsDebt, orderDirection: asc) {
        id
        owner
        index
        mkrLocked
        skyLocked
        usdsDebt
        auctionsCount
      }
    }
  `;

  const response = (await request(urlSubgraph, query)) as MigrationUrnsResponse;
  return response.sealUrns;
}

export function useMigrationOverview(chainId: number | undefined) {
  const subgraphUrl = chainId ? getMakerSubgraphUrl(chainId) : undefined;

  return {
    subgraphUrl,
    fetchMigrationData: async (): Promise<MigrationOverview> => {
      if (!subgraphUrl) {
        throw new Error('Chain ID is required');
      }

      // Fetch all three sets of URNs in parallel
      const [urnsWithDebt, urnsWithMkr, urnsWithSky] = await Promise.all([
        fetchUrnsWithDebt(subgraphUrl),
        fetchUrnsWithMkr(subgraphUrl),
        fetchUrnsWithSky(subgraphUrl)
      ]);

      // Combine all URNs and remove duplicates based on ID
      const uniqueUrns = new Map<string, MigrationUrn>();

      [...urnsWithDebt, ...urnsWithMkr, ...urnsWithSky].forEach(urn => {
        uniqueUrns.set(urn.id, urn);
      });

      const allUrns = Array.from(uniqueUrns.values());

      const stats = {
        totalUrns: allUrns.length,
        urnsWithDebt: urnsWithDebt.length,
        urnsWithMkr: urnsWithMkr.length,
        urnsWithSky: urnsWithSky.length
      };

      return {
        urns: allUrns,
        stats
      };
    }
  };
}
