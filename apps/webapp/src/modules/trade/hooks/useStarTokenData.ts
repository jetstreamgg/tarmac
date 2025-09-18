import { useQuery } from '@tanstack/react-query';
import { useStarProtocols } from './useStarProtocols';
import type {
  StarToken,
  StarMetrics,
  StarProtocolData,
  StarTokenApiResult,
  StarOverviewResponse,
  StarAscData,
  StarProtocolStats
} from '../types/starToken';

const RISK_CAPITAL_BASE_URL = 'https://info-sky.blockanalitica.com/star-monitoring/risk-capital';
const ASC_URL = 'https://info-sky.blockanalitica.com/star-monitoring/asc/stars/';

const fetchProtocolData = async (
  endpoint: string,
  protocolId: string
): Promise<{ protocolId: string; data: StarProtocolData } | null> => {
  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${protocolId} data: ${response.statusText}`);
    }
    const data = await response.json();
    return { protocolId, data };
  } catch (error) {
    console.error(`Error fetching ${protocolId} data:`, error);
    return null;
  }
};

const fetchOverviewData = async (): Promise<StarOverviewResponse | null> => {
  try {
    const response = await fetch(`${RISK_CAPITAL_BASE_URL}/?order=-exposure`);
    if (!response.ok) {
      throw new Error(`Failed to fetch overview data: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching overview data:', error);
    return null;
  }
};

const fetchAscData = async (): Promise<StarAscData[] | null> => {
  try {
    const response = await fetch(`${ASC_URL}?order=-total_asc`);
    if (!response.ok) {
      throw new Error(`Failed to fetch ASC data: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching ASC data:', error);
    return null;
  }
};

const transformApiToken = (token: StarTokenApiResult): StarToken => ({
  protocol: token.protocol,
  network: token.network,
  symbol: token.symbol,
  name: token.name,
  exposure: token.exposure,
  exposureShare: token.exposure_share,
  tvl: token.exposure,
  rrc: token.rrc,
  financialCapitalRequirements: token.financial_capital_requirements,
  adminCapitalRequirements: token.admin_capital_requirements,
  scCapitalRequirements: token.sc_capital_requirements,
  assetSymbol: token.asset_symbol,
  assetAddress: token.asset_address,
  datetime: token.datetime
});

const mergeAndProcessData = (
  protocolData: ({ protocolId: string; data: StarProtocolData } | null)[],
  overviewData: StarOverviewResponse | null,
  ascData: StarAscData[] | null
): { tokens: StarToken[]; metrics: StarMetrics; protocolStats: StarProtocolStats[] } => {
  const allTokens: StarToken[] = [];
  let aggregatedMetrics: StarMetrics | null = null;

  const validProtocolData = protocolData.filter(
    (p): p is { protocolId: string; data: StarProtocolData } => p !== null
  );

  validProtocolData.forEach(({ data }) => {
    if (data.results) {
      const transformedTokens = data.results.map(token => transformApiToken(token));
      allTokens.push(...transformedTokens);
    }
  });

  if (overviewData) {
    aggregatedMetrics = {
      totalExposure: overviewData.total_exposure,
      totalRRC: overviewData.total_rrc,
      totalExposureShare: overviewData.total_exposure_share,
      totalRiskCapital: overviewData.total_rc,
      riskToleranceRatio: overviewData.total_rtr
    };
  } else if (validProtocolData.length > 0) {
    let totalExposure = 0;
    let totalRrc = 0;
    let totalRiskCapital = 0;

    validProtocolData.forEach(({ data }) => {
      totalExposure += parseFloat(data.totalExposure || '0');
      totalRrc += parseFloat(data.totalRrc || '0');
      totalRiskCapital += parseFloat(data.totalRiskCapital || '0');
    });

    aggregatedMetrics = {
      totalExposure: totalExposure.toString(),
      totalRRC: totalRrc.toString(),
      totalExposureShare: '0',
      totalRiskCapital: totalRiskCapital.toString(),
      riskToleranceRatio: totalRiskCapital > 0 ? (totalRrc / totalRiskCapital).toString() : '0'
    };
  } else {
    aggregatedMetrics = {
      totalExposure: '0',
      totalRRC: '0',
      totalExposureShare: '0',
      totalRiskCapital: '0',
      riskToleranceRatio: '0'
    };
  }

  if (ascData) {
    allTokens.forEach(token => {
      const ascInfo = ascData.find(
        asc =>
          token.symbol.toLowerCase().includes(asc.star.toLowerCase()) ||
          token.protocol.toLowerCase() === asc.star.toLowerCase()
      );
      if (ascInfo) {
        token.revenue = ascInfo.total_asc.toString();
      }
    });
  }

  allTokens.sort((a, b) => parseFloat(b.exposure) - parseFloat(a.exposure));

  // Create protocol stats
  const protocolStats: StarProtocolStats[] = [];

  // Add stats from overview data if available
  if (overviewData?.results) {
    overviewData.results.forEach(result => {
      const ascInfo = ascData?.find(asc => asc.star.toLowerCase() === result.star.toLowerCase());
      protocolStats.push({
        star: result.star,
        name: result.star.charAt(0).toUpperCase() + result.star.slice(1),
        totalExposure: result.exposure,
        totalRRC: result.rrc,
        totalRiskCapital: result.total_risk_capital,
        riskToleranceRatio: result.risk_tolerance_ratio,
        exposureShare: result.exposure_share,
        tokenCount: allTokens.filter(t => t.protocol.toLowerCase().includes(result.star.toLowerCase()))
          .length,
        totalAsc: ascInfo?.total_asc,
        ascShare: ascInfo?.asc_share
      });
    });
  } else {
    // Fall back to creating stats from protocol data
    validProtocolData.forEach(({ protocolId, data }) => {
      const ascInfo = ascData?.find(asc => asc.star.toLowerCase() === protocolId.toLowerCase());
      protocolStats.push({
        star: protocolId,
        name: protocolId.charAt(0).toUpperCase() + protocolId.slice(1),
        totalExposure: data.totalExposure || '0',
        totalRRC: data.totalRrc || '0',
        totalRiskCapital: data.totalRiskCapital || '0',
        riskToleranceRatio: data.riskToleranceRatio || '0',
        exposureShare: data.totalExposureShare || '0',
        tokenCount: data.results?.length || 0,
        totalAsc: ascInfo?.total_asc,
        ascShare: ascInfo?.asc_share,
        utilizationEpi: data.epiUtilization,
        utilizationSpj: data.spjUtilization,
        juniorRiskCapital: data.totalJuniorRiskCapital,
        seniorRiskCapital: data.totalSeniorRiskCapital
      });
    });
  }

  return { tokens: allTokens, metrics: aggregatedMetrics, protocolStats };
};

export const useStarTokenData = () => {
  const { activeProtocols } = useStarProtocols();

  return useQuery({
    queryKey: ['starTokens', activeProtocols.map(p => p.id)],
    queryFn: async () => {
      if (activeProtocols.length === 0) {
        return { tokens: [], metrics: null, protocolStats: [] };
      }

      const protocolPromises = activeProtocols.map(protocol =>
        fetchProtocolData(protocol.apiEndpoint, protocol.id)
      );

      const [protocolData, overviewData, ascData] = await Promise.all([
        Promise.all(protocolPromises),
        fetchOverviewData(),
        fetchAscData()
      ]);

      return mergeAndProcessData(protocolData, overviewData, ascData);
    },
    refetchInterval: 60000,
    staleTime: 30000,
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    enabled: activeProtocols.length > 0
  });
};
