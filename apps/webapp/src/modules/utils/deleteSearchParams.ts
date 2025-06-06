import { QueryParams } from '@/lib/constants';

export const deleteSearchParams = (searchParams: URLSearchParams): URLSearchParams => {
  const keysToDelete: string[] = [];

  searchParams.forEach((_, key) => {
    // Collect keys to delete after iteration to avoid potential issues during modification
    if (
      QueryParams.Details !== key &&
      QueryParams.Widget !== key &&
      QueryParams.Network !== key &&
      QueryParams.Chat !== key
    ) {
      keysToDelete.push(key);
    }
  });

  // Delete collected keys
  keysToDelete.forEach(key => {
    searchParams.delete(key);
  });

  return searchParams;
};
