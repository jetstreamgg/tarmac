export interface StarProtocolConfig {
  id: string;
  name: string;
  enabled: boolean;
  apiEndpoint: string;
  displayOrder: number;
  chainIds?: number[];
  features?: {
    hasRiskMetrics: boolean;
    hasAscData: boolean;
    hasAprData: boolean;
  };
}

export const STAR_PROTOCOLS: StarProtocolConfig[] = [
  {
    id: 'spark',
    name: 'Spark',
    enabled: true,
    apiEndpoint: 'https://info-sky.blockanalitica.com/star-monitoring/risk-capital/spark/',
    displayOrder: 1,
    features: {
      hasRiskMetrics: true,
      hasAscData: true,
      hasAprData: false
    }
  },
  {
    id: 'grove',
    name: 'Grove',
    enabled: true,
    apiEndpoint: 'https://info-sky.blockanalitica.com/star-monitoring/risk-capital/grove/',
    displayOrder: 2,
    features: {
      hasRiskMetrics: true,
      hasAscData: true,
      hasAprData: false
    }
  }
];

export const getActiveProtocols = () =>
  STAR_PROTOCOLS.filter(p => p.enabled).sort((a, b) => a.displayOrder - b.displayOrder);

export const getProtocolConfig = (): StarProtocolConfig[] => {
  return STAR_PROTOCOLS;
};
