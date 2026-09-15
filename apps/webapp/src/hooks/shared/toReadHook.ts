import type { DataSource, ReadHook } from '../hooks';

/** The slice of a `useQuery` result a read hook re-exposes. */
type ReadQueryResult<T> = {
  data: T | undefined;
  error: unknown;
  isLoading: boolean;
  refetch: () => unknown;
};

/**
 * The shared return tail of a read hook: `isLoading` stays false once any data
 * is cached (a background refetch must not blank the UI) and `refetch` is
 * exposed as `mutate`.
 */
export function toReadHook<T>(
  { data, error, isLoading, refetch }: ReadQueryResult<T>,
  dataSources: DataSource[]
): ReadHook & { data?: T } {
  return {
    data,
    isLoading: !data && isLoading,
    error: error as Error | null,
    mutate: refetch,
    dataSources
  };
}
