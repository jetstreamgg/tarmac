// Re-export shim — unified into the canonical L0 primitive (ticket A1).
// The widget tabs look is preserved verbatim in @/components/ui/tabs as the
// `TabsWidget*` exports; this shim aliases them back to the names widget
// call-sites use. `Tabs` (TabsPrimitive.Root) is shared as-is. Slated for
// convergence with the app tabs in a follow-up.
export {
  Tabs,
  TabsWidgetList as TabsList,
  TabsWidgetTrigger as TabsTrigger,
  TabsWidgetContent as TabsContent
} from '@/components/ui/tabs';
