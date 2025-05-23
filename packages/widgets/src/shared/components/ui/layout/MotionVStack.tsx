import { cn } from '@widgets/lib/utils';
import { HTMLMotionProps, motion } from 'framer-motion';

type VStackProps = HTMLMotionProps<'div'> & {
  gap?: number;
  children: React.ReactNode;
  className?: string;
};

export const MotionVStack = ({ children, gap = 4, className = '', ...props }: VStackProps) => {
  const spacingClass = `space-y-${gap}`;
  const classes = cn(`flex flex-col ${spacingClass}`, className);

  return (
    <motion.div className={classes} {...props}>
      {children}
    </motion.div>
  );
};
