import { ReactNode } from 'react';
import { RollingDigits } from '@/components/ui/rolling-digits';

/**
 * Splits a formatted value at its last digit: the figure (with any prefix,
 * "$1,234.56") and the trailing unit (" USDS", "%"). The unit is kept out of
 * RollingDigits, which keys separators by position — a figure growing a digit
 * would otherwise remount the unit's letters and roll them too. Text with
 * letters before its last digit ("26 Nov 2026") is not a figure and stays plain.
 */
export const splitFigure = (value: string): [figure: string, unit: string] => {
  const match = /^(\P{L}*\d)(\D*)$/su.exec(value);
  return match ? [match[1], match[2]] : ['', value];
};

/**
 * A cell value whose figure rolls over as it changes (the stake cards'
 * treatment); a text-only value ("–", a network name) just shows. The odometer
 * stays mounted, empty, behind a text-only value so the first figure that
 * replaces it rolls in rather than simply appearing.
 */
export function CellFigure({
  value,
  renderUnit = unit => unit
}: {
  value: string;
  /** Draws the trailing unit; the default is the plain text. */
  renderUnit?: (unit: string) => ReactNode;
}) {
  const [figure, unit] = splitFigure(value);
  return (
    <>
      <RollingDigits value={figure} />
      {figure ? renderUnit(unit) : value}
    </>
  );
}
