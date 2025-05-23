import { cn } from '@widgets/lib/utils';

type HStackProps = React.HTMLAttributes<HTMLDivElement> & {
  gap?: number;
  children: React.ReactNode;
  className?: string;
};

export const HStack = ({ children, gap = 4, className = '', ...props }: HStackProps) => {
  const spacingClass = `space-x-${gap}`;
  const classes = cn(`flex flex-row ${spacingClass}`, className);

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
};
