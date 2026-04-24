import React from 'react';
import { motion } from 'motion/react';
import { positionAnimations } from '../animation/presets';

type DetailSectionWrapperProps = {
  children: React.ReactNode;
};

export function DetailSectionWrapper({ children }: DetailSectionWrapperProps) {
  return (
    <motion.div className="flex-basis-0 flex grow flex-col" variants={positionAnimations}>
      {children}
    </motion.div>
  );
}
