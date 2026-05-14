export type FilterOperator = 'gte' | 'lte' | 'gt' | 'lt' | 'eq' | 'in';

type FilterAmount = {
  value: number;
  operator: FilterOperator;
};

export type PaginationOption = {
  page: number;
  pageSize: number;
};
