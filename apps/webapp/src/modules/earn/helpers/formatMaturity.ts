const maturityFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric'
});

/** Pendle PT maturity (unix seconds) → the comp's "18 Jun 2026" display form. */
export const formatMaturity = (maturity: number) => maturityFormatter.format(new Date(maturity * 1000));
