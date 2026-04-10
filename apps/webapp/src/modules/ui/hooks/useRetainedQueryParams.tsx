import { useMemo } from 'react';
import { IS_PRODUCTION_ENV, QueryParams } from '@/lib/constants';
import { useSearchParams } from 'react-router-dom';
import { GEO_OVERRIDE_PARAMS, isValidGeoParam } from '@/modules/geo-config/applyGeoOverrides';

export const getRetainedQueryParams = (
  url: string,
  retainedParams: QueryParams[],
  searchParams: URLSearchParams
): string => {
  const retainedQueryParams = new URLSearchParams();
  retainedParams.forEach(param => {
    if (searchParams.has(param)) {
      retainedQueryParams.set(param, searchParams.get(param) as string);
    }
  });

  // Preserve valid geo override params in non-production
  if (!IS_PRODUCTION_ENV) {
    GEO_OVERRIDE_PARAMS.forEach(param => {
      const value = searchParams.get(param);
      if (value && isValidGeoParam(param, value)) {
        retainedQueryParams.set(param, value);
      }
    });
  }

  const urlObj = new URL(url, window.location.origin);
  retainedQueryParams.forEach((value, key) => {
    urlObj.searchParams.set(key, value);
  });

  return `/${urlObj.search}`;
};

export const useRetainedQueryParams = (
  url: string,
  retainedParams: QueryParams[] = [
    QueryParams.Locale,
    QueryParams.Details,
    QueryParams.Network,
    QueryParams.Chat
  ]
) => {
  const [searchParams] = useSearchParams();

  const retainedQueryParams = useMemo(() => {
    return getRetainedQueryParams(url, retainedParams, searchParams);
  }, [retainedParams, searchParams, url]);

  return retainedQueryParams;
};
