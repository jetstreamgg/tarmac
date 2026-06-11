// Re-export shim — unified into the canonical L0 primitive (ticket A1).
// The widget card look is preserved verbatim in @/components/ui/card as the
// `CardWidget*` exports; this shim aliases them back to the names widget
// call-sites use. Slated for convergence with the app card in a follow-up.
export {
  CardWidget as Card,
  CardWidgetHeader as CardHeader,
  CardWidgetFooter as CardFooter,
  CardWidgetTitle as CardTitle,
  CardWidgetContent as CardContent,
  MotionCard,
  MotionCardContent
} from '@/components/ui/card';
export type { CardVariant } from '@/components/ui/card';
