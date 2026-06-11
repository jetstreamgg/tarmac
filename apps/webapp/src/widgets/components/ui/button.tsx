// Re-export shim — unified into the canonical L0 primitive (ticket A1).
// The widget button look is preserved verbatim in @/components/ui/button as the
// `ButtonWidget*` exports; this shim aliases them back to the names widget
// call-sites use. Slated for convergence with the app button in a follow-up.
export { ButtonWidget as Button, buttonWidgetVariants as buttonVariants } from '@/components/ui/button';
export type { ButtonWidgetProps as ButtonProps, ButtonVariant } from '@/components/ui/button';
