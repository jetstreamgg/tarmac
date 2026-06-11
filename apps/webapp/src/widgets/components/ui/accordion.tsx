// Re-export shim — unified into the canonical L0 primitive (ticket A1).
// The widget accordion look is preserved verbatim in @/components/ui/accordion as
// the `AccordionWidget*` exports; this shim aliases them back to the names widget
// call-sites use. `Accordion` (AccordionPrimitive.Root) is shared as-is. Slated
// for convergence with the app accordion in a follow-up.
export {
  Accordion,
  AccordionWidgetItem as AccordionItem,
  AccordionWidgetTrigger as AccordionTrigger,
  AccordionWidgetContent as AccordionContent
} from '@/components/ui/accordion';
