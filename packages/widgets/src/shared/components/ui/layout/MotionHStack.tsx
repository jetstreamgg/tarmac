import { cn } from '@widgets/lib/utils';
import { HTMLMotionProps, motion } from 'framer-motion';

type HStackProps = HTMLMotionProps<'div'> & {
  gap?: number;
  children: React.ReactNode;
  className?: string;
};

export const MotionHStack = ({ children, gap = 4, className = '', ...props }: HStackProps) => {
  const spacingClass = `space-x-${gap}`;
  const classes = cn(`flex flex-row ${spacingClass}`, className);

  return (
    <motion.div className={classes} {...props}>
      {children}
    </motion.div>
  );
};
