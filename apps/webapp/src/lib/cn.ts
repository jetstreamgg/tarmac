import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Canonical className combiner (clsx + tailwind-merge); `@/lib/utils` and
// `@/widgets/lib/utils` both re-export it. Dependency-free so any layer can share
// one `cn` without pulling in app-level modules.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
