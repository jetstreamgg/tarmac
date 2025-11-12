import { injected, walletConnect } from 'wagmi/connectors';
import type { CreateConnectorFn } from 'wagmi';

export type RainbowConnectorOptions = {
  projectId: string;
  appName?: string;
  appDescription?: string;
  appUrl?: string;
  appIcon?: string;
};

// Check if Rainbow wallet is injected
function hasRainbowProvider(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as any).rainbow;
}

// Check if we're on mobile
function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function rainbowConnector({
  projectId,
  appName = 'DApp',
  appDescription,
  appUrl,
  appIcon
}: RainbowConnectorOptions): CreateConnectorFn {
  const isRainbowInjected = hasRainbowProvider();

  // If Rainbow is installed as browser extension, use injected connector
  if (isRainbowInjected && !isMobile()) {
    return injected({
      target: {
        id: 'rainbow',
        name: 'Rainbow',
        provider: (window: any) => window.rainbow,
        icon: 'https://avatars.githubusercontent.com/u/48327834?s=200&v=4' // Rainbow's GitHub avatar as fallback
      }
    });
  }

  // Otherwise use WalletConnect for mobile or when extension is not installed
  return walletConnect({
    projectId,
    metadata: {
      name: appName,
      description: appDescription || `Connect to ${appName}`,
      url: appUrl || (typeof window !== 'undefined' ? window.location.origin : ''),
      icons: appIcon ? [appIcon] : []
    },
    showQrModal: true,
    qrModalOptions: {
      themeMode: 'dark',
      themeVariables: {
        '--wcm-z-index': '9999'
      }
    }
  });
}

export { rainbowConnector, hasRainbowProvider };
