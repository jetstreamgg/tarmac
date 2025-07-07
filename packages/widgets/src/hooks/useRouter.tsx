import { useMemo } from 'react';

// Fallback Link component that uses regular anchor tags
const FallbackLink = ({ to, className, children }: { to: string; className?: string; children?: React.ReactNode }) => (
  <a href={to} className={className}>
    {children}
  </a>
);

// Safe router hook that provides router functionality when available
export const useRouter = () => {
  const LinkComponent = useMemo(() => {
    try {
      // Try to dynamically import react-router-dom Link component
      const { Link } = require('react-router-dom');
      return Link;
    } catch (error) {
      // If react-router-dom is not available, return fallback
      return FallbackLink;
    }
  }, []);

  return {
    Link: LinkComponent
  };
};