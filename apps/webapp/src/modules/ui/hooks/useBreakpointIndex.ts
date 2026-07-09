import { useState, useEffect } from 'react';

// Mirrors the Tailwind breakpoints in globals.css (@theme --breakpoint-*).
// `desktop` (1200) is the M/L tier of the design-system grid; the other values
// are the legacy scale kept for pre-redesign screens.
export enum BP {
  sm = 0,
  md = 1,
  lg = 2,
  desktop = 3,
  xl = 4,
  '2xl' = 5,
  '3xl' = 6
}

enum BPValue {
  sm = 640,
  md = 768,
  lg = 912,
  desktop = 1200,
  xl = 1280,
  '2xl' = 1400,
  '3xl' = 1680
}

const getBreakpointIndex = (width: number) => {
  if (width < BPValue.md) return BP.sm;
  else if (width < BPValue.lg) return BP.md;
  else if (width < BPValue.desktop) return BP.lg;
  else if (width < BPValue.xl) return BP.desktop;
  else if (width < BPValue['2xl']) return BP.xl;
  else if (width < BPValue['3xl']) return BP['2xl'];
  else return BP['3xl'];
};

export const useBreakpointIndex = () => {
  const width = window.innerWidth;

  const [breakpointIndex, setBreakpointIndex] = useState(getBreakpointIndex(width));

  useEffect(() => {
    const updateBreakpointIndex = () => {
      setBreakpointIndex(getBreakpointIndex(innerWidth));
    };

    updateBreakpointIndex();
    window.addEventListener('resize', updateBreakpointIndex);

    return () => {
      window.removeEventListener('resize', updateBreakpointIndex);
    };
  }, []);

  return { bpi: breakpointIndex };
};
