import { cn } from '@widgets/lib/utils';

type VStackProps = React.HTMLAttributes<HTMLDivElement> & {
  gap?: number;
  children: React.ReactNode;
  className?: string;
};

export const VStack = ({ children, gap = 4, className = '', ...props }: VStackProps) => {
  const spacingClass = `space-y-${gap}`;
  const classes = cn(`flex flex-col ${spacingClass}`, className);

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
};
