import React, { Children } from 'react';
import { motion } from 'motion/react';
import { positionAnimations } from '../animation/presets';

type DetailSectionRowProps = {
  children: React.ReactNode;
};

export function DetailSectionRow({ children }: DetailSectionRowProps) {
  const childCount = Children.count(children);

  return (
    <motion.div
      className={`flex ${childCount > 1 ? 'flex-wrap' : ''} gap-8 ${
        childCount > 1 ? 'md:flex-row' : 'flex-col'
      }`}
      variants={positionAnimations}
    >
      {children}
    </motion.div>
  );
}
