import { useMemo } from 'react';
import { QueryParams } from '@/lib/constants';
import { useSearchParams } from 'react-router-dom';

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
