// Re-export shim — unified into the canonical L0 primitive (ticket A1).
// Implementation lives in @/components/ui/progress; this path is kept so existing
// widget call-sites keep compiling. Slated for removal once call-sites migrate.
export * from '@/components/ui/progress';
