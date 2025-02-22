import { useState, useEffect } from 'react';

export enum BP {
  sm = 0,
  md = 1,
  lg = 2,
  xl = 3,
  '2xl' = 4,
  '3xl' = 5
}

enum BPValue {
  sm = 640,
  md = 768,
  lg = 912,
  xl = 1280,
  '2xl' = 1400,
  '3xl' = 1680
}

const getBreakpointIndex = (width: number) => {
  // sm
  if (width < BPValue.md) return 0;
  // md
  else if (width < BPValue.lg) return 1;
  // lg
  else if (width < BPValue.xl) return 2;
  // xl
  else if (width < BPValue['2xl']) return 3;
  // 2xl
  else if (width < BPValue['3xl']) return 4;
  // 3xl
  else return 5;
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
