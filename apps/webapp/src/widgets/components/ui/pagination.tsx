// Re-export shim — unified into the canonical L0 primitive (ticket A1).
// The widget pagination look is preserved verbatim in @/components/ui/pagination
// as the `PaginationWidget*` exports; this shim aliases them back to the names
// widget call-sites use. Slated for convergence with the app pagination in a
// follow-up.
export {
  PaginationWidget as Pagination,
  PaginationWidgetEllipsis as PaginationEllipsis,
  PaginationWidgetItem as PaginationItem,
  PaginationWidgetLink as PaginationLink,
  PaginationWidgetNext as PaginationNext,
  PaginationWidgetPrevious as PaginationPrevious
} from '@/components/ui/pagination';
