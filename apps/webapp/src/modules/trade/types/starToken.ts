export interface StarToken {
  protocol: string;
  network: string;
  symbol: string;
  name: string;

  exposure: string;
  exposureShare: string;
  tvl?: string;

  rrc: string;
  financialCapitalRequirements: string;
  adminCapitalRequirements: string;
  scCapitalRequirements: string;

  apr?: string;
  revenue?: string;

  assetSymbol: string | null;
  assetAddress: string | null;

  datetime?: string;
}

export interface StarMetrics {
  totalExposure: string;
  totalRRC: string;
  totalExposureShare: string;
  totalRiskCapital: string;
  riskToleranceRatio: string;
  totalJuniorRiskCapital?: string;
  totalSeniorRiskCapital?: string;
  utilizationMetrics?: {
    epi: string;
    spj: string;
  };
}

export interface StarProtocolData {
  star: string;
  totalExposure: string;
  totalRrc: string;
  totalExposureShare: string;
  totalJuniorRiskCapital: string;
  totalSeniorRiskCapital: string;
  totalRiskCapital: string;
  riskToleranceRatio: string;
  internalJrc: string;
  externalJrc: string;
  tokenizedJrc: string;
  internalSrc: string;
  externalSrc: string;
  epiUtilization: string;
  spjUtilization: string;
  results: StarTokenApiResult[];
}

export interface StarTokenApiResult {
  protocol: string;
  network: string;
  symbol: string;
  name: string;
  asset_symbol: string | null;
  asset_address: string | null;
  financial_capital_requirements: string;
  admin_capital_requirements: string;
  sc_capital_requirements: string;
  rrc: string;
  datetime: string;
  exposure: string;
  exposure_share: string;
}

export interface StarOverviewResult {
  star: string;
  financial_rrc: string;
  admin_rrc: string;
  sc_rrc: string;
  rrc: string;
  exposure: string;
  exposure_share: string;
  total_risk_capital: string;
  risk_tolerance_ratio: string;
}

export interface StarAscData {
  star: string;
  resting_asc: number;
  resting_asc_change: number;
  latent_asc: number;
  latent_asc_change: number;
  total_asc: number;
  total_asc_change: number;
  asc_share: number;
  asc_share_change: number;
}

export interface StarOverviewResponse {
  results: StarOverviewResult[];
  total_exposure: string;
  total_rrc: string;
  total_exposure_share: string;
  total_rc: string;
  total_rtr: string;
}

export type SortKey = 'name' | 'protocol' | 'network' | 'exposure' | 'tvl' | 'apr' | 'rrc' | 'exposureShare';

export interface StarProtocolStats {
  star: string;
  name: string;
  totalExposure: string;
  totalRRC: string;
  totalRiskCapital: string;
  riskToleranceRatio: string;
  exposureShare: string;
  tokenCount: number;
  totalAsc?: number;
  ascShare?: number;
  utilizationEpi?: string;
  utilizationSpj?: string;
  juniorRiskCapital?: string;
  seniorRiskCapital?: string;
}

export interface StarTokensState {
  tokens: StarToken[];
  metrics: StarMetrics | null;
  protocolStats: StarProtocolStats[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}
