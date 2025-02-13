export const normalizeUrlParam = (value: string) => {
  return value.toLowerCase().replaceAll(' ', '');
};
