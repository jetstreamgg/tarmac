import type { StarToken, SortKey } from '../types/starToken';

export const formatLargeNumber = (value: string | number): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) return '0';

  if (num >= 1e9) {
    return `$${(num / 1e9).toFixed(2)}B`;
  } else if (num >= 1e6) {
    return `$${(num / 1e6).toFixed(2)}M`;
  } else if (num >= 1e3) {
    return `$${(num / 1e3).toFixed(2)}K`;
  } else {
    return `$${num.toFixed(2)}`;
  }
};

export const formatPercentage = (value: string | number): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) return '0%';

  return `${(num * 100).toFixed(2)}%`;
};

export const sortTokens = (tokens: StarToken[], sortBy: SortKey, order: 'asc' | 'desc'): StarToken[] => {
  const getSortValue = (token: StarToken, key: SortKey): number => {
    switch (key) {
      case 'name':
      case 'protocol':
      case 'network':
        return 0;
      case 'exposure':
      case 'tvl':
        return parseFloat(token.exposure || '0');
      case 'apr':
        return parseFloat(token.apr || '0');
      case 'rrc':
        return parseFloat(token.rrc || '0');
      case 'exposureShare':
        return parseFloat(token.exposureShare || '0');
      default:
        return 0;
    }
  };

  const getStringValue = (token: StarToken, key: SortKey): string => {
    switch (key) {
      case 'name':
        return token.name;
      case 'protocol':
        return token.protocol;
      case 'network':
        return token.network;
      default:
        return '';
    }
  };

  return [...tokens].sort((a, b) => {
    if (sortBy === 'name' || sortBy === 'protocol' || sortBy === 'network') {
      const aValue = getStringValue(a, sortBy);
      const bValue = getStringValue(b, sortBy);
      return order === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    } else {
      const aValue = getSortValue(a, sortBy);
      const bValue = getSortValue(b, sortBy);
      return order === 'asc' ? aValue - bValue : bValue - aValue;
    }
  });
};

export const filterTokensByNetwork = (tokens: StarToken[], network: string): StarToken[] => {
  if (network === 'all') return tokens;
  return tokens.filter(token => token.network.toLowerCase() === network.toLowerCase());
};

export const filterTokensByProtocol = (tokens: StarToken[], protocol: string): StarToken[] => {
  if (protocol === 'all') return tokens;
  return tokens.filter(token => token.protocol.toLowerCase() === protocol.toLowerCase());
};

export const searchTokens = (tokens: StarToken[], searchTerm: string): StarToken[] => {
  const term = searchTerm.toLowerCase();
  return tokens.filter(
    token =>
      token.name.toLowerCase().includes(term) ||
      token.symbol.toLowerCase().includes(term) ||
      token.protocol.toLowerCase().includes(term)
  );
};

export const getRiskLevel = (rrc: string, exposure: string): 'low' | 'medium' | 'high' => {
  const rrcValue = parseFloat(rrc);
  const exposureValue = parseFloat(exposure);

  if (exposureValue === 0) return 'low';

  const ratio = rrcValue / exposureValue;

  if (ratio < 0.01) return 'low';
  if (ratio < 0.05) return 'medium';
  return 'high';
};

export const getRiskColor = (level: 'low' | 'medium' | 'high'): string => {
  switch (level) {
    case 'low':
      return 'text-green-600';
    case 'medium':
      return 'text-yellow-600';
    case 'high':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
};

export class StarTokenError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'StarTokenError';
  }
}

export const handleFetchError = (error: any): StarTokenError => {
  if (error instanceof StarTokenError) {
    return error;
  }

  if (error.response) {
    return new StarTokenError(`API Error: ${error.response.statusText}`, 'API_ERROR', {
      status: error.response.status,
      statusText: error.response.statusText
    });
  }

  if (error.request) {
    return new StarTokenError('Network error: Unable to reach the server', 'NETWORK_ERROR');
  }

  return new StarTokenError(error.message || 'An unexpected error occurred', 'UNKNOWN_ERROR');
};
