// Re-export shim — unified into the canonical L0 primitive (ticket A1).
// The widget popover content is preserved verbatim in @/components/ui/popover as
// `PopoverWidgetContent`; this shim aliases it back to `PopoverContent`. The plain
// Radix aliases (Root/Trigger/Portal/Anchor/Close/Arrow) are shared as-is. Slated
// for convergence with the app popover in a follow-up.
export {
  Popover,
  PopoverTrigger,
  PopoverWidgetContent as PopoverContent,
  PopoverPortal,
  PopoverAnchor,
  PopoverClose,
  PopoverArrow
} from '@/components/ui/popover';
