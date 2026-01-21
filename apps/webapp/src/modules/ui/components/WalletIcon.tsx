import { Connector } from 'wagmi';
import { cn } from '@/lib/utils';

interface WalletIconProps {
  connector: Connector;
  iconUrl?: string;
  className?: string;
}

export const WalletIcon = ({ connector, iconUrl, className }: WalletIconProps) => {
  const name = connector.name;

  // If we have an icon URL, use it
  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt={name}
        className={cn('h-10 w-10 rounded-lg object-cover', className)}
        onError={e => {
          // Hide broken image and show fallback
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }

  // Fallback to initials if no icon
  const id = connector.id.toLowerCase();

  // Create a colored background based on the connector
  const getBackgroundColor = () => {
    if (id.includes('metamask')) return 'bg-orange-500';
    if (id.includes('walletconnect')) return 'bg-blue-500';
    if (id.includes('coinbase')) return 'bg-blue-600';
    if (id.includes('safe')) return 'bg-green-500';
    if (id.includes('rainbow')) return 'bg-gradient-to-br from-blue-400 to-purple-600';
    if (id.includes('binance')) return 'bg-yellow-500';
    if (id.includes('baseaccount')) return 'bg-blue-700';
    return 'bg-gray-500';
  };

  // Get initials for the wallet
  const getInitials = () => {
    if (id.includes('walletconnect')) return 'WC';
    if (id.includes('baseaccount')) return 'BA';
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <div
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-lg font-semibold text-white',
        getBackgroundColor()
      )}
    >
      {getInitials()}
    </div>
  );
};
