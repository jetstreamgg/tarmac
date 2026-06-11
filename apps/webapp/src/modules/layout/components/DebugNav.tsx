import { Link } from '@tanstack/react-router';

const ROUTES = [
  { to: '/', label: 'Balances' },
  { to: '/savings', label: 'Savings' },
  { to: '/rewards', label: 'Rewards' },
  { to: '/stake', label: 'Stake' },
  { to: '/convert', label: 'Convert' },
  { to: '/expert', label: 'Expert' },
  { to: '/vaults', label: 'Vaults' },
  { to: '/fixed', label: 'Fixed' }
] as const;

/**
 * Prototype top-header navigation, kept alongside the legacy WidgetNavigation
 * during the redesign so the team can feel the difference. Plain TanStack
 * <Link>s (no view transition) rendered in normal flow above the header.
 */
export function DebugNav() {
  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '8px 12px',
        background: 'rgba(20,10,40,0.94)',
        color: '#fff',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
        borderBottom: '1px solid #6b46c1'
      }}
    >
      {ROUTES.map(r => (
        <Link
          key={r.to}
          to={r.to}
          style={{
            padding: '4px 12px',
            borderRadius: 8,
            color: '#fff',
            textDecoration: 'none',
            transition: 'background 120ms'
          }}
          activeProps={{ style: { background: '#6b46c1' } }}
        >
          {r.label}
        </Link>
      ))}
    </div>
  );
}
