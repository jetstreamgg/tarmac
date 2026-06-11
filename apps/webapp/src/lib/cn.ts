import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Canonical className combiner (clsx + tailwind-merge) — the single source of
 * truth for the whole webapp. Both `@/lib/utils` and `@/widgets/lib/utils`
 * re-export this. Kept dependency-free (clsx + tailwind-merge only) so the L0
 * design-system layer and the widgets layer share one `cn` without pulling in
 * app-level modules. See ticket A1 (ui/* unification).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
