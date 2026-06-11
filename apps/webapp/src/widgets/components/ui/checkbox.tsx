// Re-export shim — unified into the canonical L0 primitive (ticket A1).
// The widget checkbox look is preserved verbatim in @/components/ui/checkbox as
// `CheckboxWidget`; this shim aliases it back to `Checkbox`. Slated for
// convergence with the app checkbox in a follow-up.
export { CheckboxWidget as Checkbox } from '@/components/ui/checkbox';
