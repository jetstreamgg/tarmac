import { cn } from '@/widgets/lib/utils';
import { LoadingSpinner as BaseLoadingSpinner } from '@/modules/ui/components/LoadingSpinner';

// Thin wrapper over the canonical spinner: widgets render it at `w-6` instead of
// the `w-10` app default. `cn` (tailwind-merge) lets a caller's own width win.
export const LoadingSpinner = ({ className }: { className?: string }) => (
  <BaseLoadingSpinner className={cn('w-6', className)} />
);
