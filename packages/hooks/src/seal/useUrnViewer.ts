import { request, gql } from 'graphql-request';
import { getMakerSubgraphUrl } from '../helpers/getSubgraphUrl';

export interface SealUrn {
  id: string;
  owner: string;
  index: string;
  mkrLocked: string;
  skyLocked: string;
  usdsDebt: string;
  auctionsCount: string;
  wipes: {
    wad: string;
    transactionHash: string;
    blockNumber: string;
  }[];
  draws: {
    wad: string;
    transactionHash: string;
    blockNumber: string;
  }[];
  onKicks: {
    wad: string;
    transactionHash: string;
    blockNumber: string;
  }[];
  onTakes: {
    wad: string;
    transactionHash: string;
    blockNumber: string;
  }[];
  onRemoves: {
    sold: string;
    transactionHash: string;
    blockNumber: string;
  }[];
  barks: {
    id: string;
    transactionHash: string;
    blockNumber: string;
  }[];
  locks: {
    wad: string;
    transactionHash: string;
    blockNumber: string;
  }[];
  frees: {
    wad: string;
    transactionHash: string;
    blockNumber: string;
  }[];
}

interface SealUrnsResponse {
  sealUrns: SealUrn[];
}

async function fetchSealUrns(urlSubgraph: string, urnAddress: string): Promise<SealUrn[]> {
  const query = gql`
    {
      sealUrns(where: {id: "${urnAddress}"}, orderBy: usdsDebt, orderDirection: asc) {
        id
        owner
        index
        mkrLocked
        skyLocked
        usdsDebt
        auctionsCount
        wipes {
          wad
          transactionHash
          blockNumber
        }
        draws {
          wad
          transactionHash
          blockNumber
        }
        onKicks {
          wad
          transactionHash
          blockNumber
        }
        onTakes {
          wad
          transactionHash
          blockNumber
        }
        onRemoves {
          sold
          transactionHash
          blockNumber
        }
        barks {
          id
          transactionHash
          blockNumber
        }
        locks {
          wad
          transactionHash
          blockNumber
        }
        frees {
          wad
          transactionHash
          blockNumber
        }
      }
    }
  `;

  const response = (await request(urlSubgraph, query)) as SealUrnsResponse;
  return response.sealUrns;
}

export function useUrnViewer(urnAddress: string | undefined, chainId: number | undefined) {
  const subgraphUrl = chainId ? getMakerSubgraphUrl(chainId) : undefined;

  return {
    subgraphUrl,
    fetchUrnData: () => {
      if (!urnAddress || !subgraphUrl) {
        throw new Error('URN address and chain ID are required');
      }
      return fetchSealUrns(subgraphUrl, urnAddress);
    }
  };
}
