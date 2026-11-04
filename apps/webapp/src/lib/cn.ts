import { type ClassNameValue, twMerge } from 'tailwind-merge';

// Canonical className combiner (tailwind-merge); `@/lib/utils` re-exports it.
// Dependency-free so any layer can share one `cn` without pulling in
// app-level modules. Takes strings, falsy values and nested arrays — no
// clsx-style `{ class: condition }` objects.
export function cn(...inputs: ClassNameValue[]) {
  return twMerge(inputs);
}
